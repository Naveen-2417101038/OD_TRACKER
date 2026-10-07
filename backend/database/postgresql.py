# PostgreSQL Database Engine & Session Management
import os

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker, scoped_session, DeclarativeBase
    from sqlalchemy.pool import NullPool
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False
    raise ImportError("SQLAlchemy is not installed in this Python environment.")


try:
    from backend.config import Config
except ImportError:
    from config import Config


class Base(DeclarativeBase):
    pass



class PostgreSQLDB:
    _engine = None
    _session_factory = None
    _is_connected = False
    _connection_error = None

    @classmethod
    def get_engine(cls):
        if cls._engine is None:
            cls.connect()
        return cls._engine

    @classmethod
    def get_session(cls):
        if cls._session_factory is None:
            cls.connect()
        if cls._session_factory is None:
            raise RuntimeError("Database session factory could not be initialized")
        return cls._session_factory()

    @classmethod
    def connect(cls):
        """Initialize SQLAlchemy engine with PostgreSQL."""
        if cls._is_connected and cls._engine is not None:
            return cls._engine
        try:
            db_url = Config.SQLALCHEMY_DATABASE_URI
            cls._engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=300,
                pool_size=10,
                max_overflow=20,
                echo=False,
            )
            # Test connection
            with cls._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            cls._session_factory = scoped_session(
                sessionmaker(bind=cls._engine, autocommit=False, autoflush=False)
            )
            cls._is_connected = True
            cls._db_type = "PostgreSQL"
            cls._connection_error = None
            print(f"[+] PostgreSQL connected: {db_url.split('@')[-1]}")
            return cls._engine
        except Exception as e:
            try:
                sqlite_path = os.path.join(Config.BASE_DIR, "od_tracking.db")
                sqlite_url = f"sqlite:///{sqlite_path}"
                cls._engine = create_engine(sqlite_url, pool_pre_ping=True, echo=False)
                cls._session_factory = scoped_session(
                    sessionmaker(bind=cls._engine, autocommit=False, autoflush=False)
                )
                cls._is_connected = True
                cls._db_type = "SQLite (Fallback)"
                cls._connection_error = None
                print(f"[!] PostgreSQL unavailable ({e}). Fallback to SQLite: {sqlite_path}")
                return cls._engine
            except Exception as sqle:
                cls._is_connected = False
                cls._db_type = "None"
                cls._connection_error = str(sqle)
                print(f"[-] Database connection failed: {sqle}")
                return None

    @classmethod
    def get_status(cls):
        return {
            "status": "connected" if cls._is_connected else "disconnected",
            "type": getattr(cls, "_db_type", "PostgreSQL"),
            "connected": cls._is_connected,
            "error": cls._connection_error,
        }

    @classmethod
    def close_session(cls):
        if cls._session_factory:
            cls._session_factory.remove()


def get_db_session():
    """Return a database session. Caller must close it."""
    return PostgreSQLDB.get_session()


def get_db_connection():
    """Return DBAPI connection for compatibility."""
    engine = PostgreSQLDB.get_engine()
    if engine is None:
        raise RuntimeError("Database engine not initialized")
    raw_conn = engine.raw_connection()
    if hasattr(raw_conn, 'connection') and hasattr(getattr(raw_conn, 'connection'), 'row_factory'):
        import sqlite3
        setattr(getattr(raw_conn, 'connection'), 'row_factory', sqlite3.Row)
    elif hasattr(raw_conn, 'row_factory'):
        import sqlite3
        setattr(raw_conn, 'row_factory', sqlite3.Row)
    return raw_conn


def init_db(app=None):
    """Initialize database: create tables and seed default data."""
    os.makedirs(Config.OD_LETTERS_FOLDER, exist_ok=True)
    os.makedirs(Config.CERTIFICATES_FOLDER, exist_ok=True)

    engine = PostgreSQLDB.connect()
    if engine is None:
        print("[!] PostgreSQL not connected. Check DATABASE_URL in .env")
        return False

    try:
        # Import all models so Base knows about them
        from backend.models.db_models import (  # noqa: F401
            User, Student, ODRequest, Approval, Certificate,
            Notification, ODHistory, Attendance, CATMarks, Subject, AuditLog
        )
        Base.metadata.create_all(engine)
        _migrate_schema(engine)
        print("[+] PostgreSQL: All tables created/verified.")
        _seed_default_users(engine)
        _seed_academic_data(engine)
        return True
    except Exception as e:
        print(f"[-] DB init error: {e}")
        return False


def _migrate_schema(engine):
    """Ensure newly added authentication columns exist in users table."""
    with engine.begin() as conn:
        columns_to_add = [
            ("email_verified", "BOOLEAN DEFAULT 1"),
            ("account_status", "VARCHAR(20) DEFAULT 'ACTIVE'"),
            ("verification_token_hash", "VARCHAR(256) NULL"),
            ("verification_token_expires", "TIMESTAMP NULL"),
            ("reset_token_hash", "VARCHAR(256) NULL"),
            ("reset_token_expires", "TIMESTAMP NULL"),
            ("password_changed_at", "TIMESTAMP NULL"),
        ]
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass


def _seed_default_users(engine):
    """Seed default users for all roles if not present."""
    from sqlalchemy.orm import Session
    from backend.models.db_models import User, Student, Attendance, CATMarks, Subject
    from werkzeug.security import generate_password_hash
    from datetime import datetime, timezone

    default_hash = generate_password_hash('password123')
    now = datetime.now(timezone.utc)

    seed_users = [
        {
            'id': 'STUD001',
            'identifier': '23CSD001',
            'full_name': 'Naveen',
            'email': 'naveen.23csd@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'Student',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'A',
            'designation': 'Student',
            'phone': '+91 98765 43210',
            'status': 'active',
        },
        {
            'id': 'FAC001',
            'identifier': 'EMP-CSD-101',
            'full_name': 'Dr. A. Rajesh',
            'email': 'a.rajesh@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'Mentor',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'III Year - Section A',
            'designation': 'Associate Professor',
            'phone': '+91 98401 23456',
            'status': 'active',
        },
        {
            'id': 'FAC002',
            'identifier': 'EMP-CSD-102',
            'full_name': 'Mrs. K. Shanthi',
            'email': 'k.shanthi@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'Class Incharge',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'III Year - Section A',
            'designation': 'Assistant Professor',
            'phone': '+91 98402 34567',
            'status': 'active',
        },
        {
            'id': 'FAC003',
            'identifier': 'EMP-CSD-103',
            'full_name': 'Dr. P. Counsellor',
            'email': 'p.counsellor@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'Counsellor',
            'department': 'Computer Science and Design',
            'year': 'III Year',
            'section': 'III Year - Section A',
            'designation': 'Assistant Professor',
            'phone': '+91 98403 45678',
            'status': 'active',
        },
        {
            'id': 'FAC004',
            'identifier': 'EMP-CSD-104',
            'full_name': 'Dr. V. Karpagam',
            'email': 'v.karpagam@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'HOD',
            'department': 'Computer Science and Design',
            'year': 'All Years',
            'section': 'All Sections (CSD)',
            'designation': 'Professor & HOD',
            'phone': '+91 98404 56789',
            'status': 'active',
        },
        {
            'id': 'ADM001',
            'identifier': 'ADMIN-001',
            'full_name': 'System Administrator',
            'email': 'admin@rajalakshmi.edu.in',
            'password_hash': default_hash,
            'role': 'Admin',
            'department': 'Administration',
            'year': 'N/A',
            'section': 'N/A',
            'designation': 'System Administrator',
            'phone': '+91 98400 00001',
            'status': 'active',
        },
    ]

    with Session(engine) as session:
        for ud in seed_users:
            existing = session.get(User, ud['id'])
            if not existing:
                user = User(
                    id=ud['id'],
                    identifier=ud['identifier'],
                    full_name=ud['full_name'],
                    email=ud['email'].lower().strip(),
                    password_hash=ud['password_hash'],
                    role=ud['role'],
                    department=ud['department'],
                    year=ud.get('year'),
                    section=ud.get('section'),
                    designation=ud.get('designation'),
                    phone=ud.get('phone'),
                    status=ud.get('status', 'active'),
                    email_verified=True,
                    account_status='ACTIVE',
                    created_at=now,
                    updated_at=now,
                )
                session.add(user)
                # Seed extra student record
                if ud['role'] == 'Student':
                    student = Student(
                        user_id=ud['id'],
                        register_number=ud['identifier'],
                        mentor_id='FAC001',
                        class_incharge_id='FAC002',
                        semester=5,
                        overall_attendance=88.5,
                        od_used_days=0.0,
                        total_working_days=120,
                        cgpa=8.92,
                    )
                    session.add(student)
        session.commit()
    print("[+] PostgreSQL: Default users seeded (Student, Mentor, Class Incharge, Counsellor, HOD, Admin).")


def _seed_academic_data(engine):
    """Seed attendance and CAT marks for the demo student."""
    from sqlalchemy.orm import Session
    from backend.models.db_models import Subject, Attendance, CATMarks
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    subjects_data = [
        ('CS3401', 'Design and Analysis of Algorithms', 'Dr. M. Senthil', 5),
        ('CS3402', 'Operating Systems & System Software', 'Dr. M. Senthil', 5),
        ('CS3403', 'Database Management Systems', 'Dr. R. Priya', 5),
        ('CS3404', 'Computer Networks', 'Dr. S. Kumar', 5),
        ('CS3405', 'Software Engineering', 'Mrs. K. Shanthi', 5),
    ]

    attendance_data = [88, 92, 78, 85, 95]
    cat_marks_data = [
        (42, 45), (48, 46), (35, 38), (40, 44), (47, 48)
    ]

    with Session(engine) as session:
        existing_subjects = session.query(Subject).filter(
            Subject.department == 'Computer Science and Design', Subject.semester == 5
        ).all()
        if existing_subjects:
            return

        subject_ids = []
        for code, name, faculty, sem in subjects_data:
            subj = Subject(
                code=code,
                name=name,
                faculty_name=faculty,
                department='Computer Science and Design',
                semester=sem,
                total_classes=50,
            )
            session.add(subj)
            session.flush()
            subject_ids.append(subj.id)

        for i, (subj_id, att_pct) in enumerate(zip(subject_ids, attendance_data)):
            attended = int(50 * att_pct / 100)
            session.add(Attendance(
                student_id='STUD001',
                subject_id=subj_id,
                total_classes=50,
                attended=attended,
                absent=50 - attended,
                od_approved=2,
                attendance_percent=float(att_pct),
                semester=5,
                academic_year='2026-27',
                created_at=now,
            ))

        for i, (subj_id, (c1, c2)) in enumerate(zip(subject_ids, cat_marks_data)):
            session.add(CATMarks(
                student_id='STUD001',
                subject_id=subj_id,
                cat1=float(c1),
                cat2=float(c2),
                cat3=None,
                max_marks=50.0,
                semester=5,
                academic_year='2026-27',
                created_at=now,
            ))

        session.commit()
    print("[+] PostgreSQL: Academic seed data (attendance + CAT marks) inserted.")
