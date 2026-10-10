import os
import sys
import uuid
import re
from datetime import datetime, timedelta

# Ensure project root is in sys.path so 'backend.*' imports succeed in all environments
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from bson import ObjectId
try:
    from backend.database.mongodb import (
        od_requests_collection,
        approvals_collection,
        od_history_collection,
        certificates_collection,
        notifications_collection
    )
except ImportError:
    from database.mongodb import (
        od_requests_collection,
        approvals_collection,
        od_history_collection,
        certificates_collection,
        notifications_collection
    )

try:
    from backend.services.email_service import (
        get_student_info,
        get_mentors_for_department,
        get_class_incharges_for_department,
        get_hods_for_department,
        send_od_submitted_student_notification,
        send_new_od_mentor_notification,
        send_od_mentor_approved_student_notification,
        send_od_forwarded_class_incharge_notification,
        send_od_mentor_rejected_student_notification,
        send_od_ci_approved_student_notification,
        send_od_forwarded_hod_notification,
        send_od_ci_rejected_student_notification,
        send_od_hod_approved_student_notification,
        send_od_hod_rejected_student_notification,
        send_certificate_reminder_student_notification,
        send_certificate_uploaded_student_notification,
        send_certificate_submitted_faculty_notification,
        send_certificate_verified_student_notification,
        send_certificate_rejected_student_notification,
        send_od_expired_student_notification
    )
except ImportError:
    from services.email_service import (
        get_student_info,
        get_mentors_for_department,
        get_class_incharges_for_department,
        get_hods_for_department,
        send_od_submitted_student_notification,
        send_new_od_mentor_notification,
        send_od_mentor_approved_student_notification,
        send_od_forwarded_class_incharge_notification,
        send_od_mentor_rejected_student_notification,
        send_od_ci_approved_student_notification,
        send_od_forwarded_hod_notification,
        send_od_ci_rejected_student_notification,
        send_od_hod_approved_student_notification,
        send_od_hod_rejected_student_notification,
        send_certificate_reminder_student_notification,
        send_certificate_uploaded_student_notification,
        send_certificate_submitted_faculty_notification,
        send_certificate_verified_student_notification,
        send_certificate_rejected_student_notification,
        send_od_expired_student_notification
    )

class ODRequestModel:
    @staticmethod
    def calculate_days(from_date, to_date):
        try:
            d1 = datetime.strptime(from_date, "%Y-%m-%d")
            d2 = datetime.strptime(to_date, "%Y-%m-%d")
            diff = (d2 - d1).days + 1
            return max(1.0, float(diff))
        except Exception:
            return 1.0

    @staticmethod
    def parse_datetime(dt_val):
        """Robust parser for datetimes across string formats and datetime objects."""
        if not dt_val:
            return None
        if isinstance(dt_val, datetime):
            return dt_val
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%d"
        ):
            try:
                return datetime.strptime(str(dt_val).strip(), fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def get_event_end_and_deadline(item):
        """
        Calculate and return (end_datetime, certificate_deadline_datetime).
        The certificate deadline is ALWAYS exactly 24 hours from event_end_datetime.
        """
        if not item:
            return None, None

        end_dt = ODRequestModel.parse_datetime(item.get('event_end_datetime'))
        if not end_dt:
            to_date = item.get('to_date') or item.get('toDate') or item.get('from_date') or item.get('fromDate')
            to_time = item.get('to_time') or item.get('toTime') or '17:00'
            t_to = to_time[:5] if len(str(to_time)) >= 5 else '17:00'
            if to_date:
                try:
                    end_dt = datetime.strptime(f"{to_date} {t_to}", "%Y-%m-%d %H:%M")
                except Exception:
                    try:
                        end_dt = datetime.strptime(to_date, "%Y-%m-%d")
                    except Exception:
                        end_dt = None

        deadline_dt = ODRequestModel.parse_datetime(item.get('certificate_deadline'))
        if not deadline_dt and end_dt:
            deadline_dt = end_dt + timedelta(hours=24)

        return end_dt, deadline_dt

    @staticmethod
    def expire_single_request(request_id):
        """Automatically mark a single OD request as rejected when 24h certificate window has lapsed."""
        col = od_requests_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()
        if col is None or not request_id:
            return None

        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        rejection_reason = "OD rejected because the required certificate was not uploaded within 24 hours after the event ended."

        clean_id = str(request_id).strip()
        query = {"id": clean_id}
        if ObjectId.is_valid(clean_id):
            query = {"$or": [{"id": clean_id}, {"_id": ObjectId(clean_id)}]}

        doc = col.find_one(query)
        if not doc:
            return None

        # Do not overwrite if already Completed/Approved with Verified certificate
        if doc.get('status') == 'Approved' and doc.get('certificate_status') == 'Verified':
            return doc

        col.update_one(
            {"_id": doc['_id']},
            {"$set": {
                "status": "Rejected",
                "current_stage": "Rejected",
                "certificate_status": "Deadline Expired",
                "rejection_reason": rejection_reason,
                "remarks": rejection_reason,
                "updated_at": now_str
            }}
        )

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': doc.get('id'),
                'student_id': doc.get('student_id'),
                'action': 'Certificate Deadline Expired',
                'performed_by_id': 'SYSTEM',
                'performed_by_name': 'Automated Expiration Service',
                'role': 'System',
                'stage': 'Certificate Window Expired',
                'remarks': rejection_reason,
                'created_at': now_str
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': doc.get('student_id'),
                'title': "OD Request Rejected — Certificate Deadline Expired",
                'message': f"Your OD request for '{doc.get('event_name')}' has been rejected because the mandatory participation certificate was not uploaded within 24 hours after the event ended.",
                'type': 'rejection',
                'link': "/student/dashboard",
                'is_read': 0,
                'created_at': now_str
            })

        # Primary and only notification channel: Send email notification
        try:
            s_email, s_name = get_student_info(doc)
            if s_email:
                send_od_expired_student_notification(s_email, s_name, doc.get('event_name') or 'Event', rejection_reason)
        except Exception as e:
            print(f"[-] Email dispatch error on expiration: {e}")

        return ODRequestModel.get_by_id(doc.get('id'))

    @staticmethod
    def check_and_expire_deadlines():
        """
        Scan all active OD requests awaiting certificate upload.
        If current server time > certificate_deadline, automatically reject with deadline expired reason.
        """
        col = od_requests_collection()
        if col is None:
            return 0

        now = datetime.now()
        # Requests that are approved/hold awaiting certificate
        query = {
            "status": {"$in": ["HOD Approved - Certificate Pending", "HOD Approved", "Approved"]},
            "certificate_status": {"$in": ["Not Uploaded", "Pending Upload", None]}
        }

        expired_count = 0
        try:
            cursor = col.find(query)
            docs = list(cursor)
        except Exception:
            docs = []

        for doc in docs:
            # If doc already has verified certificate, skip
            if doc.get('certificate_status') == 'Verified':
                continue

            end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(doc)
            if deadline_dt and now > deadline_dt:
                ODRequestModel.expire_single_request(doc.get('id') or str(doc['_id']))
                expired_count += 1

        return expired_count

    @staticmethod
    def to_dict(doc):
        if not doc:
            return None
        item = dict(doc)
        if '_id' in item:
            item['_id'] = str(item['_id'])
        
        # Ensure standard keys for frontend compatibility
        item['requestId'] = item.get('id') or str(item.get('_id'))
        item['studentId'] = item.get('student_id')
        item['studentRegisterNo'] = item.get('student_reg_no')
        item['studentName'] = item.get('student_name')
        item['studentDepartment'] = item.get('department')
        item['studentYear'] = item.get('year')
        item['studentSection'] = item.get('section')
        item['eventName'] = item.get('event_name')
        item['eventType'] = item.get('event_type')
        item['eventOrganizer'] = item.get('event_organizer')
        item['venue'] = item.get('venue')
        item['fromDate'] = item.get('from_date')
        item['toDate'] = item.get('to_date')
        item['eventDate'] = item.get('from_date')
        item['fromTime'] = item.get('from_time') or '09:00'
        item['toTime'] = item.get('to_time') or '17:00'
        item['numberOfDays'] = item.get('number_of_days') or 1.0
        item['reason'] = item.get('reason')
        item['description'] = item.get('description')
        item['documentUrl'] = item.get('od_letter_url')
        item['odLetterUrl'] = item.get('od_letter_url')
        item['status'] = item.get('status') or 'Pending'
        item['currentStage'] = item.get('current_stage') or 'Mentor'
        item['approvalStage'] = item.get('current_stage') or 'Mentor'
        item['certificateStatus'] = item.get('certificate_status') or 'Not Uploaded'
        item['certificateUrl'] = item.get('certificate_url')
        item['rejectionReason'] = item.get('rejection_reason')
        item['remarks'] = item.get('remarks')
        item['createdAt'] = item.get('created_at')
        item['updatedAt'] = item.get('updated_at')

        # Add event start/end datetime and certificate deadline tracking
        end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(item)
        from_d = item.get('fromDate') or item.get('from_date') or ''
        from_t = item.get('fromTime') or item.get('from_time') or '09:00'
        t_from = from_t[:5] if len(str(from_t)) >= 5 else '09:00'
        
        item['eventStartDatetime'] = item.get('event_start_datetime') or (f"{from_d} {t_from}:00" if from_d else None)
        item['eventEndDatetime'] = (end_dt.strftime('%Y-%m-%d %H:%M:%S') if end_dt else item.get('event_end_datetime'))
        item['certificateDeadline'] = (deadline_dt.strftime('%Y-%m-%d %H:%M:%S') if deadline_dt else item.get('certificate_deadline'))
        item['certificateSubmittedAt'] = item.get('certificate_submitted_at')
        item['hodApprovedAt'] = item.get('hod_approved_at')

        # Structure 4-tier stages for timeline rendering
        created_dt = item.get('created_at', '')
        c_date = str(created_dt).split(' ')[0] if ' ' in str(created_dt) else str(created_dt)[:10]
        c_time = str(created_dt).split(' ')[1][:5] if ' ' in str(created_dt) else '09:30'
        
        status = item['status']
        curr_stage = item['currentStage']
        remarks = item.get('remarks')
        rejection_reason = item.get('rejection_reason')

        # Mentor stage status determination
        mentor_status = 'Pending'
        mentor_feedback = 'Under Mentor evaluation' if status == 'Pending' and curr_stage == 'Mentor' else None
        if status in ['Mentor Approved', 'Class Incharge Approved', 'Class Incharge Rejected', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted', 'Approved', 'HOD Rejected'] or curr_stage in ['Class Incharge', 'HOD', 'Certificate Pending', 'Certificate Verification', 'Approved', 'Completed']:
            mentor_status = 'Approved'
            mentor_feedback = (remarks if status == 'Mentor Approved' else None) or 'Recommended and forwarded by Mentor'
        elif status == 'Mentor Rejected' or (status == 'Rejected' and curr_stage == 'Mentor'):
            mentor_status = 'Rejected'
            mentor_feedback = rejection_reason or remarks or 'Application declined by Mentor'

        # Class Incharge stage status determination
        ci_status = 'Unreached'
        ci_feedback = None
        if status in ['Class Incharge Approved', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted', 'Approved', 'HOD Rejected'] or curr_stage in ['HOD', 'Certificate Pending', 'Certificate Verification', 'Approved', 'Completed']:
            ci_status = 'Approved'
            ci_feedback = (remarks if status == 'Class Incharge Approved' else None) or 'Endorsed and forwarded to HOD by Class Incharge'
        elif status == 'Class Incharge Rejected' or (status == 'Rejected' and curr_stage == 'Class Incharge'):
            ci_status = 'Rejected'
            ci_feedback = rejection_reason or remarks or 'Application declined by Class Incharge'
        elif status == 'Mentor Approved' and curr_stage == 'Class Incharge':
            ci_status = 'Pending'
            ci_feedback = 'Awaiting Class Incharge endorsement'

        # HOD stage status determination
        hod_status = 'Unreached'
        hod_feedback = None
        if status in ['Approved', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted'] or curr_stage in ['Approved', 'Certificate Pending', 'Certificate Verification', 'Completed']:
            hod_status = 'Approved'
            hod_feedback = remarks or 'Executive approval granted by HOD. Participation certificate mandatory after event.'
        elif status in ['HOD Rejected'] or (status == 'Rejected' and curr_stage == 'HOD'):
            hod_status = 'Rejected'
            hod_feedback = rejection_reason or remarks or 'Application declined by HOD'
        elif status == 'Class Incharge Approved' and curr_stage == 'HOD':
            hod_status = 'Pending'
            hod_feedback = 'Awaiting executive sanction from HOD'
        elif status == 'Rejected' and 'within 24 hours' in (rejection_reason or '').lower():
            # If rejected because certificate deadline expired, HOD had approved
            hod_status = 'Approved'
            hod_feedback = 'Executive approval was granted by HOD (Certificate deadline later expired).'

        stages = {
            'submitted': {
                'status': 'Approved',
                'date': c_date,
                'time': c_time,
                'faculty_name': item['studentName'],
                'faculty_role': 'Student',
                'feedback': 'OD application submitted for review'
            },
            'mentor': {
                'status': mentor_status,
                'faculty_name': 'Dr. A. Rajesh',
                'faculty_role': 'Mentor',
                'faculty_designation': 'Associate Professor',
                'feedback': mentor_feedback or ('Recommended and forwarded by Mentor' if mentor_status == 'Approved' else mentor_feedback)
            },
            'classIncharge': {
                'status': ci_status,
                'faculty_name': 'Mrs. K. Shanthi',
                'faculty_role': 'Class Incharge',
                'faculty_designation': 'Assistant Professor',
                'feedback': ci_feedback
            },
            'hod': {
                'status': hod_status,
                'faculty_name': 'Dr. V. Karpagam',
                'faculty_role': 'HOD',
                'faculty_designation': 'Professor & HOD',
                'feedback': hod_feedback
            }
        }
        item['stages'] = stages
        return item

    @staticmethod
    def populate_student_info(item):
        """
        Dynamically populate and join student profile info (name, register number, department, year, section)
        from the users collection into the OD request dictionary.
        """
        if not item:
            return item
        
        from backend.models.user import UserModel

        student_id = item.get('student_id') or item.get('studentId')
        student_reg = item.get('student_reg_no') or item.get('studentRegisterNo')

        student_user = None
        if student_id:
            student_user = UserModel.get_by_id(student_id)
            if not student_user:
                student_user = UserModel.get_by_identifier(student_id)

        if not student_user and student_reg:
            student_user = UserModel.get_by_identifier(student_reg)

        if student_user:
            student_name = student_user.get('name') or item.get('studentName') or item.get('student_name') or 'Student Not Found'
            student_reg_no = student_user.get('identifier') or student_user.get('register_no') or item.get('studentRegisterNo') or item.get('student_reg_no') or 'N/A'
            department = student_user.get('department') or item.get('studentDepartment') or item.get('department') or 'N/A'
            year = student_user.get('year') or item.get('studentYear') or item.get('year') or 'N/A'
            section = student_user.get('section') or item.get('studentSection') or item.get('section') or 'N/A'

            item['studentName'] = student_name
            item['studentRegisterNo'] = student_reg_no
            item['studentDepartment'] = department
            item['studentYear'] = year
            item['studentSection'] = section
            item['department'] = department
            item['year'] = year
            item['section'] = section
            item['studentEmail'] = student_user.get('email')
            item['studentPhone'] = student_user.get('phone')
            item['studentFound'] = True
            
            # Update submitted stage author name if present
            if 'stages' in item and isinstance(item['stages'], dict) and 'submitted' in item['stages']:
                item['stages']['submitted']['faculty_name'] = student_name
        else:
            item['studentName'] = item.get('studentName') or item.get('student_name') or 'Student Not Found'
            item['studentRegisterNo'] = item.get('studentRegisterNo') or item.get('student_reg_no') or 'N/A'
            item['studentDepartment'] = item.get('studentDepartment') or item.get('department') or 'N/A'
            item['studentYear'] = item.get('studentYear') or item.get('year') or 'N/A'
            item['studentSection'] = item.get('studentSection') or item.get('section') or 'N/A'
            item['studentFound'] = False

        return item

    @staticmethod
    def create(data):
        """Insert a new OD Request into MongoDB database with 3-day advance validation."""
        col = od_requests_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            raise RuntimeError("MongoDB connection not established.")

        from_date = data.get('from_date') or data.get('fromDate') or data.get('eventDate')
        if not from_date:
            raise ValueError("Event Start Date is required.")

        # Requirement 1: OD Application Time Limit — Minimum 3 Days Before Event
        server_today = datetime.now().date()
        try:
            d_from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        except Exception:
            raise ValueError("Invalid Event Start Date format. Please use YYYY-MM-DD.")

        if d_from_dt < server_today:
            raise ValueError("Event start date cannot be in the past. OD requests must be submitted at least 3 days before the event date.")

        if (d_from_dt - server_today).days < 3:
            raise ValueError("OD requests must be submitted at least 3 days before the event date.")

        req_id = data.get('id') or f"REQ_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6].upper()}"
        to_date = data.get('to_date') or data.get('toDate') or from_date
        num_days = data.get('number_of_days') or ODRequestModel.calculate_days(from_date, to_date)
        from_time = data.get('from_time') or data.get('fromTime') or '09:00'
        to_time = data.get('to_time') or data.get('toTime') or '17:00'
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Standardize Event Start Datetime, Event End Datetime & Certificate Deadline
        t_from = from_time[:5] if len(str(from_time)) >= 5 else '09:00'
        t_to = to_time[:5] if len(str(to_time)) >= 5 else '17:00'

        try:
            start_dt = datetime.strptime(f"{from_date} {t_from}", "%Y-%m-%d %H:%M")
            event_start_datetime = start_dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            event_start_datetime = f"{from_date} 09:00:00"

        try:
            end_dt = datetime.strptime(f"{to_date} {t_to}", "%Y-%m-%d %H:%M")
            event_end_datetime = end_dt.strftime("%Y-%m-%d %H:%M:%S")
            # Requirement 5: Exactly 24 hours from event_end_datetime
            deadline_dt = end_dt + timedelta(hours=24)
            certificate_deadline = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            event_end_datetime = f"{to_date} 17:00:00"
            certificate_deadline = None

        doc = {
            'id': req_id,
            'student_id': data.get('student_id') or data.get('studentId'),
            'student_reg_no': data.get('student_reg_no') or data.get('studentRegisterNo'),
            'student_name': data.get('student_name') or data.get('studentName'),
            'department': data.get('department') or data.get('studentDepartment'),
            'year': data.get('year') or data.get('studentYear'),
            'section': data.get('section') or data.get('studentSection'),
            'event_name': data.get('event_name') or data.get('eventName'),
            'event_type': data.get('event_type') or data.get('eventType'),
            'event_organizer': data.get('event_organizer') or data.get('eventOrganizer'),
            'venue': data.get('venue'),
            'from_date': from_date,
            'to_date': to_date,
            'from_time': from_time,
            'to_time': to_time,
            'event_start_datetime': event_start_datetime,
            'event_end_datetime': event_end_datetime,
            'certificate_deadline': certificate_deadline,
            'certificate_submitted_at': None,
            'hod_approved_at': None,
            'number_of_days': num_days,
            'reason': data.get('reason'),
            'description': data.get('description'),
            'od_letter_url': data.get('od_letter_url') or data.get('documentUrl'),
            'status': 'Pending',
            'current_stage': 'Mentor',
            'certificate_status': 'Not Uploaded',
            'rejection_reason': None,
            'remarks': data.get('remarks'),
            'created_at': now,
            'updated_at': now
        }

        col.insert_one(doc)

        # Log submission event in od_history collection
        if hist_col is not None:
            hist_id = f"HIST_{uuid.uuid4().hex[:8].upper()}"
            hist_col.insert_one({
                'id': hist_id,
                'request_id': req_id,
                'student_id': doc['student_id'],
                'action': 'Submitted',
                'performed_by_id': doc['student_id'],
                'performed_by_name': doc['student_name'],
                'role': 'Student',
                'stage': 'OD Submitted',
                'remarks': 'OD request successfully initiated by student',
                'created_at': now
            })

        # Dispatch email notifications to student and faculty mentor
        try:
            s_email, s_name = get_student_info(doc)
            dates_str = f"{from_date} to {to_date}" if to_date and to_date != from_date else from_date
            if s_email:
                send_od_submitted_student_notification(s_email, s_name, doc.get('event_name'), dates_str, req_id)

            mentors = get_mentors_for_department(doc.get('department'))
            for m_email, m_name in mentors:
                send_new_od_mentor_notification(m_email, m_name, s_name, doc.get('event_name'), dates_str, req_id)
        except Exception as e:
            print(f"[-] Email notification dispatch error on create: {e}")

        return ODRequestModel.get_by_id(req_id)

    @staticmethod
    def get_by_id(request_id):
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return None
        clean_id = str(request_id).strip()
        query = {"id": clean_id}
        if ObjectId.is_valid(clean_id):
            query = {"$or": [{"id": clean_id}, {"_id": ObjectId(clean_id)}]}
        
        doc = col.find_one(query)
        req = ODRequestModel.to_dict(doc)
        return ODRequestModel.populate_student_info(req)

    @staticmethod
    def list_all():
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return []
        cursor = col.find().sort("created_at", -1)
        return [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

    @staticmethod
    def list_by_student(student_id):
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return []
        clean_id = str(student_id or '').strip()
        escaped_id = re.escape(clean_id)
        id_regex = {"$regex": f"^{escaped_id}$", "$options": "i"}

        query = {
            "$or": [
                {"student_id": id_regex},
                {"student_reg_no": id_regex}
            ]
        }
        cursor = col.find(query).sort("created_at", -1)
        return [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

    @staticmethod
    def list_for_mentor(mentor_user):
        """
        List all requests assigned to this mentor's department/ward.
        Sorted with pending requests first.
        """
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return []
        
        dept = (mentor_user.get('department') or '').strip()
        query = {}
        if dept:
            escaped_dept = re.escape(dept)
            query = {"department": {"$regex": f"^{escaped_dept}$", "$options": "i"}}

        cursor = col.find(query).sort("created_at", -1)
        all_reqs = [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

        # Partition pending to top
        pending = [r for r in all_reqs if r.get('status') == 'Pending']
        others = [r for r in all_reqs if r.get('status') != 'Pending']
        return pending + others

    @staticmethod
    def approve_by_mentor(request_id, mentor_user, remarks=''):
        """
        Execute Mentor approval:
        1. Validates request is currently in 'Pending' status with stage 'Mentor'.
        2. Sets status to 'Mentor Approved' and current_stage to 'Class Incharge'.
        3. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Pending' or current_stage != 'Mentor':
            return None, f"Cannot approve request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Pending requests can be reviewed."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        actual_remarks = remarks or 'Recommended by Mentor'

        # Update MongoDB od_requests
        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Mentor Approved",
                "current_stage": "Class Incharge",
                "remarks": actual_remarks,
                "updated_at": now
            }}
        )

        # Insert approval audit record
        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': mentor_user.get('id') or mentor_user.get('userId'),
                'reviewer_name': mentor_user.get('name'),
                'reviewer_role': 'Mentor',
                'action': 'Approved',
                'comments': actual_remarks,
                'created_at': now
            })

        # Insert history audit trail
        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Mentor Approved',
                'performed_by_id': mentor_user.get('id') or mentor_user.get('userId'),
                'performed_by_name': mentor_user.get('name'),
                'role': 'Mentor',
                'stage': 'Mentor Review',
                'remarks': actual_remarks,
                'created_at': now
            })

        # Send notification to student
        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Recommended by Mentor",
                'message': f"Your OD request for '{req['eventName']}' was approved by Mentor and forwarded to Class Incharge.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notifications
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_mentor_approved_student_notification(s_email, s_name, req['eventName'], actual_remarks)

            cincharges = get_class_incharges_for_department(req.get('department') or req.get('studentDepartment'), req.get('section') or req.get('studentSection'))
            for ci_email, ci_name in cincharges:
                send_od_forwarded_class_incharge_notification(ci_email, ci_name, s_name, req['eventName'], req['id'])
        except Exception as e:
            print(f"[-] Email notification dispatch error on mentor approve: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def reject_by_mentor(request_id, mentor_user, rejection_reason):
        """
        Execute Mentor rejection:
        1. Validates request is currently in 'Pending' status with stage 'Mentor'.
        2. Sets status to 'Mentor Rejected' and stores rejection reason.
        3. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Pending' or current_stage != 'Mentor':
            return None, f"Cannot reject request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Pending requests can be reviewed."

        if not rejection_reason or not rejection_reason.strip():
            return None, "Rejection reason / remark is mandatory for rejecting an OD request."

        clean_reason = rejection_reason.strip()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Mentor Rejected",
                "current_stage": "Mentor",
                "rejection_reason": clean_reason,
                "remarks": clean_reason,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': mentor_user.get('id') or mentor_user.get('userId'),
                'reviewer_name': mentor_user.get('name'),
                'reviewer_role': 'Mentor',
                'action': 'Rejected',
                'comments': clean_reason,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Mentor Rejected',
                'performed_by_id': mentor_user.get('id') or mentor_user.get('userId'),
                'performed_by_name': mentor_user.get('name'),
                'role': 'Mentor',
                'stage': 'Mentor Review',
                'remarks': clean_reason,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by Mentor",
                'message': f"Your OD request for '{req['eventName']}' was declined by Mentor: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notification
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_mentor_rejected_student_notification(s_email, s_name, req['eventName'], clean_reason)
        except Exception as e:
            print(f"[-] Email notification dispatch error on mentor reject: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def list_for_class_incharge(ci_user):
        """
        List all requests for the Class Incharge's assigned department.
        Requests with status 'Mentor Approved' are pending Class Incharge endorsement.
        """
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return []
        
        dept = (ci_user.get('department') or '').strip()
        query = {}
        if dept:
            escaped_dept = re.escape(dept)
            query = {"department": {"$regex": f"^{escaped_dept}$", "$options": "i"}}

        cursor = col.find(query).sort("created_at", -1)
        all_reqs = [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

        # Prioritize Mentor Approved requests
        pending = [r for r in all_reqs if r.get('status') == 'Mentor Approved']
        others = [r for r in all_reqs if r.get('status') != 'Mentor Approved']
        return pending + others

    @staticmethod
    def approve_by_class_incharge(request_id, ci_user, remarks=''):
        """
        Execute Class Incharge approval:
        1. Validates request is currently in 'Mentor Approved' status with stage 'Class Incharge'.
        2. Sets status to 'Class Incharge Approved' and current_stage to 'HOD'.
        3. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Mentor Approved' or current_stage != 'Class Incharge':
            return None, f"Cannot approve request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Mentor Approved requests can be reviewed by Class Incharge."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        actual_remarks = remarks or 'Endorsed by Class Incharge'

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Class Incharge Approved",
                "current_stage": "HOD",
                "remarks": actual_remarks,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': ci_user.get('id') or ci_user.get('userId'),
                'reviewer_name': ci_user.get('name'),
                'reviewer_role': 'Class Incharge',
                'action': 'Approved',
                'comments': actual_remarks,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Class Incharge Approved',
                'performed_by_id': ci_user.get('id') or ci_user.get('userId'),
                'performed_by_name': ci_user.get('name'),
                'role': 'Class Incharge',
                'stage': 'Class Incharge Review',
                'remarks': actual_remarks,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Endorsed by Class Incharge",
                'message': f"Your OD request for '{req['eventName']}' was endorsed and sent to HOD for final approval.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notifications
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_ci_approved_student_notification(s_email, s_name, req['eventName'], actual_remarks)

            hods = get_hods_for_department(req.get('department') or req.get('studentDepartment'))
            for h_email, h_name in hods:
                send_od_forwarded_hod_notification(h_email, h_name, s_name, req['eventName'], req['id'])
        except Exception as e:
            print(f"[-] Email notification dispatch error on CI approve: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def reject_by_class_incharge(request_id, ci_user, rejection_reason):
        """
        Execute Class Incharge rejection:
        1. Validates request is currently in 'Mentor Approved' status with stage 'Class Incharge'.
        2. Sets status to 'Class Incharge Rejected' and stores rejection reason.
        3. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Mentor Approved' or current_stage != 'Class Incharge':
            return None, f"Cannot reject request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Mentor Approved requests can be reviewed by Class Incharge."

        if not rejection_reason or not rejection_reason.strip():
            return None, "Rejection reason / remark is mandatory for rejecting an OD request."

        clean_reason = rejection_reason.strip()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Class Incharge Rejected",
                "current_stage": "Class Incharge",
                "rejection_reason": clean_reason,
                "remarks": clean_reason,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': ci_user.get('id') or ci_user.get('userId'),
                'reviewer_name': ci_user.get('name'),
                'reviewer_role': 'Class Incharge',
                'action': 'Rejected',
                'comments': clean_reason,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Class Incharge Rejected',
                'performed_by_id': ci_user.get('id') or ci_user.get('userId'),
                'performed_by_name': ci_user.get('name'),
                'role': 'Class Incharge',
                'stage': 'Class Incharge Review',
                'remarks': clean_reason,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by Class Incharge",
                'message': f"Your OD request for '{req['eventName']}' was declined by Class Incharge: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notification
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_ci_rejected_student_notification(s_email, s_name, req['eventName'], clean_reason)
        except Exception as e:
            print(f"[-] Email notification dispatch error on CI reject: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def list_for_hod(hod_user):
        """
        List all requests for the HOD's department.
        Requests with status 'Class Incharge Approved' are pending HOD sanction.
        """
        ODRequestModel.check_and_expire_deadlines()
        col = od_requests_collection()
        if col is None:
            return []
        
        dept = (hod_user.get('department') or '').strip()
        query = {}
        if dept and dept.lower() != 'all':
            escaped_dept = re.escape(dept)
            query = {"department": {"$regex": f"^{escaped_dept}$", "$options": "i"}}

        cursor = col.find(query).sort("created_at", -1)
        all_reqs = [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

        pending = [r for r in all_reqs if r.get('status') == 'Class Incharge Approved']
        others = [r for r in all_reqs if r.get('status') != 'Class Incharge Approved']
        return pending + others

    @staticmethod
    def approve_by_hod(request_id, hod_user, remarks=''):
        """
        Execute HOD approval:
        1. Validates request is currently in 'Class Incharge Approved' status with stage 'HOD'.
        2. Sets status to 'HOD Approved - Certificate Pending' and current_stage to 'Certificate Pending'.
        3. Holds request until student attends event and uploads certificate within 24 hours of event end.
        4. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Class Incharge Approved' or current_stage != 'HOD':
            return None, f"Cannot approve request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Class Incharge Approved requests can receive HOD executive sanction."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        actual_remarks = remarks or 'Executive approval granted by HOD. Mandatory participation certificate required within 24 hours of event ending.'

        # Requirement 4: Set to HOD Approved - Certificate Pending (hold state)
        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "HOD Approved - Certificate Pending",
                "current_stage": "Certificate Pending",
                "certificate_status": "Pending Upload",
                "hod_approved_at": now,
                "remarks": actual_remarks,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': hod_user.get('id') or hod_user.get('userId'),
                'reviewer_name': hod_user.get('name'),
                'reviewer_role': 'HOD',
                'action': 'Approved',
                'comments': actual_remarks,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'HOD Approved',
                'performed_by_id': hod_user.get('id') or hod_user.get('userId'),
                'performed_by_name': hod_user.get('name'),
                'role': 'HOD',
                'stage': 'HOD Executive Sanction',
                'remarks': actual_remarks,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Approved by HOD — Certificate Pending",
                'message': f"Congratulations! Your OD application for '{req['eventName']}' has received official sanction from the HOD. Please attend the event and upload your participation certificate within 24 hours after the event ends.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notification to student
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_hod_approved_student_notification(s_email, s_name, req['eventName'], actual_remarks)
        except Exception as e:
            print(f"[-] Email notification dispatch error on HOD approve: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def reject_by_hod(request_id, hod_user, rejection_reason):
        """
        Execute HOD rejection:
        1. Validates request is currently in 'Class Incharge Approved' status with stage 'HOD'.
        2. Sets status to 'HOD Rejected' and stores rejection reason.
        3. Records in approvals and od_history collections.
        """
        col = od_requests_collection()
        appr_col = approvals_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        current_status = req['status']
        current_stage = req['currentStage']

        if current_status != 'Class Incharge Approved' or current_stage != 'HOD':
            return None, f"Cannot reject request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Class Incharge Approved requests can be reviewed by HOD."

        if not rejection_reason or not rejection_reason.strip():
            return None, "Rejection reason / remark is mandatory for rejecting an OD request."

        clean_reason = rejection_reason.strip()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "HOD Rejected",
                "current_stage": "HOD",
                "rejection_reason": clean_reason,
                "remarks": clean_reason,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'reviewer_id': hod_user.get('id') or hod_user.get('userId'),
                'reviewer_name': hod_user.get('name'),
                'reviewer_role': 'HOD',
                'action': 'Rejected',
                'comments': clean_reason,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'HOD Rejected',
                'performed_by_id': hod_user.get('id') or hod_user.get('userId'),
                'performed_by_name': hod_user.get('name'),
                'role': 'HOD',
                'stage': 'HOD Final Approval',
                'remarks': clean_reason,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by HOD",
                'message': f"Your OD request for '{req['eventName']}' was declined by HOD: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notification to student
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_od_hod_rejected_student_notification(s_email, s_name, req['eventName'], clean_reason)
        except Exception as e:
            print(f"[-] Email notification dispatch error on HOD reject: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def upload_certificate(request_id, student_user, file_url):
        """
        Student uploads mandatory event certificate within 24 hours after event ends.
        Validates:
        1. Request is in HOD Approved hold state.
        2. Event has actually ended.
        3. Upload occurs within the 24-hour certificate deadline.
        4. Transitions status from HOD Approved - Certificate Pending to Certificate Submitted.
        """
        col = od_requests_collection()
        cert_col = certificates_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        # Sweep expired deadlines first
        ODRequestModel.check_and_expire_deadlines()

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        # Check if already completed or expired
        if req['status'] in ['Approved', 'Completed'] and req.get('certificateStatus') == 'Verified':
            return None, "Certificate has already been uploaded and verified for this OD request."

        if req['status'] == 'Rejected' or req.get('certificateStatus') == 'Deadline Expired':
            return None, "Certificate upload deadline has expired. The OD has been rejected."

        if req['status'] not in ['HOD Approved - Certificate Pending', 'HOD Approved']:
            return None, f"Certificates can only be uploaded for HOD Approved OD requests (Current status: '{req['status']}')."

        now = datetime.now()
        end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(req)

        # Requirement 6: Before event ends, certificate cannot be uploaded
        if end_dt and now < end_dt:
            return None, "Certificate upload will be available after the event ends."

        # Requirement 9: Late upload after 24-hour window must be blocked
        if deadline_dt and now > deadline_dt:
            ODRequestModel.expire_single_request(req['id'])
            return None, "Certificate upload deadline has expired. The OD has been rejected."

        now_str = now.strftime('%Y-%m-%d %H:%M:%S')

        # Requirement 8: Change status to Certificate Submitted
        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Certificate Submitted",
                "current_stage": "Certificate Verification",
                "certificate_status": "Pending Verification",
                "certificate_url": file_url,
                "certificate_submitted_at": now_str,
                "updated_at": now_str
            }}
        )

        if cert_col is not None:
            cert_id = f"CERT_{uuid.uuid4().hex[:8].upper()}"
            cert_col.insert_one({
                'id': cert_id,
                'request_id': req['id'],
                'student_id': student_user.get('id') or student_user.get('userId'),
                'student_reg_no': student_user.get('identifier'),
                'event_name': req['eventName'],
                'certificate_file_url': file_url,
                'upload_date': now_str,
                'status': 'Pending Verification',
                'verified_by_id': None,
                'verified_by_name': None,
                'verified_at': None,
                'remarks': None,
                'created_at': now_str
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Certificate Submitted',
                'performed_by_id': student_user.get('id') or student_user.get('userId'),
                'performed_by_name': student_user.get('name'),
                'role': 'Student',
                'stage': 'Certificate Verification',
                'remarks': 'Mandatory event completion certificate uploaded on time within 24-hour window',
                'created_at': now_str
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': "Certificate Submitted Successfully",
                'message': f"Your participation certificate for '{req['eventName']}' was submitted within the deadline and is pending faculty verification.",
                'type': 'certificate',
                'link': "/student/dashboard",
                'is_read': 0,
                'created_at': now_str
            })

        # Primary and only notification channel: Send email notifications
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                send_certificate_uploaded_student_notification(s_email, s_name, req['eventName'])

            mentors = get_mentors_for_department(req.get('department') or req.get('studentDepartment'))
            for m_email, m_name in mentors:
                send_certificate_submitted_faculty_notification(m_email, m_name, s_name, req['eventName'], req['id'])
        except Exception as e:
            print(f"[-] Email notification dispatch error on certificate upload: {e}")

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def verify_certificate(request_id, faculty_user, status='Verified', remarks=''):
        """
        Verify certificate by Mentor/Faculty:
        1. If verified: sets status to 'Approved' (OD Completed), certificate_status to 'Verified'.
        2. If rejected: sets status to 'Rejected', certificate_status to 'Rejected'.
        3. Logs in od_history and sends notification to student.
        """
        col = od_requests_collection()
        cert_col = certificates_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            return None, "Database not connected."

        req = ODRequestModel.get_by_id(request_id)
        if not req:
            return None, "OD Request not found."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        is_approved = status.lower() in ['verified', 'approved']
        new_cert_status = 'Verified' if is_approved else 'Rejected'
        new_od_status = 'Approved' if is_approved else 'Rejected'
        new_stage = 'Completed' if is_approved else 'Rejected'
        feedback = remarks or (f"Certificate {new_cert_status.lower()} by {faculty_user.get('name')} ({faculty_user.get('role')})")

        update_fields = {
            "status": new_od_status,
            "current_stage": new_stage,
            "certificate_status": new_cert_status,
            "updated_at": now
        }
        if not is_approved:
            update_fields["rejection_reason"] = feedback
            update_fields["remarks"] = feedback

        col.update_one(
            {"id": req['id']},
            {"$set": update_fields}
        )

        if cert_col is not None:
            cert_col.update_many(
                {"request_id": req['id']},
                {"$set": {
                    "status": new_cert_status,
                    "verified_by_id": faculty_user.get('id') or faculty_user.get('userId'),
                    "verified_by_name": faculty_user.get('name'),
                    "verified_at": now,
                    "remarks": feedback
                }}
            )

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{uuid.uuid4().hex[:8].upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': f"Certificate {new_cert_status}",
                'performed_by_id': faculty_user.get('id') or faculty_user.get('userId'),
                'performed_by_name': faculty_user.get('name'),
                'role': faculty_user.get('role', 'Mentor'),
                'stage': 'Certificate Verification',
                'remarks': feedback,
                'created_at': now
            })

        if notif_col is not None:
            notif_title = "OD Request Completed & Verified!" if is_approved else "Certificate Verification Declined"
            notif_msg = (
                f"Your participation certificate for '{req['eventName']}' has been verified. Your OD is officially completed and credited to your attendance record."
                if is_approved else
                f"Your certificate for '{req['eventName']}' was declined: {feedback}"
            )
            notif_col.insert_one({
                'id': f"NOTIF_{uuid.uuid4().hex[:8].upper()}",
                'user_id': req['studentId'],
                'title': notif_title,
                'message': notif_msg,
                'type': 'approval' if is_approved else 'rejection',
                'link': "/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        # Primary and only notification channel: Send email notification to student
        try:
            s_email, s_name = get_student_info(req)
            if s_email:
                if is_approved:
                    send_certificate_verified_student_notification(s_email, s_name, req['eventName'], feedback)
                else:
                    send_certificate_rejected_student_notification(s_email, s_name, req['eventName'], feedback)
        except Exception as e:
            print(f"[-] Email notification dispatch error on certificate verify: {e}")

        return ODRequestModel.get_by_id(request_id), None
