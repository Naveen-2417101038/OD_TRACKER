import uuid
import re
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.mongodb import users_collection

def validate_college_email(email: str):
    """
    Validate that an email belongs to the official college domain (@rajalakshmi.edu.in).
    Returns (is_valid: bool, normalized_email: str).
    """
    raw = (email or '').strip().lower()
    if not raw or '@' not in raw:
        return False, raw
    domain = raw.split('@')[-1]
    if domain != 'rajalakshmi.edu.in' and not domain.endswith('.rajalakshmi.edu.in'):
        return False, raw
    return True, raw


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

        id_query = {
            "$or": [
                {"identifier": id_regex},
                {"email": id_regex},
                {"id": id_regex}
            ]
        }

        if ObjectId.is_valid(clean_id):
            id_query["$or"].append({"_id": ObjectId(clean_id)})

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
    def get_by_email(email):
        """Query user by email address (case-insensitive)."""
        col = users_collection()
        if col is None or not email:
            return None
        clean_email = email.strip()
        escaped = re.escape(clean_email)
        user = col.find_one({"email": {"$regex": f"^{escaped}$", "$options": "i"}})
        return UserModel._format_doc(user)

    @staticmethod
    def get_by_verification_token(token):
        """Query user by email verification token."""
        col = users_collection()
        if col is None or not token:
            return None
        user = col.find_one({"verification_token": str(token).strip()})
        return UserModel._format_doc(user)

    @staticmethod
    def get_by_reset_token(token):
        """Query user by password reset token."""
        col = users_collection()
        if col is None or not token:
            return None
        user = col.find_one({"reset_token": str(token).strip()})
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

        doc = {
            'id': user_id,
            'identifier': data.get('identifier') or data.get('email', '').split('@')[0].upper(),
            'name': data.get('name') or data.get('fullName') or 'User',
            'email': data.get('email'),
            'role': data.get('role', 'Student'),
            'sub_role': data.get('sub_role', data.get('role', 'Student')),
            'department': data.get('department', 'Computer Science and Design'),
            'year': data.get('year', 'III Year'),
            'section': data.get('section', 'A'),
            'designation': data.get('designation', data.get('role', 'Student')),
            'phone': data.get('phone', ''),
            'password_hash': pwd_hash,
            'avatar': data.get('avatar', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80'),
            'email_verified': data.get('email_verified', False),
            'verification_token': data.get('verification_token'),
            'reset_token': data.get('reset_token'),
            'created_at': now,
            'updated_at': now
        }

        col.insert_one(doc)
        return UserModel.get_by_id(user_id)

    @staticmethod
    def update_user(user_id, updates):
        """Update fields for a user in MongoDB."""
        col = users_collection()
        if col is None:
            return None
        updates['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        col.update_one({"id": str(user_id)}, {"$set": updates})
        return UserModel.get_by_id(user_id)

    @staticmethod
    def to_safe_dict(user):
        """Strip password hashes and sensitive tokens from user dictionary."""
        if not user:
            return None
        safe = dict(user)
        safe.pop('password_hash', None)
        safe.pop('password', None)
        safe.pop('verification_token', None)
        safe.pop('reset_token', None)
        if '_id' in safe:
            safe['_id'] = str(safe['_id'])
        return safe

    @staticmethod
    def create_password_reset_token(email):
        """Generate and store password reset token for a user."""
        user = UserModel.get_by_email(email) or UserModel.get_by_identifier(email)
        if not user:
            return None, None, None
        token = f"rst_{uuid.uuid4().hex}"
        UserModel.update_user(user['id'], {'reset_token': token})
        return token, user.get('name', 'User'), UserModel.get_by_id(user['id'])

    @staticmethod
    def change_password(user_id, new_password):
        """Update password hash for a specific user ID."""
        pwd_hash = generate_password_hash(new_password)
        return UserModel.update_user(user_id, {'password_hash': pwd_hash})

    @staticmethod
    def set_account_status(user_id, status):
        """Set account status (ACTIVE, UNVERIFIED, DISABLED) for user."""
        return UserModel.update_user(user_id, {'account_status': status.upper()})

    @staticmethod
    def list_all():
        """List all users with safe projections."""
        col = users_collection()
        if col is None:
            return []
        
        cursor = col.find({}, {"password_hash": 0, "password": 0, "reset_token": 0, "verification_token": 0}).sort("created_at", 1)
        return [UserModel._format_doc(u) for u in cursor]


