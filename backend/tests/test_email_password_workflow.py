import os
import sys
import unittest
import json

# Ensure project root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))

from backend.app import create_app
from backend.models.user import UserModel
from backend.services.email_service import EmailService

class TestEmailPasswordWorkflow(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

        # Seed test user
        with self.app.app_context():
            UserModel.ensure_indexes()
            user = UserModel.find_by_email('student.test@rajalakshmi.edu.in')
            if not user:
                user = UserModel.create(
                    email='student.test@rajalakshmi.edu.in',
                    password='Password123!',
                    role='Student',
                    full_name='Test Student',
                    register_number='23CSD999',
                    department='CSD',
                    year=3,
                    section='A',
                    email_verified=True,
                    account_status='ACTIVE'
                )
            else:
                UserModel.reset_password(user['id'], 'Password123!')
                from backend.database.mongodb import users_collection
                col = users_collection()
                if col is not None:
                    col.update_one({"id": user['id']}, {"$set": {"email_verified": True, "account_status": "ACTIVE"}})

    def login(self, identifier='student.test@rajalakshmi.edu.in', password='Password123!'):
        return self.client.post('/api/auth/login', json={
            'identifier': identifier,
            'password': password,
            'role': 'Student'
        })

    def test_01_method_a_change_password_success(self):
        """Method A: Change password using correct current password."""
        login_res = self.login()
        self.assertEqual(login_res.status_code, 200)
        token = login_res.get_json()['token']

        res = self.client.post('/api/auth/change-password', 
            headers={'Authorization': f'Bearer {token}'},
            json={
                'currentPassword': 'Password123!',
                'newPassword': 'NewSecurePass456!',
                'confirmPassword': 'NewSecurePass456!'
            }
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])

        # Verify old password fails
        old_login = self.login('student.test@rajalakshmi.edu.in', 'Password123!')
        self.assertNotEqual(old_login.status_code, 200)

        # Verify new password succeeds
        new_login = self.login('student.test@rajalakshmi.edu.in', 'NewSecurePass456!')
        self.assertEqual(new_login.status_code, 200)

        # Restore original password
        UserModel.reset_password(UserModel.find_by_email('student.test@rajalakshmi.edu.in')['id'], 'Password123!')

    def test_02_method_a_reject_incorrect_current_password(self):
        """Method A: Reject incorrect current password and mismatching passwords."""
        login_res = self.login()
        token = login_res.get_json()['token']

        # Wrong current password
        res = self.client.post('/api/auth/change-password',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'currentPassword': 'WrongPassword999!',
                'newPassword': 'NewSecurePass456!',
                'confirmPassword': 'NewSecurePass456!'
            }
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('Current password is incorrect', res.get_json()['error'])

        # Mismatch
        res_mismatch = self.client.post('/api/auth/change-password',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'currentPassword': 'Password123!',
                'newPassword': 'NewSecurePass456!',
                'confirmPassword': 'DifferentPassword456!'
            }
        )
        self.assertEqual(res_mismatch.status_code, 400)
        self.assertIn('do not match', res_mismatch.get_json()['error'])

    def test_03_method_b_otp_dispatch_and_verification(self):
        """Method B: Send OTP, verify OTP, and reset password."""
        # 1. Send OTP
        res_send = self.client.post('/api/auth/otp/send', json={
            'email': 'student.test@rajalakshmi.edu.in'
        })
        self.assertEqual(res_send.status_code, 200)
        self.assertTrue(res_send.get_json()['success'])

        # Retrieve user and OTP from database
        user = UserModel.find_by_email('student.test@rajalakshmi.edu.in')
        otp_meta = user.get('email_otp')
        self.assertIsNotNone(otp_meta)
        self.assertEqual(len(otp_meta['hash']), 64) # SHA-256 hash stored

        # 2. Reject incorrect OTP
        res_bad_otp = self.client.post('/api/auth/otp/verify', json={
            'email': 'student.test@rajalakshmi.edu.in',
            'otp': '000000'
        })
        self.assertEqual(res_bad_otp.status_code, 400)

        # 3. Create fresh OTP and verify
        with self.app.app_context():
            plain_otp = UserModel.create_email_otp(user['id'])

        res_verify = self.client.post('/api/auth/otp/verify', json={
            'email': 'student.test@rajalakshmi.edu.in',
            'otp': plain_otp
        })
        self.assertEqual(res_verify.status_code, 200)
        reset_token = res_verify.get_json().get('resetToken')
        self.assertIsNotNone(reset_token)

        # 4. Invalidate reused OTP
        res_reused = self.client.post('/api/auth/otp/verify', json={
            'email': 'student.test@rajalakshmi.edu.in',
            'otp': plain_otp
        })
        self.assertEqual(res_reused.status_code, 400)

        # 5. Reset password using resetToken
        res_reset = self.client.post('/api/auth/otp/reset-password', json={
            'email': 'student.test@rajalakshmi.edu.in',
            'resetToken': reset_token,
            'newPassword': 'BrandNewPassword789!',
            'confirmPassword': 'BrandNewPassword789!'
        })
        self.assertEqual(res_reset.status_code, 200)

        # Verify old password no longer works
        old_login = self.login('student.test@rajalakshmi.edu.in', 'Password123!')
        self.assertNotEqual(old_login.status_code, 200)

        # Verify new password works
        new_login = self.login('student.test@rajalakshmi.edu.in', 'BrandNewPassword789!')
        self.assertEqual(new_login.status_code, 200)

        # Restore original password
        UserModel.reset_password(user['id'], 'Password123!')

    def test_04_email_service_notifications(self):
        """Test all email notification templates render and dispatch without exceptions."""
        with self.app.app_context():
            # 1. OTP email
            ok1 = EmailService.send_otp_email('test@rajalakshmi.edu.in', '123456', 'Test Student')
            self.assertTrue(ok1)

            # 2. Password changed email
            ok2 = EmailService.send_password_changed_notification('test@rajalakshmi.edu.in', 'Test Student')
            self.assertTrue(ok2)

            # 3. OD submission email
            sample_req = {
                'id': 'OD-TEST-001',
                'event_name': 'Smart India Hackathon',
                'category': 'External Symposium',
                'from_date': '2026-10-15',
                'to_date': '2026-10-16',
                'total_days': 2,
                'status': 'SUBMITTED',
                'student_name': 'Test Student',
                'register_number': '23CSD999',
                'department': 'CSD',
                'year': 3,
                'section': 'A'
            }
            ok3 = EmailService.send_od_submitted_student(sample_req)
            self.assertTrue(ok3)

            # 4. Mentor recommendation email
            ok4 = EmailService.send_mentor_approved_student(sample_req, 'Recommended for hackathon')
            self.assertTrue(ok4)

            # 5. Class Incharge endorsement email
            ok5 = EmailService.send_class_incharge_approved_student(sample_req, 'Attendance threshold satisfied')
            self.assertTrue(ok5)

            # 6. HOD sanction email
            ok6 = EmailService.send_hod_approved_student(sample_req, 'Final approval sanctioned')
            self.assertTrue(ok6)

            # 7. Certificate verification email
            ok7 = EmailService.send_certificate_verified_student(sample_req, 'Certificate authentic')
            self.assertTrue(ok7)

if __name__ == '__main__':
    unittest.main()
