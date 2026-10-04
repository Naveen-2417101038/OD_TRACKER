import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
import json
from backend.app import create_app
from backend.database import init_db, users_collection
from backend.config import Config

class AuthenticationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def test_01_password_hashing_in_db(self):
        """Verify that passwords stored in users collection are cryptographically hashed, not plain text."""
        col = users_collection()
        users = list(col.find({}, {"identifier": 1, "password_hash": 1}))

        self.assertGreater(len(users), 0, "Users table should have seeded accounts")
        for u in users:
            p_hash = u['password_hash']
            self.assertIsNotNone(p_hash)
            self.assertNotEqual(p_hash, 'password123', f"Plain text password found for {u['identifier']}")
            self.assertTrue(
                p_hash.startswith('scrypt:') or p_hash.startswith('pbkdf2:'),
                f"Password hash format invalid for {u['identifier']}: {p_hash[:15]}"
            )

    def test_02_student_login(self):
        """Test Student login redirects to /student/dashboard."""
        res = self.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'password123',
            'role': 'Student'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['role'], 'Student')
        self.assertEqual(data['dashboardUrl'], '/student/dashboard')
        self.assertEqual(data['user']['identifier'], '23CSD001')
        self.assertIn('token', data)

    def test_03_mentor_login(self):
        """Test Mentor login redirects to /mentor/dashboard."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'FAC001',
            'password': 'password123',
            'role': 'Mentor'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['role'], 'Mentor')
        self.assertEqual(data['dashboardUrl'], '/faculty/dashboard')

    def test_04_class_incharge_login(self):
        """Test Class Incharge login redirects to /class-incharge/dashboard."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'FAC002',
            'password': 'password123',
            'role': 'Class Incharge'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['role'], 'Class Incharge')
        self.assertEqual(data['dashboardUrl'], '/class-incharge/dashboard')

    def test_05_hod_login(self):
        """Test HOD login redirects to /hod/dashboard."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'FAC004',
            'password': 'password123',
            'role': 'HOD'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['role'], 'HOD')
        self.assertEqual(data['dashboardUrl'], '/hod/dashboard')

    def test_06_invalid_password_rejected(self):
        """Test invalid password returns 401."""
        res = self.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'wrongpassword',
            'role': 'Student'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Invalid password', data['error'])

    def test_07_nonexistent_user_rejected(self):
        """Test nonexistent user returns 401."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'UNKNOWN999',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

    def test_08_role_mismatch_rejected(self):
        """Test logging into Student portal with Mentor credentials returns 401 role mismatch error."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'FAC001',
            'password': 'password123',
            'role': 'Student'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn('Mentor', data['error'])

    def test_09_me_endpoint_and_token_auth(self):
        """Test /api/auth/me with Bearer token authentication."""
        login_res = self.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'password123'
        })
        token = login_res.get_json()['token']

        # Query /api/auth/me using Bearer header
        me_res = self.client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data['authenticated'])
        self.assertEqual(me_data['user']['identifier'], '23CSD001')
        self.assertEqual(me_data['role'], 'Student')

    def test_10_role_protection_barrier(self):
        """Test role-protected endpoint blocks unauthorized roles with 403."""
        login_res = self.client.post('/api/auth/login', json={
            'identifier': '23CSD001',
            'password': 'password123'
        })
        token = login_res.get_json()['token']

        # Student trying to access HOD-only endpoint
        hod_res = self.client.get('/api/auth/role-check/HOD', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(hod_res.status_code, 403)

        # Student accessing Student endpoint
        student_res = self.client.get('/api/auth/role-check/Student', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(student_res.status_code, 200)

    def test_11_logout(self):
        """Test /api/auth/logout clears session."""
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])

if __name__ == '__main__':
    unittest.main()
