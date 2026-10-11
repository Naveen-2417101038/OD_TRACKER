"""
Background service for monitoring OD certificate upload deadlines and auto-expiring overdue requests.
Runs periodically in a daemon thread within the Flask application.
"""
import time
import threading
from datetime import datetime

_deadline_thread = None
_stop_event = threading.Event()

def run_deadline_checker(app, interval_seconds=30):
    """
    Periodic background worker to:
    1. Check HOD-approved requests awaiting certificate upload.
    2. Dispatch approaching deadline reminders (Feature D: Reminder: OD Certificate Submission Due).
    3. Dispatch overdue reminders (Feature D: Overdue: OD Certificate Not Yet Submitted).
    4. Auto-expire requests exceeding the 24-hour certificate deadline.
    Uses persistent idempotency checks in notifications_collection to avoid duplicate emails.
    """
    while not _stop_event.is_set():
        try:
            with app.app_context():
                try:
                    from backend.models.od_request import ODRequestModel
                    from backend.database.mongodb import od_requests_collection, notifications_collection
                    from backend.services.email_service import (
                        get_student_info,
                        send_certificate_due_reminder_email,
                        send_certificate_overdue_email
                    )
                except ImportError:
                    from models.od_request import ODRequestModel
                    from database.mongodb import od_requests_collection, notifications_collection
                    from services.email_service import (
                        get_student_info,
                        send_certificate_due_reminder_email,
                        send_certificate_overdue_email
                    )

                col = od_requests_collection()
                notif_col = notifications_collection()

                if col is not None and notif_col is not None:
                    now = datetime.now()

                    # Query approved requests awaiting certificate upload
                    query = {
                        "status": {"$in": ["HOD Approved - Certificate Pending", "HOD Approved", "Approved"]},
                        "certificate_status": {"$in": ["Not Uploaded", "Pending Upload", None]}
                    }

                    try:
                        docs = list(col.find(query))
                    except Exception:
                        docs = []

                    for doc in docs:
                        if doc.get('certificate_status') in ('Verified', 'Pending Verification'):
                            continue

                        req_id = str(doc.get('id') or doc.get('_id'))
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
                            existing_due = notif_col.find_one({
                                "related_request_id": req_id,
                                "type": "cert_reminder_due"
                            })
                            if not existing_due:
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
                            existing_overdue = notif_col.find_one({
                                "related_request_id": req_id,
                                "type": "cert_reminder_overdue"
                            })
                            if not existing_overdue:
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
            # Prevent background worker from crashing Flask app
            print(f"[-] [Deadline Checker] Error in background worker: {e}")

        # Sleep in small increments to allow responsive shutdown
        for _ in range(max(1, int(interval_seconds))):
            if _stop_event.is_set():
                break
            time.sleep(1)

def init_deadline_checker(app, interval_seconds=30):
    """Start the background daemon thread if not already running."""
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
