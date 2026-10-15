"""
PDF Generation Service
Provides valid, standards-compliant PDF 1.4 documents for OD approval letters and participation certificates.
No external native binaries required.
"""
import os
import re

def escape_pdf(text: str) -> str:
    """Escape text for PDF literal strings."""
    if text is None:
        return ""
    # Strip non-ASCII or replace
    clean = str(text).encode('ascii', 'replace').decode('ascii')
    return clean.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def build_pdf_document(page_width: int, page_height: int, stream_content: str) -> bytes:
    """
    Constructs a valid PDF 1.4 binary file with exact byte offset xref table.
    """
    stream_bytes = stream_content.strip().encode('latin1')
    stream_length = len(stream_bytes)

    header = b"%PDF-1.4\n"
    
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n".encode('latin1')
    obj4_start = f"4 0 obj\n<< /Length {stream_length} >>\nstream\n".encode('latin1')
    obj4_end = b"\nendstream\nendobj\n"
    obj4 = obj4_start + stream_bytes + obj4_end
    obj5 = b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"
    obj6 = b"6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"

    offsets = []
    current_offset = len(header)

    for obj in [obj1, obj2, obj3, obj4, obj5, obj6]:
        offsets.append(current_offset)
        current_offset += len(obj)

    xref_offset = current_offset
    xref = b"xref\n0 7\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n".encode('ascii')

    trailer = f"trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode('ascii')

    return header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer

def generate_od_letter_pdf(
    file_path: str,
    student_name: str = "Naveen",
    reg_no: str = "23CSD001",
    event_name: str = "Smart India Hackathon 2026",
    organizer: str = "Ministry of Education / AICTE",
    event_date: str = "2026-10-18",
    from_time: str = "09:00",
    to_time: str = "17:00",
    dept: str = "Computer Science and Design",
    req_id: str = "REQ_OD_LETTER"
) -> str:
    """Generates an official institutional OD approval & requisition letter PDF (portrait 612x792)."""
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    
    stream_content = f"""q
0.08 0.18 0.36 RG
2 w
30 30 552 732 re S
0.75 0.60 0.15 RG
1 w
35 35 542 722 re S
Q

BT
/F1 15 Tf
0.08 0.18 0.36 rg
130 720 Td
(RAJALAKSHMI ENGINEERING COLLEGE) Tj

/F2 9 Tf
0.35 0.40 0.45 rg
-35 -16 Td
(An Autonomous Institution - Affiliated to Anna University, Chennai) Tj

/F1 11 Tf
0.10 0.45 0.35 rg
25 -16 Td
(DEPARTMENT OF {escape_pdf(dept.upper())}) Tj

/F2 8 Tf
0.45 0.45 0.45 rg
-10 -14 Td
(Rajalakshmi Nagar, Thandalam, Chennai - 602 105 | www.rajalakshmi.org) Tj
ET

q
0.8 0.8 0.8 RG
1 w
45 650 m 567 650 l S
Q

BT
/F1 13 Tf
0.80 0.20 0.10 rg
115 625 Td
(ON-DUTY \\(OD\\) REQUISITION & APPROVAL LETTER) Tj

/F2 9 Tf
0.40 0.40 0.40 rg
-65 -22 Td
(Official Reference ID: {escape_pdf(req_id)}    |    Date Issued: {escape_pdf(event_date)}) Tj

/F1 11 Tf
0.15 0.20 0.25 rg
0 -30 Td
(TO WHOMSOEVER IT MAY CONCERN) Tj

/F2 10 Tf
0.25 0.25 0.25 rg
0 -24 Td
(This is to certify that the bonafide student mentioned below has been granted official) Tj
0 -16 Td
(On-Duty \\(OD\\) attendance permission to represent Rajalakshmi Engineering College:) Tj

/F1 10 Tf
0.08 0.18 0.36 rg
0 -30 Td
(STUDENT PARTICULARS:) Tj

/F2 10 Tf
0.20 0.20 0.20 rg
0 -18 Td
(Student Name       : {escape_pdf(student_name)}) Tj
0 -16 Td
(Register Number    : {escape_pdf(reg_no)}) Tj
0 -16 Td
(Academic Program   : B.E. Computer Science and Design \\(III Year - Section A\\)) Tj
0 -16 Td
(Attendance Status  : Verified Eligible \\(Above 75% REC Threshold\\)) Tj

/F1 10 Tf
0.08 0.18 0.36 rg
0 -26 Td
(EVENT & ON-DUTY DETAILS:) Tj

/F2 10 Tf
0.20 0.20 0.20 rg
0 -18 Td
(Event Name         : {escape_pdf(event_name)}) Tj
0 -16 Td
(Organizing Body    : {escape_pdf(organizer)}) Tj
0 -16 Td
(Scheduled Date     : {escape_pdf(event_date)}) Tj
0 -16 Td
(Permitted Hours    : {escape_pdf(from_time)} to {escape_pdf(to_time)}) Tj
0 -16 Td
(Purpose of OD      : Academic Representation & Technical Paper / Project Contest) Tj

/F2 9 Tf
0.40 0.40 0.40 rg
0 -32 Td
(The student is advised to upload the official participation certificate within 24 hours of event) Tj
0 -14 Td
(completion for Class Incharge verification and compensatory attendance entry.) Tj

/F2 9 Tf
0.20 0.20 0.20 rg
0 -50 Td
(______________________          ______________________          ______________________) Tj
0 -16 Td
(Faculty Mentor                  Class Incharge                  Head of Department) Tj
0 -14 Td
(Dr. A. Rajesh                   Mrs. K. Shanthi                 Dr. P. Kumar) Tj
0 -12 Td
(Dept. of CSD                    Dept. of CSD                    Dept. of CSD) Tj
ET
"""
    pdf_bytes = build_pdf_document(612, 792, stream_content)
    with open(file_path, 'wb') as f:
        f.write(pdf_bytes)
    return file_path

def generate_certificate_pdf(
    file_path: str,
    student_name: str = "Naveen",
    reg_no: str = "23CSD001",
    event_name: str = "Smart India Hackathon 2026",
    organizer: str = "Ministry of Education / AICTE",
    dept: str = "Computer Science and Design",
    cert_id: str = "CERT_REC_2026"
) -> str:
    """Generates an official student participation certificate PDF (landscape 792x612)."""
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    
    stream_content = f"""q
0.12 0.20 0.35 RG
3 w
20 20 752 572 re S
0.80 0.65 0.22 RG
1.5 w
26 26 740 560 re S
Q

BT
/F1 14 Tf
0.12 0.20 0.35 rg
250 540 Td
(RAJALAKSHMI ENGINEERING COLLEGE) Tj

/F2 11 Tf
0.35 0.40 0.45 rg
-25 -22 Td
(AN AUTONOMOUS INSTITUTION - AFFILIATED TO ANNA UNIVERSITY) Tj

/F2 10 Tf
0.40 0.45 0.50 rg
30 -18 Td
(DEPARTMENT OF {escape_pdf(dept.upper())}) Tj

/F1 26 Tf
0.80 0.55 0.15 rg
-55 -45 Td
(CERTIFICATE OF PARTICIPATION) Tj

/F2 12 Tf
0.40 0.40 0.40 rg
50 -30 Td
(This is proudly presented to certify that) Tj

/F1 20 Tf
0.08 0.15 0.30 rg
-30 -32 Td
({escape_pdf(student_name)}  [{escape_pdf(reg_no)}]) Tj

/F2 12 Tf
0.35 0.35 0.35 rg
-10 -28 Td
(has successfully represented the institution and participated in) Tj

/F1 16 Tf
0.12 0.45 0.35 rg
-20 -30 Td
({escape_pdf(event_name)}) Tj

/F2 10 Tf
0.45 0.45 0.45 rg
-40 -40 Td
(The participant has officially submitted genuine event proof for academic OD records.) Tj
0 -18 Td
(Document Reference ID: {escape_pdf(cert_id)}   |   Status: OFFICIALLY SANCTIONED) Tj

0.2 0.2 0.2 rg
-30 -65 Td
(___________________________) Tj
350 0 Td
(___________________________) Tj
-350 -16 Td
(Dr. A. Rajesh, Class Incharge) Tj
350 0 Td
(Dr. P. Kumar, Head of Department) Tj
ET
"""
    pdf_bytes = build_pdf_document(792, 612, stream_content)
    with open(file_path, 'wb') as f:
        f.write(pdf_bytes)
    return file_path
