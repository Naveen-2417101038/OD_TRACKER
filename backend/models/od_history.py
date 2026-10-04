import uuid
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import od_history_collection

class ODHistoryModel:
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
        col = od_history_collection()
        if col is None:
            return None
        
        hist_id = data.get('id') or f"HIST_{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        doc = {
            'id': hist_id,
            'request_id': data.get('request_id'),
            'student_id': data.get('student_id'),
            'action': data.get('action'),
            'performed_by_id': data.get('performed_by_id'),
            'performed_by_name': data.get('performed_by_name'),
            'role': data.get('role'),
            'stage': data.get('stage'),
            'remarks': data.get('remarks'),
            'created_at': data.get('created_at') or now
        }
        col.insert_one(doc)
        return ODHistoryModel._format_doc(doc)

    @staticmethod
    def list_by_request(request_id):
        col = od_history_collection()
        if col is None:
            return []
        rows = col.find({"request_id": str(request_id)}).sort("created_at", 1)
        return [ODHistoryModel._format_doc(r) for r in rows]
