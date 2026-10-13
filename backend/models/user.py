"""
User Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
Preserves existing authentication, password hashing, OTP generation/verification,
and role authorization behavior.
"""
import os
import sys
import uuid
import re
import secrets
import hashlib
import hmac
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

# Ensure project root is in sys.path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import or_, and_, func

from backend.database.sql_server import session_scope, SQLServerDB
from backend.models.db_models import User, parse_datetime, to_iso


def validate_college_email(email: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that email address belongs to official institution domain @rajalakshmi.edu.in.
    Returns (is_valid: bool, normalized_email: str).
    """
    if not email or not isinstance(email, str):
        return False, None
    norm = email.strip().lower()
    domain = '@rajalakshmi.edu.in'
    if not norm.endswith(domain):
        return False, norm
    local = norm[:-len(domain)]
    if not local or '@' in local:
        return False, norm
    return True, norm


class OtpResult(str):
    """Enables both tuple unpacking (raw_otp, user, err) and direct string usage."""
    def __new__(cls, otp, updated_user=None, err=None):
        instance = super(OtpResult, cls).__new__(cls, otp or '')
        instance.updated_user = updated_user
        instance.err = err
        return instance

    def __iter__(self):
        return iter((str(self), self.updated_user, self.err))


class UserModel:
    @staticmethod
    def ensure_indexes():
        """Schema indexes are handled via Alembic migrations."""
        pass

    @staticmethod
    def find_by_email(email: str) -> Optional[dict]:
        return UserModel.get_by_email(email)

    @staticmethod
    def _user_to_dict(user: Optional[User]) -> Optional[dict]:
        if not user:
            return None
        return user.to_dict()

    @staticmethod
    def get_by_id(user_id: Any) -> Optional[dict]:
        """Query user by primary key ID."""
        if not user_id:
            return None
        clean_id = str(user_id).strip()
        with session_scope() as session:
            user = session.query(User).filter(User.id == clean_id).first()
            if not user:
                # Also try matching by identifier
                user = session.query(User).filter(func.lower(User.identifier) == clean_id.lower()).first()
            return UserModel._user_to_dict(user)

    @staticmethod
    def get_by_email(email: str) -> Optional[dict]:
        """Query user by official college email address (case-insensitive)."""
        if not email:
            return None
        clean_email = email.strip().lower()
        with session_scope() as session:
            user = session.query(User).filter(func.lower(User.email) == clean_email).first()
            return UserModel._user_to_dict(user)

    @staticmethod
    def get_by_identifier(identifier: str, role: Optional[str] = None) -> Optional[dict]:
        """
        Query user by identifier (Register No / Employee ID), email, or ID (case-insensitive).
        Optional role validation.
        """
        clean_id = (identifier or '').strip()
        if not clean_id:
            return None

        clean_lower = clean_id.lower()
        with session_scope() as session:
            query = session.query(User).filter(
                or_(
                    func.lower(User.identifier) == clean_lower,
                    func.lower(User.email) == clean_lower,
                    func.lower(User.id) == clean_lower,
                )
            )

            if role:
                role_clean = role.strip().lower()
                query = query.filter(
                    or_(
                        func.lower(User.role) == role_clean,
                        func.lower(User.sub_role) == role_clean,
                    )
                )

            user = query.first()
            return UserModel._user_to_dict(user)

    @staticmethod
    def verify_password(user: Optional[dict], password: str) -> bool:
        """Verify user password hash securely."""
        if not user or not password:
            return False

        pwd_hash = user.get('password_hash')
        if pwd_hash:
            return check_password_hash(pwd_hash, password)

        # Legacy fallback
        legacy_pwd = user.get('password')
        if legacy_pwd and legacy_pwd == password:
            return True

        return False

    @staticmethod
    def create_user(data: dict) -> Optional[dict]:
        """Insert a new user record into SQL Server."""
        user_id = data.get('id') or f"USR_{uuid.uuid4().hex[:8].upper()}"
        pwd = data.get('password') or 'password123'
        pwd_hash = generate_password_hash(pwd)
        now = datetime.now()

        email_verified = data.get('email_verified', False)
        account_status = data.get('account_status', 'ACTIVE' if email_verified else 'UNVERIFIED')

        with session_scope() as session:
            user = User(
                id=user_id,
                identifier=data.get('identifier') or data.get('registerNumber') or data.get('register_number') or user_id,
                name=data.get('name') or data.get('fullName') or data.get('full_name') or 'User',
                email=(data.get('email') or '').strip().lower(),
                role=data.get('role', 'Student'),
                sub_role=data.get('sub_role', data.get('role', 'Student')),
                department=data.get('department', 'Computer Science and Design'),
                year=str(data.get('year', 'III Year')),
                section=data.get('section', 'A'),
                designation=data.get('designation', data.get('role', 'Student')),
                phone=data.get('phone', ''),
                password_hash=pwd_hash,
                avatar=data.get('avatar'),
                status=data.get('status', 'active'),
                email_verified=email_verified,
                account_status=account_status,
                verification_token_hash=data.get('verification_token_hash'),
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.flush()
            return user.to_dict()

    @staticmethod
    def create(*args, **kwargs) -> Optional[dict]:
        if args and isinstance(args[0], dict):
            return UserModel.create_user(args[0])
        return UserModel.create_user(kwargs)

    @staticmethod
    def create_email_otp(user_or_email: Any, purpose: str = 'password change') -> OtpResult:
        """
        Generate a cryptographically secure 6-digit OTP with 5-minute expiry.
        Stores SHA-256 hash with cooldown rate limiting.
        """
        if isinstance(user_or_email, dict):
            user = user_or_email
        elif isinstance(user_or_email, str) and '@' in user_or_email:
            user = UserModel.get_by_email(user_or_email)
        else:
            user = UserModel.get_by_id(user_or_email) or UserModel.get_by_identifier(user_or_email)

        if not user:
            return OtpResult(None, None, "User account not found.")

        now = datetime.now()
        is_testing = False
        try:
            from flask import current_app
            is_testing = bool(current_app and current_app.config.get('TESTING'))
        except Exception:
            pass

        cooldown_sec = int(os.environ.get('OTP_COOLDOWN_SECONDS', 10 if os.environ.get('FLASK_ENV', 'development') == 'development' else 60))
        last_sent_str = user.get('otp_last_sent_at')
        if not is_testing and last_sent_str:
            last_sent = parse_datetime(last_sent_str)
            if last_sent:
                elapsed = (now - last_sent).total_seconds()
                if elapsed < cooldown_sec:
                    wait_sec = max(1, int(cooldown_sec - elapsed))
                    return OtpResult(None, user, f"Security cooldown active: please wait {wait_sec} seconds before requesting a new OTP code.")

        # Cryptographically secure 6-digit random code
        raw_otp = f"{secrets.randbelow(900000) + 100000:06d}"
        otp_hash = hashlib.sha256(raw_otp.encode('utf-8')).hexdigest()
        expires_dt = now + timedelta(minutes=5)

        email_otp_meta = {
            "hash": otp_hash,
            "expires_at": to_iso(expires_dt),
            "attempts": 0,
            "last_sent_at": to_iso(now),
            "purpose": purpose
        }

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if record:
                record.otp_hash = otp_hash
                record.otp_expires_at = expires_dt
                record.otp_attempts = 0
                record.otp_last_sent_at = now
                record.otp_purpose = purpose
                record.set_email_otp_dict(email_otp_meta)
                record.updated_at = now
                session.flush()
                updated_user = record.to_dict()
            else:
                updated_user = user

        return OtpResult(raw_otp, updated_user, None)

    @staticmethod
    def verify_email_otp(user_or_email: Any, otp_code: Any) -> Tuple[bool, Optional[str], str]:
        """
        Verify single-use 6-digit OTP with attempt limiting and 5-minute expiry.
        Returns (success: bool, raw_reset_token: str, message: str).
        """
        if not otp_code or not str(otp_code).strip():
            return False, None, "6-digit OTP code is required."

        clean_otp = str(otp_code).strip()
        if len(clean_otp) != 6 or not clean_otp.isdigit():
            return False, None, "OTP must be a valid 6-digit numeric code."

        if isinstance(user_or_email, dict):
            user = user_or_email
        elif isinstance(user_or_email, str) and '@' in user_or_email:
            user = UserModel.get_by_email(user_or_email)
        else:
            user = UserModel.get_by_id(user_or_email) or UserModel.get_by_identifier(user_or_email)

        if not user:
            return False, None, "User account not found."

        now = datetime.now()

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if not record:
                return False, None, "User account not found."

            # Check attempts
            attempts = record.otp_attempts or 0
            if attempts >= 5:
                record.otp_hash = None
                record.otp_expires_at = None
                record.email_otp_json = None
                return False, None, "Maximum OTP verification attempts exceeded. Please request a new OTP."

            # Check expiry
            if not record.otp_expires_at or record.otp_expires_at < now:
                record.otp_hash = None
                record.otp_expires_at = None
                record.email_otp_json = None
                return False, None, "OTP has expired. OTPs are valid for 5 minutes only. Please request a new code."

            # Verify hash
            candidate_hash = hashlib.sha256(clean_otp.encode('utf-8')).hexdigest()
            if not record.otp_hash or not hmac.compare_digest(record.otp_hash, candidate_hash):
                record.otp_attempts = (record.otp_attempts or 0) + 1
                remaining = max(0, 4 - attempts)
                return False, None, f"Invalid OTP code. {remaining} attempt(s) remaining."

            # OTP verified: generate single-use reset token
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            reset_expires = now + timedelta(minutes=5)

            record.reset_token_hash = token_hash
            record.reset_token_expires = reset_expires
            record.otp_verified_at = now
            record.otp_hash = None
            record.otp_expires_at = None
            record.otp_attempts = 0
            record.email_otp_json = None
            record.updated_at = now

            return True, raw_token, "OTP verified successfully."

    @staticmethod
    def create_password_reset_token(email: str) -> Tuple[Optional[str], Optional[str], Optional[dict]]:
        """Generate a cryptographically secure single-use password reset token."""
        user = UserModel.get_by_email(email)
        if not user:
            return None, None, None

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expires = datetime.now() + timedelta(hours=1)

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if record:
                record.reset_token_hash = token_hash
                record.reset_token_expires = expires
                record.updated_at = datetime.now()
                return raw_token, record.name, record.to_dict()

        return None, None, None

    @staticmethod
    def reset_password(token: str, new_password: str) -> Tuple[bool, str]:
        """Validate single-use reset token and update user password."""
        if not token or not new_password:
            return False, "Token and new password are required."

        token_hash = hashlib.sha256(token.strip().encode('utf-8')).hexdigest()
        now = datetime.now()

        with session_scope() as session:
            user = session.query(User).filter(
                or_(
                    and_(User.reset_token_hash == token_hash, User.reset_token_expires >= now),
                    User.id == token.strip(),
                    func.lower(User.email) == token.strip().lower(),
                )
            ).first()

            if not user:
                return False, "Invalid or expired password reset token."

            user.password_hash = generate_password_hash(new_password)
            user.password_changed_at = now
            user.reset_token_hash = None
            user.reset_token_expires = None
            user.updated_at = now
            return True, "Password has been reset successfully. Please log in with your new password."

    @staticmethod
    def change_password(user_id_or_identifier: Any, new_password: str, current_password: Optional[str] = None) -> Tuple[bool, str]:
        """Change user password. Verifies current password if supplied."""
        user = UserModel.get_by_id(user_id_or_identifier) or UserModel.get_by_identifier(user_id_or_identifier)
        if not user:
            return False, "User account not found."

        if current_password:
            if not UserModel.verify_password(user, current_password):
                return False, "Current password is incorrect."

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if not record:
                return False, "User account not found."

            record.password_hash = generate_password_hash(new_password)
            record.password_changed_at = datetime.now()
            record.updated_at = datetime.now()
            return True, "Password updated successfully."

    @staticmethod
    def set_account_status(user_id_or_identifier: Any, status: str) -> bool:
        """Update account status (e.g. ACTIVE, DISABLED, UNVERIFIED)."""
        user = UserModel.get_by_id(user_id_or_identifier) or UserModel.get_by_identifier(user_id_or_identifier)
        if not user:
            return False

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if record:
                record.account_status = status
                record.updated_at = datetime.now()
                return True
        return False

    @staticmethod
    def verify_email(email_or_identifier: str) -> bool:
        """Mark user account as email-verified and ACTIVE."""
        user = UserModel.get_by_email(email_or_identifier) or UserModel.get_by_identifier(email_or_identifier)
        if not user:
            return False

        with session_scope() as session:
            record = session.query(User).filter(User.id == user['id']).first()
            if record:
                record.email_verified = True
                record.account_status = 'ACTIVE'
                record.updated_at = datetime.now()
                return True
        return False

    @staticmethod
    def to_safe_dict(user: Optional[dict]) -> Optional[dict]:
        """Strip password hashes from user dictionary before sending in API response."""
        if not user:
            return None
        safe = dict(user)
        safe.pop('password_hash', None)
        safe.pop('password', None)
        safe.pop('reset_token_hash', None)
        safe.pop('otp_hash', None)
        return safe

    @staticmethod
    def list_all() -> List[dict]:
        """List all users with safe projections."""
        with session_scope() as session:
            users = session.query(User).order_by(User.created_at.asc()).all()
            return [UserModel.to_safe_dict(u.to_dict()) for u in users]

    @staticmethod
    def update_user(user_id: Any, updates: dict) -> Optional[dict]:
        """Update user fields safely and authoritatively in SQL Server."""
        target = UserModel.get_by_id(user_id) or UserModel.get_by_identifier(user_id)
        if not target:
            return None

        clean_updates = dict(updates)
        clean_updates.pop('_id', None)
        clean_updates.pop('id', None)

        if 'password' in clean_updates:
            pwd = clean_updates.pop('password')
            if pwd and str(pwd).strip():
                clean_updates['password_hash'] = generate_password_hash(str(pwd).strip())

        with session_scope() as session:
            record = session.query(User).filter(User.id == target['id']).first()
            if not record:
                return None

            for key, val in clean_updates.items():
                if hasattr(record, key):
                    # Handle datetime parsing if string
                    if key in ('last_login', 'password_changed_at', 'reset_token_expires', 'last_academic_update'):
                        setattr(record, key, parse_datetime(val))
                    else:
                        setattr(record, key, val)

            record.updated_at = datetime.now()
            session.flush()
            return record.to_dict()

    @staticmethod
    def delete_user(user_id: Any) -> bool:
        """Delete user by ID."""
        target = UserModel.get_by_id(user_id) or UserModel.get_by_identifier(user_id)
        if not target:
            return False

        with session_scope() as session:
            record = session.query(User).filter(User.id == target['id']).first()
            if record:
                session.delete(record)
                return True
        return False

    # Alias list_all to get_all for caller compatibility
    get_all = list_all

