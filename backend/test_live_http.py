import urllib.request
import json
import urllib.error

BASE_URL = "http://127.0.0.1:5000"

def post_json(path, data, headers=None):
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode('utf-8'),
        headers=req_headers,
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get_json(path, headers=None):
    req_headers = {}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers=req_headers,
        method='GET'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def run_live_tests():
    print("=== RUNNING LIVE HTTP AUTHENTICATION INTEGRATION TESTS ===")
    
    # 1. Health check
    status, data = get_json("/api/health")
    print(f"[*] GET /api/health -> Status: {status}, Service: {data.get('service')}, Database: {data.get('database', {}).get('status')}")
    assert status == 200 and data.get('status') == 'healthy'

    # 2. Student Login
    status, data = post_json("/api/auth/login", {
        "identifier": "23CSD001",
        "password": "password123",
        "role": "Student"
    })
    print(f"[*] POST /api/auth/login (Student) -> Status: {status}, Success: {data.get('success')}, Role: {data.get('role')}, Dashboard: {data.get('dashboardUrl')}")
    assert status == 200 and data.get('role') == 'Student' and data.get('dashboardUrl') == '/student/dashboard'
    student_token = data.get('token')

    # 3. Mentor Login
    status, data = post_json("/api/auth/login", {
        "identifier": "FAC001",
        "password": "password123",
        "role": "Mentor"
    })
    print(f"[*] POST /api/auth/login (Mentor) -> Status: {status}, Success: {data.get('success')}, Role: {data.get('role')}, Dashboard: {data.get('dashboardUrl')}")
    assert status == 200 and data.get('role') == 'Mentor' and data.get('dashboardUrl') == '/faculty/dashboard'

    # 4. Class Incharge Login
    status, data = post_json("/api/auth/login", {
        "identifier": "FAC002",
        "password": "password123",
        "role": "Class Incharge"
    })
    print(f"[*] POST /api/auth/login (Class Incharge) -> Status: {status}, Success: {data.get('success')}, Role: {data.get('role')}, Dashboard: {data.get('dashboardUrl')}")
    assert status == 200 and data.get('role') == 'Class Incharge' and data.get('dashboardUrl') == '/class-incharge/dashboard'

    # 5. HOD Login
    status, data = post_json("/api/auth/login", {
        "identifier": "FAC004",
        "password": "password123",
        "role": "HOD"
    })
    print(f"[*] POST /api/auth/login (HOD) -> Status: {status}, Success: {data.get('success')}, Role: {data.get('role')}, Dashboard: {data.get('dashboardUrl')}")
    assert status == 200 and data.get('role') == 'HOD' and data.get('dashboardUrl') == '/hod/dashboard'

    # 6. Invalid Password Test
    status, data = post_json("/api/auth/login", {
        "identifier": "23CSD001",
        "password": "wrong_password",
        "role": "Student"
    })
    print(f"[*] POST /api/auth/login (Invalid Password) -> Status: {status}, Error: {data.get('error')}")
    assert status == 401 and data.get('success') is False

    # 7. Non-existent User Test
    status, data = post_json("/api/auth/login", {
        "identifier": "INVALID_USER_999",
        "password": "password123"
    })
    print(f"[*] POST /api/auth/login (Nonexistent User) -> Status: {status}, Error: {data.get('error')}")
    assert status == 401 and data.get('success') is False

    # 8. Role Mismatch Test
    status, data = post_json("/api/auth/login", {
        "identifier": "FAC001",
        "password": "password123",
        "role": "Student"
    })
    print(f"[*] POST /api/auth/login (Role Mismatch) -> Status: {status}, Error: {data.get('error')}")
    assert status == 401 and data.get('success') is False

    # 9. GET /api/auth/me with Bearer Token
    status, data = get_json("/api/auth/me", headers={'Authorization': f"Bearer {student_token}"})
    print(f"[*] GET /api/auth/me (Bearer Token) -> Status: {status}, Authenticated: {data.get('authenticated')}, User: {data.get('user', {}).get('name')}")
    assert status == 200 and data.get('authenticated') is True and 'Naveen' in data.get('user', {}).get('name', '')

    # 10. Role Barrier Check (Student token accessing HOD endpoint -> 403 Forbidden)
    status, data = get_json("/api/auth/role-check/HOD", headers={'Authorization': f"Bearer {student_token}"})
    print(f"[*] GET /api/auth/role-check/HOD (Student token accessing HOD) -> Status: {status}, Error: {data.get('error')}")
    assert status == 403

    # 11. Role Barrier Check (Student token accessing Student endpoint -> 200 OK)
    status, data = get_json("/api/auth/role-check/Student", headers={'Authorization': f"Bearer {student_token}"})
    print(f"[*] GET /api/auth/role-check/Student (Student token accessing Student) -> Status: {status}, Success: {data.get('success')}")
    assert status == 200

    # 12. Logout
    status, data = post_json("/api/auth/logout", {})
    print(f"[*] POST /api/auth/logout -> Status: {status}, Message: {data.get('message')}")
    assert status == 200 and data.get('success') is True

    print("\n[SUCCESS] ALL LIVE HTTP INTEGRATION TESTS PASSED 100%!")

if __name__ == '__main__':
    run_live_tests()
