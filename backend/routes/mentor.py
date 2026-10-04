import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_from_directory
from backend.models.od_request import ODRequestModel
from backend.routes.auth import role_required
from backend.config import Config

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
    mentor_user = request.current_user
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
    mentor_user = request.current_user
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
    mentor_user = request.current_user
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
        'status': updated_req.get('status'),
        'currentStage': updated_req.get('currentStage')
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
    mentor_user = request.current_user
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
        'status': updated_req.get('status'),
        'rejectionReason': updated_req.get('rejectionReason')
    }), 200

@mentor_bp.route('/od-requests/<request_id>/verify-certificate', methods=['POST'])
@role_required('Mentor')
def verify_student_certificate(request_id):
    """
    Verify student participation certificate as Mentor/Faculty.
    Status can be 'Verified' or 'Rejected'.
    """
    mentor_user = request.current_user
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
    mentor_user = request.current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({'success': False, 'error': 'OD Request not found.'}), 404

    if not is_mentor_authorized_for_request(mentor_user, req):
        return jsonify({'success': False, 'error': 'Access denied.'}), 403

    doc_url = req.get('od_letter_url') or req.get('documentUrl')
    if not doc_url:
        return jsonify({'success': False, 'error': 'No OD letter attached to this request.'}), 404

    filename = os.path.basename(doc_url)
    safe_filename = secure_filename(filename)

    file_path = os.path.join(Config.OD_LETTERS_FOLDER, safe_filename)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'Attached OD letter file not found on server.'}), 404

    return send_from_directory(Config.OD_LETTERS_FOLDER, safe_filename)
