import uuid
import re
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import (
    od_requests_collection,
    approvals_collection,
    od_history_collection,
    certificates_collection,
    notifications_collection
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
        if status in ['Mentor Approved', 'Class Incharge Approved', 'Class Incharge Rejected', 'HOD Approved', 'Approved', 'HOD Rejected'] or curr_stage in ['Class Incharge', 'HOD', 'Approved']:
            mentor_status = 'Approved'
            mentor_feedback = (remarks if status == 'Mentor Approved' else None) or 'Recommended and forwarded by Mentor'
        elif status == 'Mentor Rejected' or (status == 'Rejected' and curr_stage == 'Mentor'):
            mentor_status = 'Rejected'
            mentor_feedback = rejection_reason or remarks or 'Application declined by Mentor'

        # Class Incharge stage status determination
        ci_status = 'Unreached'
        ci_feedback = None
        if status in ['Class Incharge Approved', 'Approved', 'HOD Approved', 'HOD Rejected'] or curr_stage in ['HOD', 'Approved']:
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
        if status in ['Approved', 'HOD Approved'] or curr_stage == 'Approved':
            hod_status = 'Approved'
            hod_feedback = remarks or 'Executive approval granted by HOD'
        elif status in ['HOD Rejected'] or (status == 'Rejected' and curr_stage == 'HOD'):
            hod_status = 'Rejected'
            hod_feedback = rejection_reason or remarks or 'Application declined by HOD'
        elif status == 'Class Incharge Approved' and curr_stage == 'HOD':
            hod_status = 'Pending'
            hod_feedback = 'Awaiting executive sanction from HOD'

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
        """Insert a new OD Request into MongoDB database."""
        col = od_requests_collection()
        hist_col = od_history_collection()
        notif_col = notifications_collection()

        if col is None:
            raise RuntimeError("MongoDB connection not established.")

        req_id = data.get('id') or f"REQ_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4().hex[:6]).upper()}"
        from_date = data.get('from_date') or data.get('fromDate') or data.get('eventDate')
        to_date = data.get('to_date') or data.get('toDate') or from_date
        num_days = data.get('number_of_days') or ODRequestModel.calculate_days(from_date, to_date)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

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
            'from_time': data.get('from_time') or data.get('fromTime') or '09:00',
            'to_time': data.get('to_time') or data.get('toTime') or '17:00',
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
            hist_id = f"HIST_{str(uuid.uuid4().hex[:8]).upper()}"
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

        return ODRequestModel.get_by_id(req_id)

    @staticmethod
    def get_by_id(request_id):
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
        col = od_requests_collection()
        if col is None:
            return []
        cursor = col.find().sort("created_at", -1)
        return [ODRequestModel.populate_student_info(ODRequestModel.to_dict(r)) for r in cursor]

    @staticmethod
    def list_by_student(student_id):
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
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Recommended by Mentor",
                'message': f"Your OD request for '{req['eventName']}' was approved by Mentor and forwarded to Class Incharge.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

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
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by Mentor",
                'message': f"Your OD request for '{req['eventName']}' was declined by Mentor: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def list_for_class_incharge(ci_user):
        """
        List all requests for the Class Incharge's assigned department.
        Requests with status 'Mentor Approved' are pending Class Incharge endorsement.
        """
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
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Endorsed by Class Incharge",
                'message': f"Your OD request for '{req['eventName']}' was endorsed and sent to HOD for final approval.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

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
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by Class Incharge",
                'message': f"Your OD request for '{req['eventName']}' was declined by Class Incharge: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def list_for_hod(hod_user):
        """
        List all requests for the HOD's department.
        Requests with status 'Class Incharge Approved' are pending HOD sanction.
        """
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
        Execute final HOD approval:
        1. Validates request is currently in 'Class Incharge Approved' status with stage 'HOD'.
        2. Sets status to 'Approved' and current_stage to 'Approved'.
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
            return None, f"Cannot approve request: Current status is '{current_status}' (Stage: '{current_stage}'). Only Class Incharge Approved requests can receive HOD executive sanction."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        actual_remarks = remarks or 'Executive approval granted by HOD'

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "status": "Approved",
                "current_stage": "Approved",
                "remarks": actual_remarks,
                "updated_at": now
            }}
        )

        if appr_col is not None:
            appr_col.insert_one({
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'HOD Approved',
                'performed_by_id': hod_user.get('id') or hod_user.get('userId'),
                'performed_by_name': hod_user.get('name'),
                'role': 'HOD',
                'stage': 'HOD Final Approval',
                'remarks': actual_remarks,
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Officially Approved by HOD!",
                'message': f"Congratulations! Your OD application for '{req['eventName']}' has received official sanction from the HOD. You may now participate and upload your completion certificate after the event.",
                'type': 'approval',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

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
                'id': f"APPR_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
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
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"OD Request Declined by HOD",
                'message': f"Your OD request for '{req['eventName']}' was declined by HOD: {clean_reason}",
                'type': 'rejection',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def upload_certificate(request_id, student_user, file_url):
        """
        Attach event certificate after OD request approval:
        1. Updates od_requests certificate_status to 'Pending Verification'.
        2. Records document in certificates collection.
        3. Adds entry to od_history and notifies faculty.
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

        if req['status'] not in ['Approved', 'HOD Approved']:
            return None, f"Certificates can only be uploaded for Approved OD requests (Current status: '{req['status']}')."

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "certificate_status": "Pending Verification",
                "certificate_url": file_url,
                "updated_at": now
            }}
        )

        if cert_col is not None:
            cert_id = f"CERT_{str(uuid.uuid4().hex[:8]).upper()}"
            cert_col.insert_one({
                'id': cert_id,
                'request_id': req['id'],
                'student_id': student_user.get('id') or student_user.get('userId'),
                'student_reg_no': student_user.get('identifier'),
                'event_name': req['eventName'],
                'certificate_file_url': file_url,
                'upload_date': now,
                'status': 'Pending Verification',
                'verified_by_id': None,
                'verified_by_name': None,
                'verified_at': None,
                'remarks': None,
                'created_at': now
            })

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': 'Certificate Uploaded',
                'performed_by_id': student_user.get('id') or student_user.get('userId'),
                'performed_by_name': student_user.get('name'),
                'role': 'Student',
                'stage': 'Certificate Verification',
                'remarks': 'Participation certificate uploaded for verification',
                'created_at': now
            })

        return ODRequestModel.get_by_id(request_id), None

    @staticmethod
    def verify_certificate(request_id, faculty_user, status='Verified', remarks=''):
        """
        Verify certificate by Mentor/Faculty:
        1. Sets certificate_status to 'Verified' or 'Rejected' in od_requests and certificates.
        2. Logs in od_history and sends notification to student.
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
        new_status = 'Verified' if status.lower() in ['verified', 'approved'] else 'Rejected'

        col.update_one(
            {"id": req['id']},
            {"$set": {
                "certificate_status": new_status,
                "updated_at": now
            }}
        )

        if cert_col is not None:
            cert_col.update_many(
                {"request_id": req['id']},
                {"$set": {
                    "status": new_status,
                    "verified_by_id": faculty_user.get('id') or faculty_user.get('userId'),
                    "verified_by_name": faculty_user.get('name'),
                    "verified_at": now,
                    "remarks": remarks or f"Certificate {new_status} by {faculty_user.get('role')}"
                }}
            )

        if hist_col is not None:
            hist_col.insert_one({
                'id': f"HIST_{str(uuid.uuid4().hex[:8]).upper()}",
                'request_id': req['id'],
                'student_id': req['studentId'],
                'action': f"Certificate {new_status}",
                'performed_by_id': faculty_user.get('id') or faculty_user.get('userId'),
                'performed_by_name': faculty_user.get('name'),
                'role': faculty_user.get('role', 'Mentor'),
                'stage': 'Certificate Verification',
                'remarks': remarks or f"Certificate {new_status} by {faculty_user.get('name')}",
                'created_at': now
            })

        if notif_col is not None:
            notif_col.insert_one({
                'id': f"NOTIF_{str(uuid.uuid4().hex[:8]).upper()}",
                'user_id': req['studentId'],
                'title': f"Certificate {new_status}",
                'message': f"Your participation certificate for '{req['eventName']}' has been {new_status.lower()} by faculty.",
                'type': 'certificate',
                'link': f"/student/dashboard",
                'is_read': 0,
                'created_at': now
            })

        return ODRequestModel.get_by_id(request_id), None
