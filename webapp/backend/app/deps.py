from typing import Generator, Optional
from fastapi import Header
from app.database import get_db_cursor
from app.config import settings

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Simple authentication dependency for Phase 1.
    Returns default authenticated operator context.
    """
    return {
        "username": "KTCN3",
        "full_name": "Kế toán bán hàng",
        "ma_dvcs": "01",
        "role": "accountant"
    }
