"""
SQL Server Database Connection Package for OD Tracking System.
Exports SQL Server engine, session_scope, and database status diagnostics.
"""

try:
    from backend.database.sql_server import (
        SQLServerDB,
        session_scope,
        init_db,
        get_db_session,
        engine,
        SessionLocal
    )
except ModuleNotFoundError:
    from database.sql_server import (
        SQLServerDB,
        session_scope,
        init_db,
        get_db_session,
        engine,
        SessionLocal
    )


__all__ = [
    'SQLServerDB',
    'session_scope',
    'init_db',
    'get_db_session',
    'engine',
    'SessionLocal'
]
