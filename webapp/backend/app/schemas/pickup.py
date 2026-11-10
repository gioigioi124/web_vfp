from typing import List, Optional
from pydantic import BaseModel

class PickupItemSchema(BaseModel):
    stt0: str
    stt: Optional[str] = ""
    ma_vt: str
    ten_vt: Optional[str] = ""
    dvt: Optional[str] = ""
    dvt_ban: Optional[str] = ""
    ma_kho: Optional[str] = ""
    so_tam: Optional[float] = 0.0
    he_so8: Optional[float] = 1.0
    so_luong8: Optional[float] = 0.0
    so_luong9: Optional[float] = 0.0
    loai_vt: Optional[str] = "1"
    # Tài khoản hạch toán kế thừa từ DmVt (Tk_Gv/Tk_Vt/Tk_Dt/Tk_Ck)
    tk_gv: Optional[str] = "632"
    tk_vt: Optional[str] = "1561"
    tk_dt: Optional[str] = "5111"
    tk_ck: Optional[str] = "521"

class PickupSlipSchema(BaseModel):
    stt: str
    so_ct: Optional[str] = ""
    ngay_ct: str
    ma_dt: str
    ten_dt: Optional[str] = ""
    dia_chi: Optional[str] = ""
    ma_xe: Optional[str] = ""
    total_items: int = 0
    total_so_tam: float = 0.0
    total_so_luong9: float = 0.0

class PickupDetailResponse(BaseModel):
    stt: str
    items: List[PickupItemSchema]

class PickupAcceptRequest(BaseModel):
    """Danh sách Stt phiếu xuất kho người dùng đã chọn (nút Chấp nhận - ctbhch)."""
    stts: List[str]
    ma_dt: Optional[str] = None
    ngay_ct: Optional[str] = None
    ty_gia: Optional[float] = 1.0
    ma_tte: Optional[str] = "VND"

class PickupAcceptRow(BaseModel):
    """Dòng dữ liệu ánh xạ sang K_CtTemp (dòng chi tiết chứng từ) — chỉ trả về, KHÔNG ghi."""
    stt_px: str
    stt0_px: Optional[str] = ""
    stt0: Optional[str] = None
    stt: Optional[str] = None
    tk: Optional[str] = "632"
    tk_du: Optional[str] = "1561"
    tk_du2: Optional[str] = "5111"
    tk_du4: Optional[str] = "521"
    ma_kho: Optional[str] = ""
    ma_vt: str
    ten_vt: Optional[str] = ""
    dvt: Optional[str] = ""
    dvt_ban: Optional[str] = ""
    so_tam: float = 0.0
    he_so8: float = 1.0
    so_luong8: float = 0.0
    he_so9: float = 1.0
    so_luong9: float = 0.0
    so_luong: float = 0.0
    gia_nt9: float = 0.0
    gia9: float = 0.0
    tien_nt9: float = 0.0
    tien9: float = 0.0
    gia_nt: float = 0.0
    gia: float = 0.0
    tien_nt: float = 0.0
    tien: float = 0.0
    gia_nt2: float = 0.0
    gia2: float = 0.0
    tien_nt2: float = 0.0
    tien2: float = 0.0
    tien_nt3: float = 0.0
    tien3: float = 0.0
    chiet_khau: float = 0.0
    tien_nt4: float = 0.0
    tien4: float = 0.0
    gia_tb_tt: str = "K"
    loai_vt: Optional[str] = "1"

class PickupAcceptResponse(BaseModel):
    rows: List[PickupAcceptRow]
    total_rows: int = 0
    ma_xe: Optional[str] = ""

