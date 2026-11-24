"""MockTruckAdapter: Dữ liệu chuyến xe mẫu bám sát thực tế nghiệp vụ để test end-to-end.

Kịch bản có sẵn:
- Chuyến XE-DEMO-01:
  * Khách KH001 (6 đơn từ 3 kho K01, K02, K03 chia đi 2 nơi khác nhau):
    - 4 đơn ghi chú "Giao CH1 - Cầu Giấy" (gồm 1 đơn gõ lệch hoa/thường + khoảng trắng "giao  ch1 - cầu giấy " để test chuẩn hóa)
    - 2 đơn ghi chú "Giao CH2 - Hà Đông"
    - Có đệm lò xo `80...` + ruột gối tặng `920206045065` (giá 0₫/1₫) để test PromotionCounter
  * Khách KH002 (2 đơn cùng ghi chú nhưng 1 đơn gõ hơi khác "Giao kho Bắc Ninh" vs "Giao kho Bac Ninh")
    -> mặc định ra 2 phiếu để kế toán test nút Ghép phiếu (Ctrl+G) hoặc Tách đơn (Ctrl+T)
  * Khách KH003 (VƯỢT HẠN MỨC CÔNG NỢ) -> test viền/nền cảnh báo đỏ, đổi sang khách khác giữ nguyên giá,
    hoặc bấm Shift+Enter để bypass nợ
  * Khách KH004 (Hàng Mút Loai_Vt='2' có So_Tam * He_So8 + 1 dòng giá = 0₫)
"""

from datetime import date
from typing import Dict, List, Optional, Tuple

from app.repositories.truck_source.base import TruckSourceAdapter
from app.schemas.truck_batch import (
    TruckApprovedOrderDTO,
    TruckOrderItemDTO,
    TruckTripSummary,
)


class MockTruckAdapter(TruckSourceAdapter):
    adapter_name = "mock"

    def _build_demo_data(self) -> Dict[str, Tuple[TruckTripSummary, List[TruckApprovedOrderDTO]]]:
        today = date.today().strftime("%Y-%m-%d")

        trip1 = TruckTripSummary(
            trip_id="XE-DEMO-01",
            trip_date=today,
            ma_xe="29C12345",
            ten_xe="Xe tải 29C-123.45 (Tuyến Hà Nội - Bắc Ninh)",
            driver_name="Nguyễn Văn Tài",
            note="Chuyến sáng - 1 khách 6 đơn đi 2 nơi + khách vượt nợ + hàng Mút/KM",
            source_adapter=self.adapter_name,
        )

        trip1_orders = [
            # --- KH001: 4 đơn giao CH1 - Cầu Giấy (từ 3 kho khác nhau) ---
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0001",
                order_code="K01/DUYET-001",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K01",
                group_note="Giao CH1 - Cầu Giấy",
                delivery_address="128 Xuân Thủy, Cầu Giấy, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L1",
                        ma_vt="800116020025",
                        ten_vt="Đệm lò xo Elan 160x200x25cm",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=4,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=4500000,
                        fallback_discount=5.0,
                    ),
                    TruckOrderItemDTO(
                        source_line_id="L2",
                        ma_vt="920206045065",
                        ten_vt="Ruột gối Vimatt 45x65 (KM)",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=8,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        is_gift=True,
                        fallback_price=0,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0002",
                order_code="K02/DUYET-014",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K02",
                # Cố tình thêm khoảng trắng & chữ thường để test chuẩn hóa ghi chú
                group_note="  giao   ch1 - cầu giấy ",
                delivery_address="128 Xuân Thủy, Cầu Giấy, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L3",
                        ma_vt="600116020009",
                        ten_vt="Đệm bông ép Alias 160x200x9cm",
                        ma_kho="K02",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=5,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=2150000,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0003",
                order_code="K03/DUYET-021",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K03",
                group_note="Giao CH1 - Cầu Giấy",
                delivery_address="128 Xuân Thủy, Cầu Giấy, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L4",
                        ma_vt="9101160200SD",
                        ten_vt="Ga bộ 5 món cao cấp SD 160x200",
                        ma_kho="K03",
                        dvt="Bộ",
                        dvt_ban="Bộ",
                        loai_vt="1",
                        so_luong9=10,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=1250000,
                        fallback_discount=2.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0004",
                order_code="K02/DUYET-019",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K02",
                group_note="Giao CH1 - Cầu Giấy",
                delivery_address="128 Xuân Thủy, Cầu Giấy, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L5",
                        ma_vt="920206045065",
                        ten_vt="Ruột gối Vimatt 45x65",
                        ma_kho="K02",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=5,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        is_gift=True,
                        fallback_price=1,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            # --- KH001: 2 đơn giao CH2 - Hà Đông (cùng khách, khác nơi giao!) ---
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0005",
                order_code="K01/DUYET-008",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K01",
                group_note="Giao CH2 - Hà Đông",
                delivery_address="45 Quang Trung, Hà Đông, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L6",
                        ma_vt="650118020009",
                        ten_vt="Đệm bông ép vỏ chần Alias 180x200x9cm",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=6,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=2850000,
                        fallback_discount=3.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0006",
                order_code="K03/DUYET-027",
                order_date=today,
                ma_dt="KH001",
                ten_dt="Đại lý Chăn Ga Hoàng Gia",
                ma_kho="K03",
                group_note="Giao CH2 - Hà Đông",
                delivery_address="45 Quang Trung, Hà Đông, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L7",
                        ma_vt="8801180200TM",
                        ten_vt="Ga chun + 2 vỏ gối TM 180x200",
                        ma_kho="K03",
                        dvt="Bộ",
                        dvt_ban="Bộ",
                        loai_vt="1",
                        so_luong9=12,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=680000,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            # --- KH002: 2 đơn gõ hơi khác ghi chú (để test Ghép phiếu Ctrl+G) ---
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0007",
                order_code="K01/DUYET-011",
                order_date=today,
                ma_dt="KH002",
                ten_dt="Cửa hàng Nội thất Minh Tâm",
                ma_kho="K01",
                group_note="Giao kho Từ Sơn",
                delivery_address="Từ Sơn, Bắc Ninh",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L8",
                        ma_vt="601016020009",
                        ten_vt="Đệm bông ép Vimatt 160x200x9cm",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=3,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=1950000,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0008",
                order_code="K02/DUYET-022",
                order_date=today,
                ma_dt="KH002",
                ten_dt="Cửa hàng Nội thất Minh Tâm",
                ma_kho="K02",
                group_note="Giao kho Tu Son (gộp)",
                delivery_address="Từ Sơn, Bắc Ninh",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L9",
                        ma_vt="980106200220",
                        ten_vt="Ruột chăn đông 200x220",
                        ma_kho="K02",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=10,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=420000,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            # --- KH003: Khách VƯỢT HẠN MỨC CÔNG NỢ ---
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0009",
                order_code="K01/DUYET-015",
                order_date=today,
                ma_dt="KH003",
                ten_dt="Công ty TNHH Thương Mại Đại Phát",
                ma_kho="K01",
                group_note="Giao nhà xe Hải Phòng",
                delivery_address="Lê Chân, Hải Phòng",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L10",
                        ma_vt="780818020020",
                        ten_vt="Đệm Foam đa tầng I 180x200x20cm",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=8,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=5200000,
                        fallback_discount=5.0,
                    ),
                ],
            ),
            # --- KH004: Hàng Mút Loai_Vt='2' (So_Tam * He_So8) + dòng giá 0₫ ---
            TruckApprovedOrderDTO(
                source_order_key="MK_XE01_0010",
                order_code="K04/DUYET-003",
                order_date=today,
                ma_dt="KH004",
                ten_dt="Xưởng Sofa Thành Công",
                ma_kho="K04",
                group_note="Giao xưởng Mút Đông Anh",
                delivery_address="Đông Anh, Hà Nội",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L11",
                        ma_vt="MUT_T25_160",
                        ten_vt="Mút xốp T25 khổ 160x200 dày 5cm",
                        ma_kho="K04",
                        dvt="Tấm",
                        dvt_ban="m3",
                        loai_vt="2",
                        so_tam=20,
                        he_so8=0.16,
                        so_luong9=3.2,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=2400000,
                        fallback_discount=0.0,
                    ),
                    TruckOrderItemDTO(
                        source_line_id="L12",
                        ma_vt="MAU_VAI_01",
                        ten_vt="Mẫu vải thử nghiệm (chưa có giá)",
                        ma_kho="K04",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=2,
                        tk_gv="6322",
                        tk_vt="155",
                        tk_dt="5112",
                        tk_ck="521",
                        fallback_price=0,
                        fallback_discount=0.0,
                    ),
                ],
            ),
        ]

        trip2 = TruckTripSummary(
            trip_id="XE-DEMO-02",
            trip_date=today,
            ma_xe="29H88990",
            ten_xe="Xe tải 29H-889.90 (Tuyến Nam Định - Thái Bình)",
            driver_name="Trần Quốc Bảo",
            note="Chuyến chiều - 3 đơn đã duyệt",
            source_adapter=self.adapter_name,
        )
        trip2_orders = [
            TruckApprovedOrderDTO(
                source_order_key="MK_XE02_0001",
                order_code="K01/DUYET-040",
                order_date=today,
                ma_dt="KH005",
                ten_dt="Siêu thị Đệm Nam Định",
                ma_kho="K01",
                group_note="Giao cửa hàng trung tâm",
                delivery_address="TP Nam Định",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L21",
                        ma_vt="600118020009",
                        ten_vt="Đệm bông ép Alias 180x200x9cm",
                        ma_kho="K01",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=10,
                        fallback_price=2450000,
                        fallback_discount=2.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE02_0002",
                order_code="K02/DUYET-041",
                order_date=today,
                ma_dt="KH005",
                ten_dt="Siêu thị Đệm Nam Định",
                ma_kho="K02",
                group_note="Giao cửa hàng trung tâm",
                delivery_address="TP Nam Định",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L22",
                        ma_vt="920206045065",
                        ten_vt="Ruột gối Vimatt 45x65 (KM)",
                        ma_kho="K02",
                        dvt="Cái",
                        dvt_ban="Cái",
                        loai_vt="1",
                        so_luong9=10,
                        is_gift=True,
                        fallback_price=0,
                        fallback_discount=0.0,
                    ),
                ],
            ),
            TruckApprovedOrderDTO(
                source_order_key="MK_XE02_0003",
                order_code="K03/DUYET-042",
                order_date=today,
                ma_dt="KH006",
                ten_dt="Đại lý Thái Bình Home",
                ma_kho="K03",
                group_note="",
                delivery_address="TP Thái Bình",
                items=[
                    TruckOrderItemDTO(
                        source_line_id="L23",
                        ma_vt="8701160200TE",
                        ten_vt="Ga chun chần + 2 vỏ gối TE 160x200",
                        ma_kho="K03",
                        dvt="Bộ",
                        dvt_ban="Bộ",
                        loai_vt="1",
                        so_luong9=15,
                        fallback_price=850000,
                        fallback_discount=0.0,
                    ),
                ],
            ),
        ]

        return {
            trip1.trip_id: (trip1, trip1_orders),
            trip2.trip_id: (trip2, trip2_orders),
        }

    def list_trips(
        self,
        ngay_tu: Optional[str] = None,
        ngay_den: Optional[str] = None,
        ma_xe: Optional[str] = None,
        limit: int = 50,
    ) -> List[Tuple[TruckTripSummary, List[str]]]:
        data = self._build_demo_data()
        results: List[Tuple[TruckTripSummary, List[str]]] = []
        clean_xe = (ma_xe or "").strip().upper()

        for _trip_id, (summary, orders) in data.items():
            if ngay_tu and summary.trip_date < ngay_tu:
                continue
            if ngay_den and summary.trip_date > ngay_den:
                continue
            if clean_xe and clean_xe not in summary.ma_xe.upper():
                continue
            order_keys = [o.source_order_key for o in orders]
            unique_customers = {o.ma_dt.strip().upper() for o in orders if o.ma_dt}
            s = summary.model_copy(
                update={
                    "total_approved_orders": len(orders),
                    "total_customers": len(unique_customers),
                }
            )
            results.append((s, order_keys))
        return results[:limit]

    def get_trip_approved_orders(
        self, trip_id: str
    ) -> Optional[Tuple[TruckTripSummary, List[TruckApprovedOrderDTO]]]:
        data = self._build_demo_data()
        entry = data.get((trip_id or "").strip())
        if not entry:
            return None
        summary, orders = entry
        unique_customers = {o.ma_dt.strip().upper() for o in orders if o.ma_dt}
        enriched_summary = summary.model_copy(
            update={
                "total_approved_orders": len(orders),
                "total_customers": len(unique_customers),
            }
        )
        return enriched_summary, orders

    def get_mock_debt_overrides(self) -> Dict[str, dict]:
        return {
            "KH001": {
                "ten_dt": "Đại lý Chăn Ga Hoàng Gia",
                "du_cuoi": 120_000_000.0,
                "gioi_han": 300_000_000.0,
                "toi_han": 250_000_000.0,
            },
            "KH002": {
                "ten_dt": "Cửa hàng Nội thất Minh Tâm",
                "du_cuoi": 35_000_000.0,
                "gioi_han": 100_000_000.0,
                "toi_han": 80_000_000.0,
            },
            "KH003": {
                "ten_dt": "Công ty TNHH Thương Mại Đại Phát",
                "du_cuoi": 215_000_000.0,
                "gioi_han": 200_000_000.0,
                "toi_han": 180_000_000.0,
            },
            "KH004": {
                "ten_dt": "Xưởng Sofa Thành Công",
                "du_cuoi": 10_000_000.0,
                "gioi_han": 150_000_000.0,
                "toi_han": 120_000_000.0,
            },
            "KH005": {
                "ten_dt": "Siêu thị Đệm Nam Định",
                "du_cuoi": 45_000_000.0,
                "gioi_han": 200_000_000.0,
                "toi_han": 170_000_000.0,
            },
            "KH006": {
                "ten_dt": "Đại lý Thái Bình Home",
                "du_cuoi": 0.0,
                "gioi_han": 80_000_000.0,
                "toi_han": 60_000_000.0,
            },
        }
