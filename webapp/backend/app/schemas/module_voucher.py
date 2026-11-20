from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ModuleVoucherDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt0: Optional[str] = None
    stt: Optional[str] = None
    ma_kho: str = ""
    ma_kho_n: str = ""
    ma_vt: str = ""
    ten_vt: str = ""
    dvt: str = ""
    so_luong: float = 0.0
    gia_nt: float = 0.0
    tien_nt: float = 0.0
    tien_nt3: float = 0.0
    no_co: str = "N"
    tk: str = ""
    tk_du: str = ""
    dien_giai: str = ""
    ma_dt: str = ""
    ma_bp: str = ""
    ma_km: str = ""
    ma_sp: str = ""
    ma_hd: str = ""


class ModuleVoucherHeaderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt: str
    ma_dvcs: str = "S1"
    ma_ct: str = ""
    nh_ct: str = "1"
    ngay_ct: str = ""
    so_ct: str = ""
    ma_dt: str = ""
    ten_dt: str = ""
    ong_ba: str = ""
    dia_chi: str = ""
    dien_giai0: str = ""
    ma_nx: str = ""
    tk: str = ""
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    ttien_nt0: float = 0.0
    ttien_nt3: float = 0.0
    ttien_nt: float = 0.0
    posted: bool = True
    confirmed: bool = True
    user_name: str = "ADMIN"
    so_ct0: str = ""
    ngay_ct0: Optional[str] = None
    so_seri0: str = ""
    ma_thue: str = ""
    thue_gtgt: float = 0.0
    item_count: int = 0


class ModuleVoucherDetailResponse(ModuleVoucherHeaderSchema):
    items: List[ModuleVoucherDetailSchema] = []
    is_mock: bool = False


class ModuleVoucherPageResponse(BaseModel):
    items: List[ModuleVoucherHeaderSchema]
    total_records: int
    page: int
    page_size: int
    total_pages: int
    total_amount: float = 0.0
    is_mock: bool = False


class ModuleVoucherSaveRequest(BaseModel):
    ma_dvcs: Optional[str] = "S1"
    ma_ct: Optional[str] = ""
    nh_ct: Optional[str] = "1"
    ngay_ct: str
    so_ct: str
    ma_dt: Optional[str] = ""
    ten_dt: Optional[str] = ""
    ong_ba: Optional[str] = ""
    dia_chi: Optional[str] = ""
    dien_giai0: Optional[str] = ""
    ma_nx: Optional[str] = ""
    tk: Optional[str] = ""
    ma_tte: Optional[str] = "VND"
    ty_gia: Optional[float] = 1.0
    posted: Optional[bool] = True
    user_name: Optional[str] = "ADMIN"
    so_ct0: Optional[str] = ""
    ngay_ct0: Optional[str] = None
    so_seri0: Optional[str] = ""
    ma_thue: Optional[str] = ""
    thue_gtgt: Optional[float] = 0.0
    items: List[ModuleVoucherDetailSchema] = []


class PartnerBalanceRow(BaseModel):
    ma_dt: str
    ten_dt: str = ""
    dia_chi: str = ""
    du_no_dau: float = 0.0
    du_co_dau: float = 0.0
    ps_no: float = 0.0
    ps_co: float = 0.0
    du_no_cuoi: float = 0.0
    du_co_cuoi: float = 0.0
    tx_count: int = 0


class PartnerBalancePageResponse(BaseModel):
    tk_prefix: str
    items: List[PartnerBalanceRow]
    total_records: int
    page: int
    page_size: int
    total_pages: int
    sum_du_no_dau: float = 0.0
    sum_du_co_dau: float = 0.0
    sum_ps_no: float = 0.0
    sum_ps_co: float = 0.0
    sum_du_no_cuoi: float = 0.0
    sum_du_co_cuoi: float = 0.0
    is_mock: bool = False


class PartnerLedgerRow(BaseModel):
    stt: str = ""
    ngay_ct: str
    ma_ct: str
    so_ct: str
    dien_giai: str = ""
    tk: str = ""
    tk_du: str = ""
    ps_no: float = 0.0
    ps_co: float = 0.0
    luy_ke: float = 0.0


class PartnerLedgerResponse(BaseModel):
    tk_prefix: str
    ma_dt: str
    ten_dt: str = ""
    du_dau: float = 0.0
    du_cuoi: float = 0.0
    entries: List[PartnerLedgerRow] = []
    is_mock: bool = False


class TrialBalanceRow(BaseModel):
    tk: str
    ten_tk: str = ""
    bac_tk: int = 1
    du_no_dau: float = 0.0
    du_co_dau: float = 0.0
    ps_no: float = 0.0
    ps_co: float = 0.0
    du_no_cuoi: float = 0.0
    du_co_cuoi: float = 0.0


class TrialBalanceResponse(BaseModel):
    items: List[TrialBalanceRow]
    sum_du_no_dau: float = 0.0
    sum_du_co_dau: float = 0.0
    sum_ps_no: float = 0.0
    sum_ps_co: float = 0.0
    sum_du_no_cuoi: float = 0.0
    sum_du_co_cuoi: float = 0.0
    is_mock: bool = False


class GlLedgerRow(BaseModel):
    stt: str = ""
    ngay_ct: str
    ma_ct: str
    so_ct: str
    ma_dt: str = ""
    ten_dt: str = ""
    dien_giai: str = ""
    tk_no: str = ""
    tk_co: str = ""
    ps_no: float = 0.0
    ps_co: float = 0.0
    luy_ke: float = 0.0


class GlLedgerResponse(BaseModel):
    tk: str
    ten_tk: str = ""
    du_dau: float = 0.0
    du_cuoi: float = 0.0
    entries: List[GlLedgerRow] = []
    is_mock: bool = False
