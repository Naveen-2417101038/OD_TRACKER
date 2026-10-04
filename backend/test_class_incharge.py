import os
import sys
import unittest
import io

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import create_app
from backend.database import init_db

class TestClassInchargeApprovalWorkflow(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()

    def get_token_for_user(self, identifier, password, role):
        res = self.client.post('/api/auth/login', json={
            'identifier': identifier,
            'password': password,
            'role': role
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        return data['token']

    def test_01_unauthenticated_access_denied(self):
        """Unauthenticated requests to Class Incharge endpoints must return 401 Unauthorized."""
        res = self.client.get('/api/class-incharge/od-requests')
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

        res = self.client.post('/api/class-incharge/od-requests/OD-REQ-9999/approve', json={'remarks': 'OK'})
        self.assertEqual(res.status_code, 401)

        res = self.client.post('/api/class-incharge/od-requests/OD-REQ-9999/reject', json={'reason': 'No'})
        self.assertEqual(res.status_code, 401)

    def test_02_forbidden_for_student_and_mentor(self):
        """Student and Mentor tokens must be strictly rejected with 403 Forbidden on Class Incharge endpoints."""
        # 1. Student attempting access
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        headers_stu = {'Authorization': f'Bearer {student_token}'}

        res = self.client.get('/api/class-incharge/od-requests', headers=headers_stu)
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Class Incharge', data['error'])

        res = self.client.post('/api/class-incharge/od-requests/OD-REQ-9999/approve', headers=headers_stu, json={'remarks': 'Try approve'})
        self.assertEqual(res.status_code, 403)

        # 2. Mentor attempting access
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')
        headers_men = {'Authorization': f'Bearer {mentor_token}'}

        res = self.client.get('/api/class-incharge/od-requests', headers=headers_men)
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Class Incharge', data['error'])

    def test_03_class_incharge_login_and_fetch_requests(self):
        """Class Incharge Mrs. K. Shanthi can view assigned section requests."""
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')
        headers = {'Authorization': f'Bearer {ci_token}'}

        res = self.client.get('/api/class-incharge/od-requests', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('requests', data)
        self.assertIn('pending', data)
        self.assertIn('history', data)

    def test_04_cannot_approve_request_before_mentor_approval(self):
        """Verify Class Incharge cannot approve a request that is still pending Mentor review."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')

        # Create a new student OD request (Status: Pending, Stage: Mentor)
        create_res = self.client.post('/api/od-requests', headers={
            'Authorization': f'Bearer {student_token}'
        }, data={
            'eventName': 'Inter-College Hackathon 2026',
            'eventType': 'Hackathon',
            'eventOrganizer': 'IIT Madras',
            'venue': 'IIT Madras Research Park',
            'fromDate': '2026-10-15',
            'toDate': '2026-10-16',
            'reason': 'Technical event representation',
            'description': 'Participating in National Hackathon finals'
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # Class Incharge attempts to approve while still in Mentor stage
        ci_res = self.client.post(f'/api/class-incharge/od-requests/{req_id}/approve', headers={
            'Authorization': f'Bearer {ci_token}'
        }, json={'remarks': 'Endorsed prematurely'})
        
        self.assertEqual(ci_res.status_code, 400)
        self.assertIn('Mentor Approved', ci_res.get_json()['error'])

    def test_05_class_incharge_approval_workflow(self):
        """Verify full progression: Submit -> Mentor Approve -> Class Incharge Approve -> HOD Stage."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')

        # 1. Student Submits
        create_res = self.client.post('/api/od-requests', headers={
            'Authorization': f'Bearer {student_token}'
        }, data={
            'eventName': 'AI Conference 2026',
            'eventType': 'Paper Presentation',
            'eventOrganizer': 'Anna University',
            'venue': 'Guindy Campus',
            'fromDate': '2026-11-05',
            'toDate': '2026-11-05',
            'reason': 'Paper Presentation',
            'description': 'Oral research paper presentation on Generative AI'
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # 2. Mentor Approves
        mentor_res = self.client.post(f'/api/mentor/od-requests/{req_id}/approve', headers={
            'Authorization': f'Bearer {mentor_token}'
        }, json={'remarks': 'Paper is indexed in IEEE. Strongly recommended.'})
        self.assertEqual(mentor_res.status_code, 200)

        # Verify request is now in Class Incharge pending list
        ci_list_res = self.client.get('/api/class-incharge/od-requests?status=pending', headers={
            'Authorization': f'Bearer {ci_token}'
        })
        self.assertEqual(ci_list_res.status_code, 200)
        pending_ids = [r['id'] for r in ci_list_res.get_json()['requests']]
        self.assertIn(req_id, pending_ids)

        # 3. Class Incharge Approves (Endorses)
        ci_approve_res = self.client.post(f'/api/class-incharge/od-requests/{req_id}/approve', headers={
            'Authorization': f'Bearer {ci_token}'
        }, json={'remarks': 'Attendance verified. 92% attendance in Section A. Endorsed for HOD.'})
        self.assertEqual(ci_approve_res.status_code, 200)
        ci_data = ci_approve_res.get_json()
        self.assertTrue(ci_data['success'])
        self.assertEqual(ci_data['status'], 'Class Incharge Approved')
        self.assertEqual(ci_data['currentStage'], 'HOD')

        # 4. Student views updated status
        student_check = self.client.get(f'/api/od-requests/{req_id}', headers={
            'Authorization': f'Bearer {student_token}'
        })
        self.assertEqual(student_check.status_code, 200)
        stu_req = student_check.get_json()['request']
        self.assertEqual(stu_req['status'], 'Class Incharge Approved')
        self.assertEqual(stu_req['currentStage'], 'HOD')

    def test_06_class_incharge_rejection_workflow(self):
        """Verify Class Incharge Rejection with mandatory remarks."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')

        # 1. Student Submits
        create_res = self.client.post('/api/od-requests', headers={
            'Authorization': f'Bearer {student_token}'
        }, data={
            'eventName': 'Gaming Expo 2026',
            'eventType': 'Symposium',
            'eventOrganizer': 'External College',
            'venue': 'Chennai Trade Centre',
            'fromDate': '2026-11-20',
            'toDate': '2026-11-20',
            'reason': 'Non-technical symposium',
            'description': 'Gaming and esports'
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # 2. Mentor Approves
        mentor_res = self.client.post(f'/api/mentor/od-requests/{req_id}/approve', headers={
            'Authorization': f'Bearer {mentor_token}'
        }, json={'remarks': 'Forwarded for section review.'})
        self.assertEqual(mentor_res.status_code, 200)

        # 3. Class Incharge rejects without reason -> Should fail with 400
        ci_reject_empty = self.client.post(f'/api/class-incharge/od-requests/{req_id}/reject', headers={
            'Authorization': f'Bearer {ci_token}'
        }, json={'reason': ''})
        self.assertEqual(ci_reject_empty.status_code, 400)
        self.assertIn('mandatory', ci_reject_empty.get_json()['error'])

        # 4. Class Incharge rejects with valid reason
        ci_reject_res = self.client.post(f'/api/class-incharge/od-requests/{req_id}/reject', headers={
            'Authorization': f'Bearer {ci_token}'
        }, json={'reason': 'Internal CAT-2 examination scheduled on this date. OD cannot be granted.'})
        self.assertEqual(ci_reject_res.status_code, 200)
        ci_reject_data = ci_reject_res.get_json()
        self.assertTrue(ci_reject_data['success'])
        self.assertEqual(ci_reject_data['status'], 'Class Incharge Rejected')

        # 5. Student checks rejection status
        student_check = self.client.get(f'/api/od-requests/{req_id}', headers={
            'Authorization': f'Bearer {student_token}'
        })
        self.assertEqual(student_check.status_code, 200)
        stu_req = student_check.get_json()['request']
        self.assertEqual(stu_req['status'], 'Class Incharge Rejected')
        self.assertIn('CAT-2', stu_req.get('rejectionReason', ''))

if __name__ == '__main__':
    unittest.main()
