"""Service orchestration for Truck Batch Export (Xuất nhanh cả xe hàng)."""

from datetime import date
import logging
import re
from typing import Any, Dict, List, Optional, Set
import unicodedata

from app.config import settings
from app.database import get_db_cursor
from app.repositories.debt_repo import debt_repository
from app.repositories.price_repo import price_repository
from app.repositories.truck_source import get_truck_source_adapter
from app.repositories.voucher_repo import voucher_repository
from app.schemas.debt import CustomerDebtSummary
from app.schemas.truck_batch import (
    TruckApprovedOrderDTO,
    TruckBatchCommitRequest,
    TruckBatchCommitResult,
    TruckBatchCreatedItem,
    TruckDraftItemRow,
    TruckDraftVoucher,
    TruckSourceOrderRef,
    TruckStageResponse,
    TruckTripSummary,
)
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.services.truck_batch")

_CHUNK_SIZE = 500
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_group_note(raw: Optional[str]) -> str:
    """
    Chuẩn hóa ghi chú / diễn giải dùng làm khóa gom đơn cùng khách hàng:
    - Unicode NFC
    - Cắt khoảng trắng đầu/cuối và gộp nhiều khoảng trắng liên tiếp thành 1 dấu cách
    - Không phân biệt hoa/thường (casefold), giữ dấu tiếng Việt để tránh gom nhầm từ khác nghĩa.
    """
    if not raw:
        return ""
    nfc = unicodedata.normalize("NFC", str(raw)).strip()
    collapsed = _WHITESPACE_RE.sub(" ", nfc)
    return collapsed.casefold()


class TruckBatchService:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self.voucher_repo = voucher_repository
        self.price_repo = price_repository
        self.debt_repo = debt_repository

    # ------------------------------------------------------------------ helpers
    def _fetch_exported_stt_px(self, order_keys: List[str]) -> Set[str]:
        """Kiểm tra 100% READ-ONLY những mã Stt_PX nào đã có trong VP_2014.dbo.CtBH0."""
        clean_keys = sorted({(k or "").strip() for k in order_keys if k and k.strip()})
        if not clean_keys:
            return set()

        exported: Set[str] = set()
        try:
            with get_db_cursor(self.vp_db) as cur:
                for i in range(0, len(clean_keys), _CHUNK_SIZE):
                    chunk = clean_keys[i:i + _CHUNK_SIZE]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"SELECT DISTINCT RTRIM(Stt_PX) FROM {self.vp_db}.dbo.CtBH0 WITH (NOLOCK) WHERE Stt_PX IN ({ph})",
                        chunk,
                    )
                    for row in cur.fetchall() or []:
                        if row and row[0]:
                            exported.add(str(row[0]).strip())
        except Exception as e:
            logger.warning(f"Could not query VP_2014 exported Stt_PX (falling back to empty set): {e}")
        return exported

    def _batch_fetch_customers(self, ma_dt_list: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch-enrich thông tin khách hàng từ VTSYS.dbo.DmDt (100% READ-ONLY)."""
        clean_dts = sorted({(c or "").strip().upper() for c in ma_dt_list if c and c.strip()})
        if not clean_dts:
            return {}

        result: Dict[str, Dict[str, Any]] = {}
        try:
            with get_db_cursor(self.sys_db) as cur:
                for i in range(0, len(clean_dts), _CHUNK_SIZE):
                    chunk = clean_dts[i:i + _CHUNK_SIZE]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(Ma_Dt),
                            {self.fn_uni}(ISNULL(Ten_Dt, '')),
                            {self.fn_uni}(ISNULL(Dia_Chi, '')),
                            {self.fn_uni}(ISNULL(Ong_Ba, '')),
                            RTRIM(ISNULL(Ma_Bp, '')),
                            ISNULL(Han_Tt, 0),
                            ISNULL(Gioi_Han, 0),
                            ISNULL(Toi_Han, 0)
                        FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK)
                        WHERE Ma_Dt IN ({ph})
                        """,
                        chunk,
                    )
                    for r in cur.fetchall() or []:
                        code = (r[0] or "").strip().upper()
                        if code:
                            result[code] = {
                                "ma_dt": code,
                                "ten_dt": (r[1] or "").strip(),
                                "dia_chi": (r[2] or "").strip(),
                                "ong_ba": (r[3] or "").strip(),
                                "ma_bp": (r[4] or "").strip(),
                                "han_tt": int(r[5] or 0),
                                "gioi_han": float(r[6] or 0.0),
                                "toi_han": float(r[7] or 0.0),
                            }
        except Exception as e:
            logger.warning(f"Could not batch enrich customers from DmDt: {e}")
        return result

    def _batch_fetch_products(self, ma_vt_list: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch-enrich thông tin vật tư từ VTSYS.dbo.DmVt (100% READ-ONLY)."""
        clean_vts = sorted({(v or "").strip().upper() for v in ma_vt_list if v and v.strip()})
        if not clean_vts:
            return {}

        result: Dict[str, Dict[str, Any]] = {}
        try:
            with get_db_cursor(self.sys_db) as cur:
                for i in range(0, len(clean_vts), _CHUNK_SIZE):
                    chunk = clean_vts[i:i + _CHUNK_SIZE]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(Ma_Vt),
                            {self.fn_uni}(ISNULL(Ten_Vt, '')),
                            {self.fn_uni}(ISNULL(Dvt, '')),
                            {self.fn_uni}(ISNULL(Dvt_Ban, '')),
                            ISNULL(Loai_Vt, '1'),
                            RTRIM(ISNULL(Tk_Gv, '632')),
                            RTRIM(ISNULL(Tk_Vt, '1561')),
                            RTRIM(ISNULL(Tk_Dt, '5111')),
                            RTRIM(ISNULL(Tk_Ck, '521')),
                            RTRIM(ISNULL(Tk_HBTL, ''))
                        FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
                        WHERE Ma_Vt IN ({ph})
                        """,
                        chunk,
                    )
                    for r in cur.fetchall() or []:
                        code = (r[0] or "").strip().upper()
                        if code:
                            result[code] = {
                                "ma_vt": code,
                                "ten_vt": (r[1] or "").strip(),
                                "dvt": (r[2] or "").strip(),
                                "dvt_ban": (r[3] or "").strip(),
                                "loai_vt": (r[4] or "1").strip(),
                                "tk_gv": (r[5] or "632").strip(),
                                "tk_vt": (r[6] or "1561").strip(),
                                "tk_dt": (r[7] or "5111").strip(),
                                "tk_ck": (r[8] or "521").strip(),
                                "tk_hbtl": (r[9] or "").strip(),
                            }
        except Exception as e:
            logger.warning(f"Could not batch enrich products from DmVt: {e}")
        return result

    def _build_debt_summary(
        self,
        ma_dt: str,
        mock_overrides: Optional[Dict[str, dict]] = None,
    ) -> CustomerDebtSummary:
        clean_dt = (ma_dt or "").strip().upper()
        summary = self.debt_repo.get_customer_debt_summary(clean_dt)
        # Nếu đang dùng MockAdapter và SQL chưa có bản ghi khách demo (gioi_han == 0 & ten_dt rỗng),
        # áp dụng dữ liệu công nợ mô phỏng để test đầy đủ luồng quá nợ & đổi khách.
        if mock_overrides and clean_dt in mock_overrides and summary.gioi_han <= 0 and not summary.ten_dt:
            ov = mock_overrides[clean_dt]
            du_cuoi = float(ov.get("du_cuoi", 0.0))
            gioi_han = float(ov.get("gioi_han", 0.0))
            toi_han = float(ov.get("toi_han", 0.0))
            is_over = gioi_han > 0 and du_cuoi >= gioi_han
            is_near = toi_han > 0 and du_cuoi >= toi_han and not is_over
            status_msg = (
                f"Quá giới hạn nợ! ({du_cuoi:,.0f} >= {gioi_han:,.0f})"
                if is_over
                else (
                    f"Đến hạn mức thanh toán! ({du_cuoi:,.0f} >= {toi_han:,.0f})"
                    if is_near
                    else "Trong hạn mức an toàn"
                )
            )
            return CustomerDebtSummary(
                ma_dt=clean_dt,
                ten_dt=ov.get("ten_dt", ""),
                tk="131",
                du_no=du_cuoi,
                du_co=0.0,
                du_cuoi=du_cuoi,
                du_cuoi_kiem_tra=du_cuoi,
                gioi_han=gioi_han,
                toi_han=toi_han,
                is_over_limit=is_over,
                is_near_limit=is_near,
                status_message=status_msg,
            )
        return summary

    # ------------------------------------------------------------------ public API
    def list_trips(
        self,
        ngay_tu: Optional[str] = None,
        ngay_den: Optional[str] = None,
        ma_xe: Optional[str] = None,
        adapter_name: Optional[str] = None,
        limit: int = 50,
    ) -> List[TruckTripSummary]:
        adapter = get_truck_source_adapter(adapter_name)
        raw_trips = adapter.list_trips(
            ngay_tu=ngay_tu,
            ngay_den=ngay_den,
            ma_xe=ma_xe,
            limit=limit,
        )
        all_keys: List[str] = []
        for _summary, keys in raw_trips:
            all_keys.extend(keys)

        exported_set = self._fetch_exported_stt_px(all_keys)
        results: List[TruckTripSummary] = []
        for summary, keys in raw_trips:
            exp_cnt = sum(1 for k in keys if (k or "").strip() in exported_set)
            total_cnt = len(keys)
            results.append(
                summary.model_copy(
                    update={
                        "total_approved_orders": total_cnt,
                        "exported_orders": exp_cnt,
                        "pending_orders": max(0, total_cnt - exp_cnt),
                    }
                )
            )
        return results

    def stage_trip(
        self,
        trip_id: str,
        ngay_ct: Optional[str] = None,
        adapter_name: Optional[str] = None,
    ) -> Optional[TruckStageResponse]:
        """
        Tải chuyến xe từ adapter (READ-ONLY), lọc bỏ đơn đã xuất (Stt_PX),
        áp giá batch từ BG/BG0, gom đơn mặc định theo (Ma_Dt + Ghi chú chuẩn hóa),
        và tra công nợ từng khách hàng.
        """
        adapter = get_truck_source_adapter(adapter_name)
        fetched = adapter.get_trip_approved_orders(trip_id)
        if fetched is None:
            return None

        trip_summary, all_orders = fetched
        effective_ngay_ct = (ngay_ct or "").strip() or trip_summary.trip_date or date.today().strftime("%Y-%m-%d")

        all_keys = [(o.source_order_key or "").strip() for o in all_orders if o.source_order_key]
        exported_set = self._fetch_exported_stt_px(all_keys)

        pending_orders: List[TruckApprovedOrderDTO] = []
        exported_keys: List[str] = []
        for order in all_orders:
            key = (order.source_order_key or "").strip()
            if key and key in exported_set:
                exported_keys.append(key)
            else:
                pending_orders.append(order)

        updated_trip = trip_summary.model_copy(
            update={
                "total_approved_orders": len(all_orders),
                "exported_orders": len(exported_keys),
                "pending_orders": len(pending_orders),
            }
        )

        if not pending_orders:
            return TruckStageResponse(
                trip=updated_trip,
                ngay_ct=effective_ngay_ct,
                vouchers=[],
                customer_debts={},
                already_exported_order_keys=exported_keys,
                total_pending_orders=0,
                total_exported_orders=len(exported_keys),
            )

        # 1. Batch enrich customers & products from VTSYS
        unique_dts = sorted({(o.ma_dt or "").strip().upper() for o in pending_orders if o.ma_dt})
        unique_vts = sorted({
            (it.ma_vt or "").strip().upper()
            for o in pending_orders
            for it in o.items
            if it.ma_vt
        })
        cust_map = self._batch_fetch_customers(unique_dts)
        prod_map = self._batch_fetch_products(unique_vts)

        # 2. Batch price lookup per unique customer from VP_2014.dbo.BG/BG0
        vts_by_customer: Dict[str, List[str]] = {}
        for o in pending_orders:
            cdt = (o.ma_dt or "").strip().upper()
            bucket = vts_by_customer.setdefault(cdt, [])
            for it in o.items:
                cvt = (it.ma_vt or "").strip().upper()
                if cvt and cvt not in bucket:
                    bucket.append(cvt)

        prices_by_customer: Dict[str, Dict[str, dict]] = {}
        for cdt, vt_codes in vts_by_customer.items():
            try:
                prices_by_customer[cdt] = self.price_repo.get_prices_batch(
                    ma_dt=cdt,
                    ma_vt_list=vt_codes,
                    ngay_ct=effective_ngay_ct,
                )
            except Exception as e:
                logger.warning(f"Batch price lookup failed for {cdt}: {e}")
                prices_by_customer[cdt] = {}

        # 3. Auto-grouping theo (Ma_Dt, normalize_group_note(group_note))
        groups_order: List[tuple] = []
        grouped_orders: Dict[tuple, List[TruckApprovedOrderDTO]] = {}
        for order in pending_orders:
            cdt = (order.ma_dt or "").strip().upper()
            norm_note = normalize_group_note(order.group_note)
            gkey = (cdt, norm_note)
            if gkey not in grouped_orders:
                grouped_orders[gkey] = []
                groups_order.append(gkey)
            grouped_orders[gkey].append(order)

        draft_vouchers: List[TruckDraftVoucher] = []
        for idx, gkey in enumerate(groups_order):
            cdt, norm_note = gkey
            orders_in_group = grouped_orders[gkey]
            first_order = orders_in_group[0]
            cust_info = cust_map.get(cdt, {})
            price_map = prices_by_customer.get(cdt, {})

            ten_dt = cust_info.get("ten_dt") or first_order.ten_dt or ""
            ong_ba = (cust_info.get("ong_ba") or ten_dt)[:64]
            raw_addr = (first_order.delivery_address or cust_info.get("dia_chi") or "").strip()
            dia_chi = raw_addr[:64]
            raw_dg = (first_order.group_note or "").strip()
            dien_giai0 = (raw_dg if raw_dg else "Mua hàng")[:128]
            ma_ct = (first_order.ma_ct or "X1").strip().upper()
            is_return = ma_ct == "N5"

            source_refs: List[TruckSourceOrderRef] = []
            draft_rows: List[TruckDraftItemRow] = []

            for ord_dto in orders_in_group:
                order_key = (ord_dto.source_order_key or "").strip()
                order_qty_sum = 0.0
                for it in ord_dto.items:
                    cvt = (it.ma_vt or "").strip().upper()
                    pinfo = prod_map.get(cvt, {})
                    loai_vt = (pinfo.get("loai_vt") or it.loai_vt or "1").strip()
                    so_tam = float(it.so_tam or 0.0)
                    he_so8 = float(it.he_so8 if it.he_so8 and it.he_so8 > 0 else 1.0)
                    he_so9 = 1.0
                    raw_sl9 = float(it.so_luong9 or 0.0)

                    if loai_vt in ("2", "4") and so_tam > 0:
                        so_luong_ban = round_amount(so_tam * he_so8, 2)
                        so_luong8 = so_luong_ban
                        so_luong9 = so_luong_ban
                        so_luong = so_luong_ban
                    elif so_tam > 0:
                        so_luong_ban = round_amount(so_tam * he_so8, 2)
                        so_luong8 = so_luong_ban
                        so_luong9 = so_luong_ban
                        so_luong = round_amount(so_luong_ban * he_so9, 2)
                    else:
                        so_luong_ban = raw_sl9
                        so_tam = round_amount(raw_sl9 / he_so8, 2) if he_so8 > 0 else raw_sl9
                        so_luong8 = so_luong_ban
                        so_luong9 = so_luong_ban
                        so_luong = round_amount(so_luong_ban * he_so9, 2) if loai_vt == "1" else so_luong_ban

                    order_qty_sum += so_luong9

                    picked = price_map.get(cvt)
                    if picked is not None:
                        gia_nt9 = float(picked.get("gia") or 0.0)
                        chiet_khau = float(picked.get("chiet_khau") or 0.0)
                    else:
                        gia_nt9 = float(it.fallback_price) if it.fallback_price is not None else 0.0
                        chiet_khau = float(it.fallback_discount) if it.fallback_discount is not None else 0.0

                    # Hàng quà tặng được đánh dấu sẵn từ kho: giữ giá 0₫/1₫ nếu chưa có giá đặc thù
                    if it.is_gift and picked is None and it.fallback_price is None:
                        gia_nt9 = 0.0
                        chiet_khau = 0.0

                    # Fix #17: hàng KM giá 1-10 VND -> chiết khấu = 0
                    if 1 <= gia_nt9 <= 10:
                        chiet_khau = 0.0

                    tien_nt9 = float(round_vnd(so_luong_ban * gia_nt9))
                    gia9 = float(round_vnd(gia_nt9))
                    tien9 = tien_nt9

                    if chiet_khau > 0:
                        tien_nt4 = float(round_vnd(tien_nt9 * chiet_khau / 100.0))
                        tien4 = tien_nt4
                        tien_nt2 = float(round_vnd(tien_nt9 - tien_nt4))
                        tien2 = tien_nt2
                        gia_nt2 = round_amount(gia_nt9 * (100.0 - chiet_khau) / 100.0, 2)
                        gia2 = float(round_vnd(gia9 * (100.0 - chiet_khau) / 100.0))
                    else:
                        tien_nt4 = 0.0
                        tien4 = 0.0
                        tien_nt2 = tien_nt9
                        tien2 = tien9
                        gia_nt2 = gia_nt9
                        gia2 = gia9

                    tk_gv = pinfo.get("tk_gv") or it.tk_gv or "632"
                    tk_vt = pinfo.get("tk_vt") or it.tk_vt or "1561"
                    tk_dt = pinfo.get("tk_dt") or it.tk_dt or "5111"
                    tk_ck = pinfo.get("tk_ck") or it.tk_ck or "521"
                    tk_hbtl = pinfo.get("tk_hbtl") or it.tk_hbtl or "5212"

                    dvt = pinfo.get("dvt") or it.dvt or ""
                    dvt_ban = pinfo.get("dvt_ban") or it.dvt_ban or dvt

                    draft_rows.append(
                        TruckDraftItemRow(
                            stt_px=order_key,
                            stt0_px=it.source_line_id or None,
                            stt0=None,
                            stt=None,
                            tk=tk_vt if is_return else tk_gv,
                            tk_du=tk_gv if is_return else tk_vt,
                            tk_du2=tk_hbtl if is_return else tk_dt,
                            tk_du4=tk_ck,
                            ma_kho=(it.ma_kho or ord_dto.ma_kho or "").strip(),
                            ma_vt=cvt,
                            ten_vt=pinfo.get("ten_vt") or it.ten_vt or "",
                            dvt=dvt,
                            dvt_ban=dvt_ban,
                            so_tam=so_tam,
                            he_so8=he_so8,
                            so_luong8=so_luong8,
                            he_so9=he_so9,
                            so_luong9=so_luong9,
                            so_luong=so_luong,
                            gia_nt9=gia_nt9,
                            gia9=gia9,
                            tien_nt9=tien_nt9,
                            tien9=tien9,
                            gia_nt=0.0,
                            gia=0.0,
                            tien_nt=0.0,
                            tien=0.0,
                            gia_nt2=gia_nt2,
                            gia2=gia2,
                            tien_nt2=tien_nt2,
                            tien2=tien2,
                            tien_nt3=0.0,
                            tien3=0.0,
                            chiet_khau=chiet_khau,
                            tien_nt4=tien_nt4,
                            tien4=tien4,
                            gia_tb_tt="K" if is_return else "C",
                            loai_vt=loai_vt,
                            source_order_key=order_key,
                            source_order_code=ord_dto.order_code,
                            source_group_note=ord_dto.group_note,
                            is_gift=it.is_gift,
                        )
                    )

                source_refs.append(
                    TruckSourceOrderRef(
                        source_order_key=order_key,
                        order_code=ord_dto.order_code,
                        order_date=ord_dto.order_date,
                        ma_kho=(ord_dto.ma_kho or (ord_dto.items[0].ma_kho if ord_dto.items else "")).strip(),
                        group_note=ord_dto.group_note,
                        item_count=len(ord_dto.items),
                        total_qty=round_amount(order_qty_sum, 2),
                    )
                )

            ttien_nt9 = float(round_vnd(sum(r.tien_nt9 for r in draft_rows)))
            ttien_nt4 = float(round_vnd(sum(r.tien_nt4 for r in draft_rows)))
            ttien_nt2 = float(round_vnd(sum(r.tien_nt2 for r in draft_rows)))
            ttien_nt0 = ttien_nt2

            draft_vouchers.append(
                TruckDraftVoucher(
                    draft_id=f"DRAFT-{idx + 1:03d}",
                    ma_ct=ma_ct,
                    ngay_ct=effective_ngay_ct,
                    ma_xe=updated_trip.ma_xe if not updated_trip.ma_xe.startswith("(") else "",
                    ten_xe=updated_trip.ten_xe,
                    ma_dt=cdt,
                    ten_dt=ten_dt,
                    ong_ba=ong_ba,
                    dia_chi=dia_chi,
                    ma_bp=cust_info.get("ma_bp", ""),
                    han_tt=int(cust_info.get("han_tt", 0)),
                    ma_nx="131",
                    tk2="1311",
                    ma_tte="VND",
                    ty_gia=1.0,
                    dien_giai0=dien_giai0,
                    normalized_group_note=norm_note,
                    source_orders=source_refs,
                    items=draft_rows,
                    ttien_nt9=ttien_nt9,
                    ttien_nt4=ttien_nt4,
                    ttien_nt2=ttien_nt2,
                    ttien_nt0=ttien_nt0,
                    ttien0=ttien_nt0,
                    skip_debt_check=False,
                )
            )

        # 4. Tra công nợ hiện tại cho tất cả khách hàng duy nhất trên xe
        mock_overrides = adapter.get_mock_debt_overrides()
        customer_debts: Dict[str, CustomerDebtSummary] = {
            cdt: self._build_debt_summary(cdt, mock_overrides)
            for cdt in unique_dts
        }

        return TruckStageResponse(
            trip=updated_trip,
            ngay_ct=effective_ngay_ct,
            vouchers=draft_vouchers,
            customer_debts=customer_debts,
            already_exported_order_keys=exported_keys,
            total_pending_orders=len(pending_orders),
            total_exported_orders=len(exported_keys),
        )

    def lookup_customer_debt(
        self, ma_dt: str, adapter_name: Optional[str] = None
    ) -> CustomerDebtSummary:
        adapter = get_truck_source_adapter(adapter_name)
        return self._build_debt_summary(ma_dt, adapter.get_mock_debt_overrides())

    def reprice_for_customer(
        self, ma_dt: str, ngay_ct: str, ma_vt_list: List[str]
    ) -> Dict[str, dict]:
        """Nút phụ: chỉ gọi khi kế toán CHỦ ĐỘNG muốn nạp lại giá theo khách mới."""
        clean_dt = (ma_dt or "").strip().upper()
        clean_vts = sorted({(v or "").strip().upper() for v in ma_vt_list if v and v.strip()})
        if not clean_dt or not clean_vts:
            return {}
        return self.price_repo.get_prices_batch(
            ma_dt=clean_dt,
            ma_vt_list=clean_vts,
            ngay_ct=ngay_ct,
        )

    def commit_batch(self, req: TruckBatchCommitRequest) -> TruckBatchCommitResult:
        """Lưu toàn bộ các phiếu đã chọn trong 1 ACID Transaction duy nhất (All-or-Nothing)."""
        user_name = (req.user_name or "KTCN3").strip() or "KTCN3"
        draft_ids = [v.draft_id for v in req.vouchers]
        saved = self.voucher_repo.save_vouchers_batch(
            vouchers=req.vouchers,
            user_name=user_name,
            draft_ids=draft_ids,
        )

        created_items: List[TruckBatchCreatedItem] = []
        total_items = 0
        total_amount = 0.0

        for src, res in zip(req.vouchers, saved):
            n_items = len(src.items)
            amt = float(src.ttien0 or 0.0)
            total_items += n_items
            total_amount += amt
            created_items.append(
                TruckBatchCreatedItem(
                    stt=res.stt,
                    so_ct=res.so_ct,
                    message=res.message,
                    draft_id=src.draft_id,
                    ma_dt=src.ma_dt,
                    ten_dt=src.ong_ba or "",
                    ttien0=amt,
                    item_count=n_items,
                    source_order_keys=src.source_order_keys,
                )
            )

        so_ct_range = (
            f"{created_items[0].so_ct} – {created_items[-1].so_ct}"
            if len(created_items) > 1
            else (created_items[0].so_ct if created_items else "")
        )
        return TruckBatchCommitResult(
            trip_id=req.trip_id,
            created_vouchers=created_items,
            total_vouchers=len(created_items),
            total_items=total_items,
            total_amount=round_amount(total_amount, 0),
            message=f"Đã xuất thành công {len(created_items)} chứng từ ({so_ct_range}) cho chuyến xe {req.trip_id}.",
        )


truck_batch_service = TruckBatchService()
