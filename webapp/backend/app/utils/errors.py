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
