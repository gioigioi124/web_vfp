from typing import Any, List, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel

class ErrorDetail(BaseModel):
    field: Optional[str] = None
    issue: str

class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[List[ErrorDetail]] = None

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    meta: Optional[Any] = None
    error: Optional[ErrorResponse] = None

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "BAD_REQUEST",
        message: str = "Yêu cầu không hợp lệ",
        details: Optional[List[ErrorDetail]] = None
    ):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "details": [d.model_dump() for d in details] if details else None}
        )


_SQL_CONN_STATE_PREFIXES = ("08", "HYT", "IM0", "28000")
_SQL_CONN_KEYWORDS = (
    "could not open a connection",
    "login timeout",
    "server does not exist",
    "communication link failure",
    "tcp provider",
    "named pipes provider",
    "driver not found",
    "odbc driver",
    "can't open lib",
    "data source name not found",
    "connection refused",
    "timed out",
    "network-related",
    "unable to connect",
)


def is_sql_connection_error(exc: BaseException) -> bool:
    """Return True when exc looks like an ODBC/SQL Server connectivity or auth failure."""
    try:
        import pyodbc
        if isinstance(exc, (pyodbc.OperationalError, pyodbc.InterfaceError)):
            return True
    except Exception:
        pass

    msg = str(exc or "").lower()
    if any(kw in msg for kw in _SQL_CONN_KEYWORDS):
        return True
    args = getattr(exc, "args", ()) or ()
    if args and isinstance(args[0], str):
        state = args[0].strip().upper()
        if any(state.startswith(p) for p in _SQL_CONN_STATE_PREFIXES):
            return True
    return False


class SqlUnavailableError(AppException):
    def __init__(
        self,
        message: str = (
            "Không thể kết nối đến SQL Server (VP_2014 / VTSYS). "
            "Vui lòng kiểm tra kết nối mạng nội bộ hoặc dịch vụ SQL Server."
        ),
    ):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SQL_UNAVAILABLE",
            message=message,
        )

