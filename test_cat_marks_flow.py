"""
End-to-End Test for Displaying Student CAT Marks Across All 4 Dashboards
"""
import io
import json
import urllib.request
import urllib.error
import openpyxl

BASE_URL = "http://127.0.0.1:5000"

def http_req(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    body = None
    if data is not None:
        if isinstance(data, dict):
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif isinstance(data, (bytes, bytearray)):
            body = data
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            return resp.status, content, resp.headers
    except urllib.error.HTTPError as e:
        content = e.read()
        return e.code, content, e.headers

def multipart_upload(url, filename, file_bytes, headers=None):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    if headers is None:
        headers = {}
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    
    parts = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
    parts.append(b"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n")
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    
    body = b"".join(parts)
    return http_req(url, method="POST", data=body, headers=headers)

def run_test():
    print("==================================================")
    print("RUNNING END-TO-END FLOW: CAT MARKS ACROSS DASHBOARDS")
    print("==================================================")

    # 1. Login as Class Incharge
    status, body, _ = http_req(f"{BASE_URL}/api/auth/login", method="POST", data={
        "identifier": "EMP-CSD-102",
        "password": "password123",
        "role": "Class Incharge"
    })
    assert status == 200, f"Class Incharge login failed: {body.decode()}"
    ci_token = json.loads(body.decode()).get("token")
    ci_headers = {"Authorization": f"Bearer {ci_token}"}
    print("[PASS] Step 1: Logged in as Class Incharge (EMP-CSD-102)")

    # 2. Upload Excel with CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Academic Data"
    ws.append(["Register Number", "Student Name", "CAT 1", "CAT 2", "CAT 3", "Attendance Percentage"])
    ws.append(["23CSD001", "Arun Kumar", 78, 82, 75, 91])
    ws.append(["23CSD002", "Bala Kumar", 65, 70, 68, 87])
    
    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_bytes = excel_buffer.getvalue()

    status, body, _ = multipart_upload(
        f"{BASE_URL}/api/class-incharge/academic/upload",
        "test_students.xlsx",
        excel_bytes,
        headers=ci_headers
    )
    assert status == 200, f"Upload failed: {body.decode()}"
    upload_data = json.loads(body.decode())
    confirm_token = upload_data.get("confirm_token")
    assert confirm_token, f"No confirm_token returned: {upload_data}"
    print("[PASS] Step 2: Uploaded Excel with CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%")

    # 3. Confirm upload
    status, body, _ = http_req(
        f"{BASE_URL}/api/class-incharge/academic/confirm",
        method="POST",
        data={"confirm_token": confirm_token},
        headers=ci_headers
    )
    assert status == 200, f"Confirm failed: {body.decode()}"
    print("[PASS] Step 3: Confirmed upload & database updated successfully")

    # 4. Login as that student (23CSD001)
    status, body, _ = http_req(f"{BASE_URL}/api/auth/login", method="POST", data={
        "identifier": "23CSD001",
        "password": "password123",
        "role": "Student"
    })
    assert status == 200, f"Student login failed: {body.decode()}"
    stu_token = json.loads(body.decode()).get("token")
    stu_headers = {"Authorization": f"Bearer {stu_token}"}
    print("[PASS] Step 4: Logged in as Student (23CSD001)")

    # 5. Verify Student Dashboard academic details
    status, body, _ = http_req(f"{BASE_URL}/api/academic/me", method="GET", headers=stu_headers)
    assert status == 200, f"Student /api/academic/me failed: {body.decode()}"
    resp_obj = json.loads(body.decode())
    stu_acad = resp_obj.get("academic", resp_obj)
    print("   [Student View]", {
        "Student": stu_acad.get("student_name"),
        "RegNo": stu_acad.get("register_number"),
        "CAT 1": stu_acad.get("cat1_marks"),
        "CAT 2": stu_acad.get("cat2_marks"),
        "CAT 3": stu_acad.get("cat3_marks"),
        "Attendance": f"{stu_acad.get('attendance_percentage')}%"
    })
    assert stu_acad["cat1_marks"] == 78, f"Expected 78, got {stu_acad['cat1_marks']}"
    assert stu_acad["cat2_marks"] == 82, f"Expected 82, got {stu_acad['cat2_marks']}"
    assert stu_acad["cat3_marks"] == 75, f"Expected 75, got {stu_acad['cat3_marks']}"
    assert stu_acad["attendance_percentage"] == 91, f"Expected 91, got {stu_acad['attendance_percentage']}"
    print("[PASS] Step 5 & 6: Student Dashboard verified (CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%)")

    # Role Security test: Student must NOT be able to view another student's academic record
    status, body, _ = http_req(f"{BASE_URL}/api/students/23CSD002/academic", method="GET", headers=stu_headers)
    assert status == 403, f"Expected 403 Forbidden for cross-student access, got {status}"
    print("[PASS] Security Check: Student cross-access blocked with 403 Forbidden")

    # 7. Login as Faculty / Mentor (EMP-CSD-101)
    status, body, _ = http_req(f"{BASE_URL}/api/auth/login", method="POST", data={
        "identifier": "EMP-CSD-101",
        "password": "password123",
        "role": "Mentor"
    })
    assert status == 200, f"Mentor login failed: {body.decode()}"
    mentor_token = json.loads(body.decode()).get("token")
    mentor_headers = {"Authorization": f"Bearer {mentor_token}"}
    print("[PASS] Step 7: Logged in as Faculty/Mentor (EMP-CSD-101)")

    # 8. Open student academic details as Faculty/Mentor
    status, body, _ = http_req(f"{BASE_URL}/api/students/23CSD001/academic", method="GET", headers=mentor_headers)
    assert status == 200, f"Mentor academic view failed: {body.decode()}"
    resp_obj = json.loads(body.decode())
    m_acad = resp_obj.get("academic", resp_obj)
    print("   [Mentor View]", {
        "Student": m_acad.get("student_name"),
        "RegNo": m_acad.get("register_number"),
        "CAT 1": m_acad.get("cat1_marks"),
        "CAT 2": m_acad.get("cat2_marks"),
        "CAT 3": m_acad.get("cat3_marks"),
        "Attendance": f"{m_acad.get('attendance_percentage')}%"
    })
    assert m_acad["cat1_marks"] == 78
    assert m_acad["cat2_marks"] == 82
    assert m_acad["cat3_marks"] == 75
    assert m_acad["attendance_percentage"] == 91
    print("[PASS] Step 8 & 9: Faculty/Mentor Dashboard verified (CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%)")

    # 10. Class Incharge Roster verification
    status, body, _ = http_req(f"{BASE_URL}/api/class-incharge/academic/students", method="GET", headers=ci_headers)
    assert status == 200
    ci_roster = json.loads(body.decode())
    s1 = next((s for s in ci_roster.get("students", []) if s["registerNumber"] == "23CSD001"), None)
    assert s1 is not None, "Student 23CSD001 not in CI roster"
    print("   [Class Incharge View]", {
        "Student": s1["studentName"],
        "RegNo": s1["registerNumber"],
        "CAT 1": s1["cat1Marks"],
        "CAT 2": s1["cat2Marks"],
        "CAT 3": s1["cat3Marks"],
        "Attendance": f"{s1['attendancePercentage']}%"
    })
    assert s1["cat1Marks"] == 78
    assert s1["cat2Marks"] == 82
    assert s1["cat3Marks"] == 75
    assert s1["attendancePercentage"] == 91
    print("[PASS] Step 10 & 11: Class Incharge Dashboard verified (CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%)")

    # 12. Login as HOD (EMP-CSD-104)
    status, body, _ = http_req(f"{BASE_URL}/api/auth/login", method="POST", data={
        "identifier": "EMP-CSD-104",
        "password": "password123",
        "role": "HOD"
    })
    assert status == 200, f"HOD login failed: {body.decode()}"
    hod_token = json.loads(body.decode()).get("token")
    hod_headers = {"Authorization": f"Bearer {hod_token}"}
    print("[PASS] Step 12: Logged in as HOD (EMP-CSD-104)")

    # 13. HOD inspects student academic details
    status, body, _ = http_req(f"{BASE_URL}/api/students/23CSD001/academic", method="GET", headers=hod_headers)
    assert status == 200, f"HOD academic view failed: {body.decode()}"
    resp_obj = json.loads(body.decode())
    h_acad = resp_obj.get("academic", resp_obj)
    print("   [HOD View]", {
        "Student": h_acad.get("student_name"),
        "RegNo": h_acad.get("register_number"),
        "CAT 1": h_acad.get("cat1_marks"),
        "CAT 2": h_acad.get("cat2_marks"),
        "CAT 3": h_acad.get("cat3_marks"),
        "Attendance": f"{h_acad.get('attendance_percentage')}%"
    })
    assert h_acad["cat1_marks"] == 78
    assert h_acad["cat2_marks"] == 82
    assert h_acad["cat3_marks"] == 75
    assert h_acad["attendance_percentage"] == 91
    print("[PASS] Step 13: HOD Dashboard verified (CAT 1=78, CAT 2=82, CAT 3=75, Attendance=91%)")

    print("\n==================================================")
    print("SUCCESS: ALL 4 DASHBOARDS SHOW IDENTICAL VALUES!")
    print("Single Source of Truth Verified in MongoDB:")
    print("  CAT 1       = 78")
    print("  CAT 2       = 82")
    print("  CAT 3       = 75")
    print("  Attendance  = 91%")
    print("==================================================")

if __name__ == "__main__":
    run_test()
