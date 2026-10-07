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
    """Periodic worker loop to check and auto-expire OD requests that exceeded the 24-hour certificate deadline."""
    while not _stop_event.is_set():
        try:
            with app.app_context():
                try:
                    from backend.models.od_request import ODRequestModel
                except ImportError:
                    from models.od_request import ODRequestModel

                expired_count = ODRequestModel.check_and_expire_deadlines()
                if expired_count > 0:
                    print(f"[*] [Deadline Checker] Automatically rejected {expired_count} OD request(s) due to certificate deadline expiry at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.")
        except Exception as e:
            # Prevent background worker from crashing Flask
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
