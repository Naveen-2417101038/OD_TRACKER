import os
import sys
import json
import mongomock
from werkzeug.security import generate_password_hash

# Ensure root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database.mongodb import MongoDB, init_db
from backend.models.user import UserModel
from backend.models.od_request import ODRequestModel
from backend.models.approval import ApprovalModel
from backend.models.certificate import CertificateModel
from backend.models.notification import NotificationModel
from backend.models.od_history import ODHistoryModel
from backend.app import create_app

def setup_mock_mongo():
    """Setup in-memory mongomock for complete workflow validation."""
    mock_client = mongomock.MongoClient()
    MongoDB._client = mock_client
    MongoDB._db = mock_client['od_tracking']
    MongoDB._is_connected = True
    MongoDB._connection_status = "connected"
    MongoDB._connection_error = None

    # Seed initial 4 stakeholder accounts
    db = MongoDB._db
    default_pwd_hash = generate_password_hash('password123')
    seed_users = [
        {
            'id': 'STUD001',
            'identifier': '23CSD001',
            'name': 'Naveen',
            'email': 'naveen.23csd@rajalakshmi.edu.in',
            'role': 'Student',
            'sub_role': 'Student',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'A',
            'designation': 'Student',
            'phone': '+91 98765 43210',
            'password_hash': default_pwd_hash,
            'avatar': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        },
        {
            'id': 'FAC001',
            'identifier': 'EMP-CSD-101',
            'name': 'Dr. A. Rajesh',
            'email': 'a.rajesh@rajalakshmi.edu.in',
            'role': 'Mentor',
            'sub_role': 'Mentor',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'III Year - Section A',
            'designation': 'Associate Professor',
            'phone': '+91 98401 23456',
            'password_hash': default_pwd_hash,
            'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        },
        {
            'id': 'FAC002',
            'identifier': 'EMP-CSD-102',
            'name': 'Mrs. K. Shanthi',
            'email': 'k.shanthi@rajalakshmi.edu.in',
            'role': 'Class Incharge',
            'sub_role': 'Class Incharge',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'III Year - Section A',
            'designation': 'Assistant Professor',
            'phone': '+91 98402 34567',
            'password_hash': default_pwd_hash,
            'avatar': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        },
        {
            'id': 'FAC004',
            'identifier': 'EMP-CSD-104',
            'name': 'Dr. V. Karpagam',
            'email': 'v.karpagam@rajalakshmi.edu.in',
            'role': 'HOD',
            'sub_role': 'HOD',
            'department': 'Computer Science and Design',
            'year': 'All Years',
            'section': 'All Sections (CSD)',
            'designation': 'Professor & HOD',
            'phone': '+91 98404 56789',
            'password_hash': default_pwd_hash,
            'avatar': 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        }
    ]
    for u in seed_users:
        db['users'].insert_one(u)

def test_full_od_workflow():
    print("=== STARTING COMPLETE OD TRACKING FULL WORKFLOW TEST ===")
    setup_mock_mongo()
    app = create_app()

    with app.test_client() as client:
        # 1. Health check
        res = client.get('/api/health')
        assert res.status_code == 200
        health_data = res.get_json()
        print(f"[1] /api/health -> Status: {health_data.get('status')}, Database Type: {health_data.get('database', {}).get('type')}")
        assert health_data.get('status') == 'healthy'
        assert health_data.get('database', {}).get('type') == 'MongoDB Atlas'

        # 2. Authenticate all 4 roles via common login
        print("\n[2] Testing Common Login for all 4 Stakeholder Roles:")
        
        # Student login
        res = client.post('/api/auth/login', json={'identifier': '23CSD001', 'password': 'password123'})
        assert res.status_code == 200
        s_data = res.get_json()
        student_token = s_data['token']
        print(f"  - Student Login: OK (Role: {s_data['role']}, Redirect: {s_data['redirectUrl']})")
        assert s_data['role'] == 'Student' and s_data['redirectUrl'] == '/student/dashboard'

        # Mentor login
        res = client.post('/api/auth/login', json={'identifier': 'EMP-CSD-101', 'password': 'password123'})
        assert res.status_code == 200
        m_data = res.get_json()
        mentor_token = m_data['token']
        print(f"  - Mentor Login: OK (Role: {m_data['role']}, Redirect: {m_data['redirectUrl']})")
        assert m_data['role'] == 'Mentor' and m_data['redirectUrl'] == '/faculty/dashboard'

        # Class Incharge login
        res = client.post('/api/auth/login', json={'identifier': 'EMP-CSD-102', 'password': 'password123'})
        assert res.status_code == 200
        ci_data = res.get_json()
        ci_token = ci_data['token']
        print(f"  - Class Incharge Login: OK (Role: {ci_data['role']}, Redirect: {ci_data['redirectUrl']})")
        assert ci_data['role'] == 'Class Incharge' and ci_data['redirectUrl'] == '/class-incharge/dashboard'

        # HOD login
        res = client.post('/api/auth/login', json={'identifier': 'EMP-CSD-104', 'password': 'password123'})
        assert res.status_code == 200
        hod_data = res.get_json()
        hod_token = hod_data['token']
        print(f"  - HOD Login: OK (Role: {hod_data['role']}, Redirect: {hod_data['redirectUrl']})")
        assert hod_data['role'] == 'HOD' and hod_data['redirectUrl'] == '/hod/dashboard'

        # 3. Student submits OD Request
        print("\n[3] Student submitting OD application:")
        od_payload = {
            'eventName': 'Smart India Hackathon 2026',
            'eventType': 'Hackathon',
            'eventOrganizer': 'AICTE & MoE',
            'venue': 'IIT Madras Research Park, Chennai',
            'fromDate': '2026-10-15',
            'toDate': '2026-10-17',
            'fromTime': '08:30',
            'toTime': '18:00',
            'reason': 'Grand Finale National Hackathon Competition',
            'description': 'Selected for Grand Finale round after preliminary screening.'
        }
        res = client.post(
            '/api/od-requests',
            json=od_payload,
            headers={'Authorization': f'Bearer {student_token}'}
        )
        assert res.status_code == 201
        created_req = res.get_json()['request']
        req_id = created_req['id']
        print(f"  - Created Request ID: {req_id}, Status: {created_req['status']}, Stage: {created_req['currentStage']}")
        assert created_req['status'] == 'Pending'
        assert created_req['currentStage'] == 'Mentor'

        # 4. Mentor reviews and approves
        print("\n[4] Mentor reviewing and approving request:")
        res = client.get('/api/mentor/od-requests', headers={'Authorization': f'Bearer {mentor_token}'})
        assert res.status_code == 200
        mentor_pending = res.get_json()['pending']
        assert any(r['id'] == req_id for r in mentor_pending)
        print(f"  - Mentor Pending List contains request: True (Count: {len(mentor_pending)})")

        res = client.post(
            f'/api/mentor/od-requests/{req_id}/approve',
            json={'remarks': 'Verified participation credentials. Highly recommended.'},
            headers={'Authorization': f'Bearer {mentor_token}'}
        )
        assert res.status_code == 200
        m_approved = res.get_json()['request']
        print(f"  - Mentor Approval Result -> Status: {m_approved['status']}, Current Stage: {m_approved['currentStage']}")
        assert m_approved['status'] == 'Mentor Approved'
        assert m_approved['currentStage'] == 'Class Incharge'

        # 5. Class Incharge reviews and endorses
        print("\n[5] Class Incharge reviewing and endorsing request:")
        res = client.get('/api/class-incharge/od-requests', headers={'Authorization': f'Bearer {ci_token}'})
        assert res.status_code == 200
        ci_pending = res.get_json()['pending']
        assert any(r['id'] == req_id for r in ci_pending)
        print(f"  - Class Incharge Pending List contains request: True (Count: {len(ci_pending)})")

        res = client.post(
            f'/api/class-incharge/od-requests/{req_id}/approve',
            json={'remarks': 'Attendance criteria verified (>85%). Forwarded to HOD.'},
            headers={'Authorization': f'Bearer {ci_token}'}
        )
        assert res.status_code == 200
        ci_approved = res.get_json()['request']
        print(f"  - Class Incharge Result -> Status: {ci_approved['status']}, Current Stage: {ci_approved['currentStage']}")
        assert ci_approved['status'] == 'Class Incharge Approved'
        assert ci_approved['currentStage'] == 'HOD'

        # 6. HOD reviews and gives final approval
        print("\n[6] HOD granting final executive sanction:")
        res = client.get('/api/hod/od-requests', headers={'Authorization': f'Bearer {hod_token}'})
        assert res.status_code == 200
        hod_pending = res.get_json()['pending']
        assert any(r['id'] == req_id for r in hod_pending)
        print(f"  - HOD Pending List contains request: True (Count: {len(hod_pending)})")

        res = client.post(
            f'/api/hod/od-requests/{req_id}/approve',
            json={'remarks': 'Approved for National Hackathon. Department sponsorship sanctioned.'},
            headers={'Authorization': f'Bearer {hod_token}'}
        )
        assert res.status_code == 200
        hod_approved = res.get_json()['request']
        print(f"  - HOD Final Result -> Status: {hod_approved['status']}, Current Stage: {hod_approved['currentStage']}")
        assert hod_approved['status'] == 'HOD Approved - Certificate Pending'
        assert hod_approved['currentStage'] == 'Certificate Pending'
        assert hod_approved['certificateStatus'] == 'Pending Upload'

        # 7. Student uploads certificate after approval
        print("\n[7] Student uploading event certificate:")
        import io
        from datetime import datetime, timedelta
        fake_cert_file = (io.BytesIO(b"%PDF-1.4 Mock Certificate Content"), 'hackathon_certificate.pdf')

        # Requirement 6: uploading before event ends is rejected
        res = client.post(
            f'/api/od-requests/{req_id}/certificate',
            data={'certificate': fake_cert_file},
            content_type='multipart/form-data',
            headers={'Authorization': f'Bearer {student_token}'}
        )
        assert res.status_code == 400
        assert 'available after the event ends' in res.get_json()['error']
        print(f"  - Upload before event ends correctly blocked: {res.get_json()['error']}")

        # Simulate event conclusion within the 24-hour window
        from backend.database.mongodb import od_requests_collection
        past_end = datetime.now() - timedelta(hours=1)
        od_requests_collection().update_one(
            {'id': req_id},
            {'$set': {
                'event_end_datetime': past_end.strftime('%Y-%m-%d %H:%M:%S'),
                'certificate_deadline': (past_end + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
            }}
        )

        fake_cert_file_2 = (io.BytesIO(b"%PDF-1.4 Mock Certificate Content"), 'hackathon_certificate.pdf')
        res = client.post(
            f'/api/od-requests/{req_id}/certificate',
            data={'certificate': fake_cert_file_2},
            content_type='multipart/form-data',
            headers={'Authorization': f'Bearer {student_token}'}
        )
        assert res.status_code == 200
        cert_data = res.get_json()
        print(f"  - Certificate Upload: OK (Status: {cert_data['request']['certificateStatus']}, OD Status: {cert_data['request']['status']})")
        assert cert_data['request']['status'] == 'Certificate Submitted'
        assert cert_data['request']['certificateStatus'] == 'Pending Verification'

        # 8. Faculty verifies certificate
        print("\n[8] Faculty verifying event certificate:")
        res = client.post(
            f'/api/mentor/od-requests/{req_id}/verify-certificate',
            json={'status': 'Verified', 'remarks': '1st Prize Certificate verified successfully.'},
            headers={'Authorization': f'Bearer {mentor_token}'}
        )
        assert res.status_code == 200
        verified_req = res.get_json()['request']
        print(f"  - Verification Result: OK (Certificate Status: {verified_req['certificateStatus']}, OD Status: {verified_req['status']})")
        assert verified_req['status'] == 'Approved'
        assert verified_req['certificateStatus'] == 'Verified'

        # 9. Check Audit History
        print("\n[9] Validating MongoDB od_history audit trail:")
        res = client.get(f'/api/od-requests/{req_id}/history', headers={'Authorization': f'Bearer {student_token}'})
        assert res.status_code == 200
        hist_list = res.get_json()['history']
        print(f"  - Total Audit Events in od_history: {len(hist_list)}")
        for h in hist_list:
            print(f"    * [{h.get('created_at')}] {h.get('role')} ({h.get('performed_by_name')}): {h.get('action')} - {h.get('remarks')}")
        assert len(hist_list) >= 5

        # 10. Check HOD Department Stats
        print("\n[10] Validating HOD Analytics Stats endpoint:")
        res = client.get('/api/hod/stats', headers={'Authorization': f'Bearer {hod_token}'})
        assert res.status_code == 200
        stats = res.get_json()['stats']
        print(f"  - HOD Stats: {stats}")
        assert stats['totalRequests'] >= 1
        assert stats['approved'] >= 1

    print("\n========================================================")
    print("ALL 10 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("========================================================")

if __name__ == '__main__':
    test_full_od_workflow()
