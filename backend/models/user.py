import uuid
import re
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.mongodb import users_collection

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
            'identifier': data.get('identifier'),
            'name': data.get('name'),
            'email': data.get('email'),
            'role': data.get('role'),
            'sub_role': data.get('sub_role', data.get('role')),
            'department': data.get('department'),
            'year': data.get('year'),
            'section': data.get('section'),
            'designation': data.get('designation'),
            'phone': data.get('phone'),
            'password_hash': pwd_hash,
            'avatar': data.get('avatar'),
            'created_at': now,
            'updated_at': now
        }

        col.insert_one(doc)
        return UserModel.get_by_id(user_id)

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
