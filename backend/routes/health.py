from flask import Blueprint, jsonify
from datetime import datetime
from backend.database.sql_server import SQLServerDB

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify Flask backend and Microsoft SQL Server database connection.
    Reports connection state, driver, database name, and diagnostic information.
    """
    sql_status = SQLServerDB.get_status()
    
    return jsonify({
        "status": "healthy" if sql_status.get("connected") else "degraded",
        "service": "OD Tracking Backend API",
        "version": "1.0.0",
        "database": sql_status,
        "cors_enabled": True,
        "timestamp": datetime.now().isoformat()
    }), 200
