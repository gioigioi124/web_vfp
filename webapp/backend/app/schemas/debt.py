from typing import List, Optional
from pydantic import BaseModel

class CustomerDebtSummary(BaseModel):
    ma_dt: str
    ten_dt: Optional[str] = ""
    tk: str = "131"
    du_no: float = 0.0
    du_co: float = 0.0
    du_no_nt: float = 0.0
    du_co_nt: float = 0.0
    du_cuoi: float = 0.0
    gioi_han: float = 0.0
    toi_han: float = 0.0
    is_over_limit: bool = False
    is_near_limit: bool = False
    status_message: str = "Trong hạn mức"

class DebtTransaction(BaseModel):
    ngay_ct: str
    so_ct: str
    dien_giai: Optional[str] = ""
    ps_no: float = 0.0
    ps_co: float = 0.0
    ps_no_nt: float = 0.0
    ps_co_nt: float = 0.0

class DebtDetailResponse(BaseModel):
    ma_dt: str
    ten_dt: Optional[str] = ""
    stt: Optional[str] = ""
    so_ct: Optional[str] = ""
    ngay_ct: Optional[str] = ""
    tong_no: float = 0.0
    da_thanh_toan: float = 0.0
    con_lai: float = 0.0
    transactions: List[DebtTransaction] = []
