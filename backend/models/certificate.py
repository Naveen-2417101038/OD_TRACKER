import uuid
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import certificates_collection

class CertificateModel:
    @staticmethod
    def _format_doc(doc):
        if not doc:
            return None
        formatted = dict(doc)
        if '_id' in formatted:
            formatted['_id'] = str(formatted['_id'])
        return formatted

    @staticmethod
    def create(data):
        col = certificates_collection()
        if col is None:
            return None
        
        cert_id = data.get('id') or f"CERT_{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        doc = {
            'id': cert_id,
            'request_id': data.get('request_id'),
            'student_id': data.get('student_id'),
            'student_reg_no': data.get('student_reg_no'),
            'event_name': data.get('event_name'),
            'certificate_file_url': data.get('certificate_file_url'),
            'upload_date': data.get('upload_date') or now,
            'status': data.get('status', 'Pending Verification'),
            'verified_by_id': data.get('verified_by_id'),
            'verified_by_name': data.get('verified_by_name'),
            'verified_at': data.get('verified_at'),
            'remarks': data.get('remarks'),
            'created_at': now
        }
        col.insert_one(doc)
        return CertificateModel._format_doc(doc)

    @staticmethod
    def update_verification(request_id, status, verified_by_id, verified_by_name, remarks=''):
        col = certificates_collection()
        if col is None:
            return None
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        col.update_many(
            {"request_id": str(request_id)},
            {"$set": {
                "status": status,
                "verified_by_id": verified_by_id,
                "verified_by_name": verified_by_name,
                "verified_at": now,
                "remarks": remarks
            }}
        )
        return CertificateModel.get_by_request_id(request_id)

    @staticmethod
    def get_by_request_id(request_id):
        col = certificates_collection()
        if col is None:
            return None
        cert = col.find_one({"request_id": str(request_id)})
        return CertificateModel._format_doc(cert)

    @staticmethod
    def list_all():
        col = certificates_collection()
        if col is None:
            return []
        rows = col.find().sort("created_at", -1)
        return [CertificateModel._format_doc(r) for r in rows]
