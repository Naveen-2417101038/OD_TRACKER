import os
import io
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_from_directory, send_file
from sqlalchemy import or_, and_, func
from backend.database.sql_server import session_scope
from backend.models.db_models import User, Certificate, ODRequest, to_iso
from backend.models.user import UserModel
from backend.models.academic_record import AcademicRecordModel
from backend.services.od_eligibility import calculate_od_eligibility

try:
    from backend.models.od_request import ODRequestModel
    from backend.routes.auth import role_required, current_user
    from backend.config import Config
except ImportError:
    from models.od_request import ODRequestModel
    from routes.auth import role_required, current_user
    from config import Config

mentor_bp = Blueprint('mentor', __name__)

def is_mentor_authorized_for_request(mentor_user, req):
    """Verify that the request belongs to the mentor's assigned department / ward."""
    if not req or not mentor_user:
        return False
    mentor_dept = (mentor_user.get('department') or '').strip().lower()
    req_dept = (req.get('department') or req.get('studentDepartment') or '').strip().lower()
    if mentor_dept and req_dept and mentor_dept != req_dept:
        return False
    return True

@mentor_bp.route('/od-requests', methods=['GET'])
@role_required('Mentor')
def get_mentor_od_requests():
    """
    Retrieve all OD requests assigned to the authenticated mentor from MongoDB.
    Returns categorized lists (all, pending, reviewed/history, approved, rejected).
    """
    mentor_user = current_user
    all_requests = ODRequestModel.list_for_mentor(mentor_user)

    pending_requests = [r for r in all_requests if r.get('status') == 'Pending' and r.get('currentStage') == 'Mentor']
    reviewed_requests = [r for r in all_requests if r.get('status') != 'Pending' or r.get('currentStage') != 'Mentor']
    approved_requests = [r for r in all_requests if 'Approved' in str(r.get('status'))]
    rejected_requests = [r for r in all_requests if 'Rejected' in str(r.get('status'))]

    # Optional status filter query parameter (?status=pending | ?status=history)
    status_filter = request.args.get('status', '').lower().strip()
    if status_filter == 'pending':
        return jsonify({
            'success': True,
            'requests': pending_requests,
            'count': len(pending_requests)
        }), 200
    elif status_filter in ['history', 'reviewed']:
        return jsonify({
            'success': True,
            'requests': reviewed_requests,
            'count': len(reviewed_requests)
        }), 200

    return jsonify({
        'success': True,
        'requests': all_requests,
        'pending': pending_requests,
        'history': reviewed_requests,
        'approved': approved_requests,
        'rejected': rejected_requests,
        'count': len(all_requests),
        'pendingCount': len(pending_requests)
    }), 200

@mentor_bp.route('/od-requests/<request_id>', methods=['GET'])
@role_required('Mentor')
def get_mentor_od_request_detail(request_id):
    """Retrieve full details of a specific OD request assigned to this mentor from MongoDB."""
    mentor_user = current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_mentor_authorized_for_request(mentor_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: This OD request belongs to another department/ward."
        }), 403

    return jsonify({
        'success': True,
        'request': req
    }), 200

@mentor_bp.route('/od-requests/<request_id>/approve', methods=['POST'])
@role_required('Mentor')
def approve_od_request(request_id):
    """
    Approve an assigned OD request as Mentor:
    - Validates request state is 'Pending'
    - Updates status to 'Mentor Approved' in MongoDB
    - Advances stage to 'Class Incharge'
    - Logs decision in approvals and od_history collections
    """
    mentor_user = current_user
    data = request.get_json(silent=True) or {}
    remarks = (data.get('remarks') or data.get('comments') or '').strip()

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_mentor_authorized_for_request(mentor_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot approve OD requests belonging to another mentor's ward."
        }), 403

    updated_req, err = ODRequestModel.approve_by_mentor(request_id, mentor_user, remarks)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been successfully recommended and approved by Mentor.",
        'request': updated_req,
        'status': updated_req.get('status') if updated_req else None,
        'currentStage': updated_req.get('currentStage') if updated_req else None
    }), 200

@mentor_bp.route('/od-requests/<request_id>/reject', methods=['POST'])
@role_required('Mentor')
def reject_od_request(request_id):
    """
    Reject an assigned OD request as Mentor:
    - Requires mandatory rejection reason
    - Validates request state is 'Pending'
    - Updates status to 'Mentor Rejected' in MongoDB
    - Logs decision in approvals and od_history collections
    """
    mentor_user = current_user
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or data.get('remarks') or data.get('comments') or '').strip()

    if not reason:
        return jsonify({
            'success': False,
            'error': "Rejection reason / remark is mandatory when rejecting an OD request."
        }), 400

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_mentor_authorized_for_request(mentor_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot reject OD requests belonging to another mentor's ward."
        }), 403

    updated_req, err = ODRequestModel.reject_by_mentor(request_id, mentor_user, reason)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been rejected by Mentor.",
        'request': updated_req,
        'status': updated_req.get('status') if updated_req else None,
        'rejectionReason': updated_req.get('rejectionReason') if updated_req else None
    }), 200

@mentor_bp.route('/od-requests/<request_id>/verify-certificate', methods=['POST'])
@role_required('Mentor')
def verify_student_certificate(request_id):
    """
    Verify student participation certificate as Mentor/Faculty.
    Status can be 'Verified' or 'Rejected'.
    """
    mentor_user = current_user
    data = request.get_json(silent=True) or {}
    status = (data.get('status') or 'Verified').strip()
    remarks = (data.get('remarks') or '').strip()

    updated_req, err = ODRequestModel.verify_certificate(request_id, mentor_user, status, remarks)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    return jsonify({
        'success': True,
        'message': f"Certificate successfully {status.lower()} by {mentor_user.get('name')}.",
        'request': updated_req
    }), 200

@mentor_bp.route('/od-requests/<request_id>/letter', methods=['GET'])
@role_required('Mentor')
def view_mentor_od_letter(request_id):
    """
    Securely download/view the uploaded OD letter for an assigned request.
    Prevents unauthorized access and directory traversal.
    """
    mentor_user = current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({'success': False, 'error': 'OD Request not found.'}), 404

    if not is_mentor_authorized_for_request(mentor_user, req):
        return jsonify({'success': False, 'error': 'Access denied.'}), 403

    doc_url = req.get('od_letter_url') or req.get('documentUrl')
    filename = os.path.basename(doc_url) if doc_url else f"od_letter_{request_id}.pdf"
    safe_filename = secure_filename(filename)
    as_attachment = request.args.get('download', '').lower() in ['true', '1', 'yes']
    download_name = f"OD_Letter_{request_id}.pdf" if as_attachment else safe_filename

    # 1. Try Azure Blob Storage container 'odletters' first
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage

        blob_data, content_type = blob_storage.download_file('odletters', safe_filename)
        if blob_data:
            return send_file(
                io.BytesIO(blob_data),
                mimetype=content_type or 'application/pdf',
                as_attachment=as_attachment,
                download_name=download_name
            )
    except Exception:
        pass

    # 2. Local disk fallback
    file_path = os.path.join(Config.OD_LETTERS_FOLDER, safe_filename)
    if not os.path.exists(file_path):
        from services.pdf_service import generate_od_letter_pdf
        generate_od_letter_pdf(
            file_path,
            student_name=req.get('studentName', 'Student'),
            reg_no=req.get('studentRegisterNo', req.get('studentId', '23CSD001')),
            event_name=req.get('eventName', 'Event Requisition'),
            organizer=req.get('eventOrganizer', 'Institutional Organizer'),
            event_date=req.get('eventDate', req.get('fromDate', '2026-10-18')),
            dept=req.get('department', req.get('studentDepartment', 'Computer Science and Design')),
            req_id=request_id
        )

    return send_from_directory(
        Config.OD_LETTERS_FOLDER, 
        safe_filename, 
        as_attachment=as_attachment, 
        download_name=download_name
    )


# ─── MENTOR CERTIFICATES VERIFICATION QUEUE ───────────────────────────────────

@mentor_bp.route('/certificates', methods=['GET'])
@role_required('Mentor')
def get_mentor_certificates():
    """Retrieve certificates awaiting or completed verification within mentor's ward/department."""
    mentor_user = current_user
    mentor_dept = (mentor_user.get('department') or '').strip().lower()

    with session_scope() as session:
        cert_query = session.query(Certificate).join(ODRequest, Certificate.request_id == ODRequest.id)
        if mentor_dept:
            cert_query = cert_query.filter(func.lower(ODRequest.department) == mentor_dept)
        certs = cert_query.order_by(Certificate.created_at.desc()).all()
        cert_list = [c.to_dict() for c in certs]

        # Also include OD requests that have certificate_url but no entry in certificates table yet
        od_reqs = session.query(ODRequest).filter(
            ODRequest.certificate_url.isnot(None),
            ODRequest.certificate_url != ''
        )
        if mentor_dept:
            od_reqs = od_reqs.filter(func.lower(ODRequest.department) == mentor_dept)

        existing_req_ids = {c.get('request_id') for c in cert_list}
        for req in od_reqs.all():
            if req.id not in existing_req_ids:
                fname = os.path.basename(req.certificate_url or 'certificate.pdf')
                cert_list.append({
                    'id': f"CERT_{req.id}",
                    'requestId': req.id,
                    'request_id': req.id,
                    'studentId': req.student_id,
                    'student_id': req.student_id,
                    'studentRegNo': req.student_reg_no,
                    'student_reg_no': req.student_reg_no,
                    'studentName': req.student_name,
                    'student_name': req.student_name,
                    'eventName': req.event_name,
                    'event_name': req.event_name,
                    'certificateName': fname,
                    'certificate_file_url': req.certificate_url,
                    'certificateUrl': req.certificate_url,
                    'status': req.certificate_status or 'Pending Verification',
                    'uploadDate': to_iso(req.certificate_submitted_at or req.updated_at),
                    'upload_date': to_iso(req.certificate_submitted_at or req.updated_at),
                })

    return jsonify({'success': True, 'certificates': cert_list, 'count': len(cert_list)}), 200


# ─── MENTOR LIVE DASHBOARD STATS ──────────────────────────────────────────────

@mentor_bp.route('/stats', methods=['GET'])
@role_required('Mentor')
def get_mentor_stats():
    """Live mentor dashboard statistics calculated from SQL Server."""
    mentor_user = current_user
    all_requests = ODRequestModel.list_for_mentor(mentor_user)

    pending_count = len([r for r in all_requests if r.get('status') == 'Pending' and r.get('currentStage') == 'Mentor'])
    approved_count = len([r for r in all_requests if 'Approved' in str(r.get('status', ''))])
    rejected_count = len([r for r in all_requests if 'Rejected' in str(r.get('status', ''))])

    mentor_dept = (mentor_user.get('department') or '').strip().lower()
    with session_scope() as session:
        q = session.query(User).filter(
            or_(
                func.lower(User.role) == 'student',
                func.lower(User.sub_role) == 'student'
            )
        )
        if mentor_dept and mentor_dept != 'all':
            if mentor_dept in ('computer science and design', 'csd'):
                q = q.filter(func.lower(User.department).in_(['computer science and design', 'csd']))
            else:
                q = q.filter(func.lower(User.department) == mentor_dept)
        total_students = q.count()

    return jsonify({
        'success': True,
        'stats': {
            'totalStudents': total_students,
            'pendingApprovals': pending_count,
            'approvedCount': approved_count,
            'rejectedCount': rejected_count,
            'totalRequests': len(all_requests)
        }
    }), 200


# ─── MENTOR ASSIGNED STUDENTS / WARDS ─────────────────────────────────────────

@mentor_bp.route('/students', methods=['GET'])
@role_required('Mentor')
def get_mentor_students():
    """Retrieve all students mapped to this mentor's department/ward with academic standing."""
    mentor_user = current_user
    mentor_dept = (mentor_user.get('department') or '').strip()

    students = UserModel.list_all(role='Student', department=mentor_dept if mentor_dept else None)

    acad_docs = {a['student_id']: a for a in AcademicRecordModel.list_all() if a and 'student_id' in a}

    roster = []
    for s in students:
        sid = s.get('id')
        reg_no = s.get('identifier') or sid
        acad = acad_docs.get(sid) or AcademicRecordModel.get_by_register_number(reg_no)

        elig = calculate_od_eligibility(sid, requested_od_days=0.0)

        att = acad.get('attendance_percentage') if acad else s.get('attendance_percentage', 85.0)
        cgpa = acad.get('cgpa') if acad and acad.get('cgpa') is not None else s.get('cgpa', 8.5)
        c1 = acad.get('cat1_marks') if acad else s.get('cat1_marks')
        c2 = acad.get('cat2_marks') if acad else s.get('cat2_marks')
        c3 = acad.get('cat3_marks') if acad else s.get('cat3_marks')

        roster.append({
            'id': sid,
            'studentId': sid,
            'registerNumber': reg_no,
            'rollNo': reg_no,
            'name': s.get('name') or 'Student',
            'studentName': s.get('name') or 'Student',
            'email': s.get('email') or '',
            'department': s.get('department'),
            'year': s.get('year'),
            'section': s.get('section', 'A'),
            'phone': s.get('phone', ''),
            'avatar': s.get('avatar'),
            'attendancePercent': float(att) if att is not None else 85.0,
            'cgpa': float(cgpa) if cgpa is not None else 8.5,
            'cat1Marks': c1,
            'cat2Marks': c2,
            'cat3Marks': c3,
            'odUsedDays': elig.get('od_used_days', 0.0),
            'eligibilityStatus': elig.get('eligibility_status_label', 'Eligible')
        })

    return jsonify({
        'success': True,
        'students': roster,
        'count': len(roster)
    }), 200

