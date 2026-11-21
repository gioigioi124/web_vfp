"""Repository for Inventory Reports: Summary NXT (vcd01) and Stock Card (vct01) from CdNTXT + SoCaiVT."""

from __future__ import annotations

from datetime import date
import logging
from typing import Any, List, Optional

from app.config import settings
from app.database import get_db_cursor
from app.schemas.inventory_report import (
    InventorySummaryResponse,
    InventorySummaryRow,
    StockCardEntry,
    StockCardResponse,
)
from app.utils.errors import SqlUnavailableError, is_sql_connection_error

logger = logging.getLogger("app.repositories.inventory_report")


def _escape_like(val: str) -> str:
    return (
        str(val)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
        .replace("[", "\\[")
    )


class InventoryReportRepository:
    def __init__(self) -> None:
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

    def get_inventory_summary(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        ma_kho: Optional[str] = None,
        q: Optional[str] = None,
        include_zero: bool = False,
        page: int = 1,
        page_size: int = 100,
    ) -> InventorySummaryResponse:
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_kho = (ma_kho or "").strip().upper()
        clean_q = (q or "").strip()
        safe_page = max(1, int(page))
        safe_size = max(1, min(500, int(page_size)))

        kho_filter = " AND a.Ma_Kho = ?" if clean_kho else ""
        q_filter = ""
        filter_params: List[Any] = [clean_kho] if clean_kho else []
        if clean_q:
            esc = f"%{_escape_like(clean_q.upper())}%"
            esc_uni = f"%{_escape_like(clean_q)}%"
            q_filter = (
                f" AND (UPPER(RTRIM(a.Ma_Vt)) LIKE ? ESCAPE '\\' "
                f"OR {self.fn_uni}(ISNULL(v.Ten_Vt, '')) LIKE ? ESCAPE '\\')"
            )
            filter_params.extend([esc, esc_uni])

        zero_filter = (
            ""
            if include_zero
            else (
                " AND (ABS(a.Ton_Dau) > 0.0001 OR ABS(a.Sl_Nhap) > 0.0001 "
                "OR ABS(a.Sl_Xuat) > 0.0001 OR ABS(a.Tien_Dau) > 0.01 "
                "OR ABS(a.Tien_Nhap) > 0.01 OR ABS(a.Tien_Xuat) > 0.01)"
            )
        )

        # Movements CTE handles:
        # 1) CdNTXT opening balances
        # 2) SoCaiVT regular receipt (Nh_Ct='1' & no Ma_KhoN) -> +Ma_Kho
        # 3) SoCaiVT regular issue   (Nh_Ct='2' & no Ma_KhoN) -> -Ma_Kho
        # 4) SoCaiVT transfer        (Ma_KhoN <> '')           -> -Ma_Kho AND +Ma_KhoN
        sql = f"""
            ;WITH Movements AS (
                SELECT
                    RTRIM(ISNULL(Ma_Kho, '')) AS Ma_Kho,
                    RTRIM(ISNULL(Ma_Vt, '')) AS Ma_Vt,
                    ISNULL(So_Luong, 0) AS Ton_Dau,
                    ISNULL(Tien, 0) AS Tien_Dau,
                    CAST(0 AS float) AS Sl_Nhap,
                    CAST(0 AS float) AS Tien_Nhap,
                    CAST(0 AS float) AS Sl_Xuat,
                    CAST(0 AS float) AS Tien_Xuat
                FROM {self.vp_db}.dbo.CdNTXT WITH (NOLOCK)
                WHERE ISNULL(Ma_Vt, '') <> ''

                UNION ALL

                SELECT
                    RTRIM(ISNULL(Ma_Kho, '')) AS Ma_Kho,
                    RTRIM(ISNULL(Ma_Vt, '')) AS Ma_Vt,
                    CASE
                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN -ISNULL(So_Luong, 0)
                        WHEN RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(So_Luong, 0)
                        ELSE -ISNULL(So_Luong, 0)
                    END AS Ton_Dau,
                    CASE
                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN -ISNULL(Tien, 0)
                        WHEN RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(Tien, 0)
                        ELSE -ISNULL(Tien, 0)
                    END AS Tien_Dau,
                    0, 0, 0, 0
                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                WHERE Ngay_Ct < ? AND ISNULL(Ma_Vt, '') <> ''

                UNION ALL

                SELECT
                    RTRIM(Ma_KhoN) AS Ma_Kho,
                    RTRIM(ISNULL(Ma_Vt, '')) AS Ma_Vt,
                    ISNULL(So_Luong, 0) AS Ton_Dau,
                    ISNULL(Tien, 0) AS Tien_Dau,
                    0, 0, 0, 0
                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                WHERE Ngay_Ct < ? AND RTRIM(ISNULL(Ma_KhoN, '')) <> '' AND ISNULL(Ma_Vt, '') <> ''

                UNION ALL

                SELECT
                    RTRIM(ISNULL(Ma_Kho, '')) AS Ma_Kho,
                    RTRIM(ISNULL(Ma_Vt, '')) AS Ma_Vt,
                    0, 0,
                    CASE WHEN RTRIM(ISNULL(Ma_KhoN, '')) = '' AND RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(So_Luong, 0) ELSE 0 END AS Sl_Nhap,
                    CASE WHEN RTRIM(ISNULL(Ma_KhoN, '')) = '' AND RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(Tien, 0) ELSE 0 END AS Tien_Nhap,
                    CASE WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' OR RTRIM(ISNULL(Nh_Ct, '1')) = '2' THEN ISNULL(So_Luong, 0) ELSE 0 END AS Sl_Xuat,
                    CASE WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' OR RTRIM(ISNULL(Nh_Ct, '1')) = '2' THEN ISNULL(Tien, 0) ELSE 0 END AS Tien_Xuat
                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                WHERE Ngay_Ct >= ? AND Ngay_Ct <= ? AND ISNULL(Ma_Vt, '') <> ''

                UNION ALL

                SELECT
                    RTRIM(Ma_KhoN) AS Ma_Kho,
                    RTRIM(ISNULL(Ma_Vt, '')) AS Ma_Vt,
                    0, 0,
                    ISNULL(So_Luong, 0) AS Sl_Nhap,
                    ISNULL(Tien, 0) AS Tien_Nhap,
                    0, 0
                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                WHERE Ngay_Ct >= ? AND Ngay_Ct <= ? AND RTRIM(ISNULL(Ma_KhoN, '')) <> '' AND ISNULL(Ma_Vt, '') <> ''
            ),
            Agg AS (
                SELECT
                    Ma_Kho,
                    Ma_Vt,
                    SUM(Ton_Dau) AS Ton_Dau,
                    SUM(Tien_Dau) AS Tien_Dau,
                    SUM(Sl_Nhap) AS Sl_Nhap,
                    SUM(Tien_Nhap) AS Tien_Nhap,
                    SUM(Sl_Xuat) AS Sl_Xuat,
                    SUM(Tien_Xuat) AS Tien_Xuat
                FROM Movements
                GROUP BY Ma_Kho, Ma_Vt
            )
            SELECT
                a.Ma_Kho,
                {self.fn_uni}(ISNULL(k.Ten_Kho, '')),
                a.Ma_Vt,
                {self.fn_uni}(ISNULL(v.Ten_Vt, '')),
                {self.fn_uni}(ISNULL(v.Dvt, '')),
                a.Ton_Dau, a.Tien_Dau,
                a.Sl_Nhap, a.Tien_Nhap,
                a.Sl_Xuat, a.Tien_Xuat
            FROM Agg a
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON RTRIM(v.Ma_Vt) = a.Ma_Vt
            LEFT JOIN {self.sys_db}.dbo.DmKho k WITH (NOLOCK) ON RTRIM(k.Ma_Kho) = a.Ma_Kho
            WHERE 1=1 {kho_filter} {q_filter} {zero_filter}
            ORDER BY a.Ma_Kho ASC, a.Ma_Vt ASC
        """

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(sql, [d1, d1, d1, d2, d1, d2, *filter_params])
                all_rows: List[InventorySummaryRow] = []
                s_td = s_tnd = s_sn = s_tn = s_sx = s_tx = s_tc = s_tnc = 0.0

                for r in cur.fetchall():
                    ton_dau = float(r[5] or 0.0)
                    tien_dau = float(r[6] or 0.0)
                    sl_nhap = float(r[7] or 0.0)
                    tien_nhap = float(r[8] or 0.0)
                    sl_xuat = float(r[9] or 0.0)
                    tien_xuat = float(r[10] or 0.0)
                    ton_cuoi = ton_dau + sl_nhap - sl_xuat
                    tien_cuoi = tien_dau + tien_nhap - tien_xuat

                    s_td += ton_dau
                    s_tnd += tien_dau
                    s_sn += sl_nhap
                    s_tn += tien_nhap
                    s_sx += sl_xuat
                    s_tx += tien_xuat
                    s_tc += ton_cuoi
                    s_tnc += tien_cuoi

                    all_rows.append(
                        InventorySummaryRow(
                            ma_kho=(r[0] or "").strip(),
                            ten_kho=(r[1] or "").strip(),
                            ma_vt=(r[2] or "").strip(),
                            ten_vt=(r[3] or "").strip(),
                            dvt=(r[4] or "").strip(),
                            ton_dau=ton_dau,
                            tien_dau=tien_dau,
                            sl_nhap=sl_nhap,
                            tien_nhap=tien_nhap,
                            sl_xuat=sl_xuat,
                            tien_xuat=tien_xuat,
                            ton_cuoi=ton_cuoi,
                            tien_cuoi=tien_cuoi,
                        )
                    )

                total = len(all_rows)
                off = (safe_page - 1) * safe_size
                return InventorySummaryResponse(
                    from_date=d1,
                    to_date=d2,
                    ma_kho=clean_kho,
                    items=all_rows[off : off + safe_size],
                    total_records=total,
                    page=safe_page,
                    page_size=safe_size,
                    total_pages=max(1, (total + safe_size - 1) // safe_size),
                    sum_ton_dau=s_td,
                    sum_tien_dau=s_tnd,
                    sum_sl_nhap=s_sn,
                    sum_tien_nhap=s_tn,
                    sum_sl_xuat=s_sx,
                    sum_tien_xuat=s_tx,
                    sum_ton_cuoi=s_tc,
                    sum_tien_cuoi=s_tnc,
                )
        except Exception as exc:
            if is_sql_connection_error(exc):
                raise SqlUnavailableError() from exc
            raise

    def get_stock_card(
        self,
        ma_vt: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        ma_kho: Optional[str] = None,
    ) -> StockCardResponse:
        clean_vt = (ma_vt or "").strip().upper()
        clean_kho = (ma_kho or "").strip().upper()
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]

        if not clean_vt:
            return StockCardResponse(from_date=d1, to_date=d2, ma_vt="")

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT TOP 1 {self.fn_uni}(ISNULL(Ten_Vt, '')), {self.fn_uni}(ISNULL(Dvt, '')) "
                    f"FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK) WHERE RTRIM(Ma_Vt) = ?",
                    [clean_vt],
                )
                vr = cur.fetchone()
                ten_vt = (vr[0] or "").strip() if vr else ""
                dvt = (vr[1] or "").strip() if vr else ""

                ten_kho = ""
                if clean_kho:
                    cur.execute(
                        f"SELECT TOP 1 {self.fn_uni}(ISNULL(Ten_Kho, '')) "
                        f"FROM {self.sys_db}.dbo.DmKho WITH (NOLOCK) WHERE RTRIM(Ma_Kho) = ?",
                        [clean_kho],
                    )
                    kr = cur.fetchone()
                    ten_kho = (kr[0] or "").strip() if kr else ""

                kho_cond_cd = " AND RTRIM(Ma_Kho) = ?" if clean_kho else ""
                kho_cond_sc = " AND (RTRIM(Ma_Kho) = ? OR RTRIM(ISNULL(Ma_KhoN, '')) = ?)" if clean_kho else ""
                open_params: List[Any] = [clean_vt]
                if clean_kho:
                    open_params.append(clean_kho)
                open_params.extend([clean_vt, d1])
                if clean_kho:
                    open_params.extend([clean_kho, clean_kho])

                if clean_kho:
                    # Exact warehouse movement formula
                    open_sql = f"""
                        SELECT
                            ISNULL((SELECT SUM(ISNULL(So_Luong, 0)) FROM {self.vp_db}.dbo.CdNTXT WITH (NOLOCK) WHERE RTRIM(Ma_Vt) = ? {kho_cond_cd}), 0)
                            + ISNULL((
                                SELECT SUM(
                                    CASE
                                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) = ? AND RTRIM(Ma_Kho) <> ? THEN ISNULL(So_Luong, 0)
                                        WHEN RTRIM(Ma_Kho) = ? AND RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN -ISNULL(So_Luong, 0)
                                        WHEN RTRIM(Ma_Kho) = ? AND RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(So_Luong, 0)
                                        WHEN RTRIM(Ma_Kho) = ? THEN -ISNULL(So_Luong, 0)
                                        ELSE 0
                                    END
                                )
                                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                                WHERE RTRIM(Ma_Vt) = ? AND Ngay_Ct < ? {kho_cond_sc}
                            ), 0),
                            ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.CdNTXT WITH (NOLOCK) WHERE RTRIM(Ma_Vt) = ? {kho_cond_cd}), 0)
                            + ISNULL((
                                SELECT SUM(
                                    CASE
                                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) = ? AND RTRIM(Ma_Kho) <> ? THEN ISNULL(Tien, 0)
                                        WHEN RTRIM(Ma_Kho) = ? AND RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN -ISNULL(Tien, 0)
                                        WHEN RTRIM(Ma_Kho) = ? AND RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(Tien, 0)
                                        WHEN RTRIM(Ma_Kho) = ? THEN -ISNULL(Tien, 0)
                                        ELSE 0
                                    END
                                )
                                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                                WHERE RTRIM(Ma_Vt) = ? AND Ngay_Ct < ? {kho_cond_sc}
                            ), 0)
                    """
                    p_open = [
                        clean_vt, clean_kho,
                        clean_kho, clean_kho, clean_kho, clean_kho, clean_kho, clean_vt, d1, clean_kho, clean_kho,
                        clean_vt, clean_kho,
                        clean_kho, clean_kho, clean_kho, clean_kho, clean_kho, clean_vt, d1, clean_kho, clean_kho,
                    ]
                else:
                    # All warehouses combined: internal transfers cancel out (net = 0)
                    open_sql = f"""
                        SELECT
                            ISNULL((SELECT SUM(ISNULL(So_Luong, 0)) FROM {self.vp_db}.dbo.CdNTXT WITH (NOLOCK) WHERE RTRIM(Ma_Vt) = ?), 0)
                            + ISNULL((
                                SELECT SUM(
                                    CASE
                                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN 0
                                        WHEN RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(So_Luong, 0)
                                        ELSE -ISNULL(So_Luong, 0)
                                    END
                                )
                                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                                WHERE RTRIM(Ma_Vt) = ? AND Ngay_Ct < ?
                            ), 0),
                            ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.CdNTXT WITH (NOLOCK) WHERE RTRIM(Ma_Vt) = ?), 0)
                            + ISNULL((
                                SELECT SUM(
                                    CASE
                                        WHEN RTRIM(ISNULL(Ma_KhoN, '')) <> '' THEN 0
                                        WHEN RTRIM(ISNULL(Nh_Ct, '1')) = '1' THEN ISNULL(Tien, 0)
                                        ELSE -ISNULL(Tien, 0)
                                    END
                                )
                                FROM {self.vp_db}.dbo.SoCaiVT WITH (NOLOCK)
                                WHERE RTRIM(Ma_Vt) = ? AND Ngay_Ct < ?
                            ), 0)
                    """
                    p_open = [clean_vt, clean_vt, d1, clean_vt, clean_vt, d1]

                cur.execute(open_sql, p_open)
                op_row = cur.fetchone()
                ton_dau = float(op_row[0] or 0.0) if op_row else 0.0
                tien_dau = float(op_row[1] or 0.0) if op_row else 0.0

                card_params: List[Any] = [clean_vt, d1, d2]
                if clean_kho:
                    card_params.extend([clean_kho, clean_kho])

                cur.execute(
                    f"""
                    SELECT
                        RTRIM(s.Stt), RTRIM(s.Stt0), s.Ngay_Ct, RTRIM(s.Ma_Ct),
                        LTRIM(RTRIM(ISNULL(s.So_Ct, ''))),
                        RTRIM(ISNULL(s.Nh_Ct, '1')),
                        RTRIM(ISNULL(s.Ma_Dt, '')), {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(s.Dien_Giai, '')),
                        RTRIM(ISNULL(s.Ma_Kho, '')), RTRIM(ISNULL(s.Ma_KhoN, '')),
                        ISNULL(s.So_Luong, 0), ISNULL(s.Gia, 0), ISNULL(s.Tien, 0)
                    FROM {self.vp_db}.dbo.SoCaiVT s WITH (NOLOCK)
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON RTRIM(d.Ma_Dt) = RTRIM(s.Ma_Dt)
                    WHERE RTRIM(s.Ma_Vt) = ? AND s.Ngay_Ct >= ? AND s.Ngay_Ct <= ? {kho_cond_sc}
                    ORDER BY s.Ngay_Ct ASC, s.Nh_Ct ASC, s.So_Ct ASC, s.Stt0 ASC
                    """,
                    card_params,
                )

                running_qty = ton_dau
                running_amt = tien_dau
                sum_sn = sum_tn = sum_sx = sum_tx = 0.0
                entries: List[StockCardEntry] = []

                for r in cur.fetchall():
                    nh_ct = (r[5] or "1").strip()
                    row_kho = (r[9] or "").strip().upper()
                    row_kho_n = (r[10] or "").strip().upper()
                    qty = float(r[11] or 0.0)
                    gia = float(r[12] or 0.0)
                    amt = float(r[13] or 0.0)

                    sl_nhap = tien_nhap = sl_xuat = tien_xuat = 0.0
                    if row_kho_n:
                        if clean_kho:
                            if row_kho == clean_kho:
                                sl_xuat, tien_xuat = qty, amt
                            if row_kho_n == clean_kho:
                                sl_nhap, tien_nhap = qty, amt
                        else:
                            # Overall company stock card: show transfer info (net 0)
                            sl_nhap, tien_nhap = qty, amt
                            sl_xuat, tien_xuat = qty, amt
                    elif nh_ct == "1":
                        sl_nhap, tien_nhap = qty, amt
                    else:
                        sl_xuat, tien_xuat = qty, amt

                    sum_sn += sl_nhap
                    sum_tn += tien_nhap
                    sum_sx += sl_xuat
                    sum_tx += tien_xuat
                    running_qty += sl_nhap - sl_xuat
                    running_amt += tien_nhap - tien_xuat

                    entries.append(
                        StockCardEntry(
                            stt=(r[0] or "").strip(),
                            stt0=(r[1] or "").strip(),
                            ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                            ma_ct=(r[3] or "").strip(),
                            so_ct=(r[4] or "").strip(),
                            ma_dt=(r[6] or "").strip(),
                            ten_dt=(r[7] or "").strip(),
                            dien_giai=(r[8] or "").strip(),
                            ma_kho=row_kho,
                            ma_kho_n=row_kho_n,
                            sl_nhap=sl_nhap,
                            tien_nhap=tien_nhap,
                            sl_xuat=sl_xuat,
                            tien_xuat=tien_xuat,
                            don_gia=gia,
                            ton_luy_ke=running_qty,
                            tien_luy_ke=running_amt,
                        )
                    )

                return StockCardResponse(
                    from_date=d1,
                    to_date=d2,
                    ma_vt=clean_vt,
                    ten_vt=ten_vt,
                    dvt=dvt,
                    ma_kho=clean_kho,
                    ten_kho=ten_kho,
                    ton_dau=ton_dau,
                    tien_dau=tien_dau,
                    sum_sl_nhap=sum_sn,
                    sum_tien_nhap=sum_tn,
                    sum_sl_xuat=sum_sx,
                    sum_tien_xuat=sum_tx,
                    ton_cuoi=running_qty,
                    tien_cuoi=running_amt,
                    entries=entries,
                )
        except Exception as exc:
            if is_sql_connection_error(exc):
                raise SqlUnavailableError() from exc
            raise


inventory_report_repository = InventoryReportRepository()
