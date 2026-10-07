"""
Centralized Audit Logging Service.

Every important system action is recorded in the audit_logs table.
NEVER log: passwords, password hashes, tokens, secret keys.
"""
from datetime import datetime, timezone
from flask import request as flask_request

try:
    from backend.database.postgresql import get_db_session
    from backend.models.db_models import AuditLog
except ImportError:
    from database.postgresql import get_db_session
    from models.db_models import AuditLog


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

    session = get_db_session()
    try:
        # Auto-detect IP if not provided
        if ip_address is None:
            try:
                ip_address = flask_request.remote_addr
            except RuntimeError:
                ip_address = 'system'

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
        session.rollback()
        print(f"[!] Audit log write failed: {e}")
    finally:
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
        if date_from:
            try:
                df = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(AuditLog.created_at >= df)
            except ValueError:
                pass
        if date_to:
            try:
                dt = datetime.strptime(date_to, '%Y-%m-%d')
                query = query.filter(AuditLog.created_at <= dt)
            except ValueError:
                pass
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
        session.close()


def _log_to_dict(log: AuditLog) -> dict:
    return {
        'id': log.id,
        'user_id': log.user_id,
        'user_email': log.user_email,
        'user_role': log.user_role,
        'action': log.action,
        'entity_type': log.entity_type,
        'entity_id': log.entity_id,
        'description': log.description,
        'ip_address': log.ip_address,
        'created_at': log.created_at.isoformat() if log.created_at is not None else None,
    }
