from typing import List, Optional

from pydantic import BaseModel


class PriceItem(BaseModel):
    """Kết quả tra giá một mã vật tư từ bảng giá BG/BG0."""

    ma_vt: str
    gia: float = 0.0
    chiet_khau: float = 0.0
    # True khi bảng giá đã hết hiệu lực (Ngay_Ct > Ngay_Ct2) -> giá/CK đã bị ép về 0.
    expired: bool = False
    # 'customer' (khớp Ma_Dt) hoặc 'region' (khớp Ma_Vm của khách).
    source: Optional[str] = None
    ngay_ct: Optional[str] = None
    ngay_ct2: Optional[str] = None


class PriceBatchRequest(BaseModel):
    ma_dt: str = ""
    ngay_ct: str
    ma_vt_list: List[str] = []


class PriceBatchResponse(BaseModel):
    ma_dt: str = ""
    ngay_ct: str
    items: List[PriceItem] = []
