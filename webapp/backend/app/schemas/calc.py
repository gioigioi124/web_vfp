from typing import List, Optional
from pydantic import BaseModel

class CalcItemInput(BaseModel):
    stt0: Optional[str] = None
    ma_vt: Optional[str] = None
    ten_vt: Optional[str] = None
    dvt: Optional[str] = None
    dvt_ban: Optional[str] = None
    loai_vt: Optional[str] = "1"
    so_tam: Optional[float] = 0.0
    he_so8: Optional[float] = 1.0
    so_luong8: Optional[float] = 0.0
    he_so9: Optional[float] = 1.0
    so_luong9: Optional[float] = 0.0
    gia_nt9: Optional[float] = 0.0
    tien_nt9: Optional[float] = 0.0
    chiet_khau: Optional[float] = 0.0
    tk_du2: Optional[str] = "5111"
    gia_tb_tt: Optional[str] = "K"
    var_read: Optional[str] = ""

class CalcItemOutput(BaseModel):
    stt0: Optional[str] = None
    ma_vt: Optional[str] = None
    ten_vt: Optional[str] = None
    dvt: Optional[str] = None
    dvt_ban: Optional[str] = None
    loai_vt: str = "1"
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
    chiet_khau: float = 0.0
    tien_nt4: float = 0.0
    tien4: float = 0.0
    tien_nt2: float = 0.0
    tien2: float = 0.0
    gia_nt2: float = 0.0
    gia2: float = 0.0
    tk_du2: Optional[str] = "5111"
    gia_tb_tt: Optional[str] = "K"

class CalcRequest(BaseModel):
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    thue_gtgt: float = 0.0
    loai_ck: str = "1"
    ttien_nt4_manual: Optional[float] = None
    items: List[CalcItemInput]

class CalcHeaderOutput(BaseModel):
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    thue_gtgt: float = 0.0
    loai_ck: str = "1"
    ttien_nt: float = 0.0
    ttien_nt4: float = 0.0
    ttien_nt2: float = 0.0
    ttien_nt3: float = 0.0
    ttien_nt0: float = 0.0
    ttien: float = 0.0
    ttien4: float = 0.0
    ttien2: float = 0.0
    ttien3: float = 0.0
    ttien0: float = 0.0

class CalcResponse(BaseModel):
    header: CalcHeaderOutput
    items: List[CalcItemOutput]
    warnings: List[str] = []
