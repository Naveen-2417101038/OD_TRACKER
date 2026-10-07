import os
import sys
import uuid
import re
import secrets
import hashlib

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

class UserModel:
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
            'identifier': data.get('identifier') or data.get('registerNumber'),
            'name': data.get('name') or data.get('fullName'),
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
            "reset_token_hash": token_hash,
            "reset_token_expires": {"$gte": now_str}
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
