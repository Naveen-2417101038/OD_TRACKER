import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
import io
from datetime import datetime
from backend.app import create_app
from backend.database import init_db, od_requests_collection, approvals_collection, od_history_collection
from backend.models.od_request import ODRequestModel

class TestMentorApprovalWorkflow(unittest.TestCase):
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

    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests to mentor endpoints must return 401 Unauthorized."""
        res = self.client.get('/api/mentor/od-requests')
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

        res = self.client.post('/api/mentor/od-requests/REQ_TEST/approve', json={'remarks': 'OK'})
        self.assertEqual(res.status_code, 401)

        res = self.client.post('/api/mentor/od-requests/REQ_TEST/reject', json={'reason': 'No'})
        self.assertEqual(res.status_code, 401)

    def test_student_forbidden_access(self):
        """Student token must be strictly rejected with 403 Forbidden on mentor endpoints."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        headers = {'Authorization': f'Bearer {student_token}'}

        res = self.client.get('/api/mentor/od-requests', headers=headers)
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Mentor', data['error'])

        res = self.client.post('/api/mentor/od-requests/REQ_TEST/approve', headers=headers, json={'remarks': 'Try approve'})
        self.assertEqual(res.status_code, 403)

    def test_mentor_login_and_fetch_requests(self):
        """Mentor Dr. A. Rajesh can view assigned mentee requests."""
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')
        headers = {'Authorization': f'Bearer {mentor_token}'}

        res = self.client.get('/api/mentor/od-requests', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('requests', data)
        self.assertIn('pending', data)
        self.assertIn('history', data)

    def test_mentor_approve_request_lifecycle(self):
        """Full lifecycle: Student applies -> Pending -> Mentor approves -> Mentor Approved."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')

        # 1. Student creates an OD Request
        create_res = self.client.post('/api/od-requests', headers={'Authorization': f'Bearer {student_token}'}, data={
            'eventName': 'SIH 2026 Grand Finale',
            'eventType': 'Hackathon',
            'eventOrganizer': 'Ministry of Education & AICTE',
            'venue': 'IIT Roorkee',
            'fromDate': '2026-10-15',
            'toDate': '2026-10-17',
            'reason': 'Selected for Grand Finale round after zonal screening',
            'description': 'Hardware edition finals representation.'
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # 2. Mentor views request
        detail_res = self.client.get(f'/api/mentor/od-requests/{req_id}', headers={'Authorization': f'Bearer {mentor_token}'})
        self.assertEqual(detail_res.status_code, 200)
        req_data = detail_res.get_json()['request']
        self.assertEqual(req_data['status'], 'Pending')
        self.assertEqual(req_data['currentStage'], 'Mentor')

        # 3. Mentor Approves request with remarks
        approve_res = self.client.post(
            f'/api/mentor/od-requests/{req_id}/approve',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'remarks': 'Verified selection letter. Recommended for OD concession.'}
        )
        self.assertEqual(approve_res.status_code, 200)
        approve_data = approve_res.get_json()
        self.assertTrue(approve_data['success'])
        self.assertEqual(approve_data['status'], 'Mentor Approved')
        self.assertEqual(approve_data['currentStage'], 'Class Incharge')

        # 4. Verify database state
        req_col = od_requests_collection()
        db_req = req_col.find_one({"id": req_id})
        self.assertEqual(db_req['status'], 'Mentor Approved')
        self.assertEqual(db_req['current_stage'], 'Class Incharge')

        appr_col = approvals_collection()
        approval_record = appr_col.find_one({"request_id": req_id, "reviewer_role": "Mentor"})
        self.assertIsNotNone(approval_record)
        self.assertEqual(approval_record['action'], 'Approved')
        self.assertIn('Verified selection', approval_record['comments'])

        hist_col = od_history_collection()
        history_record = hist_col.find_one({"request_id": req_id, "action": "Mentor Approved"})
        self.assertIsNotNone(history_record)
        self.assertEqual(history_record['role'], 'Mentor')

        # 5. Student views updated request
        student_view_res = self.client.get(f'/api/od-requests/{req_id}', headers={'Authorization': f'Bearer {student_token}'})
        self.assertEqual(student_view_res.status_code, 200)
        student_req = student_view_res.get_json()['request']
        self.assertEqual(student_req['status'], 'Mentor Approved')
        self.assertEqual(student_req['stages']['mentor']['status'], 'Approved')
        self.assertIn('Verified selection', student_req['stages']['mentor']['feedback'])

    def test_mentor_reject_request_lifecycle(self):
        """Full lifecycle: Student applies -> Pending -> Mentor rejects with reason -> Mentor Rejected."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')

        # 1. Student creates an OD Request
        create_res = self.client.post('/api/od-requests', headers={'Authorization': f'Bearer {student_token}'}, data={
            'eventName': 'Informal Gaming Meet',
            'eventType': 'Other',
            'eventOrganizer': 'Gaming Club',
            'venue': 'Chennai',
            'fromDate': '2026-10-20',
            'toDate': '2026-10-20',
            'reason': 'Gaming competition participation',
            'description': 'Informal weekend esports event.'
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # 2. Rejection without remarks must fail with 400
        fail_res = self.client.post(
            f'/api/mentor/od-requests/{req_id}/reject',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'reason': '   '}
        )
        self.assertEqual(fail_res.status_code, 400)
        self.assertIn('mandatory', fail_res.get_json()['error'])

        # 3. Rejection with valid reason succeeds
        rejection_reason = "Unrecognized non-academic event. Conflicts with scheduled departmental assessment."
        reject_res = self.client.post(
            f'/api/mentor/od-requests/{req_id}/reject',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'reason': rejection_reason}
        )
        self.assertEqual(reject_res.status_code, 200)
        reject_data = reject_res.get_json()
        self.assertTrue(reject_data['success'])
        self.assertEqual(reject_data['status'], 'Mentor Rejected')

        # 4. Verify database state
        req_col = od_requests_collection()
        db_req = req_col.find_one({"id": req_id})
        self.assertEqual(db_req['status'], 'Mentor Rejected')
        self.assertEqual(db_req['rejection_reason'], rejection_reason)

        hist_col = od_history_collection()
        history_record = hist_col.find_one({"request_id": req_id, "action": "Mentor Rejected"})
        self.assertIsNotNone(history_record)
        self.assertEqual(history_record['remarks'], rejection_reason)

        # 5. Student views rejection remarks
        student_view_res = self.client.get(f'/api/od-requests/{req_id}', headers={'Authorization': f'Bearer {student_token}'})
        self.assertEqual(student_view_res.status_code, 200)
        student_req = student_view_res.get_json()['request']
        self.assertEqual(student_req['status'], 'Mentor Rejected')
        self.assertEqual(student_req['rejectionReason'], rejection_reason)
        self.assertEqual(student_req['stages']['mentor']['status'], 'Rejected')
        self.assertEqual(student_req['stages']['mentor']['feedback'], rejection_reason)

    def test_prevent_modifying_already_processed_request(self):
        """A mentor cannot re-approve or re-reject a request that is already processed."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')

        # Create and approve
        create_res = self.client.post('/api/od-requests', headers={'Authorization': f'Bearer {student_token}'}, data={
            'eventName': 'Robotics Challenge',
            'eventType': 'Competition',
            'eventOrganizer': 'Anna University',
            'venue': 'Guindy',
            'fromDate': '2026-11-01',
            'toDate': '2026-11-01',
            'reason': 'Technical contest',
        })
        req_id = create_res.get_json()['requestId']

        self.client.post(
            f'/api/mentor/od-requests/{req_id}/approve',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'remarks': 'First approval'}
        )

        # Attempt to approve again
        re_approve_res = self.client.post(
            f'/api/mentor/od-requests/{req_id}/approve',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'remarks': 'Second approval'}
        )
        self.assertEqual(re_approve_res.status_code, 400)
        self.assertIn('Cannot approve request', re_approve_res.get_json()['error'])

        # Attempt to reject after approval
        re_reject_res = self.client.post(
            f'/api/mentor/od-requests/{req_id}/reject',
            headers={'Authorization': f'Bearer {mentor_token}'},
            json={'reason': 'Trying to reject'}
        )
        self.assertEqual(re_reject_res.status_code, 400)
        self.assertIn('Cannot reject request', re_reject_res.get_json()['error'])

    def test_mentor_od_letter_view(self):
        """Mentor can securely view/stream the attached OD letter document."""
        student_token = self.get_token_for_user('23CSD001', 'password123', 'Student')
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')

        fake_pdf = io.BytesIO(b"%PDF-1.4 Mock OD Letter Document Content For Mentor Review")
        create_res = self.client.post('/api/od-requests', headers={'Authorization': f'Bearer {student_token}'}, data={
            'eventName': 'State Symposium Paper Presentation',
            'eventType': 'Symposium',
            'eventOrganizer': 'MIT Campus',
            'venue': 'Chromepet',
            'fromDate': '2026-11-10',
            'toDate': '2026-11-10',
            'reason': 'Selected research paper presentation',
            'od_letter': (fake_pdf, 'official_invite.pdf')
        })
        self.assertEqual(create_res.status_code, 201)
        req_id = create_res.get_json()['requestId']

        # Mentor downloads the letter
        doc_res = self.client.get(f'/api/mentor/od-requests/{req_id}/letter', headers={'Authorization': f'Bearer {mentor_token}'})
        self.assertEqual(doc_res.status_code, 200)
        self.assertIn(b'%PDF-1.4 Mock OD Letter Document Content', doc_res.data)

if __name__ == '__main__':
    unittest.main()
