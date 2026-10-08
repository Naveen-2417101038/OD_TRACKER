"""
MongoDB Atlas Database Connection Package for OD Tracking System.
Exports MongoDB connection client, database getters, collections, and init_db.
"""

from backend.database.mongodb import (
    MongoDB,
    get_db,
    get_mongo_client,
    users_collection,
    od_requests_collection,
    approvals_collection,
    certificates_collection,
    notifications_collection,
    od_history_collection,
    academic_records_collection,
    academic_upload_history_collection,
    student_imports_history_collection,
    attendance_upload_history_collection,
    marks_upload_history_collection,
    init_db
)

__all__ = [
    'MongoDB',
    'get_db',
    'get_mongo_client',
    'users_collection',
    'od_requests_collection',
    'approvals_collection',
    'certificates_collection',
    'notifications_collection',
    'od_history_collection',
    'academic_records_collection',
    'academic_upload_history_collection',
    'student_imports_history_collection',
    'attendance_upload_history_collection',
    'marks_upload_history_collection',
    'init_db'
]
