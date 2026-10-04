"""
Email Service for OD Tracking System.
Handles real SMTP email delivery for Email Verification and Password Reset.
Falls back gracefully to clean console logging in development mode if SMTP is unconfigured.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from backend.config import Config
except ImportError:
    from config import Config


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Send an email via SMTP server if configured, else log to console/logs.
    Returns True if sent/handled successfully.
    """
    to_email = (to_email or '').strip().lower()
    if not to_email:
        return False

    smtp_host = getattr(Config, 'SMTP_HOST', None) or ''
    smtp_port = int(getattr(Config, 'SMTP_PORT', 587))
    smtp_user = getattr(Config, 'SMTP_USERNAME', None) or ''
    smtp_pass = getattr(Config, 'SMTP_PASSWORD', None) or ''
    from_email = getattr(Config, 'SMTP_FROM_EMAIL', 'noreply@rajalakshmi.edu.in')
    use_tls = getattr(Config, 'SMTP_USE_TLS', True)

    # Check if real SMTP credentials are provided
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"Rajalakshmi Engineering College OD Portal <{from_email}>"
            msg['To'] = to_email

            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            msg.attach(part1)
            msg.attach(part2)

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                if use_tls:
                    server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [to_email], msg.as_string())
            server.quit()
            print(f"[+] SMTP: Email sent successfully to {to_email}")
            return True
        except Exception as e:
            print(f"[-] SMTP Delivery Failed to {to_email}: {e}")
            # Fall through to console logging in dev

    # Development / Fallback Clean Console Logger
    print("\n" + "=" * 80)
    print(f"  [EMAIL DISPATCH - REC OD TRACKING PORTAL]")
    print(f"  To:       {to_email}")
    print(f"  Subject:  {subject}")
    print("-" * 80)
    print(text_body)
    print("=" * 80 + "\n")
    return True


def send_verification_email(to_email: str, recipient_name: str, verification_token: str) -> bool:
    """Send account email verification link."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    verify_url = f"{base_url}/verify-email/{verification_token}"
    subject = "Verify your Rajalakshmi Engineering College account"

    text_body = f"""Dear {recipient_name},

Thank you for creating an account with the Rajalakshmi Engineering College (REC) On-Duty (OD) Tracking Portal.

Please verify your college email address by clicking the link below:
{verify_url}

This link is valid for 24 hours.

If you did not register for this account, please ignore this email.

Best regards,
Rajalakshmi Engineering College Administration
    """

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; shadow: 0 4px 6px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 24px; text-align: center; color: white; }}
        .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; }}
        .header p {{ margin: 4px 0 0 0; opacity: 0.9; font-size: 13px; }}
        .content {{ padding: 32px 24px; line-height: 1.6; }}
        .btn {{ display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin: 20px 0; text-align: center; }}
        .footer {{ background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rajalakshmi Engineering College</h1>
          <p>On-Duty (OD) Tracking System</p>
        </div>
        <div class="content">
          <p>Dear <strong>{recipient_name}</strong>,</p>
          <p>Thank you for registering on the REC OD Tracking System. Please verify your official college email address to activate your account.</p>
          <div style="text-align: center;">
            <a href="{verify_url}" class="btn">Verify My Email Address</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br>
          <a href="{verify_url}" style="color: #0284c7;">{verify_url}</a></p>
          <p style="font-size: 12px; color: #94a3b8;">This verification link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          &copy; 2026 Rajalakshmi Engineering College. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body)


def send_password_reset_email(to_email: str, recipient_name: str, reset_token: str) -> bool:
    """Send secure password reset email link."""
    base_url = getattr(Config, 'APP_BASE_URL', 'http://localhost:5173').rstrip('/')
    reset_url = f"{base_url}/reset-password/{reset_token}"
    subject = "Reset your OD Tracking Application password"

    text_body = f"""Dear {recipient_name},

We received a request to reset the password for your Rajalakshmi Engineering College OD Tracking account.

Click the link below to set a new password:
{reset_url}

This link is valid for 1 hour and can only be used once.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
Rajalakshmi Engineering College IT Team
    """

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #1e3a8a, #dc2626); padding: 24px; text-align: center; color: white; }}
        .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; }}
        .header p {{ margin: 4px 0 0 0; opacity: 0.9; font-size: 13px; }}
        .content {{ padding: 32px 24px; line-height: 1.6; }}
        .btn {{ display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin: 20px 0; text-align: center; }}
        .footer {{ background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rajalakshmi Engineering College</h1>
          <p>Password Reset Request</p>
        </div>
        <div class="content">
          <p>Dear <strong>{recipient_name}</strong>,</p>
          <p>We received a request to reset your password for the REC OD Tracking System.</p>
          <div style="text-align: center;">
            <a href="{reset_url}" class="btn">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br>
          <a href="{reset_url}" style="color: #dc2626;">{reset_url}</a></p>
          <p style="font-size: 12px; color: #94a3b8;">This single-use link is valid for 1 hour. If you did not request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          &copy; 2026 Rajalakshmi Engineering College. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    return send_email(to_email, subject, html_body, text_body)
