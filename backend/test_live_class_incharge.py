import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = 'http://127.0.0.1:5000'

def make_request(path, method='GET', data=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = headers or {}
    if token:
        req_headers['Authorization'] = f'Bearer {token}'
    
    body = None
    if data is not None:
        req_headers['Content-Type'] = 'application/json'
        body = json.dumps(data).encode('utf-8')

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        res_body = e.read().decode('utf-8')
        try:
            parsed = json.loads(res_body)
        except Exception:
            parsed = {'error': res_body}
        return e.code, parsed

def run_live_tests():
    print("=== STARTING LIVE HTTP TESTS FOR CLASS INCHARGE MODULE ===")

    # 1. Health check
    status, body = make_request('/api/health')
    assert status == 200, f"Health check failed: {status} {body}"
    print("[PASS] 1. Backend health check passed.")

    # 2. Unauthorized access check
    status, body = make_request('/api/class-incharge/od-requests')
    assert status == 401, f"Expected 401 Unauthorized for missing token, got {status}"
    print("[PASS] 2. Unauthorized access blocked (401).")

    # 3. Student Login
    status, body = make_request('/api/auth/login', method='POST', data={
        'identifier': '23CSD001',
        'password': 'password123',
        'role': 'Student'
    })
    assert status == 200, f"Student login failed: {status} {body}"
    student_token = body['token']
    print(f"[PASS] 3. Student logged in successfully: {body['user']['name']}")

    # 4. Mentor Login
    status, body = make_request('/api/auth/login', method='POST', data={
        'identifier': 'FAC001',
        'password': 'password123',
        'role': 'Mentor'
    })
    assert status == 200, f"Mentor login failed: {status} {body}"
    mentor_token = body['token']
    print(f"[PASS] 4. Mentor logged in successfully: {body['user']['name']}")

    # 5. Class Incharge Login
    status, body = make_request('/api/auth/login', method='POST', data={
        'identifier': 'FAC002',
        'password': 'password123',
        'role': 'Class Incharge'
    })
    assert status == 200, f"Class Incharge login failed: {status} {body}"
    ci_token = body['token']
    print(f"[PASS] 5. Class Incharge logged in successfully: {body['user']['name']}")

    # 6. Forbidden check: Student attempting Class Incharge endpoint
    status, body = make_request('/api/class-incharge/od-requests', token=student_token)
    assert status == 403, f"Expected 403 for student token, got {status}"
    print("[PASS] 6. Student forbidden from Class Incharge endpoints (403).")

    # 7. Forbidden check: Mentor attempting Class Incharge endpoint
    status, body = make_request('/api/class-incharge/od-requests', token=mentor_token)
    assert status == 403, f"Expected 403 for mentor token, got {status}"
    print("[PASS] 7. Mentor forbidden from Class Incharge endpoints (403).")

    # 8. Student Submits OD Request
    status, body = make_request('/api/od-requests', method='POST', token=student_token, data={
        'eventName': 'Smart India Hackathon 2026 - Finale',
        'eventType': 'Hackathon',
        'eventOrganizer': 'Ministry of Education & AICTE',
        'venue': 'IIT Madras Research Park',
        'fromDate': '2026-11-12',
        'toDate': '2026-11-14',
        'reason': 'Grand Finale representation',
        'description': '3-day nationwide hackathon championship representation.'
    })
    assert status == 201, f"OD creation failed: {status} {body}"
    req_id = body['requestId']
    print(f"[PASS] 8. Student submitted OD Request: {req_id} (Status: Pending, Stage: Mentor)")

    # 9. Class Incharge attempts to approve BEFORE mentor approval -> Should fail
    status, body = make_request(f'/api/class-incharge/od-requests/{req_id}/approve', method='POST', token=ci_token, data={
        'remarks': 'Premature approval'
    })
    assert status == 400, f"Expected 400 when approving non-mentor-approved request, got {status}: {body}"
    print("[PASS] 9. Class Incharge prevented from approving request before Mentor approval.")

    # 10. Mentor Approves request
    status, body = make_request(f'/api/mentor/od-requests/{req_id}/approve', method='POST', token=mentor_token, data={
        'remarks': 'Verified SIH finalist letter. Recommended.'
    })
    assert status == 200, f"Mentor approval failed: {status} {body}"
    assert body['status'] == 'Mentor Approved'
    assert body['currentStage'] == 'Class Incharge'
    print(f"[PASS] 10. Mentor approved request {req_id} -> Advanced to Class Incharge stage.")

    # 11. Class Incharge Views Pending List
    status, body = make_request('/api/class-incharge/od-requests', token=ci_token)
    assert status == 200, f"Class Incharge list fetch failed: {status} {body}"
    pending_ids = [r['id'] for r in body.get('pending', [])]
    assert req_id in pending_ids, f"Expected {req_id} in pending list: {pending_ids}"
    print(f"[PASS] 11. Request {req_id} successfully listed in Class Incharge pending queue.")

    # 12. Class Incharge views specific request detail
    status, body = make_request(f'/api/class-incharge/od-requests/{req_id}', token=ci_token)
    assert status == 200, f"Class Incharge detail fetch failed: {status} {body}"
    assert body['request']['id'] == req_id
    print(f"[PASS] 12. Class Incharge fetched detailed request payload for {req_id}.")

    # 13. Class Incharge Approves (Endorses) Request
    status, body = make_request(f'/api/class-incharge/od-requests/{req_id}/approve', method='POST', token=ci_token, data={
        'remarks': 'Attendance is 94%. Lab requirements completed. Endorsed for HOD sanction.'
    })
    assert status == 200, f"Class Incharge approval failed: {status} {body}"
    assert body['status'] == 'Class Incharge Approved'
    assert body['currentStage'] == 'HOD'
    print(f"[PASS] 13. Class Incharge approved request {req_id} -> Status: Class Incharge Approved, Stage: HOD.")

    # 14. Student Views Updated Status
    status, body = make_request(f'/api/od-requests/{req_id}', token=student_token)
    assert status == 200, f"Student detail fetch failed: {status} {body}"
    assert body['request']['status'] == 'Class Incharge Approved'
    assert body['request']['currentStage'] == 'HOD'
    print(f"[PASS] 14. Student verified updated Class Incharge Approved status and HOD stage.")

    # 15. Test Rejection Lifecycle
    # Student submits 2nd request
    status, body = make_request('/api/od-requests', method='POST', token=student_token, data={
        'eventName': 'Weekend Gaming Con 2026',
        'eventType': 'Symposium',
        'eventOrganizer': 'Private Club',
        'venue': 'Chennai',
        'fromDate': '2026-11-25',
        'toDate': '2026-11-25',
        'reason': 'Gaming festival',
        'description': 'Participating in gaming tournament'
    })
    assert status == 201
    rej_req_id = body['requestId']

    # Mentor Approves
    status, body = make_request(f'/api/mentor/od-requests/{rej_req_id}/approve', method='POST', token=mentor_token, data={
        'remarks': 'Forwarded for class review'
    })
    assert status == 200

    # Class Incharge Rejects without reason -> Fails (400)
    status, body = make_request(f'/api/class-incharge/od-requests/{rej_req_id}/reject', method='POST', token=ci_token, data={
        'reason': ''
    })
    assert status == 400
    print("[PASS] 15. Class Incharge rejection without reason blocked (400).")

    # Class Incharge Rejects with valid reason
    status, body = make_request(f'/api/class-incharge/od-requests/{rej_req_id}/reject', method='POST', token=ci_token, data={
        'reason': 'Attendance shortage (below 75%). OD cannot be approved.'
    })
    assert status == 200
    assert body['status'] == 'Class Incharge Rejected'
    print(f"[PASS] 16. Class Incharge rejected request {rej_req_id} with mandatory reason logged.")

    # Student verifies rejection
    status, body = make_request(f'/api/od-requests/{rej_req_id}', token=student_token)
    assert status == 200
    assert body['request']['status'] == 'Class Incharge Rejected'
    assert 'below 75%' in body['request'].get('rejectionReason', '')
    print(f"[PASS] 17. Student verified Class Incharge Rejected status with reason in portal.")

    print("\n=== ALL 17 LIVE HTTP TESTS PASSED SUCCESSFULLY! ===")

if __name__ == '__main__':
    run_live_tests()
