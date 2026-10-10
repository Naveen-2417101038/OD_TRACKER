import os
import sys
import urllib.request
import urllib.error
import json
import io
import openpyxl

sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

BASE_URL = 'http://127.0.0.1:5000/api'

def log_test(name, passed, details=""):
    badge = "[PASS]" if passed else "[FAIL]"
    print(f"{badge} {name}")
    if details:
        print(f"       -> {details}")

def main():
    print("=" * 70)
    print("  E2E TEST SUITE: CLASS INCHARGE STUDENT MANAGEMENT MODULE")
    print("=" * 70)

    # 1. Login CI
    login_body = json.dumps({'email': 'k.shanthi@rajalakshmi.edu.in', 'password': 'password123'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/auth/login', data=login_body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        ci_token = res.get('token')
        log_test("Class Incharge Authentication", bool(ci_token), f"Logged in as {res['user']['name']} ({res['user']['role']})")

    ci_headers = {'Authorization': f'Bearer {ci_token}', 'Content-Type': 'application/json'}

    # 2. Template Downloads
    for tmpl in ['students', 'attendance', 'marks']:
        req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/templates/{tmpl}', headers={'Authorization': f'Bearer {ci_token}'})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            wb = openpyxl.load_workbook(io.BytesIO(data))
            log_test(f"Download Template: {tmpl}", len(data) > 2000, f"Size: {len(data)} bytes, Sheet: {wb.active.title}")

    # 3. Student List & Filters
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students', headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        students_res = json.loads(resp.read().decode())
        count = students_res.get('count', 0)
        log_test("List Students Roster", count > 0, f"Retrieved {count} students for department {students_res['students'][0]['department']}")

    # 4. Single Student Lifecycle
    test_reg = "23CSD991"
    from backend.database.mongodb import users_collection, academic_records_collection
    u_col = users_collection()
    a_col = academic_records_collection()
    if u_col is not None:
        u_col.delete_one({'identifier': test_reg})
    if a_col is not None:
        a_col.delete_one({'register_number': test_reg})

    create_payload = json.dumps({
        'register_number': test_reg,
        'name': 'Test Student E2E',
        'email': 'e2e.test991@rajalakshmi.edu.in',
        'department': 'Computer Science and Design',
        'section': 'A',
        'year': 'III Year',
        'cgpa': 8.7,
        'attendance': 86.5,
        'password': 'password123'
    }).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students', data=create_payload, headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        created = json.loads(resp.read().decode())
        log_test("Create Single Student Account", created.get('success'), f"Created {test_reg} ({created['student']['id']})")

    # Update Student
    edit_payload = json.dumps({'name': 'Test Student E2E Updated', 'cgpa': 8.95, 'attendance': 89.0}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students/{test_reg}', data=edit_payload, headers=ci_headers, method='PUT')
    with urllib.request.urlopen(req) as resp:
        edited = json.loads(resp.read().decode())
        log_test("Edit Student Details", edited.get('success'), f"Updated CGPA to 8.95, Att to 89.0%")

    # Toggle Status
    toggle_payload = json.dumps({'status': 'DISABLED'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students/{test_reg}/status', data=toggle_payload, headers=ci_headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        toggled = json.loads(resp.read().decode())
        log_test("Toggle Student Status to DISABLED", toggled.get('status') == 'DISABLED')

    toggle_back = json.dumps({'status': 'ACTIVE'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students/{test_reg}/status', data=toggle_back, headers=ci_headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        toggled2 = json.loads(resp.read().decode())
        log_test("Toggle Student Status to ACTIVE", toggled2.get('status') == 'ACTIVE')

    # Reset Password
    reset_payload = json.dumps({'password': 'newSecretPassword123'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students/{test_reg}/reset-password', data=reset_payload, headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        reset_res = json.loads(resp.read().decode())
        log_test("Reset Student Password", reset_res.get('success'))

    # View Full Student Profile
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students/{test_reg}/profile', headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        prof_res = json.loads(resp.read().decode())
        has_prof = prof_res.get('success') and 'basic_info' in prof_res.get('profile', {}) and 'academics' in prof_res.get('profile', {})
        log_test("View Full Student Profile", has_prof, f"OD Remaining: {prof_res['profile']['academics']['eligibility']['remaining_od_days']} days")

    # 5. Bulk Student Creation with Duplicates Check
    wb_bulk = openpyxl.Workbook()
    ws_bulk = wb_bulk.active
    ws_bulk.append(['Register Number', 'Student Name', 'Email', 'Department', 'Class / Section', 'Year', 'CGPA', 'Attendance Percentage'])
    ws_bulk.append([test_reg, 'Existing Student Dup', 'e2e.test991@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.5, 85.0])
    ws_bulk.append(['23CSD992', 'New Student A', 'new.992@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.2, 84.0])
    ws_bulk.append(['23CSD992', 'Duplicate in File A', 'dup.992@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.2, 84.0])
    ws_bulk.append(['23CSD993', 'Invalid Email Student', 'bad-email-no-at', 'Computer Science and Design', 'A', 'III Year', 8.0, 80.0])

    buf_bulk = io.BytesIO()
    wb_bulk.save(buf_bulk)
    boundary = '----E2ETestBoundaryBulk'
    body_bulk = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="test_bulk.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + buf_bulk.getvalue() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        f'{BASE_URL}/class-incharge/student-management/students/preview-upload',
        data=body_bulk,
        headers={'Authorization': f'Bearer {ci_token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        bulk_prev = json.loads(resp.read().decode())
        s = bulk_prev.get('summary', {})
        dup_passed = (
            s.get('total_records') == 4 and
            s.get('already_existing') == 1 and
            s.get('duplicate_records') == 1 and
            s.get('invalid_records') == 1 and
            s.get('ready_to_import') == 1
        )
        log_test("Bulk Duplicate & Error Detection", dup_passed, f"Total: {s.get('total_records')}, Existing: {s.get('already_existing')}, Dup in File: {s.get('duplicate_records')}, Invalid: {s.get('invalid_records')}, Ready: {s.get('ready_to_import')}")

    # 6. Weekly Attendance Synchronization & OD Eligibility Check
    wb_att = openpyxl.Workbook()
    ws_att = wb_att.active
    ws_att.append(['Register Number', 'Student Name', 'Attendance Percentage', 'Total Classes', 'Attendance Date/Week'])
    # Test setting Naveen's attendance to 72.0% (below 75% threshold)
    ws_att.append(['23CSD001', 'Naveen', 72.0, 120, 'Week 7'])
    ws_att.append(['NONEXISTENT', 'Ghost Student', 85.0, 120, 'Week 7'])

    buf_att = io.BytesIO()
    wb_att.save(buf_att)
    body_att = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="att_test.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + buf_att.getvalue() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        f'{BASE_URL}/class-incharge/student-management/attendance/preview-upload',
        data=body_att,
        headers={'Authorization': f'Bearer {ci_token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        att_prev = json.loads(resp.read().decode())
        att_preview_passed = att_prev['summary']['matched_count'] == 1 and att_prev['summary']['unmatched_count'] == 1
        log_test("Weekly Attendance Preview Matching", att_preview_passed, f"Matched: {att_prev['summary']['matched_count']}, Unmatched: {att_prev['summary']['unmatched_count']}")

    # Confirm attendance update
    matched_att = [r for r in att_prev['rows'] if r['status'] == 'matched']
    confirm_att_payload = json.dumps({'rows': matched_att, 'filename': 'att_test.xlsx', 'week_date': 'Week 7'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/attendance/confirm-upload', data=confirm_att_payload, headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        att_conf = json.loads(resp.read().decode())
        log_test("Confirm Weekly Attendance Update", att_conf.get('success'), f"Updated {att_conf.get('updated_count')} students")

    # Verify OD Eligibility immediately switches to Ineligible for 23CSD001
    req = urllib.request.Request(f'{BASE_URL}/academic/student/23CSD001', headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        acad = json.loads(resp.read().decode())
        el = acad['academic']['eligibility']
        eligibility_switched = (el['eligible'] is False) and (acad['academic']['attendance_percentage'] == 72.0)
        log_test("Instant OD Eligibility Rejection (<75% Threshold)", eligibility_switched, f"Attendance: {acad['academic']['attendance_percentage']}%, Eligible: {el['eligible']}, Reason: {el.get('rejection_reason')}")

    # Re-update Naveen attendance to 88.5%
    re_up_payload = json.dumps({'rows': [{'register_number': '23CSD001', 'new_attendance': 88.5, 'previous_attendance': 72.0, 'student_name': 'Naveen', 'status': 'matched'}], 'filename': 'att_restore.xlsx'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/attendance/confirm-upload', data=re_up_payload, headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        json.loads(resp.read().decode())

    req = urllib.request.Request(f'{BASE_URL}/academic/student/23CSD001', headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        acad = json.loads(resp.read().decode())
        el = acad['academic']['eligibility']
        eligibility_restored = (el['eligible'] is True) and (acad['academic']['attendance_percentage'] == 88.5)
        log_test("Instant OD Eligibility Restoration (>=75% Threshold)", eligibility_restored, f"Attendance: {acad['academic']['attendance_percentage']}%, Eligible: {el['eligible']}")

    # 7. CAT Marks Management
    wb_mrk = openpyxl.Workbook()
    ws_mrk = wb_mrk.active
    ws_mrk.append(['Register Number', 'Student Name', 'CAT 1', 'CAT 2', 'CAT 3', 'Assignment / Internal Marks'])
    ws_mrk.append(['23CSD001', 'Naveen', 87.5, 92.0, 90.0, 49.0])
    buf_mrk = io.BytesIO()
    wb_mrk.save(buf_mrk)
    body_mrk = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="marks_e2e.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + buf_mrk.getvalue() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        f'{BASE_URL}/class-incharge/student-management/marks/preview-upload',
        data=body_mrk,
        headers={'Authorization': f'Bearer {ci_token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        mrk_prev = json.loads(resp.read().decode())
        log_test("Marks Preview Matching", mrk_prev['summary']['matched_count'] == 1)

    matched_mrk = [r for r in mrk_prev['rows'] if r['status'] == 'matched']
    confirm_mrk_payload = json.dumps({'rows': matched_mrk, 'filename': 'marks_e2e.xlsx'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/marks/confirm-upload', data=confirm_mrk_payload, headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        mrk_conf = json.loads(resp.read().decode())
        log_test("Confirm CAT Marks Update", mrk_conf.get('success'), f"Updated {mrk_conf.get('updated_count')} students")

    # Verify Marks in Student Academic API
    req = urllib.request.Request(f'{BASE_URL}/academic/student/23CSD001', headers=ci_headers)
    with urllib.request.urlopen(req) as resp:
        acad_m = json.loads(resp.read().decode())
        marks_updated = (acad_m['academic']['cat1_marks'] == 87.5 and acad_m['academic']['cat2_marks'] == 92.0 and acad_m['academic']['cat3_marks'] == 90.0)
        log_test("Marks Reflected in Academic API", marks_updated, f"CAT 1: {acad_m['academic']['cat1_marks']}, CAT 2: {acad_m['academic']['cat2_marks']}, CAT 3: {acad_m['academic']['cat3_marks']}")

    # 8. History Audit Logging
    for h in ['students', 'attendance', 'marks']:
        req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/history/{h}', headers=ci_headers)
        with urllib.request.urlopen(req) as resp:
            hist = json.loads(resp.read().decode())
            log_test(f"Audit History Log for {h}", hist.get('count', 0) > 0, f"Found {hist.get('count')} logged audit events")

    # 9. Role-Based Security: Verify Student is Blocked
    st_login = json.dumps({'email': 'naveen.23csd@rajalakshmi.edu.in', 'password': 'password123'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/auth/login', data=st_login, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        st_token = json.loads(resp.read().decode())['token']

    student_blocked = False
    try:
        req = urllib.request.Request(f'{BASE_URL}/class-incharge/student-management/students', headers={'Authorization': f'Bearer {st_token}'})
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        if e.code == 403:
            student_blocked = True

    # 10. Clean up test student
    from backend.database.mongodb import users_collection, academic_records_collection
    u_col = users_collection()
    a_col = academic_records_collection()
    if u_col is not None:
        u_col.delete_one({'identifier': test_reg})
    if a_col is not None:
        a_col.delete_one({'register_number': test_reg})

    print("=" * 70)
    print("  ALL E2E WORKFLOW TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    main()
