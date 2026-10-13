"""
OD Eligibility Calculation Service for SQL Server.

Business Rule: A student may use OD for at most 10% of their overall attendance.

Example:
  Overall attendance = 80%
  Allowed OD = 10% of 80% = 8.0% (of total working days)
  Total working days = 120 days
  Allowed OD days = 120 * 8% = 9.6 days
  If student already used OD for 4 days -> remaining = 5.6 days
"""
from typing import Any
from sqlalchemy import or_, func
from backend.config import Config
from backend.database.sql_server import session_scope
from backend.models.db_models import (
    StudentAcademicRecord,
    User,
    ODRequest,
    SystemSetting
)


def calculate_od_eligibility(student_id: str, requested_od_days: float = 0.0) -> dict:
    """
    Calculate a student's OD eligibility using latest academic records as single source of truth.

    Args:
        student_id:         User ID or Register Number of the student
        requested_od_days:  Number of OD days being requested now

    Returns dict with attendance, limits, remaining allowance, and eligibility decision.
    """
    clean_id = (student_id or '').strip()
    if not clean_id:
        return _not_found_result(clean_id)

    # 0. Load central system settings
    attendance_min_threshold = 75.0
    cgpa_high_threshold = 8.5
    limit_pct = float(getattr(Config, 'OD_ATTENDANCE_LIMIT_PERCENT', 10.0))

    try:
        with session_scope() as session:
            setting = session.query(SystemSetting).filter_by(id='SYSTEM_CONFIG').first()
            if setting and isinstance(setting.value, dict):
                val = setting.value
                attendance_min_threshold = float(val.get('attendance_threshold_percent', attendance_min_threshold))
                cgpa_high_threshold = float(val.get('cgpa_high_performer_threshold', cgpa_high_threshold))
                limit_pct = float(val.get('max_od_limit_percent', limit_pct))
    except Exception:
        pass

    total_classes = 120
    overall_pct = None
    cgpa = None
    target_uid = None
    target_reg = None

    # 1. Lookup student and academic record in SQL Server
    try:
        with session_scope() as session:
            # First find User
            user_obj = session.query(User).filter(
                or_(
                    func.lower(User.id) == clean_id.lower(),
                    func.lower(User.identifier) == clean_id.lower()
                )
            ).first()

            if user_obj:
                target_uid = user_obj.id
                target_reg = user_obj.identifier
                if user_obj.attendance_percentage is not None:
                    overall_pct = float(user_obj.attendance_percentage)
                if user_obj.cgpa is not None:
                    cgpa = float(user_obj.cgpa)

            # Query Academic Record (overrides/augments user record)
            acad_rec = session.query(StudentAcademicRecord).filter(
                or_(
                    func.lower(StudentAcademicRecord.student_id) == clean_id.lower(),
                    func.lower(StudentAcademicRecord.register_number) == clean_id.lower()
                )
            ).first()

            if acad_rec:
                if acad_rec.attendance_percentage is not None:
                    overall_pct = float(acad_rec.attendance_percentage)
                if acad_rec.total_working_days:
                    total_classes = int(acad_rec.total_working_days)
                if acad_rec.cgpa is not None:
                    cgpa = float(acad_rec.cgpa)
                if not target_uid and acad_rec.student_id:
                    target_uid = acad_rec.student_id
                if not target_reg and acad_rec.register_number:
                    target_reg = acad_rec.register_number

            # If user not found and no academic record
            if not user_obj and not acad_rec:
                return _not_found_result(clean_id)

            # 2. Calculate OD days already used
            approved_statuses = [
                'Pending', 'Mentor Approved', 'Class Incharge Approved',
                'HOD Approved', 'HOD Approved - Certificate Pending',
                'Certificate Submitted', 'Approved'
            ]

            od_query = session.query(ODRequest).filter(
                ODRequest.status.in_(approved_statuses)
            )

            id_filters = []
            if target_uid:
                id_filters.append(func.lower(ODRequest.student_id) == target_uid.lower())
            if target_reg:
                id_filters.append(func.lower(ODRequest.student_reg_no) == target_reg.lower())
            if not id_filters:
                id_filters.append(func.lower(ODRequest.student_id) == clean_id.lower())

            od_query = od_query.filter(or_(*id_filters))
            active_ods = od_query.all()

            od_used_days = 0.0
            for od in active_ods:
                try:
                    od_used_days += float(od.number_of_days or 1.0)
                except (ValueError, TypeError):
                    od_used_days += 1.0

    except Exception as e:
        print(f"[-] [OD Eligibility] Database lookup error: {e}")
        return _not_found_result(clean_id)

    # Fallback defaults if unspecified
    if overall_pct is None:
        overall_pct = 85.0
    if cgpa is None:
        cgpa = 8.6

    total_attended = int(total_classes * overall_pct / 100.0)
    od_used_percent = (od_used_days / total_classes * 100.0) if total_classes > 0 else 0.0

    # 4. Institutional Academic Rules
    has_high_cgpa = (cgpa >= cgpa_high_threshold)
    is_low_attendance = (overall_pct < attendance_min_threshold)

    max_od_allowed_percent = limit_pct * overall_pct / 100.0
    max_od_allowed_days = total_classes * max_od_allowed_percent / 100.0

    req_od_percent = (requested_od_days / total_classes * 100.0) if total_classes > 0 else 0.0
    remaining_od_days = max(0.0, max_od_allowed_days - od_used_days)
    remaining_od_percent = (remaining_od_days / total_classes * 100.0) if total_classes > 0 else 0.0

    eligible = True
    rejection_reason = None
    status_label = "Eligible"

    if is_low_attendance:
        eligible = False
        status_label = f"Attendance Below {int(attendance_min_threshold)}%"
        rejection_reason = f"Overall attendance ({overall_pct:.1f}%) is below mandatory {attendance_min_threshold:.1f}% institutional threshold."
    elif has_high_cgpa:
        eligible = True
        status_label = f"No Limit — CGPA Above {cgpa_high_threshold:.1f}"
        max_od_allowed_days = 999.0
        remaining_od_days = 999.0
    else:
        projected_used = od_used_days + requested_od_days
        if requested_od_days > 0 and projected_used > max_od_allowed_days:
            eligible = False
            status_label = "10% Limit Exceeded"
            rejection_reason = (
                f"OD request exceeds the permitted {limit_pct:.0f}% attendance allowance. "
                f"Maximum allowed: {max_od_allowed_days:.1f} days "
                f"({max_od_allowed_percent:.2f}% based on {overall_pct:.1f}% attendance across {total_classes} working days). "
                f"Already consumed: {od_used_days:.1f} days. "
                f"Requested: {requested_od_days:.1f} days. "
                f"Remaining allowance: {remaining_od_days:.1f} days."
            )
        elif requested_od_days == 0 and od_used_days >= max_od_allowed_days:
            eligible = False
            status_label = "10% Limit Exceeded"
        else:
            eligible = True
            status_label = "Eligible"

    return {
        'student_id': clean_id,
        'overall_attendance_percent': round(overall_pct, 2),
        'total_working_days': total_classes,
        'total_attended_days': total_attended,
        'od_used_days': round(od_used_days, 2),
        'od_used_percent': round(od_used_percent, 2),
        'max_od_allowed_percent': round(max_od_allowed_percent, 2),
        'max_od_allowed_days': round(max_od_allowed_days, 2),
        'requested_od_days': round(requested_od_days, 2),
        'requested_od_percent': round(req_od_percent, 2),
        'remaining_od_days': round(remaining_od_days, 2),
        'remaining_od_percent': round(remaining_od_percent, 2),
        'eligible': eligible,
        'rejection_reason': rejection_reason,
        'od_limit_percent': limit_pct,
        'cgpa': round(cgpa, 2),
        'eligibility_status_label': status_label,
        'status_label': status_label,
        'attendance_threshold': attendance_min_threshold,
        'cgpa_threshold': cgpa_high_threshold
    }


def _not_found_result(student_id: str) -> dict:
    return {
        'student_id': student_id,
        'overall_attendance_percent': 0.0,
        'total_working_days': 120,
        'total_attended_days': 0,
        'od_used_days': 0.0,
        'od_used_percent': 0.0,
        'max_od_allowed_percent': 0.0,
        'max_od_allowed_days': 0.0,
        'requested_od_days': 0.0,
        'requested_od_percent': 0.0,
        'remaining_od_days': 0.0,
        'remaining_od_percent': 0.0,
        'eligible': False,
        'rejection_reason': 'Student academic record not found.',
        'od_limit_percent': 10.0,
        'cgpa': 0.0,
        'eligibility_status_label': 'Not Eligible',
        'status_label': 'Not Eligible',
    }
