import os
import io
import re
from datetime import datetime
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from backend.models.user import UserModel
from backend.database.mongodb import users_collection

COLUMN_ALIASES = {
    'register_number': [
        'register number', 'reg no', 'register no', 'reg_no', 'registerno',
        'roll no', 'rollno', 'student id', 'identifier', 'reg number'
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
    'attendance': [
        'attendance percentage', 'attendance %', 'attendance', 'att %',
        'overall attendance', 'attendance_percentage', 'attendance percent'
    ]
}

def generate_sample_academic_template():
    """
    Generate an official Excel template (.xlsx) with styled headers and realistic sample rows.
    Returns a BytesIO stream.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    if not isinstance(ws, Worksheet):
        ws = wb.create_sheet("Academic Data")
    assert isinstance(ws, Worksheet)
    ws.title = "Academic Data"

    headers = [
        "Register Number",
        "Student Name",
        "CAT 1",
        "CAT 2",
        "CAT 3",
        "Attendance Percentage"
    ]
    ws.append(headers)

    # Style header row: Dark Teal background, Bold White text, centered
    header_fill = PatternFill(start_color="0D9488", end_color="0D9488", fill_type="solid")
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

    # Sample rows
    sample_rows = [
        ["23CSD001", "Naveen", 86, 91, 88, 88.5],
        ["23CSD002", "Priya S", 94, 96, 92, 92.1],
        ["23CSD003", "Karthik R", 68, 71, 74, 74.2],
    ]

    for row_data in sample_rows:
        ws.append(row_data)

    # Style data rows and auto-fit columns
    for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")

    # Column widths
    column_widths = {
        "A": 22,
        "B": 26,
        "C": 14,
        "D": 14,
        "E": 14,
        "F": 26
    }
    for col_letter, width in column_widths.items():
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def _match_header(header_name):
    """Normalize and match raw header string against canonical column keys."""
    if not header_name:
        return None
    cleaned = str(header_name).strip().lower()
    cleaned = re.sub(r'[\s_\-]+', ' ', cleaned)

    for canon, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if cleaned == alias or cleaned.startswith(alias):
                return canon
    return None


def parse_and_validate_academic_excel(file_stream, allowed_department=None):
    """
    Parse an uploaded Excel file (.xlsx or .xls), validate all rows and student identifiers,
    and return a structured preview object ready for Class Incharge confirmation.
    """
    try:
        wb = openpyxl.load_workbook(file_stream, data_only=True)
    except Exception as e:
        return {
            'success': False,
            'error': f"Unable to read Excel file: {str(e)}. Please ensure the file is a valid .xlsx or .xls document without macro corruption."
        }

    ws = wb.active
    if ws is None or not isinstance(ws, Worksheet) or ws.max_row < 1:
        return {
            'success': False,
            'error': "The uploaded Excel spreadsheet is empty."
        }

    # Find header row
    header_col_map = {}
    header_row_idx = None

    for r_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if not any(row):
            continue
        mapped = {}
        for c_idx, val in enumerate(row):
            matched_key = _match_header(val)
            if matched_key:
                mapped[matched_key] = c_idx
        if 'register_number' in mapped and ('attendance' in mapped or 'cat1' in mapped):
            header_col_map = mapped
            header_row_idx = r_idx
            break

    if not header_col_map or 'register_number' not in header_col_map or header_row_idx is None:
        return {
            'success': False,
            'error': "Missing required columns in spreadsheet. Expected headers must include 'Register Number' and 'Attendance Percentage' (or CAT marks)."
        }

    # Retrieve all student users from MongoDB for fast in-memory matching
    users_col = users_collection()
    all_students = []
    if users_col is not None:
        all_students = list(users_col.find(
            {"role": {"$regex": "^student$", "$options": "i"}},
            {"id": 1, "identifier": 1, "name": 1, "department": 1, "year": 1, "section": 1}
        ))

    # Build lookup dictionaries (by identifier and ID, uppercase stripped)
    student_lookup = {}
    for st in all_students:
        ident = (st.get('identifier') or '').strip().upper()
        sid = (st.get('id') or '').strip().upper()
        if ident:
            student_lookup[ident] = st
        if sid:
            student_lookup[sid] = st

    processed_rows = []
    validation_errors = []
    seen_reg_numbers = set()

    for r_idx, row in enumerate(ws.iter_rows(min_row=header_row_idx + 1, values_only=True), start=header_row_idx + 1):
        # Ignore completely empty rows
        if not any(v is not None and str(v).strip() != '' for v in row):
            continue

        raw_reg = row[header_col_map['register_number']] if 'register_number' in header_col_map and header_col_map['register_number'] < len(row) else None
        raw_name = row[header_col_map['student_name']] if 'student_name' in header_col_map and header_col_map['student_name'] < len(row) else None
        raw_cat1 = row[header_col_map['cat1']] if 'cat1' in header_col_map and header_col_map['cat1'] < len(row) else None
        raw_cat2 = row[header_col_map['cat2']] if 'cat2' in header_col_map and header_col_map['cat2'] < len(row) else None
        raw_cat3 = row[header_col_map['cat3']] if 'cat3' in header_col_map and header_col_map['cat3'] < len(row) else None
        raw_att = row[header_col_map['attendance']] if 'attendance' in header_col_map and header_col_map['attendance'] < len(row) else None

        reg_str = str(raw_reg).strip() if raw_reg is not None else ''
        name_str = str(raw_name).strip() if raw_name is not None else ''

        row_errors = []

        # 1. Validate Register Number
        if not reg_str:
            row_errors.append({
                'row': r_idx,
                'register_number': 'N/A',
                'student_name': name_str or 'Unknown',
                'problem': 'Register Number is empty or missing.',
                'correction': 'Provide a valid university student register number (e.g. 23CSD001).'
            })
        elif reg_str.upper() in seen_reg_numbers:
            row_errors.append({
                'row': r_idx,
                'register_number': reg_str,
                'student_name': name_str,
                'problem': f"Duplicate Register Number '{reg_str}' found in the Excel sheet.",
                'correction': 'Ensure each student register number appears only once in the upload.'
            })
        else:
            seen_reg_numbers.add(reg_str.upper())

        # 2. Validate CAT 1
        cat1_val = None
        if raw_cat1 is not None and str(raw_cat1).strip() != '':
            try:
                cat1_val = float(raw_cat1)
                if cat1_val < 0 or cat1_val > 100:
                    row_errors.append({
                        'row': r_idx,
                        'register_number': reg_str,
                        'student_name': name_str,
                        'problem': f"CAT 1 mark ({raw_cat1}) must be between 0 and 100.",
                        'correction': 'Enter a numeric score between 0 and 100, or leave blank if test was not conducted.'
                    })
            except (ValueError, TypeError):
                row_errors.append({
                    'row': r_idx,
                    'register_number': reg_str,
                    'student_name': name_str,
                    'problem': f"CAT 1 mark '{raw_cat1}' is not a valid number.",
                    'correction': 'Enter a numeric score (e.g. 78 or 85.5).'
                })

        # 3. Validate CAT 2
        cat2_val = None
        if raw_cat2 is not None and str(raw_cat2).strip() != '':
            try:
                cat2_val = float(raw_cat2)
                if cat2_val < 0 or cat2_val > 100:
                    row_errors.append({
                        'row': r_idx,
                        'register_number': reg_str,
                        'student_name': name_str,
                        'problem': f"CAT 2 mark ({raw_cat2}) must be between 0 and 100.",
                        'correction': 'Enter a numeric score between 0 and 100, or leave blank.'
                    })
            except (ValueError, TypeError):
                row_errors.append({
                    'row': r_idx,
                    'register_number': reg_str,
                    'student_name': name_str,
                    'problem': f"CAT 2 mark '{raw_cat2}' is not a valid number.",
                    'correction': 'Enter a numeric score.'
                })

        # 4. Validate CAT 3
        cat3_val = None
        if raw_cat3 is not None and str(raw_cat3).strip() != '':
            try:
                cat3_val = float(raw_cat3)
                if cat3_val < 0 or cat3_val > 100:
                    row_errors.append({
                        'row': r_idx,
                        'register_number': reg_str,
                        'student_name': name_str,
                        'problem': f"CAT 3 mark ({raw_cat3}) must be between 0 and 100.",
                        'correction': 'Enter a numeric score between 0 and 100, or leave blank.'
                    })
            except (ValueError, TypeError):
                row_errors.append({
                    'row': r_idx,
                    'register_number': reg_str,
                    'student_name': name_str,
                    'problem': f"CAT 3 mark '{raw_cat3}' is not a valid number.",
                    'correction': 'Enter a numeric score.'
                })

        # 5. Validate Attendance Percentage
        att_val = None
        if raw_att is None or str(raw_att).strip() == '':
            row_errors.append({
                'row': r_idx,
                'register_number': reg_str,
                'student_name': name_str,
                'problem': 'Attendance percentage is empty or missing.',
                'correction': 'Provide attendance percentage between 0 and 100 (e.g. 88.5).'
            })
        else:
            try:
                # Remove any stray '%' sign
                cleaned_att = str(raw_att).replace('%', '').strip()
                att_val = float(cleaned_att)
                if att_val < 0 or att_val > 100:
                    row_errors.append({
                        'row': r_idx,
                        'register_number': reg_str,
                        'student_name': name_str,
                        'problem': f"Attendance ({raw_att}) must be between 0 and 100.",
                        'correction': 'Enter a percentage value between 0.0 and 100.0.'
                    })
            except (ValueError, TypeError):
                row_errors.append({
                    'row': r_idx,
                    'register_number': reg_str,
                    'student_name': name_str,
                    'problem': f"Attendance '{raw_att}' is not a valid numeric percentage.",
                    'correction': 'Enter a numeric percentage (e.g. 91 or 91.5).'
                })

        # 6. Student Matching against Database
        matched_user = student_lookup.get(reg_str.upper()) if reg_str else None
        match_status = "Matched" if matched_user else "Not Found"
        validation_status = "Error" if row_errors else "Valid"

        student_id = matched_user['id'] if matched_user else None
        final_name = (matched_user.get('name') if matched_user else None) or name_str or 'Unknown'

        row_item = {
            'row_number': r_idx,
            'register_number': reg_str,
            'student_name': final_name,
            'student_id': student_id,
            'cat1': cat1_val,
            'cat2': cat2_val,
            'cat3': cat3_val,
            'attendance': att_val,
            'match_status': match_status,
            'validation_status': validation_status,
            'errors': [e['problem'] for e in row_errors],
            'department': matched_user.get('department') if matched_user else None
        }

        processed_rows.append(row_item)
        if row_errors:
            validation_errors.extend(row_errors)

    total_records = len(processed_rows)
    matched_records = len([r for r in processed_rows if r['match_status'] == 'Matched'])
    unmatched_records = len([r for r in processed_rows if r['match_status'] == 'Not Found'])
    invalid_records = len([r for r in processed_rows if r['validation_status'] == 'Error'])

    return {
        'success': True,
        'summary': {
            'total_rows': total_records,
            'matched_count': matched_records,
            'unmatched_count': unmatched_records,
            'invalid_count': invalid_records,
            'can_confirm': invalid_records == 0 and matched_records > 0
        },
        'rows': processed_rows,
        'errors': validation_errors
    }
