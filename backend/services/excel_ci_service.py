import io
import re
import csv
import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from sqlalchemy import or_
from backend.database.sql_server import session_scope
from backend.models.db_models import (
    User,
    StudentAcademicRecord,
    StudentImportHistory,
    AttendanceUploadHistory,
    MarksUploadHistory
)

STUDENT_COLUMN_ALIASES = {
    'register_number': [
        'register number', 'reg no', 'register no', 'reg_no', 'registerno',
        'roll no', 'rollno', 'student id', 'identifier', 'reg number', 'register'
    ],
    'student_name': [
        'student name', 'name', 'student_name', 'candidate name', 'student', 'full name'
    ],
    'email': [
        'email', 'official email', 'college email', 'email address', 'mail'
    ],
    'department': [
        'department', 'dept', 'branch'
    ],
    'class_section': [
        'class / section', 'class/section', 'class section', 'section', 'class'
    ],
    'year': [
        'year', 'academic year', 'curr year', 'batch year'
    ],
    'phone': [
        'phone number', 'phone', 'contact number', 'mobile', 'mobile number', 'contact'
    ],
    'cgpa': [
        'cgpa', 'cumulative gpa', 'gpa'
    ],
    'attendance': [
        'attendance percentage', 'attendance %', 'attendance', 'att %',
        'overall attendance', 'attendance_percentage', 'attendance percent'
    ],
    'password': [
        'initial password', 'password', 'default password'
    ]
}

ATTENDANCE_COLUMN_ALIASES = {
    'register_number': [
        'register number', 'reg no', 'register no', 'reg_no', 'registerno',
        'roll no', 'rollno', 'student id', 'identifier', 'reg number', 'register'
    ],
    'student_name': [
        'student name', 'name', 'student_name', 'candidate name', 'student'
    ],
    'attendance': [
        'attendance percentage', 'attendance %', 'attendance', 'att %',
        'overall attendance', 'attendance_percentage', 'attendance percent', 'attendance ( % )'
    ],
    'total_classes': [
        'total classes', 'classes total', 'total working days', 'total sessions', 'total days'
    ],
    'attended_classes': [
        'classes attended', 'attended classes', 'attended', 'classes present', 'present'
    ],
    'absent_classes': [
        'classes absent', 'absent classes', 'absent', 'classes missed'
    ],
    'week_date': [
        'attendance date/week', 'attendance week', 'week', 'date', 'week date', 'period'
    ]
}

MARKS_COLUMN_ALIASES = {
    'register_number': [
        'register number', 'reg no', 'register no', 'reg_no', 'registerno',
        'roll no', 'rollno', 'student id', 'identifier', 'reg number', 'register'
    ],
    'student_name': [
        'student name', 'name', 'student_name', 'candidate name', 'student'
    ],
    'cat1': [
        'cat 1', 'cat1', 'cat 1 marks', 'cat 1 mark', 'cat1 marks', 'cat-1', 'cat 1 score'
    ],
    'cat2': [
        'cat 2', 'cat2', 'cat 2 marks', 'cat 2 mark', 'cat2 marks', 'cat-2', 'cat 2 score'
    ],
    'cat3': [
        'cat 3', 'cat3', 'cat 3 marks', 'cat 3 mark', 'cat3 marks', 'cat-3', 'cat 3 score'
    ],
    'assignment': [
        'assignment / internal marks', 'assignment', 'internal marks', 'internals', 'assignment marks'
    ]
}

def _match_alias(header_val, alias_map):
    if not header_val:
        return None
    cleaned = str(header_val).strip().lower()
    cleaned = re.sub(r'[\s_\-]+', ' ', cleaned)
    for canon, aliases in alias_map.items():
        for alias in aliases:
            if cleaned == alias or cleaned.startswith(alias):
                return canon
    return None

def _style_header(ws: Worksheet, headers: list, bg_color="0D9488"):
    header_fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

def _style_data_rows(ws: Worksheet, row_count: int, col_count: int):
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    for row in ws.iter_rows(min_row=2, max_row=row_count + 1, min_col=1, max_col=col_count):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")

def generate_student_account_template() -> io.BytesIO:
    """Generate Excel template for bulk student account creation."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Accounts"

    headers = [
        "Register Number", "Student Name", "Email", "Department",
        "Class / Section", "Year", "Phone Number", "CGPA",
        "Attendance Percentage", "Initial Password"
    ]
    ws.append(headers)
    _style_header(ws, headers, bg_color="0D9488")

    sample_rows = [
        ["23CSD004", "Ananya Sharma", "ananya.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "+91 98765 11223", 8.85, 89.5, "password123"],
        ["23CSD005", "Rohan Verma", "rohan.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "+91 98765 22334", 8.42, 82.0, "password123"],
        ["23CSD006", "Siddharth Menon", "siddharth.23csd@rajalakshmi.edu.in", "Computer Science and Design", "B", "III Year", "+91 98765 33445", 7.95, 78.5, "password123"]
    ]
    for r in sample_rows:
        ws.append(r)
    _style_data_rows(ws, len(sample_rows), len(headers))

    widths = {"A": 20, "B": 24, "C": 34, "D": 30, "E": 16, "F": 14, "G": 20, "H": 12, "I": 24, "J": 18}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

def generate_attendance_template() -> io.BytesIO:
    """Generate Excel template for weekly attendance upload."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Weekly Attendance"

    headers = [
        "Register Number", "Student Name", "Attendance Percentage",
        "Total Classes", "Classes Attended", "Classes Absent", "Attendance Date/Week"
    ]
    ws.append(headers)
    _style_header(ws, headers, bg_color="2563EB")

    today_str = datetime.now().strftime('%Y-%m-%d')
    sample_rows = [
        ["23CSD001", "Naveen", 88.5, 120, 106, 14, f"Week 5 ({today_str})"],
        ["23CSD002", "Priya S", 92.0, 120, 110, 10, f"Week 5 ({today_str})"],
        ["23CSD003", "Karthik R", 74.5, 120, 89, 31, f"Week 5 ({today_str})"]
    ]
    for r in sample_rows:
        ws.append(r)
    _style_data_rows(ws, len(sample_rows), len(headers))

    widths = {"A": 20, "B": 24, "C": 24, "D": 16, "E": 18, "F": 16, "G": 26}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

def generate_marks_template() -> io.BytesIO:
    """Generate Excel template for student CAT marks upload."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Marks"

    headers = [
        "Register Number", "Student Name", "CAT 1", "CAT 2", "CAT 3", "Assignment / Internal Marks"
    ]
    ws.append(headers)
    _style_header(ws, headers, bg_color="7C3AED")

    sample_rows = [
        ["23CSD001", "Naveen", 86.0, 91.0, 88.0, 48.0],
        ["23CSD002", "Priya S", 94.0, 96.0, 92.0, 50.0],
        ["23CSD003", "Karthik R", 68.0, 71.0, 74.0, 39.0]
    ]
    for r in sample_rows:
        ws.append(r)
    _style_data_rows(ws, len(sample_rows), len(headers))

    widths = {"A": 20, "B": 24, "C": 14, "D": 14, "E": 14, "F": 28}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

def parse_tabular_file(file_stream, filename: str):
    """
    Parse Excel (.xlsx, .xls) or CSV file into a list of row tuples.
    Returns (rows: list of lists, error: str).
    """
    ext = (filename or '').rsplit('.', 1)[-1].lower() if '.' in (filename or '') else ''
    if ext == 'csv':
        try:
            content = file_stream.read()
            if isinstance(content, bytes):
                try:
                    text = content.decode('utf-8-sig')
                except UnicodeDecodeError:
                    text = content.decode('latin-1')
            else:
                text = str(content)
            reader = csv.reader(io.StringIO(text))
            rows = [list(r) for r in reader if any(cell.strip() for cell in r if cell is not None)]
            return rows, None
        except Exception as e:
            return None, f"Failed to parse CSV file: {str(e)}"
    elif ext in ['xlsx', 'xls']:
        try:
            wb = openpyxl.load_workbook(file_stream, data_only=True)
            ws = wb.active
            if ws is None or ws.max_row < 1:
                return None, "Excel spreadsheet is empty."
            rows = []
            for row in ws.iter_rows(values_only=True):
                if any(row):
                    rows.append(list(row))
            return rows, None
        except Exception as e:
            return None, f"Failed to parse Excel file: {str(e)}"
    else:
        return None, f"Unsupported file format '.{ext}'. Supported formats are .xlsx, .xls, and .csv."

# ─────────────────────────────────────────────────────────────────────────────
# 1. PREVIEW & IMPORT STUDENTS
# ─────────────────────────────────────────────────────────────────────────────

def validate_and_preview_students(raw_rows, ci_user):
    """
    Validate student creation rows from file.
    Detects:
    - Missing required fields (register number, name, email)
    - Duplicate register numbers within file
    - Duplicate emails within file
    - Already existing register numbers / emails in database
    - Format errors in email, CGPA (0-10), attendance (0-100)
    Returns preview summary and detailed rows.
    """
    if not raw_rows or len(raw_rows) < 2:
        return {'success': False, 'error': 'File has no data rows. Must contain header row and at least one student row.'}

    headers = [str(c or '').strip() for c in raw_rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        canon = _match_alias(h, STUDENT_COLUMN_ALIASES)
        if canon and canon not in col_map:
            col_map[canon] = idx

    if 'register_number' not in col_map:
        return {'success': False, 'error': "Required column 'Register Number' (or Roll No / Student ID) not found in file."}
    if 'student_name' not in col_map:
        return {'success': False, 'error': "Required column 'Student Name' (or Name) not found in file."}
    if 'email' not in col_map:
        return {'success': False, 'error': "Required column 'Email' not found in file."}

    existing_regs = set()
    existing_emails = set()
    try:
        with session_scope() as session:
            for u in session.query(User).all():
                if u.identifier:
                    existing_regs.add(str(u.identifier).strip().upper())
                if u.email:
                    existing_emails.add(str(u.email).strip().lower())
                if u.id:
                    existing_regs.add(str(u.id).strip().upper())
    except Exception as e:
        print(f"[-] [excel_ci_service] Error querying existing users: {e}")

    file_regs_seen = {}
    file_emails_seen = {}

    preview_rows = []
    total_records = 0
    valid_count = 0
    already_existing_count = 0
    duplicate_count = 0
    invalid_count = 0

    ci_dept = (ci_user.get('department') or 'Computer Science and Design').strip()
    ci_sec = (ci_user.get('section') or 'A').strip()
    ci_year = (ci_user.get('year') or 'III Year').strip()

    for row_idx, row in enumerate(raw_rows[1:], start=2):
        if not any(row):
            continue
        total_records += 1

        def _val(canon_key, default=''):
            idx = col_map.get(canon_key)
            if idx is not None and idx < len(row):
                v = row[idx]
                return str(v).strip() if v is not None else default
            return default

        raw_reg = _val('register_number')
        raw_name = _val('student_name')
        raw_email = _val('email')
        raw_dept = _val('department', ci_dept) or ci_dept
        raw_sec = _val('class_section', ci_sec) or ci_sec
        raw_year = _val('year', ci_year) or ci_year
        raw_phone = _val('phone', '')
        raw_cgpa = _val('cgpa', '0.0')
        raw_att = _val('attendance', '85.0')
        raw_pwd = _val('password', 'password123') or 'password123'

        clean_reg = raw_reg.strip().upper()
        clean_email = raw_email.strip().lower()

        status = 'valid'
        reason = ''

        # 1. Validate required fields
        if not clean_reg:
            status = 'invalid'
            reason = 'Register Number is missing'
        elif not raw_name:
            status = 'invalid'
            reason = 'Student Name is missing'
        elif not clean_email:
            status = 'invalid'
            reason = 'Email is missing'
        elif '@' not in clean_email or '.' not in clean_email:
            status = 'invalid'
            reason = f"Invalid email format: '{raw_email}'"

        # 2. Validate numeric fields
        parsed_cgpa = 0.0
        parsed_att = 85.0
        if status == 'valid':
            try:
                parsed_cgpa = float(raw_cgpa) if raw_cgpa else 0.0
                if not (0.0 <= parsed_cgpa <= 10.0):
                    status = 'invalid'
                    reason = f"CGPA must be between 0.0 and 10.0 (got {raw_cgpa})"
            except ValueError:
                status = 'invalid'
                reason = f"CGPA must be numeric (got '{raw_cgpa}')"

        if status == 'valid':
            try:
                # Clean any '%' sign
                clean_att = raw_att.replace('%', '').strip()
                parsed_att = float(clean_att) if clean_att else 85.0
                if not (0.0 <= parsed_att <= 100.0):
                    status = 'invalid'
                    reason = f"Attendance must be between 0 and 100% (got {raw_att})"
            except ValueError:
                status = 'invalid'
                reason = f"Attendance percentage must be numeric (got '{raw_att}')"

        # 3. Check duplicate in file
        if status == 'valid':
            if clean_reg in file_regs_seen:
                status = 'duplicate'
                reason = f"Duplicate Register Number '{clean_reg}' in file (matches Row {file_regs_seen[clean_reg]})"
            elif clean_email in file_emails_seen:
                status = 'duplicate'
                reason = f"Duplicate Email '{clean_email}' in file (matches Row {file_emails_seen[clean_email]})"
            else:
                file_regs_seen[clean_reg] = row_idx
                file_emails_seen[clean_email] = row_idx

        # 4. Check already existing in database
        if status == 'valid':
            if clean_reg in existing_regs:
                status = 'existing'
                reason = f"Student already exists in database with Register Number '{clean_reg}'"
            elif clean_email in existing_emails:
                status = 'existing'
                reason = f"Student already exists in database with Email '{clean_email}'"

        if status == 'valid':
            valid_count += 1
        elif status == 'existing':
            already_existing_count += 1
        elif status == 'duplicate':
            duplicate_count += 1
        elif status == 'invalid':
            invalid_count += 1

        preview_rows.append({
            'row_number': row_idx,
            'register_number': clean_reg,
            'student_name': raw_name,
            'email': clean_email,
            'department': raw_dept,
            'section': raw_sec,
            'year': raw_year,
            'phone': raw_phone,
            'cgpa': parsed_cgpa,
            'attendance': parsed_att,
            'password': raw_pwd,
            'status': status,
            'reason': reason
        })

    return {
        'success': True,
        'summary': {
            'total_records': total_records,
            'valid_records': valid_count,
            'already_existing': already_existing_count,
            'duplicate_records': duplicate_count,
            'invalid_records': invalid_count,
            'ready_to_import': valid_count
        },
        'rows': preview_rows
    }

def import_students_confirmed(preview_rows_to_insert, ci_user, file_name):
    """
    Import validated, non-duplicate students into MongoDB.
    Inserts into:
    - users_collection: role='Student', identifier=register_number, password_hash
    - academic_records_collection: initial academic document
    - student_imports_history_collection: audit entry
    """
    now_dt = datetime.now()
    now_str = now_dt.strftime('%Y-%m-%d %H:%M:%S')
    added_students = []
    failed_rows = []
    history_id = f"IMPH_{now_dt.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"

    try:
        with session_scope() as session:
            for item in preview_rows_to_insert:
                reg_no = item.get('register_number', '').strip().upper()
                name = item.get('student_name', '').strip()
                email = item.get('email', '').strip().lower()
                dept = item.get('department') or ci_user.get('department') or 'Computer Science and Design'
                sec = item.get('section') or ci_user.get('section') or 'A'
                year = item.get('year') or ci_user.get('year') or 'III Year'
                phone = item.get('phone', '')
                cgpa = float(item.get('cgpa', 0.0) or 0.0)
                att = float(item.get('attendance', 85.0) or 85.0)
                raw_pwd = item.get('password') or 'password123'

                if not reg_no or not email or not name:
                    failed_rows.append({'register_number': reg_no, 'name': name, 'reason': 'Missing required fields'})
                    continue

                exists = session.query(User).filter(
                    or_(User.identifier == reg_no, User.email == email, User.id == reg_no)
                ).first()
                if exists:
                    failed_rows.append({'register_number': reg_no, 'name': name, 'reason': 'Already exists in database'})
                    continue

                user_id = f"STUD_{uuid.uuid4().hex[:8].upper()}"
                pwd_hash = generate_password_hash(raw_pwd)

                new_user = User(
                    id=user_id,
                    identifier=reg_no,
                    name=name,
                    email=email,
                    role='Student',
                    sub_role='Student',
                    department=dept,
                    year=year,
                    section=sec,
                    designation='Student',
                    phone=phone,
                    password_hash=pwd_hash,
                    avatar=f"https://api.dicebear.com/7.x/initials/svg?seed={name}&backgroundColor=0d9488",
                    email_verified=True,
                    account_status='ACTIVE',
                    cgpa=cgpa,
                    attendance_percentage=att,
                    created_at=now_dt,
                    updated_at=now_dt
                )
                session.add(new_user)

                acad_doc = StudentAcademicRecord(
                    id=f"ACAD_{user_id}",
                    student_id=user_id,
                    register_number=reg_no,
                    student_name=name,
                    cat1_marks=None,
                    cat2_marks=None,
                    cat3_marks=None,
                    attendance_percentage=att,
                    cgpa=cgpa,
                    total_working_days=120,
                    updated_by=ci_user.get('id', 'CLASS_INCHARGE'),
                    updated_by_name=ci_user.get('name', 'Class Incharge'),
                    created_at=now_dt,
                    updated_at=now_dt
                )
                session.add(acad_doc)

                added_students.append({
                    'id': user_id,
                    'register_number': reg_no,
                    'name': name,
                    'email': email,
                    'department': dept,
                    'section': sec,
                    'year': year,
                    'cgpa': cgpa,
                    'attendance': att
                })

            hist_record = StudentImportHistory(
                id=history_id,
                imported_by_id=ci_user.get('id'),
                imported_by_name=ci_user.get('name'),
                file_name=file_name or 'students_import.xlsx',
                total_records=len(preview_rows_to_insert),
                successful_records=len(added_students),
                failed_records=len(failed_rows),
                status='Completed',
                created_at=now_dt
            )
            session.add(hist_record)
    except Exception as e:
        return {'success': False, 'error': f"Database transaction failed: {str(e)}"}

    return {
        'success': True,
        'message': f"Successfully imported {len(added_students)} new student accounts.",
        'imported_count': len(added_students),
        'failed_count': len(failed_rows),
        'history_id': history_id,
        'added_students': added_students,
        'failed_rows': failed_rows
    }

# ─────────────────────────────────────────────────────────────────────────────
# 2. PREVIEW & UPDATE WEEKLY ATTENDANCE
# ─────────────────────────────────────────────────────────────────────────────

def validate_and_preview_attendance(raw_rows, ci_user):
    """
    Validate weekly attendance rows from file.
    Matches student using Register Number as primary key.
    Detects unmatched students, invalid percentage (0-100), missing keys.
    Returns preview summary with previous and new attendance.
    """
    if not raw_rows or len(raw_rows) < 2:
        return {'success': False, 'error': 'File has no data rows. Must contain header row and at least one attendance row.'}

    headers = [str(c or '').strip() for c in raw_rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        canon = _match_alias(h, ATTENDANCE_COLUMN_ALIASES)
        if canon and canon not in col_map:
            col_map[canon] = idx

    if 'register_number' not in col_map:
        return {'success': False, 'error': "Required column 'Register Number' (or Roll No / Student ID) not found."}
    if 'attendance' not in col_map:
        return {'success': False, 'error': "Required column 'Attendance Percentage' (or Attendance %) not found."}

    students_by_reg = {}
    try:
        with session_scope() as session:
            for s in session.query(User).filter_by(role='Student').all():
                reg = (s.identifier or s.id or '').strip().upper()
                if reg:
                    students_by_reg[reg] = {
                        'id': s.id,
                        'identifier': s.identifier,
                        'name': s.name,
                        'attendance_percentage': s.attendance_percentage,
                        'department': s.department,
                        'section': s.section
                    }
    except Exception as e:
        print(f"[-] [excel_ci_service] Error loading students for attendance: {e}")

    preview_rows = []
    total_records = 0
    matched_count = 0
    unmatched_count = 0
    invalid_count = 0

    seen_in_file = set()

    for row_idx, row in enumerate(raw_rows[1:], start=2):
        if not any(row):
            continue
        total_records += 1

        def _val(canon_key, default=''):
            idx = col_map.get(canon_key)
            if idx is not None and idx < len(row):
                v = row[idx]
                return str(v).strip() if v is not None else default
            return default

        raw_reg = _val('register_number')
        raw_name = _val('student_name')
        raw_att = _val('attendance')
        raw_total_cls = _val('total_classes')
        raw_attended = _val('attended_classes')
        raw_absent = _val('absent_classes')
        raw_week = _val('week_date')

        clean_reg = raw_reg.strip().upper()

        status = 'matched'
        reason = ''

        if not clean_reg:
            status = 'invalid'
            reason = 'Register Number missing'
        elif clean_reg in seen_in_file:
            status = 'invalid'
            reason = f"Duplicate Register Number '{clean_reg}' in file"
        else:
            seen_in_file.add(clean_reg)

        # Validate attendance number
        parsed_att = 0.0
        if status != 'invalid':
            try:
                clean_att = raw_att.replace('%', '').strip()
                if not clean_att:
                    status = 'invalid'
                    reason = 'Attendance percentage value missing'
                else:
                    parsed_att = float(clean_att)
                    if not (0.0 <= parsed_att <= 100.0):
                        status = 'invalid'
                        reason = f"Attendance must be between 0 and 100% (got {raw_att})"
            except ValueError:
                status = 'invalid'
                reason = f"Attendance must be numeric (got '{raw_att}')"

        # Match in database
        student_doc = students_by_reg.get(clean_reg) if clean_reg else None
        prev_att = 0.0
        student_id = None
        student_name = raw_name

        if status != 'invalid':
            if not student_doc:
                status = 'unmatched'
                reason = f"Student with Register Number '{clean_reg}' not found in database"
            else:
                student_id = student_doc.get('id')
                student_name = student_doc.get('name') or raw_name
                prev_att = float(student_doc.get('attendance_percentage') or 0.0)

        if status == 'matched':
            matched_count += 1
        elif status == 'unmatched':
            unmatched_count += 1
        elif status == 'invalid':
            invalid_count += 1

        preview_rows.append({
            'row_number': row_idx,
            'register_number': clean_reg,
            'student_name': student_name,
            'student_id': student_id,
            'previous_attendance': prev_att,
            'new_attendance': parsed_att if status != 'invalid' else None,
            'total_classes': raw_total_cls,
            'attended_classes': raw_attended,
            'absent_classes': raw_absent,
            'week_date': raw_week,
            'status': status,
            'reason': reason
        })

    return {
        'success': True,
        'summary': {
            'total_records': total_records,
            'matched_count': matched_count,
            'unmatched_count': unmatched_count,
            'invalid_count': invalid_count,
            'ready_to_update': matched_count
        },
        'rows': preview_rows
    }

def update_attendance_confirmed(valid_rows, ci_user, file_name, week_date=""):
    """
    Commit weekly attendance updates to:
    - users_collection
    - academic_records_collection
    - attendance_upload_history_collection (records previous and new attendance)
    """
    now_dt = datetime.now()
    now_str = now_dt.strftime('%Y-%m-%d %H:%M:%S')
    updated_records = []
    unmatched_or_failed = []
    history_id = f"ATTH_{now_dt.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"

    try:
        with session_scope() as session:
            for item in valid_rows:
                reg_no = item.get('register_number', '').strip().upper()
                new_att = item.get('new_attendance')
                prev_att = item.get('previous_attendance', 0.0)
                st_name = item.get('student_name', '')
                st_id = item.get('student_id')

                if not reg_no or new_att is None:
                    unmatched_or_failed.append({'register_number': reg_no, 'student_name': st_name, 'reason': 'Invalid data'})
                    continue

                try:
                    att_float = round(float(new_att), 1)
                except ValueError:
                    unmatched_or_failed.append({'register_number': reg_no, 'student_name': st_name, 'reason': 'Invalid numeric attendance'})
                    continue

                user = session.query(User).filter(
                    or_(User.identifier == reg_no, User.id == (st_id or reg_no))
                ).first()

                if not user:
                    unmatched_or_failed.append({'register_number': reg_no, 'student_name': st_name, 'reason': 'Student not found in database'})
                    continue

                user.attendance_percentage = att_float
                user.last_academic_update = now_dt
                user.updated_at = now_dt

                acad = session.query(StudentAcademicRecord).filter_by(register_number=reg_no).first()
                if acad:
                    acad.attendance_percentage = att_float
                    acad.student_name = st_name or acad.student_name
                    if item.get('total_classes'):
                        try:
                            acad.total_working_days = int(item['total_classes'])
                        except Exception:
                            pass
                    acad.updated_by = ci_user.get('id', 'CLASS_INCHARGE')
                    acad.updated_by_name = ci_user.get('name', 'Class Incharge')
                    acad.updated_at = now_dt
                else:
                    new_acad = StudentAcademicRecord(
                        id=f"ACAD_{user.id}",
                        student_id=user.id,
                        register_number=reg_no,
                        student_name=st_name,
                        attendance_percentage=att_float,
                        total_working_days=int(item.get('total_classes', 120) or 120),
                        updated_by=ci_user.get('id', 'CLASS_INCHARGE'),
                        updated_by_name=ci_user.get('name', 'Class Incharge'),
                        created_at=now_dt,
                        updated_at=now_dt
                    )
                    session.add(new_acad)

                updated_records.append({
                    'register_number': reg_no,
                    'student_name': st_name,
                    'previous_attendance': prev_att,
                    'new_attendance': att_float,
                    'status': 'Updated'
                })

            hist_record = AttendanceUploadHistory(
                id=history_id,
                uploaded_by_id=ci_user.get('id'),
                uploaded_by_name=ci_user.get('name'),
                file_name=file_name or 'weekly_attendance.xlsx',
                total_records=len(valid_rows),
                successful_records=len(updated_records),
                failed_records=len(unmatched_or_failed),
                status='Completed',
                created_at=now_dt
            )
            session.add(hist_record)
    except Exception as e:
        return {'success': False, 'error': f"Database transaction failed: {str(e)}"}

    return {
        'success': True,
        'message': f"Weekly attendance updated successfully for {len(updated_records)} students.",
        'updated_count': len(updated_records),
        'failed_count': len(unmatched_or_failed),
        'history_id': history_id,
        'updated_records': updated_records,
        'failed_records': unmatched_or_failed
    }

# ─────────────────────────────────────────────────────────────────────────────
# 3. PREVIEW & UPDATE STUDENT MARKS
# ─────────────────────────────────────────────────────────────────────────────

def validate_and_preview_marks(raw_rows, ci_user):
    """
    Validate student marks rows from file.
    Matches student using Register Number as primary key.
    Extracts CAT 1, CAT 2, CAT 3, Assignment / Internal marks.
    Returns preview summary with previous and new marks.
    """
    if not raw_rows or len(raw_rows) < 2:
        return {'success': False, 'error': 'File has no data rows. Must contain header row and at least one marks row.'}

    headers = [str(c or '').strip() for c in raw_rows[0]]
    col_map = {}
    for idx, h in enumerate(headers):
        canon = _match_alias(h, MARKS_COLUMN_ALIASES)
        if canon and canon not in col_map:
            col_map[canon] = idx

    if 'register_number' not in col_map:
        return {'success': False, 'error': "Required column 'Register Number' (or Roll No / Student ID) not found."}

    has_mark_col = any(k in col_map for k in ['cat1', 'cat2', 'cat3', 'assignment'])
    if not has_mark_col:
        return {'success': False, 'error': "No marks columns found. Include at least 'CAT 1', 'CAT 2', 'CAT 3' or 'Assignment'."}

    students_by_reg = {}
    try:
        with session_scope() as session:
            for s in session.query(User).filter_by(role='Student').all():
                reg = (s.identifier or s.id or '').strip().upper()
                if reg:
                    students_by_reg[reg] = {
                        'id': s.id,
                        'name': s.name,
                        'cat1_marks': s.cat1_marks,
                        'cat2_marks': s.cat2_marks,
                        'cat3_marks': s.cat3_marks,
                    }
    except Exception as e:
        print(f"[-] [excel_ci_service] Error loading students for marks: {e}")

    preview_rows = []
    total_records = 0
    matched_count = 0
    unmatched_count = 0
    invalid_count = 0

    seen_in_file = set()

    for row_idx, row in enumerate(raw_rows[1:], start=2):
        if not any(row):
            continue
        total_records += 1

        def _val(canon_key, default=''):
            idx = col_map.get(canon_key)
            if idx is not None and idx < len(row):
                v = row[idx]
                return str(v).strip() if v is not None else default
            return default

        raw_reg = _val('register_number')
        raw_name = _val('student_name')
        raw_c1 = _val('cat1')
        raw_c2 = _val('cat2')
        raw_c3 = _val('cat3')
        raw_asgn = _val('assignment')

        clean_reg = raw_reg.strip().upper()

        status = 'matched'
        reason = ''

        if not clean_reg:
            status = 'invalid'
            reason = 'Register Number missing'
        elif clean_reg in seen_in_file:
            status = 'invalid'
            reason = f"Duplicate Register Number '{clean_reg}' in file"
        else:
            seen_in_file.add(clean_reg)

        def _parse_mark(v):
            if v is None or str(v).strip() == '' or str(v).strip() == '-':
                return None, None
            try:
                val = float(str(v).strip())
                if not (0.0 <= val <= 100.0):
                    return None, f"Mark must be between 0 and 100 (got {v})"
                return round(val, 1), None
            except ValueError:
                return None, f"Mark must be numeric (got '{v}')"

        p_c1, err1 = _parse_mark(raw_c1)
        p_c2, err2 = _parse_mark(raw_c2)
        p_c3, err3 = _parse_mark(raw_c3)
        p_asgn, err_asgn = _parse_mark(raw_asgn)

        if status != 'invalid':
            first_err = err1 or err2 or err3 or err_asgn
            if first_err:
                status = 'invalid'
                reason = first_err

        student_doc = students_by_reg.get(clean_reg) if clean_reg else None
        student_id = None
        student_name = raw_name
        prev_marks = {'cat1': None, 'cat2': None, 'cat3': None, 'assignment': None}

        if status != 'invalid':
            if not student_doc:
                status = 'unmatched'
                reason = f"Student with Register Number '{clean_reg}' not found in database"
            else:
                student_id = student_doc.get('id')
                student_name = student_doc.get('name') or raw_name
                prev_marks['cat1'] = student_doc.get('cat1_marks')
                prev_marks['cat2'] = student_doc.get('cat2_marks')
                prev_marks['cat3'] = student_doc.get('cat3_marks')
                prev_marks['assignment'] = student_doc.get('assignment_marks')

        if status == 'matched':
            matched_count += 1
        elif status == 'unmatched':
            unmatched_count += 1
        elif status == 'invalid':
            invalid_count += 1

        preview_rows.append({
            'row_number': row_idx,
            'register_number': clean_reg,
            'student_name': student_name,
            'student_id': student_id,
            'previous_marks': prev_marks,
            'new_marks': {
                'cat1': p_c1,
                'cat2': p_c2,
                'cat3': p_c3,
                'assignment': p_asgn
            },
            'status': status,
            'reason': reason
        })

    return {
        'success': True,
        'summary': {
            'total_records': total_records,
            'matched_count': matched_count,
            'unmatched_count': unmatched_count,
            'invalid_count': invalid_count,
            'ready_to_update': matched_count
        },
        'rows': preview_rows
    }

def update_marks_confirmed(valid_rows, ci_user, file_name):
    """
    Commit student marks updates to:
    - users_collection
    - academic_records_collection
    - marks_upload_history_collection
    """
    now_dt = datetime.now()
    now_str = now_dt.strftime('%Y-%m-%d %H:%M:%S')
    updated_records = []
    unmatched_or_failed = []
    history_id = f"MRKH_{now_dt.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"

    try:
        with session_scope() as session:
            for item in valid_rows:
                reg_no = item.get('register_number', '').strip().upper()
                new_marks = item.get('new_marks') or {}
                st_name = item.get('student_name', '')
                st_id = item.get('student_id')

                if not reg_no or not new_marks:
                    unmatched_or_failed.append({'register_number': reg_no, 'student_name': st_name, 'reason': 'Invalid data'})
                    continue

                c1 = new_marks.get('cat1')
                c2 = new_marks.get('cat2')
                c3 = new_marks.get('cat3')

                user = session.query(User).filter(
                    or_(User.identifier == reg_no, User.id == (st_id or reg_no))
                ).first()

                if not user:
                    unmatched_or_failed.append({'register_number': reg_no, 'student_name': st_name, 'reason': 'Student not found in database'})
                    continue

                if c1 is not None:
                    user.cat1_marks = c1
                if c2 is not None:
                    user.cat2_marks = c2
                if c3 is not None:
                    user.cat3_marks = c3
                user.last_academic_update = now_dt
                user.updated_at = now_dt

                acad = session.query(StudentAcademicRecord).filter_by(register_number=reg_no).first()
                if acad:
                    if c1 is not None:
                        acad.cat1_marks = c1
                    if c2 is not None:
                        acad.cat2_marks = c2
                    if c3 is not None:
                        acad.cat3_marks = c3
                    acad.updated_by = ci_user.get('id', 'CLASS_INCHARGE')
                    acad.updated_by_name = ci_user.get('name', 'Class Incharge')
                    acad.updated_at = now_dt
                else:
                    new_acad = StudentAcademicRecord(
                        id=f"ACAD_{user.id}",
                        student_id=user.id,
                        register_number=reg_no,
                        student_name=st_name,
                        cat1_marks=c1,
                        cat2_marks=c2,
                        cat3_marks=c3,
                        attendance_percentage=user.attendance_percentage or 85.0,
                        cgpa=user.cgpa or 8.0,
                        total_working_days=120,
                        updated_by=ci_user.get('id', 'CLASS_INCHARGE'),
                        updated_by_name=ci_user.get('name', 'Class Incharge'),
                        created_at=now_dt,
                        updated_at=now_dt
                    )
                    session.add(new_acad)

                updated_records.append({
                    'register_number': reg_no,
                    'student_name': st_name,
                    'marks': new_marks,
                    'status': 'Updated'
                })

            hist_record = MarksUploadHistory(
                id=history_id,
                uploaded_by_id=ci_user.get('id'),
                uploaded_by_name=ci_user.get('name'),
                file_name=file_name or 'student_marks.xlsx',
                total_records=len(valid_rows),
                successful_records=len(updated_records),
                failed_records=len(unmatched_or_failed),
                status='Completed',
                created_at=now_dt
            )
            session.add(hist_record)
    except Exception as e:
        return {'success': False, 'error': f"Database transaction failed: {str(e)}"}

    return {
        'success': True,
        'message': f"Student marks updated successfully for {len(updated_records)} students.",
        'updated_count': len(updated_records),
        'failed_count': len(unmatched_or_failed),
        'history_id': history_id,
        'updated_records': updated_records,
        'failed_records': unmatched_or_failed
    }

def generate_failed_rows_report(failed_rows: list, upload_type="Upload") -> io.BytesIO:
    """Generate Excel report of failed/unmatched rows with row numbers and failure reasons."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Failed Records Report"

    headers = ["Row Number", "Register Number", "Student Name", "Status", "Reason for Failure"]
    ws.append(headers)
    _style_header(ws, headers, bg_color="DC2626")

    for f in failed_rows:
        ws.append([
            f.get('row_number', '—'),
            f.get('register_number', '—'),
            f.get('student_name', f.get('name', '—')),
            f.get('status', 'Failed'),
            f.get('reason', 'Unknown error')
        ])
    _style_data_rows(ws, len(failed_rows), len(headers))

    widths = {"A": 14, "B": 22, "C": 26, "D": 16, "E": 45}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
