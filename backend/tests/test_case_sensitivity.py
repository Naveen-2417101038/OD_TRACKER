import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def test_login(identifier, password, role=None):
    payload = {"identifier": identifier, "password": password}
    if role:
        payload["role"] = role
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            return status, data
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            body = e.read().decode("utf-8")
            data = json.loads(body)
        except Exception:
            data = {"error": str(e)}
        return status, data
    except Exception as e:
        return 500, {"error": str(e)}

def main():
    print("=" * 60)
    print("Running Username Case-Sensitivity & Normalization Tests")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    # 1. Student tests (Student 'Naveen S' - 241701038 / naveen)
    student_test_cases = [
        ("241701038", "password123", True, "Numeric Reg No"),
        ("naveen", "password123", True, "All Lowercase Username"),
        ("NAVEEN", "password123", True, "All Uppercase Username"),
        ("Naveen", "password123", True, "Title Case Username"),
        ("NaVeEn", "password123", True, "Mixed Case Username"),
        ("  naveen  ", "password123", True, "Leading/Trailing Whitespace Username"),
        ("naveen", "wrongpassword", False, "Correct Username + Wrong Password (must reject)"),
        ("nonexistentuser12345", "password123", False, "Nonexistent User"),
    ]
    
    print("\n--- 1. Student Authentication ---")
    for ident, pwd, should_succeed, label in student_test_cases:
        status, data = test_login(ident, pwd)
        success = (status == 200 and data.get("success") is True) if should_succeed else (status in [401, 404] and not data.get("success", False))
        if success:
            print(f"  [PASS] {label}: '{ident}' -> HTTP {status} (role: {data.get('user', {}).get('role') if should_succeed else 'N/A'})")
            passed += 1
        else:
            print(f"  [FAIL] {label}: '{ident}' -> HTTP {status}, data: {data}")
            failed += 1

    # 2. Mentor tests (Dr. A. Rajesh - EMP-CSD-101 / rajesh)
    mentor_cases = [
        ("EMP-CSD-101", "password123", "Mentor ID Uppercase"),
        ("emp-csd-101", "password123", "Mentor ID Lowercase"),
        ("rajesh", "password123", "Mentor Username Lowercase"),
        ("RAJESH", "password123", "Mentor Username Uppercase"),
        ("RaJeSh", "password123", "Mentor Username Mixed Case"),
    ]
    print("\n--- 2. Mentor Authentication ---")
    for ident, pwd, label in mentor_cases:
        status, data = test_login(ident, pwd)
        role = data.get("user", {}).get("role") if status == 200 else None
        if status == 200 and role == "Mentor":
            print(f"  [PASS] {label}: '{ident}' -> HTTP 200 (role: {role})")
            passed += 1
        else:
            print(f"  [FAIL] {label}: '{ident}' -> HTTP {status}, role: {role}")
            failed += 1

    # 3. Class Incharge tests (Mrs. K. Shanthi - EMP-CSD-102 / shanthi)
    ci_cases = [
        ("EMP-CSD-102", "password123", "Class Incharge ID Uppercase"),
        ("emp-csd-102", "password123", "Class Incharge ID Lowercase"),
        ("shanthi", "password123", "Class Incharge Username Lowercase"),
        ("SHANTHI", "password123", "Class Incharge Username Uppercase"),
    ]
    print("\n--- 3. Class Incharge Authentication ---")
    for ident, pwd, label in ci_cases:
        status, data = test_login(ident, pwd)
        role = data.get("user", {}).get("role") if status == 200 else None
        if status == 200 and role == "Class Incharge":
            print(f"  [PASS] {label}: '{ident}' -> HTTP 200 (role: {role})")
            passed += 1
        else:
            print(f"  [FAIL] {label}: '{ident}' -> HTTP {status}, role: {role}")
            failed += 1

    # 4. HOD tests (Dr. Karpagam - EMP-CSD-104 / karpagam)
    hod_cases = [
        ("EMP-CSD-104", "password123", "HOD ID Uppercase"),
        ("emp-csd-104", "password123", "HOD ID Lowercase"),
        ("karpagam", "password123", "HOD Username Lowercase"),
        ("KARPAGAM", "password123", "HOD Username Uppercase"),
    ]
    print("\n--- 4. HOD Authentication ---")
    for ident, pwd, label in hod_cases:
        status, data = test_login(ident, pwd)
        role = data.get("user", {}).get("role") if status == 200 else None
        if status == 200 and role == "HOD":
            print(f"  [PASS] {label}: '{ident}' -> HTTP 200 (role: {role})")
            passed += 1
        else:
            print(f"  [FAIL] {label}: '{ident}' -> HTTP {status}, role: {role}")
            failed += 1

    # 5. Admin tests (Super Administrator - ADMIN-001 / admin)
    admin_cases = [
        ("ADMIN-001", "password123", "Admin ID Uppercase"),
        ("admin-001", "password123", "Admin ID Lowercase"),
        ("admin", "password123", "Admin Username Lowercase"),
        ("ADMIN", "password123", "Admin Username Uppercase"),
        ("AdMiN", "password123", "Admin Username Mixed Case"),
        ("  admin  ", "password123", "Admin Username Whitespace"),
    ]
    print("\n--- 5. Admin Authentication ---")
    for ident, pwd, label in admin_cases:
        status, data = test_login(ident, pwd)
        role = data.get("user", {}).get("role") if status == 200 else None
        if status == 200 and role == "Admin":
            print(f"  [PASS] {label}: '{ident}' -> HTTP 200 (role: {role})")
            passed += 1
        else:
            print(f"  [FAIL] {label}: '{ident}' -> HTTP {status}, role: {role}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Test Summary: {passed} PASSED, {failed} FAILED (Total: {passed + failed})")
    print("=" * 60)
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
