from typing import List, Optional
from pydantic import BaseModel, ConfigDict

from app.schemas.voucher import VoucherListPagination


class CashVoucherDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt0: Optional[str] = None
    stt: Optional[str] = None
    stt_nv: Optional[int] = 1
    tien_nt: Optional[float] = 0.0
    tien: Optional[float] = 0.0
    tien_nt3: Optional[float] = 0.0
    tien3: Optional[float] = 0.0
    ma_dt: Optional[str] = ""
    ma_hd: Optional[str] = ""
    ma_bp: Optional[str] = ""
    ma_km: Optional[str] = ""
    ma_sp: Optional[str] = ""
    tk_no: Optional[str] = ""
    tk_co: Optional[str] = ""
    tk_no3: Optional[str] = ""
    tk_co3: Optional[str] = ""
    dien_giai: Optional[str] = ""
    desc_en: Optional[str] = ""
    ma_thue: Optional[str] = ""
    thue_gtgt: Optional[float] = 0.0
    ma_dtgtgt: Optional[str] = ""
    ten_dtgtgt: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    so_ct0: Optional[str] = ""
    so_seri0: Optional[str] = ""
    loai_vat: Optional[str] = "1"
    dieu_chinh: Optional[str] = "K"

    # Joined display fields
    ten_dt: Optional[str] = ""
    ten_tk_no: Optional[str] = ""
    ten_tk_co: Optional[str] = ""
    ten_bp: Optional[str] = ""
    ten_hd: Optional[str] = ""


class CashVoucherHeaderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt: str
    ma_dvcs: str = "S1"
    ma_ct: str = "C1"
    kieu_ct: Optional[str] = " "
    nh_ct: str = "1"
    ngay_ct: str
    so_ct: Optional[str] = ""
    so_seri: Optional[str] = ""
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    ma_dt0: Optional[str] = ""
    ong_ba: Optional[str] = ""
    dia_chi: Optional[str] = ""
    dien_giai0: Optional[str] = ""
    desc_en0: Optional[str] = ""
    ttien_nt: Optional[float] = 0.0
    ttien: Optional[float] = 0.0
    ttien_nt3: Optional[float] = 0.0
    ttien3: Optional[float] = 0.0
    ttien_nt0: Optional[float] = 0.0
    ttien0: Optional[float] = 0.0
    han_tt: Optional[int] = 0
    ct_di_kem: Optional[str] = ""
    so_ct0: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    user_name: Optional[str] = ""
    posted: Optional[bool] = True
    confirmed: Optional[bool] = True
    printed: Optional[bool] = False

    # Joined / summary display fields
    ten_dt0: Optional[str] = ""
    tk_chinh: Optional[str] = ""
    tk_doi_ung: Optional[str] = ""


class CashVoucherDetailResponse(CashVoucherHeaderSchema):
    items: List[CashVoucherDetailSchema] = []


class CashVoucherSummary(BaseModel):
    total_ttien_nt: float = 0.0
    total_ttien: float = 0.0
    total_ttien_nt3: float = 0.0
    total_ttien3: float = 0.0
    total_ttien_nt0: float = 0.0
    total_ttien0: float = 0.0


class CashVoucherListResponse(BaseModel):
    items: List[CashVoucherHeaderSchema]
    pagination: VoucherListPagination
    summary: CashVoucherSummary


class CashVoucherCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ma_dvcs: Optional[str] = "S1"
    ma_ct: str = "C1"
    kieu_ct: Optional[str] = " "
    nh_ct: Optional[str] = None
    ngay_ct: str
    so_ct: Optional[str] = ""
    so_seri: Optional[str] = ""
    ma_tte: Optional[str] = "VND"
    ty_gia: Optional[float] = 1.0
    ma_dt0: Optional[str] = ""
    ong_ba: Optional[str] = ""
    dia_chi: Optional[str] = ""
    dien_giai0: Optional[str] = ""
    desc_en0: Optional[str] = ""
    han_tt: Optional[int] = 0
    ct_di_kem: Optional[str] = ""
    so_ct0: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    user_name: Optional[str] = "KTCN3"
    confirmed: Optional[bool] = True
    posted: Optional[bool] = True
    printed: Optional[bool] = False
    custom_so_ct: Optional[bool] = False
    items: List[CashVoucherDetailSchema]


class CashVoucherUpdateRequest(CashVoucherCreateRequest):
    pass


class CashVoucherSaveResponse(BaseModel):
    stt: str
    so_ct: str
    message: str


class CashVoucherDeleteResponse(BaseModel):
    stt: str
    message: str


class CashLedgerEntry(BaseModel):
    stt: str
    ma_ct: str
    ngay_ct: str
    so_ct: str
    ma_dt: str = ""
    ten_dt: str = ""
    dien_giai: str = ""
    tk_doi_ung: str = ""
    ps_thu: float = 0.0
    ps_chi: float = 0.0
    luy_ke: float = 0.0


class CashLedgerResponse(BaseModel):
    tk: str
    ten_tk: str = ""
    ngay_bd: str
    ngay_kt: str
    du_dau: float = 0.0
    tong_thu: float = 0.0
    tong_chi: float = 0.0
    du_cuoi: float = 0.0
    entries: List[CashLedgerEntry] = []


class BaoCoImportRowPreview(BaseModel):
    row_index: int
    ten_tk: str = ""
    so_tk: str = ""
    noi_dung: str = ""
    so_tien: float = 0.0
    ngay_ct: str = ""
    ma_dt: str = ""
    ten_dt: str = ""
    dia_chi: str = ""
    valid: bool = True
    error: Optional[str] = None


class BaoCoImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows: List[BaoCoImportRowPreview]


class BaoCoImportRowInput(BaseModel):
    noi_dung: str = ""
    so_tien: float
    ngay_ct: str
    ma_dt: str = ""
    tk_no: Optional[str] = None
    tk_co: Optional[str] = None


class BaoCoImportCommitRequest(BaseModel):
    ma_dvcs: Optional[str] = "S1"
    ma_ct: str = "C3"
    tk_no: str = "11212"
    tk_co: str = "1311"
    user_name: Optional[str] = "KTTH"
    rows: List[BaoCoImportRowInput]


class BaoCoImportCommitResponse(BaseModel):
    created_count: int
    created_vouchers: List[CashVoucherSaveResponse]
    message: str
