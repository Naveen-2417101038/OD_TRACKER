"""
Safe Azure SQL Database & Microsoft SQL Server Connectivity Verification Script.
Safely verifies database connectivity, driver version, authentication method,
and table availability WITHOUT exposing passwords or connection strings.
Usage:
    python backend/scripts/verify_azure_sql.py
"""
import os
import sys

# Ensure repository root is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sqlalchemy import text
from backend.database.sql_server import (
    SQLServerDB,
    is_production_environment,
    mask_credentials,
    get_preferred_odbc_driver
)


def verify_connection():
    print("=" * 70)
    print("  OD TRACKING SYSTEM - DATABASE CONNECTIVITY VERIFICATION")
    print("=" * 70)

    is_prod = is_production_environment()
    env_name = "Production (Azure App Service / Deployed)" if is_prod else "Local Development"
    print(f"[*] Environment Detected : {env_name}")

    server = (
        os.environ.get("AZURE_SQL_SERVER")
        or os.environ.get("SQL_SERVER")
        or "Not Configured"
    )
    database = (
        os.environ.get("AZURE_SQL_DATABASE")
        or os.environ.get("SQL_DATABASE")
        or "ODTRACKINGDB"
    )
    driver = os.environ.get("SQL_DRIVER") or get_preferred_odbc_driver()

    print(f"[*] Configured Server    : {server}")
    print(f"[*] Configured Database  : {database}")
    print(f"[*] ODBC Driver          : {driver}")

    # Determine auth mode
    auth_type = (os.environ.get("AZURE_SQL_AUTH_TYPE") or os.environ.get("SQL_AUTH_TYPE", "")).lower()
    has_user = bool(os.environ.get("AZURE_SQL_USER") or os.environ.get("SQL_USER"))
    has_pass = bool(os.environ.get("AZURE_SQL_PASSWORD") or os.environ.get("SQL_PASSWORD"))

    if ".database.windows.net" in server.lower() or is_prod:
        if auth_type in ("msi", "managed_identity") or not has_user:
            auth_display = "Azure Managed Identity (ActiveDirectoryMsi - Passwordless)"
        else:
            auth_display = "Azure SQL Authentication (Username / Password)"
    else:
        trusted = os.environ.get("SQL_TRUSTED_CONNECTION", "").lower()
        if trusted in ("1", "true", "yes") or not has_user:
            auth_display = "Windows Integrated Authentication (Trusted_Connection)"
        else:
            auth_display = "SQL Server Authentication (Username / Password)"

    print(f"[*] Authentication Mode  : {auth_display}")
    print("-" * 70)
    print("[*] Initiating connection test...")

    try:
        engine = SQLServerDB.connect()
        if engine is None:
            status = SQLServerDB.get_status()
            print("[-] Connection failed!")
            print(f"[-] Error: {status.get('error')}")
            return False

        with engine.connect() as conn:
            # Execute verification queries
            ver_result = conn.execute(
                text("SELECT @@VERSION AS ver, DB_NAME() AS current_db, SYSTEM_USER AS auth_user")
            ).fetchone()

            current_db = ver_result.current_db
            current_user = ver_result.auth_user
            version_str = ver_result.ver.split('\n')[0] if ver_result.ver else "Unknown"

            print(f"[+] Connection SUCCESSFUL!")
            print(f"[+] Connected Database   : {current_db}")
            print(f"[+] Authenticated User   : {current_user}")
            print(f"[+] Engine Version       : {version_str}")

            # Verify schema tables presence (read-only)
            tables_query = text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            """)
            tables = [r[0] for r in conn.execute(tables_query).fetchall()]
            print(f"[+] Tables Found ({len(tables)})  : {', '.join(tables[:8])}{' ...' if len(tables) > 8 else ''}")

            # Verify core table
            if 'users' in [t.lower() for t in tables]:
                count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
                print(f"[+] Users Table Records  : {count} accounts found")

        print("=" * 70)
        print("[+] VERIFICATION PASSED: Database is healthy, responsive, and ready.")
        print("=" * 70)
        return True

    except Exception as e:
        safe_err = mask_credentials(str(e))
        print("[-] Connection FAILED!")
        print(f"[-] Error: {safe_err}")
        print("=" * 70)
        return False


if __name__ == '__main__':
    success = verify_connection()
    sys.exit(0 if success else 1)
