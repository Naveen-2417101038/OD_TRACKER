import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import io
import unittest
import json
from backend.app import create_app
from backend.database import init_db

class ODRequestTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        # Login Student
        res_student = cls.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'password123',
            'role': 'Student'
        })
        cls.student_token = res_student.get_json()['token']

        # Login Mentor
        res_mentor = cls.client.post('/api/auth/login', json={
            'identifier': 'FAC001',
            'password': 'password123',
            'role': 'Mentor'
        })
        cls.mentor_token = res_mentor.get_json()['token']

    def test_01_create_od_request_success(self):
        """Test submitting a valid OD request creates a record with 'Pending' status."""
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={
                'eventName': 'Smart India Hackathon 2026',
                'eventType': 'Hackathon',
                'eventOrganizer': 'Ministry of Education',
                'venue': 'IIT Madras Research Park',
                'fromDate': '2026-10-15',
                'toDate': '2026-10-17',
                'fromTime': '08:30',
                'toTime': '18:00',
                'reason': 'Shortlisted for Grand Finale',
                'description': 'Selected among top 10 teams nationwide for the Smart Automation problem statement.'
            }
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('requestId', data)
        self.assertEqual(data['request']['status'], 'Pending')
        self.assertEqual(data['request']['currentStage'], 'Mentor')
        self.assertEqual(data['request']['studentRegisterNo'], '23CSD001')
        self.assertEqual(data['request']['numberOfDays'], 3.0)

    def test_02_create_od_request_with_file_upload(self):
        """Test submitting an OD request with a supporting PDF document upload."""
        dummy_pdf = (io.BytesIO(b"%PDF-1.4 Mock PDF Content for OD Letter"), 'invitation_letter.pdf')
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            data={
                'eventName': 'National Robotics Symposium',
                'eventType': 'Symposium',
                'eventOrganizer': 'Anna University',
                'venue': 'Tag Auditorium, CEG Campus',
                'fromDate': '2026-11-05',
                'toDate': '2026-11-05',
                'reason': 'Paper Presentation on AI in Autonomous Drones',
                'description': 'Oral research paper presentation.',
                'od_letter': dummy_pdf
            },
            content_type='multipart/form-data'
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIsNotNone(data['request']['documentUrl'])
        self.assertTrue(data['request']['documentUrl'].startswith('/api/od-requests/uploads/od_letters/'))

    def test_03_get_my_od_requests(self):
        """Test retrieving all OD requests filed by the logged-in student."""
        res = self.client.get(
            '/api/od-requests/my',
            headers={'Authorization': f'Bearer {self.student_token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIsInstance(data['requests'], list)
        self.assertGreater(len(data['requests']), 0)
        for req in data['requests']:
            self.assertIn(req['studentRegisterNo'], ['23CSD001', 'STUD001'])

    def test_04_get_od_request_by_id(self):
        """Test retrieving a specific OD request by ID."""
        # Create a request first
        create_res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={
                'eventName': 'State Level Badminton Championship',
                'eventType': 'Sports',
                'eventOrganizer': 'Tamil Nadu Sports Development Authority',
                'venue': 'Jawaharlal Nehru Stadium',
                'fromDate': '2026-12-01',
                'toDate': '2026-12-02',
                'reason': 'Representing College Badminton Team',
                'description': 'Inter-collegiate zonal tournament.'
            }
        )
        req_id = create_res.get_json()['requestId']

        # Fetch details
        res = self.client.get(
            f'/api/od-requests/{req_id}',
            headers={'Authorization': f'Bearer {self.student_token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['request']['id'], req_id)
        self.assertEqual(data['request']['eventName'], 'State Level Badminton Championship')
        self.assertIn('stages', data['request'])

    def test_05_unauthenticated_creation_rejected(self):
        """Test unauthenticated request creation returns 401."""
        fresh_client = self.app.test_client()
        res = fresh_client.post('/api/od-requests', json={
            'eventName': 'Unauthorized Event',
            'eventType': 'Workshop',
            'eventOrganizer': 'Test Org',
            'venue': 'Test Hall',
            'fromDate': '2026-10-10',
            'toDate': '2026-10-10',
            'reason': 'Test'
        })
        self.assertEqual(res.status_code, 401)

    def test_06_mentor_cannot_create_student_request(self):
        """Test non-student role (Mentor) is rejected with 403 Forbidden."""
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.mentor_token}'},
            json={
                'eventName': 'Mentor Trying Student Action',
                'eventType': 'Workshop',
                'eventOrganizer': 'Test Org',
                'venue': 'Test Hall',
                'fromDate': '2026-10-10',
                'toDate': '2026-10-10',
                'reason': 'Test'
            }
        )
        self.assertEqual(res.status_code, 403)

    def test_07_invalid_dates_rejected(self):
        """Test invalid date range (toDate before fromDate) returns 400."""
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={
                'eventName': 'Date Anomaly Event',
                'eventType': 'Hackathon',
                'eventOrganizer': 'Test Org',
                'venue': 'Test Hall',
                'fromDate': '2026-10-20',
                'toDate': '2026-10-15',  # Earlier than fromDate!
                'reason': 'Testing date validation'
            }
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('end date cannot be earlier', data['error'])

    def test_08_missing_required_fields_rejected(self):
        """Test missing required fields return 400 Bad Request."""
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={
                'eventName': '',
                'eventType': '',
                'reason': ''
            }
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Missing required fields', data['error'])

    def test_09_invalid_file_type_rejected(self):
        """Test disallowed file extensions (e.g. .exe) are rejected with 400."""
        dummy_exe = (io.BytesIO(b"executable payload"), 'malicious.exe')
        res = self.client.post(
            '/api/od-requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            data={
                'eventName': 'File Security Test',
                'eventType': 'Workshop',
                'eventOrganizer': 'Test Org',
                'venue': 'Main Hall',
                'fromDate': '2026-10-10',
                'toDate': '2026-10-10',
                'reason': 'Security verification',
                'od_letter': dummy_exe
            },
            content_type='multipart/form-data'
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Invalid file type', data['error'])

if __name__ == '__main__':
    unittest.main()
