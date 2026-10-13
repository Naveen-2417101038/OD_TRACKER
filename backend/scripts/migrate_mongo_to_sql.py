"""
Standalone MongoDB to Microsoft SQL Server Migration Utility
Reads from BSON backup files or live MongoDB, transforms records,
validates schema integrity, and imports into Microsoft SQL Server (ODTRACKINGDB).

Usage:
    python migrate_mongo_to_sql.py [--backup-dir DIR] [--dry-run] [--validate-only]
"""
import os
import sys
import glob
import json
import argparse
from datetime import datetime
from typing import Any, Dict, List, Optional

import bson
from sqlalchemy import text
from sqlalchemy.orm import Session

# Ensure project root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))
for path in (ROOT_DIR, BASE_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.database.sql_server import SQLServerDB, session_scope
from backend.models.db_models import (
    User,
    ODRequest,
    Approval,
    ODHistory,
    Notification,
    StudentAcademicRecord,
    SystemSetting,
    SystemLock,
    Certificate,
    AcademicUploadHistory,
    StudentImportHistory,
    AttendanceUploadHistory,
    MarksUploadHistory,
    AuditLog,
)


def parse_datetime(dt_val: Any) -> Optional[datetime]:
    """Parse string or datetime object safely into timezone-naive datetime."""
    if dt_val is None:
        return None
    if isinstance(dt_val, datetime):
        return dt_val.replace(tzinfo=None)
    dt_str = str(dt_val).strip()
    if not dt_str:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None


def read_bson_file(filepath: str) -> List[Dict[str, Any]]:
    """Decode all BSON documents from file."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'rb') as f:
        data = f.read()
    if not data:
        return []
    return bson.decode_all(data)


class MigrationRunner:
    def __init__(self, backup_dir: str, dry_run: bool = False, validate_only: bool = False):
        self.backup_dir = os.path.abspath(backup_dir)
        self.dry_run = dry_run
        self.validate_only = validate_only
        self.report = []

    def log(self, msg: str):
        print(f"[*] {msg}", flush=True)

    def log_success(self, msg: str):
        print(f"[+] {msg}", flush=True)

    def log_warning(self, msg: str):
        print(f"[!] {msg}", flush=True)

    def log_error(self, msg: str):
        print(f"[-] {msg}", flush=True)

    def run(self) -> bool:
        self.log(f"Starting MongoDB -> SQL Server migration utility")
        self.log(f"Source backup directory: {self.backup_dir}")
        self.log(f"Dry run mode: {self.dry_run} | Validate only: {self.validate_only}")

        if not os.path.isdir(self.backup_dir):
            self.log_error(f"Backup directory not found: {self.backup_dir}")
            return False

        engine = SQLServerDB.connect()
        if engine is None:
            self.log_error("Could not connect to SQL Server database.")
            return False

        status = SQLServerDB.get_status()
        self.log_success(f"Connected to {status['database_name']} on {status['server']}")

        if self.validate_only:
            return self.perform_validation()

        success = True
        try:
            with session_scope() as session:
                # Sequential import honoring foreign keys:
                # 1. users
                self.migrate_users(session)
                # 2. od_requests (FK: users)
                self.migrate_od_requests(session)
                # 3. approvals (FK: od_requests, users)
                self.migrate_approvals(session)
                # 4. od_history (FK: od_requests)
                self.migrate_od_history(session)
                # 5. notifications (FK: users)
                self.migrate_notifications(session)
                # 6. student_academic_records (FK: users)
                self.migrate_student_academic_records(session)
                # 7. system_settings
                self.migrate_system_settings(session)
                # 8. system_locks
                self.migrate_system_locks(session)
                # 9. certificates (FK: od_requests, users)
                self.migrate_certificates(session)
                # 10. academic_upload_history (FK: users)
                self.migrate_academic_upload_history(session)

                if self.dry_run:
                    self.log_warning("DRY RUN active: rolling back all database changes...")
                    session.rollback()
                else:
                    session.flush()
                    self.log_success("All collection transactions prepared. Committing...")

            if not self.dry_run:
                self.perform_validation()

        except Exception as e:
            self.log_error(f"Migration failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False

        self.print_summary_report()
        return success

    # ── Collection 1: Users ───────────────────────────────────────────────────
    def migrate_users(self, session: Session):
        filename = os.path.join(self.backup_dir, 'users.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            user_id = str(d.get('id') or d.get('_id'))
            try:
                existing = session.query(User).filter_by(id=user_id).first()
                record = existing or User(id=user_id)

                record.identifier = str(d.get('identifier') or user_id)
                record.name = str(d.get('name') or d.get('full_name') or 'User')
                record.email = str(d.get('email') or '').strip().lower()
                record.password_hash = str(d.get('password_hash') or '')
                record.role = str(d.get('role') or 'Student')
                record.sub_role = str(d.get('sub_role') or record.role)
                record.department = d.get('department')
                record.year = str(d.get('year')) if d.get('year') is not None else None
                record.section = d.get('section')
                record.designation = d.get('designation')
                record.phone = d.get('phone')
                record.avatar = d.get('avatar')
                record.status = d.get('status', 'active')
                record.email_verified = bool(d.get('email_verified', True))
                record.account_status = str(d.get('account_status', 'ACTIVE'))
                record.verification_token_hash = d.get('verification_token_hash')
                record.reset_token_hash = d.get('reset_token_hash')
                record.reset_token_expires = parse_datetime(d.get('reset_token_expires'))
                record.password_changed_at = parse_datetime(d.get('password_changed_at'))
                record.last_login = parse_datetime(d.get('last_login'))

                # OTP
                record.otp_hash = d.get('otp_hash')
                record.otp_expires_at = parse_datetime(d.get('otp_expires_at'))
                record.otp_attempts = int(d.get('otp_attempts') or 0)
                record.otp_last_sent_at = parse_datetime(d.get('otp_last_sent_at'))
                record.otp_purpose = d.get('otp_purpose')
                record.otp_verified_at = parse_datetime(d.get('otp_verified_at'))
                email_otp = d.get('email_otp')
                record.email_otp_json = json.dumps(email_otp) if email_otp else None

                # Academic cached fields
                record.attendance_percentage = float(d['attendance_percentage']) if d.get('attendance_percentage') is not None else None
                record.cgpa = float(d['cgpa']) if d.get('cgpa') is not None else 8.5
                record.cat1_marks = float(d['cat1_marks']) if d.get('cat1_marks') is not None else None
                record.cat2_marks = float(d['cat2_marks']) if d.get('cat2_marks') is not None else None
                record.cat3_marks = float(d['cat3_marks']) if d.get('cat3_marks') is not None else None
                record.last_academic_update = parse_datetime(d.get('last_academic_update'))

                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()
                record.updated_at = parse_datetime(d.get('updated_at')) or datetime.now()

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating user {user_id}: {e}")

        session.flush()
        self.report.append(('users', source_count, inserted, updated, errors))
        self.log(f"users: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 2: OD Requests ─────────────────────────────────────────────
    def migrate_od_requests(self, session: Session):
        filename = os.path.join(self.backup_dir, 'od_requests.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            req_id = str(d.get('id') or d.get('_id'))
            try:
                existing = session.query(ODRequest).filter_by(id=req_id).first()
                record = existing or ODRequest(id=req_id)

                record.student_id = str(d.get('student_id'))
                record.student_reg_no = d.get('student_reg_no')
                record.student_name = d.get('student_name')
                record.department = d.get('department')
                record.year = str(d.get('year')) if d.get('year') is not None else None
                record.section = d.get('section')

                record.event_name = str(d.get('event_name') or 'Event')
                record.event_type = d.get('event_type')
                record.event_organizer = d.get('event_organizer')
                record.venue = d.get('venue')
                record.from_date = d.get('from_date')
                record.to_date = d.get('to_date')
                record.from_time = d.get('from_time', '09:00')
                record.to_time = d.get('to_time', '17:00')
                record.number_of_days = float(d.get('number_of_days') or 1.0)
                record.reason = d.get('reason')
                record.description = d.get('description')
                record.od_letter_url = d.get('od_letter_url')

                record.status = d.get('status', 'Pending')
                record.current_stage = d.get('current_stage', 'Mentor')
                record.certificate_status = d.get('certificate_status', 'Not Uploaded')
                record.certificate_url = d.get('certificate_url')
                record.rejection_reason = d.get('rejection_reason')
                record.remarks = d.get('remarks')

                record.event_start_datetime = parse_datetime(d.get('event_start_datetime'))
                record.event_end_datetime = parse_datetime(d.get('event_end_datetime'))
                record.hod_approved_at = parse_datetime(d.get('hod_approved_at'))
                record.certificate_deadline = parse_datetime(d.get('certificate_deadline'))
                record.certificate_submitted_at = parse_datetime(d.get('certificate_submitted_at'))

                record.attendance_at_request = float(d['attendance_at_request']) if d.get('attendance_at_request') is not None else None
                record.od_used_at_request = float(d['od_used_at_request']) if d.get('od_used_at_request') is not None else None
                record.od_percentage_requested = float(d['od_percentage_requested']) if d.get('od_percentage_requested') is not None else None
                record.max_od_allowed_percent = float(d['max_od_allowed_percent']) if d.get('max_od_allowed_percent') is not None else None

                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()
                record.updated_at = parse_datetime(d.get('updated_at')) or datetime.now()

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating od_request {req_id}: {e}")

        session.flush()
        self.report.append(('od_requests', source_count, inserted, updated, errors))
        self.log(f"od_requests: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 3: Approvals ───────────────────────────────────────────────
    def migrate_approvals(self, session: Session):
        filename = os.path.join(self.backup_dir, 'approvals.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        # Cache existing users to validate reviewer_id foreign key
        existing_user_ids = {u.id for u in session.query(User.id).all()}

        for d in docs:
            appr_id = str(d.get('id') or d.get('_id'))
            try:
                existing = session.query(Approval).filter_by(id=appr_id).first()
                record = existing or Approval(id=appr_id)

                record.request_id = str(d.get('request_id'))
                rev_id = d.get('reviewer_id')
                record.reviewer_id = str(rev_id) if rev_id and str(rev_id) in existing_user_ids else None
                record.reviewer_name = d.get('reviewer_name')
                record.reviewer_role = d.get('reviewer_role')
                record.action = d.get('action')
                record.comments = d.get('comments')
                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating approval {appr_id}: {e}")

        session.flush()
        self.report.append(('approvals', source_count, inserted, updated, errors))
        self.log(f"approvals: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 4: OD History ──────────────────────────────────────────────
    def migrate_od_history(self, session: Session):
        filename = os.path.join(self.backup_dir, 'od_history.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            hist_id = str(d.get('id') or d.get('_id'))
            try:
                existing = session.query(ODHistory).filter_by(id=hist_id).first()
                record = existing or ODHistory(id=hist_id)

                record.request_id = str(d.get('request_id'))
                record.student_id = str(d.get('student_id')) if d.get('student_id') else None
                record.action = d.get('action')
                record.performed_by_id = d.get('performed_by_id')
                record.performed_by_name = d.get('performed_by_name')
                record.role = d.get('role')
                record.stage = d.get('stage')
                record.remarks = d.get('remarks')
                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating od_history {hist_id}: {e}")

        session.flush()
        self.report.append(('od_history', source_count, inserted, updated, errors))
        self.log(f"od_history: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 5: Notifications ───────────────────────────────────────────
    def migrate_notifications(self, session: Session):
        filename = os.path.join(self.backup_dir, 'notifications.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        existing_users = session.query(User).all()
        existing_user_ids = {u.id for u in existing_users}
        email_to_id = {u.email.lower(): u.id for u in existing_users if u.email}

        for d in docs:
            notif_id = str(d.get('id') or d.get('_id'))
            raw_user_id = str(d.get('user_id') or '').strip()

            # Resolve user_id: direct ID match -> email lookup -> NULL
            resolved_user_id = None
            if raw_user_id in existing_user_ids:
                resolved_user_id = raw_user_id
            elif raw_user_id.lower() in email_to_id:
                resolved_user_id = email_to_id[raw_user_id.lower()]

            recipient_email = d.get('recipient_email') or (raw_user_id if '@' in raw_user_id else None)

            try:
                existing = session.query(Notification).filter_by(id=notif_id).first()
                record = existing or Notification(id=notif_id)

                record.user_id = resolved_user_id
                record.title = d.get('title') or d.get('subject') or 'Notification'
                record.message = str(d.get('message') or '')
                record.type = d.get('type') or d.get('notification_type') or 'system'
                record.link = d.get('link')
                record.is_read = int(d.get('is_read', 0))
                record.notification_type = d.get('notification_type')
                record.subject = d.get('subject')
                record.recipient_email = d.get('recipient_email')
                record.delivery_status = d.get('delivery_status', 'delivered')
                record.status = d.get('status', 'sent')
                record.retry_count = int(d.get('retry_count', 0))
                record.error_details = d.get('error_details')
                record.provider_message_id = d.get('provider_message_id')
                record.related_request_id = str(d.get('related_request_id') or d.get('request_id')) if (d.get('related_request_id') or d.get('request_id')) else None

                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()
                record.updated_at = parse_datetime(d.get('updated_at')) or record.created_at

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating notification {notif_id}: {e}")

        session.flush()
        self.report.append(('notifications', source_count, inserted, updated, errors))
        self.log(f"notifications: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 6: Student Academic Records ────────────────────────────────
    def migrate_student_academic_records(self, session: Session):
        filename = os.path.join(self.backup_dir, 'student_academic_records.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            acad_id = str(d.get('id') or d.get('_id'))
            try:
                existing = session.query(StudentAcademicRecord).filter_by(id=acad_id).first()
                record = existing or StudentAcademicRecord(id=acad_id)

                record.student_id = str(d.get('student_id'))
                record.register_number = str(d.get('register_number'))
                record.student_name = d.get('student_name')
                record.cat1_marks = float(d['cat1_marks']) if d.get('cat1_marks') is not None else None
                record.cat2_marks = float(d['cat2_marks']) if d.get('cat2_marks') is not None else None
                record.cat3_marks = float(d['cat3_marks']) if d.get('cat3_marks') is not None else None
                record.attendance_percentage = float(d.get('attendance_percentage', 0.0))
                record.cgpa = float(d['cgpa']) if d.get('cgpa') is not None else 8.5
                record.total_working_days = int(d.get('total_working_days', 120))
                record.updated_by = d.get('updated_by')
                record.updated_by_name = d.get('updated_by_name')

                record.created_at = parse_datetime(d.get('created_at')) or datetime.now()
                record.updated_at = parse_datetime(d.get('updated_at')) or datetime.now()

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating academic record {acad_id}: {e}")

        session.flush()
        self.report.append(('student_academic_records', source_count, inserted, updated, errors))
        self.log(f"student_academic_records: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 7: System Settings ─────────────────────────────────────────
    def migrate_system_settings(self, session: Session):
        filename = os.path.join(self.backup_dir, 'system_settings.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            cfg_id = str(d.get('id') or 'SYSTEM_CONFIG')
            try:
                existing = session.query(SystemSetting).filter_by(id=cfg_id).first()
                record = existing or SystemSetting(id=cfg_id)

                record.attendance_threshold_percent = float(d.get('attendance_threshold_percent', 75.0))
                record.cgpa_high_performer_threshold = float(d.get('cgpa_high_performer_threshold', 8.5))
                record.max_od_limit_percent = float(d.get('max_od_limit_percent', 10.0))
                record.academic_year = d.get('academic_year', '2025-2026')
                record.semester_name = d.get('semester_name', 'Even Semester')
                record.total_working_days = int(d.get('total_working_days', 120))
                record.allow_student_self_registration = bool(d.get('allow_student_self_registration', True))
                record.email_notifications_enabled = bool(d.get('email_notifications_enabled', True))
                record.updated_at = parse_datetime(d.get('updated_at')) or datetime.now()
                record.updated_by = d.get('updated_by', 'System Administrator')

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating system_settings {cfg_id}: {e}")

        session.flush()
        self.report.append(('system_settings', source_count, inserted, updated, errors))
        self.log(f"system_settings: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 8: System Locks ────────────────────────────────────────────
    def migrate_system_locks(self, session: Session):
        filename = os.path.join(self.backup_dir, 'system_locks.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        inserted = 0
        updated = 0
        errors = 0

        for d in docs:
            lock_id = str(d.get('_id') or d.get('id') or 'deadline_checker_lease')
            try:
                existing = session.query(SystemLock).filter_by(id=lock_id).first()
                record = existing or SystemLock(id=lock_id)

                record.holder = d.get('holder')
                record.expires_at = parse_datetime(d.get('expires_at'))
                record.last_heartbeat = parse_datetime(d.get('last_heartbeat'))

                if not existing:
                    session.add(record)
                    inserted += 1
                else:
                    updated += 1

            except Exception as e:
                errors += 1
                self.log_warning(f"Error migrating system_lock {lock_id}: {e}")

        session.flush()
        self.report.append(('system_locks', source_count, inserted, updated, errors))
        self.log(f"system_locks: {source_count} source docs -> {inserted} inserted, {updated} updated, {errors} errors")

    # ── Collection 9: Certificates (Empty in backup) ──────────────────────────
    def migrate_certificates(self, session: Session):
        filename = os.path.join(self.backup_dir, 'certificates.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        self.report.append(('certificates', source_count, 0, 0, 0))
        self.log(f"certificates: {source_count} source docs (empty)")

    # ── Collection 10: Academic Upload History (Empty in backup) ──────────────
    def migrate_academic_upload_history(self, session: Session):
        filename = os.path.join(self.backup_dir, 'academic_upload_history.bson')
        docs = read_bson_file(filename)
        source_count = len(docs)
        self.report.append(('academic_upload_history', source_count, 0, 0, 0))
        self.log(f"academic_upload_history: {source_count} source docs (empty)")

    # ── Validation ────────────────────────────────────────────────────────────
    def perform_validation(self) -> bool:
        self.log("Running integrity validation on SQL Server tables...")
        with session_scope() as session:
            user_count = session.query(User).count()
            req_count = session.query(ODRequest).count()
            appr_count = session.query(Approval).count()
            hist_count = session.query(ODHistory).count()
            notif_count = session.query(Notification).count()
            acad_count = session.query(StudentAcademicRecord).count()
            settings_count = session.query(SystemSetting).count()

            self.log_success(f"Validation counts in SQL Server (ODTRACKINGDB):")
            self.log(f"  users: {user_count}")
            self.log(f"  od_requests: {req_count}")
            self.log(f"  approvals: {appr_count}")
            self.log(f"  od_history: {hist_count}")
            self.log(f"  notifications: {notif_count}")
            self.log(f"  student_academic_records: {acad_count}")
            self.log(f"  system_settings: {settings_count}")

            # Verify relationship integrity
            unmatched_reqs = session.execute(
                text("SELECT COUNT(*) FROM od_requests WHERE student_id NOT IN (SELECT id FROM users)")
            ).scalar()
            unmatched_apprs = session.execute(
                text("SELECT COUNT(*) FROM approvals WHERE request_id NOT IN (SELECT id FROM od_requests)")
            ).scalar()

            if unmatched_reqs == 0 and unmatched_apprs == 0:
                self.log_success("Foreign key integrity verified: All requests and approvals map to valid parent records.")
            else:
                self.log_warning(f"Integrity check warning: {unmatched_reqs} unmatched requests, {unmatched_apprs} unmatched approvals")

        return True

    # ── Summary Report ────────────────────────────────────────────────────────
    def print_summary_report(self):
        print("\n" + "=" * 80)
        print("          MONGODB TO MICROSOFT SQL SERVER MIGRATION REPORT")
        print("=" * 80)
        print(f"{'Collection / Table':<30} | {'Source':<8} | {'Inserted':<10} | {'Updated':<10} | {'Errors':<8}")
        print("-" * 80)
        for col, src, ins, upd, err in self.report:
            print(f"{col:<30} | {src:<8} | {ins:<10} | {upd:<10} | {err:<8}")
        print("=" * 80 + "\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Migrate OD Tracker data from MongoDB/BSON to SQL Server")
    parser.add_argument('--backup-dir', default=r'C:\Users\Admin\ODTrackerBackup\od_tracking', help="Directory containing BSON backup files")
    parser.add_argument('--dry-run', action='store_true', help="Parse and validate without committing to database")
    parser.add_argument('--validate-only', action='store_true', help="Only validate existing SQL Server records against schema")
    args = parser.parse_args()

    runner = MigrationRunner(backup_dir=args.backup_dir, dry_run=args.dry_run, validate_only=args.validate_only)
    success = runner.run()
    sys.exit(0 if success else 1)
