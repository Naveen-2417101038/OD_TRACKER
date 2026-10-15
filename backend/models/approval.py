"""
Approval Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.database.sql_server import session_scope
from backend.models.db_models import Approval, User, parse_datetime, to_iso


class ApprovalModel:
    @staticmethod
    def create(data: dict) -> Optional[dict]:
        appr_id = data.get('id') or f"APPR_{uuid.uuid4().hex[:8].upper()}"
        created_dt = parse_datetime(data.get('created_at')) or datetime.now()

        with session_scope() as session:
            # Check if reviewer_id exists in users table, else None to satisfy FK
            rev_id = data.get('reviewer_id')
            if rev_id:
                user_exists = session.query(User.id).filter(User.id == str(rev_id)).first()
                if not user_exists:
                    rev_id = None

            record = Approval(
                id=appr_id,
                request_id=str(data.get('request_id')),
                reviewer_id=str(rev_id) if rev_id else None,
                reviewer_name=data.get('reviewer_name'),
                reviewer_role=data.get('reviewer_role'),
                action=data.get('action'),
                comments=data.get('comments'),
                created_at=created_dt,
            )
            session.add(record)
            session.flush()
            return record.to_dict()

    @staticmethod
    def list_by_request(request_id: Any) -> List[dict]:
        with session_scope() as session:
            records = (
                session.query(Approval)
                .filter(Approval.request_id == str(request_id))
                .order_by(Approval.created_at.asc())
                .all()
            )
            return [r.to_dict() for r in records]
