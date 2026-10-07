import os
import sys
from flask import Flask, jsonify, request
from flask_cors import CORS

# Ensure project root and backend directory are present in sys.path
_base_dir = os.path.abspath(os.path.dirname(__file__))
_root_dir = os.path.abspath(os.path.join(_base_dir, '..'))
for _d in [_root_dir, _base_dir]:
    if _d not in sys.path:
        sys.path.insert(0, _d)

try:
    from backend.config import Config
    from backend.database.mongodb import init_db, MongoDB
    from backend.routes.health import health_bp
    from backend.routes.auth import auth_bp
    from backend.routes.od_requests import od_requests_bp
    from backend.routes.mentor import mentor_bp
    from backend.routes.class_incharge import class_incharge_bp
    from backend.routes.hod import hod_bp
    from backend.routes.academic import academic_bp, get_student_academic_detail
except ImportError:
    from config import Config
    from database.mongodb import init_db, MongoDB
    from routes.health import health_bp
    from routes.auth import auth_bp
    from routes.od_requests import od_requests_bp
    from routes.mentor import mentor_bp
    from routes.class_incharge import class_incharge_bp
    from routes.hod import hod_bp
    from routes.academic import academic_bp, get_student_academic_detail

def create_app(config_class=Config):
    """Application factory for OD Tracking System backend."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Disable strict trailing slashes globally
    app.url_map.strict_slashes = False

    # Enable CORS – origins come from Config which reads CORS_ORIGINS env var
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": config_class.CORS_ORIGINS,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
            }
        },
        supports_credentials=True
    )

    # Initialize MongoDB Atlas Connection, Schema & Seed Initial Data
    with app.app_context():
        init_db()

    # Register Route Blueprints
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(od_requests_bp, url_prefix='/api/od-requests')
    app.register_blueprint(mentor_bp, url_prefix='/api/mentor')
    app.register_blueprint(class_incharge_bp, url_prefix='/api/class-incharge')
    app.register_blueprint(hod_bp, url_prefix='/api/hod')
    app.register_blueprint(academic_bp, url_prefix='/api/academic')
    app.register_blueprint(academic_bp, name='class_incharge_academic', url_prefix='/api/class-incharge/academic')

    # Student academic direct route alias: GET /api/students/<student_id>/academic
    @app.route('/api/students/<student_id>/academic', methods=['GET'])
    def student_academic_proxy(student_id):
        return get_student_academic_detail(student_id)

    # Root status endpoint
    @app.route('/')
    def index():
        status = MongoDB.get_status()
        return jsonify({
            "message": "OD Tracking System Backend API is active.",
            "health_check": "/api/health",
            "database": {
                "type": "MongoDB Atlas",
                "connected": status.get("connected", False),
                "state": status.get("connection_state")
            },
            "docs": "REST API for Rajalakshmi Engineering College OD Management System"
        })

    # Global JSON error handlers
    @app.errorhandler(400)
    def handle_bad_request(e=None):
        error_msg = str(getattr(e, 'description', 'Bad Request')) if e else 'Bad Request'
        return jsonify({"success": False, "error": error_msg}), 400

    @app.errorhandler(401)
    def handle_unauthorized(e=None):
        error_msg = str(getattr(e, 'description', 'Authentication required. Please log in.')) if e else 'Authentication required.'
        return jsonify({"success": False, "error": error_msg}), 401

    @app.errorhandler(403)
    def handle_forbidden(e=None):
        error_msg = str(getattr(e, 'description', 'Forbidden: Access denied.')) if e else 'Forbidden: Access denied.'
        return jsonify({"success": False, "error": error_msg}), 403

    @app.errorhandler(404)
    def handle_not_found(e=None):
        return jsonify({
            "success": False,
            "error": "The requested API resource or endpoint was not found."
        }), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e=None):
        return jsonify({
            "success": False,
            "error": f"HTTP method '{request.method}' is not allowed for this endpoint."
        }), 405

    @app.errorhandler(413)
    def handle_payload_too_large(e=None):
        return jsonify({
            "success": False,
            "error": "Uploaded file is too large. Maximum allowed upload size is 16MB."
        }), 413

    @app.errorhandler(500)
    def handle_internal_server_error(e=None):
        return jsonify({
            "success": False,
            "error": "An internal server error occurred while processing the request."
        }), 500

    return app

# Expose application instance for WSGI servers (gunicorn, uvicorn, etc.)
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # debug is controlled by Config.DEBUG which reads FLASK_ENV env var
    debug = app.config.get('DEBUG', False)
    print(f"[*] OD Tracking Backend starting on http://0.0.0.0:{port}")
    print(f"[*] Debug mode: {debug}")
    print(f"[*] CORS enabled for: {Config.CORS_ORIGINS}")
    print(f"[*] Health check: http://0.0.0.0:{port}/api/health")
    app.run(host='0.0.0.0', port=port, debug=debug)
