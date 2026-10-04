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
    print("=== RUNNING LIVE HTTP OD REQUEST MODULE TESTS ===")

    # 1. Login as Student
    status, auth_data = post_json("/api/auth/login", {
        "identifier": "23CSD001",
        "password": "password123",
        "role": "Student"
    })
    assert status == 200, "Student login failed"
    token = auth_data['token']
    print(f"[*] Authenticated Student: {auth_data['user']['name']} ({auth_data['user']['identifier']})")

    # 2. Submit OD Request with File Upload
    fields = {
        'eventName': 'Smart India Hackathon 2026 Grand Finale',
        'eventType': 'Hackathon',
        'eventOrganizer': 'Ministry of Education & AICTE',
        'venue': 'IIT Madras Research Park, Chennai',
        'fromDate': '2026-10-22',
        'toDate': '2026-10-24',
        'fromTime': '08:00',
        'toTime': '20:00',
        'reason': 'Selected for Grand Finale Problem Statement #SIH104',
        'description': 'Final round 36-hour non-stop development hackathon.'
    }
    files = {
        'od_letter': ('sih_shortlist_invitation.pdf', b'%PDF-1.4 Official Selection Proof Document', 'application/pdf')
    }
    status, data = post_multipart('/api/od-requests', fields, files, headers={'Authorization': f'Bearer {token}'})
    print(f"[*] POST /api/od-requests (Multipart with PDF) -> Status: {status}, Request ID: {data.get('requestId')}, Status: {data.get('request', {}).get('status')}")
    assert status == 201, f"Failed: {data}"
    assert data['success'] is True
    assert data['request']['status'] == 'Pending'
    assert data['request']['currentStage'] == 'Mentor'
    assert data['request']['studentRegisterNo'] == '23CSD001'
    req_id = data['requestId']
    doc_url = data['request']['documentUrl']
    print(f"[*] Created OD Document URL: {doc_url}")

    # 3. Retrieve Student Requests via GET /api/od-requests/my
    status, data = get_json('/api/od-requests/my', headers={'Authorization': f'Bearer {token}'})
    print(f"[*] GET /api/od-requests/my -> Status: {status}, Total Requests: {data.get('count')}")
    assert status == 200
    assert data['success'] is True
    assert any(r['id'] == req_id for r in data['requests'])

    # 4. Retrieve Single Request via GET /api/od-requests/<id>
    status, data = get_json(f'/api/od-requests/{req_id}', headers={'Authorization': f'Bearer {token}'})
    print(f"[*] GET /api/od-requests/{req_id} -> Status: {status}, Event: {data.get('request', {}).get('eventName')}, Stage: {data.get('request', {}).get('currentStage')}")
    assert status == 200
    assert data['request']['id'] == req_id
    assert 'stages' in data['request']

    # 5. Verify Document File Serving
    if doc_url:
        req = urllib.request.Request(f"{BASE_URL}{doc_url}")
        with urllib.request.urlopen(req) as resp:
            print(f"[*] GET {doc_url} -> Status: {resp.status}, Content-Length: {len(resp.read())} bytes")
            assert resp.status == 200

    # 6. Test Date Validation (toDate < fromDate)
    status, data = post_json('/api/od-requests', {
        'eventName': 'Date Error Event',
        'eventType': 'Workshop',
        'eventOrganizer': 'Test Org',
        'venue': 'Campus',
        'fromDate': '2026-10-25',
        'toDate': '2026-10-20',
        'reason': 'Testing date validation'
    }, headers={'Authorization': f'Bearer {token}'})
    print(f"[*] Date Validation Test -> Status: {status}, Error: {data.get('error')}")
    assert status == 400

    # 7. Test Missing Fields Validation
    status, data = post_json('/api/od-requests', {
        'eventName': '',
        'eventType': '',
        'reason': ''
    }, headers={'Authorization': f'Bearer {token}'})
    print(f"[*] Missing Fields Test -> Status: {status}, Error: {data.get('error')}")
    assert status == 400

    print("\n[SUCCESS] ALL LIVE OD REQUEST INTEGRATION TESTS PASSED 100%!")

if __name__ == '__main__':
    run_live_tests()
