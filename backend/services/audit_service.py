"""
Centralized Audit Logging Service.

Every important system action is recorded in the audit_logs table.
NEVER log: passwords, password hashes, tokens, secret keys.
"""
from datetime import datetime, timezone
from typing import Any
from flask import request as flask_request


try:
    from backend.database.mongodb import get_db
except ImportError:
    try:
        from database.mongodb import get_db
    except ImportError:
        get_db = lambda: None

try:
    from backend.database.postgresql import get_db_session
    from backend.models.db_models import AuditLog
except ImportError:
    get_db_session = None
    AuditLog = None



# ─── Audit Action Constants ───────────────────────────────────────────────────

class AuditAction:
    # Auth
    REGISTRATION = 'REGISTRATION'
    EMAIL_VERIFIED = 'EMAIL_VERIFIED'
    LOGIN_SUCCESS = 'LOGIN_SUCCESS'
    LOGIN_FAILED = 'LOGIN_FAILED'
    LOGOUT = 'LOGOUT'
    PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED'
    PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED'
    PASSWORD_CHANGED = 'PASSWORD_CHANGED'
    ACCOUNT_DISABLED = 'ACCOUNT_DISABLED'
    ACCOUNT_ENABLED = 'ACCOUNT_ENABLED'

    # Student
    OD_REQUEST_CREATED = 'OD_REQUEST_CREATED'
    OD_REQUEST_UPDATED = 'OD_REQUEST_UPDATED'
    OD_AUTO_REJECTED = 'OD_AUTO_REJECTED'
    CERTIFICATE_UPLOADED = 'CERTIFICATE_UPLOADED'

    # Mentor
    OD_REQUEST_VIEWED = 'OD_REQUEST_VIEWED'
    OD_REQUEST_APPROVED = 'OD_REQUEST_APPROVED'
    OD_REQUEST_REJECTED = 'OD_REQUEST_REJECTED'
    CERTIFICATE_VERIFIED = 'CERTIFICATE_VERIFIED'

    # Academic data
    ATTENDANCE_VIEWED = 'ATTENDANCE_VIEWED'
    CAT_MARKS_VIEWED = 'CAT_MARKS_VIEWED'

    # HOD
    REPORT_EXPORTED = 'REPORT_EXPORTED'

    # Admin
    USER_CREATED = 'USER_CREATED'
    USER_UPDATED = 'USER_UPDATED'
    USER_DEACTIVATED = 'USER_DEACTIVATED'
    USER_ROLE_CHANGED = 'USER_ROLE_CHANGED'
    AUDIT_LOG_VIEWED = 'AUDIT_LOG_VIEWED'


def log_action(
    action: str,
    user_id: str | None = None,
    user_email: str | None = None,
    user_role: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    description: str | None = None,
    ip_address: str | None = None,
):
    """
    Record an audit log entry in PostgreSQL.

    This must be called AFTER the actual database operation succeeds.
    If the operation fails, do NOT call this — the audit log must reflect reality.
    """
    # Never log sensitive fields
    assert 'password' not in (description or '').lower() or 'changed' in (description or '').lower() or 'reset' in (description or '').lower(), \
        "Audit log must not contain password details"

    # Auto-detect IP if not provided
    if ip_address is None:
        try:
            ip_address = flask_request.remote_addr
        except RuntimeError:
            ip_address = 'system'

    # Try MongoDB first
    try:
        db = get_db()
        if db is not None:
            db['audit_logs'].insert_one({
                'user_id': user_id,
                'user_email': user_email,
                'user_role': user_role,
                'action': action,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'description': description,
                'ip_address': ip_address,
                'created_at': datetime.now(timezone.utc).isoformat()
            })
            return
    except Exception as me:
        pass

    if callable(get_db_session) and AuditLog is not None:
        session = get_db_session()
        try:
            log_entry = AuditLog(
                user_id=user_id,
                user_email=user_email,
                user_role=user_role,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                ip_address=ip_address,
                created_at=datetime.now(timezone.utc),
            )
            session.add(log_entry)
            session.commit()
        except Exception as e:
            if hasattr(session, 'rollback'):
                session.rollback()
            print(f"[!] Audit log write failed: {e}")
        finally:
            if hasattr(session, 'close'):
                session.close()



def log_from_user(user: dict, action: str, **kwargs):
    """Convenience wrapper extracting user fields from dict."""
    log_action(
        action=action,
        user_id=str(user.get('id')) if user.get('id') else None,
        user_email=str(user.get('email')) if user.get('email') else None,
        user_role=str(user.get('role')) if user.get('role') else None,
        **kwargs,
    )


def get_audit_logs(
    page: int = 1,
    per_page: int = 50,
    user_email: str | None = None,
    user_role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
) -> dict:
    """
    Query audit logs with filtering and pagination.
    Returns dict with logs list, total, page, per_page.
    """
    # MongoDB support
    try:
        db = get_db()
        if db is not None:
            query_filter: dict = {}
            if user_email:
                query_filter['user_email'] = {'$regex': user_email, '$options': 'i'}
            if user_role:
                query_filter['user_role'] = {'$regex': f"^{user_role}$", '$options': 'i'}
            if action:
                query_filter['action'] = action
            if entity_type:
                query_filter['entity_type'] = entity_type
            if entity_id:
                query_filter['entity_id'] = entity_id
            if search:
                query_filter['$or'] = [
                    {'description': {'$regex': search, '$options': 'i'}},
                    {'user_email': {'$regex': search, '$options': 'i'}},
                    {'action': {'$regex': search, '$options': 'i'}},
                    {'entity_id': {'$regex': search, '$options': 'i'}}
                ]

            col = db['audit_logs']
            total = col.count_documents(query_filter)
            cursor = col.find(query_filter).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page)
            logs = []
            for doc in cursor:
                doc['_id'] = str(doc.get('_id', ''))
                logs.append(doc)

            return {
                'logs': logs,
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': (total + per_page - 1) // per_page if per_page > 0 else 1,
            }
    except Exception:
        pass

    if callable(get_db_session) and AuditLog is not None:
        session = get_db_session()
        try:
            query = session.query(AuditLog)

            if user_email:
                query = query.filter(AuditLog.user_email.ilike(f'%{user_email}%'))
            if user_role:
                query = query.filter(AuditLog.user_role.ilike(user_role))
            if action:
                query = query.filter(AuditLog.action == action)
            if entity_type:
                query = query.filter(AuditLog.entity_type == entity_type)
            if entity_id:
                query = query.filter(AuditLog.entity_id == entity_id)
            if search:
                search_like = f'%{search}%'
                query = query.filter(
                    AuditLog.description.ilike(search_like) |
                    AuditLog.user_email.ilike(search_like) |
                    AuditLog.action.ilike(search_like) |
                    AuditLog.entity_id.ilike(search_like)
                )

            total = query.count()
            logs = query.order_by(AuditLog.created_at.desc()) \
                        .offset((page - 1) * per_page) \
                        .limit(per_page) \
                        .all()

            return {
                'logs': [_log_to_dict(l) for l in logs],
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': (total + per_page - 1) // per_page,
            }
        finally:
            if hasattr(session, 'close'):
                session.close()

    return {
        'logs': [],
        'total': 0,
        'page': page,
        'per_page': per_page,
        'pages': 0,
    }


def _log_to_dict(log: Any) -> dict:
    if log is None:
        return {}
    return {
        'id': getattr(log, 'id', None),
        'user_id': getattr(log, 'user_id', None),
        'user_email': getattr(log, 'user_email', None),
        'user_role': getattr(log, 'user_role', None),
        'action': getattr(log, 'action', None),
        'entity_type': getattr(log, 'entity_type', None),
        'entity_id': getattr(log, 'entity_id', None),
        'description': getattr(log, 'description', None),
        'ip_address': getattr(log, 'ip_address', None),
        'created_at': str(getattr(log, 'created_at', '')),
    }
