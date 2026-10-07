import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
import json
from backend.app import create_app
from backend.database.mongodb import init_db, users_collection
from backend.models.user import UserModel, validate_college_email

class RealAuthenticationSystemTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            col = users_collection()
            if col is not None:
                # Clean up test accounts (keep default seed accounts)
                col.delete_many({
                    "email": {"$nin": [
                        'naveen.23csd@rajalakshmi.edu.in',
                        'priya.23csd@rajalakshmi.edu.in',
                        'karthik.23csd@rajalakshmi.edu.in',
                        'a.rajesh@rajalakshmi.edu.in',
                        'k.shanthi@rajalakshmi.edu.in',
                        'v.karpagam@rajalakshmi.edu.in',
                        'admin@rajalakshmi.edu.in'
                    ]}
                })

    def test_01_college_email_domain_restriction(self):
        """Verify that ONLY @rajalakshmi.edu.in emails are accepted."""
        # 1. Reject external domain @gmail.com
        res = self.client.post('/api/auth/register', json={
            'email': 'student@gmail.com',
            'password': 'password123',
            'confirmPassword': 'password123',
            'fullName': 'External User'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('rajalakshmi.edu.in', data['error'])

        # 2. Reject external domain @othercollege.edu
        res_other = self.client.post('/api/auth/register', json={
            'email': 'student@othercollege.edu',
            'password': 'password123',
            'confirmPassword': 'password123',
            'fullName': 'Other College User'
        })
        self.assertEqual(res_other.status_code, 400)

        # 3. Accept official college domain @rajalakshmi.edu.in (case-insensitive)
        valid, norm = validate_college_email('TEST.STUDENT@RAJALAKSHMI.EDU.IN')
        self.assertTrue(valid)
        self.assertEqual(norm, 'test.student@rajalakshmi.edu.in')

    def test_02_account_registration_and_email_verification_flow(self):
        """Test registration creates unverified account, blocks login until verified, then succeeds."""
        test_email = 'newstudent.23csd@rajalakshmi.edu.in'

        # 1. Register new student account
        reg_res = self.client.post('/api/auth/register', json={
            'email': test_email,
            'password': 'mysecretpassword123',
            'confirmPassword': 'mysecretpassword123',
            'fullName': 'New Student',
            'registerNumber': '23CSD999',
            'role': 'Student'
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.get_json()
        self.assertTrue(reg_data['success'])
        self.assertTrue(reg_data['unverified'])
        verification_token = reg_data.get('verificationToken')

        # 2. Verify email token via endpoint
        verify_res = self.client.get(f'/api/auth/verify-email/{verification_token}')
        self.assertEqual(verify_res.status_code, 200)
        v_res_data = verify_res.get_json()
        self.assertTrue(v_res_data['success'])

        # 3. Attempt login after verification -> MUST SUCCEED
        login_verified = self.client.post('/api/auth/login', json={
            'identifier': test_email,
            'password': 'mysecretpassword123'
        })
        self.assertEqual(login_verified.status_code, 200)
        v_data = login_verified.get_json()
        self.assertTrue(v_data['success'])
        self.assertEqual(v_data['role'], 'Student')
        self.assertIn('token', v_data)

    def test_03_prevent_privileged_role_self_registration(self):
        """Verify normal public registration blocks assigning Admin or HOD roles."""
        res = self.client.post('/api/auth/register', json={
            'email': 'attacker@rajalakshmi.edu.in',
            'password': 'password123',
            'confirmPassword': 'password123',
            'fullName': 'Attacker',
            'role': 'Admin'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('privileged role', data['error'].lower())

    def test_04_forgot_password_account_enumeration_protection(self):
        """Verify forgot password returns identical generic response for both existing and non-existing emails."""
        # Non-existing email
        res_fake = self.client.post('/api/auth/forgot-password', json={
            'email': 'nonexistent.student@rajalakshmi.edu.in'
        })
        self.assertEqual(res_fake.status_code, 200)
        data_fake = res_fake.get_json()
        self.assertTrue(data_fake['success'])
        self.assertIn('link has been sent', data_fake['message'])

        # Real existing email
        res_real = self.client.post('/api/auth/forgot-password', json={
            'email': 'naveen.23csd@rajalakshmi.edu.in'
        })
        self.assertEqual(res_real.status_code, 200)
        data_real = res_real.get_json()
        self.assertTrue(data_real['success'])
        self.assertEqual(data_fake['message'], data_real['message'])

    def test_05_password_reset_and_login_with_new_password(self):
        """Test end-to-end password reset with secure single-use token."""
        test_email = 'naveen.23csd@rajalakshmi.edu.in'

        # 1. Request reset token
        raw_token, name, u_dict = UserModel.create_password_reset_token(test_email)
        self.assertIsNotNone(raw_token)

        # 2. Perform password reset
        new_password = 'NewSecurePassword2026!'
        reset_res = self.client.post('/api/auth/reset-password', json={
            'token': raw_token,
            'newPassword': new_password,
            'confirmPassword': new_password
        })
        self.assertEqual(reset_res.status_code, 200)
        self.assertTrue(reset_res.get_json()['success'])

        # 3. Old password fails
        old_login = self.client.post('/api/auth/login', json={
            'identifier': test_email,
            'password': 'password123'
        })
        self.assertEqual(old_login.status_code, 401)

        # 4. New password succeeds
        new_login = self.client.post('/api/auth/login', json={
            'identifier': test_email,
            'password': new_password
        })
        self.assertEqual(new_login.status_code, 200)

        # Reset password back to default password123 for other tests
        UserModel.change_password(u_dict['id'], 'password123')

    def test_06_change_password_logged_in_user(self):
        """Test change password endpoint for authenticated session."""
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'naveen.23csd@rajalakshmi.edu.in',
            'password': 'password123'
        })
        token = login_res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        # Incorrect current password fails
        fail_res = self.client.post('/api/auth/change-password', headers=headers, json={
            'currentPassword': 'wrongpassword',
            'newPassword': 'brandnewpassword123',
            'confirmPassword': 'brandnewpassword123'
        })
        self.assertEqual(fail_res.status_code, 400)
        self.assertIn('current password is incorrect', fail_res.get_json()['error'].lower())

        # Valid password change succeeds
        success_res = self.client.post('/api/auth/change-password', headers=headers, json={
            'currentPassword': 'password123',
            'newPassword': 'brandnewpassword123',
            'confirmPassword': 'brandnewpassword123'
        })
        self.assertEqual(success_res.status_code, 200)
        self.assertTrue(success_res.get_json()['success'])

        # Reset password back to default
        UserModel.change_password('STUD001', 'password123')

    def test_07_account_disabled_status(self):
        """Verify disabled accounts are rejected on login."""
        # Disable account STUD001
        UserModel.set_account_status('STUD001', 'DISABLED')

        res = self.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('disabled', data['error'].lower())

        # Re-enable account STUD001
        UserModel.set_account_status('STUD001', 'ACTIVE')

if __name__ == '__main__':
    unittest.main()
