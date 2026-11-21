"""Repository for Cash & Bank Vouchers (CtT / CtT0: C1, C2, C3, C4), Ledger, and Excel Import."""

from datetime import date
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.repositories.ledger_posting import ensure_cash_voucher_socai
from app.repositories.voucher.helpers import increment_voucher_number
from app.repositories.voucher_repo import voucher_repository
from app.schemas.cash_voucher import (
    BaoCoImportCommitRequest,
    BaoCoImportCommitResponse,
    BaoCoImportPreviewResponse,
    BaoCoImportRowPreview,
    CashLedgerEntry,
    CashLedgerResponse,
    CashVoucherCreateRequest,
    CashVoucherDeleteResponse,
    CashVoucherDetailResponse,
    CashVoucherDetailSchema,
    CashVoucherHeaderSchema,
    CashVoucherListResponse,
    CashVoucherSaveResponse,
    CashVoucherSummary,
)
from app.schemas.voucher import VoucherListPagination
from app.utils.excel_parser import (
    clean_cell_text as _clean_cell_text,
    parse_amount as _parse_amount,
    parse_excel_date as _parse_excel_date,
    parse_tabular_upload,
    parse_xlsx_rows,
)
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.repositories.cash_voucher")

_NH_CT_BY_MA_CT: Dict[str, str] = {
    "C1": "1",  # Phiếu thu tiền mặt
    "C2": "2",  # Phiếu chi tiền mặt
    "C3": "1",  # Báo có ngân hàng
    "C4": "2",  # Báo nợ ngân hàng
}

_CTT0_BATCH_SIZE = 50


class CashVoucherRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self.fn_tcvn = f"{self.vp_db}.dbo.fn_UnicodeToTCVN"

    def _build_where(
        self,
        ma_ct: Optional[str] = "C1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
        dien_giai: Optional[str] = None,
    ) -> Tuple[str, List[Any]]:
        where_clauses: List[str] = []
        params: List[Any] = []

        if ma_ct and ma_ct.strip().upper() not in ("ALL", ""):
            where_clauses.append("h.Ma_Ct = ?")
            params.append(ma_ct.strip().upper())
        else:
            where_clauses.append("h.Ma_Ct IN ('C1', 'C2', 'C3', 'C4')")

        if ngay_ct1:
            where_clauses.append("h.Ngay_Ct >= ?")
            params.append(ngay_ct1)
        if ngay_ct2:
            where_clauses.append("h.Ngay_Ct <= ?")
            params.append(ngay_ct2)
        if so_ct1:
            where_clauses.append("h.So_Ct >= ?")
            params.append(so_ct1)
        if so_ct2:
            where_clauses.append("h.So_Ct <= ?")
            params.append(so_ct2)
        if ma_dt:
            where_clauses.append("h.Ma_Dt0 = ?")
            params.append(ma_dt.strip().upper())
        if ma_tte:
            where_clauses.append("h.Ma_Tte = ?")
            params.append(ma_tte.strip().upper())
        if tien_nt1 is not None:
            where_clauses.append("h.TTien_Nt0 >= ?")
            params.append(tien_nt1)
        if tien_nt2 is not None:
            where_clauses.append("h.TTien_Nt0 <= ?")
            params.append(tien_nt2)
        if filter_by_user and filter_by_user.strip():
            where_clauses.append("h.UserName = ?")
            params.append(filter_by_user.strip())
        if dien_giai and dien_giai.strip():
            where_clauses.append(f"{self.fn_uni}(h.Dien_Giai0) LIKE ?")
            params.append(f"%{dien_giai.strip()}%")
        if tk and tk.strip():
            tk_like = f"{tk.strip()}%"
            where_clauses.append(
                f"EXISTS (SELECT 1 FROM {self.vp_db}.dbo.CtT0 dv WITH (NOLOCK) "
                f"WHERE dv.Stt = h.Stt AND (dv.Tk_No LIKE ? OR dv.Tk_Co LIKE ?))"
            )
            params.extend([tk_like, tk_like])

        return " AND ".join(where_clauses), params

    def _row_to_header(self, r: Any) -> CashVoucherHeaderSchema:
        ma_ct = (r[2] or "C1").strip().upper()
        nh_ct = (r[4] or _NH_CT_BY_MA_CT.get(ma_ct, "1")).strip()
        tk_no_first = (r[29] or "").strip() if len(r) > 29 else ""
        tk_co_first = (r[30] or "").strip() if len(r) > 30 else ""
        # Thu (Nh_Ct == 1): TK chính là Tk_No, đối ứng là Tk_Co; Chi (Nh_Ct == 2): ngược lại
        if nh_ct == "1":
            tk_chinh, tk_doi_ung = tk_no_first, tk_co_first
        else:
            tk_chinh, tk_doi_ung = tk_co_first, tk_no_first

        return CashVoucherHeaderSchema(
            stt=(r[0] or "").strip(),
            ma_dvcs=(r[1] or "S1").strip(),
            ma_ct=ma_ct,
            kieu_ct=(r[3] or " "),
            nh_ct=nh_ct,
            ngay_ct=r[5].strftime("%Y-%m-%d") if r[5] else "",
            so_ct=(r[6] or "").strip(),
            so_seri=(r[7] or "").strip(),
            ma_tte=(r[8] or "VND").strip(),
            ty_gia=float(r[9] or 1.0),
            ma_dt0=(r[10] or "").strip(),
            ong_ba=(r[11] or "").strip(),
            dia_chi=(r[12] or "").strip(),
            dien_giai0=(r[13] or "").strip(),
            desc_en0=(r[14] or "").strip(),
            ttien_nt=float(r[15] or 0.0),
            ttien=float(r[16] or 0.0),
            ttien_nt3=float(r[17] or 0.0),
            ttien3=float(r[18] or 0.0),
            ttien_nt0=float(r[19] or 0.0),
            ttien0=float(r[20] or 0.0),
            han_tt=int(r[21] or 0),
            ct_di_kem=(r[22] or "").strip(),
            so_ct0=(r[23] or "").strip(),
            ngay_ct0=r[24].strftime("%Y-%m-%d") if r[24] else None,
            user_name=(r[25] or "").strip(),
            posted=bool(r[26]) if r[26] is not None else False,
            confirmed=bool(r[27]) if r[27] is not None else True,
            printed=bool(r[28]) if r[28] is not None else False,
            ten_dt0=(r[31] or "").strip() if len(r) > 31 else "",
            tk_chinh=tk_chinh,
            tk_doi_ung=tk_doi_ung,
        )

    def list_cash_vouchers(
        self,
        ma_ct: Optional[str] = "C1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
        dien_giai: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> CashVoucherListResponse:
        page = max(1, page)
        page_size = max(1, min(page_size, 500))
        offset = (page - 1) * page_size

        where_sql, params = self._build_where(
            ma_ct=ma_ct,
            ngay_ct1=ngay_ct1,
            ngay_ct2=ngay_ct2,
            so_ct1=so_ct1,
            so_ct2=so_ct2,
            ma_dt=ma_dt,
            ma_tte=ma_tte,
            tk=tk,
            tien_nt1=tien_nt1,
            tien_nt2=tien_nt2,
            filter_by_user=filter_by_user,
            dien_giai=dien_giai,
        )

        summary_sql = f"""
            SELECT
                COUNT(1) AS total_count,
                ISNULL(SUM(h.TTien_Nt), 0) AS total_ttien_nt,
                ISNULL(SUM(h.TTien), 0) AS total_ttien,
                ISNULL(SUM(h.TTien_Nt3), 0) AS total_ttien_nt3,
                ISNULL(SUM(h.TTien3), 0) AS total_ttien3,
                ISNULL(SUM(h.TTien_Nt0), 0) AS total_ttien_nt0,
                ISNULL(SUM(h.TTien0), 0) AS total_ttien0
            FROM {self.vp_db}.dbo.CtT h WITH (NOLOCK)
            WHERE {where_sql}
        """

        data_sql = f"""
            WITH Page AS (
                SELECT h.*
                FROM {self.vp_db}.dbo.CtT h WITH (NOLOCK)
                WHERE {where_sql}
                ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            )
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Kieu_Ct, h.Nh_Ct,
                h.Ngay_Ct, h.So_Ct, h.So_Seri, h.Ma_Tte, h.Ty_Gia,
                h.Ma_Dt0,
                {self.fn_uni}(h.Ong_Ba) AS Ong_Ba,
                {self.fn_uni}(h.Dia_Chi) AS Dia_Chi,
                {self.fn_uni}(h.Dien_Giai0) AS Dien_Giai0,
                {self.fn_uni}(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien, h.TTien_Nt3, h.TTien3, h.TTien_Nt0, h.TTien0,
                h.Han_Tt,
                {self.fn_uni}(h.Ct_Di_Kem) AS Ct_Di_Kem,
                h.So_Ct0, h.Ngay_Ct0,
                h.UserName, h.Posted, h.Confirmed, h.Printed,
                d0.Tk_No, d0.Tk_Co,
                {self.fn_uni}(c.Ten_Dt) AS Ten_Dt0
            FROM Page h
            OUTER APPLY (
                SELECT TOP 1 d.Tk_No, d.Tk_Co
                FROM {self.vp_db}.dbo.CtT0 d WITH (NOLOCK)
                WHERE d.Stt = h.Stt
                ORDER BY d.Stt_Nv ASC, d.Stt0 ASC
            ) d0
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt0
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
        """

        total_records = 0
        summary = CashVoucherSummary()
        items: List[CashVoucherHeaderSchema] = []

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(summary_sql, params)
                sum_row = cur.fetchone()
                if sum_row:
                    total_records = int(sum_row[0] or 0)
                    summary = CashVoucherSummary(
                        total_ttien_nt=float(sum_row[1] or 0.0),
                        total_ttien=float(sum_row[2] or 0.0),
                        total_ttien_nt3=float(sum_row[3] or 0.0),
                        total_ttien3=float(sum_row[4] or 0.0),
                        total_ttien_nt0=float(sum_row[5] or 0.0),
                        total_ttien0=float(sum_row[6] or 0.0),
                    )
                if total_records > 0:
                    cur.execute(data_sql, [*params, offset, page_size])
                    for r in cur.fetchall():
                        items.append(self._row_to_header(r))
                    items.reverse()
        except Exception as e:
            logger.error(f"Error querying cash vouchers (CtT): {e}")

        total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1
        pagination = VoucherListPagination(
            page=page,
            page_size=page_size,
            total_records=total_records,
            total_pages=total_pages,
            has_next=page < total_pages,
        )
        return CashVoucherListResponse(items=items, pagination=pagination, summary=summary)

    def get_cash_voucher_detail(self, stt: str) -> Optional[CashVoucherDetailResponse]:
        clean_stt = (stt or "").strip()
        if not clean_stt:
            return None

        header_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Kieu_Ct, h.Nh_Ct,
                h.Ngay_Ct, h.So_Ct, h.So_Seri, h.Ma_Tte, h.Ty_Gia,
                h.Ma_Dt0,
                {self.fn_uni}(h.Ong_Ba) AS Ong_Ba,
                {self.fn_uni}(h.Dia_Chi) AS Dia_Chi,
                {self.fn_uni}(h.Dien_Giai0) AS Dien_Giai0,
                {self.fn_uni}(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien, h.TTien_Nt3, h.TTien3, h.TTien_Nt0, h.TTien0,
                h.Han_Tt,
                {self.fn_uni}(h.Ct_Di_Kem) AS Ct_Di_Kem,
                h.So_Ct0, h.Ngay_Ct0,
                h.UserName, h.Posted, h.Confirmed, h.Printed,
                '' AS Tk_No, '' AS Tk_Co,
                {self.fn_uni}(c.Ten_Dt) AS Ten_Dt0
            FROM {self.vp_db}.dbo.CtT h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt0
            WHERE h.Stt = ?
        """

        detail_sql = f"""
            SELECT
                d.Stt0, d.Stt, d.Stt_Nv,
                d.Tien_Nt, d.Tien, d.Tien_Nt3, d.Tien3,
                d.Ma_Dt, d.Ma_Hd, d.Ma_Bp, d.Ma_Km, d.Ma_Sp,
                d.Tk_No, d.Tk_Co, d.Tk_No3, d.Tk_Co3,
                {self.fn_uni}(d.Dien_Giai) AS Dien_Giai,
                {self.fn_uni}(d.Desc_EN) AS Desc_EN,
                d.Ma_Thue, d.Thue_GtGt, d.Ma_DtGtGt,
                {self.fn_uni}(d.Ten_DtGtGt) AS Ten_DtGtGt,
                d.Ngay_Ct0, d.So_Ct0, d.So_Seri0, d.Loai_VAT, d.Dieu_Chinh,
                {self.fn_uni}(dt.Ten_Dt) AS Ten_Dt,
                {self.fn_uni}(tno.Ten_Tk) AS Ten_Tk_No,
                {self.fn_uni}(tco.Ten_Tk) AS Ten_Tk_Co,
                {self.fn_uni}(bp.Ten_Bp) AS Ten_Bp,
                {self.fn_uni}(hd.Ten_HD) AS Ten_HD
            FROM {self.vp_db}.dbo.CtT0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt dt WITH (NOLOCK) ON dt.Ma_Dt = d.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmTk tno WITH (NOLOCK) ON tno.Tk = d.Tk_No
            LEFT JOIN {self.sys_db}.dbo.DmTk tco WITH (NOLOCK) ON tco.Tk = d.Tk_Co
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = d.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmHd hd WITH (NOLOCK) ON hd.Ma_Hd = d.Ma_Hd
            WHERE d.Stt = ?
            ORDER BY ISNULL(d.Stt_Nv, 0) ASC, d.Stt0 ASC
        """

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(header_sql, [clean_stt])
                hr = cur.fetchone()
                if not hr:
                    return None
                header = self._row_to_header(hr)

                cur.execute(detail_sql, [clean_stt])
                items: List[CashVoucherDetailSchema] = []
                for dr in cur.fetchall():
                    items.append(
                        CashVoucherDetailSchema(
                            stt0=(dr[0] or "").strip(),
                            stt=(dr[1] or "").strip(),
                            stt_nv=int(dr[2] or (len(items) + 1)),
                            tien_nt=float(dr[3] or 0.0),
                            tien=float(dr[4] or 0.0),
                            tien_nt3=float(dr[5] or 0.0),
                            tien3=float(dr[6] or 0.0),
                            ma_dt=(dr[7] or "").strip(),
                            ma_hd=(dr[8] or "").strip(),
                            ma_bp=(dr[9] or "").strip(),
                            ma_km=(dr[10] or "").strip(),
                            ma_sp=(dr[11] or "").strip(),
                            tk_no=(dr[12] or "").strip(),
                            tk_co=(dr[13] or "").strip(),
                            tk_no3=(dr[14] or "").strip(),
                            tk_co3=(dr[15] or "").strip(),
                            dien_giai=(dr[16] or "").strip(),
                            desc_en=(dr[17] or "").strip(),
                            ma_thue=(dr[18] or "").strip(),
                            thue_gtgt=float(dr[19] or 0.0),
                            ma_dtgtgt=(dr[20] or "").strip(),
                            ten_dtgtgt=(dr[21] or "").strip(),
                            ngay_ct0=dr[22].strftime("%Y-%m-%d") if dr[22] else None,
                            so_ct0=(dr[23] or "").strip(),
                            so_seri0=(dr[24] or "").strip(),
                            loai_vat=(dr[25] or "1").strip(),
                            dieu_chinh=(dr[26] or "K").strip(),
                            ten_dt=(dr[27] or "").strip(),
                            ten_tk_no=(dr[28] or "").strip(),
                            ten_tk_co=(dr[29] or "").strip(),
                            ten_bp=(dr[30] or "").strip(),
                            ten_hd=(dr[31] or "").strip(),
                        )
                    )

                if items:
                    if header.nh_ct == "1":
                        header.tk_chinh = items[0].tk_no or ""
                        header.tk_doi_ung = items[0].tk_co or ""
                    else:
                        header.tk_chinh = items[0].tk_co or ""
                        header.tk_doi_ung = items[0].tk_no or ""

                return CashVoucherDetailResponse(**header.model_dump(), items=items)
        except Exception as e:
            logger.error(f"Error getting cash voucher detail ({clean_stt}): {e}")
            return None

    def get_next_voucher_number(
        self,
        ma_dvcs: str = "S1",
        ma_ct: str = "C1",
        ngay_ct: Optional[str] = None,
        cur: Optional[Any] = None,
    ) -> str:
        clean_ma_ct = (ma_ct or "C1").strip().upper()
        month_start, next_month_start, _ = voucher_repository._month_date_bounds(ngay_ct)
        lock_hint = "" if cur is not None else "WITH (NOLOCK)"

        def _query_rows(sql: str, params: List[Any]) -> List[str]:
            try:
                if cur is not None:
                    cur.execute(sql, params)
                    fetched = cur.fetchall()
                else:
                    with get_db_cursor(self.vp_db) as c:
                        c.execute(sql, params)
                        fetched = c.fetchall()
                return [r[0] for r in fetched if r and r[0] and isinstance(r[0], str)]
            except Exception as e:
                logger.warning(f"Error querying max CtT.So_Ct ({clean_ma_ct}): {e}")
                return []

        rows = _query_rows(
            f"""
            SELECT RTRIM(So_Ct)
            FROM {self.vp_db}.dbo.CtT {lock_hint}
            WHERE Ma_Ct = ? AND Ngay_Ct >= ? AND Ngay_Ct < ?
            """,
            [clean_ma_ct, month_start, next_month_start],
        )

        max_num = 0
        pad_len = 6
        best_prefix = ""
        for s in rows:
            m = re.match(r"^(.*?)(\d+)$", s.strip())
            if m:
                num = int(m.group(2))
                if num >= max_num:
                    max_num = num
                    best_prefix = m.group(1)
                    pad_len = max(6 if not best_prefix else 4, len(m.group(2)))

        if not rows:
            # Check latest voucher overall for prefix pattern
            latest = _query_rows(
                f"SELECT TOP 1 RTRIM(So_Ct) FROM {self.vp_db}.dbo.CtT {lock_hint} WHERE Ma_Ct = ? ORDER BY Ngay_Ct DESC, Stt DESC",
                [clean_ma_ct],
            )
            for s in latest:
                m = re.match(r"^(.*?)(\d+)$", s.strip())
                if m:
                    best_prefix = m.group(1)
                    pad_len = max(6 if not best_prefix else 4, len(m.group(2)))
                    break

        candidate = f"{best_prefix}{str(max_num + 1).zfill(pad_len)}"
        check_ngay = ngay_ct or date.today().strftime("%Y-%m-%d")

        try:
            if cur is not None:
                for _ in range(500):
                    if not voucher_repository._exec_check_number(
                        cur, self.vp_db, ma_dvcs or "S1", "M", "", clean_ma_ct, check_ngay, candidate
                    ):
                        return candidate
                    candidate = increment_voucher_number(candidate)
            else:
                with get_db_cursor(self.vp_db) as c:
                    for _ in range(500):
                        if not voucher_repository._exec_check_number(
                            c, self.vp_db, ma_dvcs or "S1", "M", "", clean_ma_ct, check_ngay, candidate
                        ):
                            return candidate
                        candidate = increment_voucher_number(candidate)
        except Exception:
            pass

        return candidate

    def _check_duplicate_number(
        self,
        ma_dvcs: str,
        moi_sua: str,
        stt: str,
        ma_ct: str,
        ngay_ct: str,
        so_ct: str,
        cur: Any,
        prefer_month_max: bool,
    ) -> Tuple[bool, str]:
        clean_ma_ct = (ma_ct or "C1").strip().upper()
        curr_so_ct = (so_ct or "").strip()
        _, _, lock_period = voucher_repository._month_date_bounds(ngay_ct)
        try:
            cur.execute(
                """
                SET NOCOUNT ON;
                DECLARE @rc int;
                EXEC @rc = sp_getapplock @Resource=?, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                IF @rc < 0
                    THROW 50001, 'Could not acquire voucher number lock (sp_getapplock timeout)', 1;
                """,
                [f"web_vfp_soct:{self.vp_db}:CtT:{clean_ma_ct}:{lock_period}"],
            )
        except Exception as e:
            if "50001" in str(e) or "sp_getapplock timeout" in str(e):
                raise ValueError(
                    "Hệ thống đang bận cấp số chứng từ cho máy khác, vui lòng thử lưu lại sau giây lát."
                ) from e
            logger.warning(f"sp_getapplock warning (CtT): {e}")

        if prefer_month_max or not curr_so_ct:
            next_so_ct = self.get_next_voucher_number(
                ma_dvcs=ma_dvcs,
                ma_ct=clean_ma_ct,
                ngay_ct=ngay_ct,
                cur=cur,
            )
            return bool(curr_so_ct and next_so_ct != curr_so_ct), next_so_ct

        is_dup_initially = False
        check_so_ct = curr_so_ct
        for attempt in range(500):
            is_dup = voucher_repository._exec_check_number(
                cur, self.vp_db, ma_dvcs or "S1", moi_sua or "S", stt or "", clean_ma_ct, ngay_ct, check_so_ct
            )
            if attempt == 0:
                is_dup_initially = is_dup
            if not is_dup:
                return is_dup_initially, check_so_ct
            check_so_ct = increment_voucher_number(check_so_ct)
        return is_dup_initially, check_so_ct

    def _normalize_and_total(
        self,
        data: CashVoucherCreateRequest,
    ) -> Tuple[float, float, float, float, float, float]:
        safe_ty_gia = float(data.ty_gia) if data.ty_gia and data.ty_gia > 0 else 1.0
        safe_ma_tte = (data.ma_tte or "VND").strip().upper()
        is_vnd = safe_ma_tte == "VND"

        sum_nt = 0.0
        sum_vnd = 0.0
        sum_nt3 = 0.0
        sum_vnd3 = 0.0

        for idx, it in enumerate(data.items):
            tk_no = (it.tk_no or "").strip()
            tk_co = (it.tk_co or "").strip()
            if not tk_no or not tk_co:
                raise ValueError(f"Dòng {idx + 1}: Tài khoản Nợ và Tài khoản Có là bắt buộc!")

            it.tk_no = tk_no
            it.tk_co = tk_co
            it.stt_nv = idx + 1

            tien_nt = float(it.tien_nt or 0.0)
            if tien_nt <= 0:
                raise ValueError(f"Dòng {idx + 1}: Số tiền phải lớn hơn 0!")

            it.tien_nt = float(round_vnd(tien_nt)) if is_vnd else round_amount(tien_nt, 2)
            it.tien = float(round_vnd(it.tien_nt * safe_ty_gia))

            thue_rate = float(it.thue_gtgt or 0.0)
            if it.tien_nt3 and float(it.tien_nt3) > 0:
                tien_nt3 = float(it.tien_nt3)
            elif thue_rate > 0:
                tien_nt3 = (
                    float(round_vnd(it.tien_nt * thue_rate / 100.0))
                    if is_vnd
                    else round_amount(it.tien_nt * thue_rate / 100.0, 2)
                )
            else:
                tien_nt3 = 0.0

            it.tien_nt3 = tien_nt3 if tien_nt3 > 0 else 0.0
            it.tien3 = float(round_vnd(it.tien_nt3 * safe_ty_gia)) if it.tien_nt3 > 0 else 0.0
            it.loai_vat = (it.loai_vat or "1").strip() or "1"
            it.dieu_chinh = (it.dieu_chinh or "K").strip() or "K"

            sum_nt += it.tien_nt
            sum_vnd += it.tien
            sum_nt3 += it.tien_nt3
            sum_vnd3 += it.tien3

        ttien_nt = float(round_vnd(sum_nt)) if is_vnd else round_amount(sum_nt, 2)
        ttien = float(round_vnd(sum_vnd))
        ttien_nt3 = float(round_vnd(sum_nt3)) if is_vnd else round_amount(sum_nt3, 2)
        ttien3 = float(round_vnd(sum_vnd3))
        ttien_nt0 = round_amount(ttien_nt + ttien_nt3, 2)
        ttien0 = float(round_vnd(ttien + ttien3))
        return ttien_nt, ttien, ttien_nt3, ttien3, ttien_nt0, ttien0

    def _insert_voucher_in_tx(
        self,
        cur: Any,
        mode: str,
        stt: str,
        final_so_ct: str,
        data: CashVoucherCreateRequest,
        totals: Tuple[float, float, float, float, float, float],
        user_name: str,
    ) -> None:
        clean_ma_ct = (data.ma_ct or "C1").strip().upper()
        nh_ct = (data.nh_ct or _NH_CT_BY_MA_CT.get(clean_ma_ct, "1")).strip()
        kieu_ct = data.kieu_ct if data.kieu_ct else " "
        safe_ty_gia = float(data.ty_gia) if data.ty_gia and data.ty_gia > 0 else 1.0
        safe_ma_tte = (data.ma_tte or "VND").strip().upper()
        ttien_nt, ttien, ttien_nt3, ttien3, ttien_nt0, ttien0 = totals

        if mode == "M":
            cur.execute(
                f"""
                INSERT INTO {self.vp_db}.dbo.CtT (
                    Stt, Ma_DvCs, Ma_Ct, Kieu_Ct, Nh_Ct,
                    Ngay_Ct, So_Ct, So_Seri, Ma_Tte, Ty_Gia,
                    Ma_Dt0, Ong_Ba, Dia_Chi, Dien_Giai0, Desc_EN0,
                    TTien_Nt, TTien, TTien_Nt3, TTien3, TTien_Nt0, TTien0,
                    Han_Tt, Ct_Di_Kem, So_Ct0, Ngay_Ct0,
                    UserName, Posted, Confirmed, Printed
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?),
                    ?, ?, ?, ?, ?, ?,
                    ?, {self.fn_tcvn}(?), ?, ?,
                    ?, ?, ?, ?
                )
                """,
                [
                    stt, data.ma_dvcs or "S1", clean_ma_ct, kieu_ct, nh_ct,
                    data.ngay_ct, final_so_ct, data.so_seri or None, safe_ma_tte, safe_ty_gia,
                    (data.ma_dt0 or "").strip().upper() or None,
                    data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or "", data.desc_en0 or None,
                    ttien_nt, ttien, ttien_nt3 or None, ttien3 or None, ttien_nt0, ttien0,
                    data.han_tt or 0, data.ct_di_kem or None, data.so_ct0 or None, data.ngay_ct0 or None,
                    user_name or "KTCN3", 1 if data.posted is not False else 0, 1 if data.confirmed is not False else 0,
                    1 if data.printed else None,
                ],
            )
        else:
            cur.execute(
                f"DELETE FROM {self.vp_db}.dbo.SoCai WHERE Stt = ?",
                [stt],
            )
            cur.execute(
                f"DELETE FROM {self.vp_db}.dbo.CtT0 WHERE Stt = ?",
                [stt],
            )
            cur.execute(
                f"""
                UPDATE {self.vp_db}.dbo.CtT SET
                    Ma_DvCs = ?, Ma_Ct = ?, Kieu_Ct = ?, Nh_Ct = ?,
                    Ngay_Ct = ?, So_Ct = ?, So_Seri = ?, Ma_Tte = ?, Ty_Gia = ?,
                    Ma_Dt0 = ?, Ong_Ba = {self.fn_tcvn}(?), Dia_Chi = {self.fn_tcvn}(?),
                    Dien_Giai0 = {self.fn_tcvn}(?), Desc_EN0 = {self.fn_tcvn}(?),
                    TTien_Nt = ?, TTien = ?, TTien_Nt3 = ?, TTien3 = ?, TTien_Nt0 = ?, TTien0 = ?,
                    Han_Tt = ?, Ct_Di_Kem = {self.fn_tcvn}(?), So_Ct0 = ?, Ngay_Ct0 = ?,
                    Posted = ?, Confirmed = ?, Printed = ?
                WHERE Stt = ?
                """,
                [
                    data.ma_dvcs or "S1", clean_ma_ct, kieu_ct, nh_ct,
                    data.ngay_ct, final_so_ct, data.so_seri or None, safe_ma_tte, safe_ty_gia,
                    (data.ma_dt0 or "").strip().upper() or None,
                    data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or "", data.desc_en0 or None,
                    ttien_nt, ttien, ttien_nt3 or None, ttien3 or None, ttien_nt0, ttien0,
                    data.han_tt or 0, data.ct_di_kem or None, data.so_ct0 or None, data.ngay_ct0 or None,
                    1 if data.posted is not False else 0, 1 if data.confirmed is not False else 0,
                    1 if data.printed else None,
                    stt,
                ],
            )

        stt0_list = voucher_repository.generate_stts_batch(data.ma_dvcs or "S1", len(data.items), cur)
        row_ph = (
            f"(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
            f"{self.fn_tcvn}(?), {self.fn_tcvn}(?), ?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?)"
        )
        insert_prefix = f"""
            INSERT INTO {self.vp_db}.dbo.CtT0 (
                Stt, Stt0, Tien_Nt, Tien, Tien_Nt3, Tien3,
                Ma_Dt, Ma_Hd, Ma_Bp, Ma_Km, Ma_Sp,
                Tk_No, Tk_Co, Tk_No3, Tk_Co3,
                Dien_Giai, Desc_EN,
                Ma_Thue, Thue_GtGt, Ma_DtGtGt, Ten_DtGtGt,
                Ngay_Ct0, So_Ct0, So_Seri0, Loai_VAT, Dieu_Chinh, Stt_Nv
            ) VALUES """

        fallback_dt = (data.ma_dt0 or "").strip().upper()
        for start in range(0, len(data.items), _CTT0_BATCH_SIZE):
            batch_items = data.items[start:start + _CTT0_BATCH_SIZE]
            batch_stt0s = stt0_list[start:start + _CTT0_BATCH_SIZE]
            params: List[Any] = []
            for it, stt0 in zip(batch_items, batch_stt0s):
                row_dt = (it.ma_dt or "").strip().upper() or fallback_dt or None
                params.extend([
                    stt,
                    stt0,
                    it.tien_nt or 0.0,
                    it.tien or 0.0,
                    it.tien_nt3 if it.tien_nt3 else None,
                    it.tien3 if it.tien3 else None,
                    row_dt,
                    (it.ma_hd or "").strip() or None,
                    (it.ma_bp or "").strip() or None,
                    (it.ma_km or "").strip() or None,
                    (it.ma_sp or "").strip() or None,
                    it.tk_no,
                    it.tk_co,
                    (it.tk_no3 or "").strip() or None,
                    (it.tk_co3 or "").strip() or None,
                    it.dien_giai or data.dien_giai0 or "",
                    it.desc_en or None,
                    (it.ma_thue or "").strip() or None,
                    it.thue_gtgt if it.thue_gtgt else None,
                    (it.ma_dtgtgt or "").strip() or None,
                    it.ten_dtgtgt or None,
                    it.ngay_ct0 or None,
                    (it.so_ct0 or "").strip() or None,
                    (it.so_seri0 or "").strip() or None,
                    it.loai_vat or "1",
                    it.dieu_chinh or "K",
                    it.stt_nv or 1,
                ])
            cur.execute(insert_prefix + ",\n".join([row_ph] * len(batch_items)), params)

        # Post vào Sổ Cái qua Stored Procedure chuẩn VP_2014.dbo.CtT_Post
        try:
            cur.execute(
                f"""
                SET NOCOUNT ON;
                DECLARE @res smallint;
                EXEC {self.vp_db}.dbo.CtT_Post @p_Stt=?, @p_Result=@res OUTPUT;
                """,
                [stt],
            )
        except Exception as e:
            logger.warning(f"CtT_Post warning ({stt}): {e}")
            if mode == "S":
                raise

        ensure_cash_voucher_socai(
            cur,
            self.vp_db,
            self.fn_tcvn,
            ma_dvcs=data.ma_dvcs or "S1",
            stt=stt,
            ma_ct=clean_ma_ct,
            nh_ct=nh_ct,
            ngay_ct=data.ngay_ct,
            so_ct=final_so_ct,
            ma_dt0=data.ma_dt0 or "",
            ong_ba=data.ong_ba or "",
            dien_giai0=data.dien_giai0 or "",
            ma_tte=safe_ma_tte,
            ty_gia=safe_ty_gia,
            posted=(data.posted is not False),
            items=data.items,
        )

        try:
            cur.execute(
                f"SET NOCOUNT ON; EXEC {self.sys_db}.dbo.ST_Save_Number @p_Ma_DvCs=?, @p_Ma_Ct=?, @p_So_Ct=?",
                [data.ma_dvcs or "S1", clean_ma_ct, final_so_ct],
            )
        except Exception as e:
            logger.warning(f"ST_Save_Number warning (CtT): {e}")

    def save_cash_voucher(
        self,
        data: CashVoucherCreateRequest,
        mode: str = "M",
        stt_override: Optional[str] = None,
        user_name: str = "KTCN3",
    ) -> CashVoucherSaveResponse:
        clean_ma_ct = (data.ma_ct or "C1").strip().upper()
        if clean_ma_ct not in _NH_CT_BY_MA_CT:
            raise ValueError(f"Mã chứng từ '{clean_ma_ct}' không thuộc nhóm Tiền mặt / Ngân hàng (C1..C4)!")
        if not data.ngay_ct or not data.ngay_ct.strip():
            raise ValueError("Ngày chứng từ là bắt buộc!")
        if not data.items:
            raise ValueError("Chứng từ phải có ít nhất 1 dòng hạch toán!")

        ngay_kt_ht = voucher_repository.get_closing_date(data.ma_dvcs or "S1")
        if ngay_kt_ht and data.ngay_ct <= ngay_kt_ht:
            raise ValueError(f"Ngày chứng từ ({data.ngay_ct}) nằm trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

        totals = self._normalize_and_total(data)

        with get_db_transaction(self.vp_db) as (_, cur):
            clean_ma_dt0 = (data.ma_dt0 or "").strip().upper()
            if clean_ma_dt0:
                cur.execute(
                    f"SELECT TOP 1 1 FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt = ?",
                    [clean_ma_dt0],
                )
                if cur.fetchone() is None:
                    raise ValueError(
                        f"Mã đối tượng '{clean_ma_dt0}' không tồn tại trong danh mục DmDt!"
                    )
            data.ma_dt0 = clean_ma_dt0

            raw_so_ct = (data.so_ct or "").strip()
            use_month_max = (mode == "M") and not bool(data.custom_so_ct) and not bool(raw_so_ct)
            _, final_so_ct = self._check_duplicate_number(
                ma_dvcs=data.ma_dvcs or "S1",
                moi_sua=mode,
                stt=stt_override or "",
                ma_ct=clean_ma_ct,
                ngay_ct=data.ngay_ct,
                so_ct=raw_so_ct,
                cur=cur,
                prefer_month_max=use_month_max,
            )
            data.so_ct = final_so_ct

            if mode == "M":
                stt = voucher_repository.generate_stt(data.ma_dvcs or "S1", cur)
            else:
                if not stt_override or not stt_override.strip():
                    raise ValueError("Chế độ sửa yêu cầu mã chứng từ (stt) hợp lệ!")
                stt = stt_override.strip()

            self._insert_voucher_in_tx(cur, mode, stt, final_so_ct, data, totals, user_name)

        return CashVoucherSaveResponse(
            stt=stt,
            so_ct=final_so_ct,
            message="Lưu chứng từ thu chi / ngân hàng thành công.",
        )

    def delete_cash_voucher(self, stt: str, user_name: str = "KTCN3") -> CashVoucherDeleteResponse:
        clean_stt = (stt or "").strip()
        if not clean_stt:
            raise ValueError("Mã chứng từ không được để trống!")

        with get_db_transaction(self.vp_db) as (_, cur):
            cur.execute(
                f"SELECT Ngay_Ct FROM {self.vp_db}.dbo.CtT WITH (NOLOCK) WHERE Stt = ?",
                [clean_stt],
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Không tìm thấy chứng từ có mã {clean_stt}.")

            ngay_ct = row[0].strftime("%Y-%m-%d") if row[0] else ""
            ngay_kt_ht = voucher_repository.get_closing_date()
            if ngay_kt_ht and ngay_ct and ngay_ct <= ngay_kt_ht:
                raise ValueError(f"Không thể xóa chứng từ trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

            try:
                cur.execute(
                    f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.CtT_Delete @p_Stt=?, @p_UserName=?",
                    [clean_stt, user_name or "KTCN3"],
                )
            except Exception as e:
                logger.warning(f"CtT_Delete SP warning, executing cascaded SQL delete: {e}")
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.SoCai WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.CtT0 WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.CtT WHERE Stt = ?", [clean_stt])

        return CashVoucherDeleteResponse(stt=clean_stt, message="Xóa chứng từ thành công.")

    def get_cash_ledger(
        self,
        tk: str = "11212",
        ngay_bd: Optional[str] = None,
        ngay_kt: Optional[str] = None,
    ) -> CashLedgerResponse:
        import calendar

        today = date.today()
        last_day = calendar.monthrange(today.year, today.month)[1]
        start_str = (ngay_bd or "").strip()[:10] or f"{today.year:04d}-{today.month:02d}-01"
        end_str = (ngay_kt or "").strip()[:10] or f"{today.year:04d}-{today.month:02d}-{last_day:02d}"
        tk_clean = (tk or "11212").strip() or "11212"
        tk_like = f"{tk_clean}%"

        ten_tk = ""
        du_dau = 0.0
        tong_thu = 0.0
        tong_chi = 0.0
        entries: List[CashLedgerEntry] = []

        opening_sql = f"""
            SELECT
                ISNULL((
                    SELECT SUM(ISNULL(Du_No0, 0) - ISNULL(Du_Co0, 0))
                    FROM {self.vp_db}.dbo.CdK WITH (NOLOCK)
                    WHERE RTRIM(Tk) LIKE ?
                ), 0)
                +
                ISNULL((
                    SELECT SUM(ISNULL(Tien, 0))
                    FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                    WHERE Ngay_Ct < ? AND RTRIM(Tk_No) LIKE ?
                ), 0)
                -
                ISNULL((
                    SELECT SUM(ISNULL(Tien, 0))
                    FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                    WHERE Ngay_Ct < ? AND RTRIM(Tk_Co) LIKE ?
                ), 0)
        """

        ledger_sql = f"""
            SELECT TOP (5000)
                RTRIM(t.Stt) AS Stt,
                RTRIM(t.Ma_Ct) AS Ma_Ct,
                t.Ngay_Ct,
                RTRIM(t.So_Ct) AS So_Ct,
                RTRIM(ISNULL(t.Ma_Dt, '')) AS Ma_Dt,
                {self.fn_uni}(COALESCE(c.Ten_Dt, t.Ong_Ba, '')) AS Ten_Dt,
                {self.fn_uni}(t.Dien_Giai) AS Dien_Giai,
                RTRIM(ISNULL(t.Tk_Doi_Ung, '')) AS Tk_Doi_Ung,
                t.Ps_Thu,
                t.Ps_Chi
            FROM (
                SELECT
                    Stt, Ma_Ct, Ngay_Ct, So_Ct,
                    COALESCE(NULLIF(RTRIM(Ma_Dt_Co), ''), RTRIM(Ma_Dt0)) AS Ma_Dt,
                    Ong_Ba, Dien_Giai, Stt_Bt,
                    Tk_Co AS Tk_Doi_Ung,
                    ISNULL(Tien, 0) AS Ps_Thu,
                    CAST(0 AS float) AS Ps_Chi
                FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                WHERE Ngay_Ct >= ? AND Ngay_Ct <= ? AND RTRIM(Tk_No) LIKE ?
                UNION ALL
                SELECT
                    Stt, Ma_Ct, Ngay_Ct, So_Ct,
                    COALESCE(NULLIF(RTRIM(Ma_Dt_No), ''), RTRIM(Ma_Dt0)) AS Ma_Dt,
                    Ong_Ba, Dien_Giai, Stt_Bt,
                    Tk_No AS Tk_Doi_Ung,
                    CAST(0 AS float) AS Ps_Thu,
                    ISNULL(Tien, 0) AS Ps_Chi
                FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                WHERE Ngay_Ct >= ? AND Ngay_Ct <= ? AND RTRIM(Tk_Co) LIKE ?
            ) t
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = t.Ma_Dt
            ORDER BY t.Ngay_Ct ASC, t.So_Ct ASC, t.Stt ASC, t.Stt_Bt ASC
        """

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT TOP 1 {self.fn_uni}(Ten_Tk) FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK) WHERE RTRIM(Tk) = ?",
                    [tk_clean],
                )
                tr = cur.fetchone()
                if tr and tr[0]:
                    ten_tk = tr[0].strip()

                cur.execute(opening_sql, [tk_like, start_str, tk_like, start_str, tk_like])
                r_open = cur.fetchone()
                if r_open:
                    du_dau = float(r_open[0] or 0.0)

                cur.execute(ledger_sql, [start_str, end_str, tk_like, start_str, end_str, tk_like])
                running = du_dau
                for r in cur.fetchall():
                    ps_thu = float(r[8] or 0.0)
                    ps_chi = float(r[9] or 0.0)
                    if ps_thu == 0 and ps_chi == 0:
                        continue
                    tong_thu += ps_thu
                    tong_chi += ps_chi
                    running += ps_thu - ps_chi
                    entries.append(
                        CashLedgerEntry(
                            stt=(r[0] or "").strip(),
                            ma_ct=(r[1] or "").strip(),
                            ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                            so_ct=(r[3] or "").strip(),
                            ma_dt=(r[4] or "").strip(),
                            ten_dt=(r[5] or "").strip(),
                            dien_giai=(r[6] or "").strip(),
                            tk_doi_ung=(r[7] or "").strip(),
                            ps_thu=ps_thu,
                            ps_chi=ps_chi,
                            luy_ke=running,
                        )
                    )
        except Exception as e:
            logger.warning(f"Error querying cash ledger ({tk_clean}): {e}")

        du_cuoi = du_dau + tong_thu - tong_chi
        return CashLedgerResponse(
            tk=tk_clean,
            ten_tk=ten_tk,
            ngay_bd=start_str,
            ngay_kt=end_str,
            du_dau=du_dau,
            tong_thu=tong_thu,
            tong_chi=tong_chi,
            du_cuoi=du_cuoi,
            entries=entries,
        )

    def preview_baoco_upload(self, filename: str, content: bytes) -> BaoCoImportPreviewResponse:
        raw_rows = parse_tabular_upload(filename, content)
        if not raw_rows:
            raise ValueError("File không có dữ liệu.")

        # Bỏ qua dòng tiêu đề nếu cột Số tiền hoặc Ngày không phải dữ liệu
        start_idx = 0
        if raw_rows:
            first = raw_rows[0]
            if len(first) >= 5 and _parse_amount(first[3]) is None and not _parse_excel_date(first[4]):
                start_idx = 1

        parsed_rows: List[BaoCoImportRowPreview] = []
        ma_dt_set = set()

        for offset_i, row in enumerate(raw_rows[start_idx:], start=start_idx + 1):
            padded = list(row) + [""] * max(0, 6 - len(row))
            ten_tk = _clean_cell_text(padded[0])
            so_tk = _clean_cell_text(padded[1])
            noi_dung = _clean_cell_text(padded[2])
            so_tien = _parse_amount(padded[3])
            ngay_ct = _parse_excel_date(padded[4])
            ma_dt = _clean_cell_text(padded[5]).upper()

            if not any([ten_tk, so_tk, noi_dung, so_tien, ngay_ct, ma_dt]):
                continue

            errors: List[str] = []
            if not ngay_ct:
                errors.append("Ngày không hợp lệ")
            if so_tien is None or so_tien <= 0:
                errors.append("Số tiền phải > 0")
            if ma_dt:
                ma_dt_set.add(ma_dt)

            parsed_rows.append(
                BaoCoImportRowPreview(
                    row_index=offset_i,
                    ten_tk=ten_tk,
                    so_tk=so_tk,
                    noi_dung=noi_dung,
                    so_tien=float(so_tien or 0.0),
                    ngay_ct=ngay_ct,
                    ma_dt=ma_dt,
                    valid=len(errors) == 0,
                    error="; ".join(errors) if errors else None,
                )
            )

        if not parsed_rows:
            raise ValueError("Không tìm thấy dòng chứng từ nào trong file (cần 6 cột: Tên TK, Số TK, Nội dung, Số tiền, Ngày, Mã KH).")

        # Tra tên & địa chỉ khách hàng từ DmDt trong 1 query
        customer_map: Dict[str, Tuple[str, str]] = {}
        if ma_dt_set:
            try:
                codes = list(ma_dt_set)
                with get_db_cursor(self.sys_db) as cur:
                    for i in range(0, len(codes), 200):
                        chunk = codes[i:i + 200]
                        placeholders = ",".join(["?"] * len(chunk))
                        cur.execute(
                            f"SELECT RTRIM(Ma_Dt), {self.fn_uni}(Ten_Dt), {self.fn_uni}(Dia_Chi) "
                            f"FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt IN ({placeholders})",
                            chunk,
                        )
                        for r in cur.fetchall():
                            customer_map[(r[0] or "").strip().upper()] = (
                                (r[1] or "").strip(),
                                (r[2] or "").strip(),
                            )
            except Exception as e:
                logger.warning(f"Customer lookup warning in preview_baoco_upload: {e}")

        for item in parsed_rows:
            if item.ma_dt:
                info = customer_map.get(item.ma_dt)
                if info:
                    item.ten_dt, item.dia_chi = info
                elif customer_map:
                    item.valid = False
                    item.error = "; ".join(filter(None, [item.error, f"Không thấy mã KH '{item.ma_dt}' trong DmDt"]))

        valid_cnt = sum(1 for r in parsed_rows if r.valid)
        return BaoCoImportPreviewResponse(
            total_rows=len(parsed_rows),
            valid_rows=valid_cnt,
            invalid_rows=len(parsed_rows) - valid_cnt,
            rows=parsed_rows,
        )

    def commit_baoco_import(self, req: BaoCoImportCommitRequest) -> BaoCoImportCommitResponse:
        if not req.rows:
            raise ValueError("Danh sách dòng import đang trống!")

        clean_ma_ct = (req.ma_ct or "C3").strip().upper()
        nh_ct = _NH_CT_BY_MA_CT.get(clean_ma_ct, "1")
        default_tk_no = (req.tk_no or "11212").strip() or "11212"
        default_tk_co = (req.tk_co or "1311").strip() or "1311"
        user_name = (req.user_name or "KTTH").strip() or "KTTH"

        sorted_rows = sorted(req.rows, key=lambda r: r.ngay_ct)
        ngay_kt_ht = voucher_repository.get_closing_date(req.ma_dvcs or "S1")
        for idx, r in enumerate(sorted_rows):
            if not r.ngay_ct:
                raise ValueError(f"Dòng {idx + 1}: Thiếu ngày chứng từ!")
            if ngay_kt_ht and r.ngay_ct <= ngay_kt_ht:
                raise ValueError(f"Dòng {idx + 1}: Ngày ({r.ngay_ct}) nằm trong kỳ đã khóa sổ ({ngay_kt_ht})!")
            if float(r.so_tien or 0.0) <= 0:
                raise ValueError(f"Dòng {idx + 1}: Số tiền phải lớn hơn 0!")

        created: List[CashVoucherSaveResponse] = []

        with get_db_transaction(self.vp_db) as (_, cur):
            # Lấy mã đơn vị cơ sở thực tế nếu chưa truyền
            ma_dvcs = (req.ma_dvcs or "").strip()
            if not ma_dvcs:
                cur.execute(f"SELECT TOP 1 Ma_DvCs FROM {self.sys_db}.dbo.DmDvCs WITH (NOLOCK)")
                dv_row = cur.fetchone()
                ma_dvcs = dv_row[0].strip() if dv_row and dv_row[0] else "S1"

            # Cache thông tin DmDt trong 1 lượt
            ma_dt_set = {(r.ma_dt or "").strip().upper() for r in sorted_rows if (r.ma_dt or "").strip()}
            customer_map: Dict[str, Tuple[str, str]] = {}
            if ma_dt_set:
                codes = list(ma_dt_set)
                for i in range(0, len(codes), 200):
                    chunk = codes[i:i + 200]
                    placeholders = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"SELECT RTRIM(Ma_Dt), {self.fn_uni}(Ten_Dt), {self.fn_uni}(Dia_Chi) "
                        f"FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt IN ({placeholders})",
                        chunk,
                    )
                    for r in cur.fetchall():
                        customer_map[(r[0] or "").strip().upper()] = (
                            (r[1] or "").strip(),
                            (r[2] or "").strip(),
                        )

            month_counters: Dict[str, str] = {}

            for r in sorted_rows:
                month_key = r.ngay_ct[:7]
                if month_key not in month_counters:
                    _, final_so_ct = self._check_duplicate_number(
                        ma_dvcs=ma_dvcs,
                        moi_sua="M",
                        stt="",
                        ma_ct=clean_ma_ct,
                        ngay_ct=r.ngay_ct,
                        so_ct="",
                        cur=cur,
                        prefer_month_max=True,
                    )
                else:
                    candidate = increment_voucher_number(month_counters[month_key])
                    _, final_so_ct = self._check_duplicate_number(
                        ma_dvcs=ma_dvcs,
                        moi_sua="M",
                        stt="",
                        ma_ct=clean_ma_ct,
                        ngay_ct=r.ngay_ct,
                        so_ct=candidate,
                        cur=cur,
                        prefer_month_max=False,
                    )
                month_counters[month_key] = final_so_ct

                ma_dt = (r.ma_dt or "").strip().upper()
                ten_dt, dia_chi = customer_map.get(ma_dt, ("", ""))

                voucher_req = CashVoucherCreateRequest(
                    ma_dvcs=ma_dvcs,
                    ma_ct=clean_ma_ct,
                    kieu_ct=" ",
                    nh_ct=nh_ct,
                    ngay_ct=r.ngay_ct,
                    so_ct=final_so_ct,
                    ma_tte="VND",
                    ty_gia=1.0,
                    ma_dt0=ma_dt,
                    ong_ba=ten_dt,
                    dia_chi=dia_chi,
                    dien_giai0=r.noi_dung or "",
                    user_name=user_name,
                    confirmed=True,
                    posted=True,
                    items=[
                        CashVoucherDetailSchema(
                            tk_no=(r.tk_no or default_tk_no).strip(),
                            tk_co=(r.tk_co or default_tk_co).strip(),
                            tien_nt=float(r.so_tien),
                            tien=float(round_vnd(r.so_tien)),
                            ma_dt=ma_dt,
                            dien_giai=r.noi_dung or "",
                            loai_vat="1",
                            dieu_chinh="K",
                            stt_nv=1,
                        )
                    ],
                )
                totals = self._normalize_and_total(voucher_req)
                stt = voucher_repository.generate_stt(ma_dvcs, cur)
                self._insert_voucher_in_tx(cur, "M", stt, final_so_ct, voucher_req, totals, user_name)
                created.append(
                    CashVoucherSaveResponse(
                        stt=stt,
                        so_ct=final_so_ct,
                        message="Imported",
                    )
                )

        return BaoCoImportCommitResponse(
            created_count=len(created),
            created_vouchers=created,
            message=f"Đã import thành công {len(created)} chứng từ trong cùng 1 transaction.",
        )


cash_voucher_repository = CashVoucherRepository()
