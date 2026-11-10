import logging
import pyodbc
from contextlib import contextmanager
from typing import Generator, Optional, Tuple
from app.config import settings

logger = logging.getLogger("app.database")

def get_connection_string(db_name: Optional[str] = None) -> str:
    target_db = db_name or settings.DB_VP
    # Detect available driver
    installed_drivers = pyodbc.drivers()
    driver = settings.DB_DRIVER
    if driver.strip("{}") not in installed_drivers and "SQL Server" in installed_drivers:
        driver = "{SQL Server}"

    return (
        f"DRIVER={driver};"
        f"SERVER={settings.DB_SERVER};"
        f"DATABASE={target_db};"
        f"UID={settings.DB_USER};"
        f"PWD={settings.DB_PASS};"
        f"Connection Timeout=5;"
    )

def create_connection(db_name: Optional[str] = None, autocommit: bool = True) -> pyodbc.Connection:
    conn_str = get_connection_string(db_name)
    try:
        conn = pyodbc.connect(conn_str, autocommit=autocommit)
        return conn
    except Exception as e:
        logger.error(f"Error connecting to database {db_name or settings.DB_VP}: {e}")
        raise

@contextmanager
def get_db_transaction(db_name: Optional[str] = None) -> Generator[Tuple[pyodbc.Connection, pyodbc.Cursor], None, None]:
    """
    Context manager for ACID transactions with autocommit=False.
    Commits on successful completion, automatically rolls back on any exception.
    """
    conn = None
    cursor = None
    try:
        conn = create_connection(db_name, autocommit=False)
        cursor = conn.cursor()
        yield conn, cursor
        conn.commit()
    except Exception:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@contextmanager
def get_db_cursor(db_name: Optional[str] = None) -> Generator[pyodbc.Cursor, None, None]:
    """
    Context manager yielding a database cursor (read-only autocommit=True).
    """
    conn = None
    cursor = None
    try:
        conn = create_connection(db_name, autocommit=True)
        cursor = conn.cursor()

        yield cursor
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

def test_db_connection(db_name: Optional[str] = None) -> dict:
    target_db = db_name or settings.DB_VP
    try:
        with get_db_cursor(target_db) as cur:
            cur.execute("SELECT 1 AS alive")
            row = cur.fetchone()
            if row and row[0] == 1:
                return {"database": target_db, "status": "connected", "server": settings.DB_SERVER}
        return {"database": target_db, "status": "no_response", "server": settings.DB_SERVER}
    except Exception as exc:
        return {"database": target_db, "status": "error", "error": str(exc), "server": settings.DB_SERVER}
