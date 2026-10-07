import io
import os
import re
import uuid
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from backend.routes.auth import login_required, role_required, current_user
from backend.models.academic_record import AcademicRecordModel, AcademicUploadHistoryModel
from backend.models.user import UserModel
from backend.database.mongodb import users_collection
from backend.services.excel_academic_service import (
    generate_sample_academic_template,
    parse_and_validate_academic_excel
)
from backend.services.od_eligibility import calculate_od_eligibility

academic_bp = Blueprint('academic', __name__)

# Temporary in-memory cache for upload previews: preview_token -> { rows, summary, errors, timestamp, filename }
PREVIEW_CACHE = {}
PREVIEW_TTL_SECONDS = 3600  # 1 hour


def _clean_expired_previews():
    now = time.time()
    expired = [k for k, v in PREVIEW_CACHE.items() if now - v.get('timestamp', 0) > PREVIEW_TTL_SECONDS]
    for k in expired:
        PREVIEW_CACHE.pop(k, None)


# ─── 1. Download Sample Excel Template ──────────────────────────────────────────
@academic_bp.route('/template', methods=['GET'])
@academic_bp.route('/sample-template', methods=['GET'])
@role_required('Class Incharge', 'Mentor', 'HOD', 'Admin')
def download_sample_template():
    """
    Generate and stream an official, formatted Excel template (.xlsx)
    with required column headers and sample student rows.
    """
    try:
        excel_stream = generate_sample_academic_template()
        return send_file(
            excel_stream,
            as_attachment=True,
            download_name='sample_academic_data_template.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Failed to generate Excel template: {str(e)}"
        }), 500


# ─── 2. Upload & Preview Excel Spreadsheet ─────────────────────────────────────
@academic_bp.route('/upload', methods=['POST'])
@role_required('Class Incharge')
def upload_and_preview_academic_excel():
    """
    Receive uploaded .xlsx or .xls file from Class Incharge.
    Validates file format, columns, data types, and matches students against database.
    Does NOT update the database immediately; returns a preview structure and token.
    """
    _clean_expired_previews()
    active_user = current_user

    if 'file' not in request.files and 'excel' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No file uploaded. Please choose an Excel file (.xlsx or .xls).'
        }), 400

    file = request.files.get('file') or request.files.get('excel')
    if not file or not file.filename:
        return jsonify({
            'success': False,
            'error': 'No file selected. Please select a valid file.'
        }), 400

    orig_filename = secure_filename(file.filename) or 'academic_data.xlsx'
    ext = orig_filename.rsplit('.', 1)[-1].lower() if '.' in orig_filename else ''
    if ext not in ['xlsx', 'xls']:
        return jsonify({
            'success': False,
            'error': f"Invalid file format '.{ext}'. Only Excel spreadsheets (.xlsx, .xls) are accepted."
        }), 400

    try:
        file_bytes = io.BytesIO(file.read())
        user_dept = active_user.get('department')
        result = parse_and_validate_academic_excel(file_bytes, allowed_department=user_dept)

        if not result.get('success'):
            return jsonify({
                'success': False,
                'error': result.get('error', 'Spreadsheet validation failed.')
            }), 400

        # Cache preview in-memory for confirmation step
        preview_token = f"prev_{uuid.uuid4().hex}"
        PREVIEW_CACHE[preview_token] = {
            'timestamp': time.time(),
            'filename': orig_filename,
            'summary': result['summary'],
            'rows': result['rows'],
            'errors': result['errors'],
            'uploaded_by_id': current_user.get('id'),
            'uploaded_by_name': current_user.get('name')
        }

        return jsonify({
            'success': True,
            'preview_token': preview_token,
            'confirm_token': preview_token,
            'file_name': orig_filename,
            'summary': result['summary'],
            'rows': result['rows'],
            'errors': result['errors']
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Failed to process Excel spreadsheet: {str(e)}"
        }), 500


# ─── 3. Confirm & Transactional Database Update ────────────────────────────────
@academic_bp.route('/confirm', methods=['POST'])
@role_required('Class Incharge')
def confirm_academic_data_update():
    """
    Confirm previewed academic records and update database transactionally.
    Updates existing student records (CAT 1, 2, 3, attendance percentage, timestamp).
    Logs the upload audit history.
    """
    active_user = current_user
    data = request.get_json(silent=True) or {}
    preview_token = data.get('preview_token') or data.get('confirm_token')
    custom_rows = data.get('rows')

    cached_preview = PREVIEW_CACHE.get(preview_token) if preview_token else None

    # Retrieve rows to process
    rows_to_process = None
    file_name = "Academic_Data_Upload.xlsx"

    if cached_preview:
        rows_to_process = cached_preview.get('rows', [])
        file_name = cached_preview.get('filename', file_name)
    elif custom_rows and isinstance(custom_rows, list):
        rows_to_process = custom_rows
        file_name = data.get('file_name', file_name)

    if not rows_to_process:
        return jsonify({
            'success': False,
            'error': 'Preview session has expired or no rows were provided. Please re-upload your Excel spreadsheet.'
        }), 400

    # Filter out invalid or unmatched rows
    valid_rows = [
        r for r in rows_to_process
        if r.get('match_status') == 'Matched' and r.get('validation_status') == 'Valid' and r.get('student_id')
    ]
    unmatched_rows = [r for r in rows_to_process if r.get('match_status') == 'Not Found']
    invalid_rows = [r for r in rows_to_process if r.get('validation_status') == 'Error']

    if not valid_rows:
        return jsonify({
            'success': False,
            'error': 'No valid matched student records found to update. Please review errors and try again.'
        }), 400

    # Execute transactional update
    ci_id = active_user.get('id') or 'FAC002'
    ci_name = active_user.get('name') or 'Class Incharge'

    updated_records, err = AcademicRecordModel.batch_update_records(valid_rows, ci_id, ci_name)
    if err or updated_records is None:
        # Audit failed upload
        AcademicUploadHistoryModel.create({
            'uploaded_by_id': ci_id,
            'uploaded_by_name': ci_name,
            'file_name': file_name,
            'total_rows': len(rows_to_process),
            'successful_updates': 0,
            'unmatched_count': len(unmatched_rows),
            'invalid_count': len(invalid_rows),
            'status': 'Failed',
            'details': [{'error': err or 'Database update failed'}]
        })
        return jsonify({
            'success': False,
            'error': f"Database update aborted: {err or 'Database update failed'}. No student records were modified."
        }), 500

    updated_count = len(updated_records)

    # Audit successful/warning upload
    status_label = 'Completed' if (len(unmatched_rows) == 0 and len(invalid_rows) == 0) else 'Completed with warnings'
    history_record = AcademicUploadHistoryModel.create({
        'uploaded_by_id': ci_id,
        'uploaded_by_name': ci_name,
        'file_name': file_name,
        'total_rows': len(rows_to_process),
        'successful_updates': updated_count,
        'unmatched_count': len(unmatched_rows),
        'invalid_count': len(invalid_rows),
        'status': status_label,
        'details': rows_to_process
    })

    # Clear preview from cache
    if preview_token:
        PREVIEW_CACHE.pop(preview_token, None)

    return jsonify({
        'success': True,
        'message': f"Academic data updated successfully. {updated_count} student record(s) updated.",
        'updated_count': updated_count,
        'unmatched_count': len(unmatched_rows),
        'invalid_count': len(invalid_rows),
        'history_id': history_record.get('id') if history_record else None,
        'status': status_label
    }), 200


# ─── 4. Upload History Section ─────────────────────────────────────────────────
@academic_bp.route('/upload-history', methods=['GET'])
@role_required('Class Incharge', 'HOD', 'Admin')
def get_academic_upload_history():
    """Retrieve history archive of all Excel academic data uploads."""
    history_list = AcademicUploadHistoryModel.list_all(limit=50)
    return jsonify({
        'success': True,
        'history': history_list,
        'count': len(history_list)
    }), 200


@academic_bp.route('/upload-history/<history_id>', methods=['GET'])
@role_required('Class Incharge', 'HOD', 'Admin')
def get_academic_upload_history_detail(history_id):
    """Retrieve detailed row logs of a specific past upload."""
    record = AcademicUploadHistoryModel.get_by_id(history_id)
    if not record:
        return jsonify({
            'success': False,
            'error': f"Upload history record '{history_id}' not found."
        }), 404
    return jsonify({
        'success': True,
        'record': record
    }), 200


# ─── 5. Class Students Academic Roster with 10% OD Eligibility ─────────────────
@academic_bp.route('/students', methods=['GET'])
@role_required('Class Incharge', 'Mentor', 'HOD', 'Admin')
def get_academic_students_roster():
    """
    Retrieve live roster of students with latest attendance %, CAT 1, 2, 3 marks,
    and computed 10% OD eligibility status.
    """
    active_user = current_user
    user_role = active_user.get('role')
    user_dept = (active_user.get('department') or '').strip().lower()

    col = users_collection()
    if col is None:
        return jsonify({'success': False, 'error': 'Database unavailable'}), 500

    query = {"role": {"$regex": "^student$", "$options": "i"}}
    if user_role in ['Class Incharge', 'Mentor'] and user_dept:
        dept_str = str(active_user.get('department') or '')
        query["department"] = {"$regex": f"^{re.escape(dept_str)}$", "$options": "i"}

    students = list(col.find(query, {"password_hash": 0, "password": 0}).sort("identifier", 1))

    # Retrieve all academic records
    acad_docs = {a['student_id']: a for a in AcademicRecordModel.list_all() if a and 'student_id' in a}

    roster = []
    for s in students:
        sid = s.get('id')
        reg_no = s.get('identifier') or sid
        acad = acad_docs.get(sid) or AcademicRecordModel.get_by_register_number(reg_no)

        att = acad.get('attendance_percentage') if acad else s.get('attendance_percentage', 85.0)
        c1 = acad.get('cat1_marks') if acad else s.get('cat1_marks')
        c2 = acad.get('cat2_marks') if acad else s.get('cat2_marks')
        c3 = acad.get('cat3_marks') if acad else s.get('cat3_marks')

        eligibility = calculate_od_eligibility(sid, requested_od_days=0.0)

        has_academic = acad is not None or (c1 is not None or c2 is not None or c3 is not None or att is not None)
        roster.append({
            'id': sid,
            'studentId': sid,
            'student_id': sid,
            'registerNumber': reg_no,
            'register_number': reg_no,
            'rollNo': reg_no,
            'name': s.get('name'),
            'studentName': s.get('name'),
            'student_name': s.get('name'),
            'department': s.get('department'),
            'year': s.get('year'),
            'section': s.get('section', 'A'),
            'avatar': s.get('avatar'),
            'attendancePercent': round(float(att), 1) if att is not None else None,
            'attendance_percentage': round(float(att), 1) if att is not None else None,
            'attendancePercentage': round(float(att), 1) if att is not None else None,
            'attendance': round(float(att), 1) if att is not None else None,
            'cat1Average': round(float(c1), 1) if c1 is not None else None,
            'cat1_marks': round(float(c1), 1) if c1 is not None else None,
            'cat1Marks': round(float(c1), 1) if c1 is not None else None,
            'cat1': round(float(c1), 1) if c1 is not None else None,
            'cat2Average': round(float(c2), 1) if c2 is not None else None,
            'cat2_marks': round(float(c2), 1) if c2 is not None else None,
            'cat2Marks': round(float(c2), 1) if c2 is not None else None,
            'cat2': round(float(c2), 1) if c2 is not None else None,
            'cat3Average': round(float(c3), 1) if c3 is not None else None,
            'cat3_marks': round(float(c3), 1) if c3 is not None else None,
            'cat3Marks': round(float(c3), 1) if c3 is not None else None,
            'cat3': round(float(c3), 1) if c3 is not None else None,
            'has_academic_data': has_academic,
            'eligibility': eligibility,
            'lastUpdated': acad.get('updated_at') if acad else s.get('last_academic_update'),
            'last_updated': acad.get('updated_at') if acad else s.get('last_academic_update'),
            'updatedBy': acad.get('updated_by_name') if acad else None,
            'updated_by': acad.get('updated_by_name') if acad else None
        })

    return jsonify({
        'success': True,
        'students': roster,
        'count': len(roster)
    }), 200


# ─── 6. Student Self View: /api/academic/me ────────────────────────────────────
@academic_bp.route('/me', methods=['GET'])
@role_required('Student')
def get_my_academic_details():
    """Allow authenticated student to view their own attendance, CAT marks, and OD allowance."""
    active_user = current_user
    sid = active_user.get('id')
    reg_no = active_user.get('identifier') or sid

    acad = AcademicRecordModel.get_by_student_id(sid) or AcademicRecordModel.get_by_register_number(reg_no)
    eligibility = calculate_od_eligibility(sid, requested_od_days=0.0)

    has_academic = acad is not None
    att = acad.get('attendance_percentage') if acad else active_user.get('attendance_percentage')
    c1 = acad.get('cat1_marks') if acad else active_user.get('cat1_marks')
    c2 = acad.get('cat2_marks') if acad else active_user.get('cat2_marks')
    c3 = acad.get('cat3_marks') if acad else active_user.get('cat3_marks')

    has_any_mark = c1 is not None or c2 is not None or c3 is not None or att is not None

    acad_payload = {
        'student_id': sid,
        'register_number': reg_no,
        'student_name': current_user.get('name'),
        'name': current_user.get('name'),
        'department': current_user.get('department'),
        'year': current_user.get('year'),
        'section': current_user.get('section'),
        'attendance_percentage': round(float(att), 1) if att is not None else None,
        'cat1_marks': round(float(c1), 1) if c1 is not None else None,
        'cat2_marks': round(float(c2), 1) if c2 is not None else None,
        'cat3_marks': round(float(c3), 1) if c3 is not None else None,
        'has_academic_data': has_academic or has_any_mark,
        'eligibility': eligibility,
        'last_updated': acad.get('updated_at') if acad else current_user.get('last_academic_update'),
        'updated_by': acad.get('updated_by_name') if acad else None
    }

    return jsonify({
        'success': True,
        'academic': acad_payload,
        **acad_payload
    }), 200


# ─── 7. Authorized Student Academic Inspection: /api/academic/student/<id> ──────
@academic_bp.route('/student/<student_id>', methods=['GET'])
@academic_bp.route('/<student_id>', methods=['GET'])
@login_required
def get_student_academic_detail(student_id):
    """
    Retrieve academic details and 10% OD eligibility for a specific student.
    Enforces privacy and role-based permissions on the backend:
    - Student: can view ONLY their own academic information.
    - Mentor / Faculty / Class Incharge / HOD: authorized by department / class.
    """
    active_user = current_user
    user_role = (active_user.get('role') or '').strip()
    user_dept = (active_user.get('department') or '').strip().lower()

    acad = AcademicRecordModel.get_by_student_id(student_id) or AcademicRecordModel.get_by_register_number(student_id)
    target_user = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)

    if not target_user and not acad:
        return jsonify({
            'success': False,
            'error': f"Student record for identifier '{student_id}' was not found in the institution database."
        }), 404

    target_id = str((target_user.get('id') if target_user else (acad.get('student_id') if acad else None)) or student_id)
    target_reg = str((target_user.get('identifier') if target_user else (acad.get('register_number') if acad else None)) or student_id)
    target_name = (target_user.get('name') if target_user else (acad.get('student_name') if acad else None)) or 'Unknown'
    user_dept_str = target_user.get('department') if target_user else (acad.get('department') if acad else '')
    target_dept = (user_dept_str or '').strip().lower()

    # 1. Enforce Role-Based Access Controls
    if user_role.lower() == 'student':
        current_id = active_user.get('id')
        current_reg = active_user.get('identifier')
        if current_id != target_id and current_reg != target_reg and student_id not in [current_id, current_reg]:
            return jsonify({
                'success': False,
                'error': 'Access denied: Students are authorized to view only their own academic information.'
            }), 403

    elif user_role.lower() in ['faculty', 'mentor', 'class incharge', 'class_incharge', 'hod', 'admin']:
        # Department level boundary protection
        if user_dept and target_dept and user_dept != target_dept:
            return jsonify({
                'success': False,
                'error': f"Access denied: You are not authorized to view academic data outside your department ({active_user.get('department')})."
            }), 403
    else:
        return jsonify({
            'success': False,
            'error': 'Access denied: Unauthorized role privileges.'
        }), 403

    eligibility = calculate_od_eligibility(target_id, requested_od_days=0.0)

    has_academic = acad is not None
    att = acad.get('attendance_percentage') if acad else (target_user.get('attendance_percentage') if target_user else None)
    c1 = acad.get('cat1_marks') if acad else (target_user.get('cat1_marks') if target_user else None)
    c2 = acad.get('cat2_marks') if acad else (target_user.get('cat2_marks') if target_user else None)
    c3 = acad.get('cat3_marks') if acad else (target_user.get('cat3_marks') if target_user else None)

    has_any_mark = c1 is not None or c2 is not None or c3 is not None or att is not None

    payload = {
        'student_id': target_id,
        'register_number': target_reg,
        'student_name': target_name,
        'name': target_name,
        'department': target_user.get('department') if target_user else (acad.get('department') if acad else None),
        'year': target_user.get('year') if target_user else (acad.get('year') if acad else None),
        'section': target_user.get('section') if target_user else (acad.get('section') if acad else None),
        'attendance_percentage': round(float(att), 1) if att is not None else None,
        'cat1_marks': round(float(c1), 1) if c1 is not None else None,
        'cat2_marks': round(float(c2), 1) if c2 is not None else None,
        'cat3_marks': round(float(c3), 1) if c3 is not None else None,
        'has_academic_data': has_academic or has_any_mark,
        'eligibility': eligibility,
        'last_updated': acad.get('updated_at') if acad else (target_user.get('last_academic_update') if target_user else None),
        'updated_by': acad.get('updated_by_name') if acad else None
    }

    return jsonify({
        'success': True,
        'academic': payload,
        **payload
    }), 200


def re_escape(s):
    import re
    return re.escape(str(s or ''))
