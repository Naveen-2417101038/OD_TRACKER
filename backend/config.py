import os
from dotenv import load_dotenv

# Search and load .env from project root or backend folder
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))

env_path_root = os.path.join(ROOT_DIR, '.env')
env_path_backend = os.path.join(BASE_DIR, '.env')

if os.path.exists(env_path_root):
    load_dotenv(env_path_root, override=True)
elif os.path.exists(env_path_backend):
    load_dotenv(env_path_backend, override=True)
else:
    load_dotenv()

def _csv_to_list(raw: str) -> list:
    """Convert a comma-separated string to a stripped list of values."""
    return [s.strip() for s in raw.split(',') if s.strip()]


class Config:
    BASE_DIR = BASE_DIR
    ROOT_DIR = ROOT_DIR

    # ── Secret Key ────────────────────────────────────────────────────────────
    # NEVER use the fallback in production. Set SECRET_KEY in your environment.
    SECRET_KEY = os.environ.get('SECRET_KEY', 'CHANGE_ME_IN_PRODUCTION_USE_SECRET_KEY_ENV')

    # ── MongoDB Atlas Configuration ───────────────────────────────────────────
    MONGO_URI = os.environ.get('MONGO_URI', '<PASTE_MY_MONGODB_ATLAS_CONNECTION_STRING_HERE>')
    MONGO_DB_NAME = os.environ.get('MONGO_DB_NAME', 'od_tracking')

    # ── SQL / PostgreSQL Database Fallback ────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'od_tracking.db')}")

    # ── Upload Directories ────────────────────────────────────────────────────
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    OD_LETTERS_FOLDER = os.path.join(UPLOAD_FOLDER, 'od_letters')
    CERTIFICATES_FOLDER = os.path.join(UPLOAD_FOLDER, 'certificates')

    # ── Allowed File Extensions ───────────────────────────────────────────────
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload

    # ── CORS Origins ──────────────────────────────────────────────────────────
    # In production, set CORS_ORIGINS env var to a comma-separated list of
    # your deployed frontend URL(s), e.g.:
    #   CORS_ORIGINS=https://od-tracker.vercel.app,https://www.yourdomain.com
    _raw_cors = os.environ.get('CORS_ORIGINS', '')
    if _raw_cors:
        CORS_ORIGINS = _csv_to_list(_raw_cors)
    else:
        # Development fallback origins
        CORS_ORIGINS = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # ── Flask Session ─────────────────────────────────────────────────────────
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV', 'development') == 'production'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # ── Environment ───────────────────────────────────────────────────────────
    ENV = os.environ.get('FLASK_ENV', 'development')
    DEBUG = ENV == 'development'
    TESTING = False

    # ── Email / SMTP Configuration ────────────────────────────────────────────
    SMTP_HOST = os.environ.get('SMTP_HOST', '')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_EMAIL = os.environ.get('SMTP_EMAIL', os.environ.get('SMTP_USERNAME', ''))
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('SMTP_FROM_EMAIL', 'noreply@rajalakshmi.edu.in'))
    SMTP_USE_TLS = os.environ.get('SMTP_USE_TLS', 'true').lower() in ('true', '1', 'yes')
    APP_BASE_URL = os.environ.get('APP_BASE_URL', 'http://localhost:5173')
