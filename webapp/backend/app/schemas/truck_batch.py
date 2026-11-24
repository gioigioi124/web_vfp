"""Pydantic schemas & Data Contract DTOs for Truck Batch Export (Xuất nhanh cả xe)."""

from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.debt import CustomerDebtSummary
from app.schemas.pickup import PickupAcceptRow
from app.schemas.voucher import VoucherCreateRequest, VoucherSaveResponse


class TruckTripSummary(BaseModel):
    """Thông tin tổng quan 1 chuyến xe (độc lập với schema DB nguồn)."""

    model_config = ConfigDict(from_attributes=True)

    trip_id: str
    trip_date: str
    ma_xe: str
    ten_xe: str = ""
    driver_name: str = ""
    note: str = ""
    source_adapter: str = "mock"
    total_approved_orders: int = 0
    exported_orders: int = 0
    pending_orders: int = 0
    total_customers: int = 0


class TruckOrderItemDTO(BaseModel):
    """Dòng hàng trong 1 đơn kho đã duyệt trên xe (Data Contract nội bộ)."""

    model_config = ConfigDict(from_attributes=True)

    source_line_id: str = ""
    ma_vt: str
    ten_vt: str = ""
    ma_kho: str = ""
    dvt: str = ""
    dvt_ban: str = ""
    loai_vt: str = "1"
    so_tam: float = 0.0
    he_so8: float = 1.0
    so_luong9: float = 0.0
    tk_gv: str = ""
    tk_vt: str = ""
    tk_dt: str = ""
    tk_ck: str = ""
    tk_hbtl: str = ""
    is_gift: bool = False
    # Giá gợi ý tùy chọn (chủ yếu cho mock/fallback khi không có bảng giá BG/BG0)
    fallback_price: Optional[float] = None
    fallback_discount: Optional[float] = None


class TruckApprovedOrderDTO(BaseModel):
    """Một đơn hàng đã được kho duyệt trên xe (tương đương 1 phiếu kho KH_2014)."""

    model_config = ConfigDict(from_attributes=True)

    # Khóa ghi vào VP_2014.dbo.CtBH0.Stt_PX (BẮT BUỘC <= 20 ký tự ASCII, prefix riêng khác 'S1')
    source_order_key: str
    order_code: str
    order_date: str
    ma_dt: str
    ten_dt: str = ""
    ma_kho: str = ""
    # Ghi chú / Diễn giải nguồn dùng làm khóa gom đơn cùng khách hàng
    group_note: str = ""
    delivery_address: str = ""
    ma_ct: str = "X1"
    approved_at: Optional[str] = None
    items: List[TruckOrderItemDTO] = Field(default_factory=list)


class TruckSourceOrderRef(BaseModel):
    """Metadata rút gọn của từng đơn kho con nằm bên trong 1 phiếu bán dự kiến (phục vụ Tách/Ghép)."""

    source_order_key: str
    order_code: str
    order_date: str = ""
    ma_kho: str = ""
    group_note: str = ""
    item_count: int = 0
    total_qty: float = 0.0


class TruckDraftItemRow(PickupAcceptRow):
    """Mở rộng PickupAcceptRow với metadata truy vết đơn kho nguồn cho Detail Grid."""

    source_order_key: str = ""
    source_order_code: str = ""
    source_group_note: str = ""
    is_gift: bool = False


class TruckDraftVoucher(BaseModel):
    """Một phiếu bán hàng dự kiến sau khi auto-group theo (Ma_Dt + Ghi chú chuẩn hóa)."""

    draft_id: str
    ma_ct: str = "X1"
    ngay_ct: str
    ma_xe: str = ""
    ten_xe: str = ""
    ma_dt: str
    ten_dt: str = ""
    ong_ba: str = ""
    dia_chi: str = ""
    ma_bp: str = ""
    han_tt: int = 0
    ma_nx: str = "131"
    tk2: str = "1311"
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    dien_giai0: str = ""
    normalized_group_note: str = ""
    source_orders: List[TruckSourceOrderRef] = Field(default_factory=list)
    items: List[TruckDraftItemRow] = Field(default_factory=list)
    ttien_nt9: float = 0.0
    ttien_nt4: float = 0.0
    ttien_nt2: float = 0.0
    ttien_nt0: float = 0.0
    ttien0: float = 0.0
    skip_debt_check: bool = False


class TruckStageResponse(BaseModel):
    """Payload đầy đủ trả về cho Bàn soát nhanh cả xe (TruckBatchWorkbench)."""

    trip: TruckTripSummary
    ngay_ct: str
    vouchers: List[TruckDraftVoucher] = Field(default_factory=list)
    customer_debts: Dict[str, CustomerDebtSummary] = Field(default_factory=dict)
    already_exported_order_keys: List[str] = Field(default_factory=list)
    total_pending_orders: int = 0
    total_exported_orders: int = 0


class TruckBatchCommitVoucher(VoucherCreateRequest):
    """Một phiếu gửi lên từ Bàn soát xe trong yêu cầu Batch Commit."""

    draft_id: Optional[str] = None
    source_order_keys: List[str] = Field(default_factory=list)


class TruckBatchCommitRequest(BaseModel):
    """Yêu cầu xuất toàn bộ xe trong 1 Transaction duy nhất (All-or-Nothing)."""

    trip_id: str
    vouchers: List[TruckBatchCommitVoucher] = Field(..., min_length=1)
    user_name: Optional[str] = "KTCN3"


class TruckBatchCreatedItem(VoucherSaveResponse):
    """Thông tin từng phiếu đã tạo thành công trong batch."""

    draft_id: Optional[str] = None
    ma_dt: str = ""
    ten_dt: str = ""
    ttien0: float = 0.0
    item_count: int = 0
    source_order_keys: List[str] = Field(default_factory=list)


class TruckBatchCommitResult(BaseModel):
    """Kết quả sau khi COMMIT thành công toàn bộ xe."""

    trip_id: str
    created_vouchers: List[TruckBatchCreatedItem] = Field(default_factory=list)
    total_vouchers: int = 0
    total_items: int = 0
    total_amount: float = 0.0
    message: str = ""


class TruckCustomerDebtRequest(BaseModel):
    """Tra cứu nhanh công nợ + hạn mức khi đổi khách hàng ngay trên Master Grid."""

    ma_dt: str


class TruckRepriceRequest(BaseModel):
    """Yêu cầu áp lại giá (chỉ khi kế toán chủ động bấm nút phụ sau khi đổi khách)."""

    ma_dt: str
    ngay_ct: str
    ma_vt_list: List[str] = Field(default_factory=list)
