"""
Email Service for OD Tracking System.
Handles real SMTP email delivery for OTP verification, password changes,
and all OD lifecycle application notifications.
Email is the primary and only notification channel.
Falls back gracefully to clean console logging in development mode if SMTP is unconfigured.
"""
import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from backend.config import Config
except ImportError:
    from config import Config

def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Send an email via SMTP server if configured, else log to console in dev mode.
    Returns True if sent/handled successfully, False if delivery fails.
    """
    to_email = (to_email or '').strip().lower()
    if not to_email:
        return False

    smtp_host = getattr(Config, 'SMTP_HOST', None) or os.environ.get('SMTP_HOST', '')
    smtp_port = int(getattr(Config, 'SMTP_PORT', None) or os.environ.get('SMTP_PORT', 587))
    smtp_user = getattr(Config, 'SMTP_EMAIL', None) or getattr(Config, 'SMTP_USERNAME', None) or os.environ.get('SMTP_EMAIL', '') or os.environ.get('SMTP_USERNAME', '')
    smtp_pass = getattr(Config, 'SMTP_PASSWORD', None) or os.environ.get('SMTP_PASSWORD', '')
    from_email = getattr(Config, 'MAIL_DEFAULT_SENDER', None) or getattr(Config, 'SMTP_FROM_EMAIL', None) or os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@rajalakshmi.edu.in')
    use_tls = getattr(Config, 'SMTP_USE_TLS', True)

    # Check if real SMTP credentials are provided
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"Rajalakshmi Engineering College OD Portal <{from_email}>"
            msg['To'] = to_email

            part1 = MIMEText(text_body, 'plain', 'utf-8')
            part2 = MIMEText(html_body, 'html', 'utf-8')
            msg.attach(part1)
            msg.attach(part2)

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
                if use_tls:
                    server.starttls()

            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [to_email], msg.as_string())
            server.quit()
            print(f"[+] SMTP: Email sent successfully to {to_email} (Subject: {subject})")
            return True
        except Exception as e:
            # Securely log failure without exposing passwords
            print(f"[-] SMTP Delivery Failed to {to_email}: {type(e).__name__} - {e}")
            return False

    # Development / Fallback Clean Console Logger
    print("\n" + "=" * 80)
    print(f"  [EMAIL DISPATCH - REC OD TRACKING PORTAL]")
    print(f"  To:       {to_email}")
    print(f"  Subject:  {subject}")
    print("-" * 80)
    print(text_body)
    print("=" * 80 + "\n")
    return True


def send_email_async(to_email: str, subject: str, html_body: str, text_body: str):
    """Dispatch email in a daemon background thread so HTTP response is non-blocking."""
    t = threading.Thread(
        target=send_email,
        args=(to_email, subject, html_body, text_body),
        daemon=True,
        name=f"EmailDispatch-{to_email[:10]}"
    )
    t.start()
    return t


def _render_base_email(title: str, badge: str, recipient_name: str, main_content_html: str, action_url: str = None, action_label: str = None) -> str:
    """Generate consistent, responsive, professional HTML email template."""
    action_button_html = ""
    if action_url and action_label:
        action_button_html = f"""
        <div style="text-align: center; margin: 30px 0;">
          <a href="{action_url}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.3);">{action_label}</a>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }}
    .container {{ max-width: 620px; margin: 24px auto; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }}
    .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff; }}
    .badge {{ display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 9999px; color: #e0f2fe; margin-bottom: 8px; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }}
    .header p {{ margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1; }}
    .body {{ padding: 32px 28px; font-size: 14px; line-height: 1.6; color: #334155; }}
    .greeting {{ font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }}
    .card-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0; }}
    .footer {{ background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">{badge}</span>
      <h1>Rajalakshmi Engineering College</h1>
      <p>Autonomous Institution • On-Duty (OD) Tracking Portal</p>
    </div>
    <div class="body">
      <div class="greeting">Dear {recipient_name},</div>
      {main_content_html}
      {action_button_html}
      <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        This is an official automated notification dispatched by the Rajalakshmi Engineering College OD Management System. Please do not reply directly to this email.
      </p>
    </div>
    <div class="footer">
      <strong>Rajalakshmi Engineering College</strong><br>
      Rajalakshmi Nagar, Thandalam, Chennai - 602 105<br>
      &copy; {Config.DEBUG and '2026' or '2026'} Rajalakshmi Engineering College. All rights reserved.
    </div>
  </div>
</body>
</html>"""


# ──────────────────────────────────────────────────────────────────────────────
# 1. OTP & Authentication Emails
# ──────────────────────────────────────────────────────────────────────────────

def send_password_reset_email(to_email: str, recipient_name: str, reset_token: str) -> bool:
    """Send secure password reset link or token (backwards compatibility)."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    reset_url = f"{base_url}/reset-password/{reset_token}"
    subject = "Reset your OD Tracking Application password"

    text_body = f"""Dear {recipient_name},

We received a request to reset your password for the REC OD Tracking Application.
Click the link below to set a new password:
{reset_url}

This link is valid for 1 hour. If you did not request this, you may ignore this email.

Best regards,
Rajalakshmi Engineering College Administration
    """

    main_html = f"""
    <p>We received a request to reset your password for the REC OD Tracking System.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{reset_url}" style="background-color: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset Password</a>
    </div>
    <p style="font-size: 12px; color: #64748b;">Or copy this link: <a href="{reset_url}">{reset_url}</a></p>
    """

    html_body = _render_base_email("Reset Password", "Password Reset", recipient_name, main_html, reset_url, "Reset Password")
    return send_email(to_email, subject, html_body, text_body)


def send_otp_email(to_email: str, recipient_name_or_otp: str, otp_code_or_name: str = None, purpose: str = "password change") -> bool:
    """Send 6-digit cryptographically secure OTP with 5-minute expiry."""
    # Support flexible argument order: (to, name, otp) or (to, otp, name)
    if otp_code_or_name is not None and str(recipient_name_or_otp).isdigit() and len(str(recipient_name_or_otp)) == 6:
        otp_code = str(recipient_name_or_otp)
        recipient_name = str(otp_code_or_name)
    elif otp_code_or_name is not None and str(otp_code_or_name).isdigit() and len(str(otp_code_or_name)) == 6:
        recipient_name = str(recipient_name_or_otp)
        otp_code = str(otp_code_or_name)
    else:
        recipient_name = str(recipient_name_or_otp)
        otp_code = str(otp_code_or_name or "000000")

    subject = f"Your {otp_code} Verification Code – REC OD Portal"
    
    text_body = f"""Dear {recipient_name},

We received a request for {purpose} on your Rajalakshmi Engineering College OD Tracking account.

Your 6-Digit Verification Code (OTP) is:
=======================================
               {otp_code}
=======================================

This OTP is valid for 5 minutes only and can only be used once.

For your security:
- Never share this code with anyone, including college staff or administration.
- If you did not request this OTP, please contact the IT Administrator immediately.

Best regards,
Rajalakshmi Engineering College Administration
    """

    main_html = f"""
    <p>We received a request for <strong>{purpose}</strong> on your official REC OD Tracking account.</p>
    
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #bae6fd; font-weight: 700; margin-bottom: 6px;">Your One-Time Passcode (OTP)</div>
      <div style="font-size: 38px; font-weight: 900; letter-spacing: 0.25em; font-family: monospace; padding-left: 0.25em;">{otp_code}</div>
      <div style="font-size: 12px; color: #e0f2fe; margin-top: 8px;">Valid for <strong>5 minutes</strong> &bull; Single-use only</div>
    </div>

    <div class="card-box" style="border-left: 4px solid #f59e0b;">
      <strong style="color: #b45309; display: block; margin-bottom: 4px;">Security Notice:</strong>
      <span style="font-size: 12px; color: #475569;">Never share this verification code with anyone. Official college administrators will never ask for your password or OTP. If you did not request this code, your account may be secure, but you should notify the IT desk.</span>
    </div>
    """

    html_body = _render_base_email("One-Time Password Verification", "Security Verification", recipient_name, main_html)
    return send_email(to_email, subject, html_body, text_body)


def send_password_changed_notification(to_email: str, recipient_name: str) -> bool:
    """Send alert confirming that password was successfully modified."""
    subject = "Security Alert: Password Changed Successfully – REC OD Portal"
    
    text_body = f"""Dear {recipient_name},

This email confirms that the password for your Rajalakshmi Engineering College OD Tracking account was successfully changed.

If you made this change, no further action is required.

If you DID NOT make this change, please report this immediately to the IT Department or reset your password using the Forgot Password service.

Best regards,
Rajalakshmi Engineering College IT Team
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 15px; display: block; margin-bottom: 6px;">Password Updated Successfully</strong>
      <p style="margin: 0; font-size: 13px; color: #166534;">The password for your account has been updated securely. You can now use your new password to sign in across all portals.</p>
    </div>

    <p style="color: #475569; font-size: 13px;">If you initiated this change, you may safely disregard this message. If you did not perform this change, please contact the institutional IT administrator immediately to secure your credentials.</p>
    """

    html_body = _render_base_email("Password Changed Successfully", "Security Alert", recipient_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_verification_email(to_email: str, recipient_name: str, verification_token: str) -> bool:
    """Send account email verification link."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    verify_url = f"{base_url}/verify-email/{verification_token}"
    subject = "Verify your Rajalakshmi Engineering College account"

    text_body = f"""Dear {recipient_name},

Thank you for creating an account with the Rajalakshmi Engineering College (REC) On-Duty (OD) Tracking Portal.

Please verify your college email address by opening the link below:
{verify_url}

This link is valid for 24 hours.

Best regards,
Rajalakshmi Engineering College Administration
    """

    main_html = f"""
    <p>Thank you for registering on the REC On-Duty (OD) Tracking Portal. Please verify your official institutional email address to activate your account.</p>
    <p style="font-size: 12px; color: #64748b;">This verification link will expire in 24 hours.</p>
    """

    html_body = _render_base_email("Verify Email Address", "Account Activation", recipient_name, main_html, verify_url, "Verify My Email Address")
    return send_email(to_email, subject, html_body, text_body)


# ──────────────────────────────────────────────────────────────────────────────
# 2. OD Application & Workflow Lifecycle Email Notifications
# ──────────────────────────────────────────────────────────────────────────────

def send_od_submitted_student_notification(to_email: str, student_name: str, event_name: str, dates: str, request_id: str):
    """Notify student that their OD request was submitted successfully."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    dash_url = f"{base_url}/student/requests"
    subject = f"OD Request Submitted – {event_name} (ID: {request_id})"

    text_body = f"""Dear {student_name},

Your On-Duty (OD) application for '{event_name}' ({dates}) has been successfully submitted (ID: {request_id}).

Your request has been routed to your Faculty Mentor for Level-1 review. You will receive email notifications as your application progresses through each approval stage.

Track your request: {dash_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <p>Your On-Duty (OD) application has been successfully submitted and logged into the system.</p>
    <div class="card-box">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Request ID:</td><td style="font-weight: 700; color: #0f172a;">{request_id}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Event Name:</td><td style="font-weight: 700; color: #0f172a;">{event_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Event Dates:</td><td style="font-weight: 600; color: #0f172a;">{dates}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Current Stage:</td><td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 700;">Mentor Review</span></td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #475569;">Your application has been routed to your assigned Faculty Mentor. You will receive real-time email updates as each approval authority reviews your request.</p>
    """

    html_body = _render_base_email("OD Application Submitted", "OD Submission", student_name, main_html, dash_url, "Track My Request")
    return send_email_async(to_email, subject, html_body, text_body)


def send_new_od_mentor_notification(mentor_email: str, mentor_name: str, student_name: str, event_name: str, dates: str, request_id: str):
    """Notify Mentor that a student submitted an OD request awaiting review."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    review_url = f"{base_url}/faculty/dashboard"
    subject = f"Action Required: New OD Application from {student_name} (ID: {request_id})"

    text_body = f"""Dear {mentor_name},

A new On-Duty (OD) application has been submitted by student {student_name} and requires your review as Faculty Mentor:

Request ID: {request_id}
Event Name: {event_name}
Dates: {dates}

Please log in to review the event brochure and recommend or reject the request:
{review_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <p>A new On-Duty (OD) application has been submitted by your mentee and is currently awaiting your review.</p>
    <div class="card-box" style="border-left: 4px solid #0284c7;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: 700; color: #0f172a;">{student_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Event Name:</td><td style="font-weight: 700; color: #0f172a;">{event_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Duration:</td><td style="font-weight: 600; color: #0f172a;">{dates}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Request ID:</td><td style="font-family: monospace; color: #0f172a;">{request_id}</td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #475569;">Please log in to inspect the attached OD letter / event proof and submit your recommendation.</p>
    """

    html_body = _render_base_email("New OD Request Awaiting Mentor Review", "Mentor Review Required", mentor_name, main_html, review_url, "Open Faculty Portal")
    return send_email_async(mentor_email, subject, html_body, text_body)


def send_od_mentor_approved_student_notification(to_email: str, student_name: str, event_name: str, remarks: str = ""):
    """Notify student that Mentor recommended OD and forwarded to Class Incharge."""
    subject = f"OD Application Recommended by Mentor – {event_name}"
    
    text_body = f"""Dear {student_name},

Good news! Your Faculty Mentor has reviewed and recommended your On-Duty request for '{event_name}'.
Mentor Remarks: {remarks or 'Recommended'}

Your application has now been forwarded to the Class Incharge for Stage 2 (Attendance & Academic Eligibility Review).

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 14px;">Stage 1 Approved: Recommended by Mentor</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534;">Your OD application for <strong>{event_name}</strong> was reviewed and recommended by your Faculty Mentor.</p>
      {f'<p style="margin: 8px 0 0 0; font-size: 12px; color: #15803d;"><strong>Remarks:</strong> {remarks}</p>' if remarks else ''}
    </div>
    <p style="font-size: 13px; color: #475569;">Your request has been forwarded to the <strong>Class Incharge</strong> for attendance and academic eligibility audit.</p>
    """

    html_body = _render_base_email("OD Recommended by Mentor", "Stage 1 Approved", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_forwarded_class_incharge_notification(ci_email: str, ci_name: str, student_name: str, event_name: str, request_id: str):
    """Notify Class Incharge that an OD request is awaiting Section Review."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    ci_url = f"{base_url}/class-incharge/dashboard"
    subject = f"Action Required: OD Application Awaiting Class Incharge Review (ID: {request_id})"

    text_body = f"""Dear {ci_name},

The On-Duty application for student {student_name} ({event_name}, ID: {request_id}) has been recommended by the Faculty Mentor and is now awaiting your Class Incharge verification.

Please log in to audit section attendance thresholds and forward to the HOD:
{ci_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <p>An On-Duty (OD) request has been recommended by the Faculty Mentor and is now awaiting your Class Incharge verification.</p>
    <div class="card-box">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: 700;">{student_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Event:</td><td style="font-weight: 700;">{event_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Request ID:</td><td style="font-family: monospace;">{request_id}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Status:</td><td><span style="color: #0369a1; font-weight: 700;">Mentor Approved &bull; Awaiting Class Incharge</span></td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #475569;">Please verify the student's attendance percentage and CAT test scores before endorsing to the Head of Department.</p>
    """

    html_body = _render_base_email("OD Awaiting Class Incharge Review", "Action Required", ci_name, main_html, ci_url, "Review Request")
    return send_email_async(ci_email, subject, html_body, text_body)


def send_od_mentor_rejected_student_notification(to_email: str, student_name: str, event_name: str, reason: str):
    """Notify student that Mentor rejected the OD request."""
    subject = f"OD Application Update: Not Recommended by Mentor – {event_name}"
    
    text_body = f"""Dear {student_name},

Your On-Duty application for '{event_name}' was not recommended by your Faculty Mentor.

Reason:
{reason}

If you have questions, please consult with your Faculty Mentor.

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2;">
      <strong style="color: #b91c1c; font-size: 14px;">OD Application Not Recommended</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">Your OD application for <strong>{event_name}</strong> was declined by your Faculty Mentor.</p>
      <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-top: 10px; font-size: 13px; color: #7f1d1d;">
        <strong>Reason for rejection:</strong><br>{reason}
      </div>
    </div>
    """

    html_body = _render_base_email("OD Request Not Recommended", "Decision Notification", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_ci_approved_student_notification(to_email: str, student_name: str, event_name: str, remarks: str = ""):
    """Notify student that Class Incharge endorsed OD and forwarded to HOD."""
    subject = f"OD Application Endorsed by Class Incharge – {event_name}"
    
    text_body = f"""Dear {student_name},

Your On-Duty application for '{event_name}' has been endorsed by your Class Incharge.
Remarks: {remarks or 'Attendance and eligibility verified'}

The request has now been forwarded to the Head of Department (HOD) for executive sanction.

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 14px;">Stage 2 Approved: Endorsed by Class Incharge</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534;">Section attendance and academic eligibility for <strong>{event_name}</strong> have been verified.</p>
      {f'<p style="margin: 8px 0 0 0; font-size: 12px; color: #15803d;"><strong>Remarks:</strong> {remarks}</p>' if remarks else ''}
    </div>
    <p style="font-size: 13px; color: #475569;">Your application has been forwarded to the <strong>Head of Department (HOD)</strong> for final executive sanction.</p>
    """

    html_body = _render_base_email("OD Endorsed by Class Incharge", "Stage 2 Approved", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_forwarded_hod_notification(hod_email: str, hod_name: str, student_name: str, event_name: str, request_id: str):
    """Notify HOD that an OD request is awaiting Executive Approval."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    hod_url = f"{base_url}/hod/dashboard"
    subject = f"Action Required: OD Application Awaiting HOD Sanction (ID: {request_id})"

    text_body = f"""Dear {hod_name},

An On-Duty (OD) application for student {student_name} ({event_name}, ID: {request_id}) has received Mentor and Class Incharge endorsements and is awaiting your executive sanction.

Review & Sanction: {hod_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <p>An On-Duty application has cleared Faculty Mentor and Class Incharge audits and is awaiting your executive sanction.</p>
    <div class="card-box">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: 700;">{student_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Event:</td><td style="font-weight: 700;">{event_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Request ID:</td><td style="font-family: monospace;">{request_id}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Workflow Stage:</td><td><span style="color: #7c3aed; font-weight: 700;">Final HOD Sanction</span></td></tr>
      </table>
    </div>
    """

    html_body = _render_base_email("OD Awaiting HOD Sanction", "Executive Sanction Required", hod_name, main_html, hod_url, "Open HOD Executive Dashboard")
    return send_email_async(hod_email, subject, html_body, text_body)


def send_od_ci_rejected_student_notification(to_email: str, student_name: str, event_name: str, reason: str):
    """Notify student that Class Incharge rejected the OD request."""
    subject = f"OD Application Update: Declined by Class Incharge – {event_name}"
    
    text_body = f"""Dear {student_name},

Your On-Duty application for '{event_name}' was declined by your Class Incharge.

Reason:
{reason}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2;">
      <strong style="color: #b91c1c; font-size: 14px;">OD Application Declined by Class Incharge</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">Your OD application for <strong>{event_name}</strong> was not approved at Section Review.</p>
      <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-top: 10px; font-size: 13px; color: #7f1d1d;">
        <strong>Reason:</strong><br>{reason}
      </div>
    </div>
    """

    html_body = _render_base_email("OD Declined by Class Incharge", "Decision Notification", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_hod_approved_student_notification(to_email: str, student_name: str, event_name: str, remarks: str = ""):
    """Notify student that HOD approved OD – Reminder to upload certificate within 24h of event end."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    cert_url = f"{base_url}/student/certificates"
    subject = f"OD Application Officially Approved by HOD! – {event_name}"

    text_body = f"""Dear {student_name},

Congratulations! Your On-Duty request for '{event_name}' has been officially sanctioned by the Head of Department (HOD).

CRITICAL REQUIREMENT:
You must attend the event and upload your official participation certificate within 24 hours after the event ends.
If the certificate is not uploaded within this 24-hour window, the OD sanction will automatically lapse.

Upload Certificate: {cert_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 15px;">Official HOD Sanction Granted</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #166534;">Your On-Duty application for <strong>{event_name}</strong> has received final approval from the Head of Department.</p>
    </div>

    <div class="card-box" style="border-left: 4px solid #f59e0b; background-color: #fffbeb;">
      <strong style="color: #b45309; font-size: 13px; display: block; margin-bottom: 4px;">Mandatory Certificate Upload Window:</strong>
      <span style="font-size: 13px; color: #78350f;">
        Please attend the event and upload your official certificate within <strong>24 hours</strong> of the event ending. OD attendance credits will be committed immediately upon faculty certificate verification.
      </span>
    </div>
    """

    html_body = _render_base_email("OD Sanctioned by HOD", "HOD Sanction Granted", student_name, main_html, cert_url, "View Certificate Portal")
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_hod_rejected_student_notification(to_email: str, student_name: str, event_name: str, reason: str):
    """Notify student that HOD rejected OD request."""
    subject = f"OD Application Decision: Declined by HOD – {event_name}"
    
    text_body = f"""Dear {student_name},

Your On-Duty application for '{event_name}' was not sanctioned by the Head of Department (HOD).

Executive Reason:
{reason}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2;">
      <strong style="color: #b91c1c; font-size: 14px;">OD Application Declined by HOD</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">Your application for <strong>{event_name}</strong> was declined at the final sanction stage.</p>
      <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-top: 10px; font-size: 13px; color: #7f1d1d;">
        <strong>HOD Remarks:</strong><br>{reason}
      </div>
    </div>
    """

    html_body = _render_base_email("OD Declined by HOD", "Decision Notification", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_certificate_reminder_student_notification(to_email: str, student_name: str, event_name: str, deadline_str: str):
    """Send certificate deadline reminder email to student."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    cert_url = f"{base_url}/student/certificates"
    subject = f"URGENT Reminder: Upload Certificate for {event_name} Before Deadline"

    text_body = f"""Dear {student_name},

This is an urgent reminder that your event '{event_name}' has concluded.

You must upload your participation certificate before the 24-hour deadline:
Deadline: {deadline_str}

Upload now to prevent automatic rejection:
{cert_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #f59e0b; background-color: #fffbeb;">
      <strong style="color: #b45309; font-size: 14px;">Urgent: Certificate Upload Window Closing</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #78350f;">
        Your event <strong>{event_name}</strong> has concluded. Please upload your proof of participation before the 24-hour window expires on <strong>{deadline_str}</strong>.
      </p>
    </div>
    """

    html_body = _render_base_email("Upload Certificate Reminder", "Deadline Reminder", student_name, main_html, cert_url, "Upload Certificate Now")
    return send_email_async(to_email, subject, html_body, text_body)


def send_certificate_uploaded_student_notification(to_email: str, student_name: str, event_name: str):
    """Notify student that certificate was successfully uploaded and submitted for review."""
    subject = f"Certificate Uploaded Successfully – {event_name}"
    
    text_body = f"""Dear {student_name},

Your participation certificate for '{event_name}' was uploaded successfully within the required window.

It has been submitted to your faculty mentor for verification.

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 14px;">Certificate Received On-Time</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534;">
        Your participation certificate for <strong>{event_name}</strong> has been logged and submitted for faculty verification.
      </p>
    </div>
    """

    html_body = _render_base_email("Certificate Submitted", "Verification In Progress", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_certificate_submitted_faculty_notification(faculty_email: str, faculty_name: str, student_name: str, event_name: str, request_id: str):
    """Notify faculty that a certificate has been uploaded for verification."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    verify_url = f"{base_url}/faculty/dashboard"
    subject = f"Certificate Verification Needed: {student_name} – {event_name}"

    text_body = f"""Dear {faculty_name},

Student {student_name} has uploaded a participation certificate for '{event_name}' (ID: {request_id}).

Please review and verify the certificate:
{verify_url}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <p>Student <strong>{student_name}</strong> has uploaded a certificate for <strong>{event_name}</strong>.</p>
    <div class="card-box">
      <p style="margin: 0; font-size: 13px; color: #334155;">Request ID: <strong>{request_id}</strong><br>Please inspect the certificate document to complete this OD request.</p>
    </div>
    """

    html_body = _render_base_email("Certificate Verification Needed", "Certificate Review", faculty_name, main_html, verify_url, "Verify Certificate")
    return send_email_async(faculty_email, subject, html_body, text_body)


def send_certificate_verified_student_notification(to_email: str, student_name: str, event_name: str, remarks: str = ""):
    """Notify student that certificate is verified and OD completed."""
    subject = f"OD Complete & Verified! – {event_name}"
    
    text_body = f"""Dear {student_name},

Great news! Your participation certificate for '{event_name}' has been verified by the faculty.

Your OD application is officially COMPLETED. Attendance credit has been sanctioned and updated in your academic record.

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4;">
      <strong style="color: #15803d; font-size: 15px;">OD Request Completed & Attendance Credited</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #166534;">
        Your certificate for <strong>{event_name}</strong> has been verified. Compensatory On-Duty attendance credit is confirmed in your official record.
      </p>
      {f'<p style="margin: 8px 0 0 0; font-size: 12px; color: #15803d;"><strong>Faculty Feedback:</strong> {remarks}</p>' if remarks else ''}
    </div>
    """

    html_body = _render_base_email("OD Successfully Completed", "OD Completed", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_certificate_rejected_student_notification(to_email: str, student_name: str, event_name: str, remarks: str):
    """Notify student that certificate was rejected."""
    subject = f"Certificate Verification Declined – {event_name}"
    
    text_body = f"""Dear {student_name},

Your participation certificate for '{event_name}' was not accepted by the verifying faculty.

Remarks:
{remarks}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2;">
      <strong style="color: #b91c1c; font-size: 14px;">Certificate Verification Declined</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">The certificate for <strong>{event_name}</strong> could not be verified.</p>
      <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; margin-top: 10px; font-size: 13px; color: #7f1d1d;">
        <strong>Remarks:</strong><br>{remarks}
      </div>
    </div>
    """

    html_body = _render_base_email("Certificate Declined", "Verification Declined", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_od_expired_student_notification(to_email: str, student_name: str, event_name: str, reason: str):
    """Notify student that OD expired because certificate was not uploaded in 24h."""
    subject = f"OD Request Lapsed: 24-Hour Certificate Window Expired – {event_name}"
    
    text_body = f"""Dear {student_name},

Your On-Duty sanction for '{event_name}' has been automatically canceled because the required event certificate was not uploaded within 24 hours after the event ended.

System Reason:
{reason}

Best regards,
REC OD Tracking System
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2;">
      <strong style="color: #b91c1c; font-size: 14px;">OD Sanction Lapsed (Window Expired)</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;">
        Your On-Duty sanction for <strong>{event_name}</strong> was canceled because no certificate was submitted within 24 hours of the event concluding.
      </p>
    </div>
    """

    html_body = _render_base_email("OD Window Expired", "Sanction Expired", student_name, main_html)
    return send_email_async(to_email, subject, html_body, text_body)


def send_admin_security_alert(admin_email: str, admin_name: str, title: str, details: str):
    """Send security or critical system operational alert to System Administrator."""
    subject = f"Admin Security Alert: {title} – REC OD Portal"
    
    text_body = f"""Dear {admin_name},

System Alert: {title}

Details:
{details}

Best regards,
REC OD System Automated Governance
    """

    main_html = f"""
    <div class="card-box" style="border-left: 4px solid #f59e0b; background-color: #fffbeb;">
      <strong style="color: #b45309; font-size: 14px;">{title}</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #78350f;">{details}</p>
    </div>
    """

    html_body = _render_base_email("Administrative Alert", "System Alert", admin_name, main_html)
    return send_email_async(admin_email, subject, html_body, text_body)


# ──────────────────────────────────────────────────────────────────────────────
# 3. Stakeholder Discovery Helpers for Accurate Recipient Targeting
# ──────────────────────────────────────────────────────────────────────────────

def get_student_info(student_id_or_doc):
    """Resolve (email, name) for a student."""
    if isinstance(student_id_or_doc, dict):
        email = student_id_or_doc.get('studentEmail') or student_id_or_doc.get('email')
        name = student_id_or_doc.get('studentName') or student_id_or_doc.get('name') or 'Student'
        if email:
            return email, name
        student_id = student_id_or_doc.get('student_id') or student_id_or_doc.get('studentId')
    else:
        student_id = student_id_or_doc

    try:
        from backend.models.user import UserModel
        u = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)
        if u:
            return u.get('email'), u.get('name')
    except Exception:
        pass
    return None, 'Student'


def get_mentors_for_department(department: str = None):
    """Find Mentor users matching department."""
    try:
        from backend.database.mongodb import users_collection
        col = users_collection()
        if col is None:
            return []
        query = {"$or": [{"role": {"$regex": "^mentor$", "$options": "i"}}, {"sub_role": {"$regex": "^mentor$", "$options": "i"}}]}
        if department:
            query = {"$and": [query, {"department": {"$regex": f"^{department.strip()}$", "$options": "i"}}]}
        cursor = col.find(query)
        return [(u.get('email'), u.get('name')) for u in cursor if u.get('email')]
    except Exception:
        return []


def get_class_incharges_for_department(department: str = None, section: str = None):
    """Find Class Incharge users matching department/section."""
    try:
        from backend.database.mongodb import users_collection
        col = users_collection()
        if col is None:
            return []
        query = {"$or": [{"role": {"$regex": "^class incharge$", "$options": "i"}}, {"sub_role": {"$regex": "^class incharge$", "$options": "i"}}]}
        if department:
            query = {"$and": [query, {"department": {"$regex": f"^{department.strip()}$", "$options": "i"}}]}
        cursor = col.find(query)
        return [(u.get('email'), u.get('name')) for u in cursor if u.get('email')]
    except Exception:
        return []


def get_hods_for_department(department: str = None):
    """Find HOD users matching department."""
    try:
        from backend.database.mongodb import users_collection
        col = users_collection()
        if col is None:
            return []
        query = {"$or": [{"role": {"$regex": "^hod$", "$options": "i"}}, {"sub_role": {"$regex": "^hod$", "$options": "i"}}]}
        if department:
            query = {"$and": [query, {"department": {"$regex": f"^{department.strip()}$", "$options": "i"}}]}
        cursor = col.find(query)
        return [(u.get('email'), u.get('name')) for u in cursor if u.get('email')]
    except Exception:
        return []


def get_admin_users():
    """Find Admin users."""
    try:
        from backend.database.mongodb import users_collection
        col = users_collection()
        if col is None:
            return []
        cursor = col.find({"role": {"$regex": "^admin$", "$options": "i"}})
        return [(u.get('email'), u.get('name')) for u in cursor if u.get('email')]
    except Exception:
        return []


class EmailService:
    """Class wrapper providing static access to all email dispatch methods."""
    send_email = staticmethod(send_email)
    send_email_async = staticmethod(send_email_async)
    send_password_reset_email = staticmethod(send_password_reset_email)
    send_otp_email = staticmethod(send_otp_email)
    send_password_changed_notification = staticmethod(send_password_changed_notification)
    send_verification_email = staticmethod(send_verification_email)

    @staticmethod
    def send_od_submitted_student(req_data: dict):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        dates = f"{req_data.get('from_date', '')} to {req_data.get('to_date', '')}".strip() or 'N/A'
        req_id = str(req_data.get('id') or req_data.get('_id') or '')
        return send_od_submitted_student_notification(email, name, event, dates, req_id)

    @staticmethod
    def send_mentor_approved_student(req_data: dict, remarks: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_mentor_approved_student_notification(email, name, event, remarks)

    @staticmethod
    def send_mentor_rejected_student(req_data: dict, reason: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_mentor_rejected_student_notification(email, name, event, reason)

    @staticmethod
    def send_class_incharge_approved_student(req_data: dict, remarks: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_ci_approved_student_notification(email, name, event, remarks)

    @staticmethod
    def send_class_incharge_rejected_student(req_data: dict, reason: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_ci_rejected_student_notification(email, name, event, reason)

    @staticmethod
    def send_hod_approved_student(req_data: dict, remarks: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_hod_approved_student_notification(email, name, event, remarks)

    @staticmethod
    def send_hod_rejected_student(req_data: dict, reason: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_hod_rejected_student_notification(email, name, event, reason)

    @staticmethod
    def send_certificate_uploaded_student(req_data: dict):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_certificate_uploaded_student_notification(email, name, event)

    @staticmethod
    def send_certificate_verified_student(req_data: dict, remarks: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_certificate_verified_student_notification(email, name, event, remarks)

    @staticmethod
    def send_certificate_rejected_student(req_data: dict, remarks: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_certificate_rejected_student_notification(email, name, event, remarks)

    @staticmethod
    def send_od_expired_student(req_data: dict, reason: str = ""):
        email = req_data.get('student_email') or req_data.get('email') or 'student@rajalakshmi.edu.in'
        name = req_data.get('student_name') or 'Student'
        event = req_data.get('event_name') or req_data.get('eventName') or 'Event'
        return send_od_expired_student_notification(email, name, event, reason)

