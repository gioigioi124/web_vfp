from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class VoucherDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # 35 Detail Columns according to CtBH0
    stt_px: Optional[str] = None
    stt0: Optional[str] = None
    stt: Optional[str] = None
    tk: Optional[str] = "632"
    tk_du: Optional[str] = "1561"
    tk_du2: Optional[str] = "5111"
    tk_du4: Optional[str] = "521"
    ma_kho: Optional[str] = None
    ma_vt: Optional[str] = None
    dvt: Optional[str] = None
    dvt_ban: Optional[str] = None
    so_tam: Optional[float] = 0.0
    he_so8: Optional[float] = 1.0
    so_luong8: Optional[float] = 0.0
    he_so9: Optional[float] = 1.0
    so_luong9: Optional[float] = 0.0
    gia_nt9: Optional[float] = 0.0
    gia9: Optional[float] = 0.0
    tien_nt9: Optional[float] = 0.0
    tien9: Optional[float] = 0.0
    so_luong: Optional[float] = 0.0
    gia_nt: Optional[float] = 0.0
    gia: Optional[float] = 0.0
    tien_nt: Optional[float] = 0.0
    tien: Optional[float] = 0.0
    gia_nt2: Optional[float] = 0.0
    gia2: Optional[float] = 0.0
    tien_nt2: Optional[float] = 0.0
    tien2: Optional[float] = 0.0
    tien_nt3: Optional[float] = 0.0
    tien3: Optional[float] = 0.0
    chiet_khau: Optional[float] = 0.0
    tien_nt4: Optional[float] = 0.0
    tien4: Optional[float] = 0.0
    gia_tb_tt: Optional[str] = "C"

    # Display / Joined fields
    ten_vt: Optional[str] = ""
    ten_kho: Optional[str] = ""
    loai_vt: Optional[str] = "1"

class VoucherHeaderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # 46 Header Columns according to CtBH
    stt: str
    ma_dvcs: str = "01"
    ma_ct: str = "X1"
    nh_ct: str = "2"
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    ngay_ps: Optional[str] = None
    ngay_ct: str
    so_ct: Optional[str] = ""
    ma_xe: Optional[str] = ""
    ma_bp: Optional[str] = ""
    ma_hd: Optional[str] = ""
    ma_dt: str
    ma_nx: Optional[str] = "131"
    tk2: Optional[str] = "1311"
    tk3: Optional[str] = "33311"
    tk_du3: Optional[str] = "1311"
    tk4: Optional[str] = "521"
    ong_ba: Optional[str] = ""
    dia_chi: Optional[str] = ""
    dien_giai0: Optional[str] = ""
    desc_en0: Optional[str] = ""
    ttien_nt: Optional[float] = 0.0
    ttien_nt0: Optional[float] = 0.0
    ttien_nt2: Optional[float] = 0.0
    ttien_nt3: Optional[float] = 0.0
    ttien_nt4: Optional[float] = 0.0
    ttien: Optional[float] = 0.0
    ttien0: Optional[float] = 0.0
    ttien3: Optional[float] = 0.0
    ttien2: Optional[float] = 0.0
    ttien4: Optional[float] = 0.0
    loai_ck: Optional[str] = "2"
    tyle_ck: Optional[float] = 0.0
    han_tt: Optional[int] = 0
    ma_thue: Optional[str] = None
    thue_gtgt: Optional[float] = None
    ma_dtgtgt: Optional[str] = ""
    ten_dtgtgt: Optional[str] = ""
    so_ct0: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    stt_hbtl: Optional[str] = ""
    confirmed: Optional[bool] = False
    posted: Optional[bool] = True
    printed: Optional[bool] = False
    user_name: Optional[str] = ""

    # Extra joined display fields
    ten_dt: Optional[str] = ""
    ten_xe: Optional[str] = ""
    ten_bp: Optional[str] = ""
    ten_nx: Optional[str] = ""
    ten_tk2: Optional[str] = ""
    ten_hd: Optional[str] = ""

class VoucherDetailResponse(VoucherHeaderSchema):
    items: List[VoucherDetailSchema] = []

class VoucherListPagination(BaseModel):
    page: int
    page_size: int
    total_records: int
    total_pages: int
    has_next: bool

class VoucherSummary(BaseModel):
    total_ttien_nt: float = 0.0
    total_ttien_nt2: float = 0.0
    total_ttien_nt3: float = 0.0
    total_ttien_nt4: float = 0.0
    total_ttien_nt0: float = 0.0
    total_ttien: float = 0.0
    total_ttien2: float = 0.0
    total_ttien3: float = 0.0
    total_ttien4: float = 0.0
    total_ttien0: float = 0.0

class VoucherListResponse(BaseModel):
    items: List[VoucherHeaderSchema]
    pagination: VoucherListPagination
    summary: VoucherSummary

class VoucherCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ma_dvcs: Optional[str] = "S1"
    ma_ct: Optional[str] = "X1"
    nh_ct: Optional[str] = "2"
    ma_tte: Optional[str] = "VND"
    ty_gia: Optional[float] = 1.0
    ngay_ps: Optional[str] = None
    ngay_ct: str
    so_ct: Optional[str] = ""
    ma_xe: Optional[str] = ""
    ma_bp: Optional[str] = ""
    ma_hd: Optional[str] = ""
    ma_dt: str
    ma_nx: Optional[str] = "131"
    tk2: Optional[str] = "1311"
    tk3: Optional[str] = "33311"
    tk_du3: Optional[str] = "1311"
    tk4: Optional[str] = "521"
    ong_ba: Optional[str] = ""
    dia_chi: Optional[str] = ""
    dien_giai0: Optional[str] = ""
    desc_en0: Optional[str] = ""
    ttien_nt: Optional[float] = 0.0
    ttien_nt0: Optional[float] = 0.0
    ttien_nt2: Optional[float] = 0.0
    ttien_nt3: Optional[float] = 0.0
    ttien_nt4: Optional[float] = 0.0
    ttien: Optional[float] = 0.0
    ttien0: Optional[float] = 0.0
    ttien3: Optional[float] = 0.0
    ttien2: Optional[float] = 0.0
    ttien4: Optional[float] = 0.0
    loai_ck: Optional[str] = "2"
    tyle_ck: Optional[float] = 0.0
    han_tt: Optional[int] = 0
    ma_thue: Optional[str] = None
    thue_gtgt: Optional[float] = None
    ma_dtgtgt: Optional[str] = ""
    ten_dtgtgt: Optional[str] = ""
    so_ct0: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    stt_hbtl: Optional[str] = ""
    confirmed: Optional[bool] = True
    posted: Optional[bool] = True
    printed: Optional[bool] = False
    user_name: Optional[str] = ""
    items: List[VoucherDetailSchema] = []

class VoucherUpdateRequest(VoucherCreateRequest):
    stt: Optional[str] = None

class CheckNumberRequest(BaseModel):
    ma_dvcs: Optional[str] = "S1"
    moi_sua: Optional[str] = "M"
    stt: Optional[str] = ""
    ma_ct: Optional[str] = "X1"
    ngay_ct: str
    so_ct: str

class CheckNumberResponse(BaseModel):
    is_duplicate: bool
    valid_so_ct: str
    message: str

class VoucherSaveResponse(BaseModel):
    stt: str
    so_ct: str
    message: str = "Lưu chứng từ thành công."

class VoucherDeleteResponse(BaseModel):
    stt: str
    message: str = "Xóa chứng từ thành công."

