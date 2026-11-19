"""Read-only query methods for VoucherRepository."""

import logging
import math
from typing import List, Optional

from app.schemas.voucher import (
    VoucherDetailResponse,
    VoucherHeaderSchema,
    VoucherListPagination,
    VoucherListResponse,
    VoucherSummary,
)
from app.repositories.voucher.helpers import _CLOSING_DATE_SENTINEL

logger = logging.getLogger("app.repositories.voucher")


class VoucherQueryMixin:
    """Read-only queries: list_vouchers, get_voucher_detail, and get_closing_date."""

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
        dien_giai: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        db_mode: Optional[str] = "sales",
    ) -> VoucherListResponse:
        """
        Query vouchers with filtering and pagination. 100% READ-ONLY (SELECT only).
        Supports both VP_2014 (db_mode='sales') and KH_2014 (db_mode='warehouse').
        """
        target_db = self._get_target_db(db_mode)
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
            dien_giai=dien_giai,
            db_mode=db_mode,
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
            FROM {target_db}.dbo.CtBH h WITH (NOLOCK)
            WHERE {where_sql}
        """

        # 2. Main data query: phân trang CtBH trong CTE Page trước khi LEFT JOIN 6 bảng danh mục
        #    và chạy fn_TCVNToUnicode chỉ trên <= 50 dòng kết quả thay vì toàn bộ tập lọc.
        data_sql = f"""
            WITH Page AS (
                SELECT h.*
                FROM {target_db}.dbo.CtBH h WITH (NOLOCK)
                WHERE {where_sql}
                ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            )
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                {self.fn_uni}(h.Ong_Ba) AS Ong_Ba,
                {self.fn_uni}(h.Dia_Chi) AS Dia_Chi,
                {self.fn_uni}(h.Dien_Giai0) AS Dien_Giai0,
                {self.fn_uni}(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                {self.fn_uni}(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                {self.fn_uni}(c.Ten_Dt) AS Ten_Dt,
                {self.fn_uni}(x.Ten_Xe) AS Ten_Xe,
                {self.fn_uni}(bp.Ten_Bp) AS Ten_Bp,
                {self.fn_uni}(nx.Ten_Nx) AS Ten_Nx,
                {self.fn_uni}(tk.Ten_Tk) AS Ten_Tk2,
                {self.fn_uni}(hd.Ten_HD) AS Ten_HD,
                {self.fn_uni}(c.Dia_Chi) AS DmDt_Dia_Chi,
                RTRIM(ISNULL(c.Phone, '')) AS DmDt_Phone
            FROM Page h
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = h.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmNx nx WITH (NOLOCK) ON nx.Ma_Nx = h.Ma_Nx
            LEFT JOIN {self.sys_db}.dbo.DmTk tk WITH (NOLOCK) ON tk.Tk = h.Tk2
            LEFT JOIN {self.sys_db}.dbo.DmHD hd WITH (NOLOCK) ON hd.Ma_HD = h.Ma_HD
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
        """

        total_records = 0
        summary = VoucherSummary()
        items: List[VoucherHeaderSchema] = []

        try:
            with self._get_db_cursor(target_db) as cur:
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

                # Short-circuit: không chạy câu truy vấn chi tiết khi tập lọc rỗng
                if total_records > 0:
                    cur.execute(data_sql, [*params, offset, page_size])
                    rows = cur.fetchall()
                    for r in rows:
                        items.append(self._row_to_header_schema(r))
                    # Hiển thị số mới nhất ở cuối danh sách (cũ ở trên, mới nhất ở dưới cùng)
                    items.reverse()
        except Exception as e:
            logger.error(f"Error querying vouchers ({db_mode}): {e}")

        total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1
        pagination = VoucherListPagination(
            page=page,
            page_size=page_size,
            total_records=total_records,
            total_pages=total_pages,
            has_next=page < total_pages,
        )

        return VoucherListResponse(items=items, pagination=pagination, summary=summary)

    def get_voucher_detail(self, stt: str, db_mode: Optional[str] = "sales") -> Optional[VoucherDetailResponse]:
        """
        Get complete voucher details (46 Header cols + 35 Detail cols). 100% READ-ONLY.
        """
        target_db = self._get_target_db(db_mode)
        header_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                {self.fn_uni}(h.Ong_Ba) AS Ong_Ba,
                {self.fn_uni}(h.Dia_Chi) AS Dia_Chi,
                {self.fn_uni}(h.Dien_Giai0) AS Dien_Giai0,
                {self.fn_uni}(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                {self.fn_uni}(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                {self.fn_uni}(c.Ten_Dt) AS Ten_Dt,
                {self.fn_uni}(x.Ten_Xe) AS Ten_Xe,
                {self.fn_uni}(bp.Ten_Bp) AS Ten_Bp,
                {self.fn_uni}(nx.Ten_Nx) AS Ten_Nx,
                {self.fn_uni}(tk.Ten_Tk) AS Ten_Tk2,
                {self.fn_uni}(hd.Ten_HD) AS Ten_HD,
                {self.fn_uni}(c.Dia_Chi) AS DmDt_Dia_Chi,
                RTRIM(ISNULL(c.Phone, '')) AS DmDt_Phone
            FROM {target_db}.dbo.CtBH h WITH (NOLOCK)
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
                {self.fn_uni}(d.Dvt) AS Dvt,
                {self.fn_uni}(d.Dvt_Ban) AS Dvt_Ban,
                d.So_Tam, d.He_So8,
                d.So_Luong8, d.He_So9, d.So_Luong9, d.Gia_Nt9, d.Gia9,
                d.Tien_Nt9, d.Tien9, d.So_Luong, d.Gia_Nt, d.Gia, d.Tien_Nt,
                d.Tien, d.Gia_Nt2, d.Gia2, d.Tien_Nt2, d.Tien2, d.Tien_Nt3,
                d.Tien3, d.Chiet_Khau, d.Tien_Nt4, d.Tien4, d.Gia_Tb_TT,
                {self.fn_uni}(v.Ten_Vt) AS Ten_Vt,
                {self.fn_uni}(k.Ten_Kho) AS Ten_Kho,
                v.Loai_Vt
            FROM {target_db}.dbo.CtBH0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
            LEFT JOIN {self.sys_db}.dbo.DmKho k WITH (NOLOCK) ON k.Ma_Kho = d.Ma_Kho
            WHERE d.Stt = ?
            ORDER BY d.Stt0
        """

        try:
            with self._get_db_cursor(target_db) as cur:
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
            logger.error(f"Error querying voucher {stt} ({db_mode}): {e}")
            return None

    def get_closing_date(self, ma_dvcs: str = "S1") -> Optional[str]:
        """
        Query accounting closing lock date M_Ngay_Kt_Ht from VTSYS.dbo.DmDvCs (TTL 60s).
        """
        clean_dvcs = (ma_dvcs or "S1").strip().upper()
        cached = self._closing_date_cache.get(clean_dvcs)
        if cached is not None:
            return cached or None

        sql = f"SELECT Ngay_Kt_Ht FROM {self.sys_db}.dbo.DmDvCs WITH (NOLOCK) WHERE Ma_DvCs = ?"
        try:
            with self._get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [clean_dvcs])
                r = cur.fetchone()
                val = r[0].strftime("%Y-%m-%d") if (r and r[0]) else _CLOSING_DATE_SENTINEL
                self._closing_date_cache.set(clean_dvcs, val)
                return val or None
        except Exception as e:
            logger.warning(f"Error querying DmDvCs for closing date: {e}")
        return None
