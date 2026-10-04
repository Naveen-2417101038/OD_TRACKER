import os
from flask import Blueprint, jsonify, render_template_string, redirect, current_app
from backend.config import Config
from backend.database.postgresql import PostgreSQLDB

dev_bp = Blueprint('dev', __name__)

DEV_PAGE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Development Only — Database Viewer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .card {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 32px;
            max-width: 520px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .badge {
            display: inline-block;
            background-color: #ef4444;
            color: #ffffff;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
        }
        h1 {
            font-size: 1.5rem;
            margin: 0 0 8px 0;
            color: #f8fafc;
        }
        p {
            color: #94a3b8;
            font-size: 0.95rem;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .status-box {
            background-color: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 0.875rem;
        }
        .status-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .status-row:last-child {
            margin-bottom: 0;
        }
        .status-label {
            color: #64748b;
        }
        .status-value {
            color: #38bdf8;
            font-weight: 600;
        }
        .btn {
            display: block;
            width: 100%;
            text-align: center;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff;
            text-decoration: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        .btn:hover {
            background: linear-gradient(135deg, #1d4ed8, #1e40af);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .footer-note {
            font-size: 0.8rem;
            color: #64748b;
            text-align: center;
            margin-top: 16px;
        }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Development Only</span>
        <h1>Development Only — Database Viewer</h1>
        <p>Access the local database viewer interface (e.g. pgAdmin 4) for PostgreSQL table inspection during local development.</p>

        <div class="status-box">
            <div class="status-row">
                <span class="status-label">Database Type:</span>
                <span class="status-value">{{ db_status.type }}</span>
            </div>
            <div class="status-row">
                <span class="status-label">Connection Status:</span>
                <span class="status-value">{{ 'Connected' if db_status.connected else 'Disconnected' }}</span>
            </div>
            <div class="status-row">
                <span class="status-label">Target Viewer URL:</span>
                <span class="status-value">{{ viewer_url }}</span>
            </div>
        </div>

        <a href="{{ viewer_url }}" class="btn" target="_blank" rel="noopener noreferrer">
            Open PostgreSQL Database Viewer ↗
        </a>

        <div class="footer-note">
            This route is disabled automatically when <code>FLASK_ENV=production</code>.
        </div>
    </div>
</body>
</html>
"""

def is_production():
    env = os.environ.get('FLASK_ENV') or os.environ.get('ENV') or getattr(Config, 'FLASK_ENV', 'development')
    return str(env).lower() in ['production', 'prod']

@dev_bp.route('/database', methods=['GET'])
def dev_database_viewer():
    """
    Development-only route that redirects/links to local PostgreSQL DB Viewer (pgAdmin 4).
    Disabled in production.
    """
    if is_production():
        return jsonify({
            'success': False,
            'error': 'Resource not found or disabled in production mode.'
        }), 404

    viewer_url = getattr(Config, 'DATABASE_VIEWER_URL', 'http://127.0.0.1:5050')
    db_status = PostgreSQLDB.get_status()

    # If client requests JSON
    if request_wants_json():
        return jsonify({
            'success': True,
            'environment': 'development',
            'title': 'Development Only — Database Viewer',
            'database_viewer_url': viewer_url,
            'database_status': db_status
        }), 200

    return render_template_string(DEV_PAGE_HTML, viewer_url=viewer_url, db_status=db_status)

def request_wants_json():
    from flask import request
    best = request.accept_mimetypes.best_match(['application/json', 'text/html'])
    return best == 'application/json' and request.accept_mimetypes[best] > request.accept_mimetypes['text/html']
