"""
OD History Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.database.sql_server import session_scope
from backend.models.db_models import ODHistory, parse_datetime, to_iso


class ODHistoryModel:
    @staticmethod
    def create(data: dict) -> Optional[dict]:
        hist_id = data.get('id') or f"HIST_{uuid.uuid4().hex[:8].upper()}"
        created_dt = parse_datetime(data.get('created_at')) or datetime.now()

        with session_scope() as session:
            record = ODHistory(
                id=hist_id,
                request_id=str(data.get('request_id')),
                student_id=str(data.get('student_id')) if data.get('student_id') else None,
                action=data.get('action'),
                performed_by_id=data.get('performed_by_id'),
                performed_by_name=data.get('performed_by_name'),
                role=data.get('role'),
                stage=data.get('stage'),
                remarks=data.get('remarks'),
                created_at=created_dt,
            )
            session.add(record)
            session.flush()
            return record.to_dict()

    @staticmethod
    def list_by_request(request_id: Any) -> List[dict]:
        with session_scope() as session:
            records = (
                session.query(ODHistory)
                .filter(ODHistory.request_id == str(request_id))
                .order_by(ODHistory.created_at.asc())
                .all()
            )
            return [r.to_dict() for r in records]

    @staticmethod
    def list_all(limit: int = 100) -> List[dict]:
        with session_scope() as session:
            records = (
                session.query(ODHistory)
                .order_by(ODHistory.created_at.desc())
                .limit(limit)
                .all()
            )
            return [r.to_dict() for r in records]
