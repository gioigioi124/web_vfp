"""SqlTruckAdapter: Khung kết nối DB Xe hàng tương lai (100% READ-ONLY).

HƯỚNG DẪN CẮM SCHEMA THẬT KHI DB XE HÀNG HOÀN THIỆN:
Vì schema bảng/cột của DB xe hàng tương lai có thể khác với giả định ban đầu,
BẠN CHỈ CẦN SỬA DUY NHẤT FILE NÀY (2 hàm query + hàm map `make_source_order_key`):
  1. `list_trips`: trả về danh sách `(TruckTripSummary, [source_order_key, ...])` của các đơn ĐÃ KHO DUYỆT.
  2. `get_trip_approved_orders`: trả về `(TruckTripSummary, [TruckApprovedOrderDTO, ...])` của 1 chuyến xe.
  3. Đảm bảo `make_source_order_key(raw_order_id)` trả về chuỗi ASCII <= 20 ký tự, duy nhất và
     KHÔNG trùng prefix `'S1'` của `KH_2014` (VD: `'XE' + str(id).zfill(18)` hoặc `'DH_' + str(id)`).
  4. Bật `TRUCK_SOURCE_ADAPTER=sql` và `DB_TRUCK=<tên_db>` trong `webapp/backend/.env`.

Toàn bộ phần lõi (auto-grouping, Bàn soát xe, Tách/Ghép, kiểm tra công nợ, Batch Commit
vào VP_2014) không cần sửa bất kỳ dòng code nào.
"""

import logging
from typing import List, Optional, Tuple

from app.config import settings
from app.repositories.truck_source.base import TruckSourceAdapter
from app.schemas.truck_batch import TruckApprovedOrderDTO, TruckTripSummary

logger = logging.getLogger("app.repositories.truck_source.sql")


def make_source_order_key(raw_order_id: object, prefix: str = "XE") -> str:
    """
    Chuẩn hóa khóa đơn từ DB xe hàng sang khóa `Stt_PX` (`char(20)`) của `VP_2014.dbo.CtBH0`.
    Đảm bảo <= 20 ký tự ASCII và có prefix riêng biệt với `'S1...'` của `KH_2014`.
    """
    clean_prefix = (prefix or "XE").strip().upper()[:4]
    raw_str = str(raw_order_id or "").strip()
    max_body = 20 - len(clean_prefix)
    if raw_str.isdigit():
        return f"{clean_prefix}{raw_str.zfill(min(12, max_body))}"[:20]
    return f"{clean_prefix}{raw_str}"[:20]


class SqlTruckAdapter(TruckSourceAdapter):
    adapter_name = "sql"

    def __init__(self):
        self.truck_db = settings.DB_TRUCK
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP

    def list_trips(
        self,
        ngay_tu: Optional[str] = None,
        ngay_den: Optional[str] = None,
        ma_xe: Optional[str] = None,
        limit: int = 50,
    ) -> List[Tuple[TruckTripSummary, List[str]]]:
        raise NotImplementedError(
            f"SqlTruckAdapter chưa được ánh xạ vào bảng thật của DB '{self.truck_db}'. "
            "Hãy cập nhật query trong app/repositories/truck_source/sql_adapter.py sau khi chốt schema DB xe hàng, "
            "hoặc chọn adapter 'mock' / 'kh2014' để vận hành thử."
        )

    def get_trip_approved_orders(
        self, trip_id: str
    ) -> Optional[Tuple[TruckTripSummary, List[TruckApprovedOrderDTO]]]:
        raise NotImplementedError(
            f"SqlTruckAdapter chưa được ánh xạ vào bảng thật của DB '{self.truck_db}'. "
            "Hãy cập nhật query trong app/repositories/truck_source/sql_adapter.py."
        )
