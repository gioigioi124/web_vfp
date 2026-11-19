"""Shared helpers, schema mappers, and WHERE clause builder for VoucherRepository."""

from datetime import date, datetime
import re
import sys
from typing import Any, List, Optional, Tuple

from app.database import get_db_cursor, get_db_transaction
from app.repositories.debt_repo import debt_repository
from app.schemas.voucher import VoucherDetailSchema, VoucherHeaderSchema

# Multi-row INSERT batch size for CtBH0 (50 rows * 35 params = 1750 < 2100 SQL Server limit)
_DETAIL_INSERT_BATCH_SIZE = 50
_CLOSING_DATE_SENTINEL = ""


def _resolve_facade_attr(name: str, fallback: Any) -> Any:
    """Resolve attributes via app.repositories.voucher_repo so mock.patch targets keep working."""
    facade = sys.modules.get("app.repositories.voucher_repo")
    if facade is not None and hasattr(facade, name):
        return getattr(facade, name)
    return fallback


def increment_voucher_number(s: str) -> str:
    """
    Auto-increments trailing numeric part of voucher number.
    e.g. 'HD4081' -> 'HD4082', 'BH009' -> 'BH010', 'HD99' -> 'HD100', 'HD' -> 'HD1'
    """
    s = (s or "").strip()
    if not s:
        return "HD0001"
    m = re.search(r"^(.*?)(\d+)$", s)
    if m:
        pfx, dgts = m.groups()
        new_dgts = str(int(dgts) + 1).zfill(len(dgts))
        return f"{pfx}{new_dgts}"
    return f"{s}1"


class VoucherHelpersMixin:
    """Database routing, dynamic facade resolvers, WHERE builder, and row mappers."""

    vp_db: str
    kh_db: str
    sys_db: str
    fn_uni: str
    fn_tcvn: str

    def _get_db_cursor(self, db_name: str):
        return _resolve_facade_attr("get_db_cursor", get_db_cursor)(db_name)

    def _get_db_transaction(self, db_name: str):
        return _resolve_facade_attr("get_db_transaction", get_db_transaction)(db_name)

    def _get_debt_repository(self):
        return _resolve_facade_attr("debt_repository", debt_repository)

    def _is_warehouse(self, db_mode: Optional[str] = "sales") -> bool:
        return (db_mode or "").strip().lower() == "warehouse"

    def _get_target_db(self, db_mode: Optional[str] = "sales") -> str:
        return self.kh_db if self._is_warehouse(db_mode) else self.vp_db

    def _month_date_bounds(self, ngay_ct: Optional[str]) -> Tuple[str, str, str]:
        """Return (month_start, next_month_start, YYYYMM) for the month of `ngay_ct`."""
        ref_date: Optional[date] = None
        if ngay_ct:
            s = str(ngay_ct).strip()[:10]
            try:
                ref_date = datetime.strptime(s, "%Y-%m-%d").date()
            except ValueError:
                ref_date = None
        if ref_date is None:
            ref_date = date.today()
        month_start = date(ref_date.year, ref_date.month, 1)
        if ref_date.month == 12:
            next_month = date(ref_date.year + 1, 1, 1)
        else:
            next_month = date(ref_date.year, ref_date.month + 1, 1)
        return (
            month_start.strftime("%Y-%m-%d"),
            next_month.strftime("%Y-%m-%d"),
            f"{ref_date.year:04d}{ref_date.month:02d}",
        )

    def _build_where(
        self,
        ma_ct: Optional[str] = "X1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_bp: Optional[str] = None,
        ma_hd: Optional[str] = None,
        ma_nx: Optional[str] = None,
        ma_kho: Optional[str] = None,
        ma_vt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tk_du: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
        dien_giai: Optional[str] = None,
        db_mode: Optional[str] = "sales",
    ) -> Tuple[str, List[Any]]:
        """
        Dựng mệnh đề WHERE dùng lại được (alias `h` = CtBH) + danh sách params.
        Tách riêng để tái sử dụng và dễ bảo trì.
        """
        target_db = self._get_target_db(db_mode)
        where_clauses: List[str] = []
        params: List[Any] = []

        if ma_ct and ma_ct.strip().upper() not in ("ALL", ""):
            where_clauses.append("h.Ma_Ct = ?")
            params.append(ma_ct.strip().upper())
        else:
            where_clauses.append("h.Ma_Ct IN ('X1', 'BH', 'N5')")

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
            where_clauses.append("h.Ma_Dt = ?")
            params.append(ma_dt)
        if ma_bp:
            where_clauses.append("h.Ma_Bp = ?")
            params.append(ma_bp)
        if ma_hd:
            where_clauses.append("h.Ma_HD = ?")
            params.append(ma_hd)
        if ma_nx:
            where_clauses.append("h.Ma_Nx = ?")
            params.append(ma_nx)
        if ma_tte:
            where_clauses.append("h.Ma_Tte = ?")
            params.append(ma_tte)
        if tk:
            where_clauses.append("(h.Tk2 = ? OR h.Tk3 = ?)")
            params.extend([tk, tk])
        if tk_du:
            where_clauses.append("h.Tk_Du3 = ?")
            params.append(tk_du)
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

        # Bộ lọc liên quan chi tiết (ma_kho, ma_vt). Alias `dv` để không đụng các query khác.
        detail_filters = []
        detail_params = []
        if ma_kho:
            detail_filters.append("dv.Ma_Kho = ?")
            detail_params.append(ma_kho)
        if ma_vt:
            detail_filters.append("dv.Ma_Vt = ?")
            detail_params.append(ma_vt)

        if detail_filters:
            where_clauses.append(f"""
                EXISTS (
                    SELECT 1 FROM {target_db}.dbo.CtBH0 dv WITH (NOLOCK)
                    WHERE dv.Stt = h.Stt AND {" AND ".join(detail_filters)}
                )
            """)
            params.extend(detail_params)

        return " AND ".join(where_clauses), params

    def _row_to_header_schema(self, r: Any) -> VoucherHeaderSchema:
        return VoucherHeaderSchema(
            stt=(r[0] or "").strip(),
            ma_dvcs=(r[1] or "01").strip(),
            ma_ct=(r[2] or "X1").strip(),
            nh_ct=(r[3] or "2").strip(),
            ma_tte=(r[4] or "VND").strip(),
            ty_gia=float(r[5] or 1.0),
            ngay_ps=r[6].strftime("%Y-%m-%d") if r[6] else None,
            ngay_ct=r[7].strftime("%Y-%m-%d") if r[7] else "",
            so_ct=(r[8] or "").strip(),
            ma_xe=(r[9] or "").strip(),
            ma_bp=(r[10] or "").strip(),
            ma_hd=(r[11] or "").strip(),
            ma_dt=(r[12] or "").strip(),
            ma_nx=(r[13] or "131").strip(),
            tk2=(r[14] or "1311").strip(),
            tk3=(r[15] or "33311").strip(),
            tk_du3=(r[16] or "1311").strip(),
            tk4=(r[17] or "521").strip(),
            ong_ba=(r[18] or "").strip(),
            dia_chi=(r[19] or "").strip(),
            dien_giai0=(r[20] or "").strip(),
            desc_en0=(r[21] or "").strip(),
            ttien_nt=float(r[22] or 0.0),
            ttien_nt0=float(r[23] or 0.0),
            ttien_nt2=float(r[24] or 0.0),
            ttien_nt3=float(r[25] or 0.0),
            ttien_nt4=float(r[26] or 0.0),
            ttien=float(r[27] or 0.0),
            ttien0=float(r[28] or 0.0),
            ttien3=float(r[29] or 0.0),
            ttien2=float(r[30] or 0.0),
            ttien4=float(r[31] or 0.0),
            loai_ck=(r[32] or "1").strip(),
            tyle_ck=float(r[33] or 0.0),
            han_tt=int(r[34] or 0),
            ma_thue=(r[35] or "").strip(),
            thue_gtgt=float(r[36] or 0.0),
            ma_dtgtgt=(r[37] or "").strip(),
            ten_dtgtgt=(r[38] or "").strip(),
            so_ct0=(r[39] or "").strip(),
            ngay_ct0=r[40].strftime("%Y-%m-%d") if r[40] else None,
            stt_hbtl=(r[41] or "").strip(),
            confirmed=bool(r[42]),
            posted=bool(r[43]),
            printed=bool(r[44]),
            user_name=(r[45] or "").strip(),
            ten_dt=(r[46] or "").strip(),
            ten_xe=(r[47] or "").strip(),
            ten_bp=(r[48] or "").strip(),
            ten_nx=(r[49] or "").strip(),
            ten_tk2=(r[50] or "").strip(),
            ten_hd=(r[51] or "").strip(),
            dmdt_dia_chi=(r[52] or "").strip() if len(r) > 52 else "",
            dmdt_phone=(r[53] or "").strip() if len(r) > 53 else "",
        )

    def _row_to_detail_schema(self, dr: Any) -> VoucherDetailSchema:
        return VoucherDetailSchema(
            stt_px=(dr[0] or "").strip() if dr[0] else None,
            stt0=(dr[1] or "").strip(),
            stt=(dr[2] or "").strip(),
            tk=(dr[3] or "632").strip(),
            tk_du=(dr[4] or "1561").strip(),
            tk_du2=(dr[5] or "5111").strip(),
            tk_du4=(dr[6] or "521").strip(),
            ma_kho=(dr[7] or "").strip(),
            ma_vt=(dr[8] or "").strip(),
            dvt=(dr[9] or "").strip(),
            dvt_ban=(dr[10] or "").strip(),
            so_tam=float(dr[11] or 0.0),
            he_so8=float(dr[12] or 1.0),
            so_luong8=float(dr[13] or 0.0),
            he_so9=float(dr[14] or 1.0),
            so_luong9=float(dr[15] or 0.0),
            gia_nt9=float(dr[16] or 0.0),
            gia9=float(dr[17] or 0.0),
            tien_nt9=float(dr[18] or 0.0),
            tien9=float(dr[19] or 0.0),
            so_luong=float(dr[20] or 0.0),
            gia_nt=float(dr[21] or 0.0),
            gia=float(dr[22] or 0.0),
            tien_nt=float(dr[23] or 0.0),
            tien=float(dr[24] or 0.0),
            gia_nt2=float(dr[25] or 0.0),
            gia2=float(dr[26] or 0.0),
            tien_nt2=float(dr[27] or 0.0),
            tien2=float(dr[28] or 0.0),
            tien_nt3=float(dr[29] or 0.0),
            tien3=float(dr[30] or 0.0),
            chiet_khau=float(dr[31] or 0.0),
            tien_nt4=float(dr[32] or 0.0),
            tien4=float(dr[33] or 0.0),
            gia_tb_tt=(dr[34] or "C").strip(),
            ten_vt=(dr[35] or "").strip(),
            ten_kho=(dr[36] or "").strip(),
            loai_vt=(dr[37] or "1").strip(),
        )
