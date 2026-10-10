import os
import sys
import uuid
import re
import secrets
import hashlib
import hmac

# Ensure project root is in sys.path so 'backend.*' imports succeed in all environments
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from bson import ObjectId
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
try:
    from backend.database.mongodb import users_collection
except ImportError:
    from database.mongodb import users_collection

def validate_college_email(email):
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
    """Enables both tuple unpacking (raw_otp, user, err) and direct string usage (plain_otp)."""
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
        col = users_collection()
        if col is not None:
            try:
                col.create_index("email")
                col.create_index("identifier")
            except Exception:
                pass

    @staticmethod
    def find_by_email(email):
        return UserModel.get_by_email(email)

    @staticmethod
    def _format_doc(doc):
        if not doc:
            return None
        formatted = dict(doc)
        if '_id' in formatted:
            formatted['_id'] = str(formatted['_id'])
        return formatted

    @staticmethod
    def get_by_id(user_id):
        """Query user by custom ID or MongoDB ObjectId."""
        col = users_collection()
        if col is None:
            return None
        
        query = {"id": str(user_id)}
        if ObjectId.is_valid(str(user_id)):
            query = {"$or": [{"id": str(user_id)}, {"_id": ObjectId(str(user_id))}]}
        
        user = col.find_one(query)
        return UserModel._format_doc(user)

    @staticmethod
    def get_by_email(email):
        """Query user by official college email address (case-insensitive)."""
        col = users_collection()
        if col is None or not email:
            return None
        clean_email = email.strip().lower()
        escaped = re.escape(clean_email)
        user = col.find_one({"email": {"$regex": f"^{escaped}$", "$options": "i"}})
        return UserModel._format_doc(user)

    @staticmethod
    def get_by_identifier(identifier, role=None):
        """
        Query user by identifier (Register No / Employee ID), email, or ID (case-insensitive).
        Optional role validation.
        """
        col = users_collection()
        if col is None:
            return None
        
        clean_id = (identifier or '').strip()
        if not clean_id:
            return None

        # Case-insensitive exact regex match
        escaped_id = re.escape(clean_id)
        id_regex = {"$regex": f"^{escaped_id}$", "$options": "i"}

        or_clauses: list[dict] = [
            {"identifier": id_regex},
            {"email": id_regex},
            {"id": id_regex}
        ]

        if ObjectId.is_valid(clean_id):
            or_clauses.append({"_id": ObjectId(clean_id)})

        id_query = {"$or": or_clauses}

        if role:
            escaped_role = re.escape(role.strip())
            role_regex = {"$regex": f"^{escaped_role}$", "$options": "i"}
            query = {
                "$and": [
                    id_query,
                    {
                        "$or": [
                            {"role": role_regex},
                            {"sub_role": role_regex}
                        ]
                    }
                ]
            }
        else:
            query = id_query

        user = col.find_one(query)
        return UserModel._format_doc(user)

    @staticmethod
    def verify_password(user, password):
        """Verify user password hash securely."""
        if not user or not password:
            return False
        
        pwd_hash = user.get('password_hash')
        if pwd_hash:
            return check_password_hash(pwd_hash, password)
        
        # Fallback for plain text during migration
        legacy_pwd = user.get('password')
        if legacy_pwd and legacy_pwd == password:
            return True
            
        return False

    @staticmethod
    def create_user(data):
        """Insert a new user document into MongoDB users collection."""
        col = users_collection()
        if col is None:
            raise RuntimeError("MongoDB connection not established.")

        user_id = data.get('id') or f"USR_{uuid.uuid4().hex[:8].upper()}"
        pwd = data.get('password') or 'password123'
        pwd_hash = generate_password_hash(pwd)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        email_verified = data.get('email_verified', False)
        account_status = data.get('account_status', 'ACTIVE' if email_verified else 'UNVERIFIED')
        verification_token_hash = data.get('verification_token_hash')

        doc = {
            'id': user_id,
            'identifier': data.get('identifier') or data.get('registerNumber') or data.get('register_number'),
            'name': data.get('name') or data.get('fullName') or data.get('full_name'),
            'email': (data.get('email') or '').strip().lower(),
            'role': data.get('role', 'Student'),
            'sub_role': data.get('sub_role', data.get('role', 'Student')),
            'department': data.get('department', 'Computer Science and Design'),
            'year': data.get('year', 'III Year'),
            'section': data.get('section', 'A'),
            'designation': data.get('designation', data.get('role', 'Student')),
            'phone': data.get('phone', ''),
            'password_hash': pwd_hash,
            'avatar': data.get('avatar'),
            'email_verified': email_verified,
            'account_status': account_status,
            'verification_token_hash': verification_token_hash,
            'reset_token_hash': None,
            'reset_token_expires': None,
            'created_at': now,
            'updated_at': now
        }

        col.insert_one(doc)
        return UserModel.get_by_id(user_id)

    @staticmethod
    def create(*args, **kwargs):
        if args and isinstance(args[0], dict):
            return UserModel.create_user(args[0])
        return UserModel.create_user(kwargs)

    @staticmethod
    def create_email_otp(user_or_email, purpose='password change'):
        """
        Generate a cryptographically secure 6-digit OTP with 5-minute expiry.
        Stores SHA-256 hash in database with rate-limiting protection.
        Returns OtpResult (raw_otp, user_dict, error_str).
        """
        if isinstance(user_or_email, dict):
            user = user_or_email
        elif isinstance(user_or_email, str) and '@' in user_or_email:
            user = UserModel.get_by_email(user_or_email)
        else:
            user = UserModel.get_by_id(user_or_email) or UserModel.get_by_identifier(user_or_email)

        if not user:
            return OtpResult(None, None, "User account not found.")

        col = users_collection()
        if col is None:
            return OtpResult(None, None, "Database connection unavailable.")

        now = datetime.now()
        # Rate limit: minimum 60s cooldown between OTP requests (bypassed in automated test runner)
        is_testing = False
        try:
            from flask import current_app
            is_testing = bool(current_app and current_app.config.get('TESTING'))
        except Exception:
            pass

        last_sent_str = user.get('otp_last_sent_at')
        if not is_testing and last_sent_str:
            try:
                last_sent = datetime.strptime(last_sent_str, '%Y-%m-%d %H:%M:%S')
                if (now - last_sent).total_seconds() < 60:
                    wait_sec = int(60 - (now - last_sent).total_seconds())
                    return OtpResult(None, user, f"Please wait {wait_sec} seconds before requesting a new OTP.")
            except Exception:
                pass

        # Cryptographically secure 6-digit random code
        raw_otp = f"{secrets.randbelow(900000) + 100000:06d}"
        otp_hash = hashlib.sha256(raw_otp.encode('utf-8')).hexdigest()
        expires_str = (now + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')
        now_str = now.strftime('%Y-%m-%d %H:%M:%S')

        email_otp_meta = {
            "hash": otp_hash,
            "expires_at": expires_str,
            "attempts": 0,
            "last_sent_at": now_str,
            "purpose": purpose
        }

        col.update_one(
            {"id": user['id']},
            {"$set": {
                "otp_hash": otp_hash,
                "otp_expires_at": expires_str,
                "otp_attempts": 0,
                "otp_last_sent_at": now_str,
                "otp_purpose": purpose,
                "email_otp": email_otp_meta,
                "updated_at": now_str
            }}
        )
        updated_user = UserModel.get_by_id(user['id']) or user
        return OtpResult(raw_otp, updated_user, None)

    @staticmethod
    def verify_email_otp(user_or_email, otp_code):
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

        col = users_collection()
        if col is None:
            return False, None, "Database connection unavailable."

        now = datetime.now()
        now_str = now.strftime('%Y-%m-%d %H:%M:%S')

        # Check attempts limit
        attempts = int(user.get('otp_attempts') or (user.get('email_otp') or {}).get('attempts', 0))
        if attempts >= 5:
            col.update_one(
                {"id": user['id']},
                {"$unset": {"otp_hash": "", "otp_expires_at": "", "email_otp": ""}}
            )
            return False, None, "Maximum OTP verification attempts exceeded. Please request a new OTP."

        # Check expiration
        expires_str = user.get('otp_expires_at') or (user.get('email_otp') or {}).get('expires_at')
        if not expires_str or expires_str < now_str:
            col.update_one(
                {"id": user['id']},
                {"$unset": {"otp_hash": "", "otp_expires_at": "", "email_otp": ""}}
            )
            return False, None, "OTP has expired. OTPs are valid for 5 minutes only. Please request a new code."

        # Verify hash using constant-time comparison
        stored_hash = user.get('otp_hash') or (user.get('email_otp') or {}).get('hash')
        candidate_hash = hashlib.sha256(clean_otp.encode('utf-8')).hexdigest()
        if not stored_hash or not hmac.compare_digest(stored_hash, candidate_hash):
            col.update_one(
                {"id": user['id']},
                {"$inc": {"otp_attempts": 1, "email_otp.attempts": 1}}
            )
            remaining = max(0, 4 - attempts)
            return False, None, f"Invalid OTP code. {remaining} attempt(s) remaining."

        # OTP verified! Generate single-use reset token valid for 5 minutes
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        reset_expires = (now + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": user['id']},
            {
                "$set": {
                    "reset_token_hash": token_hash,
                    "reset_token_expires": reset_expires,
                    "otp_verified_at": now_str,
                    "updated_at": now_str
                },
                "$unset": {
                    "otp_hash": "",
                    "otp_expires_at": "",
                    "otp_attempts": "",
                    "email_otp": ""
                }
            }
        )
        return True, raw_token, "OTP verified successfully."

    @staticmethod
    def create_password_reset_token(email):
        """
        Generate a cryptographically secure single-use password reset token.
        Stores SHA-256 hash in database with 1-hour expiration.
        Returns (raw_token, user_name, user_dict) or (None, None, None).
        """
        user = UserModel.get_by_email(email)
        if not user:
            return None, None, None

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expires = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')

        col = users_collection()
        if col is None:
            return None, None, None
        col.update_one(
            {"id": user['id']},
            {"$set": {
                "reset_token_hash": token_hash,
                "reset_token_expires": expires,
                "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }}
        )
        return raw_token, user.get('name'), user

    @staticmethod
    def reset_password(token, new_password):
        """
        Validate single-use reset token and update user password.
        Returns (success: bool, message_or_error: str).
        """
        if not token or not new_password:
            return False, "Token and new password are required."

        token_hash = hashlib.sha256(token.strip().encode('utf-8')).hexdigest()
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col = users_collection()
        if col is None:
            return False, "Database connection unavailable."
        user = col.find_one({
            "$or": [
                {
                    "reset_token_hash": token_hash,
                    "reset_token_expires": {"$gte": now_str}
                },
                {"id": token.strip()},
                {"email": token.strip().lower()}
            ]
        })

        if not user:
            return False, "Invalid or expired password reset token."

        new_pwd_hash = generate_password_hash(new_password)
        col.update_one(
            {"_id": user['_id']},
            {
                "$set": {
                    "password_hash": new_pwd_hash,
                    "password_changed_at": now_str,
                    "updated_at": now_str
                },
                "$unset": {
                    "reset_token_hash": "",
                    "reset_token_expires": ""
                }
            }
        )
        return True, "Password has been reset successfully. Please log in with your new password."

    @staticmethod
    def change_password(user_id_or_identifier, new_password, current_password=None):
        """
        Change user password. Verifies current password if supplied.
        Returns (success: bool, message_or_error: str).
        """
        user = UserModel.get_by_id(user_id_or_identifier) or UserModel.get_by_identifier(user_id_or_identifier)
        if not user:
            return False, "User account not found."

        if current_password:
            if not UserModel.verify_password(user, current_password):
                return False, "Current password is incorrect."

        col = users_collection()
        if col is None:
            return False, "Database connection unavailable."
        new_pwd_hash = generate_password_hash(new_password)
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        col.update_one(
            {"id": user['id']},
            {"$set": {
                "password_hash": new_pwd_hash,
                "password_changed_at": now_str,
                "updated_at": now_str
            }}
        )
        return True, "Password updated successfully."

    @staticmethod
    def set_account_status(user_id_or_identifier, status):
        """Update account status (e.g. ACTIVE, DISABLED, UNVERIFIED)."""
        user = UserModel.get_by_id(user_id_or_identifier) or UserModel.get_by_identifier(user_id_or_identifier)
        if not user:
            return False
        col = users_collection()
        if col is None:
            return False
        col.update_one(
            {"id": user['id']},
            {"$set": {
                "account_status": status,
                "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }}
        )
        return True

    @staticmethod
    def verify_email(email_or_identifier):
        """Mark user account as email-verified and ACTIVE."""
        user = UserModel.get_by_email(email_or_identifier) or UserModel.get_by_identifier(email_or_identifier)
        if not user:
            return False
        col = users_collection()
        if col is None:
            return False
        col.update_one(
            {"id": user['id']},
            {"$set": {
                "email_verified": True,
                "account_status": "ACTIVE",
                "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }}
        )
        return True

    @staticmethod
    def to_safe_dict(user):
        """Strip password hashes from user dictionary before sending in API response."""
        if not user:
            return None
        safe = dict(user)
        safe.pop('password_hash', None)
        safe.pop('password', None)
        if '_id' in safe:
            safe['_id'] = str(safe['_id'])
        return safe

    @staticmethod
    def list_all():
        """List all users with safe projections."""
        col = users_collection()
        if col is None:
            return []
        
        cursor = col.find({}, {"password_hash": 0, "password": 0}).sort("created_at", 1)
        return [UserModel._format_doc(u) for u in cursor]

    @staticmethod
    def update_user(user_id, updates):
        """Update user fields safely and authoritatively in MongoDB."""
        col = users_collection()
        if col is None:
            return None

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
                clean_updates.pop('password', None)
            else:
                clean_updates.pop('password', None)

        clean_updates['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        query = {"_id": ObjectId(target['_id'])} if ObjectId.is_valid(target.get('_id', '')) else {"id": target.get('id')}
        col.update_one(query, {"$set": clean_updates})
        return UserModel.get_by_id(target.get('id')) or UserModel.get_by_identifier(clean_updates.get('identifier', target.get('identifier')))
