import urllib.request
import json
import io
import openpyxl

def run_tests():
    # 1. Login CI
    login_data = json.dumps({'email': 'k.shanthi@rajalakshmi.edu.in', 'password': 'password123'}).encode()
    req = urllib.request.Request('http://127.0.0.1:5000/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        token = json.loads(resp.read().decode())['token']

    headers = {'Authorization': f'Bearer {token}'}

    # 2. Download templates test
    for t in ['students', 'attendance', 'marks']:
        req = urllib.request.Request(f'http://127.0.0.1:5000/api/class-incharge/student-management/templates/{t}', headers=headers)
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            print(f'[+] Template {t} downloaded: {len(content)} bytes')

    # 3. Test Student Profile endpoint for 23CSD001
    req = urllib.request.Request('http://127.0.0.1:5000/api/class-incharge/student-management/students/23CSD001/profile', headers=headers)
    with urllib.request.urlopen(req) as resp:
        prof = json.loads(resp.read().decode())
        print('[+] Student Profile for 23CSD001:')
        print('    Name:', prof['profile']['basic_info']['name'])
        print('    Att:', prof['profile']['academics']['attendance_percentage'])
        print('    Total ODs:', prof['profile']['od_summary']['total_requests'])

    # 4. Test Attendance preview and update
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['Register Number', 'Student Name', 'Attendance Percentage', 'Total Classes', 'Attendance Date/Week'])
    ws.append(['23CSD001', 'Naveen', 73.5, 120, 'Week 6']) # 73.5% should make them NOT eligible!
    ws.append(['23CSD999', 'Fake Student', 90.0, 120, 'Week 6']) # Unmatched
    ws.append(['INVALID_ROW', 'Bad Row', 'not_a_number', 120, 'Week 6']) # Invalid

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_bytes = excel_buf.getvalue()

    boundary = '----WebKitFormBoundaryTest1234567'
    body = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="weekly_test.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + excel_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/attendance/preview-upload',
        data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        prev_att = json.loads(resp.read().decode())
        print('[+] Attendance Preview Summary:', prev_att['summary'])
        for r in prev_att['rows']:
            print(f"    Row {r['row_number']}: {r['register_number']} => Status: {r['status']} Reason: {r.get('reason')}")

    # Confirm update for the matched row
    matched = [r for r in prev_att['rows'] if r['status'] == 'matched']
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/attendance/confirm-upload',
        data=json.dumps({'rows': matched, 'filename': 'weekly_test.xlsx', 'week_date': 'Week 6'}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        conf = json.loads(resp.read().decode())
        print('[+] Attendance Confirm:', conf['message'])

    # 5. Verify OD eligibility now immediately shows Not Eligible for 23CSD001!
    req = urllib.request.Request('http://127.0.0.1:5000/api/academic/student/23CSD001', headers=headers)
    with urllib.request.urlopen(req) as resp:
        acad = json.loads(resp.read().decode())
        print('[+] Verified Academic API for 23CSD001:')
        print('    Attendance:', acad['academic']['attendance_percentage'])
        print('    OD Eligible:', acad['academic']['eligibility']['eligible'])
        print('    Rejection Reason:', acad['academic']['eligibility'].get('rejection_reason'))

    # 6. Test Marks preview and confirm
    wb_m = openpyxl.Workbook()
    ws_m = wb_m.active
    ws_m.append(['Register Number', 'Student Name', 'CAT 1', 'CAT 2', 'CAT 3', 'Assignment / Internal Marks'])
    ws_m.append(['23CSD001', 'Naveen', 89.0, 93.5, 91.0, 48.0])
    ws_m.append(['23CSD002', 'Priya S', 95.0, 97.0, 96.0, 50.0])
    buf_m = io.BytesIO()
    wb_m.save(buf_m)
    body_m = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="marks_test.xlsx"\r\n'
        'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + buf_m.getvalue() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/marks/preview-upload',
        data=body_m,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req) as resp:
        prev_m = json.loads(resp.read().decode())
        print('[+] Marks Preview Summary:', prev_m['summary'])

    matched_m = [r for r in prev_m['rows'] if r['status'] == 'matched']
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/marks/confirm-upload',
        data=json.dumps({'rows': matched_m, 'filename': 'marks_test.xlsx'}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        conf_m = json.loads(resp.read().decode())
        print('[+] Marks Confirm:', conf_m['message'])

    # 7. Test Attendance & Marks History
    for h in ['attendance', 'marks', 'students']:
        req = urllib.request.Request(f'http://127.0.0.1:5000/api/class-incharge/student-management/history/{h}', headers=headers)
        with urllib.request.urlopen(req) as resp:
            hist = json.loads(resp.read().decode())
            print(f'[+] History for {h}: {hist.get("count")} items')

    # Re-normalize attendance for 23CSD001 back to 88.5 so tests don't permanently alter eligibility unexpectedly
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/class-incharge/student-management/students/23CSD001',
        data=json.dumps({'attendance': 88.5, 'cat1': 86.4, 'cat2': 91.0, 'cat3': 88.0}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        method='PUT'
    )
    with urllib.request.urlopen(req) as resp:
        print('[+] Reset 23CSD001 attendance to 88.5%:', json.loads(resp.read().decode())['success'])

if __name__ == '__main__':
    run_tests()
