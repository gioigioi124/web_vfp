"""Kh2014TruckAdapter: Gom các phiếu xuất kho KH_2014 đã duyệt theo (Ngay_Ct, Ma_Xe).

Cho phép chạy thử toàn bộ luồng Bàn soát nhanh cả xe trên dữ liệu SQL thật (`KH_2014`)
ngay trong giai đoạn DB xe hàng riêng chưa hoàn thiện.
100% READ-ONLY (SELECT ... WITH (NOLOCK)).
"""

import logging
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.database import get_db_cursor
from app.repositories.truck_source.base import TruckSourceAdapter
from app.schemas.truck_batch import (
    TruckApprovedOrderDTO,
    TruckOrderItemDTO,
    TruckTripSummary,
)

logger = logging.getLogger("app.repositories.truck_source.kh2014")

_TRIP_PREFIX = "KH|"


def _make_trip_id(ngay_ct: str, ma_xe: str) -> str:
    return f"{_TRIP_PREFIX}{ngay_ct}|{ma_xe or 'NO_XE'}"


def _parse_trip_id(trip_id: str) -> Optional[Tuple[str, str]]:
    if not trip_id or not trip_id.startswith(_TRIP_PREFIX):
        return None
    parts = trip_id[len(_TRIP_PREFIX):].split("|", 1)
    if len(parts) != 2 or not parts[0]:
        return None
    return parts[0].strip(), ("" if parts[1] == "NO_XE" else parts[1].strip())


class Kh2014TruckAdapter(TruckSourceAdapter):
    adapter_name = "kh2014"

    def __init__(self):
        self.kh_db = settings.DB_KH
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

    def list_trips(
        self,
        ngay_tu: Optional[str] = None,
        ngay_den: Optional[str] = None,
        ma_xe: Optional[str] = None,
        limit: int = 50,
    ) -> List[Tuple[TruckTripSummary, List[str]]]:
        where = ["h.Confirmed = 1", "h.Ma_Ct = 'X1'"]
        params: List[object] = []
        if ngay_tu:
            where.append("h.Ngay_Ct >= ?")
            params.append(ngay_tu)
        if ngay_den:
            where.append("h.Ngay_Ct <= ?")
            params.append(ngay_den)
        if ma_xe and ma_xe.strip():
            where.append("RTRIM(ISNULL(h.Ma_Xe, '')) = ?")
            params.append(ma_xe.strip().upper())

        where_sql = " AND ".join(where)
        sql = f"""
            SELECT TOP (2000)
                CONVERT(varchar(10), h.Ngay_Ct, 23) AS Ngay_Ct,
                RTRIM(ISNULL(h.Ma_Xe, '')) AS Ma_Xe,
                {self.fn_uni}(ISNULL(x.Ten_Xe, '')) AS Ten_Xe,
                RTRIM(h.Stt) AS Stt,
                RTRIM(h.Ma_Dt) AS Ma_Dt
            FROM {self.kh_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            WHERE {where_sql}
              AND EXISTS (SELECT 1 FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK) WHERE d.Stt = h.Stt)
            ORDER BY h.Ngay_Ct DESC, h.Ma_Xe ASC, h.So_Ct ASC
        """

        grouped: Dict[str, dict] = {}
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, params)
                for r in cur.fetchall():
                    ngay = (r[0] or "").strip()
                    xe = (r[1] or "").strip()
                    ten_xe = (r[2] or "").strip()
                    stt = (r[3] or "").strip()
                    ma_dt = (r[4] or "").strip().upper()
                    tid = _make_trip_id(ngay, xe)
                    bucket = grouped.get(tid)
                    if bucket is None:
                        bucket = {
                            "summary": TruckTripSummary(
                                trip_id=tid,
                                trip_date=ngay,
                                ma_xe=xe or "(Chưa gắn xe)",
                                ten_xe=ten_xe or (f"Xe {xe}" if xe else "Phiếu kho chưa gắn mã xe"),
                                source_adapter=self.adapter_name,
                            ),
                            "stts": [],
                            "customers": set(),
                        }
                        grouped[tid] = bucket
                    bucket["stts"].append(stt)
                    if ma_dt:
                        bucket["customers"].add(ma_dt)
        except Exception as e:
            logger.error(f"Kh2014TruckAdapter.list_trips error: {e}")
            return []

        out: List[Tuple[TruckTripSummary, List[str]]] = []
        for bucket in list(grouped.values())[:limit]:
            s = bucket["summary"].model_copy(
                update={
                    "total_approved_orders": len(bucket["stts"]),
                    "total_customers": len(bucket["customers"]),
                }
            )
            out.append((s, bucket["stts"]))
        return out

    def get_trip_approved_orders(
        self, trip_id: str
    ) -> Optional[Tuple[TruckTripSummary, List[TruckApprovedOrderDTO]]]:
        parsed = _parse_trip_id(trip_id)
        if not parsed:
            return None
        ngay_ct, ma_xe = parsed

        where_xe = "RTRIM(ISNULL(h.Ma_Xe, '')) = ?"
        header_sql = f"""
            SELECT
                RTRIM(h.Stt) AS Stt,
                RTRIM(ISNULL(h.So_Ct, '')) AS So_Ct,
                CONVERT(varchar(10), h.Ngay_Ct, 23) AS Ngay_Ct,
                RTRIM(h.Ma_Dt) AS Ma_Dt,
                {self.fn_uni}(ISNULL(c.Ten_Dt, '')) AS Ten_Dt,
                {self.fn_uni}(ISNULL(h.Dien_Giai0, '')) AS Dien_Giai0,
                {self.fn_uni}(ISNULL(h.Dia_Chi, '')) AS Dia_Chi,
                RTRIM(ISNULL(h.Ma_Ct, 'X1')) AS Ma_Ct,
                {self.fn_uni}(ISNULL(x.Ten_Xe, '')) AS Ten_Xe
            FROM {self.kh_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            WHERE h.Confirmed = 1
              AND h.Ma_Ct = 'X1'
              AND CONVERT(varchar(10), h.Ngay_Ct, 23) = ?
              AND {where_xe}
              AND EXISTS (SELECT 1 FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK) WHERE d.Stt = h.Stt)
            ORDER BY h.So_Ct ASC, h.Stt ASC
        """

        orders_by_stt: Dict[str, TruckApprovedOrderDTO] = {}
        order_list: List[TruckApprovedOrderDTO] = []
        ten_xe = ""

        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(header_sql, [ngay_ct, ma_xe])
                rows = cur.fetchall()
                if not rows:
                    return None
                for r in rows:
                    stt = (r[0] or "").strip()
                    if not ten_xe and r[8]:
                        ten_xe = (r[8] or "").strip()
                    dto = TruckApprovedOrderDTO(
                        source_order_key=stt,
                        order_code=(r[1] or stt).strip(),
                        order_date=(r[2] or ngay_ct).strip(),
                        ma_dt=(r[3] or "").strip().upper(),
                        ten_dt=(r[4] or "").strip(),
                        group_note=(r[5] or "").strip(),
                        delivery_address=(r[6] or "").strip(),
                        ma_ct=(r[7] or "X1").strip().upper(),
                        items=[],
                    )
                    orders_by_stt[stt] = dto
                    order_list.append(dto)

                stts = list(orders_by_stt.keys())
                for i in range(0, len(stts), 500):
                    chunk = stts[i:i + 500]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(d.Stt0), RTRIM(d.Stt), RTRIM(d.Ma_Vt),
                            {self.fn_uni}(ISNULL(d.Dvt, '')),
                            {self.fn_uni}(ISNULL(d.Dvt_Ban, '')),
                            RTRIM(ISNULL(d.Ma_Kho, '')),
                            ISNULL(d.So_Tam, 0),
                            ISNULL(d.He_So8, 1),
                            ISNULL(d.So_Luong9, 0),
                            {self.fn_uni}(ISNULL(v.Ten_Vt, '')),
                            ISNULL(v.Loai_Vt, '1'),
                            RTRIM(ISNULL(v.Tk_Gv, '632')),
                            RTRIM(ISNULL(v.Tk_Vt, '1561')),
                            RTRIM(ISNULL(v.Tk_Dt, '5111')),
                            RTRIM(ISNULL(v.Tk_Ck, '521')),
                            RTRIM(ISNULL(v.Tk_HBTL, ''))
                        FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK)
                        LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
                        WHERE d.Stt IN ({ph})
                        ORDER BY d.Stt, d.Stt0
                        """,
                        chunk,
                    )
                    for dr in cur.fetchall():
                        parent = orders_by_stt.get((dr[1] or "").strip())
                        if parent is None:
                            continue
                        kho = (dr[5] or "").strip()
                        if not parent.ma_kho and kho:
                            parent.ma_kho = kho
                        parent.items.append(
                            TruckOrderItemDTO(
                                source_line_id=(dr[0] or "").strip(),
                                ma_vt=(dr[2] or "").strip(),
                                dvt=(dr[3] or "").strip(),
                                dvt_ban=(dr[4] or "").strip(),
                                ma_kho=kho,
                                so_tam=float(dr[6] or 0.0),
                                he_so8=float(dr[7] or 1.0),
                                so_luong9=float(dr[8] or 0.0),
                                ten_vt=(dr[9] or "").strip(),
                                loai_vt=(dr[10] or "1").strip(),
                                tk_gv=(dr[11] or "632").strip(),
                                tk_vt=(dr[12] or "1561").strip(),
                                tk_dt=(dr[13] or "5111").strip(),
                                tk_ck=(dr[14] or "521").strip(),
                                tk_hbtl=(dr[15] or "").strip(),
                            )
                        )
        except Exception as e:
            logger.error(f"Kh2014TruckAdapter.get_trip_approved_orders error: {e}")
            return None

        unique_customers = {o.ma_dt for o in order_list if o.ma_dt}
        summary = TruckTripSummary(
            trip_id=trip_id,
            trip_date=ngay_ct,
            ma_xe=ma_xe or "(Chưa gắn xe)",
            ten_xe=ten_xe or (f"Xe {ma_xe}" if ma_xe else "Phiếu kho chưa gắn mã xe"),
            source_adapter=self.adapter_name,
            total_approved_orders=len(order_list),
            total_customers=len(unique_customers),
        )
        return summary, order_list
