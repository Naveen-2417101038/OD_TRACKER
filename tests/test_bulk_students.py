import urllib.request
import json
import io
import openpyxl

def test_bulk_student_creation():
    # Login CI
    login_data = json.dumps({'email': 'k.shanthi@rajalakshmi.edu.in', 'password': 'password123'}).encode()
    req = urllib.request.Request('http://127.0.0.1:5000/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        token = json.loads(resp.read().decode())['token']

    headers = {'Authorization': f'Bearer {token}'}

    # Create excel with:
    # 1. 23CSD001 (already existing in DB)
    # 2. 23CSD888 (valid new student)
    # 3. 23CSD888 (duplicate in file)
    # 4. Invalid email row
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['Register Number', 'Student Name', 'Email', 'Department', 'Class / Section', 'Year', 'CGPA', 'Attendance Percentage'])
    ws.append(['23CSD001', 'Naveen Duplicate', 'naveen.23csd@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.5, 90.0])
    ws.append(['23CSD888', 'Divya R', 'divya.23csd@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.9, 91.0])
    ws.append(['23CSD888', 'Divya R Dup', 'divya.dup@rajalakshmi.edu.in', 'Computer Science and Design', 'A', 'III Year', 8.9, 91.0])
    ws.append(['23CSD889', 'Bad Email Student', 'invalid-email-string', 'Computer Science and Design', 'A', 'III Year', 7.5, 80.0])

    buf = io.BytesIO()
    wb.save(buf)
    boundary = '----WebKitFormBoundaryStudentTest'
    body = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="bulk_students_test.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + buf.getvalue() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/students/preview-upload',
        data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        prev = json.loads(resp.read().decode())
        print('[+] Bulk Student Preview Summary:', prev['summary'])
        for r in prev['rows']:
            print(f"    Row {r['row_number']}: {r['register_number']} => Status: {r['status']} Reason: {r.get('reason')}")

    # Confirm import of valid rows
    valid_rows = [r for r in prev['rows'] if r['status'] == 'valid']
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/students/confirm-upload',
        data=json.dumps({'rows': valid_rows, 'filename': 'bulk_students_test.xlsx'}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        conf = json.loads(resp.read().decode())
        print('[+] Student Bulk Confirm:', conf['message'])
        print('    Imported count:', conf['imported_count'])

    # Verify history
    req = urllib.request.Request('http://127.0.0.1:5000/api/class-incharge/student-management/history/students', headers=headers)
    with urllib.request.urlopen(req) as resp:
        hist = json.loads(resp.read().decode())
        print('[+] Student Import History count:', hist['count'])

if __name__ == '__main__':
    test_bulk_student_creation()
