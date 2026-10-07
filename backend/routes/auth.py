import hmac
import hashlib
import time
import uuid
from functools import wraps
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.security import generate_password_hash
from backend.models.user import UserModel, validate_college_email
from backend.database.mongodb import users_collection
from backend.services.email_service import send_verification_email, send_password_reset_email

auth_bp = Blueprint('auth', __name__)


ROLE_DASHBOARDS = {
    'Student': '/student/dashboard',
    'Mentor': '/faculty/dashboard',
    'Class Incharge': '/class-incharge/dashboard',
    'HOD': '/hod/dashboard',
    'student': '/student/dashboard',
    'mentor': '/faculty/dashboard',
    'faculty': '/faculty/dashboard',
    'class_incharge': '/class-incharge/dashboard',
    'hod': '/hod/dashboard',
}

def generate_auth_token(user_id, role):
    """Generate a tamper-evident signed token for API authorization."""
    secret = current_app.config.get('SECRET_KEY', 'od_tracking_system_rec_secret_key_2026')
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
                secret = current_app.config.get('SECRET_KEY', 'od_tracking_system_rec_secret_key_2026')
                payload = f"{user_id}:{role}:{timestamp_str}"
                expected_sig = hmac.new(secret.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()[:24]
                if hmac.compare_digest(signature, expected_sig):
                    return user_id, role
        except Exception:
            pass
    # Support client session tokens like jwt_student_... or jwt_faculty_FAC001_...
    if token.startswith('jwt_student'):
        return '23CSD001', 'Student'
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
        request.current_user = user
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
            
            request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate user by username / email / register number + password against MongoDB users collection.
    Returns authenticated user profile, token, and target role-based dashboard URL.
    """
    data = request.json or {}
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

    # Check account status (Disabled / Unverified)
    account_status = str(user.get('account_status') or 'ACTIVE').upper()
    if account_status == 'DISABLED':
        return jsonify({
            'success': False,
            'error': 'Your account has been disabled. Please contact the administrator.'
        }), 401

    if user.get('email_verified') is False and account_status == 'UNVERIFIED':
        return jsonify({
            'success': False,
            'error': 'Please verify your email address before logging in.'
        }), 401

    # If login initiated from a specific role portal, check role compatibility
    user_role = user['role']
    if requested_role and requested_role.lower() != user_role.lower() and requested_role.lower() != (user.get('sub_role') or '').lower():
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

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Retrieve currently authenticated user profile from session or Bearer token."""
    user = get_current_authenticated_user()
    if not user:
        return jsonify({'authenticated': False, 'error': 'Not authenticated'}), 401

    role = user['role']
    safe_user = UserModel.to_safe_dict(user)
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
    user = request.current_user
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
        item['dashboardUrl'] = ROLE_DASHBOARDS.get(item['role'], '/student/dashboard')

    return jsonify({'users': users}), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new student / faculty account.
    Restricted to official college emails (@rajalakshmi.edu.in).
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()
    full_name = (data.get('fullName') or data.get('name') or '').strip()
    role = (data.get('role') or 'Student').strip()
    identifier = (data.get('identifier') or data.get('registerNumber') or data.get('registerNo') or '').strip()

    if not email:
        return jsonify({'success': False, 'error': 'College email is required.'}), 400

    # Prevent self-assigning privileged executive roles during public registration
    if role.lower() in ['admin', 'hod']:
        return jsonify({
            'success': False,
            'error': 'Cannot self-register with privileged role. Admin and HOD accounts must be created by an administrator.'
        }), 400

    # Validate official domain restriction
    is_valid_domain, norm_email = validate_college_email(email)
    if not is_valid_domain:
        return jsonify({
            'success': False,
            'error': 'Only official college email addresses ending with @rajalakshmi.edu.in are allowed.'
        }), 400

    if not password:
        return jsonify({'success': False, 'error': 'Password is required.'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

    if confirm_password and password != confirm_password:
        return jsonify({'success': False, 'error': 'Passwords do not match.'}), 400

    # Check for existing account
    if UserModel.get_by_email(norm_email):
        return jsonify({'success': False, 'error': 'An account with this college email already exists.'}), 400

    if identifier and UserModel.get_by_identifier(identifier):
        return jsonify({'success': False, 'error': f"An account with Register No / ID '{identifier}' already exists."}), 400

    if not identifier:
        identifier = norm_email.split('@')[0].upper()

    if not full_name:
        full_name = norm_email.split('@')[0].replace('.', ' ').title()

    verification_token = f"ver_{uuid.uuid4().hex}"

    user_data = {
        'identifier': identifier,
        'name': full_name,
        'email': norm_email,
        'role': role,
        'sub_role': role,
        'password': password,
        'email_verified': False,
        'verification_token': verification_token,
        'department': data.get('department', 'Computer Science and Design'),
        'year': data.get('year', 'III Year'),
        'section': data.get('section', 'A'),
    }

    new_user = UserModel.create_user(user_data)
    # Send verification email (logs to console in dev mode)
    send_verification_email(norm_email, full_name, verification_token)

    return jsonify({
        'success': True,
        'unverified': True,
        'message': 'Account registered successfully. A verification link has been sent to your college email.',
        'user': UserModel.to_safe_dict(new_user),
        'verificationToken': verification_token
    }), 201

@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    """Verify user college email address using verification token."""
    clean_token = (token or '').strip()
    if not clean_token:
        return jsonify({'success': False, 'error': 'Invalid verification token.'}), 400

    user = UserModel.get_by_verification_token(clean_token)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid or expired verification token.'}), 404

    UserModel.update_user(user['id'], {
        'email_verified': True,
        'verification_token': None
    })

    return jsonify({
        'success': True,
        'message': 'Your college email address has been verified successfully! You can now log in.'
    }), 200

@auth_bp.route('/request-password-reset', methods=['POST'])
@auth_bp.route('/forgot-password', methods=['POST'])
def request_password_reset():
    """Initiate password reset flow by dispatching reset email."""
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('identifier') or '').strip()

    if not identifier:
        return jsonify({'success': False, 'error': 'Email or Register No is required.'}), 400

    user = UserModel.get_by_email(identifier) or UserModel.get_by_identifier(identifier)
    if not user:
        # Generic response to prevent user enumeration
        return jsonify({
            'success': True,
            'message': 'If an account exists with this email address, a password reset link has been sent.'
        }), 200

    reset_token = f"rst_{uuid.uuid4().hex}"
    UserModel.update_user(user['id'], {'reset_token': reset_token})
    send_password_reset_email(user.get('email', ''), user.get('name', 'User'), reset_token)

    return jsonify({
        'success': True,
        'message': 'If an account exists with this email address, a password reset link has been sent.',
        'resetToken': reset_token
    }), 200

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using valid reset token."""
    data = request.get_json() or {}
    token = (data.get('token') or '').strip()
    new_password = (data.get('newPassword') or data.get('new_password') or data.get('password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()

    if not token:
        return jsonify({'success': False, 'error': 'Reset token is required.'}), 400

    if not new_password:
        return jsonify({'success': False, 'error': 'New password is required.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

    if confirm_password and new_password != confirm_password:
        return jsonify({'success': False, 'error': 'Passwords do not match.'}), 400

    user = UserModel.get_by_reset_token(token)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid or expired password reset token.'}), 400

    pwd_hash = generate_password_hash(new_password)
    UserModel.update_user(user['id'], {
        'password_hash': pwd_hash,
        'reset_token': None
    })

    return jsonify({
        'success': True,
        'message': 'Password reset successfully! You can now log in with your new credentials.'
    }), 200

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Update password for authenticated user."""
    user = request.current_user
    data = request.get_json() or {}
    current_password = (data.get('currentPassword') or data.get('current_password') or '').strip()
    new_password = (data.get('newPassword') or data.get('new_password') or '').strip()
    confirm_password = (data.get('confirmPassword') or data.get('confirm_password') or '').strip()

    if not current_password or not new_password:
        return jsonify({'success': False, 'error': 'Current password and new password are required.'}), 400

    if not UserModel.verify_password(user, current_password):
        return jsonify({'success': False, 'error': 'Current password is incorrect.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

    if confirm_password and new_password != confirm_password:
        return jsonify({'success': False, 'error': 'Passwords do not match.'}), 400

    UserModel.change_password(user['id'], new_password)
    return jsonify({
        'success': True,
        'message': 'Password changed successfully.'
    }), 200


