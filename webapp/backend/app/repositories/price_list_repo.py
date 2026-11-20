"""Repository for managing Price Lists (VP_2014.dbo.BG & BG0), migrated from Import_BG/import_bang_gia_tool.py."""

import logging
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.repositories.price_repo import price_repository
from app.repositories.voucher_repo import voucher_repository
from app.schemas.price_list import (
    PriceListDeleteItemsCommitRequest,
    PriceListDeleteItemsPreviewResponse,
    PriceListDetailResponse,
    PriceListDetailSchema,
    PriceListExportRow,
    PriceListHeaderSchema,
    PriceListImportNewCommitRequest,
    PriceListImportNewGroupPreview,
    PriceListImportNewItemPreview,
    PriceListImportNewPreviewResponse,
    PriceListImportUpdateCommitRequest,
    PriceListImportUpdatePreviewResponse,
    PriceListItemsPageResponse,
    PriceListPageResponse,
    PriceListSaveRequest,
    PriceListUpdateItemPreview,
)
from app.utils.excel_parser import (
    clean_upper_code,
    parse_amount,
    parse_excel_date,
    parse_tabular_upload,
)

logger = logging.getLogger("app.repositories.price_list")

# Multi-row INSERT batch size for BG0 (5 params per row -> 350 * 5 = 1750 < 2100 SQL Server limit)
_BG0_INSERT_BATCH_SIZE = 350


def _escape_sql_like(value: str) -> str:
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
        .replace("[", "\\[")
    )


class PriceListRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

    def _get_ma_dvcs(self, cur: Any) -> str:
        cur.execute(f"SELECT TOP 1 Ma_DvCs FROM {self.sys_db}.dbo.DmDvCs WITH (NOLOCK)")
        row = cur.fetchone()
        return (row[0] or "").strip() if row and row[0] else "S1"

    def _lookup_vt_meta(self, codes: List[str]) -> Dict[str, Tuple[str, str]]:
        """Tra (Ten_Vt, Dvt) từ VTSYS.dbo.DmVt cho danh sách mã vật tư."""
        out: Dict[str, Tuple[str, str]] = {}
        clean_codes = sorted({c.strip().upper() for c in codes if c and c.strip()})
        if not clean_codes:
            return out
        try:
            with get_db_cursor(self.sys_db) as cur:
                for i in range(0, len(clean_codes), 400):
                    chunk = clean_codes[i:i + 400]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"SELECT RTRIM(Ma_Vt), {self.fn_uni}(Ten_Vt), {self.fn_uni}(Dvt) "
                        f"FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK) WHERE Ma_Vt IN ({ph})",
                        chunk,
                    )
                    for r in cur.fetchall():
                        out[(r[0] or "").strip().upper()] = (
                            (r[1] or "").strip(),
                            (r[2] or "").strip(),
                        )
        except Exception as e:
            logger.warning(f"DmVt lookup warning in PriceListRepository: {e}")
        return out

    def _lookup_dt_names(self, codes: List[str]) -> Dict[str, str]:
        out: Dict[str, str] = {}
        clean_codes = sorted({c.strip().upper() for c in codes if c and c.strip()})
        if not clean_codes:
            return out
        try:
            with get_db_cursor(self.sys_db) as cur:
                for i in range(0, len(clean_codes), 400):
                    chunk = clean_codes[i:i + 400]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"SELECT RTRIM(Ma_Dt), {self.fn_uni}(Ten_Dt) "
                        f"FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt IN ({ph})",
                        chunk,
                    )
                    for r in cur.fetchall():
                        out[(r[0] or "").strip().upper()] = (r[1] or "").strip()
        except Exception as e:
            logger.warning(f"DmDt lookup warning in PriceListRepository: {e}")
        return out

    def _build_header_where(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        so_ct: Optional[str] = None,
        ma_vm: Optional[str] = None,
        ma_dt: Optional[str] = None,
    ) -> Tuple[str, List[Any]]:
        where_clauses: List[str] = []
        params: List[Any] = []

        if from_date and from_date.strip():
            where_clauses.append("b.Ngay_Ct >= ?")
            params.append(from_date.strip()[:10])
        if to_date and to_date.strip():
            where_clauses.append("b.Ngay_Ct <= ?")
            params.append(to_date.strip()[:10])

        for col_name, raw_val in (("So_Ct", so_ct), ("Ma_Vm", ma_vm), ("Ma_Dt", ma_dt)):
            val = (raw_val or "").strip().upper()
            if val:
                where_clauses.append(
                    f"UPPER(LTRIM(RTRIM(ISNULL(b.{col_name}, '')))) LIKE ? ESCAPE '\\'"
                )
                params.append(f"%{_escape_sql_like(val)}%")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return where_sql, params

    def _fetch_bg0_counts(self, cur: Any, stts: List[str]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        clean = [s for s in stts if s]
        if not clean:
            return counts
        for i in range(0, len(clean), 400):
            chunk = clean[i:i + 400]
            ph = ",".join(["?"] * len(chunk))
            cur.execute(
                f"SELECT RTRIM(Stt), COUNT(1) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) "
                f"WHERE Stt IN ({ph}) GROUP BY Stt",
                chunk,
            )
            for row in cur.fetchall():
                counts[(row[0] or "").strip()] = int(row[1] or 0)
        return counts

    def list_price_lists(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        so_ct: Optional[str] = None,
        ma_vm: Optional[str] = None,
        ma_dt: Optional[str] = None,
    ) -> List[PriceListHeaderSchema]:
        where_sql, params = self._build_header_where(
            from_date=from_date,
            to_date=to_date,
            so_ct=so_ct,
            ma_vm=ma_vm,
            ma_dt=ma_dt,
        )
        sql = f"""
            SELECT
                RTRIM(b.Stt) AS Stt,
                RTRIM(b.Ma_DvCs) AS Ma_DvCs,
                b.Ngay_Ct,
                LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) AS So_Ct,
                LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) AS Ma_Dt,
                {self.fn_uni}(ISNULL(d.Ten_Dt, '')) AS Ten_Dt,
                LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) AS Ma_Vm,
                {self.fn_uni}(ISNULL(vm.Ten_Vm, '')) AS Ten_Vm,
                RTRIM(b.Ma_Tte) AS Ma_Tte,
                ISNULL(b.Ty_Gia, 1) AS Ty_Gia,
                b.Ngay_Ct1,
                b.Ngay_Ct2,
                LTRIM(RTRIM(ISNULL(b.UserName, ''))) AS UserName,
                ISNULL(b.Confirmed, 1) AS Confirmed,
                ISNULL(b.Closed, '0') AS Closed
            FROM {self.vp_db}.dbo.BG b WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = b.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmVm vm WITH (NOLOCK) ON vm.Ma_Vm = b.Ma_Vm
            {where_sql}
            ORDER BY LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) ASC,
                     LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) ASC,
                     b.Ngay_Ct DESC,
                     LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) ASC,
                     b.Stt ASC
        """
        results: List[PriceListHeaderSchema] = []
        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                counts = self._fetch_bg0_counts(
                    cur, [(r[0] or "").strip() for r in rows]
                )
                for r in rows:
                    stt_val = (r[0] or "").strip()
                    results.append(
                        PriceListHeaderSchema(
                            stt=stt_val,
                            ma_dvcs=(r[1] or "S1").strip(),
                            ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                            so_ct=(r[3] or "").strip(),
                            ma_dt=(r[4] or "").strip(),
                            ten_dt=(r[5] or "").strip(),
                            ma_vm=(r[6] or "").strip(),
                            ten_vm=(r[7] or "").strip(),
                            ma_tte=(r[8] or "VND").strip(),
                            ty_gia=float(r[9] or 1.0),
                            ngay_ct1=r[10].strftime("%Y-%m-%d") if r[10] else None,
                            ngay_ct2=r[11].strftime("%Y-%m-%d") if r[11] else None,
                            user_name=(r[12] or "").strip(),
                            confirmed=bool(r[13]),
                            closed=(r[14] or "0").strip(),
                            item_count=counts.get(stt_val, 0),
                        )
                    )
        except Exception as e:
            logger.error(f"Error listing price lists (BG): {e}")
        return results

    def list_price_lists_paged(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        so_ct: Optional[str] = None,
        ma_vm: Optional[str] = None,
        ma_dt: Optional[str] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> PriceListPageResponse:
        safe_page = max(1, int(page))
        safe_size = max(1, min(1000, int(page_size)))
        where_sql, params = self._build_header_where(
            from_date=from_date,
            to_date=to_date,
            so_ct=so_ct,
            ma_vm=ma_vm,
            ma_dt=ma_dt,
        )
        count_sql = f"SELECT COUNT(1) FROM {self.vp_db}.dbo.BG b WITH (NOLOCK) {where_sql}"
        offset = (safe_page - 1) * safe_size
        page_sql = f"""
            ;WITH PageBG AS (
                SELECT
                    b.Stt, b.Ma_DvCs, b.Ngay_Ct, b.So_Ct, b.Ma_Dt, b.Ma_Vm,
                    b.Ma_Tte, b.Ty_Gia, b.Ngay_Ct1, b.Ngay_Ct2, b.UserName,
                    b.Confirmed, b.Closed
                FROM {self.vp_db}.dbo.BG b WITH (NOLOCK)
                {where_sql}
                ORDER BY LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) ASC,
                         LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) ASC,
                         b.Ngay_Ct DESC,
                         LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) ASC,
                         b.Stt ASC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            )
            SELECT
                RTRIM(b.Stt) AS Stt,
                RTRIM(b.Ma_DvCs) AS Ma_DvCs,
                b.Ngay_Ct,
                LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) AS So_Ct,
                LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) AS Ma_Dt,
                {self.fn_uni}(ISNULL(d.Ten_Dt, '')) AS Ten_Dt,
                LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) AS Ma_Vm,
                {self.fn_uni}(ISNULL(vm.Ten_Vm, '')) AS Ten_Vm,
                RTRIM(b.Ma_Tte) AS Ma_Tte,
                ISNULL(b.Ty_Gia, 1) AS Ty_Gia,
                b.Ngay_Ct1,
                b.Ngay_Ct2,
                LTRIM(RTRIM(ISNULL(b.UserName, ''))) AS UserName,
                ISNULL(b.Confirmed, 1) AS Confirmed,
                ISNULL(b.Closed, '0') AS Closed
            FROM PageBG b
            LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = b.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmVm vm WITH (NOLOCK) ON vm.Ma_Vm = b.Ma_Vm
            ORDER BY LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) ASC,
                     LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) ASC,
                     b.Ngay_Ct DESC,
                     LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) ASC,
                     b.Stt ASC
        """
        items: List[PriceListHeaderSchema] = []
        total_records = 0
        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(count_sql, params)
                cnt_row = cur.fetchone()
                total_records = int(cnt_row[0] or 0) if cnt_row else 0
                if total_records > 0 and offset < total_records:
                    cur.execute(page_sql, [*params, offset, safe_size])
                    rows = cur.fetchall()
                    counts = self._fetch_bg0_counts(
                        cur, [(r[0] or "").strip() for r in rows]
                    )
                    for r in rows:
                        stt_val = (r[0] or "").strip()
                        items.append(
                            PriceListHeaderSchema(
                                stt=stt_val,
                                ma_dvcs=(r[1] or "S1").strip(),
                                ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                                so_ct=(r[3] or "").strip(),
                                ma_dt=(r[4] or "").strip(),
                                ten_dt=(r[5] or "").strip(),
                                ma_vm=(r[6] or "").strip(),
                                ten_vm=(r[7] or "").strip(),
                                ma_tte=(r[8] or "VND").strip(),
                                ty_gia=float(r[9] or 1.0),
                                ngay_ct1=r[10].strftime("%Y-%m-%d") if r[10] else None,
                                ngay_ct2=r[11].strftime("%Y-%m-%d") if r[11] else None,
                                user_name=(r[12] or "").strip(),
                                confirmed=bool(r[13]),
                                closed=(r[14] or "0").strip(),
                                item_count=counts.get(stt_val, 0),
                            )
                        )
        except Exception as e:
            logger.error(f"Error listing paged price lists (BG): {e}")

        total_pages = max(1, (total_records + safe_size - 1) // safe_size)
        return PriceListPageResponse(
            items=items,
            total_records=total_records,
            page=safe_page,
            page_size=safe_size,
            total_pages=total_pages,
        )

    def get_price_list_items_page(
        self,
        stt: str,
        q: Optional[str] = None,
        offset: int = 0,
        limit: int = 500,
    ) -> PriceListItemsPageResponse:
        clean_stt = (stt or "").strip()
        safe_offset = max(0, int(offset))
        safe_limit = max(1, min(2000, int(limit)))
        clean_q = (q or "").strip()

        if not clean_stt:
            return PriceListItemsPageResponse(
                stt="",
                total_count=0,
                filtered_count=0,
                offset=safe_offset,
                limit=safe_limit,
                has_more=False,
                items=[],
            )

        total_count = 0
        filtered_count = 0
        items: List[PriceListDetailSchema] = []

        filter_join = ""
        filter_sql = ""
        filter_params: List[Any] = [clean_stt]
        if clean_q:
            esc = f"%{_escape_sql_like(clean_q.upper())}%"
            esc_text = f"%{_escape_sql_like(clean_q)}%"
            filter_join = f"LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = b0.Ma_Vt"
            filter_sql = (
                f" AND (UPPER(RTRIM(ISNULL(b0.Ma_Vt, ''))) LIKE ? ESCAPE '\\' "
                f"OR {self.fn_uni}(ISNULL(v.Ten_Vt, '')) LIKE ? ESCAPE '\\')"
            )
            filter_params.extend([esc, esc_text])

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT COUNT(1) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) WHERE Stt = ?",
                    [clean_stt],
                )
                row_total = cur.fetchone()
                total_count = int(row_total[0] or 0) if row_total else 0

                if clean_q:
                    cur.execute(
                        f"SELECT COUNT(1) FROM {self.vp_db}.dbo.BG0 b0 WITH (NOLOCK) "
                        f"{filter_join} WHERE b0.Stt = ?{filter_sql}",
                        filter_params,
                    )
                    row_filtered = cur.fetchone()
                    filtered_count = int(row_filtered[0] or 0) if row_filtered else 0
                else:
                    filtered_count = total_count

                if filtered_count > 0 and safe_offset < filtered_count:
                    items_sql = f"""
                        ;WITH PageItems AS (
                            SELECT b0.Stt0, b0.Stt, b0.Ma_Vt, b0.Dvt, b0.Gia, b0.CK
                            FROM {self.vp_db}.dbo.BG0 b0 WITH (NOLOCK)
                            {filter_join}
                            WHERE b0.Stt = ?{filter_sql}
                            ORDER BY RTRIM(b0.Ma_Vt) ASC, b0.Stt0 ASC
                            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                        )
                        SELECT
                            RTRIM(p.Stt0) AS Stt0,
                            RTRIM(p.Stt) AS Stt,
                            RTRIM(ISNULL(p.Ma_Vt, '')) AS Ma_Vt,
                            {self.fn_uni}(ISNULL(v.Ten_Vt, '')) AS Ten_Vt,
                            {self.fn_uni}(ISNULL(p.Dvt, '')) AS Dvt,
                            ISNULL(p.Gia, 0) AS Gia,
                            ISNULL(p.CK, 0) AS CK
                        FROM PageItems p
                        LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = p.Ma_Vt
                        ORDER BY RTRIM(p.Ma_Vt) ASC, p.Stt0 ASC
                    """
                    cur.execute(items_sql, [*filter_params, safe_offset, safe_limit])
                    items = [
                        PriceListDetailSchema(
                            stt0=(dr[0] or "").strip(),
                            stt=(dr[1] or "").strip(),
                            ma_vt=(dr[2] or "").strip(),
                            ten_vt=(dr[3] or "").strip(),
                            dvt=(dr[4] or "").strip(),
                            gia=float(dr[5] or 0.0),
                            ck=float(dr[6] or 0.0),
                        )
                        for dr in cur.fetchall()
                    ]
        except Exception as e:
            logger.error(f"Error getting paged BG0 items ({clean_stt}): {e}")

        return PriceListItemsPageResponse(
            stt=clean_stt,
            total_count=total_count,
            filtered_count=filtered_count,
            offset=safe_offset,
            limit=safe_limit,
            has_more=(safe_offset + len(items)) < filtered_count,
            items=items,
        )

    def get_price_list_detail(self, stt: str) -> Optional[PriceListDetailResponse]:
        clean_stt = (stt or "").strip()
        if not clean_stt:
            return None

        header_sql = f"""
            SELECT
                RTRIM(b.Stt) AS Stt,
                RTRIM(b.Ma_DvCs) AS Ma_DvCs,
                b.Ngay_Ct,
                LTRIM(RTRIM(ISNULL(b.So_Ct, ''))) AS So_Ct,
                LTRIM(RTRIM(ISNULL(b.Ma_Dt, ''))) AS Ma_Dt,
                {self.fn_uni}(ISNULL(d.Ten_Dt, '')) AS Ten_Dt,
                LTRIM(RTRIM(ISNULL(b.Ma_Vm, ''))) AS Ma_Vm,
                {self.fn_uni}(ISNULL(vm.Ten_Vm, '')) AS Ten_Vm,
                RTRIM(b.Ma_Tte) AS Ma_Tte,
                ISNULL(b.Ty_Gia, 1) AS Ty_Gia,
                b.Ngay_Ct1,
                b.Ngay_Ct2,
                LTRIM(RTRIM(ISNULL(b.UserName, ''))) AS UserName,
                ISNULL(b.Confirmed, 1) AS Confirmed,
                ISNULL(b.Closed, '0') AS Closed
            FROM {self.vp_db}.dbo.BG b WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = b.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmVm vm WITH (NOLOCK) ON vm.Ma_Vm = b.Ma_Vm
            WHERE b.Stt = ?
        """
        detail_sql = f"""
            SELECT
                RTRIM(b0.Stt0) AS Stt0,
                RTRIM(b0.Stt) AS Stt,
                RTRIM(ISNULL(b0.Ma_Vt, '')) AS Ma_Vt,
                {self.fn_uni}(ISNULL(v.Ten_Vt, '')) AS Ten_Vt,
                {self.fn_uni}(ISNULL(b0.Dvt, '')) AS Dvt,
                ISNULL(b0.Gia, 0) AS Gia,
                ISNULL(b0.CK, 0) AS CK
            FROM {self.vp_db}.dbo.BG0 b0 WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = b0.Ma_Vt
            WHERE b0.Stt = ?
            ORDER BY RTRIM(b0.Ma_Vt) ASC, b0.Stt0 ASC
        """
        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(header_sql, [clean_stt])
                hr = cur.fetchone()
                if not hr:
                    return None
                cur.execute(detail_sql, [clean_stt])
                items = [
                    PriceListDetailSchema(
                        stt0=(dr[0] or "").strip(),
                        stt=(dr[1] or "").strip(),
                        ma_vt=(dr[2] or "").strip(),
                        ten_vt=(dr[3] or "").strip(),
                        dvt=(dr[4] or "").strip(),
                        gia=float(dr[5] or 0.0),
                        ck=float(dr[6] or 0.0),
                    )
                    for dr in cur.fetchall()
                ]
                return PriceListDetailResponse(
                    stt=(hr[0] or "").strip(),
                    ma_dvcs=(hr[1] or "S1").strip(),
                    ngay_ct=hr[2].strftime("%Y-%m-%d") if hr[2] else "",
                    so_ct=(hr[3] or "").strip(),
                    ma_dt=(hr[4] or "").strip(),
                    ten_dt=(hr[5] or "").strip(),
                    ma_vm=(hr[6] or "").strip(),
                    ten_vm=(hr[7] or "").strip(),
                    ma_tte=(hr[8] or "VND").strip(),
                    ty_gia=float(hr[9] or 1.0),
                    ngay_ct1=hr[10].strftime("%Y-%m-%d") if hr[10] else None,
                    ngay_ct2=hr[11].strftime("%Y-%m-%d") if hr[11] else None,
                    user_name=(hr[12] or "").strip(),
                    confirmed=bool(hr[13]),
                    closed=(hr[14] or "0").strip(),
                    item_count=len(items),
                    items=items,
                )
        except Exception as e:
            logger.error(f"Error getting price list detail ({clean_stt}): {e}")
            return None

    def _insert_bg0_rows(
        self,
        cur: Any,
        ma_dvcs: str,
        rows: List[Tuple[str, str, float, float]],
    ) -> None:
        """Batch insert (Stt, Ma_Vt, Gia, CK) into dbo.BG0 with Dvt auto-resolved from DmVt."""
        if not rows:
            return
        stt0_list = voucher_repository.generate_stts_batch(ma_dvcs, len(rows), cur)
        placeholder = (
            f"(?, ?, ?, ISNULL((SELECT TOP 1 Dvt FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK) WHERE Ma_Vt = ?), ''), ?, ?)"
        )
        prefix = f"INSERT INTO {self.vp_db}.dbo.BG0 (Stt0, Stt, Ma_Vt, Dvt, Gia, CK) VALUES "
        for start in range(0, len(rows), _BG0_INSERT_BATCH_SIZE):
            chunk_rows = rows[start:start + _BG0_INSERT_BATCH_SIZE]
            chunk_stt0 = stt0_list[start:start + _BG0_INSERT_BATCH_SIZE]
            params: List[Any] = []
            for (stt, ma_vt, gia, ck), stt0 in zip(chunk_rows, chunk_stt0):
                params.extend([stt0, stt, ma_vt, ma_vt, gia, ck])
            cur.execute(prefix + ", ".join([placeholder] * len(chunk_rows)), params)

    def save_price_list(
        self,
        data: PriceListSaveRequest,
        mode: str = "M",
        stt_override: Optional[str] = None,
    ) -> dict:
        if not data.ngay_ct or not data.ngay_ct.strip():
            raise ValueError("Ngày áp dụng là bắt buộc!")
        if not data.so_ct or not data.so_ct.strip():
            raise ValueError("Số chứng từ bảng giá là bắt buộc!")
        clean_dt = (data.ma_dt or "").strip().upper()
        clean_vm = (data.ma_vm or "").strip().upper()
        if not clean_dt and not clean_vm:
            raise ValueError("Phải chọn Khách hàng (Ma_Dt) hoặc Khu vực (Ma_Vm)!")
        if clean_dt and clean_vm:
            # Quy tắc từ import_bang_gia_tool.py: ưu tiên Ma_Dt, xóa Ma_Vm
            clean_vm = ""

        # Deduplicate Ma_Vt keeping last
        dedup_map: Dict[str, Tuple[float, float]] = {}
        for it in data.items:
            code = (it.ma_vt or "").strip().upper()
            if code:
                dedup_map[code] = (float(it.gia or 0.0), float(it.ck or 0.0))
        if not dedup_map:
            raise ValueError("Bảng giá phải có ít nhất 1 mặt hàng!")

        ngay_ct = data.ngay_ct.strip()[:10]
        ngay_ct1 = (data.ngay_ct1 or ngay_ct).strip()[:10]
        ngay_ct2 = data.ngay_ct2.strip()[:10] if data.ngay_ct2 and data.ngay_ct2.strip() else None

        with get_db_transaction(self.vp_db) as (_, cur):
            ma_dvcs = (data.ma_dvcs or "").strip() or self._get_ma_dvcs(cur)
            if mode == "M":
                stt = voucher_repository.generate_stt(ma_dvcs, cur)
                cur.execute(
                    f"""
                    INSERT INTO {self.vp_db}.dbo.BG
                    (Stt, Ma_DvCs, Ngay_Ct, So_Ct, Ma_Dt, Ma_Vm, Ma_Tte, Ty_Gia, Ngay_Ct1, Ngay_Ct2, UserName, Confirmed, Closed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                    """,
                    [
                        stt,
                        ma_dvcs,
                        ngay_ct,
                        data.so_ct.strip().upper(),
                        clean_dt,
                        clean_vm,
                        (data.ma_tte or "VND").strip().upper(),
                        float(data.ty_gia or 1.0),
                        ngay_ct1,
                        ngay_ct2,
                        (data.user_name or "ADMIN").strip(),
                        (data.closed or "0").strip() or "0",
                    ],
                )
            else:
                if not stt_override or not stt_override.strip():
                    raise ValueError("Thiếu mã Stt để cập nhật bảng giá!")
                stt = stt_override.strip()
                cur.execute(
                    f"""
                    UPDATE {self.vp_db}.dbo.BG SET
                        Ngay_Ct = ?, So_Ct = ?, Ma_Dt = ?, Ma_Vm = ?,
                        Ma_Tte = ?, Ty_Gia = ?, Ngay_Ct1 = ?, Ngay_Ct2 = ?, Closed = ?
                    WHERE Stt = ?
                    """,
                    [
                        ngay_ct,
                        data.so_ct.strip().upper(),
                        clean_dt,
                        clean_vm,
                        (data.ma_tte or "VND").strip().upper(),
                        float(data.ty_gia or 1.0),
                        ngay_ct1,
                        ngay_ct2,
                        (data.closed or "0").strip() or "0",
                        stt,
                    ],
                )
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.BG0 WHERE Stt = ?", [stt])

            detail_rows = [(stt, code, gia, ck) for code, (gia, ck) in dedup_map.items()]
            self._insert_bg0_rows(cur, ma_dvcs, detail_rows)

        price_repository.clear_cache()
        return {"stt": stt, "so_ct": data.so_ct.strip().upper(), "item_count": len(detail_rows)}

    def delete_price_list(self, stt: str) -> dict:
        clean_stt = (stt or "").strip()
        if not clean_stt:
            raise ValueError("Thiếu mã Stt bảng giá.")
        with get_db_transaction(self.vp_db) as (_, cur):
            cur.execute(f"SELECT TOP 1 1 FROM {self.vp_db}.dbo.BG WITH (NOLOCK) WHERE Stt = ?", [clean_stt])
            if cur.fetchone() is None:
                raise ValueError(f"Không tìm thấy bảng giá {clean_stt}.")
            cur.execute(f"DELETE FROM {self.vp_db}.dbo.BG0 WHERE Stt = ?", [clean_stt])
            cur.execute(f"DELETE FROM {self.vp_db}.dbo.BG WHERE Stt = ?", [clean_stt])
        price_repository.clear_cache()
        return {"stt": clean_stt}

    def change_dates(
        self,
        stt_list: List[str],
        ngay_ct: str,
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
    ) -> dict:
        clean_stts = [s.strip() for s in stt_list if s and s.strip()]
        if not clean_stts:
            raise ValueError("Vui lòng chọn ít nhất một bảng giá để đổi ngày.")
        target_date = (ngay_ct or "").strip()[:10]
        if not target_date:
            raise ValueError("Ngày mới không hợp lệ.")
        target_ngay_ct1 = (ngay_ct1 or target_date).strip()[:10]
        has_ngay_ct2 = ngay_ct2 is not None
        target_ngay_ct2 = ngay_ct2.strip()[:10] if (ngay_ct2 and ngay_ct2.strip()) else None

        with get_db_transaction(self.vp_db) as (_, cur):
            for i in range(0, len(clean_stts), 500):
                chunk = clean_stts[i:i + 500]
                ph = ",".join(["?"] * len(chunk))
                if has_ngay_ct2:
                    cur.execute(
                        f"UPDATE {self.vp_db}.dbo.BG SET Ngay_Ct = ?, Ngay_Ct1 = ?, Ngay_Ct2 = ? WHERE Stt IN ({ph})",
                        [target_date, target_ngay_ct1, target_ngay_ct2, *chunk],
                    )
                else:
                    cur.execute(
                        f"UPDATE {self.vp_db}.dbo.BG SET Ngay_Ct = ?, Ngay_Ct1 = ? WHERE Stt IN ({ph})",
                        [target_date, target_ngay_ct1, *chunk],
                    )
        price_repository.clear_cache()
        return {"updated_count": len(clean_stts), "ngay_ct": target_date}

    def copy_price_lists(
        self,
        stt_list: List[str],
        ngay_ct: str,
        user_name: str = "ADMIN",
    ) -> dict:
        clean_stts = [s.strip() for s in stt_list if s and s.strip()]
        if not clean_stts:
            raise ValueError("Vui lòng chọn ít nhất một bảng giá để nhân bản.")
        target_date = (ngay_ct or "").strip()[:10]
        if not target_date:
            raise ValueError("Ngày mới không hợp lệ.")

        new_stts: List[str] = []
        total_items = 0

        with get_db_transaction(self.vp_db) as (_, cur):
            ma_dvcs = self._get_ma_dvcs(cur)
            for old_stt in clean_stts:
                new_stt = voucher_repository.generate_stt(ma_dvcs, cur)
                cur.execute(
                    f"""
                    INSERT INTO {self.vp_db}.dbo.BG
                    (Stt, Ma_DvCs, Ngay_Ct, So_Ct, Ma_Dt, Ma_Vm, Ma_Tte, Ty_Gia, Ngay_Ct1, Ngay_Ct2, UserName, Confirmed, Closed)
                    SELECT ?, Ma_DvCs, ?, So_Ct, Ma_Dt, Ma_Vm, Ma_Tte, Ty_Gia, ?, Ngay_Ct2, ?, Confirmed, Closed
                    FROM {self.vp_db}.dbo.BG WHERE Stt = ?
                    """,
                    [new_stt, target_date, target_date, user_name or "ADMIN", old_stt],
                )
                cur.execute(
                    f"SELECT RTRIM(Ma_Vt), ISNULL(Gia, 0), ISNULL(CK, 0) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) WHERE Stt = ?",
                    [old_stt],
                )
                old_items = cur.fetchall()
                if old_items:
                    rows = [
                        (new_stt, (r[0] or "").strip().upper(), float(r[1] or 0.0), float(r[2] or 0.0))
                        for r in old_items
                        if r[0] and str(r[0]).strip()
                    ]
                    self._insert_bg0_rows(cur, ma_dvcs, rows)
                    total_items += len(rows)
                new_stts.append(new_stt)

        price_repository.clear_cache()
        return {"copied_count": len(new_stts), "copied_items": total_items, "new_stts": new_stts}

    def preview_import_new(self, filename: str, content: bytes) -> PriceListImportNewPreviewResponse:
        raw_rows = parse_tabular_upload(filename, content)
        if not raw_rows:
            raise ValueError("File Excel không có dữ liệu.")

        start_idx = 0
        if raw_rows:
            first = raw_rows[0]
            if len(first) >= 6 and not parse_excel_date(first[0]) and parse_amount(first[5]) is None:
                start_idx = 1

        data_rows = raw_rows[start_idx:]
        total_rows = len(data_rows)
        skipped_rows = 0
        valid_records: List[Tuple[str, str, str, str, str, float, float]] = []

        for row in data_rows:
            if not any(str(c or "").strip() for c in row):
                total_rows -= 1
                continue
            if len(row) < 6:
                skipped_rows += 1
                continue
            padded = list(row) + [""] * max(0, 7 - len(row))
            ngay_ct = parse_excel_date(padded[0])
            so_ct = clean_upper_code(padded[1])
            ma_dt = clean_upper_code(padded[2])
            ma_vm = clean_upper_code(padded[3])
            ma_vt = clean_upper_code(padded[4])
            gia = parse_amount(padded[5])
            ck = parse_amount(padded[6])
            ck_val = float(ck) if ck is not None else 0.0

            if not ngay_ct or not so_ct or (not ma_dt and not ma_vm) or not ma_vt or gia is None:
                skipped_rows += 1
                continue

            if ma_dt and ma_vm:
                ma_vm = ""

            valid_records.append((ngay_ct, so_ct, ma_dt, ma_vm, ma_vt, float(gia), ck_val))

        if not valid_records:
            raise ValueError(
                "Không tìm thấy dòng hợp lệ nào (cần 7 cột: Ngày, Số CT, Khách hàng, Khu vực, Mã hàng, Giá, CK)."
            )

        # Deduplicate keeping last per (Ngay_Ct, So_Ct, Ma_Dt, Ma_Vm, Ma_Vt)
        deduped: Dict[Tuple[str, str, str, str, str], Tuple[float, float]] = {}
        for ngay_ct, so_ct, ma_dt, ma_vm, ma_vt, gia, ck_val in valid_records:
            deduped[(ngay_ct, so_ct, ma_dt, ma_vm, ma_vt)] = (gia, ck_val)
        duplicate_rows = len(valid_records) - len(deduped)

        # Lookup names from DmVt and DmDt
        vt_meta = self._lookup_vt_meta([k[4] for k in deduped.keys()])
        dt_names = self._lookup_dt_names([k[2] for k in deduped.keys() if k[2]])

        grouped: Dict[Tuple[str, str, str, str], List[PriceListImportNewItemPreview]] = {}
        for (ngay_ct, so_ct, ma_dt, ma_vm, ma_vt), (gia, ck_val) in deduped.items():
            ten_vt, dvt = vt_meta.get(ma_vt, ("", ""))
            grouped.setdefault((ngay_ct, so_ct, ma_dt, ma_vm), []).append(
                PriceListImportNewItemPreview(
                    ma_vt=ma_vt,
                    ten_vt=ten_vt,
                    dvt=dvt,
                    gia=gia,
                    ck=ck_val,
                )
            )

        groups = [
            PriceListImportNewGroupPreview(
                ngay_ct=ngay_ct,
                so_ct=so_ct,
                ma_dt=ma_dt,
                ten_dt=dt_names.get(ma_dt, "") if ma_dt else "",
                ma_vm=ma_vm,
                items=items,
            )
            for (ngay_ct, so_ct, ma_dt, ma_vm), items in grouped.items()
        ]
        return PriceListImportNewPreviewResponse(
            total_rows=total_rows,
            skipped_rows=skipped_rows,
            duplicate_rows=duplicate_rows,
            groups_count=len(groups),
            details_count=len(deduped),
            groups=groups,
        )

    def commit_import_new(self, req: PriceListImportNewCommitRequest) -> dict:
        if not req.groups:
            raise ValueError("Danh sách bảng giá cần import đang trống.")

        user_name = (req.user_name or "ADMIN").strip() or "ADMIN"
        headers_created = 0
        details_created = 0

        with get_db_transaction(self.vp_db) as (_, cur):
            ma_dvcs = self._get_ma_dvcs(cur)
            detail_rows: List[Tuple[str, str, float, float]] = []

            for grp in req.groups:
                if not grp.items:
                    continue
                clean_dt = (grp.ma_dt or "").strip().upper()
                clean_vm = "" if clean_dt else (grp.ma_vm or "").strip().upper()
                if not grp.ngay_ct or not grp.so_ct or (not clean_dt and not clean_vm):
                    raise ValueError(f"Đợt bảng giá '{grp.so_ct}' thiếu thông tin bắt buộc.")

                stt = voucher_repository.generate_stt(ma_dvcs, cur)
                cur.execute(
                    f"""
                    INSERT INTO {self.vp_db}.dbo.BG
                    (Stt, Ma_DvCs, Ngay_Ct, So_Ct, Ma_Dt, Ma_Vm, Ma_Tte, Ty_Gia, Ngay_Ct1, Ngay_Ct2, UserName, Confirmed, Closed)
                    VALUES (?, ?, ?, ?, ?, ?, 'VND', 1, ?, NULL, ?, 1, '0')
                    """,
                    [stt, ma_dvcs, grp.ngay_ct, grp.so_ct.strip().upper(), clean_dt, clean_vm, grp.ngay_ct, user_name],
                )
                headers_created += 1
                for it in grp.items:
                    detail_rows.append((stt, it.ma_vt.strip().upper(), float(it.gia), float(it.ck or 0.0)))
                    details_created += 1

            self._insert_bg0_rows(cur, ma_dvcs, detail_rows)

        price_repository.clear_cache()
        return {
            "headers_created": headers_created,
            "details_created": details_created,
            "message": f"Import thành công {headers_created} bảng giá ({details_created} dòng chi tiết).",
        }

    def preview_import_update(
        self,
        filename: str,
        content: bytes,
        stt_list: Optional[List[str]] = None,
    ) -> PriceListImportUpdatePreviewResponse:
        raw_rows = parse_tabular_upload(filename, content)
        if not raw_rows:
            raise ValueError("File Excel không có dữ liệu.")

        max_cols = max(len(r) for r in raw_rows)
        if max_cols >= 7:
            idx_vt, idx_gia, idx_ck = 4, 5, 6
        elif max_cols >= 3:
            idx_vt, idx_gia, idx_ck = 0, 1, 2
        else:
            raise ValueError("File Excel cập nhật cần ít nhất 3 cột (Mã hàng, Giá, CK) hoặc 7 cột chuẩn.")

        start_idx = 0
        if raw_rows:
            first = raw_rows[0]
            if len(first) > idx_gia and parse_amount(first[idx_gia]) is None:
                start_idx = 1

        data_rows = raw_rows[start_idx:]
        total_rows = len(data_rows)
        skipped_rows = 0
        valid_pairs: List[Tuple[str, float, float]] = []

        for row in data_rows:
            if not any(str(c or "").strip() for c in row):
                total_rows -= 1
                continue
            if len(row) <= idx_gia:
                skipped_rows += 1
                continue
            ma_vt = clean_upper_code(row[idx_vt])
            gia = parse_amount(row[idx_gia])
            ck = parse_amount(row[idx_ck]) if len(row) > idx_ck else 0.0
            ck_val = float(ck) if ck is not None else 0.0
            if not ma_vt or gia is None:
                skipped_rows += 1
                continue
            valid_pairs.append((ma_vt, float(gia), ck_val))

        if not valid_pairs:
            raise ValueError("Không tìm thấy dòng hợp lệ (Mã hàng + Giá) trong file Excel.")

        deduped: Dict[str, Tuple[float, float]] = {}
        for ma_vt, gia, ck_val in valid_pairs:
            deduped[ma_vt] = (gia, ck_val)
        duplicate_rows = len(valid_pairs) - len(deduped)

        vt_meta = self._lookup_vt_meta(list(deduped.keys()))
        items = [
            PriceListUpdateItemPreview(
                ma_vt=ma_vt,
                ten_vt=vt_meta.get(ma_vt, ("", ""))[0],
                dvt=vt_meta.get(ma_vt, ("", ""))[1],
                gia=gia,
                ck=ck_val,
            )
            for ma_vt, (gia, ck_val) in deduped.items()
        ]

        existing_est = 0
        new_est = 0
        clean_stts = [s.strip() for s in (stt_list or []) if s and s.strip()]
        if clean_stts:
            try:
                with get_db_cursor(self.vp_db) as cur:
                    for stt in clean_stts:
                        cur.execute(f"SELECT RTRIM(Ma_Vt) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) WHERE Stt = ?", [stt])
                        existing_set = {(r[0] or "").strip().upper() for r in cur.fetchall() if r[0]}
                        for ma_vt in deduped.keys():
                            if ma_vt in existing_set:
                                existing_est += 1
                            else:
                                new_est += 1
            except Exception as e:
                logger.warning(f"Estimate update counts warning: {e}")

        return PriceListImportUpdatePreviewResponse(
            total_rows=total_rows,
            skipped_rows=skipped_rows,
            duplicate_rows=duplicate_rows,
            unique_items=len(items),
            existing_updates_estimate=existing_est,
            new_inserts_estimate=new_est,
            items=items,
        )

    def commit_import_update(self, req: PriceListImportUpdateCommitRequest) -> dict:
        clean_stts = [s.strip() for s in req.stt_list if s and s.strip()]
        if not clean_stts:
            raise ValueError("Vui lòng chọn ít nhất 1 bảng giá để cập nhật.")
        if not req.items:
            raise ValueError("Danh sách mặt hàng cập nhật đang trống.")

        deduped: Dict[str, Tuple[float, float]] = {}
        for it in req.items:
            code = (it.ma_vt or "").strip().upper()
            if code:
                deduped[code] = (float(it.gia or 0.0), float(it.ck or 0.0))

        inserts_count = 0
        updates_count = 0

        with get_db_transaction(self.vp_db) as (_, cur):
            ma_dvcs = self._get_ma_dvcs(cur)
            try:
                cur.fast_executemany = True
            except Exception:
                pass

            all_inserts: List[Tuple[str, str, float, float]] = []
            for stt in clean_stts:
                cur.execute(
                    f"SELECT RTRIM(Ma_Vt) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) WHERE Stt = ?",
                    [stt],
                )
                existing = {(r[0] or "").strip().upper() for r in cur.fetchall() if r[0]}
                update_params: List[Tuple[float, float, str, str]] = []
                for ma_vt, (gia, ck_val) in deduped.items():
                    if ma_vt in existing:
                        update_params.append((gia, ck_val, stt, ma_vt))
                    else:
                        all_inserts.append((stt, ma_vt, gia, ck_val))
                        inserts_count += 1
                if update_params:
                    cur.executemany(
                        f"UPDATE {self.vp_db}.dbo.BG0 SET Gia = ?, CK = ? WHERE Stt = ? AND Ma_Vt = ?",
                        update_params,
                    )
                    updates_count += len(update_params)

            if all_inserts:
                self._insert_bg0_rows(cur, ma_dvcs, all_inserts)

        price_repository.clear_cache()
        return {
            "price_lists_count": len(clean_stts),
            "inserts_count": inserts_count,
            "updates_count": updates_count,
            "message": f"Cập nhật {len(clean_stts)} bảng giá thành công: thêm mới {inserts_count}, ghi đè {updates_count}.",
        }

    def preview_delete_items(
        self,
        filename: str,
        content: bytes,
        stt_list: Optional[List[str]] = None,
    ) -> PriceListDeleteItemsPreviewResponse:
        raw_rows = parse_tabular_upload(filename, content)
        if not raw_rows:
            raise ValueError("File Excel không có dữ liệu.")

        max_cols = max(len(r) for r in raw_rows)
        col_idx = 4 if max_cols >= 7 else 0

        start_idx = 0
        if raw_rows and len(raw_rows[0]) > col_idx:
            header_txt = clean_upper_code(raw_rows[0][col_idx])
            if header_txt in ("MA_VT", "MÃ HÀNG", "MA HANG", "MA_HANG", "MÃ VT", "MÃ VẬT TƯ"):
                start_idx = 1

        seen = set()
        ma_vt_list: List[str] = []
        for row in raw_rows[start_idx:]:
            if len(row) <= col_idx:
                continue
            code = clean_upper_code(row[col_idx])
            if code and code not in seen:
                seen.add(code)
                ma_vt_list.append(code)

        if not ma_vt_list:
            raise ValueError("Không tìm thấy mã hàng hóa nào trong file Excel.")

        affected = 0
        clean_stts = [s.strip() for s in (stt_list or []) if s and s.strip()]
        if clean_stts:
            try:
                with get_db_cursor(self.vp_db) as cur:
                    stt_ph = ",".join(["?"] * len(clean_stts))
                    for i in range(0, len(ma_vt_list), 500):
                        vt_chunk = ma_vt_list[i:i + 500]
                        vt_ph = ",".join(["?"] * len(vt_chunk))
                        cur.execute(
                            f"SELECT COUNT(1) FROM {self.vp_db}.dbo.BG0 WITH (NOLOCK) "
                            f"WHERE Stt IN ({stt_ph}) AND Ma_Vt IN ({vt_ph})",
                            [*clean_stts, *vt_chunk],
                        )
                        r = cur.fetchone()
                        if r:
                            affected += int(r[0] or 0)
            except Exception as e:
                logger.warning(f"Estimate delete count warning: {e}")

        return PriceListDeleteItemsPreviewResponse(
            ma_vt_count=len(ma_vt_list),
            ma_vt_list=ma_vt_list,
            affected_rows_estimate=affected,
        )

    def commit_delete_items(self, req: PriceListDeleteItemsCommitRequest) -> dict:
        clean_stts = [s.strip() for s in req.stt_list if s and s.strip()]
        clean_vts = sorted({(v or "").strip().upper() for v in req.ma_vt_list if v and v.strip()})
        if not clean_stts:
            raise ValueError("Vui lòng chọn ít nhất 1 bảng giá.")
        if not clean_vts:
            raise ValueError("Danh sách mã hàng cần xóa đang trống.")

        deleted_count = 0
        with get_db_transaction(self.vp_db) as (_, cur):
            stt_ph = ",".join(["?"] * len(clean_stts))
            for i in range(0, len(clean_vts), 500):
                vt_chunk = clean_vts[i:i + 500]
                vt_ph = ",".join(["?"] * len(vt_chunk))
                cur.execute(
                    f"""
                    SET NOCOUNT ON;
                    DELETE FROM {self.vp_db}.dbo.BG0
                    WHERE Stt IN ({stt_ph}) AND Ma_Vt IN ({vt_ph});
                    SELECT @@ROWCOUNT;
                    """,
                    [*clean_stts, *vt_chunk],
                )
                r = cur.fetchone()
                if r:
                    deleted_count += int(r[0] or 0)

        price_repository.clear_cache()
        return {
            "deleted_count": deleted_count,
            "price_lists_count": len(clean_stts),
            "message": f"Đã xóa {deleted_count} dòng mặt hàng khỏi {len(clean_stts)} bảng giá đã chọn.",
        }

    def export_price_lists(self, stt_list: List[str]) -> List[PriceListExportRow]:
        clean_stts = [s.strip() for s in stt_list if s and s.strip()]
        if not clean_stts:
            return []

        rows_out: List[PriceListExportRow] = []
        with get_db_cursor(self.vp_db) as cur:
            for i in range(0, len(clean_stts), 400):
                chunk = clean_stts[i:i + 400]
                ph = ",".join(["?"] * len(chunk))
                cur.execute(
                    f"""
                    SELECT
                        RTRIM(b.Stt) AS Stt_ID,
                        RTRIM(ISNULL(b.So_Ct, '')) AS So_Ct,
                        b.Ngay_Ct,
                        b.Ngay_Ct2,
                        RTRIM(ISNULL(b.Ma_Vm, '')) AS Khu_Vuc,
                        RTRIM(ISNULL(b.Ma_Dt, '')) AS Doi_Tuong,
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')) AS Ten_Doi_Tuong,
                        RTRIM(ISNULL(b0.Ma_Vt, '')) AS Ma_Vat_Tu,
                        {self.fn_uni}(ISNULL(v.Ten_Vt, '')) AS Ten_Vat_Tu,
                        {self.fn_uni}(ISNULL(b0.Dvt, '')) AS DVT,
                        ISNULL(b0.Gia, 0) AS Gia_Ban,
                        ISNULL(b0.CK, 0) AS Chiet_Khau_Phan_Tram
                    FROM {self.vp_db}.dbo.BG b WITH (NOLOCK)
                    JOIN {self.vp_db}.dbo.BG0 b0 WITH (NOLOCK) ON b.Stt = b0.Stt
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = b.Ma_Dt
                    LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = b0.Ma_Vt
                    WHERE b.Stt IN ({ph})
                    ORDER BY b.Stt, RTRIM(b0.Ma_Vt) ASC
                    """,
                    chunk,
                )
                for r in cur.fetchall():
                    rows_out.append(
                        PriceListExportRow(
                            stt_id=(r[0] or "").strip(),
                            so_ct=(r[1] or "").strip(),
                            ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                            ngay_ct2=r[3].strftime("%Y-%m-%d") if r[3] else None,
                            khu_vuc=(r[4] or "").strip(),
                            doi_tuong=(r[5] or "").strip(),
                            ten_doi_tuong=(r[6] or "").strip(),
                            ma_vat_tu=(r[7] or "").strip(),
                            ten_vat_tu=(r[8] or "").strip(),
                            dvt=(r[9] or "").strip(),
                            gia_ban=float(r[10] or 0.0),
                            chiet_khau_phan_tram=float(r[11] or 0.0),
                        )
                    )
        return rows_out


price_list_repository = PriceListRepository()
