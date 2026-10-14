"""
Background service for monitoring OD certificate upload deadlines and auto-expiring overdue requests.
Runs periodically in a daemon thread within the Flask application.
Powered by Microsoft SQL Server.
"""
import os
import uuid
import time
import threading
from datetime import datetime, timedelta

from sqlalchemy import or_
from backend.database.sql_server import session_scope
from backend.models.db_models import ODRequest, Notification, SystemLock
from backend.models.od_request import ODRequestModel
from backend.services.email_service import (
    get_student_info,
    send_certificate_due_reminder_email,
    send_certificate_overdue_email
)

_deadline_thread = None
_stop_event = threading.Event()

def run_deadline_checker(app, interval_seconds=30):
    """
    Periodic background worker to:
    1. Check HOD-approved requests awaiting certificate upload.
    2. Dispatch approaching deadline reminders.
    3. Dispatch overdue reminders.
    4. Auto-expire requests exceeding the 24-hour certificate deadline.
    Uses distributed SQL Server system_locks lease to prevent multiple workers from duplicating checks or emails.
    """
    worker_id = f"worker_{os.getpid()}_{uuid.uuid4().hex[:8]}"

    while not _stop_event.is_set():
        try:
            with app.app_context():
                # Acquire / renew distributed lease in SQL Server
                lease_acquired = True
                try:
                    with session_scope() as session:
                        lock = session.query(SystemLock).filter_by(id="deadline_checker_lease").first()
                        now_dt = datetime.now()
                        expiry_time = now_dt + timedelta(seconds=max(45, int(interval_seconds) * 2))

                        if not lock:
                            lock = SystemLock(
                                id="deadline_checker_lease",
                                holder=worker_id,
                                expires_at=expiry_time,
                                last_heartbeat=now_dt
                            )
                            session.add(lock)
                        elif lock.expires_at is None or lock.expires_at < now_dt or lock.holder == worker_id:
                            lock.holder = worker_id
                            lock.expires_at = expiry_time
                            lock.last_heartbeat = now_dt
                        else:
                            lease_acquired = False
                except Exception as lock_err:
                    pass

                if not lease_acquired:
                    for _ in range(max(1, int(interval_seconds))):
                        if _stop_event.is_set():
                            break
                        time.sleep(1)
                    continue

                # Query approved requests awaiting certificate upload
                docs = []
                now = datetime.now()
                try:
                    with session_scope() as session:
                        req_query = session.query(ODRequest).filter(
                            or_(
                                ODRequest.status.in_(["HOD Approved - Certificate Pending", "HOD Approved"]),
                                ODRequest.current_stage == "Certificate Pending"
                            ),
                            or_(
                                ODRequest.certificate_status.in_(["Not Uploaded", "Pending Upload", "Deadline Expired", ""]),
                                ODRequest.certificate_status.is_(None)
                            ),
                            or_(
                                ODRequest.certificate_url.is_(None),
                                ODRequest.certificate_url == ''
                            ),
                            ODRequest.certificate_submitted_at.is_(None)
                        )
                        for r in req_query.all():
                            docs.append(r.to_dict())
                except Exception:
                    docs = []

                for doc in docs:
                    if doc.get('certificate_status') in ('Verified', 'Pending Verification'):
                        continue

                    req_id = str(doc.get('id') or '')
                    end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(doc)
                    if not deadline_dt:
                        continue

                    s_email, s_name = get_student_info(doc)
                    if not s_email:
                        continue

                    event_name = doc.get('event_name') or doc.get('eventName') or 'Event'
                    dates = f"{doc.get('from_date', '')} to {doc.get('to_date', '')}".strip() or 'N/A'
                    deadline_str = deadline_dt.strftime('%Y-%m-%d %H:%M:%S')

                    # 1. Approaching Reminder Check (Within 6 hours of deadline or after event end)
                    time_left_seconds = (deadline_dt - now).total_seconds()
                    if 0 < time_left_seconds <= 6 * 3600:
                        has_reminder = False
                        try:
                            with session_scope() as session:
                                existing = session.query(Notification).filter_by(
                                    related_request_id=req_id,
                                    type="cert_reminder_due"
                                ).first()
                                if existing:
                                    has_reminder = True
                        except Exception:
                            pass

                        if not has_reminder:
                            send_certificate_due_reminder_email(
                                to_email=s_email,
                                student_name=s_name,
                                event_name=event_name,
                                dates=dates,
                                request_id=req_id,
                                deadline_str=deadline_str,
                                user_id=doc.get('student_id')
                            )

                    # 2. Overdue Reminder Check (Deadline passed but not yet processed for expiration)
                    elif time_left_seconds <= 0:
                        has_overdue = False
                        try:
                            with session_scope() as session:
                                existing = session.query(Notification).filter_by(
                                    related_request_id=req_id,
                                    type="cert_reminder_overdue"
                                ).first()
                                if existing:
                                    has_overdue = True
                        except Exception:
                            pass

                        if not has_overdue:
                            send_certificate_overdue_email(
                                to_email=s_email,
                                student_name=s_name,
                                event_name=event_name,
                                dates=dates,
                                request_id=req_id,
                                deadline_str=deadline_str,
                                user_id=doc.get('student_id')
                            )

                # Auto-expire overdue requests
                expired_count = ODRequestModel.check_and_expire_deadlines()
                if expired_count > 0:
                    print(f"[*] [Deadline Checker] Automatically rejected {expired_count} OD request(s) due to certificate deadline expiry at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.")

        except Exception as e:
            print(f"[-] [Deadline Checker] Error in background worker: {e}")

        for _ in range(max(1, int(interval_seconds))):
            if _stop_event.is_set():
                break
            time.sleep(1)

def init_deadline_checker(app, interval_seconds=30):
    """Start the background daemon thread if not already running."""
    if os.environ.get('ENABLE_DEADLINE_CHECKER', 'true').lower() in ('false', '0', 'no'):
        print("[!] [Deadline Checker] Background monitor disabled via ENABLE_DEADLINE_CHECKER=false.")
        return None

    global _deadline_thread
    if _deadline_thread is not None and _deadline_thread.is_alive():
        return _deadline_thread

    _stop_event.clear()
    _deadline_thread = threading.Thread(
        target=run_deadline_checker,
        args=(app, interval_seconds),
        daemon=True,
        name="ODCertificateDeadlineChecker"
    )
    _deadline_thread.start()
    print(f"[+] [Deadline Checker] Background 24-hour certificate deadline monitor started (Interval: {interval_seconds}s).")
    return _deadline_thread

def stop_deadline_checker():
    """Signal background thread to stop gracefully."""
    _stop_event.set()
