"""Authentication and session management routes."""
import os
import sys
import hmac
import hashlib
import time
from functools import wraps

# Ensure project root is in sys.path so 'backend.*' imports succeed in all environments
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from flask import Blueprint, request, jsonify, session, current_app, g
from werkzeug.local import LocalProxy
try:
    from backend.models.user import UserModel, validate_college_email
    from backend.database.mongodb import users_collection
    from backend.services.email_service import (
        send_otp_email,
        send_password_changed_notification,
        send_password_reset_email,
        send_verification_email
    )
except ImportError:
    from models.user import UserModel, validate_college_email
    from database.mongodb import users_collection
    from services.email_service import (
        send_otp_email,
        send_password_changed_notification,
        send_password_reset_email,
        send_verification_email
    )

auth_bp = Blueprint('auth', __name__)

def get_authenticated_user():
    """Retrieve current authenticated user from flask.g or fallback to session/token."""
    user = getattr(g, 'current_user', None)
    if user is not None:
        return user
    return get_current_authenticated_user()

current_user = LocalProxy(get_authenticated_user)

ROLE_DASHBOARDS = {
    'Student': '/student/dashboard',
    'Mentor': '/faculty/dashboard',
    'Class Incharge': '/class-incharge/dashboard',
    'HOD': '/hod/dashboard',
    'Admin': '/admin/dashboard',
    'student': '/student/dashboard',
    'mentor': '/faculty/dashboard',
    'faculty': '/faculty/dashboard',
    'class_incharge': '/class-incharge/dashboard',
    'hod': '/hod/dashboard',
    'admin': '/admin/dashboard',
}

def generate_auth_token(user_id, role):
    """Generate a tamper-evident signed token for API authorization."""
    try:
        secret = current_app.config.get('SECRET_KEY', 'od_tracking_system_rec_secret_key_2026')
    except RuntimeError:
        secret = 'od_tracking_system_rec_secret_key_2026'
    timestamp = int(time.time())
    payload = f"{user_id}:{role}:{timestamp}"
    signature = hmac.new(secret.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()[:24]
    return f"rec_{payload}:{signature}"

def parse_auth_token(token):
    """Validate and parse a signed token, returning (user_id, role) if valid."""
    if not token:
        return None, None
    if token.startswith('rec_'):
        try:
            raw = token[4:]
            parts = raw.split(':')
            if len(parts) == 4:
                user_id, role, timestamp_str, signature = parts
                try:
                    secret = current_app.config.get('SECRET_KEY', 'od_tracking_system_rec_secret_key_2026')
                except RuntimeError:
                    secret = 'od_tracking_system_rec_secret_key_2026'
                payload = f"{user_id}:{role}:{timestamp_str}"
                expected_sig = hmac.new(secret.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()[:24]
                if hmac.compare_digest(signature, expected_sig):
                    return user_id, role
        except Exception:
            pass
    # Support client session tokens like jwt_student_<id>_... or jwt_faculty_<id>_...
    if token.startswith('jwt_student_'):
        parts = token.split('_')
        if len(parts) >= 3:
            stu_id = parts[2]
            stu = UserModel.get_by_id(stu_id) or UserModel.get_by_identifier(stu_id)
            if stu and stu.get('role') == 'Student':
                return stu['id'], 'Student'
    if token.startswith('jwt_faculty_'):
        parts = token.split('_')
        if len(parts) >= 3:
            fac_id = parts[2]
            fac = UserModel.get_by_id(fac_id) or UserModel.get_by_identifier(fac_id)
            if fac:
                return fac['id'], fac['role']
    return None, None

def get_current_authenticated_user():
    """Retrieve current user from Bearer Authorization header or session."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
        token_uid, _ = parse_auth_token(token)
        if token_uid:
            user = UserModel.get_by_id(token_uid) or UserModel.get_by_identifier(token_uid)
            if user:
                return user

    user_id = session.get('user_id')
    if user_id:
        user = UserModel.get_by_id(user_id) or UserModel.get_by_identifier(user_id)
        if user:
            return user

    return None

def login_required(f):
    """Route decorator enforcing user authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_authenticated_user()
        if not user:
            return jsonify({'success': False, 'error': 'Authentication required. Please log in.'}), 401
        g.current_user = user
        setattr(request, 'current_user', user)
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    """Route decorator enforcing specific role permissions."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_authenticated_user()
            if not user:
                return jsonify({'success': False, 'error': 'Authentication required. Please log in.'}), 401
            
            user_role = user.get('role')
            normalized_allowed = [r.lower() for r in allowed_roles]
            if user_role and user_role.lower() not in normalized_allowed:
                return jsonify({
                    'success': False,
                    'error': f"Forbidden: This resource requires {'/'.join(allowed_roles)} role privileges.",
                    'userRole': user_role
                }), 403
            
            g.current_user = user
            setattr(request, 'current_user', user)
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate user by username / email / register number + password against MongoDB users collection.
    Returns authenticated user profile, token, and target role-based dashboard URL.
    """
    data = request.get_json(silent=True) or {}
    identifier = (data.get('identifier') or data.get('username') or data.get('email') or data.get('registerNo') or '').strip()
    password = (data.get('password') or '').strip()
    requested_role = (data.get('role') or '').strip()

    if not identifier or not password:
        return jsonify({
            'success': False,
            'error': 'Username / Email / Register Number and Password are required.'
        }), 400

    # Query user from MongoDB users collection
    user = UserModel.get_by_identifier(identifier)

    if not user:
        return jsonify({
            'success': False,
            'error': 'Invalid credentials. User account not found in the institution database.'
        }), 401

    # Verify password hash
    if not UserModel.verify_password(user, password):
        return jsonify({
            'success': False,
            'error': 'Invalid password. Please verify your credentials and try again.'
        }), 401

    # Check if account is disabled
    if user.get('account_status') == 'DISABLED':
        return jsonify({
            'success': False,
            'error': 'Account is disabled. Please contact the institution administrator.'
        }), 401

    # Check if email is unverified
    if user.get('email_verified') is False or user.get('account_status') == 'UNVERIFIED':
        return jsonify({
            'success': False,
            'error': 'Please verify your email before logging in. A verification link has been sent to your email.'
        }), 401

    # If login initiated from a specific role portal, check role compatibility
    user_role = user['role']
    req_role_lower = requested_role.lower() if requested_role else ''
    user_role_lower = user_role.lower()
    sub_role_lower = (user.get('sub_role') or '').lower()

    faculty_roles = {'faculty', 'mentor'}
    role_matches = (
        not requested_role or
        req_role_lower == user_role_lower or
        req_role_lower == sub_role_lower or
        (req_role_lower in faculty_roles and user_role_lower in faculty_roles)
    )
    if not role_matches:
        return jsonify({
            'success': False,
            'error': f"Access restricted: You are registered as a {user_role}. Please log in via the {user_role} Portal."
        }), 401

    dashboard_url = ROLE_DASHBOARDS.get(user_role, '/student/dashboard')
    token = generate_auth_token(user['id'], user_role)

    # Set server-side session
    session['user_id'] = user['id']
    session['role'] = user_role
    session['name'] = user['name']

    safe_user = UserModel.to_safe_dict(user)
    if safe_user is None:
        safe_user = {k: v for k, v in user.items() if k not in ('password_hash', 'password')}
    safe_user['userId'] = user['id']
    safe_user['token'] = token

    return jsonify({
        'success': True,
        'message': f'Authenticated successfully as {user_role}. Redirecting to dashboard.',
        'user': safe_user,
        'role': user_role,
        'token': token,
        'redirectUrl': dashboard_url,
        'dashboardUrl': dashboard_url
    }), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Public student self-registration endpoint.
    Restricts domain strictly to @rajalakshmi.edu.in.
    Prohibits self-registration of privileged roles (Admin, HOD).
    Account is created in UNVERIFIED state until email verification.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()
    full_name = (data.get('fullName') or data.get('full_name') or data.get('name') or '').strip()
    register_number = (data.get('registerNumber') or data.get('register_number') or data.get('identifier') or '').strip()
    role = (data.get('role') or 'Student').strip()

    if not email or not password or not confirm_password or not full_name:
        return jsonify({
            'success': False,
            'error': 'All required fields (Full Name, College Email, Password, Confirm Password) must be provided.'
        }), 400

    if password != confirm_password:
        return jsonify({
            'success': False,
            'error': 'Passwords do not match.'
        }), 400

    if len(password) < 6:
        return jsonify({
            'success': False,
            'error': 'Password must be at least 6 characters long.'
        }), 400

    # 1. College email domain restriction
    is_valid_email, norm_email = validate_college_email(email)
    if not is_valid_email or not norm_email:
        return jsonify({
            'success': False,
            'error': 'Registration is restricted to official college email addresses ending in @rajalakshmi.edu.in.'
        }), 400

    # 2. Block self-registration of privileged roles
    if role.lower() in ['admin', 'hod']:
        return jsonify({
            'success': False,
            'error': f'Privileged role ({role}) registration is restricted. Administrative accounts must be provisioned by IT.'
        }), 400

    # 3. Check for existing account
    existing = UserModel.get_by_email(norm_email)
    if existing:
        return jsonify({
            'success': False,
            'error': 'An account with this institutional email already exists. Please log in or use forgot password.'
        }), 400

    if register_number:
        existing_reg = UserModel.get_by_identifier(register_number)
        if existing_reg:
            return jsonify({
                'success': False,
                'error': f'An account with Register Number {register_number} already exists.'
            }), 400

    # 4. Generate verification token
    import secrets
    raw_verify_token = secrets.token_urlsafe(32)
    verify_token_hash = hashlib.sha256(raw_verify_token.encode('utf-8')).hexdigest()

    default_identifier = norm_email.split('@')[0] if norm_email else 'student'
    user_data = {
        'identifier': register_number or default_identifier,
        'name': full_name,
        'email': norm_email,
        'password': password,
        'role': role,
        'email_verified': False,
        'account_status': 'UNVERIFIED',
        'verification_token_hash': verify_token_hash
    }

    created_user = UserModel.create_user(user_data)

    return jsonify({
        'success': True,
        'unverified': True,
        'message': 'Account registered successfully! Please check your institutional email to verify your account.',
        'user': UserModel.to_safe_dict(created_user)
    }), 201

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """
    Method A — Change password using the current password for an authenticated session.
    1. Verify current password against stored password hash.
    2. Validate new password meets length and complexity criteria (min 6 chars, != current).
    3. Ensure new password and confirm password match.
    4. Update password hash securely in the database.
    5. Dispatch email notification alerting the user that their password was changed.
    """
    data = request.get_json(silent=True) or {}
    current_password = (data.get('currentPassword') or data.get('current_password') or '').strip()
    new_password = (data.get('newPassword') or data.get('new_password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()

    if not current_password or not new_password or not confirm_password:
        return jsonify({'success': False, 'error': 'Current password, new password, and confirm password are required.'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'error': 'New password and confirmation password do not match.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'New password must be at least 6 characters long.'}), 400

    if current_password == new_password:
        return jsonify({'success': False, 'error': 'New password cannot be identical to your current password.'}), 400

    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required. Please log in.'}), 401

    if not UserModel.verify_password(user, current_password):
        return jsonify({'success': False, 'error': 'Current password is incorrect. Please check and try again.'}), 400

    success, msg = UserModel.change_password(user['id'], new_password)
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    # Dispatch email confirmation
    if user.get('email'):
        send_password_changed_notification(user['email'], user.get('name') or 'User')

    return jsonify({
        'success': True,
        'message': 'Password has been updated successfully.'
    }), 200

@auth_bp.route('/otp/send', methods=['POST'])
def send_password_otp():
    """
    Method B & Public Forgot Password — Send 6-digit cryptographically secure OTP.
    - If authenticated: retrieves registered email of the authenticated account.
    - If unauthenticated: accepts email address. Never reveals whether arbitrary email exists.
    - Expires in 5 minutes, single-use, rate-limited (60-second cooldown).
    """
    data = request.get_json(silent=True) or {}
    req_email = (data.get('email') or '').strip().lower()
    auth_user = get_current_authenticated_user()

    target_user = None
    email_to_send = None

    if auth_user:
        target_user = auth_user
        email_to_send = auth_user.get('email')
    elif req_email:
        target_user = UserModel.get_by_email(req_email) or UserModel.get_by_identifier(req_email)
        email_to_send = target_user.get('email') if target_user else req_email
    else:
        return jsonify({'success': False, 'error': 'Registered email address or authenticated session is required.'}), 400

    generic_msg = 'If an account exists with this email address, a password reset link has been sent to your inbox.'

    if not target_user or not email_to_send:
        # Mitigate account enumeration: return identical success message even if user not found
        return jsonify({'success': True, 'message': generic_msg}), 200

    raw_otp, updated_user, err = UserModel.create_email_otp(target_user, purpose="password update")
    if err:
        return jsonify({'success': False, 'error': err}), 429

    recipient_name = target_user.get('name') or 'User'
    sent = send_otp_email(email_to_send, recipient_name, raw_otp, purpose="password reset/change")

    # If live SMTP host is specified but transmission failed, report delivery failure
    if not sent and os.environ.get('SMTP_HOST'):
        return jsonify({'success': False, 'error': 'Unable to deliver verification email. Please contact the administrator.'}), 502

    # Mask email for safe UI display (e.g., na***@rajalakshmi.edu.in)
    masked_email = email_to_send
    if '@' in email_to_send:
        local, domain = email_to_send.split('@', 1)
        visible_len = min(2, len(local))
        masked_email = f"{local[:visible_len]}***@{domain}"

    # Return identical generic message on public unauthenticated requests to prevent enumeration,
    # or specific message for authenticated in-app profile users
    response_msg = f'A 6-digit verification code has been sent to {masked_email}. Code expires in 5 minutes.' if auth_user else generic_msg

    return jsonify({
        'success': True,
        'message': response_msg,
        'maskedEmail': masked_email,
        'registeredEmail': email_to_send if auth_user else None
    }), 200

@auth_bp.route('/otp/verify', methods=['POST'])
def verify_password_otp():
    """
    Verify 6-digit OTP code against secure stored hash with 5-minute expiry and attempt limiting.
    Returns single-use reset token upon successful verification.
    """
    data = request.get_json(silent=True) or {}
    otp = (data.get('otp') or data.get('otpCode') or '').strip()
    req_email = (data.get('email') or '').strip().lower()
    auth_user = get_current_authenticated_user()

    if not otp:
        return jsonify({'success': False, 'error': '6-digit OTP code is required.'}), 400

    target_user = auth_user or (UserModel.get_by_email(req_email) if req_email else None)
    if not target_user:
        return jsonify({'success': False, 'error': 'Invalid or expired verification session.'}), 400

    success, raw_reset_token, msg = UserModel.verify_email_otp(target_user, otp)
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    return jsonify({
        'success': True,
        'resetToken': raw_reset_token,
        'reset_token': raw_reset_token,
        'message': 'OTP verified successfully! You may now enter your new password.'
    }), 200

@auth_bp.route('/otp/reset-password', methods=['POST'])
def reset_password_with_otp():
    """
    Update password after OTP verification using single-use reset token or direct OTP verification.
    Enforces security criteria, updates password hash, invalidates tokens, and sends confirmation email.
    """
    data = request.get_json(silent=True) or {}
    reset_token = (data.get('resetToken') or data.get('reset_token') or data.get('token') or '').strip()
    otp = (data.get('otp') or data.get('otpCode') or '').strip()
    new_password = (data.get('newPassword') or data.get('new_password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()
    req_email = (data.get('email') or '').strip().lower()
    auth_user = get_current_authenticated_user()

    if not new_password or not confirm_password:
        return jsonify({'success': False, 'error': 'New password and confirm password are required.'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'error': 'New password and confirmation password do not match.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'New password must be at least 6 characters long.'}), 400

    target_user = auth_user or (UserModel.get_by_email(req_email) if req_email else None)

    # If direct OTP provided without separate verify step, verify OTP first
    if not reset_token and otp and target_user:
        ok, raw_token, err = UserModel.verify_email_otp(target_user, otp)
        if not ok:
            return jsonify({'success': False, 'error': err}), 400
        reset_token = raw_token

    if not reset_token:
        return jsonify({'success': False, 'error': 'Reset verification token or valid OTP is required.'}), 400

    success, msg = UserModel.reset_password(reset_token, new_password)
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    # Dispatch email confirmation
    if target_user and target_user.get('email'):
        send_password_changed_notification(target_user['email'], target_user.get('name') or 'User')

    # Invalidate session for security
    session.clear()

    return jsonify({
        'success': True,
        'message': 'Password has been updated successfully. Please log in with your new credentials.'
    }), 200

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Password reset request endpoint (backwards compatible alias).
    Dispatches 6-digit OTP code to the user's institutional email address.
    """
    return send_password_otp()

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using verified token (backwards compatible alias)."""
    return reset_password_with_otp()

@auth_bp.route('/verify-email', methods=['POST', 'GET'])
def verify_email():
    """Verify email address using verification token."""
    token = request.args.get('token') or ((request.get_json(silent=True) or {}).get('token'))
    if not token:
        return jsonify({'success': False, 'error': 'Verification token is required.'}), 400

    token_hash = hashlib.sha256(token.strip().encode('utf-8')).hexdigest()
    col = users_collection()
    if col is None:
        return jsonify({'success': False, 'error': 'Database unavailable.'}), 500
    user = col.find_one({"verification_token_hash": token_hash})
    if not user:
        return jsonify({'success': False, 'error': 'Invalid verification link or token already used.'}), 400

    from datetime import datetime
    col.update_one(
        {"_id": user['_id']},
        {"$set": {
            "email_verified": True,
            "account_status": "ACTIVE",
            "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }, "$unset": {"verification_token_hash": ""}}
    )

    return jsonify({'success': True, 'message': 'Email verified successfully! You may now log in.'}), 200

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Retrieve currently authenticated user profile from session or Bearer token."""
    user = get_current_authenticated_user()
    if not user:
        return jsonify({'authenticated': False, 'error': 'Not authenticated'}), 401

    role = user['role']
    safe_user = UserModel.to_safe_dict(user)
    if safe_user is None:
        safe_user = {k: v for k, v in user.items() if k not in ('password_hash', 'password')}
    safe_user['userId'] = user['id']

    return jsonify({
        'authenticated': True,
        'user': safe_user,
        'role': role,
        'dashboardUrl': ROLE_DASHBOARDS.get(role, '/student/dashboard')
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Clear user session."""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200

@auth_bp.route('/protected-check', methods=['GET'])
@login_required
def check_protected_access():
    """Verify authenticated user access and role status."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required.'}), 401
    return jsonify({
        'success': True,
        'message': f"Access granted for {user['name']} ({user['role']})",
        'user': UserModel.to_safe_dict(user)
    }), 200

@auth_bp.route('/role-check/<required_role>', methods=['GET'])
def check_specific_role_access(required_role):
    """Test endpoint to demonstrate role barrier enforcement."""
    user = get_current_authenticated_user()
    if not user:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    
    if user['role'].lower() != required_role.lower():
        return jsonify({
            'success': False,
            'error': f"Forbidden: Requires {required_role} role. You are {user['role']}."
        }), 403

    return jsonify({
        'success': True,
        'message': f"Access granted: Authorized as {user['role']}"
    }), 200

@auth_bp.route('/users', methods=['GET'])
def list_demo_users():
    """List available demo users and their target dashboards for testing."""
    users = UserModel.list_all()
    for item in users:
        if item is not None:
            role_key = item.get('role', 'Student') or 'Student'
            item['dashboardUrl'] = ROLE_DASHBOARDS.get(role_key, '/student/dashboard')

    return jsonify({'users': users}), 200
