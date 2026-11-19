import functools
import logging
import queue
import threading
import time
from contextlib import contextmanager
from typing import Dict, Generator, Optional, Tuple

import pyodbc

from app.config import settings

logger = logging.getLogger("app.database")

_PRE_PING_IDLE_SECONDS = 60.0


@functools.lru_cache(maxsize=1)
def _resolve_driver(configured_driver: str) -> str:
    """Resolve ODBC driver ONCE instead of querying Windows ODBC registry per connection."""
    try:
        installed_drivers = pyodbc.drivers()
    except Exception:
        installed_drivers = []
    driver = configured_driver
    if driver.strip("{}") not in installed_drivers and "SQL Server" in installed_drivers:
        driver = "{SQL Server}"
    return driver


@functools.lru_cache(maxsize=16)
def get_connection_string(db_name: Optional[str] = None) -> str:
    target_db = db_name or settings.DB_VP
    driver = _resolve_driver(settings.DB_DRIVER)
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
        try:
            conn.timeout = int(settings.DB_QUERY_TIMEOUT)
        except Exception:
            pass
        return conn
    except Exception as e:
        logger.error(f"Error connecting to database {db_name or settings.DB_VP}: {e}")
        raise


class _DBConnectionPool:
    """
    Lightweight thread-safe LIFO connection pool keyed by target database.
    Reuses live TCP/TDS sessions, enforces command timeout, and discards stale/broken connections.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pools: Dict[str, "queue.LifoQueue[Tuple[pyodbc.Connection, float]]"] = {}

    def _get_queue(self, db_key: str) -> "queue.LifoQueue[Tuple[pyodbc.Connection, float]]":
        q = self._pools.get(db_key)
        if q is not None:
            return q
        with self._lock:
            q = self._pools.get(db_key)
            if q is None:
                q = queue.LifoQueue(maxsize=max(2, int(settings.DB_POOL_SIZE)))
                self._pools[db_key] = q
            return q

    @staticmethod
    def _close_quietly(conn: Optional[pyodbc.Connection]) -> None:
        if conn is None:
            return
        try:
            conn.close()
        except Exception:
            pass

    @staticmethod
    def _is_alive(conn: pyodbc.Connection) -> bool:
        cur = None
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            return True
        except Exception:
            return False
        finally:
            if cur is not None:
                try:
                    cur.close()
                except Exception:
                    pass

    def acquire(self, db_name: Optional[str], autocommit: bool) -> pyodbc.Connection:
        db_key = (db_name or settings.DB_VP).strip()
        q = self._get_queue(db_key)
        now = time.monotonic()
        idle_ttl = float(settings.DB_POOL_IDLE_TTL)

        while True:
            try:
                conn, last_used = q.get_nowait()
            except queue.Empty:
                break

            age = now - last_used
            if age > idle_ttl:
                self._close_quietly(conn)
                continue

            try:
                if age > _PRE_PING_IDLE_SECONDS and not self._is_alive(conn):
                    self._close_quietly(conn)
                    continue
                if conn.autocommit != autocommit:
                    conn.autocommit = autocommit
                conn.timeout = int(settings.DB_QUERY_TIMEOUT)
                return conn
            except Exception:
                self._close_quietly(conn)
                continue

        return create_connection(db_key, autocommit=autocommit)

    def release(self, db_name: Optional[str], conn: Optional[pyodbc.Connection], broken: bool = False) -> None:
        if conn is None:
            return
        if broken:
            self._close_quietly(conn)
            return

        db_key = (db_name or settings.DB_VP).strip()
        q = self._get_queue(db_key)
        try:
            if not conn.autocommit:
                try:
                    conn.rollback()
                except Exception:
                    self._close_quietly(conn)
                    return
                conn.autocommit = True
            q.put_nowait((conn, time.monotonic()))
        except queue.Full:
            self._close_quietly(conn)
        except Exception:
            self._close_quietly(conn)

    def close_all(self) -> None:
        with self._lock:
            for q in self._pools.values():
                while True:
                    try:
                        conn, _ = q.get_nowait()
                        self._close_quietly(conn)
                    except queue.Empty:
                        break
            self._pools.clear()


_pool = _DBConnectionPool()


def close_all_pools() -> None:
    _pool.close_all()


@contextmanager
def get_db_transaction(db_name: Optional[str] = None) -> Generator[Tuple[pyodbc.Connection, pyodbc.Cursor], None, None]:
    """
    Context manager for ACID transactions with autocommit=False.
    Commits on successful completion, automatically rolls back on any exception.
    """
    conn = None
    cursor = None
    broken = False
    try:
        conn = _pool.acquire(db_name, autocommit=False)
        cursor = conn.cursor()
        yield conn, cursor
        conn.commit()
    except Exception:
        if conn:
            try:
                conn.rollback()
            except Exception:
                broken = True
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                broken = True
        _pool.release(db_name, conn, broken=broken)


@contextmanager
def get_db_cursor(db_name: Optional[str] = None) -> Generator[pyodbc.Cursor, None, None]:
    """
    Context manager yielding a database cursor (read-only autocommit=True) from the pool.
    """
    conn = None
    cursor = None
    broken = False
    try:
        conn = _pool.acquire(db_name, autocommit=True)
        cursor = conn.cursor()
        yield cursor
    except pyodbc.Error:
        broken = True
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                broken = True
        _pool.release(db_name, conn, broken=broken)


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
