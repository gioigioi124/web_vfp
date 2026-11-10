import logging
import math
import random
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.utils.unicode import tcvn_to_unicode
from app.utils.money import round_amount, round_vnd
from app.repositories.debt_repo import debt_repository
from app.schemas.voucher import (
    VoucherHeaderSchema, VoucherDetailSchema, VoucherDetailResponse,
    VoucherListResponse, VoucherListPagination, VoucherSummary,
    VoucherCreateRequest, VoucherUpdateRequest, VoucherSaveResponse,
    VoucherDeleteResponse, CheckNumberRequest, CheckNumberResponse
)

logger = logging.getLogger("app.repositories.voucher")

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

class VoucherRepository:

    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS

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
    ) -> Tuple[str, List[Any]]:
        """
        Dựng mệnh đề WHERE dùng lại được (alias `h` = CtBH) + danh sách params.
        Tách riêng để tái sử dụng và dễ bảo trì.
        """
        where_clauses: List[str] = []
        params: List[Any] = []

        if ma_ct and ma_ct.strip().upper() not in ("ALL", ""):
            where_clauses.append("h.Ma_Ct = ?")
            params.append(ma_ct.strip().upper())
        else:
            where_clauses.append("h.Ma_Ct IN ('X1', 'BH')")

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
                    SELECT 1 FROM {self.vp_db}.dbo.CtBH0 dv WITH (NOLOCK)
                    WHERE dv.Stt = h.Stt AND {" AND ".join(detail_filters)}
                )
            """)
            params.extend(detail_params)

        return " AND ".join(where_clauses), params

    def list_vouchers(
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
        page: int = 1,
        page_size: int = 50
    ) -> VoucherListResponse:
        """
        Query vouchers with filtering and pagination. 100% READ-ONLY (SELECT only).
        """
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
            ma_bp=ma_bp,
            ma_hd=ma_hd,
            ma_nx=ma_nx,
            ma_kho=ma_kho,
            ma_vt=ma_vt,
            ma_tte=ma_tte,
            tk=tk,
            tk_du=tk_du,
            tien_nt1=tien_nt1,
            tien_nt2=tien_nt2,
            filter_by_user=filter_by_user,
        )

        # 1. Total counts and summary totals
        summary_sql = f"""
            SELECT
                COUNT(1) AS total_count,
                ISNULL(SUM(h.TTien_Nt), 0) AS total_ttien_nt,
                ISNULL(SUM(h.TTien_Nt2), 0) AS total_ttien_nt2,
                ISNULL(SUM(h.TTien_Nt3), 0) AS total_ttien_nt3,
                ISNULL(SUM(h.TTien_Nt4), 0) AS total_ttien_nt4,
                ISNULL(SUM(h.TTien_Nt0), 0) AS total_ttien_nt0,
                ISNULL(SUM(h.TTien), 0) AS total_ttien,
                ISNULL(SUM(h.TTien2), 0) AS total_ttien2,
                ISNULL(SUM(h.TTien3), 0) AS total_ttien3,
                ISNULL(SUM(h.TTien4), 0) AS total_ttien4,
                ISNULL(SUM(h.TTien0), 0) AS total_ttien0
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            WHERE {where_sql}
        """

        # 2. Main data query (46 Header columns + joined names with SQL font conversion)
        data_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                dbo.fn_TCVNToUnicode(h.Ong_Ba) AS Ong_Ba,
                dbo.fn_TCVNToUnicode(h.Dia_Chi) AS Dia_Chi,
                dbo.fn_TCVNToUnicode(h.Dien_Giai0) AS Dien_Giai0,
                dbo.fn_TCVNToUnicode(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                dbo.fn_TCVNToUnicode(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                dbo.fn_TCVNToUnicode(c.Ten_Dt) AS Ten_Dt,
                dbo.fn_TCVNToUnicode(x.Ten_Xe) AS Ten_Xe,
                dbo.fn_TCVNToUnicode(bp.Ten_Bp) AS Ten_Bp,
                dbo.fn_TCVNToUnicode(nx.Ten_Nx) AS Ten_Nx,
                dbo.fn_TCVNToUnicode(tk.Ten_Tk) AS Ten_Tk2,
                dbo.fn_TCVNToUnicode(hd.Ten_HD) AS Ten_HD
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = h.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmNx nx WITH (NOLOCK) ON nx.Ma_Nx = h.Ma_Nx
            LEFT JOIN {self.sys_db}.dbo.DmTk tk WITH (NOLOCK) ON tk.Tk = h.Tk2
            LEFT JOIN {self.sys_db}.dbo.DmHD hd WITH (NOLOCK) ON hd.Ma_HD = h.Ma_HD
            WHERE {where_sql}
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
            OFFSET {offset} ROWS FETCH NEXT {page_size} ROWS ONLY
        """

        total_records = 0
        summary = VoucherSummary()
        items: List[VoucherHeaderSchema] = []

        try:
            with get_db_cursor(self.vp_db) as cur:
                # Execute summary
                cur.execute(summary_sql, params)
                sum_row = cur.fetchone()
                if sum_row:
                    total_records = int(sum_row[0] or 0)
                    summary = VoucherSummary(
                        total_ttien_nt=float(sum_row[1] or 0.0),
                        total_ttien_nt2=float(sum_row[2] or 0.0),
                        total_ttien_nt3=float(sum_row[3] or 0.0),
                        total_ttien_nt4=float(sum_row[4] or 0.0),
                        total_ttien_nt0=float(sum_row[5] or 0.0),
                        total_ttien=float(sum_row[6] or 0.0),
                        total_ttien2=float(sum_row[7] or 0.0),
                        total_ttien3=float(sum_row[8] or 0.0),
                        total_ttien4=float(sum_row[9] or 0.0),
                        total_ttien0=float(sum_row[10] or 0.0),
                    )

                # Execute items
                cur.execute(data_sql, params)
                rows = cur.fetchall()
                for r in rows:
                    items.append(self._row_to_header_schema(r))
        except Exception as e:
            logger.error(f"Error querying vouchers: {e}")

        total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1
        pagination = VoucherListPagination(
            page=page,
            page_size=page_size,
            total_records=total_records,
            total_pages=total_pages,
            has_next=page < total_pages
        )

        return VoucherListResponse(items=items, pagination=pagination, summary=summary)

    def get_voucher_detail(self, stt: str) -> Optional[VoucherDetailResponse]:
        """
        Get complete voucher details (46 Header cols + 35 Detail cols). 100% READ-ONLY.
        """
        header_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                dbo.fn_TCVNToUnicode(h.Ong_Ba) AS Ong_Ba,
                dbo.fn_TCVNToUnicode(h.Dia_Chi) AS Dia_Chi,
                dbo.fn_TCVNToUnicode(h.Dien_Giai0) AS Dien_Giai0,
                dbo.fn_TCVNToUnicode(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                dbo.fn_TCVNToUnicode(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                dbo.fn_TCVNToUnicode(c.Ten_Dt) AS Ten_Dt,
                dbo.fn_TCVNToUnicode(x.Ten_Xe) AS Ten_Xe,
                dbo.fn_TCVNToUnicode(bp.Ten_Bp) AS Ten_Bp,
                dbo.fn_TCVNToUnicode(nx.Ten_Nx) AS Ten_Nx,
                dbo.fn_TCVNToUnicode(tk.Ten_Tk) AS Ten_Tk2,
                dbo.fn_TCVNToUnicode(hd.Ten_HD) AS Ten_HD
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = h.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmNx nx WITH (NOLOCK) ON nx.Ma_Nx = h.Ma_Nx
            LEFT JOIN {self.sys_db}.dbo.DmTk tk WITH (NOLOCK) ON tk.Tk = h.Tk2
            LEFT JOIN {self.sys_db}.dbo.DmHD hd WITH (NOLOCK) ON hd.Ma_HD = h.Ma_HD
            WHERE h.Stt = ?
        """

        detail_sql = f"""
            SELECT
                d.Stt_PX, d.Stt0, d.Stt, d.Tk, d.Tk_Du, d.Tk_Du2, d.Tk_Du4,
                d.Ma_Kho, d.Ma_Vt,
                dbo.fn_TCVNToUnicode(d.Dvt) AS Dvt,
                dbo.fn_TCVNToUnicode(d.Dvt_Ban) AS Dvt_Ban,
                d.So_Tam, d.He_So8,
                d.So_Luong8, d.He_So9, d.So_Luong9, d.Gia_Nt9, d.Gia9,
                d.Tien_Nt9, d.Tien9, d.So_Luong, d.Gia_Nt, d.Gia, d.Tien_Nt,
                d.Tien, d.Gia_Nt2, d.Gia2, d.Tien_Nt2, d.Tien2, d.Tien_Nt3,
                d.Tien3, d.Chiet_Khau, d.Tien_Nt4, d.Tien4, d.Gia_Tb_TT,
                dbo.fn_TCVNToUnicode(v.Ten_Vt) AS Ten_Vt,
                dbo.fn_TCVNToUnicode(k.Ten_Kho) AS Ten_Kho,
                v.Loai_Vt
            FROM {self.vp_db}.dbo.CtBH0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
            LEFT JOIN {self.sys_db}.dbo.DmKho k WITH (NOLOCK) ON k.Ma_Kho = d.Ma_Kho
            WHERE d.Stt = ?
            ORDER BY d.Stt0
        """

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(header_sql, [stt])
                h_row = cur.fetchone()
                if not h_row:
                    return None

                header_data = self._row_to_header_schema(h_row).model_dump()

                cur.execute(detail_sql, [stt])
                d_rows = cur.fetchall()
                items = [self._row_to_detail_schema(dr) for dr in d_rows]

                return VoucherDetailResponse(**header_data, items=items)
        except Exception as e:
            logger.error(f"Error querying voucher {stt}: {e}")
            return None

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
            loai_vt=(dr[37] or "1").strip()
        )

    def get_closing_date(self, ma_dvcs: str = "S1") -> Optional[str]:
        """
        Query accounting closing lock date M_Ngay_Kt_Ht from VTSYS.dbo.DmDvCs.
        """
        sql = f"SELECT Ngay_Kt_Ht FROM {self.sys_db}.dbo.DmDvCs WITH (NOLOCK) WHERE Ma_DvCs = ?"
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [ma_dvcs or "S1"])
                r = cur.fetchone()
                if r and r[0]:
                    return r[0].strftime("%Y-%m-%d")
        except Exception as e:
            logger.warning(f"Error querying DmDvCs for closing date: {e}")
        return None

    def get_next_voucher_number(
        self,
        ma_dvcs: str = "S1",
        ma_ct: str = "X1",
        ngay_ct: Optional[str] = None,
        cur: Optional[Any] = None
    ) -> str:
        """
        Finds the highest voucher number (e.g. HD1000 -> HD1001) in VP_2014.dbo.CtBH
        and verifies uniqueness via ST_Check_Number.
        """
        clean_ma_ct = (ma_ct or "X1").strip().upper()
        sql = f"""
            SELECT TOP 200 RTRIM(So_Ct)
            FROM {self.vp_db}.dbo.CtBH WITH (NOLOCK)
            WHERE Ma_Ct = ? AND So_Ct LIKE 'HD[0-9]%'
            ORDER BY Ngay_Ct DESC, Stt DESC
        """
        rows: List[str] = []
        try:
            if cur is not None:
                cur.execute(sql, [clean_ma_ct])
                fetched = cur.fetchall()
                rows = [r[0] for r in fetched if r and r[0] and isinstance(r[0], str)]
            else:
                with get_db_cursor(self.vp_db) as c:
                    c.execute(sql, [clean_ma_ct])
                    fetched = c.fetchall()
                    rows = [r[0] for r in fetched if r and r[0] and isinstance(r[0], str)]
        except Exception as e:
            logger.warning(f"Error querying max So_Ct: {e}")

        max_num = 0
        pad_len = 4
        prefix = "HD"
        for s in rows:
            s_clean = s.strip()
            m = re.match(r"^(HD)(\d+)$", s_clean, re.IGNORECASE)
            if m:
                num = int(m.group(2))
                if num > max_num:
                    max_num = num
                    pad_len = len(m.group(2))
                    prefix = m.group(1).upper()

        if max_num > 0:
            candidate = f"{prefix}{str(max_num + 1).zfill(pad_len)}"
        else:
            candidate = "HD0001"

        if ngay_ct:
            try:
                _, valid_so_ct = self.check_duplicate_number(
                    ma_dvcs=ma_dvcs or "S1",
                    moi_sua="M",
                    stt="",
                    ma_ct=clean_ma_ct,
                    ngay_ct=ngay_ct,
                    so_ct=candidate,
                    cur=cur
                )
                return valid_so_ct
            except Exception:
                pass
        return candidate

    def check_duplicate_number(
        self,
        ma_dvcs: str,
        moi_sua: str,
        stt: str,
        ma_ct: str,
        ngay_ct: str,
        so_ct: str,
        cur: Optional[Any] = None
    ) -> Tuple[bool, str]:
        """
        Check duplicate voucher number via ST_Check_Number.
        If duplicate, increments number (e.g. HD4081 -> HD4082) until unique.
        """
        curr_so_ct = (so_ct or "").strip()
        if not curr_so_ct:
            return False, self.get_next_voucher_number(ma_dvcs=ma_dvcs, ma_ct=ma_ct, ngay_ct=ngay_ct, cur=cur)

        is_dup_initially = False

        def _exec_check(c: Any, s_num: str) -> bool:
            check_sql = f"""
                DECLARE @p_Check bit = 0;
                EXEC {self.vp_db}.dbo.ST_Check_Number
                    @p_Ma_DvCs=?,
                    @p_Moi_Sua=?,
                    @p_Stt=?,
                    @p_Ma_Ct=?,
                    @p_Ngay_Ct=?,
                    @p_So_Ct=?,
                    @p_Check=@p_Check OUTPUT;
                SELECT @p_Check;
            """
            c.execute(check_sql, [ma_dvcs or "S1", moi_sua or "M", stt or "", ma_ct or "X1", ngay_ct, s_num])
            res = c.fetchone()
            return bool(res[0]) if res else False

        def _increment(s: str) -> str:
            m = re.search(r"^(.*?)(\d+)$", s)
            if m:
                pfx, dgts = m.groups()
                new_dgts = str(int(dgts) + 1).zfill(len(dgts))
                return f"{pfx}{new_dgts}"
            return f"{s}1"

        for attempt in range(500):
            if cur is not None:
                is_dup = _exec_check(cur, curr_so_ct)
            else:
                with get_db_cursor(self.vp_db) as c:
                    is_dup = _exec_check(c, curr_so_ct)

            if attempt == 0:
                is_dup_initially = is_dup

            if not is_dup:
                return is_dup_initially, curr_so_ct

            curr_so_ct = _increment(curr_so_ct)

        return is_dup_initially, curr_so_ct

    def generate_stt(self, ma_dvcs: str = "S1", cur: Optional[Any] = None) -> str:
        """
        Generates a unique 20-char ERP key via VTSYS.dbo.ST_Increase_KeyIndex.

        BẮT BUỘC có `SET NOCOUNT ON`: SP này UPDATE bảng counter `VTSYS.dbo.DmStt`
        TRƯỚC khi SELECT @p_Stt. Nếu không tắt NOCOUNT, pyodbc nhận được một result-set
        "rowcount" trước và ném `ProgrammingError: No results` ở dòng SELECT cuối →
        code rơi vào nhánh fallback Python (sinh Stt kiểu `S11...`), làm Stt KHÁC hoàn toàn
        với VFP (VFP dùng counter `DmStt` → `'S1' + 18 chữ số`, ví dụ 'S1000000000014766996').
        """
        clean_dvcs = (ma_dvcs or "S1").strip().upper()[:2]
        if cur is not None:
            try:
                sp_sql = f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Stt char(20) = '';
                    EXEC {self.sys_db}.dbo.ST_Increase_KeyIndex @p_Ma_DvCs=?, @p_Stt=@p_Stt OUTPUT;
                    SELECT @p_Stt AS Stt;
                """
                cur.execute(sp_sql, [clean_dvcs])
                r = cur.fetchone()
                if r and r[0] and r[0].strip():
                    return r[0].strip()
                logger.warning("ST_Increase_KeyIndex returned empty value; using fallback key.")
            except Exception as e:
                logger.warning(f"Error calling ST_Increase_KeyIndex: {e}")

        # Fallback an toàn (chỉ dùng khi SP lỗi/mất kết nối): DvCs(2) + 18 chữ số.
        t_ns = time.time_ns()
        rnd = random.randint(1000, 9999)
        tail = f"{t_ns}{rnd}"[-18:].zfill(18)
        return f"{clean_dvcs}{tail}"

    def save_voucher(
        self,
        data: VoucherCreateRequest,
        mode: str = "M",
        stt_override: Optional[str] = None,
        user_name: str = "KTCN3"
    ) -> VoucherSaveResponse:
        """
        Save sales invoice to VP_2014 with 7 Pre-Save checks & full ACID transaction.
        Never sets COGS fields (Gia_Nt, Gia, Tien_Nt, Tien = 0, Fix #21).
        """
        # ===== CHỐT 1: KIỂM TRA NGÀY KHÓA SỔ =====
        ngay_kt_ht = self.get_closing_date(data.ma_dvcs or "S1")
        if ngay_kt_ht and data.ngay_ct <= ngay_kt_ht:
            raise ValueError(f"Ngày chứng từ ({data.ngay_ct}) nằm trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

        # ===== CHỐT 2: TRƯỜNG BẮT BUỘC =====
        if not data.ma_dt or not data.ma_dt.strip():
            raise ValueError("Mã khách hàng (Ma_Dt) là bắt buộc!")
        if not data.ma_nx or not data.ma_nx.strip():
            data.ma_nx = "131"
        if not data.items or len(data.items) == 0:
            raise ValueError("Chứng từ phải có ít nhất 1 dòng chi tiết hàng hóa!")

        # ===== CHỐT 3: KIỂM TRA HẠN MỨC CÔNG NỢ REALTIME =====
        debt_summary = debt_repository.get_customer_debt_summary(data.ma_dt.strip())
        if debt_summary.is_over_limit:
            raise ValueError(
                f"Khách hàng {data.ma_dt} vượt quá hạn mức nợ cho phép! "
                f"(Dư nợ: {debt_summary.du_cuoi:,.0f} >= Giới hạn: {debt_summary.gioi_han:,.0f})"
            )

        # ===== CHỐT 4 & 5: CHUẨN HÓA DÒNG HÀNG & CHIẾT KHẤU = 0 & HÀNG KM (FIX #5, #17, #21) =====
        safe_ty_gia = float(data.ty_gia) if data.ty_gia and data.ty_gia > 0 else 1.0
        safe_ma_tte = (data.ma_tte or "VND").strip().upper()

        for it in data.items:
            loai_vt = (it.loai_vt or "1").strip()
            so_tam = float(it.so_tam or 0.0)
            he_so8 = float(it.he_so8 if it.he_so8 and it.he_so8 > 0 else 1.0)
            he_so9 = float(it.he_so9 if it.he_so9 and it.he_so9 > 0 else 1.0)
            so_luong9 = float(it.so_luong9 or 0.0)
            gia_nt9 = float(it.gia_nt9 or 0.0)
            chiet_khau = float(it.chiet_khau or 0.0)

            # Fix #17: VND promotional item 1-10 VND
            if safe_ma_tte == "VND" and 1 <= gia_nt9 <= 10:
                chiet_khau = 0.0

            # Loai_Vt '2' (Mút xốp) và '4' dùng cùng quy cách So_Luong = So_Tam * He_So8
            if loai_vt in ("2", "4"):
                so_luong_ban = round_amount(so_tam * he_so8, 2)
                it.so_luong8 = so_luong_ban
                it.so_luong9 = so_luong_ban
                it.so_luong = so_luong_ban
            elif loai_vt == "1":
                it.so_luong8 = 0.0
                so_luong_ban = so_luong9
                it.so_luong = round_amount(so_luong9 * he_so9, 2)
            else:
                it.so_luong8 = 0.0
                so_luong_ban = so_luong9
                it.so_luong = so_luong9

            it.tien_nt9 = round_amount(so_luong_ban * gia_nt9, 2)
            it.gia9 = float(round_vnd(gia_nt9 * safe_ty_gia))
            it.tien9 = float(round_vnd(it.tien_nt9 * safe_ty_gia))

            if chiet_khau > 0:
                it.tien_nt4 = round_amount(it.tien_nt9 * chiet_khau / 100.0, 2)
                it.tien4 = float(round_vnd(it.tien9 * chiet_khau / 100.0))
                it.tien_nt2 = round_amount(it.tien_nt9 - it.tien_nt4, 2)
                it.tien2 = float(round_vnd(it.tien9 - it.tien4))
                it.gia_nt2 = round_amount(gia_nt9 * (100.0 - chiet_khau) / 100.0, 2)
                it.gia2 = float(round_vnd(it.gia9 * (100.0 - chiet_khau) / 100.0))
            else:
                it.tien_nt4 = 0.0
                it.tien4 = 0.0
                it.tien_nt2 = it.tien_nt9
                it.tien2 = it.tien9
                it.gia_nt2 = gia_nt9
                it.gia2 = it.gia9

            it.chiet_khau = chiet_khau

            # Fix #21 (mở rộng): 4 cột GIÁ VỐN bên phiếu bán hàng LUÔN để NULL.
            # Sổ giá vốn xuất kho cuối tháng sẽ tính và ghi ngược vào 4 cột này.
            it.gia_nt = None
            it.gia = None
            it.tien_nt = None
            it.tien = None

            # NULL-policy khớp VFP (Ma_Ct='X1'): chiết khấu 0 -> Chiet_Khau/Tien_Nt4/Tien4 = NULL;
            # tk_du4 (TK chiết khấu) cũng NULL khi không có chiết khấu; Tien_Nt3/Tien3 -> NULL.
            if chiet_khau <= 0:
                it.chiet_khau = None
                it.tien_nt4 = None
                it.tien4 = None
                it.tk_du4 = None
            it.tien_nt3 = None
            it.tien3 = None

        # ===== CHỐT 6: ĐỒNG BỘ TỔNG HEADER & THUẾ GTGT (FIX #10) =====
        # CHỈ cộng dồn các cột TIỀN BÁN. TTien_Nt / TTien là GIÁ VỐN -> để NULL.
        data.ttien_nt2 = round_amount(sum(it.tien_nt2 for it in data.items if it.tien_nt2), 2)
        _nt4 = round_amount(sum(it.tien_nt4 for it in data.items if it.tien_nt4), 2)
        _t4 = float(round_vnd(sum(it.tien4 for it in data.items if it.tien4)))
        data.ttien2 = float(round_vnd(sum(it.tien2 for it in data.items if it.tien2)))

        # Fix #21 (mở rộng) + NULL-policy VFP:
        #   - TTien_Nt / TTien (giá vốn) LUÔN NULL khi lưu phiếu bán.
        #   - TTien_Nt3 / TTien3 LUÔN NULL (không tính VAT; Ma_Thue/Thue_GTGT = NULL).
        #   - TTien_Nt4 / TTien4 NULL khi không có chiết khấu.
        data.ttien_nt = None
        data.ttien = None
        data.ttien_nt3 = None
        data.ttien3 = None
        data.ttien_nt4 = _nt4 if _nt4 > 0 else None
        data.ttien4 = _t4 if _t4 > 0 else None

        # Nghiệp vụ chứng từ bán hàng VP_2014 (đối chiếu dữ liệu VFP thật):
        #   - Loai_Ck LUÔN = '2'
        #   - Ma_Thue & Thue_GTGT LUÔN = NULL (không tính VAT)
        data.loai_ck = "2"
        data.ma_thue = None
        data.thue_gtgt = None

        data.ttien_nt0 = round_amount((data.ttien_nt2 or 0.0) + (data.ttien_nt3 or 0.0), 2)
        data.ttien0 = float(round_vnd((data.ttien2 or 0.0) + (data.ttien3 or 0.0)))

        # ===== CHỐT 7: CHỐNG TRÙNG SỐ & GHI BỀN VỮNG TRONG TRANSACTION ACID =====
        with get_db_transaction(self.vp_db) as (conn, cur):
            # CHỐT 2b (trong transaction): MÃ KHÁCH HÀNG PHẢI TỒN TẠI TRONG DmDt.
            # Chặn ghi rác: nếu người dùng gõ TÊN khách thay vì MÃ, Ma_Dt không khớp DmDt
            # -> LEFT JOIN lúc đọc trả Ten_Dt = NULL. Validate FK trước khi ghi.
            clean_ma_dt = (data.ma_dt or "").strip().upper()
            cur.execute(
                f"SELECT TOP 1 1 FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) "
                f"WHERE UPPER(RTRIM(Ma_Dt)) = ?",
                [clean_ma_dt],
            )
            if cur.fetchone() is None:
                raise ValueError(
                    f"Mã khách hàng '{clean_ma_dt}' không tồn tại trong danh mục DmDt! "
                    f"Vui lòng chọn mã hợp lệ từ danh sách gợi ý."
                )
            data.ma_dt = clean_ma_dt

            is_dup, final_so_ct = self.check_duplicate_number(
                ma_dvcs=data.ma_dvcs or "S1",
                moi_sua=mode,
                stt=stt_override or "",
                ma_ct=data.ma_ct or "X1",
                ngay_ct=data.ngay_ct,
                so_ct=data.so_ct or "",
                cur=cur
            )
            data.so_ct = final_so_ct

            if mode == "M":
                stt = self.generate_stt(data.ma_dvcs or "S1", cur)
            else:
                if not stt_override or not stt_override.strip():
                    raise ValueError("Chế độ sửa yêu cầu mã chứng từ (stt) hợp lệ!")
                stt = stt_override.strip()

            # 1. Ghi Header dbo.CtBH
            if mode == "M":
                insert_header_sql = f"""
                    INSERT INTO {self.vp_db}.dbo.CtBH (
                        Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ma_Tte, Ty_Gia,
                        Ngay_Ps, Ngay_Ct, So_Ct, Ma_Xe, Ma_Bp, Ma_HD,
                        Ma_Dt, Ma_Nx, Tk2, Tk3, Tk_Du3, Tk4,
                        Ong_Ba, Dia_Chi, Dien_Giai0, Desc_EN0,
                        TTien_Nt, TTien_Nt0, TTien_Nt2, TTien_Nt3, TTien_Nt4,
                        TTien, TTien0, TTien3, TTien2, TTien4,
                        Loai_Ck, TyLeCK, Han_Tt, Ma_Thue, Thue_GTGT,
                        Ma_DtGtGt, Ten_DtGtGt, So_Ct0, Ngay_Ct0, Stt_HBTL,
                        Confirmed, Posted, Printed, UserName
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        dbo.fn_UnicodeToTCVN(?), dbo.fn_UnicodeToTCVN(?), dbo.fn_UnicodeToTCVN(?), dbo.fn_UnicodeToTCVN(?),
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, dbo.fn_UnicodeToTCVN(?), ?, ?, ?,
                        ?, ?, ?, ?
                    )
                """
                cur.execute(insert_header_sql, [
                    stt, data.ma_dvcs or "S1", data.ma_ct or "X1", data.nh_ct or "2", data.ma_tte or "VND", safe_ty_gia,
                    data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                    data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                    data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or "", data.desc_en0 or None,
                    data.ttien_nt, data.ttien_nt0, data.ttien_nt2, data.ttien_nt3, data.ttien_nt4,
                    data.ttien, data.ttien0, data.ttien3, data.ttien2, data.ttien4,
                    data.loai_ck or "2", None, None, data.ma_thue, data.thue_gtgt,
                    data.ma_dtgtgt or None, data.ten_dtgtgt or None, data.so_ct0 or None, data.ngay_ct0, data.stt_hbtl or None,
                    1 if data.confirmed is not False else 1, 1 if data.posted else 0, (1 if data.printed else None), user_name or "KTCN3"
                ])
            else:
                update_header_sql = f"""
                    UPDATE {self.vp_db}.dbo.CtBH SET
                        Ma_DvCs = ?, Ma_Ct = ?, Nh_Ct = ?, Ma_Tte = ?, Ty_Gia = ?,
                        Ngay_Ps = ?, Ngay_Ct = ?, So_Ct = ?, Ma_Xe = ?, Ma_Bp = ?, Ma_HD = ?,
                        Ma_Dt = ?, Ma_Nx = ?, Tk2 = ?, Tk3 = ?, Tk_Du3 = ?, Tk4 = ?,
                        Ong_Ba = dbo.fn_UnicodeToTCVN(?), Dia_Chi = dbo.fn_UnicodeToTCVN(?),
                        Dien_Giai0 = dbo.fn_UnicodeToTCVN(?), Desc_EN0 = dbo.fn_UnicodeToTCVN(?),
                        TTien_Nt = ?, TTien_Nt0 = ?, TTien_Nt2 = ?, TTien_Nt3 = ?, TTien_Nt4 = ?,
                        TTien = ?, TTien0 = ?, TTien3 = ?, TTien2 = ?, TTien4 = ?,
                        Loai_Ck = ?, TyLeCK = ?, Han_Tt = ?, Ma_Thue = ?, Thue_GTGT = ?,
                        Ma_DtGtGt = ?, Ten_DtGtGt = dbo.fn_UnicodeToTCVN(?), So_Ct0 = ?, Ngay_Ct0 = ?,
                        Confirmed = ?, Posted = ?, Printed = ?, UserName = ?
                    WHERE Stt = ?
                """
                cur.execute(update_header_sql, [
                    data.ma_dvcs or "S1", data.ma_ct or "X1", data.nh_ct or "2", data.ma_tte or "VND", safe_ty_gia,
                    data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                    data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                    data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or "", data.desc_en0 or None,
                    data.ttien_nt, data.ttien_nt0, data.ttien_nt2, data.ttien_nt3, data.ttien_nt4,
                    data.ttien, data.ttien0, data.ttien3, data.ttien2, data.ttien4,
                    data.loai_ck or "2", None, None, data.ma_thue, data.thue_gtgt,
                    data.ma_dtgtgt or None, data.ten_dtgtgt or None, data.so_ct0 or None, data.ngay_ct0,
                    1 if data.confirmed is not False else 1, 1 if data.posted else 0, (1 if data.printed else None), user_name or "KTCN3",
                    stt
                ])

            # 2. Ghi Detail dbo.CtBH0 (Delete cũ nếu 'S' + Insert mới)
            if mode == "S":
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.CtBH0 WHERE Stt = ?", [stt])

            insert_detail_sql = f"""
                INSERT INTO {self.vp_db}.dbo.CtBH0 (
                    Stt_PX, Stt0, Stt, Tk, Tk_Du, Tk_Du2, Tk_Du4,
                    Ma_Kho, Ma_Vt, Dvt, Dvt_Ban, So_Tam, He_So8,
                    So_Luong8, He_So9, So_Luong9, Gia_Nt9, Gia9,
                    Tien_Nt9, Tien9, So_Luong, Gia_Nt, Gia, Tien_Nt,
                    Tien, Gia_Nt2, Gia2, Tien_Nt2, Tien2, Tien_Nt3,
                    Tien3, Chiet_Khau, Tien_Nt4, Tien4, Gia_Tb_TT
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, dbo.fn_UnicodeToTCVN(?), dbo.fn_UnicodeToTCVN(?), ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?
                )
            """
            for it in data.items:
                stt0 = self.generate_stt(data.ma_dvcs or "S1", cur)
                cur.execute(insert_detail_sql, [
                    it.stt_px or None, stt0, stt, it.tk or "632", it.tk_du or "1561", it.tk_du2 or "5111", it.tk_du4 or None,
                    it.ma_kho or "", it.ma_vt, it.dvt or "", it.dvt_ban or None, it.so_tam or 0.0, it.he_so8 or 1.0,
                    it.so_luong8 or 0.0, it.he_so9 or 1.0, it.so_luong9 or 0.0, it.gia_nt9 or 0.0, it.gia9 or 0.0,
                    it.tien_nt9 or 0.0, it.tien9 or 0.0, it.so_luong or 0.0, None, None, None,
                    None, it.gia_nt2 or 0.0, it.gia2 or 0.0, it.tien_nt2 or 0.0, it.tien2 or 0.0, it.tien_nt3,
                    it.tien3, it.chiet_khau, it.tien_nt4, it.tien4, "C"
                ])

            # 2b. Chế độ Sửa 'S': xóa sổ cái cũ của chứng từ TRONG transaction trước khi post lại.
            #     Bắt buộc, vì nếu không CtBH_Post/CtBH_SoCaiVT_Save gọi lần 2 sẽ APPEND thêm
            #     các dòng SoCai/SoCaiVT của cùng Stt -> nhân đôi bút toán sổ cái.
            #     Cùng transaction với ghi Header+Detail nên vẫn đảm bảo ACID.
            if mode == "S":
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.SoCai WHERE Stt = ?", [stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.SoCaiVT WHERE Stt = ?", [stt])

            # 3. Post Ledger & Save Document Number
            try:
                cur.execute(f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.CtBH_Post @p_Kieu='1', @p_Stt=?, @p_UserName=?", [stt, user_name or "KTCN3"])
            except Exception as e:
                logger.warning(f"CtBH_Post warning: {e}")
                # Đã xóa sổ cái cũ mà post lại thất bại -> rollback để bảo toàn sổ cái gốc
                if mode == "S":
                    raise

            # 3b. Ghi SỔ CÁI TÀI KHOẢN (SoCai) — bút toán DOANH THU:
            #        Nợ TK công nợ (Tk2, mặc định 1311) / Có TK doanh thu (chi tiết Tk_Du2, mặc định 5112)
            #        số tiền = TTien_Nt2 (doanh thu sau chiết khấu, trước VAT).
            #     ⚠️ BẮT BUỘC: công nợ khách hàng đọc từ dbo.SoCai, nên THIẾU bước này thì
            #        chứng từ đã lưu sẽ KHÔNG xuất hiện trong bảng công nợ / cảnh báo hạn mức.
            #     Chuẩn 1S (đối chiếu VFP thật): MỖI phiếu X1 ghi ĐÚNG 1 dòng SoCai.
            #     Bút toán GIÁ VỐN (Nợ 632x / Có 155) KHÔNG ghi ở đây — sổ giá vốn cuối tháng lo.
            #     Nhóm theo Tk_Co (nếu nhiều TK doanh thu thì tách dòng; bình thường chỉ 1 nhóm).
            revenue_groups: Dict[str, float] = {}
            for it in data.items:
                tk_co = (it.tk_du2 or "").strip()
                if not tk_co:
                    continue
                revenue_groups[tk_co] = revenue_groups.get(tk_co, 0.0) + float(it.tien_nt2 or 0.0)

            if revenue_groups:
                tk_no = (data.tk2 or "1311").strip() or "1311"
                safe_ccy = (data.ma_tte or "VND").strip().upper()
                fn = f"{self.vp_db}.dbo.fn_UnicodeToTCVN"
                for tk_co, group_amount_nt in revenue_groups.items():
                    amount_nt = round_amount(group_amount_nt, 2)
                    if abs(amount_nt) < 0.005:
                        continue
                    amount_vnd = float(round_vnd(amount_nt * safe_ty_gia))
                    tien_vnd = amount_vnd
                    tien_nt = None if safe_ccy == "VND" else amount_nt
                    so_ct_line = (final_so_ct or "").strip() or None
                    try:
                        # Văn bản truyền xuống SP PHẢI là TCVN3 (SP không tự chuyển mã).
                        cur.execute(f"""
                            SET NOCOUNT ON;
                            DECLARE @p_Ong_Ba nvarchar(64)      = {fn}(?);
                            DECLARE @p_Dien_Giai nvarchar(128)  = {fn}(?);
                            DECLARE @p_Dien_GiaiN nvarchar(128) = {fn}(?);
                            DECLARE @p_Dien_GiaiC nvarchar(128) = {fn}(?);
                            EXEC {self.vp_db}.dbo.CtBH_SoCai
                              @p_Ma_Dvcs=?, @p_Stt=?, @p_Stt0=?, @p_Ma_Ct=?, @p_Nh_Ct=?,
                              @p_Ngay_Ct=?, @p_So_Ct=?, @p_Ma_Dt0=?, @p_Ong_Ba=@p_Ong_Ba,
                              @p_Dien_Giai=@p_Dien_Giai, @p_Tk_No=?, @p_Ma_Dt_No=?, @p_Tk_Co=?, @p_Ma_Dt_Co=?,
                              @p_Ma_Tte=?, @p_Ty_Gia=?, @p_Ma_HD=?, @p_Ma_Bp=?,
                              @p_Dien_GiaiN=@p_Dien_GiaiN, @p_Dien_GiaiC=@p_Dien_GiaiC,
                              @p_Tien_Nt=?, @p_Tien=?, @p_Stt_Bt=?,
                              @p_Desc_EN=NULL, @p_Desc_ENN=NULL, @p_Desc_ENC=NULL;
                        """, [
                            data.ong_ba or "",
                            data.dien_giai0 or "",
                            data.dien_giai0 or "",
                            data.dien_giai0 or "",
                            data.ma_dvcs or "S1", stt, stt, data.ma_ct or "X1", data.nh_ct or "2",
                            data.ngay_ct, so_ct_line, data.ma_dt,
                            tk_no, data.ma_dt, tk_co, "",
                            data.ma_tte or "VND", safe_ty_gia, data.ma_hd or None, data.ma_bp or None,
                            tien_nt, tien_vnd, "2",
                        ])
                    except Exception as e:
                        logger.warning(f"CtBH_SoCai warning: {e}")
                        if mode == "S":
                            raise

            try:
                cur.execute(f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.CtBH_SoCaiVT_Save @p_Stt=?", [stt])
            except Exception as e:
                logger.warning(f"CtBH_SoCaiVT_Save warning: {e}")
                if mode == "S":
                    raise
            try:
                cur.execute(f"SET NOCOUNT ON; EXEC {self.sys_db}.dbo.ST_Save_Number @p_Ma_DvCs=?, @p_Ma_Ct=?, @p_So_Ct=?", [data.ma_dvcs or "S1", data.ma_ct or "X1", final_so_ct])
            except Exception as e:
                logger.warning(f"ST_Save_Number warning: {e}")

            # 4. Integrity Assertion before COMMIT (Header ⟷ Detail sums match)
            #    TTien_Nt/TTien là GIÁ VỐN -> NULL nên KHÔNG so sánh với SUM(Tien_Nt9).
            cur.execute(f"SELECT ISNULL(SUM(Tien_Nt2), 0), COUNT(1) FROM {self.vp_db}.dbo.CtBH0 WHERE Stt = ?", [stt])
            check_row = cur.fetchone()
            if check_row:
                db_sum2 = float(check_row[0] or 0.0)
                db_count = int(check_row[1] or 0)
                if abs(db_sum2 - (data.ttien_nt2 or 0.0)) > 0.05:
                    raise AssertionError(
                        f"Lệch tổng tiền Header và Detail: DB Tien_Nt2={db_sum2} vs Header={data.ttien_nt2}"
                    )
                if db_count != len(data.items):
                    raise AssertionError(f"Số lượng dòng chi tiết không khớp: DB={db_count} vs Form={len(data.items)}")

        return VoucherSaveResponse(stt=stt, so_ct=final_so_ct, message="Lưu chứng từ thành công.")

    def delete_voucher(self, stt: str, user_name: str = "KTCN3") -> VoucherDeleteResponse:
        """
        Delete voucher from VP_2014 via CtBH_Delete SP with ACID transaction.
        Checks locked period and voucher existence.
        """
        if not stt or not stt.strip():
            raise ValueError("Mã chứng từ không được để trống!")
        clean_stt = stt.strip()

        with get_db_transaction(self.vp_db) as (conn, cur):
            cur.execute(f"SELECT Confirmed, Posted, Ngay_Ct FROM {self.vp_db}.dbo.CtBH WITH (NOLOCK) WHERE Stt = ?", [clean_stt])
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Không tìm thấy chứng từ có mã {clean_stt}.")

            ngay_ct = row[2].strftime("%Y-%m-%d") if row[2] else ""
            ngay_kt_ht = self.get_closing_date()
            if ngay_kt_ht and ngay_ct and ngay_ct <= ngay_kt_ht:
                raise ValueError(f"Không thể xóa chứng từ trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

            try:
                cur.execute(f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.CtBH_Delete @p_Stt=?, @p_UserName=?", [clean_stt, user_name or "KTCN3"])
            except Exception as e:
                logger.warning(f"CtBH_Delete SP warning, executing cascaded SQL delete: {e}")
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.SoCai WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.SoCaiVT WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.CtBH0 WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.CtBH WHERE Stt = ?", [clean_stt])

        return VoucherDeleteResponse(stt=clean_stt, message="Xóa chứng từ thành công.")

voucher_repository = VoucherRepository()

