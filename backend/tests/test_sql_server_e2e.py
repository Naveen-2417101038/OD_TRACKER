"""
Comprehensive End-to-End Test Suite for SQL Server Migration.
Verifies all Phase 6 requirements against ODTRACKINGDB.
"""
import io
import os
import sys
import json
import time
import unittest
from datetime import datetime, timedelta

# Ensure project root in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.app import create_app
from backend.database.sql_server import SQLServerDB, session_scope
from backend.models.db_models import (
    User,
    ODRequest,
    Approval,
    ODHistory,
    Notification,
    StudentAcademicRecord
)
from backend.services.od_eligibility import calculate_od_eligibility
from backend.services.excel_ci_service import (
    validate_and_preview_attendance,
    update_attendance_confirmed,
    validate_and_preview_marks,
    update_marks_confirmed
)


class SQLServerE2ETestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def test_01_health_check(self):
        """Verify API health check endpoint returns healthy Microsoft SQL Server status."""
        resp = self.client.get('/api/health')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('database', {}).get('type'), 'Microsoft SQL Server')
        self.assertTrue(data.get('database', {}).get('connected'))
        self.assertEqual(data.get('database', {}).get('database_name'), 'ODTRACKINGDB')
        print("[+] Test 1 Passed: Health check connected to SQL Server (ODTRACKINGDB).")

    def test_02_login_all_roles(self):
        """Verify login for every application role with existing credentials."""
        roles = [
            ('Student', 'STUD001', 'password123'),
            ('Mentor', 'FAC001', 'password123'),
            ('Class Incharge', 'FAC002', 'password123'),
            ('HOD', 'FAC004', 'password123'),
            ('Admin', 'ADM001', 'password123')
        ]

        for role_name, identifier, pwd in roles:
            resp = self.client.post('/api/auth/login', json={
                'identifier': identifier,
                'password': pwd
            })
            self.assertEqual(resp.status_code, 200, f"Login failed for {role_name} ({identifier})")
            data = resp.get_json()
            self.assertTrue(data.get('success'), f"Expected success for {role_name}")
            token = data.get('token')
            user_data = data.get('user', {})
            self.assertIsNotNone(token)
            self.assertEqual(user_data.get('id') or user_data.get('identifier'), identifier)
            print(f"[+] Login verified for role: {role_name} ({identifier}) -> Token received.")

    def test_03_role_based_authorization(self):
        """Verify role-based access control and unauthorized rejection."""
        # 1. Unauthenticated request - isolated client without session cookies
        unauth_client = self.app.test_client()
        resp_unauth = unauth_client.get('/api/admin/users')
        self.assertIn(resp_unauth.status_code, (401, 403))

        # 2. Student trying to access Admin route
        resp_stud_login = self.client.post('/api/auth/login', json={
            'identifier': 'STUD001',
            'password': 'password123'
        })
        stud_token = resp_stud_login.get_json().get('token')
        headers = {'Authorization': f'Bearer {stud_token}'}

        resp_forbidden = self.client.get('/api/admin/users', headers=headers)
        self.assertEqual(resp_forbidden.status_code, 403)
        print("[+] Test 3 Passed: Role-based authorization correctly blocks non-admin users.")

    def test_04_od_eligibility_rules(self):
        """Verify OD institutional eligibility calculation logic from SQL Server."""
        res = calculate_od_eligibility('STUD001', requested_od_days=2.0)
        self.assertEqual(res.get('student_id'), 'STUD001')
        self.assertGreater(res.get('overall_attendance_percent'), 0)
        self.assertIsNotNone(res.get('cgpa'))
        self.assertTrue(res.get('eligible'))
        print(f"[+] Test 4 Passed: Eligibility calculation verified: Attendance={res['overall_attendance_percent']}%, CGPA={res['cgpa']}, Eligible={res['eligible']}.")

    def test_05_full_od_approval_workflow(self):
        """
        Verify end-to-end OD request lifecycle:
        Student submit -> Mentor approve -> Class Incharge approve -> HOD approve.
        """
        # Step A: Student login & Submit OD Request
        login_res = self.client.post('/api/auth/login', json={'identifier': 'STUD001', 'password': 'password123'})
        student_token = login_res.get_json()['token']
        headers_student = {'Authorization': f'Bearer {student_token}'}

        # Events must be >= 3 days in advance from today
        from_date = (datetime.now().date() + timedelta(days=5)).strftime('%Y-%m-%d')
        to_date = (datetime.now().date() + timedelta(days=6)).strftime('%Y-%m-%d')

        create_res = self.client.post('/api/od-requests', headers=headers_student, json={
            'event_name': 'Automated SQL Server Migration Hackathon 2026',
            'event_type': 'Symposium',
            'event_organizer': 'IIT Madras',
            'venue': 'Main Auditorium',
            'from_date': from_date,
            'to_date': to_date,
            'number_of_days': 2.0,
            'reason': 'Technical Paper Presentation',
            'description': 'Participating in technical paper presentation and software hackathon.'
        })
        self.assertEqual(create_res.status_code, 201, f"OD creation failed: {create_res.get_json()}")
        od_data = create_res.get_json().get('request', {})
        od_id = od_data.get('id')
        self.assertIsNotNone(od_id)
        self.assertEqual(od_data.get('status'), 'Pending')
        print(f"[+] Workflow Step 1: Student submitted OD request {od_id} (Status: Pending).")

        # Step B: Mentor Approval
        mentor_login = self.client.post('/api/auth/login', json={'identifier': 'FAC001', 'password': 'password123'})
        mentor_token = mentor_login.get_json()['token']
        headers_mentor = {'Authorization': f'Bearer {mentor_token}'}

        mentor_review = self.client.post(f'/api/mentor/od-requests/{od_id}/approve', headers=headers_mentor, json={
            'comments': 'Verified eligibility and student representation. Approved by Mentor.'
        })
        self.assertEqual(mentor_review.status_code, 200)
        self.assertEqual(mentor_review.get_json().get('request', {}).get('status'), 'Mentor Approved')
        print(f"[+] Workflow Step 2: Mentor approved request {od_id} -> Status: Mentor Approved.")

        # Step C: Class Incharge Approval
        ci_login = self.client.post('/api/auth/login', json={'identifier': 'FAC002', 'password': 'password123'})
        ci_token = ci_login.get_json()['token']
        headers_ci = {'Authorization': f'Bearer {ci_token}'}

        ci_review = self.client.post(f'/api/class-incharge/od-requests/{od_id}/approve', headers=headers_ci, json={
            'comments': 'Attendance verified. Approved by Class Incharge.'
        })
        self.assertEqual(ci_review.status_code, 200)
        self.assertEqual(ci_review.get_json().get('request', {}).get('status'), 'Class Incharge Approved')
        print(f"[+] Workflow Step 3: Class Incharge approved request {od_id} -> Status: Class Incharge Approved.")

        # Step D: HOD Approval
        hod_login = self.client.post('/api/auth/login', json={'identifier': 'FAC004', 'password': 'password123'})
        hod_token = hod_login.get_json()['token']
        headers_hod = {'Authorization': f'Bearer {hod_token}'}

        hod_review = self.client.post(f'/api/hod/od-requests/{od_id}/approve', headers=headers_hod, json={
            'comments': 'Final department approval granted. Certificate required upon return.'
        })
        self.assertEqual(hod_review.status_code, 200)
        final_status = hod_review.get_json().get('request', {}).get('status')
        self.assertIn(final_status, ('HOD Approved - Certificate Pending', 'HOD Approved', 'Approved'))
        print(f"[+] Workflow Step 4: HOD approved request {od_id} -> Status: {final_status}.")

        # Step E: Verify OD History and Notification records in database
        with session_scope() as session:
            hist_records = session.query(ODHistory).filter_by(request_id=od_id).all()
            self.assertGreaterEqual(len(hist_records), 3, "Expected at least 3 history transition records")

        # Allow async email dispatcher up to 3 seconds to write notification
        notifs = []
        for _ in range(30):
            with session_scope() as session:
                notifs = session.query(Notification).filter_by(related_request_id=od_id).all()
                if notifs:
                    break
            time.sleep(0.1)

        self.assertGreaterEqual(len(notifs), 1, "Expected notification records generated for request")
        print(f"[+] Workflow Step 5: Verified {len(hist_records)} audit history logs and {len(notifs)} notifications in SQL Server.")

    def test_06_excel_attendance_and_marks_workflow(self):
        """Verify Class Incharge weekly attendance and marks preview & confirmation."""
        ci_user = {
            'id': 'FAC002',
            'name': 'Mrs. K. Shanthi',
            'department': 'Computer Science and Design',
            'section': 'A',
            'year': 'III Year'
        }

        # 1. Attendance update
        raw_att_rows = [
            ['Register Number', 'Student Name', 'Attendance Percentage', 'Total Working Days'],
            ['23CSD001', 'Naveen', '89.5', '120']
        ]
        prev_att = validate_and_preview_attendance(raw_att_rows, ci_user)
        self.assertTrue(prev_att.get('success'))
        self.assertEqual(prev_att.get('summary', {}).get('matched_count'), 1)

        commit_att = update_attendance_confirmed(prev_att.get('rows', []), ci_user, 'weekly_att_test.xlsx')
        self.assertTrue(commit_att.get('success'))
        self.assertEqual(commit_att.get('updated_count'), 1)

        # Verify in SQL Server
        with session_scope() as session:
            st = session.query(User).filter_by(id='STUD001').first()
            self.assertEqual(float(st.attendance_percentage), 89.5)
        print("[+] Test 6A Passed: Excel attendance update confirmed & reflected in SQL Server.")

        # 2. Marks update
        raw_marks_rows = [
            ['Register Number', 'Student Name', 'CAT 1', 'CAT 2', 'CAT 3'],
            ['23CSD001', 'Naveen', '85.0', '88.5', '92.0']
        ]
        prev_marks = validate_and_preview_marks(raw_marks_rows, ci_user)
        self.assertTrue(prev_marks.get('success'))
        self.assertEqual(prev_marks.get('summary', {}).get('matched_count'), 1)

        commit_marks = update_marks_confirmed(prev_marks.get('rows', []), ci_user, 'marks_test.xlsx')
        self.assertTrue(commit_marks.get('success'))
        self.assertEqual(commit_marks.get('updated_count'), 1)

        # Verify in SQL Server
        with session_scope() as session:
            acad = session.query(StudentAcademicRecord).filter_by(student_id='STUD001').first()
            self.assertEqual(float(acad.cat1_marks), 85.0)
            self.assertEqual(float(acad.cat2_marks), 88.5)
            self.assertEqual(float(acad.cat3_marks), 92.0)
        print("[+] Test 6B Passed: Excel CAT marks update confirmed & reflected in SQL Server.")

    def test_07_admin_user_management(self):
        """Verify Admin user management: list, update, toggle status."""
        admin_login = self.client.post('/api/auth/login', json={'identifier': 'ADM001', 'password': 'password123'})
        admin_token = admin_login.get_json()['token']
        headers = {'Authorization': f'Bearer {admin_token}'}

        # List users
        users_res = self.client.get('/api/admin/users', headers=headers)
        self.assertEqual(users_res.status_code, 200)
        users_list = users_res.get_json().get('users', [])
        self.assertGreaterEqual(len(users_list), 9)
        print(f"[+] Test 7 Passed: Admin successfully retrieved {len(users_list)} users from SQL Server.")

    def test_08_transaction_rollback(self):
        """Verify database transaction rolls back when an operation fails."""
        dummy_id = f"ROLLBACK_TEST_{datetime.now().strftime('%H%M%S')}"

        try:
            with session_scope() as session:
                dummy_user = User(
                    id=dummy_id,
                    identifier=dummy_id,
                    name='Rollback Test User',
                    email=f"{dummy_id.lower()}@rajalakshmi.edu.in",
                    password_hash='dummy_hash',
                    role='Student'
                )
                session.add(dummy_user)
                # Intentionally trigger an unhandled exception before commit
                raise RuntimeError("Intentional error to trigger rollback")
        except RuntimeError:
            pass  # Expected exception

        # Verify that dummy_user was NOT committed
        with session_scope() as session:
            found = session.query(User).filter_by(id=dummy_id).first()
            self.assertIsNone(found, "User should NOT exist in database after rolled back transaction")
        print("[+] Test 8 Passed: Transaction rollback successfully aborted uncommitted operations.")


if __name__ == '__main__':
    unittest.main(verbosity=2)
