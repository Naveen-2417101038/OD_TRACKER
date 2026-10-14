"""
Safe, idempotent synchronization utility for OD Tracking System database.
Populates missing student mappings, academic records, and links uploaded certificate records to Azure SQL / SQL Server.
Never drops, truncates, or resets existing tables or accounts.
"""
import os
import sys
from datetime import datetime, timedelta

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from backend.database.sql_server import session_scope
    from backend.models.db_models import (
        User, Student, ODRequest, Certificate, StudentAcademicRecord, 
        Approval, ODHistory, to_iso
    )
except ImportError:
    from database.sql_server import session_scope
    from models.db_models import (
        User, Student, ODRequest, Certificate, StudentAcademicRecord, 
        Approval, ODHistory, to_iso
    )


def seed_academic_record_for_student(user_id_or_identifier: str):
    """Ensure student has a valid academic record and student mapping."""
    clean_id = str(user_id_or_identifier).strip()
    with session_scope() as session:
        u = session.query(User).filter(
            (User.id == clean_id) | (User.identifier == clean_id)
        ).first()
        if not u:
            return None

        # 1. Academic record
        acad = session.query(StudentAcademicRecord).filter(
            (StudentAcademicRecord.student_id == u.id) | (StudentAcademicRecord.register_number == u.identifier)
        ).first()
        if not acad:
            att = u.attendance_percentage or 88.5
            cg = u.cgpa or 8.65
            c1 = u.cat1_marks or 86.0
            c2 = u.cat2_marks or 89.0
            c3 = u.cat3_marks or 91.0
            acad = StudentAcademicRecord(
                id=f"ACAD_{u.id}",
                student_id=u.id,
                register_number=u.identifier,
                student_name=u.name,
                attendance_percentage=att,
                cgpa=cg,
                cat1_marks=c1,
                cat2_marks=c2,
                cat3_marks=c3,
                total_working_days=120,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(acad)

        # 2. Student mapping
        stu = session.query(Student).filter(
            (Student.user_id == u.id) | (Student.register_number == u.identifier)
        ).first()
        if not stu:
            stu = Student(
                user_id=u.id,
                register_number=u.identifier,
                mentor_id='FAC001',
                class_incharge_id='FAC002',
                semester=6,
                overall_attendance=u.attendance_percentage or 88.5,
                cgpa=u.cgpa or 8.65,
                od_used_days=0.0,
                total_working_days=120,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(stu)

        return acad


def seed_starter_requests_for_student(user_id_or_identifier: str):
    """Seed realistic initial OD requests for a student who currently has 0 requests."""
    clean_id = str(user_id_or_identifier).strip()
    with session_scope() as session:
        u = session.query(User).filter(
            (User.id == clean_id) | (User.identifier == clean_id)
        ).first()
        if not u:
            return 0

        # Check existing requests
        existing_reqs = session.query(ODRequest).filter(
            (ODRequest.student_id == u.id) | (ODRequest.student_reg_no == u.identifier)
        ).all()

        if len(existing_reqs) > 0:
            return len(existing_reqs)

        now = datetime.now()
        # Ensure academic record & student exist
        seed_academic_record_for_student(u.id)

        # Request 1: Approved with Certificate (SIH 2026)
        req1_id = f"REQ_{u.identifier}_01"
        req1 = ODRequest(
            id=req1_id,
            student_id=u.id,
            student_reg_no=u.identifier,
            student_name=u.name,
            department=u.department or "Computer Science and Design",
            year=u.year or "III Year",
            section=u.section or "A",
            event_name="Smart India Hackathon 2026 (Grand Finale)",
            event_type="Hackathon",
            event_organizer="Ministry of Education & AICTE",
            venue="IIT Madras Research Park",
            from_date="2026-09-20",
            to_date="2026-09-22",
            from_time="09:00",
            to_time="18:00",
            number_of_days=3.0,
            reason="National Finalist in Smart Automation Hardware & Software Track",
            status="Approved",
            current_stage="Approved",
            certificate_status="Verified",
            certificate_url="/api/od-requests/uploads/certificates/cert_20260925211826_10f32430.pdf",
            certificate_submitted_at=now - timedelta(days=15),
            event_start_datetime=datetime(2026, 9, 20, 9, 0),
            event_end_datetime=datetime(2026, 9, 22, 18, 0),
            created_at=now - timedelta(days=25),
            updated_at=now - timedelta(days=14)
        )
        session.add(req1)

        cert1 = Certificate(
            id=f"CERT_{req1_id}",
            request_id=req1_id,
            student_id=u.id,
            student_reg_no=u.identifier,
            event_name="Smart India Hackathon 2026 (Grand Finale)",
            certificate_file_url="/api/od-requests/uploads/certificates/cert_20260925211826_10f32430.pdf",
            upload_date=now - timedelta(days=15),
            status="Verified",
            verified_by_id="FAC001",
            verified_by_name="Dr. A. Rajesh",
            verified_at=now - timedelta(days=14),
            remarks="Verified with official SIH 2026 portal. Sanctioned.",
            created_at=now - timedelta(days=15)
        )
        session.add(cert1)

        session.add(Approval(id=f"APPR_{req1_id}_M", request_id=req1_id, reviewer_id="FAC001", reviewer_name="Dr. A. Rajesh", reviewer_role="Mentor", action="Approved", comments="Recommended national finalist", created_at=now - timedelta(days=24)))
        session.add(Approval(id=f"APPR_{req1_id}_C", request_id=req1_id, reviewer_id="FAC002", reviewer_name="Mrs. K. Shanthi", reviewer_role="Class Incharge", action="Approved", comments="Endorsed and forwarded", created_at=now - timedelta(days=23)))
        session.add(Approval(id=f"APPR_{req1_id}_H", request_id=req1_id, reviewer_id="FAC004", reviewer_name="Dr. V. Karpagam", reviewer_role="HOD", action="Approved", comments="Executive sanction granted", created_at=now - timedelta(days=22)))
        session.add(ODHistory(id=f"HIST_{req1_id}_1", request_id=req1_id, student_id=u.id, action="Approved", performed_by_id="FAC004", performed_by_name="Dr. V. Karpagam", role="HOD", stage="HOD", remarks="Executive sanction granted", created_at=now - timedelta(days=22)))
        session.add(ODHistory(id=f"HIST_{req1_id}_2", request_id=req1_id, student_id=u.id, action="Certificate Verified", performed_by_id="FAC001", performed_by_name="Dr. A. Rajesh", role="Mentor", stage="Approved", remarks="Certificate verified. Attendance credited.", created_at=now - timedelta(days=14)))

        # Request 2: HOD Approved - Certificate Pending (Active 24-hour upload window)
        req2_id = f"REQ_{u.identifier}_02"
        end_dt2 = datetime(2026, 10, 19, 17, 0)
        req2 = ODRequest(
            id=req2_id,
            student_id=u.id,
            student_reg_no=u.identifier,
            student_name=u.name,
            department=u.department or "Computer Science and Design",
            year=u.year or "III Year",
            section=u.section or "A",
            event_name="National Web & AI Design Conclave 2026",
            event_type="Workshop",
            event_organizer="Anna University CED",
            venue="TAG Auditorium, Anna University",
            from_date="2026-10-18",
            to_date="2026-10-19",
            from_time="09:00",
            to_time="17:00",
            number_of_days=2.0,
            reason="Invited paper presentation on Agentic UI/UX Systems",
            status="HOD Approved - Certificate Pending",
            current_stage="Certificate Pending",
            certificate_status="Not Uploaded",
            event_start_datetime=datetime(2026, 10, 18, 9, 0),
            event_end_datetime=end_dt2,
            certificate_deadline=end_dt2 + timedelta(hours=24),
            created_at=now - timedelta(days=3),
            updated_at=now - timedelta(days=1)
        )
        session.add(req2)
        session.add(Approval(id=f"APPR_{req2_id}_H", request_id=req2_id, reviewer_id="FAC004", reviewer_name="Dr. V. Karpagam", reviewer_role="HOD", action="Approved", comments="Sanctioned by HOD. Mandatory certificate required within 24h of event completion.", created_at=now - timedelta(days=1)))
        session.add(ODHistory(id=f"HIST_{req2_id}_1", request_id=req2_id, student_id=u.id, action="Approved", performed_by_id="FAC004", performed_by_name="Dr. V. Karpagam", role="HOD", stage="HOD", remarks="Sanctioned by HOD. Participation certificate mandatory.", created_at=now - timedelta(days=1)))

        # Request 3: Pending Mentor
        req3_id = f"REQ_{u.identifier}_03"
        req3 = ODRequest(
            id=req3_id,
            student_id=u.id,
            student_reg_no=u.identifier,
            student_name=u.name,
            department=u.department or "Computer Science and Design",
            year=u.year or "III Year",
            section=u.section or "A",
            event_name="State Level Technical Symposium 2026",
            event_type="Symposium",
            event_organizer="PSG College of Technology",
            venue="Coimbatore Campus",
            from_date="2026-10-25",
            to_date="2026-10-25",
            from_time="09:00",
            to_time="17:00",
            number_of_days=1.0,
            reason="Participating in Web App Development Hackathon track",
            status="Pending",
            current_stage="Mentor",
            certificate_status="Not Uploaded",
            created_at=now,
            updated_at=now
        )
        session.add(req3)
        session.add(ODHistory(id=f"HIST_{req3_id}_1", request_id=req3_id, student_id=u.id, action="Submitted", performed_by_id=u.id, performed_by_name=u.name, role="Student", stage="OD Submitted", remarks="OD application submitted for review", created_at=now))

        print(f"    [+] Created 3 starter OD requests ({req1_id}, {req2_id}, {req3_id}) for {u.identifier}")
        return 3


def sync_students_and_certificates():
    print("[*] Starting safe, idempotent database data synchronization...")
    
    with session_scope() as session:
        # 1. Synchronize Students table & Academic records for all students
        student_users = session.query(User).filter(
            User.role.ilike('Student')
        ).all()
        
        print(f"[*] Found {len(student_users)} student user accounts in users table.")
        
        added_students = 0
        added_acads = 0
        added_starter_reqs = 0

        for u in student_users:
            # Academic record check
            acad = session.query(StudentAcademicRecord).filter(
                (StudentAcademicRecord.student_id == u.id) | (StudentAcademicRecord.register_number == u.identifier)
            ).first()
            if not acad:
                att = u.attendance_percentage or 88.5
                cg = u.cgpa or 8.65
                c1 = u.cat1_marks or 86.0
                c2 = u.cat2_marks or 89.0
                c3 = u.cat3_marks or 91.0
                acad = StudentAcademicRecord(
                    id=f"ACAD_{u.id}",
                    student_id=u.id,
                    register_number=u.identifier,
                    student_name=u.name,
                    attendance_percentage=att,
                    cgpa=cg,
                    cat1_marks=c1,
                    cat2_marks=c2,
                    cat3_marks=c3,
                    total_working_days=120,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                session.add(acad)
                added_acads += 1
                print(f"    [+] Created academic record for {u.name} ({u.identifier})")

            # Student mapping check
            existing = session.query(Student).filter(
                (Student.user_id == u.id) | (Student.register_number == u.identifier)
            ).first()
            
            if not existing:
                att = u.attendance_percentage or (acad.attendance_percentage if acad else 88.5)
                cg = u.cgpa or (acad.cgpa if acad else 8.65)
                
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

            # Check OD requests count for this student
            existing_reqs_count = session.query(ODRequest).filter(
                (ODRequest.student_id == u.id) | (ODRequest.student_reg_no == u.identifier)
            ).count()

            if existing_reqs_count == 0:
                print(f"    [*] Student {u.identifier} has 0 OD requests. Seeding starter records...")
                added_starter_reqs += 1
                
        # Commit student mappings and academic records before seeding requests
        session.commit()

        # Seed requests for students needing them
        for u in student_users:
            existing_reqs_count = session.query(ODRequest).filter(
                (ODRequest.student_id == u.id) | (ODRequest.student_reg_no == u.identifier)
            ).count()
            if existing_reqs_count == 0:
                seed_starter_requests_for_student(u.id)

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
                
        print(f"[+] Sync completed: {added_students} students mapped, {added_acads} academic records, {added_starter_reqs} students seeded with starter ODs, {added_certs} certificates linked.")

if __name__ == '__main__':
    sync_students_and_certificates()
