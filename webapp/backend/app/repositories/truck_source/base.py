"""Abstract READ-ONLY adapter interface for Truck/Dispatch data sources.

Mọi khác biệt về tên bảng/cột/encoding của DB xe hàng tương lai được cô lập hoàn toàn
bên trong các lớp con của `TruckSourceAdapter`. Phần lõi nghiệp vụ (gom đơn, định giá,
kiểm tra công nợ, Bàn soát xe, Batch Commit vào VP_2014) chỉ làm việc với các DTO chuẩn.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

from app.schemas.truck_batch import TruckApprovedOrderDTO, TruckTripSummary


class TruckSourceAdapter(ABC):
    """Giao diện 100% READ-ONLY đọc dữ liệu chuyến xe và các đơn kho đã duyệt."""

    adapter_name: str = "base"

    @abstractmethod
    def list_trips(
        self,
        ngay_tu: Optional[str] = None,
        ngay_den: Optional[str] = None,
        ma_xe: Optional[str] = None,
        limit: int = 50,
    ) -> List[Tuple[TruckTripSummary, List[str]]]:
        """
        Trả về danh sách `(trip_summary, approved_source_order_keys)`.
        `approved_source_order_keys` được `TruckBatchService` dùng để đối chiếu 1 lần
        với `VP_2014.dbo.CtBH0.Stt_PX` nhằm tính chính xác `exported_orders` / `pending_orders`.
        """

    @abstractmethod
    def get_trip_approved_orders(
        self, trip_id: str
    ) -> Optional[Tuple[TruckTripSummary, List[TruckApprovedOrderDTO]]]:
        """
        Trả về `(trip_summary, approved_orders)` cho 1 chuyến xe, hoặc `None` nếu không tìm thấy.
        Chỉ trả về các đơn ĐÃ ĐƯỢC KHO DUYỆT.
        """

    def get_mock_debt_overrides(self) -> Dict[str, dict]:
        """Chỉ dùng bởi MockTruckAdapter để mô phỏng cảnh báo quá nợ khi không nối SQL Server."""
        return {}
