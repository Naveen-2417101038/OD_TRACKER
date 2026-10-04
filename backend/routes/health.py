from flask import Blueprint, jsonify
from datetime import datetime
from backend.database.mongodb import MongoDB

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify Flask backend and MongoDB Atlas database connection.
    Reports connection state, active collections, and diagnostic information.
    """
    mongo_status = MongoDB.get_status()
    
    return jsonify({
        "status": "healthy" if mongo_status.get("connected") else "degraded",
        "service": "OD Tracking Backend API",
        "version": "1.0.0",
        "database": mongo_status,
        "cors_enabled": True,
        "timestamp": datetime.now().isoformat()
    }), 200
