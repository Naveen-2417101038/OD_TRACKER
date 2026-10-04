import urllib.request
import json
import urllib.error
import io
import uuid

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

def get_raw(path, headers=None):
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
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def post_multipart(path, fields, files, headers=None):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = io.BytesIO()

    for k, v in fields.items():
        body.write(f"--{boundary}\r\n".encode('utf-8'))
        body.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode('utf-8'))
        body.write(f"{v}\r\n".encode('utf-8'))

    for k, (filename, content, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode('utf-8'))
        body.write(f'Content-Disposition: form-data; name="{k}"; filename="{filename}"\r\n'.encode('utf-8'))
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode('utf-8'))
        body.write(content if isinstance(content, bytes) else content.encode('utf-8'))
        body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode('utf-8'))

    req_headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}',
    }
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body.getvalue(),
        headers=req_headers,
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def run_live_tests():
    print("=" * 60)
    print("[*] STARTING LIVE HTTP TESTS FOR MENTOR REVIEW MODULE")
    print("=" * 60)

    # 1. Health Check
    status, data = get_json("/api/health")
    assert status == 200 and data.get("status") == "healthy"
    print("[+] 1. Health Check: PASSED")

    # 2. Student Login
    status, data = post_json("/api/auth/login", {
        "identifier": "23CSD001",
        "password": "password123",
        "role": "Student"
    })
    assert status == 200 and data.get("success")
    student_token = data["token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("[+] 2. Student Login (23CSD001): PASSED")

    # 3. Mentor Login
    status, data = post_json("/api/auth/login", {
        "identifier": "FAC001",
        "password": "password123",
        "role": "Mentor"
    })
    assert status == 200 and data.get("success")
    mentor_token = data["token"]
    mentor_headers = {"Authorization": f"Bearer {mentor_token}"}
    print("[+] 3. Mentor Login (Dr. A. Rajesh - FAC001): PASSED")

    # 4. Role Barrier: Student denied Mentor API access
    status, data = get_json("/api/mentor/od-requests", headers=student_headers)
    assert status == 403, f"Expected 403, got {status}"
    print("[+] 4. Role Barrier (Student denied Mentor API access with 403): PASSED")

    # 5. Student submits OD Request 1 (for Approval test)
    fake_pdf = b"%PDF-1.4 Live Hackathon Shortlist Letter Official Proof"
    fields = {
        "eventName": "Live SIH 2026 Grand Finale",
        "eventType": "Hackathon",
        "eventOrganizer": "Ministry of Education Innovation Cell",
        "venue": "IIT Delhi Campus",
        "fromDate": "2026-10-15",
        "toDate": "2026-10-17",
        "fromTime": "08:30",
        "toTime": "18:00",
        "reason": "Finalist presentation for Smart Education problem statement",
        "description": "Selected among top 5 teams nationwide."
    }
    files = {"od_letter": ("sih_final_letter.pdf", fake_pdf, "application/pdf")}
    status, data = post_multipart("/api/od-requests", fields, files, headers=student_headers)
    assert status == 201 and data.get("success")
    req1_id = data["requestId"]
    print(f"[+] 5. Student OD Request 1 Created ({req1_id}): PASSED")

    # 6. Mentor views assigned pending requests
    status, data = get_json("/api/mentor/od-requests", headers=mentor_headers)
    assert status == 200 and data.get("success")
    pending_ids = [r["id"] for r in data.get("pending", [])]
    assert req1_id in pending_ids, f"Request {req1_id} not found in pending list: {pending_ids}"
    print(f"[+] 6. Mentor Dashboard received Pending Request ({req1_id}): PASSED")

    # 7. Mentor views request detail and downloads letter
    status, data = get_json(f"/api/mentor/od-requests/{req1_id}", headers=mentor_headers)
    assert status == 200 and data.get("success")
    detail = data["request"]
    assert detail["status"] == "Pending"
    assert detail["currentStage"] == "Mentor"

    status, raw_content = get_raw(f"/api/mentor/od-requests/{req1_id}/letter", headers=mentor_headers)
    assert status == 200
    assert b"Live Hackathon Shortlist Letter" in raw_content
    print(f"[+] 7. Mentor Inspected OD Letter File: PASSED")

    # 8. Mentor Approves Request 1
    approve_remarks = "Verified official SIH finalist letter. Strong innovation potential. Recommended for OD."
    status, data = post_json(f"/api/mentor/od-requests/{req1_id}/approve", {"remarks": approve_remarks}, headers=mentor_headers)
    assert status == 200 and data.get("success")
    assert data["status"] == "Mentor Approved"
    assert data["currentStage"] == "Class Incharge"
    print(f"[+] 8. Mentor Approved Request ({req1_id} -> 'Mentor Approved'): PASSED")

    # 9. Student checks status of Request 1
    status, data = get_json(f"/api/od-requests/{req1_id}", headers=student_headers)
    assert status == 200 and data.get("success")
    st_req = data["request"]
    assert st_req["status"] == "Mentor Approved"
    assert st_req["stages"]["mentor"]["status"] == "Approved"
    assert approve_remarks in st_req["stages"]["mentor"]["feedback"]
    print(f"[+] 9. Student sees status 'Mentor Approved' on Student Portal: PASSED")

    # 10. Student submits OD Request 2 (for Rejection test)
    status, data = post_json("/api/od-requests", {
        "eventName": "Casual Gaming Expo",
        "eventType": "Other",
        "eventOrganizer": "Private Lounge",
        "venue": "T Nagar",
        "fromDate": "2026-10-25",
        "toDate": "2026-10-25",
        "reason": "LAN party event attendance",
    }, headers=student_headers)
    assert status == 201 and data.get("success")
    req2_id = data["requestId"]
    print(f"[+] 10. Student OD Request 2 Created ({req2_id}): PASSED")

    # 11. Mentor Rejection without reason fails
    status, data = post_json(f"/api/mentor/od-requests/{req2_id}/reject", {"reason": "   "}, headers=mentor_headers)
    assert status == 400 and not data.get("success")
    print("[+] 11. Mentor Rejection validation (reason required): PASSED")

    # 12. Mentor Rejection with reason
    rejection_reason = "Non-academic unaccredited event during continuous assessment period."
    status, data = post_json(f"/api/mentor/od-requests/{req2_id}/reject", {"reason": rejection_reason}, headers=mentor_headers)
    assert status == 200 and data.get("success")
    assert data["status"] == "Mentor Rejected"
    print(f"[+] 12. Mentor Rejected Request ({req2_id} -> 'Mentor Rejected'): PASSED")

    # 13. Student checks rejection status and reason
    status, data = get_json(f"/api/od-requests/{req2_id}", headers=student_headers)
    assert status == 200 and data.get("success")
    st_req2 = data["request"]
    assert st_req2["status"] == "Mentor Rejected"
    assert st_req2["rejectionReason"] == rejection_reason
    assert st_req2["stages"]["mentor"]["status"] == "Rejected"
    print(f"[+] 13. Student sees status 'Mentor Rejected' & remarks on Student Portal: PASSED")

    # 14. Cannot re-approve or re-reject processed request
    status, data = post_json(f"/api/mentor/od-requests/{req1_id}/approve", {"remarks": "duplicate"}, headers=mentor_headers)
    assert status == 400 and not data.get("success")
    print("[+] 14. Prevent Re-approving Processed Request (400 Bad Request): PASSED")

    print("\n" + "=" * 60)
    print("[+] ALL 14 LIVE HTTP TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_live_tests()
