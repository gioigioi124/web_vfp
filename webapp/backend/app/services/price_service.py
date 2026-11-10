import logging
from typing import List, Optional

from app.repositories.price_repo import price_repository
from app.schemas.price import PriceItem, PriceBatchResponse

logger = logging.getLogger("app.services.price")


class PriceService:
    """
    Tra đơn giá bán & chiết khấu từ bảng giá văn phòng `VP_2014.dbo.BG`/`BG0`.
    100% READ-ONLY.
    """

    def __init__(self):
        self.repo = price_repository

    def get_price(self, ma_dt: str, ma_vt: str, ngay_ct: str) -> Optional[PriceItem]:
        picked = self.repo.get_price(ma_dt, ma_vt, ngay_ct)
        if picked is None:
            return None
        return PriceItem(ma_vt=(ma_vt or "").strip().upper(), **picked)

    def get_prices_batch(
        self,
        ma_dt: str,
        ma_vt_list: List[str],
        ngay_ct: str,
    ) -> PriceBatchResponse:
        batch = self.repo.get_prices_batch(ma_dt, ma_vt_list, ngay_ct)
        items = [
            PriceItem(ma_vt=code, **picked)
            for code, picked in batch.items()
        ]
        return PriceBatchResponse(ma_dt=ma_dt, ngay_ct=ngay_ct, items=items)


price_service = PriceService()
