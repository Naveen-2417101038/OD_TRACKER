import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_from_directory
from backend.models.od_request import ODRequestModel
from backend.routes.auth import role_required
from backend.config import Config

class_incharge_bp = Blueprint('class_incharge', __name__)

def is_class_incharge_authorized_for_request(ci_user, req):
    """Verify that the request belongs to the Class Incharge's assigned department / class / section."""
    if not req or not ci_user:
        return False
    ci_dept = (ci_user.get('department') or '').strip().lower()
    req_dept = (req.get('department') or req.get('studentDepartment') or '').strip().lower()
    if ci_dept and req_dept and ci_dept != req_dept:
        return False
    return True

@class_incharge_bp.route('/od-requests', methods=['GET'])
@role_required('Class Incharge')
def get_class_incharge_od_requests():
    """
    Retrieve all OD requests assigned to the authenticated Class Incharge from MongoDB.
    Only requests with status 'Mentor Approved' appear as pending for Class Incharge.
    """
    ci_user = request.current_user
    all_requests = ODRequestModel.list_for_class_incharge(ci_user)

    pending_requests = [
        r for r in all_requests 
        if r.get('status') == 'Mentor Approved' and r.get('currentStage') == 'Class Incharge'
    ]
    reviewed_requests = [
        r for r in all_requests 
        if not (r.get('status') == 'Mentor Approved' and r.get('currentStage') == 'Class Incharge')
    ]
    approved_requests = [
        r for r in all_requests 
        if r.get('status') in ['Class Incharge Approved', 'Approved', 'HOD Approved']
    ]
    rejected_requests = [
        r for r in all_requests 
        if r.get('status') in ['Class Incharge Rejected', 'Rejected']
    ]

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

@class_incharge_bp.route('/od-requests/<request_id>', methods=['GET'])
@role_required('Class Incharge')
def get_class_incharge_od_request_detail(request_id):
    """Retrieve full details of a specific OD request for Class Incharge review from MongoDB."""
    ci_user = request.current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: This OD request belongs to another department/class section."
        }), 403

    return jsonify({
        'success': True,
        'request': req
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/approve', methods=['POST'])
@role_required('Class Incharge')
def approve_od_request_by_class_incharge(request_id):
    """
    Approve/endorse an assigned OD request as Class Incharge:
    - Validates request state is 'Mentor Approved'
    - Updates status to 'Class Incharge Approved' in MongoDB
    - Advances stage to 'HOD'
    - Logs decision in approvals and od_history collections
    """
    ci_user = request.current_user
    data = request.get_json(silent=True) or {}
    remarks = (data.get('remarks') or data.get('comments') or '').strip()

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot approve OD requests belonging to another class/section."
        }), 403

    updated_req, err = ODRequestModel.approve_by_class_incharge(request_id, ci_user, remarks)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been endorsed and approved by Class Incharge.",
        'request': updated_req,
        'status': updated_req.get('status'),
        'currentStage': updated_req.get('currentStage')
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/reject', methods=['POST'])
@role_required('Class Incharge')
def reject_od_request_by_class_incharge(request_id):
    """
    Reject an assigned OD request as Class Incharge:
    - Requires mandatory rejection reason
    - Validates request state is 'Mentor Approved'
    - Updates status to 'Class Incharge Rejected' in MongoDB
    - Logs decision in approvals and od_history collections
    """
    ci_user = request.current_user
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

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot reject OD requests belonging to another class/section."
        }), 403

    updated_req, err = ODRequestModel.reject_by_class_incharge(request_id, ci_user, reason)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been rejected by Class Incharge.",
        'request': updated_req,
        'status': updated_req.get('status'),
        'rejectionReason': updated_req.get('rejectionReason')
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/letter', methods=['GET'])
@role_required('Class Incharge')
def view_class_incharge_od_letter(request_id):
    """
    Securely download/view the uploaded OD letter for an assigned request.
    Prevents unauthorized access and directory traversal.
    """
    ci_user = request.current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({'success': False, 'error': 'OD Request not found.'}), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
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
