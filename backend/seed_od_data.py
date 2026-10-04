import os
import sys

# Add root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database.mongodb import (
    users_collection,
    od_requests_collection,
    approvals_collection,
    certificates_collection,
    od_history_collection,
    init_db
)
from werkzeug.security import generate_password_hash

def seed_sample_data():
    print("[*] Initializing database and collections...")
    init_db()

    users_col = users_collection()
    od_col = od_requests_collection()
    appr_col = approvals_collection()
    cert_col = certificates_collection()
    hist_col = od_history_collection()

    default_pwd = generate_password_hash('password123')

    # Seed Users
    sample_users = [
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
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        },
        {
            'id': 'STUD002',
            'identifier': '23CSD002',
            'name': 'Priya S',
            'email': 'priya.23csd@rajalakshmi.edu.in',
            'role': 'Student',
            'sub_role': 'Student',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'A',
            'designation': 'Student',
            'phone': '+91 98765 43211',
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&h=250&q=80',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        },
        {
            'id': 'STUD003',
            'identifier': '23CSD003',
            'name': 'Karthik R',
            'email': 'karthik.23csd@rajalakshmi.edu.in',
            'role': 'Student',
            'sub_role': 'Student',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'B',
            'designation': 'Student',
            'phone': '+91 98765 43212',
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&h=250&q=80',
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
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
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
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80',
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
            'password_hash': default_pwd,
            'avatar': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80',
            'created_at': '2026-01-01 09:00:00',
            'updated_at': '2026-01-01 09:00:00'
        }
    ]

    for u in sample_users:
        users_col.update_one({'id': u['id']}, {'$set': u}, upsert=True)
    print(f"[+] Upserted {len(sample_users)} stakeholder user accounts.")

    # Sample OD requests across Hackathons, Symposiums, Workshops, Sports
    sample_ods = [
        {
            'id': 'REQ_20260901_001',
            'student_id': 'STUD001',
            'department': 'Computer Science and Design',
            'event_name': 'Smart India Hackathon 2026 Grand Finale',
            'event_type': 'Hackathon',
            'event_organizer': 'AICTE & Ministry of Education',
            'venue': 'IIT Madras Research Park, Chennai',
            'from_date': '2026-09-10',
            'to_date': '2026-09-12',
            'from_time': '09:00',
            'to_time': '18:00',
            'number_of_days': 3.0,
            'reason': 'Finalist Team - National Level Hackathon',
            'description': '36-Hour continuous software development hackathon competition.',
            'od_letter_url': '/api/od-requests/uploads/od_letters/sih2026_invitation.pdf',
            'status': 'Approved',
            'current_stage': 'Approved',
            'certificate_status': 'Verified',
            'remarks': 'Approved by HOD with full attendance sanction and travel grant.',
            'created_at': '2026-09-01 10:00:00',
            'updated_at': '2026-09-05 14:00:00'
        },
        {
            'id': 'REQ_20260902_002',
            'student_id': 'STUD002',
            'department': 'Computer Science and Design',
            'event_name': 'National Design Symposium & UI/UX Conclave',
            'event_type': 'Symposium',
            'event_organizer': 'NIT Trichy',
            'venue': 'NIT Trichy Campus',
            'from_date': '2026-09-18',
            'to_date': '2026-09-19',
            'from_time': '09:30',
            'to_time': '17:00',
            'number_of_days': 2.0,
            'reason': 'Oral Paper Presentation on Generative UI in Healthcare',
            'description': 'Research paper accepted for presentation at National Symposium.',
            'od_letter_url': '/api/od-requests/uploads/od_letters/symposium_letter.pdf',
            'status': 'Class Incharge Approved',
            'current_stage': 'HOD',
            'certificate_status': 'Not Uploaded',
            'remarks': 'Endorsed and forwarded to HOD for final sanction.',
            'created_at': '2026-09-02 11:30:00',
            'updated_at': '2026-09-04 16:00:00'
        },
        {
            'id': 'REQ_20260903_003',
            'student_id': 'STUD001',
            'department': 'Computer Science and Design',
            'event_name': 'Anna University Inter-Zonal Badminton Championship',
            'event_type': 'Sports',
            'event_organizer': 'Anna University Sports Board',
            'venue': 'Anna University Indoor Stadium, Chennai',
            'from_date': '2026-09-25',
            'to_date': '2026-09-26',
            'from_time': '08:00',
            'to_time': '17:00',
            'number_of_days': 2.0,
            'reason': 'Representing College Badminton Team in Inter-Zonals',
            'description': 'Tournament fixtures scheduled across 2 days.',
            'od_letter_url': '/api/od-requests/uploads/od_letters/sports_fixture.pdf',
            'status': 'Approved',
            'current_stage': 'Approved',
            'certificate_status': 'Pending Verification',
            'remarks': 'Sanctioned by HOD for institutional sports representation.',
            'created_at': '2026-09-03 09:15:00',
            'updated_at': '2026-09-06 11:00:00'
        },
        {
            'id': 'REQ_20260904_004',
            'student_id': 'STUD002',
            'department': 'Computer Science and Design',
            'event_name': 'Web3 & Blockchain Developer Summit',
            'event_type': 'Workshop',
            'event_organizer': 'Ethereum India Foundation',
            'venue': 'Online / Virtual Platform',
            'from_date': '2026-10-05',
            'to_date': '2026-10-06',
            'from_time': '10:00',
            'to_time': '16:00',
            'number_of_days': 2.0,
            'reason': 'Hands-on Web3 Smart Contract Workshop',
            'description': 'Technical workshop on decentralized application architecture.',
            'od_letter_url': None,
            'status': 'HOD Rejected',
            'current_stage': 'HOD',
            'certificate_status': 'Not Uploaded',
            'remarks': 'Declined by HOD: Clashes with Internal Assessment Test schedule.',
            'created_at': '2026-09-04 14:00:00',
            'updated_at': '2026-09-07 10:30:00'
        },
        {
            'id': 'REQ_20260905_005',
            'student_id': 'STUD003',
            'department': 'Computer Science and Design',
            'event_name': 'Google Cloud Community Day Chennai 2026',
            'event_type': 'Conference',
            'event_organizer': 'Google Developer Groups (GDG)',
            'venue': 'Chennai Trade Centre, Nandambakkam',
            'from_date': '2026-10-12',
            'to_date': '2026-10-12',
            'from_time': '09:00',
            'to_time': '17:00',
            'number_of_days': 1.0,
            'reason': 'Attending Kubernetes and GenAI Architectures Track',
            'description': 'Student delegate pass for technical sessions.',
            'od_letter_url': '/api/od-requests/uploads/od_letters/gdg_pass.pdf',
            'status': 'Approved',
            'current_stage': 'Approved',
            'certificate_status': 'Not Uploaded',
            'remarks': 'Approved by HOD',
            'created_at': '2026-09-05 08:30:00',
            'updated_at': '2026-09-08 12:00:00'
        }
    ]

    for od in sample_ods:
        od_col.update_one({'id': od['id']}, {'$set': od}, upsert=True)
    print(f"[+] Upserted {len(sample_ods)} sample OD requests.")

    # Sample Certificate Record
    cert_data = {
        'id': 'CERT_20260901_001',
        'request_id': 'REQ_20260901_001',
        'student_id': 'STUD001',
        'student_reg_no': '23CSD001',
        'event_name': 'Smart India Hackathon 2026 Grand Finale',
        'certificate_file_url': '/api/od-requests/uploads/certificates/sih_winner_cert.pdf',
        'upload_date': '2026-09-13 10:00:00',
        'status': 'Verified',
        'verified_by_id': 'FAC001',
        'verified_by_name': 'Dr. A. Rajesh',
        'verified_at': '2026-09-14 11:00:00',
        'remarks': '1st Prize Winner Certificate verified with national portal.',
        'created_at': '2026-09-13 10:00:00'
    }
    cert_col.update_one({'id': cert_data['id']}, {'$set': cert_data}, upsert=True)
    print("[+] Upserted sample certificate verification record.")
    print("[+] Database seeding complete!")

if __name__ == '__main__':
    seed_sample_data()
