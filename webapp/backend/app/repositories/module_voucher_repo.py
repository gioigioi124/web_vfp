"""Repository for VP_2014 accounting modules (CtMH, CtNX, CtCK, CtK, AR/AP 131/331, GL Reports).

Strict SQL-only execution (no in-memory mock fallback):
- Dynamic document types via VTSYS.dbo.Document
- Full *9 quantity/price conversion columns matching VFP ctmhd/ctnxd/ctckd
- ACID transaction with pre-save validation, SoCai/SoCaiVT posting, and integrity assertions
"""

from __future__ import annotations

import calendar
from datetime import date
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.repositories.ledger_posting import (
    delete_voucher_ledgers,
    pair_gl_journal_entries,
    post_gl_voucher,
    post_inventory_voucher,
)
from app.repositories.voucher.helpers import increment_voucher_number
from app.repositories.voucher_repo import voucher_repository
from app.schemas.module_voucher import (
    GlLedgerResponse,
    GlLedgerRow,
    ModuleVoucherDetailResponse,
    ModuleVoucherDetailSchema,
    ModuleVoucherHeaderSchema,
    ModuleVoucherPageResponse,
    ModuleVoucherSaveRequest,
    PartnerBalancePageResponse,
    PartnerBalanceRow,
    PartnerLedgerResponse,
    PartnerLedgerRow,
    TrialBalanceResponse,
    TrialBalanceRow,
)
from app.utils.errors import SqlUnavailableError, is_sql_connection_error
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.repositories.module_voucher")

_DOC_SPECS: Dict[str, Dict[str, Any]] = {
    "purchase": {
        "header_table": "CtMH",
        "detail_table": "CtMH0",
        "default_ma_ct": "N1",
        "default_nh_ct": "1",
        "has_ngay_ps": True,
        "has_tax": True,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "inventory",
    },
    "inv-io": {
        "header_table": "CtNX",
        "detail_table": "CtNX0",
        "default_ma_ct": "NX",
        "default_nh_ct": "1",
        "has_ngay_ps": True,
        "has_tax": False,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "inventory",
    },
    "inv-transfer": {
        "header_table": "CtCK",
        "detail_table": "CtCK0",
        "default_ma_ct": "CK",
        "default_nh_ct": "2",
        "has_ngay_ps": True,
        "has_tax": False,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "transfer",
    },
    "gl-voucher": {
        "header_table": "CtK",
        "detail_table": "CtK0",
        "default_ma_ct": "PK",
        "default_nh_ct": "1",
        "has_ngay_ps": False,
        "has_tax": False,
        "has_ma_nx": False,
        "has_posted": False,
        "detail_kind": "gl",
    },
}


def _escape_like(val: str) -> str:
    return (
        str(val)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
        .replace("[", "\\[")
    )


def _month_bounds(ngay_ct: Optional[str]) -> Tuple[str, str]:
    target = date.today()
    if ngay_ct and ngay_ct.strip():
        try:
            parts = [int(p) for p in ngay_ct.strip()[:10].split("-")]
            if len(parts) == 3:
                target = date(parts[0], parts[1], parts[2])
        except Exception:
            pass
    last_day = calendar.monthrange(target.year, target.month)[1]
    return (
        f"{target.year:04d}-{target.month:02d}-01",
        f"{target.year:04d}-{target.month:02d}-{last_day:02d}",
    )


def _reraise_if_sql_unavailable(exc: Exception) -> None:
    if is_sql_connection_error(exc):
        raise SqlUnavailableError() from exc


class ModuleVoucherRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self.fn_tcvn = f"{self.vp_db}.dbo.fn_UnicodeToTCVN"

    def _validate_module(self, module_key: str) -> Dict[str, Any]:
        spec = _DOC_SPECS.get(module_key)
        if not spec:
            raise ValueError(f"Phân hệ không hợp lệ: {module_key}")
        return spec

    def _exec_check_number(
        self,
        cur: Any,
        ma_dvcs: str,
        moi_sua: str,
        stt: str,
        ma_ct: str,
        ngay_ct: str,
        so_ct: str,
    ) -> bool:
        try:
            cur.execute(
                f"""
                SET NOCOUNT ON;
                DECLARE @p_Check bit = 0;
                EXEC {self.vp_db}.dbo.ST_Check_Number
                    @p_Ma_DvCs=?, @p_Moi_Sua=?, @p_Stt=?,
                    @p_Ma_Ct=?, @p_Ngay_Ct=?, @p_So_Ct=?,
                    @p_Check=@p_Check OUTPUT;
                SELECT @p_Check;
                """,
                [ma_dvcs or "S1", moi_sua or "M", stt or "", ma_ct, ngay_ct[:10], so_ct],
            )
            res = cur.fetchone()
            return bool(res[0]) if res else False
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            logger.warning(f"ST_Check_Number fallback check ({ma_ct}/{so_ct}): {exc}")
            return False

    def get_next_voucher_number(
        self,
        module_key: str,
        ma_ct: Optional[str] = None,
        ngay_ct: Optional[str] = None,
        ma_dvcs: str = "S1",
        cur: Optional[Any] = None,
    ) -> str:
        spec = self._validate_module(module_key)
        hdr = spec["header_table"]
        clean_ma_ct = (ma_ct or spec["default_ma_ct"]).strip().upper()
        d1, d2 = _month_bounds(ngay_ct)
        lock_hint = "" if cur is not None else "WITH (NOLOCK)"

        def _query(sql: str, params: List[Any]) -> List[str]:
            if cur is not None:
                cur.execute(sql, params)
                rows = cur.fetchall()
            else:
                try:
                    with get_db_cursor(self.vp_db) as c:
                        c.execute(sql, params)
                        rows = c.fetchall()
                except Exception as exc:
                    _reraise_if_sql_unavailable(exc)
                    raise
            return [(r[0] or "").strip() for r in rows if r and r[0]]

        # 1. Try max So_Ct in the target month
        in_month = _query(
            f"""
            SELECT LTRIM(RTRIM(So_Ct))
            FROM {self.vp_db}.dbo.{hdr} {lock_hint}
            WHERE Ma_Ct = ? AND Ngay_Ct >= ? AND Ngay_Ct <= ? AND ISNULL(So_Ct, '') <> ''
            ORDER BY Ngay_Ct DESC, Stt DESC
            """,
            [clean_ma_ct, d1, d2],
        )
        best_val = -1
        best_str = ""
        for s in in_month:
            m = re.search(r"(\d+)$", s)
            if m:
                val = int(m.group(1))
                if val > best_val:
                    best_val = val
                    best_str = s

        if best_str:
            candidate = increment_voucher_number(best_str)
        else:
            # 2. Check VTSYS.dbo.DocumentNumber for prefix/last number
            last_rows = _query(
                f"""
                SELECT TOP 1 LTRIM(RTRIM(ISNULL(So_Ct_Last, '')))
                FROM {self.sys_db}.dbo.DocumentNumber {lock_hint}
                WHERE Ma_DvCs = ? AND Ma_Ct = ?
                """,
                [ma_dvcs or "S1", clean_ma_ct],
            )
            if last_rows and last_rows[0]:
                candidate = increment_voucher_number(last_rows[0])
            else:
                candidate = f"{clean_ma_ct}00001"

        if cur is not None:
            for _ in range(50):
                if not self._exec_check_number(cur, ma_dvcs, "M", "", clean_ma_ct, ngay_ct or d2, candidate):
                    break
                candidate = increment_voucher_number(candidate)
        return candidate

    def _check_and_reserve_number(
        self,
        cur: Any,
        module_key: str,
        ma_dvcs: str,
        mode: str,
        stt: str,
        ma_ct: str,
        ngay_ct: str,
        raw_so_ct: str,
        custom_so_ct: bool,
    ) -> str:
        clean_so_ct = (raw_so_ct or "").strip()
        if mode == "M":
            resource = f"MV_{ma_dvcs}_{ma_ct}_{ngay_ct[:7]}"
            try:
                cur.execute(
                    "SET NOCOUNT ON; DECLARE @rc int; "
                    "EXEC @rc = sp_getapplock @Resource=?, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000; "
                    "SELECT @rc;",
                    [resource],
                )
            except Exception as exc:
                logger.debug(f"sp_getapplock skipped: {exc}")

        if not clean_so_ct:
            return self.get_next_voucher_number(
                module_key=module_key, ma_ct=ma_ct, ngay_ct=ngay_ct, ma_dvcs=ma_dvcs, cur=cur
            )

        is_dup = self._exec_check_number(cur, ma_dvcs, mode, stt, ma_ct, ngay_ct, clean_so_ct)
        if is_dup:
            if custom_so_ct or mode == "S":
                raise ValueError(f"Số chứng từ '{clean_so_ct}' đã tồn tại trong kỳ!")
            candidate = clean_so_ct
            for _ in range(50):
                candidate = increment_voucher_number(candidate)
                if not self._exec_check_number(cur, ma_dvcs, mode, stt, ma_ct, ngay_ct, candidate):
                    return candidate
            raise ValueError(f"Không thể cấp số chứng từ tự động cho '{clean_so_ct}'.")
        return clean_so_ct

    def list_vouchers(
        self,
        module_key: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        ma_ct: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> ModuleVoucherPageResponse:
        spec = self._validate_module(module_key)
        safe_page = max(1, int(page))
        safe_size = max(1, min(500, int(page_size)))
        clean_q = (q or "").strip()
        clean_ma_ct = (ma_ct or "").strip().upper()

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        offset = (safe_page - 1) * safe_size

        where_parts: List[str] = []
        params: List[Any] = []
        if clean_ma_ct and clean_ma_ct != "ALL":
            where_parts.append("h.Ma_Ct = ?")
            params.append(clean_ma_ct)
        if from_date and from_date.strip():
            where_parts.append("h.Ngay_Ct >= ?")
            params.append(from_date.strip()[:10])
        if to_date and to_date.strip():
            where_parts.append("h.Ngay_Ct <= ?")
            params.append(to_date.strip()[:10])
        if clean_q:
            esc = f"%{_escape_like(clean_q.upper())}%"
            esc_uni = f"%{_escape_like(clean_q)}%"
            where_parts.append(
                f"(UPPER(RTRIM(ISNULL(h.So_Ct,''))) LIKE ? ESCAPE '\\' "
                f"OR UPPER(RTRIM(ISNULL(h.Ma_Dt,''))) LIKE ? ESCAPE '\\' "
                f"OR {self.fn_uni}(ISNULL(h.Dien_Giai0,'')) LIKE ? ESCAPE '\\')"
            )
            params.extend([esc, esc, esc_uni])

        where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        posted_col = "ISNULL(h.Posted, 1)" if spec["has_posted"] else "ISNULL(h.Confirmed, 1)"
        tk_col = "RTRIM(ISNULL(h.Tk, ''))" if module_key != "gl-voucher" else "''"
        ma_nx_col = "RTRIM(ISNULL(h.Ma_Nx, ''))" if spec["has_ma_nx"] else "''"
        extra_hdr_cols = (
            "RTRIM(ISNULL(h.Ma_HD, '')), RTRIM(ISNULL(h.Ma_Bp, '')), RTRIM(ISNULL(h.Ma_Km, '')), RTRIM(ISNULL(h.Ma_Xe, ''))"
            if module_key != "gl-voucher"
            else "'', '', '', ''"
        )
        tax_cols = (
            "ISNULL(h.TTien_Nt0, 0), ISNULL(h.TTien_Nt3, 0), RTRIM(ISNULL(h.So_Ct0, '')), h.Ngay_Ct0, "
            "RTRIM(ISNULL(h.So_Seri0, '')), RTRIM(ISNULL(h.Ma_Thue, '')), ISNULL(h.Thue_GTGT, 0), "
            f"RTRIM(ISNULL(h.Tk3, '')), RTRIM(ISNULL(h.Tk_Du3, '')), RTRIM(ISNULL(h.Ma_DtGtGt, '')), {self.fn_uni}(ISNULL(h.Ten_DtGtGt, '')), ''"
            if spec["has_tax"]
            else (
                "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0, '', '', '', '', RTRIM(ISNULL(h.Ct_Di_Kem, ''))"
                if module_key == "gl-voucher"
                else "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0, '', '', '', '', ''"
            )
        )

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT COUNT(1), ISNULL(SUM(ISNULL(h.TTien_Nt, 0)), 0) "
                    f"FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK) {where_sql}",
                    params,
                )
                agg = cur.fetchone()
                total_records = int(agg[0] or 0) if agg else 0
                total_amount = float(agg[1] or 0.0) if agg else 0.0

                items: List[ModuleVoucherHeaderSchema] = []
                if total_records > 0 and offset < total_records:
                    sql = f"""
                        ;WITH PageCTE AS (
                            SELECT h.Stt
                            FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK)
                            {where_sql}
                            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                        )
                        SELECT
                            RTRIM(h.Stt),
                            RTRIM(ISNULL(h.Ma_DvCs, 'S1')),
                            RTRIM(ISNULL(h.Ma_Ct, '')),
                            RTRIM(ISNULL(h.Nh_Ct, '1')),
                            h.Ngay_Ct,
                            LTRIM(RTRIM(ISNULL(h.So_Ct, ''))),
                            LTRIM(RTRIM(ISNULL(h.Ma_Dt, ''))),
                            {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                            {self.fn_uni}(ISNULL(h.Ong_Ba, '')),
                            {self.fn_uni}(ISNULL(h.Dia_Chi, '')),
                            {self.fn_uni}(ISNULL(h.Dien_Giai0, '')),
                            {ma_nx_col},
                            {tk_col},
                            {extra_hdr_cols},
                            RTRIM(ISNULL(h.Ma_Tte, 'VND')),
                            ISNULL(h.Ty_Gia, 1),
                            {tax_cols},
                            ISNULL(h.TTien_Nt, 0),
                            {posted_col},
                            ISNULL(h.Confirmed, 1),
                            LTRIM(RTRIM(ISNULL(h.UserName, '')))
                        FROM PageCTE p
                        JOIN {self.vp_db}.dbo.{hdr} h WITH (NOLOCK) ON h.Stt = p.Stt
                        LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = h.Ma_Dt
                        ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                    """
                    cur.execute(sql, [*params, offset, safe_size])
                    rows = cur.fetchall()

                    stts = [(r[0] or "").strip() for r in rows if r[0]]
                    counts: Dict[str, int] = {}
                    if stts:
                        ph = ",".join(["?"] * len(stts))
                        cur.execute(
                            f"SELECT RTRIM(Stt), COUNT(1) FROM {self.vp_db}.dbo.{dtl} WITH (NOLOCK) "
                            f"WHERE Stt IN ({ph}) GROUP BY Stt",
                            stts,
                        )
                        for cr in cur.fetchall():
                            counts[(cr[0] or "").strip()] = int(cr[1] or 0)

                    for r in rows:
                        stt_val = (r[0] or "").strip()
                        items.append(
                            ModuleVoucherHeaderSchema(
                                stt=stt_val,
                                ma_dvcs=(r[1] or "S1").strip(),
                                ma_ct=(r[2] or "").strip(),
                                nh_ct=(r[3] or "1").strip(),
                                ngay_ct=r[4].strftime("%Y-%m-%d") if r[4] else "",
                                so_ct=(r[5] or "").strip(),
                                ma_dt=(r[6] or "").strip(),
                                ten_dt=(r[7] or "").strip(),
                                ong_ba=(r[8] or "").strip(),
                                dia_chi=(r[9] or "").strip(),
                                dien_giai0=(r[10] or "").strip(),
                                ma_nx=(r[11] or "").strip(),
                                tk=(r[12] or "").strip(),
                                ma_hd=(r[13] or "").strip(),
                                ma_bp=(r[14] or "").strip(),
                                ma_km=(r[15] or "").strip(),
                                ma_xe=(r[16] or "").strip(),
                                ma_tte=(r[17] or "VND").strip(),
                                ty_gia=float(r[18] or 1.0),
                                ttien_nt0=float(r[19] or 0.0),
                                ttien_nt3=float(r[20] or 0.0),
                                so_ct0=(r[21] or "").strip(),
                                ngay_ct0=r[22].strftime("%Y-%m-%d") if r[22] else None,
                                so_seri0=(r[23] or "").strip(),
                                ma_thue=(r[24] or "").strip(),
                                thue_gtgt=float(r[25] or 0.0),
                                tk3=(r[26] or "").strip(),
                                tk_du3=(r[27] or "").strip(),
                                ma_dtgtgt=(r[28] or "").strip(),
                                ten_dtgtgt=(r[29] or "").strip(),
                                ct_di_kem=(r[30] or "").strip(),
                                ttien_nt=float(r[31] or 0.0),
                                posted=bool(r[32]),
                                confirmed=bool(r[33]),
                                user_name=(r[34] or "").strip(),
                                item_count=counts.get(stt_val, 0),
                            )
                        )

                total_pages = max(1, (total_records + safe_size - 1) // safe_size)
                return ModuleVoucherPageResponse(
                    items=items,
                    total_records=total_records,
                    page=safe_page,
                    page_size=safe_size,
                    total_pages=total_pages,
                    total_amount=total_amount,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    def get_voucher(self, module_key: str, stt: str) -> Optional[ModuleVoucherDetailResponse]:
        spec = self._validate_module(module_key)
        clean_stt = (stt or "").strip()
        if not clean_stt:
            return None

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        kind = spec["detail_kind"]
        posted_col = "ISNULL(h.Posted, 1)" if spec["has_posted"] else "ISNULL(h.Confirmed, 1)"
        tk_col = "RTRIM(ISNULL(h.Tk, ''))" if module_key != "gl-voucher" else "''"
        ma_nx_col = "RTRIM(ISNULL(h.Ma_Nx, ''))" if spec["has_ma_nx"] else "''"
        extra_hdr_cols = (
            "RTRIM(ISNULL(h.Ma_HD, '')), RTRIM(ISNULL(h.Ma_Bp, '')), RTRIM(ISNULL(h.Ma_Km, '')), RTRIM(ISNULL(h.Ma_Xe, ''))"
            if module_key != "gl-voucher"
            else "'', '', '', ''"
        )
        tax_cols = (
            "ISNULL(h.TTien_Nt0, 0), ISNULL(h.TTien_Nt3, 0), RTRIM(ISNULL(h.So_Ct0, '')), h.Ngay_Ct0, "
            "RTRIM(ISNULL(h.So_Seri0, '')), RTRIM(ISNULL(h.Ma_Thue, '')), ISNULL(h.Thue_GTGT, 0), "
            f"RTRIM(ISNULL(h.Tk3, '')), RTRIM(ISNULL(h.Tk_Du3, '')), RTRIM(ISNULL(h.Ma_DtGtGt, '')), {self.fn_uni}(ISNULL(h.Ten_DtGtGt, '')), ''"
            if spec["has_tax"]
            else (
                "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0, '', '', '', '', RTRIM(ISNULL(h.Ct_Di_Kem, ''))"
                if module_key == "gl-voucher"
                else "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0, '', '', '', '', ''"
            )
        )

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"""
                    SELECT
                        RTRIM(h.Stt),
                        RTRIM(ISNULL(h.Ma_DvCs, 'S1')),
                        RTRIM(ISNULL(h.Ma_Ct, '')),
                        RTRIM(ISNULL(h.Nh_Ct, '1')),
                        h.Ngay_Ct,
                        LTRIM(RTRIM(ISNULL(h.So_Ct, ''))),
                        LTRIM(RTRIM(ISNULL(h.Ma_Dt, ''))),
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(h.Ong_Ba, '')),
                        {self.fn_uni}(ISNULL(h.Dia_Chi, '')),
                        {self.fn_uni}(ISNULL(h.Dien_Giai0, '')),
                        {ma_nx_col},
                        {tk_col},
                        {extra_hdr_cols},
                        RTRIM(ISNULL(h.Ma_Tte, 'VND')),
                        ISNULL(h.Ty_Gia, 1),
                        {tax_cols},
                        ISNULL(h.TTien_Nt, 0),
                        {posted_col},
                        ISNULL(h.Confirmed, 1),
                        LTRIM(RTRIM(ISNULL(h.UserName, '')))
                    FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK)
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = h.Ma_Dt
                    WHERE h.Stt = ?
                    """,
                    [clean_stt],
                )
                hr = cur.fetchone()
                if not hr:
                    return None

                if kind == "gl":
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(b.Stt0), RTRIM(b.Stt), ISNULL(b.Stt_NV, 1),
                            RTRIM(ISNULL(b.No_Co, 'N')), RTRIM(ISNULL(b.Tk, '')),
                            ISNULL(b.Tien_Nt, 0), ISNULL(b.Tien, 0),
                            {self.fn_uni}(ISNULL(b.Dien_Giai, '')),
                            RTRIM(ISNULL(b.Ma_Dt, '')), RTRIM(ISNULL(b.Ma_Bp, '')),
                            RTRIM(ISNULL(b.Ma_Km, '')), RTRIM(ISNULL(b.Ma_Sp, '')),
                            RTRIM(ISNULL(b.Ma_Hd, ''))
                        FROM {self.vp_db}.dbo.{dtl} b WITH (NOLOCK)
                        WHERE b.Stt = ? ORDER BY ISNULL(b.Stt_NV, 0), b.Stt0
                        """,
                        [clean_stt],
                    )
                    items = [
                        ModuleVoucherDetailSchema(
                            stt0=(r[0] or "").strip(),
                            stt=(r[1] or "").strip(),
                            stt_nv=int(r[2] or 1),
                            no_co=(r[3] or "N").strip(),
                            tk=(r[4] or "").strip(),
                            tien_nt=float(r[5] or 0.0),
                            tien=float(r[6] or 0.0),
                            dien_giai=(r[7] or "").strip(),
                            ma_dt=(r[8] or "").strip(),
                            ma_bp=(r[9] or "").strip(),
                            ma_km=(r[10] or "").strip(),
                            ma_sp=(r[11] or "").strip(),
                            ma_hd=(r[12] or "").strip(),
                        )
                        for r in cur.fetchall()
                    ]
                else:
                    kho_n_col = "RTRIM(ISNULL(b.Ma_KhoN, ''))" if kind == "transfer" else "''"
                    tien3_cols = (
                        "ISNULL(b.Tien_Nt3, 0), ISNULL(b.Tien3, 0)"
                        if spec["has_tax"]
                        else "0, 0"
                    )
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(b.Stt0), RTRIM(b.Stt),
                            RTRIM(ISNULL(b.Ma_Kho, '')), {kho_n_col},
                            RTRIM(ISNULL(b.Ma_Vt, '')), {self.fn_uni}(ISNULL(v.Ten_Vt, '')),
                            {self.fn_uni}(ISNULL(b.Dvt, '')),
                            ISNULL(b.He_So9, 1), ISNULL(b.So_Luong9, ISNULL(b.So_Luong, 0)),
                            ISNULL(b.Gia_Nt9, ISNULL(b.Gia_Nt, 0)), ISNULL(b.Gia9, ISNULL(b.Gia, 0)),
                            ISNULL(b.Tien_Nt9, ISNULL(b.Tien_Nt, 0)), ISNULL(b.Tien9, ISNULL(b.Tien, 0)),
                            ISNULL(b.So_Luong, 0), ISNULL(b.Gia_Nt, 0), ISNULL(b.Gia, 0),
                            ISNULL(b.Tien_Nt, 0), ISNULL(b.Tien, 0),
                            {tien3_cols},
                            ISNULL(b.Gia_Tb_TT, ' '),
                            RTRIM(ISNULL(b.Tk, '')), RTRIM(ISNULL(b.Tk_Du, '')),
                            RTRIM(ISNULL(b.Ma_Sp, ''))
                        FROM {self.vp_db}.dbo.{dtl} b WITH (NOLOCK)
                        LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = b.Ma_Vt
                        WHERE b.Stt = ? ORDER BY b.Stt0
                        """,
                        [clean_stt],
                    )
                    items = [
                        ModuleVoucherDetailSchema(
                            stt0=(r[0] or "").strip(),
                            stt=(r[1] or "").strip(),
                            ma_kho=(r[2] or "").strip(),
                            ma_kho_n=(r[3] or "").strip(),
                            ma_vt=(r[4] or "").strip(),
                            ten_vt=(r[5] or "").strip(),
                            dvt=(r[6] or "").strip(),
                            he_so9=float(r[7] or 1.0),
                            so_luong9=float(r[8] or 0.0),
                            gia_nt9=float(r[9] or 0.0),
                            gia9=float(r[10] or 0.0),
                            tien_nt9=float(r[11] or 0.0),
                            tien9=float(r[12] or 0.0),
                            so_luong=float(r[13] or 0.0),
                            gia_nt=float(r[14] or 0.0),
                            gia=float(r[15] or 0.0),
                            tien_nt=float(r[16] or 0.0),
                            tien=float(r[17] or 0.0),
                            tien_nt3=float(r[18] or 0.0),
                            tien3=float(r[19] or 0.0),
                            gia_tb_tt=(r[20] or " ").strip()[:1] or " ",
                            tk=(r[21] or "").strip(),
                            tk_du=(r[22] or "").strip(),
                            ma_sp=(r[23] or "").strip(),
                        )
                        for r in cur.fetchall()
                    ]

                return ModuleVoucherDetailResponse(
                    stt=(hr[0] or "").strip(),
                    ma_dvcs=(hr[1] or "S1").strip(),
                    ma_ct=(hr[2] or "").strip(),
                    nh_ct=(hr[3] or "1").strip(),
                    ngay_ct=hr[4].strftime("%Y-%m-%d") if hr[4] else "",
                    so_ct=(hr[5] or "").strip(),
                    ma_dt=(hr[6] or "").strip(),
                    ten_dt=(hr[7] or "").strip(),
                    ong_ba=(hr[8] or "").strip(),
                    dia_chi=(hr[9] or "").strip(),
                    dien_giai0=(hr[10] or "").strip(),
                    ma_nx=(hr[11] or "").strip(),
                    tk=(hr[12] or "").strip(),
                    ma_hd=(hr[13] or "").strip(),
                    ma_bp=(hr[14] or "").strip(),
                    ma_km=(hr[15] or "").strip(),
                    ma_xe=(hr[16] or "").strip(),
                    ma_tte=(hr[17] or "VND").strip(),
                    ty_gia=float(hr[18] or 1.0),
                    ttien_nt0=float(hr[19] or 0.0),
                    ttien_nt3=float(hr[20] or 0.0),
                    so_ct0=(hr[21] or "").strip(),
                    ngay_ct0=hr[22].strftime("%Y-%m-%d") if hr[22] else None,
                    so_seri0=(hr[23] or "").strip(),
                    ma_thue=(hr[24] or "").strip(),
                    thue_gtgt=float(hr[25] or 0.0),
                    tk3=(hr[26] or "").strip(),
                    tk_du3=(hr[27] or "").strip(),
                    ma_dtgtgt=(hr[28] or "").strip(),
                    ten_dtgtgt=(hr[29] or "").strip(),
                    ct_di_kem=(hr[30] or "").strip(),
                    ttien_nt=float(hr[31] or 0.0),
                    posted=bool(hr[32]),
                    confirmed=bool(hr[33]),
                    user_name=(hr[34] or "").strip(),
                    item_count=len(items),
                    items=items,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    def _validate_and_normalize_items(
        self,
        cur: Any,
        module_key: str,
        spec: Dict[str, Any],
        req: ModuleVoucherSaveRequest,
    ) -> Tuple[List[Dict[str, Any]], float, float, float, float, float, float, str]:
        """Validate catalogs (DmDt, DmNx, DmVt, DmKho, DmTk) & normalize *9 quantities/amounts."""
        kind = spec["detail_kind"]
        ma_tte = (req.ma_tte or "VND").strip().upper() or "VND"
        is_vnd = ma_tte == "VND"
        ty_gia = float(req.ty_gia or 1.0)
        if ty_gia <= 0:
            ty_gia = 1.0
        if is_vnd:
            ty_gia = 1.0

        # Validate Ma_Dt
        clean_ma_dt = (req.ma_dt or "").strip().upper()
        if module_key != "gl-voucher" and not clean_ma_dt:
            raise ValueError("Mã đối tượng (Ma_Dt) là bắt buộc.")
        if clean_ma_dt:
            cur.execute(
                f"SELECT TOP 1 1 FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE RTRIM(Ma_Dt) = ?",
                [clean_ma_dt],
            )
            if cur.fetchone() is None:
                raise ValueError(f"Mã đối tượng '{clean_ma_dt}' không tồn tại trong danh mục DmDt!")

        # Validate Ma_Nx & read Dinh_Khoan
        clean_ma_nx = (req.ma_nx or "").strip().upper()
        dinh_khoan = "C"
        if spec["has_ma_nx"]:
            if not clean_ma_nx:
                raise ValueError("Mã nhập xuất (Ma_Nx) là bắt buộc.")
            cur.execute(
                f"SELECT TOP 1 RTRIM(ISNULL(Dinh_Khoan, 'C')) FROM {self.sys_db}.dbo.DmNx WITH (NOLOCK) WHERE RTRIM(Ma_Nx) = ?",
                [clean_ma_nx],
            )
            nx_row = cur.fetchone()
            if nx_row is None:
                raise ValueError(f"Mã nhập xuất '{clean_ma_nx}' không tồn tại trong danh mục DmNx!")
            dinh_khoan = (nx_row[0] or "C").strip().upper()

        # Collect catalog codes for batch existence validation
        vt_codes = sorted({(it.ma_vt or "").strip().upper() for it in req.items if (it.ma_vt or "").strip()})
        kho_codes = sorted(
            {
                c
                for it in req.items
                for c in ((it.ma_kho or "").strip().upper(), (it.ma_kho_n or "").strip().upper())
                if c
            }
        )
        tk_codes = sorted(
            {
                t
                for t in (
                    (req.tk or "").strip(),
                    (req.tk3 or "").strip(),
                    (req.tk_du3 or "").strip(),
                    *[((it.tk or "").strip()) for it in req.items],
                    *[((it.tk_du or "").strip()) for it in req.items],
                )
                if t
            }
        )

        if kind != "gl":
            if not vt_codes:
                raise ValueError("Chứng từ vật tư phải có ít nhất 1 mã vật tư hợp lệ.")
            ph = ",".join(["?"] * len(vt_codes))
            cur.execute(
                f"SELECT UPPER(RTRIM(Ma_Vt)) FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK) WHERE Ma_Vt IN ({ph})",
                vt_codes,
            )
            found_vt = {r[0] for r in cur.fetchall() if r and r[0]}
            missing_vt = [c for c in vt_codes if c not in found_vt]
            if missing_vt:
                raise ValueError(f"Mã vật tư không tồn tại trong DmVt: {', '.join(missing_vt)}")

        if kho_codes:
            ph = ",".join(["?"] * len(kho_codes))
            cur.execute(
                f"SELECT UPPER(RTRIM(Ma_Kho)) FROM {self.sys_db}.dbo.DmKho WITH (NOLOCK) WHERE Ma_Kho IN ({ph})",
                kho_codes,
            )
            found_kho = {r[0] for r in cur.fetchall() if r and r[0]}
            missing_kho = [c for c in kho_codes if c not in found_kho]
            if missing_kho:
                raise ValueError(f"Mã kho không tồn tại trong DmKho: {', '.join(missing_kho)}")

        if tk_codes:
            ph = ",".join(["?"] * len(tk_codes))
            cur.execute(
                f"SELECT RTRIM(Tk) FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK) WHERE Tk IN ({ph})",
                tk_codes,
            )
            found_tk = {r[0] for r in cur.fetchall() if r and r[0]}
            missing_tk = [c for c in tk_codes if c not in found_tk]
            if missing_tk:
                raise ValueError(f"Số tài khoản không tồn tại trong DmTk: {', '.join(missing_tk)}")

        # Normalize rows
        normalized: List[Dict[str, Any]] = []
        sum_goods_nt = 0.0
        sum_goods_vnd = 0.0
        sum_tax_nt = 0.0
        sum_tax_vnd = 0.0
        tax_rate = float(req.thue_gtgt or 0.0)

        for idx, it in enumerate(req.items, start=1):
            if kind == "gl":
                tk_val = (it.tk or "").strip()
                if not tk_val:
                    raise ValueError(f"Dòng {idx}: Thiếu số tài khoản (Tk).")
                no_co = (it.no_co or "N").strip().upper()[:1]
                if no_co not in ("N", "C"):
                    raise ValueError(f"Dòng {idx}: Ps Nợ/Có phải là 'N' hoặc 'C'.")
                tien_nt = float(it.tien_nt or 0.0)
                if tien_nt <= 0:
                    raise ValueError(f"Dòng {idx}: Số tiền phải lớn hơn 0.")
                tien_nt = float(round_vnd(tien_nt)) if is_vnd else round_amount(tien_nt, 2)
                tien_vnd = float(round_vnd(tien_nt * ty_gia))
                row_dt = (it.ma_dt or "").strip().upper()
                normalized.append(
                    {
                        "stt_nv": int(it.stt_nv or 1),
                        "no_co": no_co,
                        "tk": tk_val,
                        "tien_nt": tien_nt,
                        "tien": tien_vnd,
                        "dien_giai": (it.dien_giai or req.dien_giai0 or "").strip(),
                        "ma_dt": row_dt or clean_ma_dt,
                        "ma_bp": (it.ma_bp or "").strip().upper(),
                        "ma_km": (it.ma_km or "").strip().upper(),
                        "ma_sp": (it.ma_sp or "").strip().upper(),
                        "ma_hd": (it.ma_hd or "").strip().upper(),
                    }
                )
                if no_co == "N":
                    sum_goods_nt += tien_nt
                    sum_goods_vnd += tien_vnd
            else:
                ma_vt = (it.ma_vt or "").strip().upper()
                ma_kho = (it.ma_kho or "").strip().upper()
                ma_kho_n = (it.ma_kho_n or "").strip().upper()
                if not ma_vt:
                    raise ValueError(f"Dòng {idx}: Thiếu mã vật tư.")
                if not ma_kho:
                    raise ValueError(f"Dòng {idx}: Thiếu mã kho.")
                if kind == "transfer":
                    if not ma_kho_n:
                        raise ValueError(f"Dòng {idx}: Thiếu mã kho nhận (Kho đến).")
                    if ma_kho_n == ma_kho:
                        raise ValueError(f"Dòng {idx}: Kho nhận ({ma_kho_n}) phải khác Kho xuất ({ma_kho}).")

                he_so9 = float(it.he_so9 or 1.0)
                if he_so9 <= 0:
                    he_so9 = 1.0
                so_luong9 = float(it.so_luong9 if it.so_luong9 else it.so_luong or 0.0)
                if so_luong9 <= 0:
                    raise ValueError(f"Dòng {idx}: Số lượng phải lớn hơn 0.")
                so_luong = round_amount(so_luong9 * he_so9, 4)

                gia_nt9 = float(it.gia_nt9 if it.gia_nt9 else it.gia_nt or 0.0)
                raw_tien_nt9 = float(it.tien_nt9 if it.tien_nt9 else it.tien_nt or 0.0)
                if raw_tien_nt9 == 0.0 and gia_nt9 > 0.0:
                    raw_tien_nt9 = so_luong9 * gia_nt9
                elif gia_nt9 == 0.0 and raw_tien_nt9 > 0.0 and so_luong9 > 0.0:
                    gia_nt9 = raw_tien_nt9 / so_luong9

                tien_nt9 = float(round_vnd(raw_tien_nt9)) if is_vnd else round_amount(raw_tien_nt9, 2)
                gia_nt9 = round_amount(gia_nt9, 4)
                gia9 = round_amount(gia_nt9 * ty_gia, 4)
                tien9 = float(round_vnd(tien_nt9 * ty_gia))

                tien_nt = tien_nt9
                tien_vnd = tien9
                gia_nt = round_amount(tien_nt / so_luong, 4) if so_luong > 0 else 0.0
                gia_vnd = round_amount(tien_vnd / so_luong, 4) if so_luong > 0 else 0.0

                tien_nt3 = 0.0
                tien3 = 0.0
                if spec["has_tax"]:
                    if it.tien_nt3 and float(it.tien_nt3) > 0:
                        tien_nt3 = float(round_vnd(it.tien_nt3)) if is_vnd else round_amount(float(it.tien_nt3), 2)
                    elif tax_rate > 0:
                        raw_t3 = tien_nt * tax_rate / 100.0
                        tien_nt3 = float(round_vnd(raw_t3)) if is_vnd else round_amount(raw_t3, 2)
                    tien3 = float(round_vnd(tien_nt3 * ty_gia))

                normalized.append(
                    {
                        "ma_kho": ma_kho,
                        "ma_kho_n": ma_kho_n,
                        "ma_vt": ma_vt,
                        "dvt": (it.dvt or "").strip(),
                        "he_so9": he_so9,
                        "so_luong9": so_luong9,
                        "gia_nt9": gia_nt9,
                        "gia9": gia9,
                        "tien_nt9": tien_nt9,
                        "tien9": tien9,
                        "so_luong": so_luong,
                        "gia_nt": gia_nt,
                        "gia": gia_vnd,
                        "tien_nt": tien_nt,
                        "tien": tien_vnd,
                        "tien_nt3": tien_nt3,
                        "tien3": tien3,
                        "gia_tb_tt": (it.gia_tb_tt or " ").strip()[:1] or " ",
                        "tk": (it.tk or req.tk or "").strip(),
                        "tk_du": (it.tk_du or "").strip(),
                        "ma_sp": (it.ma_sp or "").strip().upper(),
                        "ma_hd": (it.ma_hd or "").strip().upper(),
                        "ma_bp": (it.ma_bp or "").strip().upper(),
                        "ma_km": (it.ma_km or "").strip().upper(),
                        "dien_giai": (it.dien_giai or "").strip(),
                    }
                )
                sum_goods_nt += tien_nt
                sum_goods_vnd += tien_vnd
                sum_tax_nt += tien_nt3
                sum_tax_vnd += tien3

        if kind == "gl":
            # Validate balanced Nợ == Có per Stt_NV before touching DB tables
            pair_gl_journal_entries(normalized)

        sum_goods_nt = float(round_vnd(sum_goods_nt)) if is_vnd else round_amount(sum_goods_nt, 2)
        sum_goods_vnd = float(round_vnd(sum_goods_vnd))
        sum_tax_nt = float(round_vnd(sum_tax_nt)) if is_vnd else round_amount(sum_tax_nt, 2)
        sum_tax_vnd = float(round_vnd(sum_tax_vnd))
        total_all_nt = float(round_vnd(sum_goods_nt + sum_tax_nt)) if is_vnd else round_amount(sum_goods_nt + sum_tax_nt, 2)
        total_all_vnd = float(round_vnd(sum_goods_vnd + sum_tax_vnd))
        return (
            normalized,
            sum_goods_nt,
            sum_goods_vnd,
            sum_tax_nt,
            sum_tax_vnd,
            total_all_nt,
            total_all_vnd,
            dinh_khoan,
        )

    def save_voucher(
        self,
        module_key: str,
        req: ModuleVoucherSaveRequest,
        stt_override: Optional[str] = None,
    ) -> ModuleVoucherDetailResponse:
        spec = self._validate_module(module_key)
        if not req.ngay_ct or not req.ngay_ct.strip():
            raise ValueError("Ngày chứng từ là bắt buộc.")
        if not req.items:
            raise ValueError("Chứng từ phải có ít nhất 1 dòng chi tiết.")

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        kind = spec["detail_kind"]
        ma_dvcs = (req.ma_dvcs or "S1").strip() or "S1"
        ngay_ct = req.ngay_ct.strip()[:10]
        ma_ct = (req.ma_ct or spec["default_ma_ct"]).strip().upper()
        nh_ct = (req.nh_ct or spec["default_nh_ct"]).strip() or "1"
        mode = "S" if (stt_override and stt_override.strip()) else "M"

        # Closing date check (CHỐT 1)
        ngay_kt_ht = voucher_repository.get_closing_date(ma_dvcs)
        if ngay_kt_ht and ngay_ct <= ngay_kt_ht:
            raise ValueError(
                f"Ngày chứng từ ({ngay_ct}) nằm trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!"
            )

        ma_tte = (req.ma_tte or "VND").strip().upper() or "VND"
        ty_gia = 1.0 if ma_tte == "VND" else float(req.ty_gia or 1.0)
        if ty_gia <= 0:
            ty_gia = 1.0

        try:
            with get_db_transaction(self.vp_db) as (_, cur):
                (
                    norm_items,
                    sum_goods_nt,
                    sum_goods_vnd,
                    sum_tax_nt,
                    sum_tax_vnd,
                    total_all_nt,
                    total_all_vnd,
                    dinh_khoan,
                ) = self._validate_and_normalize_items(cur, module_key, spec, req)

                stt = (
                    voucher_repository.generate_stt(ma_dvcs, cur)
                    if mode == "M"
                    else stt_override.strip()
                )
                final_so_ct = self._check_and_reserve_number(
                    cur=cur,
                    module_key=module_key,
                    ma_dvcs=ma_dvcs,
                    mode=mode,
                    stt="" if mode == "M" else stt,
                    ma_ct=ma_ct,
                    ngay_ct=ngay_ct,
                    raw_so_ct=req.so_ct or "",
                    custom_so_ct=bool(req.custom_so_ct),
                )

                clean_ma_dt = (req.ma_dt or "").strip().upper()
                clean_ma_nx = (req.ma_nx or "").strip().upper()
                clean_tk = (req.tk or "").strip()
                clean_ma_hd = (req.ma_hd or "").strip().upper() or None
                clean_ma_bp = (req.ma_bp or "").strip().upper() or None
                clean_ma_km = (req.ma_km or "").strip().upper() or None
                clean_ma_xe = (req.ma_xe or "").strip().upper() or None
                posted = bool(req.posted if req.posted is not None else True)

                if module_key == "gl-voucher":
                    if mode == "M":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, So_Ct, Ngay_Ct, Ma_Dt, Ong_Ba, Dia_Chi, Dien_Giai0,
                             Ct_Di_Kem, Ma_Tte, Ty_Gia, TTien_Nt, TTien, Confirmed, UserName)
                            VALUES (?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?),
                                    ?, ?, ?, ?, ?, 1, ?)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, final_so_ct, ngay_ct,
                                clean_ma_dt or None, req.ong_ba or "", req.dia_chi or "", req.dien_giai0 or "",
                                (req.ct_di_kem or "").strip()[:20] or None,
                                ma_tte, ty_gia, total_all_nt, total_all_vnd, req.user_name or "ADMIN",
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ma_Ct=?, Nh_Ct=?, So_Ct=?, Ngay_Ct=?, Ma_Dt=?, Ong_Ba={self.fn_tcvn}(?),
                                Dia_Chi={self.fn_tcvn}(?), Dien_Giai0={self.fn_tcvn}(?), Ct_Di_Kem=?,
                                Ma_Tte=?, Ty_Gia=?, TTien_Nt=?, TTien=?
                            WHERE Stt=?
                            """,
                            [
                                ma_ct, nh_ct, final_so_ct, ngay_ct, clean_ma_dt or None,
                                req.ong_ba or "", req.dia_chi or "", req.dien_giai0 or "",
                                (req.ct_di_kem or "").strip()[:20] or None,
                                ma_tte, ty_gia, total_all_nt, total_all_vnd, stt,
                            ],
                        )
                elif module_key == "purchase":
                    tk3 = (req.tk3 or ("1331" if sum_tax_vnd > 0 else "")).strip() or None
                    tk_du3 = (req.tk_du3 or (clean_tk or "3311" if sum_tax_vnd > 0 else "")).strip() or None
                    if mode == "M":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ngay_Ct, Ngay_Ps, So_Ct, Ma_HD, Ma_Dt, Ong_Ba, Dia_Chi,
                             Dien_Giai0, Ma_Nx, Ma_Km, Ma_Bp, Ma_Xe, Tk, Tk3, Tk_Du3,
                             TTien_Nt0, TTien_Nt3, TTien_Nt, TTien0, TTien3, TTien,
                             Ma_Thue, Thue_GTGT, Ma_Tte, Ty_Gia, Posted, Confirmed, UserName,
                             Ma_DtGtGt, Ten_DtGtGt, So_Ct0, So_Seri0, Ngay_Ct0)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?),
                                    {self.fn_tcvn}(?), ?, ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?, ?, ?, 1, ?,
                                    ?, {self.fn_tcvn}(?), ?, ?, ?)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, ngay_ct, ngay_ct, final_so_ct, clean_ma_hd,
                                clean_ma_dt, req.ong_ba or "", req.dia_chi or "", req.dien_giai0 or "",
                                clean_ma_nx, clean_ma_km, clean_ma_bp, clean_ma_xe, clean_tk or "3311",
                                tk3, tk_du3,
                                sum_goods_nt, sum_tax_nt, total_all_nt,
                                sum_goods_vnd, sum_tax_vnd, total_all_vnd,
                                (req.ma_thue or "").strip() or None, float(req.thue_gtgt or 0.0),
                                ma_tte, ty_gia, 1 if posted else 0, req.user_name or "ADMIN",
                                (req.ma_dtgtgt or "").strip() or None, req.ten_dtgtgt or "",
                                (req.so_ct0 or "").strip() or None, (req.so_seri0 or "").strip() or None,
                                (req.ngay_ct0 or "").strip()[:10] or None,
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ma_Ct=?, Nh_Ct=?, Ngay_Ct=?, Ngay_Ps=?, So_Ct=?, Ma_HD=?, Ma_Dt=?,
                                Ong_Ba={self.fn_tcvn}(?), Dia_Chi={self.fn_tcvn}(?), Dien_Giai0={self.fn_tcvn}(?),
                                Ma_Nx=?, Ma_Km=?, Ma_Bp=?, Ma_Xe=?, Tk=?, Tk3=?, Tk_Du3=?,
                                TTien_Nt0=?, TTien_Nt3=?, TTien_Nt=?, TTien0=?, TTien3=?, TTien=?,
                                Ma_Thue=?, Thue_GTGT=?, Ma_Tte=?, Ty_Gia=?,
                                Ma_DtGtGt=?, Ten_DtGtGt={self.fn_tcvn}(?), So_Ct0=?, So_Seri0=?, Ngay_Ct0=?, Posted=?
                            WHERE Stt=?
                            """,
                            [
                                ma_ct, nh_ct, ngay_ct, ngay_ct, final_so_ct, clean_ma_hd, clean_ma_dt,
                                req.ong_ba or "", req.dia_chi or "", req.dien_giai0 or "",
                                clean_ma_nx, clean_ma_km, clean_ma_bp, clean_ma_xe, clean_tk or "3311",
                                tk3, tk_du3,
                                sum_goods_nt, sum_tax_nt, total_all_nt,
                                sum_goods_vnd, sum_tax_vnd, total_all_vnd,
                                (req.ma_thue or "").strip() or None, float(req.thue_gtgt or 0.0),
                                ma_tte, ty_gia,
                                (req.ma_dtgtgt or "").strip() or None, req.ten_dtgtgt or "",
                                (req.so_ct0 or "").strip() or None, (req.so_seri0 or "").strip() or None,
                                (req.ngay_ct0 or "").strip()[:10] or None, 1 if posted else 0,
                                stt,
                            ],
                        )
                else:
                    if mode == "M":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ma_Tte, Ty_Gia, TTien_Nt, TTien, Ngay_Ps, Ngay_Ct,
                             So_Ct, Ma_HD, Ma_Dt, Ong_Ba, Dia_Chi, Dien_Giai0,
                             Ma_Bp, Ma_Km, Ma_Nx, Tk, Ma_Xe, UserName, Posted, Confirmed)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?),
                                    ?, ?, ?, ?, ?, ?, ?, 1)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, ma_tte, ty_gia,
                                total_all_nt, total_all_vnd, ngay_ct, ngay_ct,
                                final_so_ct, clean_ma_hd, clean_ma_dt,
                                req.ong_ba or "", req.dia_chi or "", req.dien_giai0 or "",
                                clean_ma_bp, clean_ma_km, clean_ma_nx, clean_tk or None, clean_ma_xe,
                                req.user_name or "ADMIN", 1 if posted else 0,
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ma_Ct=?, Nh_Ct=?, Ma_Tte=?, Ty_Gia=?, Ngay_Ct=?, Ngay_Ps=?, So_Ct=?,
                                Ma_HD=?, Ma_Dt=?, Ong_Ba={self.fn_tcvn}(?), Dia_Chi={self.fn_tcvn}(?),
                                Dien_Giai0={self.fn_tcvn}(?), Ma_Bp=?, Ma_Km=?, Ma_Nx=?, Tk=?, Ma_Xe=?,
                                TTien_Nt=?, TTien=?, Posted=?
                            WHERE Stt=?
                            """,
                            [
                                ma_ct, nh_ct, ma_tte, ty_gia, ngay_ct, ngay_ct, final_so_ct,
                                clean_ma_hd, clean_ma_dt, req.ong_ba or "", req.dia_chi or "",
                                req.dien_giai0 or "", clean_ma_bp, clean_ma_km, clean_ma_nx,
                                clean_tk or None, clean_ma_xe, total_all_nt, total_all_vnd,
                                1 if posted else 0, stt,
                            ],
                        )

                # Replace detail rows
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?", [stt])
                stt0_list = voucher_repository.generate_stts_batch(ma_dvcs, len(norm_items), cur)
                for it, stt0 in zip(norm_items, stt0_list):
                    it["stt0"] = stt0
                    if kind == "gl":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Stt_NV, Dien_Giai, No_Co, Tk, Tien_Nt, Tien, Ma_Dt, Ma_Bp, Ma_Km, Ma_Sp, Ma_Hd)
                            VALUES (?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it["stt_nv"], it["dien_giai"],
                                it["no_co"], it["tk"], it["tien_nt"], it["tien"],
                                it["ma_dt"] or None, it["ma_bp"] or None, it["ma_km"] or None,
                                it["ma_sp"] or None, it["ma_hd"] or None,
                            ],
                        )
                    elif kind == "transfer":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Tk, Tk_Du, Ma_Sp, Ma_Kho, Ma_KhoN, Ma_Vt, Dvt,
                             He_So9, So_Luong9, Gia_Nt9, Gia9, Tien_Nt9, Tien9,
                             So_Luong, Gia_Nt, Gia, Tien_Nt, Tien, Gia_Tb_TT)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?),
                                    ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it["tk"] or None, it["tk_du"] or None, it["ma_sp"] or None,
                                it["ma_kho"], it["ma_kho_n"], it["ma_vt"], it["dvt"],
                                it["he_so9"], it["so_luong9"], it["gia_nt9"], it["gia9"], it["tien_nt9"], it["tien9"],
                                it["so_luong"], it["gia_nt"], it["gia"], it["tien_nt"], it["tien"],
                                it["gia_tb_tt"],
                            ],
                        )
                    elif spec["has_tax"]:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Ma_Sp, Ma_Kho, Ma_Vt, Dvt,
                             He_So9, So_Luong9, Gia_Nt9, Gia9, Tien_Nt9, Tien9,
                             So_Luong, Gia_Nt, Gia, Tien_Nt, Tien, Tien_Nt3, Tien3,
                             Gia_Tb_TT, Tk, Tk_Du)
                            VALUES (?, ?, ?, ?, ?, {self.fn_tcvn}(?),
                                    ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?)
                            """,
                            [
                                stt0, stt, it["ma_sp"] or None, it["ma_kho"], it["ma_vt"], it["dvt"],
                                it["he_so9"], it["so_luong9"], it["gia_nt9"], it["gia9"], it["tien_nt9"], it["tien9"],
                                it["so_luong"], it["gia_nt"], it["gia"], it["tien_nt"], it["tien"],
                                it["tien_nt3"], it["tien3"], it["gia_tb_tt"],
                                it["tk"] or None, it["tk_du"] or None,
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Tk, Tk_Du, Ma_Sp, Ma_Kho, Ma_Vt, Dvt,
                             He_So9, So_Luong9, Gia_Nt9, Gia9, Tien_Nt9, Tien9,
                             So_Luong, Gia_Nt, Gia, Tien_Nt, Tien, Gia_Tb_TT)
                            VALUES (?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?),
                                    ?, ?, ?, ?, ?, ?,
                                    ?, ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it["tk"] or None, it["tk_du"] or None,
                                it["ma_sp"] or None, it["ma_kho"], it["ma_vt"], it["dvt"],
                                it["he_so9"], it["so_luong9"], it["gia_nt9"], it["gia9"], it["tien_nt9"], it["tien9"],
                                it["so_luong"], it["gia_nt"], it["gia"], it["tien_nt"], it["tien"],
                                it["gia_tb_tt"],
                            ],
                        )

                # Delete old ledger rows on edit BEFORE reposting (anti-duplication rule)
                if mode == "S":
                    delete_voucher_ledgers(cur, self.vp_db, stt, include_inventory=(kind != "gl"))

                # Post SoCai & SoCaiVT in the same ACID transaction
                if kind == "gl":
                    posted_sum = post_gl_voucher(
                        cur,
                        self.vp_db,
                        self.fn_tcvn,
                        ma_dvcs=ma_dvcs,
                        stt=stt,
                        ma_ct=ma_ct,
                        nh_ct=nh_ct,
                        ngay_ct=ngay_ct,
                        so_ct=final_so_ct,
                        ma_dt0=clean_ma_dt,
                        ong_ba=req.ong_ba or "",
                        dien_giai0=req.dien_giai0 or "",
                        ma_tte=ma_tte,
                        ty_gia=ty_gia,
                        detail_rows=norm_items,
                    )
                    if abs(posted_sum - total_all_vnd) > 1.0:
                        raise RuntimeError(
                            f"Lỗi toàn vẹn sổ cái CtK ({stt}): SoCai={posted_sum} != Header={total_all_vnd}"
                        )
                else:
                    post_inventory_voucher(
                        cur,
                        self.vp_db,
                        self.fn_tcvn,
                        module_key=module_key,
                        ma_dvcs=ma_dvcs,
                        stt=stt,
                        ma_ct=ma_ct,
                        nh_ct=nh_ct,
                        ngay_ct=ngay_ct,
                        so_ct=final_so_ct,
                        ma_dt=clean_ma_dt,
                        ong_ba=req.ong_ba or "",
                        dien_giai0=req.dien_giai0 or "",
                        ma_nx=clean_ma_nx,
                        header_tk=clean_tk,
                        tk3=(req.tk3 or "1331").strip(),
                        tk_du3=(req.tk_du3 or clean_tk or "3311").strip(),
                        ma_tte=ma_tte,
                        ty_gia=ty_gia,
                        ma_hd=clean_ma_hd or "",
                        ma_bp=clean_ma_bp or "",
                        ma_xe=clean_ma_xe or "",
                        ma_km=clean_ma_km or "",
                        user_name=req.user_name or "ADMIN",
                        posted=posted,
                        dinh_khoan=dinh_khoan,
                        detail_rows=norm_items,
                        total_tax_nt=sum_tax_nt,
                        total_tax_vnd=sum_tax_vnd,
                    )

                # Integrity Assertion before COMMIT
                if kind == "gl":
                    cur.execute(
                        f"SELECT COUNT(1), ISNULL(SUM(CASE WHEN No_Co='N' THEN Tien_Nt ELSE 0 END), 0), "
                        f"ISNULL(SUM(CASE WHEN No_Co='C' THEN Tien_Nt ELSE 0 END), 0) "
                        f"FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?",
                        [stt],
                    )
                    chk = cur.fetchone()
                    if not chk or int(chk[0] or 0) != len(norm_items):
                        raise RuntimeError(f"Integrity mismatch ({dtl} count) for {stt}")
                    if abs(float(chk[1] or 0) - float(chk[2] or 0)) > 0.01:
                        raise RuntimeError(f"Integrity mismatch (Debit != Credit) for {stt}")
                else:
                    cur.execute(
                        f"SELECT COUNT(1), ISNULL(SUM(ISNULL(Tien_Nt, 0)), 0) FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?",
                        [stt],
                    )
                    chk = cur.fetchone()
                    if not chk or int(chk[0] or 0) != len(norm_items):
                        raise RuntimeError(f"Integrity mismatch ({dtl} count) for {stt}")
                    if abs(float(chk[1] or 0) - sum_goods_nt) > 1.0:
                        raise RuntimeError(
                            f"Integrity mismatch ({dtl} SUM={chk[1]} != {sum_goods_nt}) for {stt}"
                        )

                # Save last voucher number in VTSYS
                try:
                    cur.execute(
                        f"SET NOCOUNT ON; EXEC {self.sys_db}.dbo.ST_Save_Number @p_Ma_DvCs=?, @p_Ma_Ct=?, @p_So_Ct=?",
                        [ma_dvcs, ma_ct, final_so_ct],
                    )
                except Exception as exc:
                    logger.warning(f"ST_Save_Number warning ({ma_ct}): {exc}")

            detail = self.get_voucher(module_key, stt)
            if not detail:
                raise RuntimeError(f"Không đọc lại được chứng từ vừa lưu ({stt}).")
            return detail
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    def delete_voucher(self, module_key: str, stt: str, user_name: str = "ADMIN") -> dict:
        spec = self._validate_module(module_key)
        clean_stt = (stt or "").strip()
        if not clean_stt:
            raise ValueError("Thiếu Stt chứng từ cần xóa.")

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        kind = spec["detail_kind"]

        try:
            with get_db_transaction(self.vp_db) as (_, cur):
                cur.execute(
                    f"SELECT Ngay_Ct, RTRIM(ISNULL(Ma_DvCs, 'S1')) FROM {self.vp_db}.dbo.{hdr} WITH (NOLOCK) WHERE Stt = ?",
                    [clean_stt],
                )
                row = cur.fetchone()
                if not row:
                    raise ValueError(f"Không tìm thấy chứng từ '{clean_stt}'.")

                ngay_ct = row[0].strftime("%Y-%m-%d") if row[0] else ""
                ma_dvcs = (row[1] or "S1").strip()
                ngay_kt_ht = voucher_repository.get_closing_date(ma_dvcs)
                if ngay_kt_ht and ngay_ct and ngay_ct <= ngay_kt_ht:
                    raise ValueError(
                        f"Không thể xóa chứng từ trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!"
                    )

                sp_name = f"{hdr}_Delete"
                try:
                    cur.execute(
                        f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.{sp_name} @p_Stt=?, @p_UserName=?",
                        [clean_stt, user_name or "ADMIN"],
                    )
                except Exception as sp_exc:
                    _reraise_if_sql_unavailable(sp_exc)
                    logger.warning(f"{sp_name} warning, executing cascaded SQL delete: {sp_exc}")
                    delete_voucher_ledgers(cur, self.vp_db, clean_stt, include_inventory=(kind != "gl"))
                    cur.execute(f"DELETE FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?", [clean_stt])
                    cur.execute(f"DELETE FROM {self.vp_db}.dbo.{hdr} WHERE Stt = ?", [clean_stt])

                return {"stt": clean_stt}
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    # =========================================================================
    # Công nợ Phải thu (131) & Phải trả (331) từ SoCai + CdK
    # =========================================================================
    def get_partner_balances(
        self,
        tk_prefix: str = "131",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> PartnerBalancePageResponse:
        prefix = (tk_prefix or "131").strip()
        like_tk = f"{prefix}%"
        safe_page = max(1, int(page))
        safe_size = max(1, min(500, int(page_size)))
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                q_filter = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_filter = (
                        f" AND (UPPER(RTRIM(d.Ma_Dt)) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(d.Ten_Dt, '')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                sql = f"""
                    ;WITH Agg AS (
                        SELECT
                            RTRIM(Ma_Dt) AS Ma_Dt,
                            SUM(Du_No_Dau) AS Du_No_Dau,
                            SUM(Du_Co_Dau) AS Du_Co_Dau,
                            SUM(Ps_No) AS Ps_No,
                            SUM(Ps_Co) AS Ps_Co,
                            SUM(TxCount) AS TxCount
                        FROM (
                            SELECT Ma_Dt, ISNULL(Du_No, 0) AS Du_No_Dau, ISNULL(Du_Co, 0) AS Du_Co_Dau, 0 AS Ps_No, 0 AS Ps_Co, 0 AS TxCount
                            FROM {self.vp_db}.dbo.CdK WITH (NOLOCK)
                            WHERE Tk LIKE ? AND ISNULL(Ma_Dt, '') <> ''
                            UNION ALL
                            SELECT Ma_Dt_No AS Ma_Dt, ISNULL(Tien, 0), 0, 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_No LIKE ? AND ISNULL(Ma_Dt_No, '') <> '' AND Ngay_Ct < ?
                            UNION ALL
                            SELECT Ma_Dt_Co AS Ma_Dt, 0, ISNULL(Tien, 0), 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_Co LIKE ? AND ISNULL(Ma_Dt_Co, '') <> '' AND Ngay_Ct < ?
                            UNION ALL
                            SELECT Ma_Dt_No AS Ma_Dt, 0, 0, ISNULL(Tien, 0), 0, 1
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_No LIKE ? AND ISNULL(Ma_Dt_No, '') <> '' AND Ngay_Ct >= ? AND Ngay_Ct <= ?
                            UNION ALL
                            SELECT Ma_Dt_Co AS Ma_Dt, 0, 0, 0, ISNULL(Tien, 0), 1
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_Co LIKE ? AND ISNULL(Ma_Dt_Co, '') <> '' AND Ngay_Ct >= ? AND Ngay_Ct <= ?
                        ) raw_agg
                        GROUP BY RTRIM(Ma_Dt)
                    )
                    SELECT
                        a.Ma_Dt,
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(d.Dia_Chi, '')),
                        a.Du_No_Dau, a.Du_Co_Dau, a.Ps_No, a.Ps_Co, a.TxCount
                    FROM Agg a
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON RTRIM(d.Ma_Dt) = a.Ma_Dt
                    WHERE (ABS(a.Du_No_Dau - a.Du_Co_Dau) > 0.01 OR ABS(a.Ps_No) > 0.01 OR ABS(a.Ps_Co) > 0.01)
                    {q_filter}
                    ORDER BY a.Ma_Dt ASC
                """
                cur.execute(
                    sql,
                    [
                        like_tk,
                        like_tk, d1,
                        like_tk, d1,
                        like_tk, d1, d2,
                        like_tk, d1, d2,
                        *q_params,
                    ],
                )
                all_rows: List[PartnerBalanceRow] = []
                s_nd = s_cd = s_pn = s_pc = s_nc = s_cc = 0.0
                for r in cur.fetchall():
                    open_net = float(r[3] or 0) - float(r[4] or 0)
                    du_no_dau = open_net if open_net > 0 else 0.0
                    du_co_dau = -open_net if open_net < 0 else 0.0
                    ps_no = float(r[5] or 0)
                    ps_co = float(r[6] or 0)
                    close_net = open_net + ps_no - ps_co
                    du_no_cuoi = close_net if close_net > 0 else 0.0
                    du_co_cuoi = -close_net if close_net < 0 else 0.0

                    s_nd += du_no_dau
                    s_cd += du_co_dau
                    s_pn += ps_no
                    s_pc += ps_co
                    s_nc += du_no_cuoi
                    s_cc += du_co_cuoi

                    all_rows.append(
                        PartnerBalanceRow(
                            ma_dt=(r[0] or "").strip(),
                            ten_dt=(r[1] or "").strip(),
                            dia_chi=(r[2] or "").strip(),
                            du_no_dau=du_no_dau,
                            du_co_dau=du_co_dau,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            du_no_cuoi=du_no_cuoi,
                            du_co_cuoi=du_co_cuoi,
                            tx_count=int(r[7] or 0),
                        )
                    )

                total = len(all_rows)
                off = (safe_page - 1) * safe_size
                return PartnerBalancePageResponse(
                    tk_prefix=prefix,
                    items=all_rows[off : off + safe_size],
                    total_records=total,
                    page=safe_page,
                    page_size=safe_size,
                    total_pages=max(1, (total + safe_size - 1) // safe_size),
                    sum_du_no_dau=s_nd,
                    sum_du_co_dau=s_cd,
                    sum_ps_no=s_pn,
                    sum_ps_co=s_pc,
                    sum_du_no_cuoi=s_nc,
                    sum_du_co_cuoi=s_cc,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    def get_partner_ledger(
        self,
        tk_prefix: str,
        ma_dt: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> PartnerLedgerResponse:
        prefix = (tk_prefix or "131").strip()
        like_tk = f"{prefix}%"
        clean_dt = (ma_dt or "").strip().upper()
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]

        if not clean_dt:
            return PartnerLedgerResponse(tk_prefix=prefix, ma_dt="", entries=[])

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT {self.fn_uni}(ISNULL(Ten_Dt, '')) FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE RTRIM(Ma_Dt) = ?",
                    [clean_dt],
                )
                r_dt = cur.fetchone()
                ten_dt = (r_dt[0] or "").strip() if r_dt else ""

                cur.execute(
                    f"""
                    SELECT
                        ISNULL((SELECT SUM(ISNULL(Du_No, 0) - ISNULL(Du_Co, 0)) FROM {self.vp_db}.dbo.CdK WITH (NOLOCK) WHERE Tk LIKE ? AND RTRIM(Ma_Dt) = ?), 0)
                        + ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_No LIKE ? AND RTRIM(Ma_Dt_No) = ? AND Ngay_Ct < ?), 0)
                        - ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_Co LIKE ? AND RTRIM(Ma_Dt_Co) = ? AND Ngay_Ct < ?), 0)
                    """,
                    [like_tk, clean_dt, like_tk, clean_dt, d1, like_tk, clean_dt, d1],
                )
                du_dau = float(cur.fetchone()[0] or 0.0)

                cur.execute(
                    f"""
                    SELECT
                        RTRIM(Stt), Ngay_Ct, RTRIM(Ma_Ct), LTRIM(RTRIM(ISNULL(So_Ct, ''))),
                        {self.fn_uni}(ISNULL(Dien_Giai, '')),
                        RTRIM(Tk_No), RTRIM(Tk_Co), ISNULL(Tien, 0)
                    FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                    WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                      AND ((Tk_No LIKE ? AND RTRIM(Ma_Dt_No) = ?) OR (Tk_Co LIKE ? AND RTRIM(Ma_Dt_Co) = ?))
                    ORDER BY Ngay_Ct ASC, So_Ct ASC, SoCaiID ASC
                    """,
                    [d1, d2, like_tk, clean_dt, like_tk, clean_dt],
                )
                running = du_dau
                entries: List[PartnerLedgerRow] = []
                for r in cur.fetchall():
                    tk_no = (r[5] or "").strip()
                    tk_co = (r[6] or "").strip()
                    amt = float(r[7] or 0.0)
                    is_debit = tk_no.startswith(prefix)
                    ps_no = amt if is_debit else 0.0
                    ps_co = amt if not is_debit else 0.0
                    running += ps_no - ps_co
                    entries.append(
                        PartnerLedgerRow(
                            stt=(r[0] or "").strip(),
                            ngay_ct=r[1].strftime("%Y-%m-%d") if r[1] else "",
                            ma_ct=(r[2] or "").strip(),
                            so_ct=(r[3] or "").strip(),
                            dien_giai=(r[4] or "").strip(),
                            tk=tk_no if is_debit else tk_co,
                            tk_du=tk_co if is_debit else tk_no,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            luy_ke=running,
                        )
                    )
                return PartnerLedgerResponse(
                    tk_prefix=prefix,
                    ma_dt=clean_dt,
                    ten_dt=ten_dt,
                    du_dau=du_dau,
                    du_cuoi=running,
                    entries=entries,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    # =========================================================================
    # Kế toán Tổng hợp: Cân đối phát sinh (CĐPS) & Sổ cái tài khoản
    # =========================================================================
    def get_trial_balance(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
    ) -> TrialBalanceResponse:
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                q_sql = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_sql = (
                        f" AND (UPPER(RTRIM(t.Tk)) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(t.Ten_Tk, '')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                sql = f"""
                    ;WITH Agg AS (
                        SELECT
                            RTRIM(Tk) AS Tk,
                            SUM(Du_No_Dau) AS Du_No_Dau,
                            SUM(Du_Co_Dau) AS Du_Co_Dau,
                            SUM(Ps_No) AS Ps_No,
                            SUM(Ps_Co) AS Ps_Co
                        FROM (
                            SELECT Tk, ISNULL(Du_No, 0) AS Du_No_Dau, ISNULL(Du_Co, 0) AS Du_Co_Dau, 0 AS Ps_No, 0 AS Ps_Co
                            FROM {self.vp_db}.dbo.CdK WITH (NOLOCK)
                            UNION ALL
                            SELECT Tk_No AS Tk, ISNULL(Tien, 0), 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct < ?
                            UNION ALL
                            SELECT Tk_Co AS Tk, 0, ISNULL(Tien, 0), 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct < ?
                            UNION ALL
                            SELECT Tk_No AS Tk, 0, 0, ISNULL(Tien, 0), 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                            UNION ALL
                            SELECT Tk_Co AS Tk, 0, 0, 0, ISNULL(Tien, 0)
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                        ) x
                        GROUP BY RTRIM(Tk)
                    )
                    SELECT
                        a.Tk,
                        {self.fn_uni}(ISNULL(t.Ten_Tk, '')),
                        ISNULL(t.Bac_Tk, 1),
                        a.Du_No_Dau, a.Du_Co_Dau, a.Ps_No, a.Ps_Co
                    FROM Agg a
                    LEFT JOIN {self.sys_db}.dbo.DmTk t WITH (NOLOCK) ON RTRIM(t.Tk) = a.Tk
                    WHERE (ABS(a.Du_No_Dau - a.Du_Co_Dau) > 0.01 OR ABS(a.Ps_No) > 0.01 OR ABS(a.Ps_Co) > 0.01)
                    {q_sql}
                    ORDER BY a.Tk ASC
                """
                cur.execute(sql, [d1, d1, d1, d2, d1, d2, *q_params])
                items: List[TrialBalanceRow] = []
                s_nd = s_cd = s_pn = s_pc = s_nc = s_cc = 0.0
                for r in cur.fetchall():
                    open_net = float(r[3] or 0) - float(r[4] or 0)
                    nd = open_net if open_net > 0 else 0.0
                    cd = -open_net if open_net < 0 else 0.0
                    pn = float(r[5] or 0)
                    pc = float(r[6] or 0)
                    close_net = open_net + pn - pc
                    nc = close_net if close_net > 0 else 0.0
                    cc = -close_net if close_net < 0 else 0.0
                    s_nd += nd
                    s_cd += cd
                    s_pn += pn
                    s_pc += pc
                    s_nc += nc
                    s_cc += cc
                    items.append(
                        TrialBalanceRow(
                            tk=(r[0] or "").strip(),
                            ten_tk=(r[1] or "").strip(),
                            bac_tk=int(r[2] or 1),
                            du_no_dau=nd,
                            du_co_dau=cd,
                            ps_no=pn,
                            ps_co=pc,
                            du_no_cuoi=nc,
                            du_co_cuoi=cc,
                        )
                    )
                return TrialBalanceResponse(
                    items=items,
                    sum_du_no_dau=s_nd,
                    sum_du_co_dau=s_cd,
                    sum_ps_no=s_pn,
                    sum_ps_co=s_pc,
                    sum_du_no_cuoi=s_nc,
                    sum_du_co_cuoi=s_cc,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise

    def get_gl_ledger(
        self,
        tk: str = "1111",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
    ) -> GlLedgerResponse:
        clean_tk = (tk or "1111").strip().upper()
        like_tk = f"{clean_tk}%"
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT {self.fn_uni}(ISNULL(Ten_Tk, '')) FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK) WHERE RTRIM(Tk) = ?",
                    [clean_tk],
                )
                r_tk = cur.fetchone()
                ten_tk = (r_tk[0] or "").strip() if r_tk else ""

                cur.execute(
                    f"""
                    SELECT
                        ISNULL((SELECT SUM(ISNULL(Du_No, 0) - ISNULL(Du_Co, 0)) FROM {self.vp_db}.dbo.CdK WITH (NOLOCK) WHERE Tk LIKE ?), 0)
                        + ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_No LIKE ? AND Ngay_Ct < ?), 0)
                        - ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_Co LIKE ? AND Ngay_Ct < ?), 0)
                    """,
                    [like_tk, like_tk, d1, like_tk, d1],
                )
                du_dau = float(cur.fetchone()[0] or 0.0)

                q_sql = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_sql = (
                        f" AND (UPPER(ISNULL(s.So_Ct,'')) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(s.Dien_Giai,'')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                cur.execute(
                    f"""
                    SELECT
                        RTRIM(s.Stt), s.Ngay_Ct, RTRIM(s.Ma_Ct), LTRIM(RTRIM(ISNULL(s.So_Ct, ''))),
                        RTRIM(COALESCE(NULLIF(s.Ma_Dt_No,''), NULLIF(s.Ma_Dt_Co,''), s.Ma_Dt0, '')),
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(s.Dien_Giai, '')),
                        RTRIM(s.Tk_No), RTRIM(s.Tk_Co), ISNULL(s.Tien, 0)
                    FROM {self.vp_db}.dbo.SoCai s WITH (NOLOCK)
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK)
                      ON d.Ma_Dt = COALESCE(NULLIF(s.Ma_Dt_No,''), NULLIF(s.Ma_Dt_Co,''), s.Ma_Dt0)
                    WHERE s.Ngay_Ct >= ? AND s.Ngay_Ct <= ?
                      AND (s.Tk_No LIKE ? OR s.Tk_Co LIKE ?)
                      {q_sql}
                    ORDER BY s.Ngay_Ct ASC, s.So_Ct ASC, s.SoCaiID ASC
                    """,
                    [d1, d2, like_tk, like_tk, *q_params],
                )
                running = du_dau
                entries: List[GlLedgerRow] = []
                for r in cur.fetchall():
                    tk_no = (r[7] or "").strip()
                    tk_co = (r[8] or "").strip()
                    amt = float(r[9] or 0.0)
                    is_no = tk_no.startswith(clean_tk)
                    ps_no = amt if is_no else 0.0
                    ps_co = amt if not is_no else 0.0
                    running += ps_no - ps_co
                    entries.append(
                        GlLedgerRow(
                            stt=(r[0] or "").strip(),
                            ngay_ct=r[1].strftime("%Y-%m-%d") if r[1] else "",
                            ma_ct=(r[2] or "").strip(),
                            so_ct=(r[3] or "").strip(),
                            ma_dt=(r[4] or "").strip(),
                            ten_dt=(r[5] or "").strip(),
                            dien_giai=(r[6] or "").strip(),
                            tk_no=tk_no,
                            tk_co=tk_co,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            luy_ke=running,
                        )
                    )
                return GlLedgerResponse(
                    tk=clean_tk,
                    ten_tk=ten_tk,
                    du_dau=du_dau,
                    du_cuoi=running,
                    entries=entries,
                )
        except Exception as exc:
            _reraise_if_sql_unavailable(exc)
            raise


module_voucher_repository = ModuleVoucherRepository()
