import uuid
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import (
    academic_records_collection,
    academic_upload_history_collection,
    users_collection
)
from backend.models.user import UserModel

class AcademicRecordModel:
    @staticmethod
    def _format_doc(doc):
        if not doc:
            return None
        formatted = dict(doc)
        if '_id' in formatted:
            formatted['_id'] = str(formatted['_id'])
        return formatted

    @staticmethod
    def get_by_student_id(student_id):
        """Retrieve academic record for a specific student ID."""
        col = academic_records_collection()
        if col is None:
            return None
        doc = col.find_one({"$or": [{"student_id": str(student_id)}, {"id": str(student_id)}]})
        return AcademicRecordModel._format_doc(doc)

    @staticmethod
    def get_by_register_number(register_no):
        """Retrieve academic record by register number (case-insensitive)."""
        col = academic_records_collection()
        if col is None or not register_no:
            return None
        clean_reg = register_no.strip()
        doc = col.find_one({"register_number": {"$regex": f"^{clean_reg}$", "$options": "i"}})
        return AcademicRecordModel._format_doc(doc)

    @staticmethod
    def list_all():
        """List all academic records sorted by register number."""
        col = academic_records_collection()
        if col is None:
            return []
        cursor = col.find({}).sort("register_number", 1)
        return [AcademicRecordModel._format_doc(d) for d in cursor]

    @staticmethod
    def upsert_academic_record(student_id, register_number, student_name, cat1, cat2, cat3, attendance, updated_by_id, updated_by_name, cgpa=None):
        """
        Create or update a student's academic record.
        Also syncs attendance, CAT marks, and CGPA directly into the student's User document.
        """
        acad_col = academic_records_collection()
        users_col = users_collection()
        if acad_col is None:
            raise RuntimeError("Database connection not established.")

        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Clean marks & attendance numbers
        c1 = float(cat1) if cat1 is not None and str(cat1).strip() != '' else None
        c2 = float(cat2) if cat2 is not None and str(cat2).strip() != '' else None
        c3 = float(cat3) if cat3 is not None and str(cat3).strip() != '' else None
        att = float(attendance) if attendance is not None else 0.0
        clean_cgpa = float(cgpa) if cgpa is not None and str(cgpa).strip() != '' else None

        existing = acad_col.find_one({"$or": [{"student_id": student_id}, {"register_number": register_number}]})
        doc_id = existing['id'] if existing else f"ACAD_{student_id}"

        update_payload = {
            'id': doc_id,
            'student_id': student_id,
            'register_number': register_number,
            'student_name': student_name,
            'cat1_marks': c1,
            'cat2_marks': c2,
            'cat3_marks': c3,
            'attendance_percentage': att,
            'total_working_days': 120,
            'updated_by': updated_by_id,
            'updated_by_name': updated_by_name,
            'updated_at': now_str
        }
        if clean_cgpa is not None:
            update_payload['cgpa'] = clean_cgpa

        if not existing:
            update_payload['created_at'] = now_str
            acad_col.insert_one(update_payload)
        else:
            acad_col.update_one({"_id": existing['_id']}, {"$set": update_payload})

        # Synchronize attendance and marks into the student user document
        if users_col is not None:
            user_sync = {
                "attendance_percentage": att,
                "cat1_marks": c1,
                "cat2_marks": c2,
                "cat3_marks": c3,
                "last_academic_update": now_str,
                "updated_at": now_str
            }
            if clean_cgpa is not None:
                user_sync["cgpa"] = clean_cgpa
            users_col.update_one(
                {"$or": [{"id": student_id}, {"identifier": register_number}]},
                {"$set": user_sync}
            )

        return AcademicRecordModel.get_by_student_id(student_id)

    @staticmethod
    def batch_update_records(validated_rows, updated_by_id, updated_by_name):
        """
        Transaction-safe batch update of multiple student academic records.
        If any record update fails, records are rolled back or aborted.
        """
        acad_col = academic_records_collection()
        users_col = users_collection()
        if acad_col is None:
            raise RuntimeError("Database connection not established.")

        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        updated_records = []

        # Save previous states for rollback safety
        rollback_log = []

        try:
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

                # Preserve old state
                old_acad = acad_col.find_one({"student_id": student_id})
                old_user = users_col.find_one({"id": student_id}) if users_col is not None else None
                rollback_log.append((student_id, old_acad, old_user))

                # Perform update
                c1 = float(cat1) if cat1 is not None and str(cat1).strip() != '' else None
                c2 = float(cat2) if cat2 is not None and str(cat2).strip() != '' else None
                c3 = float(cat3) if cat3 is not None and str(cat3).strip() != '' else None
                att_val = float(att) if att is not None else 0.0

                existing = acad_col.find_one({"$or": [{"student_id": student_id}, {"register_number": reg_no}]})
                doc_id = existing['id'] if existing else f"ACAD_{student_id}"

                doc = {
                    'id': doc_id,
                    'student_id': student_id,
                    'register_number': reg_no,
                    'student_name': student_name,
                    'cat1_marks': c1,
                    'cat2_marks': c2,
                    'cat3_marks': c3,
                    'attendance_percentage': att_val,
                    'total_working_days': 120,
                    'updated_by': updated_by_id,
                    'updated_by_name': updated_by_name,
                    'updated_at': now_str
                }

                if not existing:
                    doc['created_at'] = now_str
                    acad_col.insert_one(doc)
                else:
                    acad_col.update_one({"_id": existing['_id']}, {"$set": doc})

                # Sync user document
                if users_col is not None:
                    users_col.update_one(
                        {"$or": [{"id": student_id}, {"identifier": reg_no}]},
                        {"$set": {
                            "attendance_percentage": att_val,
                            "cat1_marks": c1,
                            "cat2_marks": c2,
                            "cat3_marks": c3,
                            "last_academic_update": now_str,
                            "updated_at": now_str
                        }}
                    )

                updated_records.append(doc)

            return updated_records, None

        except Exception as e:
            # Perform rollback to previous states
            for st_id, prev_acad, prev_user in rollback_log:
                try:
                    if prev_acad:
                        acad_col.replace_one({"student_id": st_id}, prev_acad, upsert=True)
                    else:
                        acad_col.delete_one({"student_id": st_id})

                    if prev_user and users_col is not None:
                        users_col.replace_one({"id": st_id}, prev_user, upsert=True)
                except Exception:
                    pass
            return None, f"Batch database transaction failed: {str(e)}"


class AcademicUploadHistoryModel:
    @staticmethod
    def _format_doc(doc):
        if not doc:
            return None
        formatted = dict(doc)
        if '_id' in formatted:
            formatted['_id'] = str(formatted['_id'])
        formatted['unmatched_students'] = formatted.get('unmatched_count', 0)
        formatted['invalid_rows'] = formatted.get('invalid_count', 0)
        return formatted

    @staticmethod
    def create(data):
        """Insert a new upload history audit record."""
        col = academic_upload_history_collection()
        if col is None:
            return None

        history_id = data.get('id') or f"UPL_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6].upper()}"
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        doc = {
            'id': history_id,
            'upload_date': data.get('upload_date') or now_str,
            'uploaded_by_id': data.get('uploaded_by_id'),
            'uploaded_by_name': data.get('uploaded_by_name'),
            'file_name': data.get('file_name'),
            'total_rows': int(data.get('total_rows', 0)),
            'successful_updates': int(data.get('successful_updates', 0)),
            'unmatched_count': int(data.get('unmatched_count', 0)),
            'invalid_count': int(data.get('invalid_count', 0)),
            'status': data.get('status', 'Completed'),
            'details': data.get('details', []),
            'created_at': now_str
        }

        col.insert_one(doc)
        return AcademicUploadHistoryModel._format_doc(doc)

    @staticmethod
    def list_all(limit=50):
        """List upload history ordered by creation date descending."""
        col = academic_upload_history_collection()
        if col is None:
            return []
        cursor = col.find({}).sort("created_at", -1).limit(limit)
        return [AcademicUploadHistoryModel._format_doc(d) for d in cursor]

    @staticmethod
    def get_by_id(history_id):
        """Retrieve upload history log by ID."""
        col = academic_upload_history_collection()
        if col is None or not history_id:
            return None
        doc = col.find_one({"id": str(history_id)})
        return AcademicUploadHistoryModel._format_doc(doc)
