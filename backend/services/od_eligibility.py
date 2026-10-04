"""
OD Eligibility Calculation Service.

Business Rule: A student may use OD for at most 10% of their overall attendance.

Example:
  Overall attendance = 80%
  Allowed OD = 10% of 80% = 8.0% (of total working days)
  Total working days = 120 days
  Allowed OD days = 120 * 8% = 9.6 days
  If student already used OD for 4 days -> remaining = 5.6 days
"""
from datetime import datetime

try:
    from backend.config import Config
    from backend.database.mongodb import (
        academic_records_collection,
        users_collection,
        od_requests_collection
    )
except ImportError:
    from config import Config
    from database.mongodb import (
        academic_records_collection,
        users_collection,
        od_requests_collection
    )


def calculate_od_eligibility(student_id: str, requested_od_days: float = 0.0) -> dict:
    """
    Calculate a student's OD eligibility using latest academic records as single source of truth.

    Args:
        student_id:         User ID or Register Number of the student
        requested_od_days:  Number of OD days being requested now

    Returns dict:
        student_id
        overall_attendance_percent
        total_working_days
        total_attended_days
        od_used_days          – approved OD days already consumed
        od_used_percent       – od_used_days as % of total_working_days
        max_od_allowed_percent – OD_LIMIT (10%) × overall_attendance_percent / 100
        max_od_allowed_days
        requested_od_days
        requested_od_percent
        remaining_od_days
        remaining_od_percent
        eligible               – True / False
        rejection_reason       – set when eligible is False
        od_limit_percent       – 10.0
    """
    clean_id = (str(student_id) or '').strip()
    if not clean_id:
        return _not_found_result(clean_id)

    limit_pct = float(getattr(Config, 'OD_ATTENDANCE_LIMIT_PERCENT', 10.0))
    total_classes = 120

    # 1. First, attempt lookup from MongoDB (primary storage)
    acad_col = academic_records_collection()
    user_col = users_collection()
    od_col = od_requests_collection()

    student_user = None
    overall_pct = None

    if acad_col is not None:
        acad_doc = acad_col.find_one({
            "$or": [
                {"student_id": clean_id},
                {"register_number": {"$regex": f"^{clean_id}$", "$options": "i"}}
            ]
        })
        if acad_doc and acad_doc.get('attendance_percentage') is not None:
            overall_pct = float(acad_doc['attendance_percentage'])
            total_classes = int(acad_doc.get('total_working_days', 120))
            if not student_user and acad_doc.get('student_id'):
                student_user = user_col.find_one({"id": acad_doc['student_id']}) if user_col is not None else None

    if overall_pct is None and user_col is not None:
        student_user = user_col.find_one({
            "$or": [
                {"id": clean_id},
                {"identifier": {"$regex": f"^{clean_id}$", "$options": "i"}}
            ]
        })
        if student_user and student_user.get('attendance_percentage') is not None:
            overall_pct = float(student_user['attendance_percentage'])

    # 2. Fallback to PostgreSQL/SQLite if MongoDB had no record
    if overall_pct is None:
        try:
            from backend.database.postgresql import get_db_session
            from backend.models.db_models import Student, Attendance
            session = get_db_session()
            st = session.query(Student).filter(
                (Student.user_id == clean_id) | (Student.register_number == clean_id)
            ).first()
            if st:
                overall_pct = float(st.overall_attendance or 75.0)
                total_classes = int(st.total_working_days or 120)
            session.close()
        except Exception:
            pass

    # Default fallback if student exists or standard default
    if overall_pct is None:
        overall_pct = 85.0

    total_attended = int(total_classes * overall_pct / 100.0)

    # 3. Calculate OD days already used (Pending, Mentor Approved, Class Incharge Approved, HOD Approved, Approved)
    od_used_days = 0.0
    approved_statuses = [
        'Pending', 'Mentor Approved', 'Class Incharge Approved',
        'HOD Approved', 'Approved'
    ]

    target_uid = (student_user.get('id') if student_user else None) or clean_id
    target_reg = (student_user.get('identifier') if student_user else None) or clean_id

    if od_col is not None:
        active_ods = list(od_col.find({
            "$and": [
                {"$or": [
                    {"student_id": target_uid},
                    {"student_reg_no": {"$regex": f"^{target_reg}$", "$options": "i"}},
                    {"studentRegisterNo": {"$regex": f"^{target_reg}$", "$options": "i"}}
                ]},
                {"status": {"$in": approved_statuses}}
            ]
        }))
        for od in active_ods:
            days = od.get('number_of_days') or od.get('numberOfDays') or 1.0
            try:
                od_used_days += float(days)
            except (ValueError, TypeError):
                od_used_days += 1.0

    od_used_percent = (od_used_days / total_classes * 100.0) if total_classes > 0 else 0.0

    # 4. 10% Academic OD Rule Calculation
    max_od_allowed_percent = limit_pct * overall_pct / 100.0
    max_od_allowed_days = total_classes * max_od_allowed_percent / 100.0

    req_od_percent = (requested_od_days / total_classes * 100.0) if total_classes > 0 else 0.0
    remaining_od_days = max(0.0, max_od_allowed_days - od_used_days)
    remaining_od_percent = (remaining_od_days / total_classes * 100.0) if total_classes > 0 else 0.0

    eligible = True
    rejection_reason = None

    if requested_od_days > 0:
        projected_used = od_used_days + requested_od_days
        if projected_used > max_od_allowed_days:
            eligible = False
            rejection_reason = (
                f"OD request exceeds the permitted {limit_pct:.0f}% attendance allowance. "
                f"Maximum allowed: {max_od_allowed_days:.1f} days "
                f"({max_od_allowed_percent:.2f}% based on {overall_pct:.1f}% attendance across {total_classes} working days). "
                f"Already consumed: {od_used_days:.1f} days. "
                f"Requested: {requested_od_days:.1f} days. "
                f"Remaining allowance: {remaining_od_days:.1f} days."
            )

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
    }


def _not_found_result(student_id):
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
    }
