"""
Academic Record Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
"""
import uuid
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_, func
from backend.database.sql_server import session_scope
from backend.models.db_models import (
    StudentAcademicRecord,
    AcademicUploadHistory,
    User,
    parse_datetime,
    to_iso,
)


class AcademicRecordModel:
    @staticmethod
    def get_by_student_id(student_id: Any) -> Optional[dict]:
        """Retrieve academic record for a specific student ID."""
        if not student_id:
            return None
        clean_id = str(student_id).strip()
        with session_scope() as session:
            record = (
                session.query(StudentAcademicRecord)
                .filter(
                    or_(
                        StudentAcademicRecord.student_id == clean_id,
                        StudentAcademicRecord.id == clean_id,
                    )
                )
                .first()
            )
            return record.to_dict() if record else None

    @staticmethod
    def get_by_register_number(register_no: str) -> Optional[dict]:
        """Retrieve academic record by register number (case-insensitive)."""
        if not register_no:
            return None
        clean_reg = register_no.strip().lower()
        with session_scope() as session:
            record = (
                session.query(StudentAcademicRecord)
                .filter(func.lower(StudentAcademicRecord.register_number) == clean_reg)
                .first()
            )
            return record.to_dict() if record else None

    @staticmethod
    def list_all() -> List[dict]:
        """List all academic records sorted by register number."""
        with session_scope() as session:
            records = (
                session.query(StudentAcademicRecord)
                .order_by(StudentAcademicRecord.register_number.asc())
                .all()
            )
            return [r.to_dict() for r in records]

    @staticmethod
    def upsert_academic_record(
        student_id: str,
        register_number: str,
        student_name: str,
        cat1: Any,
        cat2: Any,
        cat3: Any,
        attendance: Any,
        updated_by_id: str,
        updated_by_name: str,
        cgpa: Any = None,
    ) -> Optional[dict]:
        """
        Create or update a student's academic record.
        Also syncs attendance, CAT marks, and CGPA directly into the student's User record.
        """
        now = datetime.now()
        c1 = float(cat1) if cat1 is not None and str(cat1).strip() != '' else None
        c2 = float(cat2) if cat2 is not None and str(cat2).strip() != '' else None
        c3 = float(cat3) if cat3 is not None and str(cat3).strip() != '' else None
        att = float(attendance) if attendance is not None else 0.0

        with session_scope() as session:
            record = (
                session.query(StudentAcademicRecord)
                .filter(
                    or_(
                        StudentAcademicRecord.student_id == student_id,
                        StudentAcademicRecord.register_number == register_number,
                    )
                )
                .first()
            )

            if not record:
                record = StudentAcademicRecord(
                    id=f"ACAD_{student_id}",
                    student_id=student_id,
                    register_number=register_number,
                    student_name=student_name,
                    created_at=now,
                )
                session.add(record)

            record.student_name = student_name
            record.cat1_marks = c1
            record.cat2_marks = c2
            record.cat3_marks = c3
            record.attendance_percentage = att
            record.total_working_days = 120
            record.updated_by = updated_by_id
            record.updated_by_name = updated_by_name
            record.updated_at = now

            # Sync user table
            user = (
                session.query(User)
                .filter(or_(User.id == student_id, User.identifier == register_number))
                .first()
            )
            if user:
                user.attendance_percentage = att
                user.cat1_marks = c1
                user.cat2_marks = c2
                user.cat3_marks = c3
                user.last_academic_update = now
                user.updated_at = now

            session.flush()
            return record.to_dict()

    @staticmethod
    def batch_update_records(validated_rows: list, updated_by_id: str, updated_by_name: str) -> Tuple[Optional[list], Optional[str]]:
        """
        Transaction-safe batch update of multiple student academic records.
        Executed within a single database transaction.
        """
        now = datetime.now()
        updated_records = []

        try:
            with session_scope() as session:
                for row in validated_rows:
                    student_id = row.get('student_id')
                    reg_no = row.get('register_number')
                    student_name = row.get('student_name')
                    cat1 = row.get('cat1')
                    cat2 = row.get('cat2')
                    cat3 = row.get('cat3')
                    att = row.get('attendance')

                    if not student_id or not reg_no:
                        continue

                    c1 = float(cat1) if cat1 is not None and str(cat1).strip() != '' else None
                    c2 = float(cat2) if cat2 is not None and str(cat2).strip() != '' else None
                    c3 = float(cat3) if cat3 is not None and str(cat3).strip() != '' else None
                    att_val = float(att) if att is not None else 0.0

                    record = (
                        session.query(StudentAcademicRecord)
                        .filter(
                            or_(
                                StudentAcademicRecord.student_id == student_id,
                                StudentAcademicRecord.register_number == reg_no,
                            )
                        )
                        .first()
                    )

                    if not record:
                        record = StudentAcademicRecord(
                            id=f"ACAD_{student_id}",
                            student_id=student_id,
                            register_number=reg_no,
                            student_name=student_name,
                            created_at=now,
                        )
                        session.add(record)

                    record.student_name = student_name
                    record.cat1_marks = c1
                    record.cat2_marks = c2
                    record.cat3_marks = c3
                    record.attendance_percentage = att_val
                    record.total_working_days = 120
                    record.updated_by = updated_by_id
                    record.updated_by_name = updated_by_name
                    record.updated_at = now

                    # Sync into User
                    user = (
                        session.query(User)
                        .filter(or_(User.id == student_id, User.identifier == reg_no))
                        .first()
                    )
                    if user:
                        user.attendance_percentage = att_val
                        user.cat1_marks = c1
                        user.cat2_marks = c2
                        user.cat3_marks = c3
                        user.last_academic_update = now
                        user.updated_at = now

                    session.flush()
                    updated_records.append(record.to_dict())

                return updated_records, None

        except Exception as e:
            return None, f"Batch database transaction failed: {str(e)}"


class AcademicUploadHistoryModel:
    @staticmethod
    def create(data: dict) -> Optional[dict]:
        """Insert a new upload history audit record."""
        history_id = data.get('id') or f"UPL_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now()
        upload_dt = parse_datetime(data.get('upload_date')) or now

        with session_scope() as session:
            record = AcademicUploadHistory(
                id=history_id,
                upload_date=upload_dt,
                uploaded_by_id=data.get('uploaded_by_id'),
                uploaded_by_name=data.get('uploaded_by_name'),
                file_name=data.get('file_name'),
                total_rows=int(data.get('total_rows', 0)),
                successful_updates=int(data.get('successful_updates', 0)),
                unmatched_count=int(data.get('unmatched_count', 0)),
                invalid_count=int(data.get('invalid_count', 0)),
                status=data.get('status', 'Completed'),
                details_json=json.dumps(data.get('details', [])) if data.get('details') else None,
                created_at=now,
            )
            session.add(record)
            session.flush()
            return record.to_dict()

    @staticmethod
    def list_all(limit: int = 50) -> List[dict]:
        """List upload history ordered by creation date descending."""
        with session_scope() as session:
            records = (
                session.query(AcademicUploadHistory)
                .order_by(AcademicUploadHistory.created_at.desc())
                .limit(limit)
                .all()
            )
            return [r.to_dict() for r in records]

    @staticmethod
    def get_by_id(history_id: Any) -> Optional[dict]:
        """Retrieve upload history log by ID."""
        if not history_id:
            return None
        with session_scope() as session:
            record = session.query(AcademicUploadHistory).filter(AcademicUploadHistory.id == str(history_id)).first()
            return record.to_dict() if record else None
