from typing import Optional
from pydantic import BaseModel

class VatTuLookup(BaseModel):
    ma_vt: str
    ten_vt: str
    dvt: Optional[str] = ""
    dvt_ban: Optional[str] = ""
    loai_vt: Optional[str] = "1"
    tk_gv: Optional[str] = "632"
    tk_vt: Optional[str] = "1561"
    tk_dt: Optional[str] = "5111"
    tk_ck: Optional[str] = "521"
    he_so0: Optional[float] = 1.0
    he_so1: Optional[float] = 1.0
    he_so2: Optional[float] = 1.0
    dvt0: Optional[str] = ""
    dvt1: Optional[str] = ""
    dvt2: Optional[str] = ""

class KhachHangLookup(BaseModel):
    ma_dt: str
    ten_dt: str
    dia_chi: Optional[str] = ""
    ong_ba: Optional[str] = ""
    ms_thue: Optional[str] = ""
    han_tt: Optional[int] = 0
    gioi_han: Optional[float] = 0.0
    toi_han: Optional[float] = 0.0
    doi_tac: Optional[str] = ""
    ma_bp: Optional[str] = ""
    ten_bp: Optional[str] = ""
    ma_xe: Optional[str] = ""
    ma_vm: Optional[str] = ""

class KhoLookup(BaseModel):
    ma_kho: str
    ten_kho: str

class ThueLookup(BaseModel):
    ma_thue: str
    ten_thue: Optional[str] = ""
    thue_gtgt: float
    tk: Optional[str] = "33311"

class TaiKhoanLookup(BaseModel):
    tk: str
    ten_tk: str
    tk_dt: Optional[str] = ""

class NhapXuatLookup(BaseModel):
    ma_nx: str
    ten_nx: str
    dinh_khoan: Optional[str] = "C"

class XeLookup(BaseModel):
    ma_xe: str
    ten_xe: str

class BoPhanLookup(BaseModel):
    ma_bp: str
    ten_bp: str

class HopDongLookup(BaseModel):
    ma_hd: str
    ten_hd: str

class TienTeLookup(BaseModel):
    ma_tte: str
    ten_tte: Optional[str] = ""
    ty_gia: float = 1.0
