import os
import sys
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, ConfigurationError
from werkzeug.security import generate_password_hash
from backend.config import Config

try:
    # pyrefly: ignore [missing-import]
    import certifi  # type: ignore
except ImportError:
    certifi = None

try:
    # pyrefly: ignore [missing-import]
    import mongomock  # type: ignore
except ImportError:
    mongomock = None

class MongoDB:
    _instance = None
    _client = None
    _db = None
    _is_connected = False
    _connection_status = "uninitialized"
    _connection_error = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            cls.connect()
        return cls._client

    @classmethod
    def get_db(cls):
        if cls._db is None:
            cls.connect()
        return cls._db

    @classmethod
    def is_placeholder_uri(cls, uri):
        """Check if MONGO_URI is unset or contains placeholder text."""
        if not uri:
            return True
        uri_str = str(uri).strip()
        placeholders = [
            '<PASTE_MY_MONGODB_ATLAS_CONNECTION_STRING_HERE>',
            'PASTE_MY_MONGODB_ATLAS',
            'USERNAME:PASSWORD@CLUSTER',
            '<password>',
            '<username>'
        ]
        for p in placeholders:
            if p in uri_str:
                return True
        if not (uri_str.startswith('mongodb://') or uri_str.startswith('mongodb+srv://')):
            return True
        return False

    @classmethod
    def connect(cls):
        """Establish connection to MongoDB Atlas."""
        if cls._db is not None:
            return cls._db

        uri = Config.MONGO_URI
        db_name = Config.MONGO_DB_NAME or 'od_tracking'

        if cls.is_placeholder_uri(uri):
            if mongomock is not None:
                cls._client = mongomock.MongoClient()
                cls._db = cls._client[db_name]
                cls._is_connected = True
                cls._connection_status = "placeholder_demo_mode"
                cls._connection_error = None
                print(f"[!] MongoDB Atlas: Placeholder detected in .env. Running in local demo mode with seeded users.")
                print(f"    To connect to live Atlas, update MONGO_URI in .env: MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/")
                return cls._db
            else:
                cls._is_connected = False
                cls._connection_status = "placeholder_detected"
                cls._connection_error = "MONGO_URI is set to placeholder in .env. Please update MONGO_URI with your MongoDB Atlas connection string."
                print(f"[!] MongoDB Atlas: Placeholder detected in .env.")
                print(f"    Please paste your connection string in .env: MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/")
                return None

        client_kwargs = {
            'serverSelectionTimeoutMS': 5000,
            'connectTimeoutMS': 5000,
            'retryWrites': True,
            'appName': "ODTrackingSystem"
        }
        try:
            if uri.startswith('mongodb+srv://') or 'tls=true' in uri.lower() or 'ssl=true' in uri.lower():
                client_kwargs['tls'] = True
                if certifi is not None:
                    client_kwargs['tlsCAFile'] = certifi.where()

            cls._client = MongoClient(uri, **client_kwargs)
            cls._client.admin.command('ping')
            cls._db = cls._client[db_name]
            cls._is_connected = True
            cls._connection_status = "connected"
            cls._connection_error = None
            print(f"[+] MongoDB connected successfully. Active Database: '{db_name}'")
            return cls._db
        except (ConnectionFailure, ServerSelectionTimeoutError, ConfigurationError) as e:
            print(f"[-] MongoDB Atlas live connection failed: {e}")
            if mongomock is not None:
                cls._client = mongomock.MongoClient()
                cls._db = cls._client[db_name]
                cls._is_connected = False
                cls._connection_status = "fallback_demo_mode"
                cls._connection_error = str(e)
                print(f"[!] Running backend with mock database fallback so server remains functional.")
                print(f"    (Ensure your current IP is whitelisted in MongoDB Atlas under Network Access -> IP Access List)")
                return cls._db
            else:
                cls._is_connected = False
                cls._connection_status = "connection_failed"
                cls._connection_error = str(e)
                return None
        except Exception as e:
            cls._is_connected = False
            cls._connection_status = "error"
            cls._connection_error = str(e)
            print(f"[-] Unexpected error connecting to MongoDB Atlas: {e}")
            return None

    @classmethod
    def get_status(cls):
        """Return full diagnostic status for health check endpoint."""
        db = cls.get_db()
        collections_info = []
        col_count = 0
        
        if cls._is_connected and db is not None:
            try:
                collections = db.list_collection_names()
                col_count = len(collections)
                collections_info = collections
            except Exception:
                collections_info = []

        return {
            "status": "connected" if cls._is_connected else "disconnected",
            "type": "MongoDB Atlas",
            "database_name": Config.MONGO_DB_NAME,
            "connected": cls._is_connected,
            "connection_state": cls._connection_status,
            "error": cls._connection_error,
            "collections_found": col_count,
            "collections": collections_info
        }

# Helper getters for all 6 required collections
def get_db():
    return MongoDB.get_db()

def get_mongo_client():
    return MongoDB.get_client()

def users_collection():
    db = get_db()
    return db['users'] if db is not None else None

def od_requests_collection():
    db = get_db()
    return db['od_requests'] if db is not None else None

def approvals_collection():
    db = get_db()
    return db['approvals'] if db is not None else None

def certificates_collection():
    db = get_db()
    return db['certificates'] if db is not None else None

def notifications_collection():
    db = get_db()
    return db['notifications'] if db is not None else None

def od_history_collection():
    db = get_db()
    return db['od_history'] if db is not None else None

def academic_records_collection():
    db = get_db()
    return db['student_academic_records'] if db is not None else None

def academic_upload_history_collection():
    db = get_db()
    return db['academic_upload_history'] if db is not None else None

def system_settings_collection():
    db = get_db()
    return db['system_settings'] if db is not None else None

def init_db():
    """
    Initialize MongoDB Atlas database:
    1. Ensure upload directories exist
    2. Establish connection and ping Atlas
    3. Create indexes for performance and uniqueness
    4. Seed default stakeholder user accounts if not present
    """
    # Ensure local upload directories exist
    os.makedirs(Config.OD_LETTERS_FOLDER, exist_ok=True)
    os.makedirs(Config.CERTIFICATES_FOLDER, exist_ok=True)

    db = MongoDB.connect()
    if db is None:
        print("[!] Note: Flask is running, but MongoDB Atlas is not yet connected.")
        print("    Update MONGO_URI in your .env file to enable live database operations.")
        return False

    try:
        # Create indexes
        users = db['users']
        users.create_index([("id", ASCENDING)], unique=True)
        users.create_index([("identifier", ASCENDING)], unique=True, sparse=True)
        users.create_index([("email", ASCENDING)], unique=True, sparse=True)

        od_reqs = db['od_requests']
        od_reqs.create_index([("id", ASCENDING)], unique=True)
        od_reqs.create_index([("student_id", ASCENDING)])
        od_reqs.create_index([("department", ASCENDING)])
        od_reqs.create_index([("status", ASCENDING)])
        od_reqs.create_index([("created_at", DESCENDING)])

        approvals = db['approvals']
        approvals.create_index([("id", ASCENDING)], unique=True)
        approvals.create_index([("request_id", ASCENDING)])

        certs = db['certificates']
        certs.create_index([("id", ASCENDING)], unique=True)
        certs.create_index([("request_id", ASCENDING)])
        certs.create_index([("student_id", ASCENDING)])

        notifs = db['notifications']
        notifs.create_index([("id", ASCENDING)], unique=True)
        notifs.create_index([("user_id", ASCENDING)])
        notifs.create_index([("created_at", DESCENDING)])

        history = db['od_history']
        history.create_index([("id", ASCENDING)], unique=True)
        history.create_index([("request_id", ASCENDING)])
        history.create_index([("student_id", ASCENDING)])

        # Academic records and upload history collections
        acad_col = db['student_academic_records']
        acad_col.create_index([("id", ASCENDING)], unique=True)
        acad_col.create_index([("student_id", ASCENDING)], unique=True)
        acad_col.create_index([("register_number", ASCENDING)], unique=True, sparse=True)
        acad_col.create_index([("updated_at", DESCENDING)])

        upload_hist_col = db['academic_upload_history']
        upload_hist_col.create_index([("id", ASCENDING)], unique=True)
        upload_hist_col.create_index([("uploaded_by_id", ASCENDING)])
        upload_hist_col.create_index([("created_at", DESCENDING)])

        # Seed Default Users for all Stakeholder Roles if not present
        default_pwd_hash = generate_password_hash('password123')
        seed_users = [
            {
                'id': 'STUD001',
                'identifier': '23CSD001',
                'name': 'Naveen',
                'email': 'naveen.23csd@rajalakshmi.edu.in',
                'role': 'Student',
                'sub_role': 'Student',
                'department': 'Computer Science and Design',
                'year': 'III Year',
                'section': 'A',
                'designation': 'Student',
                'phone': '+91 98765 43210',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'STUD002',
                'identifier': '23CSD002',
                'name': 'Priya S',
                'email': 'priya.23csd@rajalakshmi.edu.in',
                'role': 'Student',
                'sub_role': 'Student',
                'department': 'Computer Science and Design',
                'year': 'III Year',
                'section': 'A',
                'designation': 'Student',
                'phone': '+91 98765 43211',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&h=250&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'STUD003',
                'identifier': '23CSD003',
                'name': 'Karthik R',
                'email': 'karthik.23csd@rajalakshmi.edu.in',
                'role': 'Student',
                'sub_role': 'Student',
                'department': 'Computer Science and Design',
                'year': 'III Year',
                'section': 'B',
                'designation': 'Student',
                'phone': '+91 98765 43212',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&h=250&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'FAC001',
                'identifier': 'EMP-CSD-101',
                'name': 'Dr. A. Rajesh',
                'email': 'a.rajesh@rajalakshmi.edu.in',
                'role': 'Mentor',
                'sub_role': 'Mentor',
                'department': 'Computer Science and Design',
                'year': 'III Year',
                'section': 'III Year - Section A',
                'designation': 'Associate Professor',
                'phone': '+91 98401 23456',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'FAC002',
                'identifier': 'EMP-CSD-102',
                'name': 'Mrs. K. Shanthi',
                'email': 'k.shanthi@rajalakshmi.edu.in',
                'role': 'Class Incharge',
                'sub_role': 'Class Incharge',
                'department': 'Computer Science and Design',
                'year': 'III Year',
                'section': 'III Year - Section A',
                'designation': 'Assistant Professor',
                'phone': '+91 98402 34567',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'FAC004',
                'identifier': 'EMP-CSD-104',
                'name': 'Dr. V. Karpagam',
                'email': 'v.karpagam@rajalakshmi.edu.in',
                'role': 'HOD',
                'sub_role': 'HOD',
                'department': 'Computer Science and Design',
                'year': 'All Years',
                'section': 'All Sections (CSD)',
                'designation': 'Professor & HOD',
                'phone': '+91 98404 56789',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'ADM001',
                'identifier': 'ADMIN-001',
                'name': 'System Administrator',
                'email': 'admin@rajalakshmi.edu.in',
                'role': 'Admin',
                'sub_role': 'Admin',
                'department': 'Administration',
                'year': 'All Years',
                'section': 'All Sections',
                'designation': 'System Administrator',
                'phone': '+91 98400 00001',
                'password_hash': default_pwd_hash,
                'avatar': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            }
        ]

        for user_data in seed_users:
            existing = users.find_one({"$or": [{"id": user_data['id']}, {"identifier": user_data['identifier']}]})
            if not existing:
                users.insert_one(user_data)
            else:
                # Ensure valid password_hash exists
                curr_hash = existing.get('password_hash')
                if not curr_hash or not (curr_hash.startswith('scrypt:') or curr_hash.startswith('pbkdf2:')):
                    users.update_one({"_id": existing['_id']}, {"$set": {"password_hash": default_pwd_hash}})

        # Seed default system settings
        settings_col = db['system_settings']
        existing_settings = settings_col.find_one({"id": "SYSTEM_CONFIG"})
        if not existing_settings:
            settings_col.insert_one({
                "id": "SYSTEM_CONFIG",
                "attendance_threshold_percent": 75.0,
                "cgpa_high_performer_threshold": 8.5,
                "max_od_limit_percent": 10.0,
                "academic_year": "2025-2026",
                "semester_name": "Even Semester",
                "total_working_days": 120,
                "allow_student_self_registration": True,
                "email_notifications_enabled": True,
                "updated_at": "2026-01-01 09:00:00",
                "updated_by": "System Administrator"
            })

        # Seed initial academic records if not present
        seed_academics = [
            {
                'id': 'ACAD_STUD001',
                'student_id': 'STUD001',
                'register_number': '23CSD001',
                'student_name': 'Naveen',
                'cat1_marks': 86.4,
                'cat2_marks': 91.0,
                'cat3_marks': 88.0,
                'attendance_percentage': 88.5,
                'total_working_days': 120,
                'updated_by': 'FAC002',
                'updated_by_name': 'Mrs. K. Shanthi',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'ACAD_STUD002',
                'student_id': 'STUD002',
                'register_number': '23CSD002',
                'student_name': 'Priya S',
                'cat1_marks': 94.0,
                'cat2_marks': 96.5,
                'cat3_marks': 92.0,
                'attendance_percentage': 92.1,
                'total_working_days': 120,
                'updated_by': 'FAC002',
                'updated_by_name': 'Mrs. K. Shanthi',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            },
            {
                'id': 'ACAD_STUD003',
                'student_id': 'STUD003',
                'register_number': '23CSD003',
                'student_name': 'Karthik R',
                'cat1_marks': 68.5,
                'cat2_marks': 71.0,
                'cat3_marks': 74.0,
                'attendance_percentage': 74.2,
                'total_working_days': 120,
                'updated_by': 'FAC002',
                'updated_by_name': 'Mrs. K. Shanthi',
                'created_at': '2026-01-01 09:00:00',
                'updated_at': '2026-01-01 09:00:00'
            }
        ]

        for acad_data in seed_academics:
            existing_acad = acad_col.find_one({"student_id": acad_data['student_id']})
            if not existing_acad:
                acad_col.insert_one(acad_data)
                # Sync into user doc
                users.update_one(
                    {"id": acad_data['student_id']},
                    {"$set": {
                        "attendance_percentage": acad_data['attendance_percentage'],
                        "cat1_marks": acad_data['cat1_marks'],
                        "cat2_marks": acad_data['cat2_marks'],
                        "cat3_marks": acad_data['cat3_marks'],
                        "last_academic_update": acad_data['updated_at']
                    }}
                )

        print("[+] MongoDB Atlas: Verified stakeholder seed accounts and academic records.")
        return True

    except Exception as e:
        print(f"[-] Error during MongoDB schema/seed initialization: {e}")
        return False
