"""
Certificate Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.database.sql_server import session_scope
from backend.models.db_models import Certificate, parse_datetime, to_iso


class CertificateModel:
    @staticmethod
    def create(data: dict) -> Optional[dict]:
        cert_id = data.get('id') or f"CERT_{uuid.uuid4().hex[:8].upper()}"
        upload_dt = parse_datetime(data.get('upload_date')) or datetime.now()

        with session_scope() as session:
            record = Certificate(
                id=cert_id,
                request_id=str(data.get('request_id')),
                student_id=str(data.get('student_id')),
                student_reg_no=data.get('student_reg_no'),
                event_name=data.get('event_name'),
                certificate_file_url=data.get('certificate_file_url'),
                upload_date=upload_dt,
                status=data.get('status', 'Pending Verification'),
                verified_by_id=data.get('verified_by_id'),
                verified_by_name=data.get('verified_by_name'),
                verified_at=parse_datetime(data.get('verified_at')),
                remarks=data.get('remarks'),
                created_at=datetime.now(),
            )
            session.add(record)
            session.flush()
            return record.to_dict()

    @staticmethod
    def update_verification(request_id: Any, status: str, verified_by_id: str, verified_by_name: str, remarks: str = '') -> Optional[dict]:
        with session_scope() as session:
            records = session.query(Certificate).filter(Certificate.request_id == str(request_id)).all()
            now = datetime.now()
            for r in records:
                r.status = status
                r.verified_by_id = verified_by_id
                r.verified_by_name = verified_by_name
                r.verified_at = now
                r.remarks = remarks
            session.flush()
            return CertificateModel.get_by_request_id(request_id)

    @staticmethod
    def get_by_request_id(request_id: Any) -> Optional[dict]:
        with session_scope() as session:
            cert = session.query(Certificate).filter(Certificate.request_id == str(request_id)).first()
            return cert.to_dict() if cert else None

    @staticmethod
    def list_all() -> List[dict]:
        with session_scope() as session:
            records = session.query(Certificate).order_by(Certificate.created_at.desc()).all()
            return [r.to_dict() for r in records]
