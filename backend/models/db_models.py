"""
SQLAlchemy ORM Models for the OD Tracking System.
All MongoDB collections are replaced by these PostgreSQL tables.
"""
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Text, DateTime,
    ForeignKey, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
import enum

# Ensure project root is in sys.path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.database.postgresql import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    Student = 'Student'
    Mentor = 'Mentor'
    ClassIncharge = 'Class Incharge'
    Counsellor = 'Counsellor'
    HOD = 'HOD'
    Admin = 'Admin'

class ODStatus(str, enum.Enum):
    Pending = 'Pending'
    MentorApproved = 'Mentor Approved'
    MentorRejected = 'Mentor Rejected'
    ClassInchargeApproved = 'Class Incharge Approved'
    ClassInchargeRejected = 'Class Incharge Rejected'
    HODApproved = 'HOD Approved'
    HODRejected = 'HOD Rejected'
    Approved = 'Approved'
    Rejected = 'Rejected'
    AutoRejected = 'Auto Rejected'

class CertificateStatus(str, enum.Enum):
    NotUploaded = 'Not Uploaded'
    PendingVerification = 'Pending Verification'
    Verified = 'Verified'
    Rejected = 'Rejected'

class ApprovalAction(str, enum.Enum):
    Approved = 'Approved'
    Rejected = 'Rejected'
    AutoRejected = 'Auto Rejected'


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = 'users'

    id = Column(String(50), primary_key=True, default=lambda: f"USR_{uuid.uuid4().hex[:8].upper()}")
    identifier = Column(String(100), unique=True, nullable=False)   # Register No / Employee ID
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(512), nullable=False)
    role = Column(String(50), nullable=False)                        # Student / Mentor / etc.
    department = Column(String(200))
    year = Column(String(50))
    section = Column(String(100))
    designation = Column(String(200))
    phone = Column(String(30))
    avatar = Column(Text)
    status = Column(String(20), default='active')                    # active / inactive / UNVERIFIED / DISABLED
    email_verified = Column(Boolean, default=False, nullable=False)
    account_status = Column(String(20), default='ACTIVE', nullable=False)  # UNVERIFIED / ACTIVE / DISABLED
    verification_token_hash = Column(String(256), nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)
    reset_token_hash = Column(String(256), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    student_profile = relationship('Student', foreign_keys='Student.user_id', back_populates='user', uselist=False, cascade='all, delete-orphan')
    od_requests = relationship('ODRequest', foreign_keys='ODRequest.student_id', back_populates='student', cascade='all, delete-orphan')
    approvals = relationship('Approval', back_populates='reviewer', cascade='all, delete-orphan')
    audit_logs = relationship('AuditLog', back_populates='user', cascade='all, delete-orphan')
    notifications = relationship('Notification', foreign_keys='Notification.user_id', back_populates='user', cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_users_email', 'email'),
        Index('ix_users_identifier', 'identifier'),
        Index('ix_users_role', 'role'),
    )

    def to_safe_dict(self):
        """Return user dict without sensitive fields."""
        return {
            'id': self.id,
            'identifier': self.identifier,
            'name': self.full_name,
            'full_name': self.full_name,
            'email': self.email,
            'role': self.role,
            'department': self.department,
            'year': self.year,
            'section': self.section,
            'designation': self.designation,
            'phone': self.phone,
            'avatar': self.avatar,
            'status': self.status,
            'email_verified': getattr(self, 'email_verified', True),
            'account_status': getattr(self, 'account_status', 'ACTIVE'),
            'password_changed_at': self.password_changed_at.isoformat() if getattr(self, 'password_changed_at', None) is not None else None,
            'last_login': self.last_login.isoformat() if self.last_login is not None else None,
            'created_at': self.created_at.isoformat() if self.created_at is not None else None,
        }


# ─── Student (extended academic profile) ──────────────────────────────────────

class Student(Base):
    __tablename__ = 'students'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    register_number = Column(String(50), unique=True, nullable=False)
    mentor_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    class_incharge_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    semester = Column(Integer, default=1)
    overall_attendance = Column(Float, default=0.0)   # Computed/cached overall %
    od_used_days = Column(Float, default=0.0)          # Total OD days consumed
    total_working_days = Column(Integer, default=0)
    cgpa = Column(Float)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship('User', foreign_keys=[user_id], back_populates='student_profile')
    mentor = relationship('User', foreign_keys=[mentor_id])
    class_incharge = relationship('User', foreign_keys=[class_incharge_id])
    attendance_records = relationship('Attendance', primaryjoin="Student.user_id==Attendance.student_id", foreign_keys="[Attendance.student_id]", cascade='all, delete-orphan')
    cat_marks_records = relationship('CATMarks', primaryjoin="Student.user_id==CATMarks.student_id", foreign_keys="[CATMarks.student_id]", cascade='all, delete-orphan')


# ─── Subject ──────────────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = 'subjects'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), nullable=False)
    name = Column(String(300), nullable=False)
    faculty_name = Column(String(200))
    department = Column(String(200))
    semester = Column(Integer)
    total_classes = Column(Integer, default=0)

    attendance_records = relationship('Attendance', back_populates='subject', cascade='all, delete-orphan')
    cat_marks_records = relationship('CATMarks', back_populates='subject', cascade='all, delete-orphan')

    __table_args__ = (UniqueConstraint('code', 'department', 'semester', name='uq_subject_code_dept_sem'),)


# ─── Attendance ───────────────────────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = 'attendance'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False)
    total_classes = Column(Integer, default=0)
    attended = Column(Integer, default=0)
    absent = Column(Integer, default=0)
    od_approved = Column(Integer, default=0)
    attendance_percent = Column(Float, default=0.0)
    semester = Column(Integer)
    academic_year = Column(String(20))
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    student = relationship('User', foreign_keys=[student_id], overlaps="attendance_records")
    subject = relationship('Subject', back_populates='attendance_records')

    __table_args__ = (
        UniqueConstraint('student_id', 'subject_id', 'semester', 'academic_year', name='uq_attendance_student_subject'),
        Index('ix_attendance_student_id', 'student_id'),
    )


# ─── CAT Marks ────────────────────────────────────────────────────────────────

class CATMarks(Base):
    __tablename__ = 'cat_marks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False)
    cat1 = Column(Float)
    cat2 = Column(Float)
    cat3 = Column(Float)
    max_marks = Column(Float, default=50.0)
    semester = Column(Integer)
    academic_year = Column(String(20))
    created_at = Column(DateTime, default=utc_now)

    student = relationship('User', foreign_keys=[student_id], overlaps="cat_marks_records")
    subject = relationship('Subject', back_populates='cat_marks_records')

    __table_args__ = (
        UniqueConstraint('student_id', 'subject_id', 'semester', 'academic_year', name='uq_marks_student_subject'),
        Index('ix_cat_marks_student_id', 'student_id'),
    )


# ─── OD Request ───────────────────────────────────────────────────────────────

class ODRequest(Base):
    __tablename__ = 'od_requests'

    id = Column(String(60), primary_key=True,
                default=lambda: f"REQ_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:6].upper()}")
    student_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    student_reg_no = Column(String(50))
    student_name = Column(String(200))
    department = Column(String(200))
    year = Column(String(50))
    section = Column(String(50))

    # Event details
    event_name = Column(String(300), nullable=False)
    event_type = Column(String(100))
    event_organizer = Column(String(300))
    venue = Column(String(300))
    from_date = Column(String(20))
    to_date = Column(String(20))
    from_time = Column(String(10), default='09:00')
    to_time = Column(String(10), default='17:00')
    number_of_days = Column(Float, default=1.0)
    reason = Column(Text)
    description = Column(Text)
    od_letter_url = Column(Text)

    # Status tracking
    status = Column(String(50), default='Pending')
    current_stage = Column(String(50), default='Mentor')
    certificate_status = Column(String(50), default='Not Uploaded')
    certificate_url = Column(Text)
    rejection_reason = Column(Text)
    remarks = Column(Text)

    # Event & Certificate Timestamps
    event_start_datetime = Column(DateTime, nullable=True)
    event_end_datetime = Column(DateTime, nullable=True)
    hod_approved_at = Column(DateTime, nullable=True)
    certificate_deadline = Column(DateTime, nullable=True)
    certificate_submitted_at = Column(DateTime, nullable=True)

    # OD eligibility snapshot (at time of request)
    attendance_at_request = Column(Float)     # Overall attendance % when submitted
    od_used_at_request = Column(Float)        # OD days used before this request
    od_percentage_requested = Column(Float)   # This request's OD %
    max_od_allowed_percent = Column(Float)    # 10% of attendance at request time

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    student = relationship('User', foreign_keys=[student_id], back_populates='od_requests')
    approvals = relationship('Approval', back_populates='od_request', cascade='all, delete-orphan')
    certificates = relationship('Certificate', back_populates='od_request', cascade='all, delete-orphan')
    history = relationship('ODHistory', back_populates='od_request', cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_od_requests_student_id', 'student_id'),
        Index('ix_od_requests_status', 'status'),
        Index('ix_od_requests_created_at', 'created_at'),
        Index('ix_od_requests_department', 'department'),
    )


# ─── Approval ─────────────────────────────────────────────────────────────────

class Approval(Base):
    __tablename__ = 'approvals'

    id = Column(String(60), primary_key=True,
                default=lambda: f"APPR_{uuid.uuid4().hex[:8].upper()}")
    request_id = Column(String(60), ForeignKey('od_requests.id', ondelete='CASCADE'), nullable=False)
    reviewer_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewer_name = Column(String(200))
    reviewer_role = Column(String(50))
    action = Column(String(50))     # Approved / Rejected / Auto Rejected
    comments = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='approvals')
    reviewer = relationship('User', back_populates='approvals')

    __table_args__ = (Index('ix_approvals_request_id', 'request_id'),)


# ─── Certificate ──────────────────────────────────────────────────────────────

class Certificate(Base):
    __tablename__ = 'certificates'

    id = Column(String(60), primary_key=True,
                default=lambda: f"CERT_{uuid.uuid4().hex[:8].upper()}")
    request_id = Column(String(60), ForeignKey('od_requests.id', ondelete='CASCADE'), nullable=False)
    student_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    student_reg_no = Column(String(50))
    event_name = Column(String(300))
    certificate_file_url = Column(Text)
    upload_date = Column(DateTime, default=utc_now)
    status = Column(String(50), default='Pending Verification')
    verified_by_id = Column(String(50))
    verified_by_name = Column(String(200))
    verified_at = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='certificates')
    student = relationship('User', foreign_keys=[student_id])

    __table_args__ = (Index('ix_certificates_request_id', 'request_id'),)


# ─── Notification ─────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(String(60), primary_key=True,
                default=lambda: f"NOTIF_{uuid.uuid4().hex[:8].upper()}")
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default='info')    # info / success / warning / error
    read = Column(Boolean, default=False)
    related_request_id = Column(String(60))
    created_at = Column(DateTime, default=utc_now)

    user = relationship('User', foreign_keys=[user_id], back_populates='notifications')

    __table_args__ = (Index('ix_notifications_user_id', 'user_id'),)


# ─── OD History ───────────────────────────────────────────────────────────────

class ODHistory(Base):
    __tablename__ = 'od_history'

    id = Column(String(60), primary_key=True,
                default=lambda: f"HIST_{uuid.uuid4().hex[:8].upper()}")
    request_id = Column(String(60), ForeignKey('od_requests.id', ondelete='CASCADE'), nullable=False)
    student_id = Column(String(50))
    action = Column(String(100))
    performed_by_id = Column(String(50))
    performed_by_name = Column(String(200))
    role = Column(String(50))
    stage = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='history')

    __table_args__ = (Index('ix_od_history_request_id', 'request_id'),)


# ─── Audit Log ────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    user_email = Column(String(200))
    user_role = Column(String(50))
    action = Column(String(100), nullable=False)     # LOGIN_SUCCESS, OD_REQUEST_CREATED, etc.
    entity_type = Column(String(100))                # ODRequest, User, Certificate, etc.
    entity_id = Column(String(100))
    description = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=utc_now)

    user = relationship('User', back_populates='audit_logs')

    __table_args__ = (
        Index('ix_audit_logs_user_id', 'user_id'),
        Index('ix_audit_logs_action', 'action'),
        Index('ix_audit_logs_created_at', 'created_at'),
    )
