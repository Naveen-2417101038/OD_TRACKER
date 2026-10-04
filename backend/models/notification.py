import uuid
from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import notifications_collection

class NotificationModel:
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
        col = notifications_collection()
        if col is None:
            return None
        
        notif_id = data.get('id') or f"NOTIF_{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        doc = {
            'id': notif_id,
            'user_id': data.get('user_id'),
            'title': data.get('title'),
            'message': data.get('message'),
            'type': data.get('type', 'system'),
            'link': data.get('link'),
            'is_read': 0,
            'created_at': now
        }
        col.insert_one(doc)
        return NotificationModel._format_doc(doc)

    @staticmethod
    def list_by_user(user_id):
        col = notifications_collection()
        if col is None:
            return []
        rows = col.find({"user_id": str(user_id)}).sort("created_at", -1)
        return [NotificationModel._format_doc(r) for r in rows]

    @staticmethod
    def mark_as_read(notif_id):
        col = notifications_collection()
        if col is None:
            return False
        col.update_one({"id": str(notif_id)}, {"$set": {"is_read": 1}})
        return True
