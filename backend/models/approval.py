import uuid
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import approvals_collection

class ApprovalModel:
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
        col = approvals_collection()
        if col is None:
            return None
        
        appr_id = data.get('id') or f"APPR_{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        doc = {
            'id': appr_id,
            'request_id': data.get('request_id'),
            'reviewer_id': data.get('reviewer_id'),
            'reviewer_name': data.get('reviewer_name'),
            'reviewer_role': data.get('reviewer_role'),
            'action': data.get('action'),
            'comments': data.get('comments'),
            'created_at': data.get('created_at') or now
        }
        col.insert_one(doc)
        return ApprovalModel._format_doc(doc)

    @staticmethod
    def list_by_request(request_id):
        col = approvals_collection()
        if col is None:
            return []
        
        cursor = col.find({"request_id": str(request_id)}).sort("created_at", 1)
        return [ApprovalModel._format_doc(r) for r in cursor]
