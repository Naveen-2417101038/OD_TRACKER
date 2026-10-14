"""
Safe, idempotent synchronization utility for OD Tracking System database.
Populates missing student mappings and links uploaded certificate records to Azure SQL / SQL Server.
Never drops, truncates, or resets existing tables or accounts.
"""
import os
import sys
from datetime import datetime

try:
    from backend.database.sql_server import session_scope
    from backend.models.db_models import User, Student, ODRequest, Certificate, StudentAcademicRecord, to_iso
except ImportError:
    from database.sql_server import session_scope
    from models.db_models import User, Student, ODRequest, Certificate, StudentAcademicRecord, to_iso

def sync_students_and_certificates():
    print("[*] Starting safe, idempotent database data synchronization...")
    
    with session_scope() as session:
        # 1. Synchronize Students table
        student_users = session.query(User).filter(
            User.role.ilike('Student')
        ).all()
        
        print(f"[*] Found {len(student_users)} student user accounts in users table.")
        
        added_students = 0
        for u in student_users:
            existing = session.query(Student).filter(
                (Student.user_id == u.id) | (Student.register_number == u.identifier)
            ).first()
            
            if not existing:
                # Find academic record if any
                acad = session.query(StudentAcademicRecord).filter(
                    StudentAcademicRecord.student_id == u.id
                ).first()
                
                att = u.attendance_percentage or (acad.attendance_percentage if acad else 85.0)
                cg = u.cgpa or (acad.cgpa if acad else 8.5)
                
                stu = Student(
                    user_id=u.id,
                    register_number=u.identifier,
                    mentor_id='FAC001',           # Dr. A. Rajesh
                    class_incharge_id='FAC002',   # Mrs. K. Shanthi
                    semester=6,
                    overall_attendance=att,
                    cgpa=cg,
                    od_used_days=0.0,
                    total_working_days=120,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                session.add(stu)
                added_students += 1
                print(f"    [+] Created student mapping for {u.name} ({u.identifier}) -> Mentor FAC001, CI FAC002")
            else:
                print(f"    [=] Student mapping already exists for {u.name} ({u.identifier})")
                
        # 2. Synchronize Certificate records for approved requests with uploaded files
        cert_mappings = [
            {
                'req_id': 'REQ_20261010_29698E',
                'cert_file': 'cert_20260925211826_10f32430.pdf',
                'status': 'Pending Verification',
                'req_status': 'Certificate Submitted',
                'verified_by_id': None,
                'verified_by_name': None,
                'remarks': 'Participation certificate submitted for faculty verification.'
            },
            {
                'req_id': 'REQ_20261003_4BAE70',
                'cert_file': 'cert_20260926095614_063c6458.pdf',
                'status': 'Verified',
                'req_status': 'Approved',
                'verified_by_id': 'FAC001',
                'verified_by_name': 'Dr. A. Rajesh',
                'remarks': 'Verified with official event portal. Approved.'
            },
            {
                'req_id': 'REQ_20261013_00599F',
                'cert_file': 'cert_20260926102330_9b1e39a9.pdf',
                'status': 'Pending Verification',
                'req_status': 'Certificate Submitted',
                'verified_by_id': None,
                'verified_by_name': None,
                'remarks': 'Hackathon finalist completion certificate submitted.'
            }
        ]
        
        added_certs = 0
        for cm in cert_mappings:
            req = session.query(ODRequest).filter(ODRequest.id == cm['req_id']).first()
            if not req:
                continue
                
            file_url = f"/api/od-requests/uploads/certificates/{cm['cert_file']}"
            req.certificate_url = file_url
            req.certificate_status = cm['status']
            req.status = cm['req_status']
            req.certificate_submitted_at = datetime.now()
            
            existing_cert = session.query(Certificate).filter(Certificate.request_id == req.id).first()
            if not existing_cert:
                cert = Certificate(
                    id=f"CERT_{req.id}",
                    request_id=req.id,
                    student_id=req.student_id,
                    student_reg_no=req.student_reg_no,
                    event_name=req.event_name,
                    certificate_file_url=file_url,
                    upload_date=datetime.now(),
                    status=cm['status'],
                    verified_by_id=cm['verified_by_id'],
                    verified_by_name=cm['verified_by_name'],
                    verified_at=datetime.now() if cm['verified_by_id'] else None,
                    remarks=cm['remarks'],
                    created_at=datetime.now()
                )
                session.add(cert)
                added_certs += 1
                print(f"    [+] Linked certificate for request {req.id} ({req.event_name}) -> status: {cm['status']}")
            else:
                existing_cert.certificate_file_url = file_url
                existing_cert.status = cm['status']
                print(f"    [=] Certificate already exists for request {req.id}")
                
        print(f"[+] Sync completed: {added_students} students mapped, {added_certs} certificates linked.")

if __name__ == '__main__':
    sync_students_and_certificates()
