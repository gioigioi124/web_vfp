import logging
from typing import List, Optional
from app.config import settings
from app.database import get_db_cursor
from app.utils.unicode import tcvn_to_unicode
from app.schemas.lookup import (
    VatTuLookup, KhachHangLookup, KhoLookup, ThueLookup,
    TaiKhoanLookup, NhapXuatLookup, XeLookup, BoPhanLookup,
    HopDongLookup, TienTeLookup
)

logger = logging.getLogger("app.repositories.lookup")

class LookupRepository:
    def __init__(self):
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        # fn_TCVNToUnicode is defined in VP_2014; qualify it so the call works
        # even when the connection's default database is VTSYS.
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

    def get_vat_tu(self, query: Optional[str] = None, limit: int = 200) -> List[VatTuLookup]:
        results: List[VatTuLookup] = []
        fn = self.fn_uni
        sql = f"""
            SELECT TOP ({limit})
                Ma_Vt, {fn}(Ten_Vt) AS Ten_Vt, {fn}(Dvt) AS Dvt, {fn}(Dvt_Ban) AS Dvt_Ban, Loai_Vt,
                Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck,
                ISNULL(He_So0, 1) AS He_So0,
                ISNULL(He_So1, 1) AS He_So1,
                ISNULL(He_So2, 1) AS He_So2,
                {fn}(Dvt0) AS Dvt0, {fn}(Dvt1) AS Dvt1, {fn}(Dvt2) AS Dvt2
            FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
        """
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE Ma_Vt LIKE ? OR {fn}(Ten_Vt) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY Ma_Vt"

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(VatTuLookup(
                        ma_vt=(r[0] or "").strip(),
                        ten_vt=(r[1] or "").strip(),
                        dvt=(r[2] or "").strip(),
                        dvt_ban=(r[3] or "").strip(),
                        loai_vt=(r[4] or "1").strip(),
                        tk_gv=(r[5] or "632").strip(),
                        tk_vt=(r[6] or "1561").strip(),
                        tk_dt=(r[7] or "5111").strip(),
                        tk_ck=(r[8] or "521").strip(),
                        he_so0=float(r[9] or 1.0),
                        he_so1=float(r[10] or 1.0),
                        he_so2=float(r[11] or 1.0),
                        dvt0=(r[12] or "").strip(),
                        dvt1=(r[13] or "").strip(),
                        dvt2=(r[14] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmVt: {e}")
        return results

    def get_khach_hang(self, query: Optional[str] = None, limit: int = 200) -> List[KhachHangLookup]:
        results: List[KhachHangLookup] = []
        fn = self.fn_uni
        sql = f"""
            SELECT TOP ({limit})
                d.Ma_Dt, {fn}(d.Ten_Dt) AS Ten_Dt,
                {fn}(d.Dia_Chi) AS Dia_Chi,
                {fn}(d.Doi_Tac) AS Doi_Tac,
                d.Ms_Thue,
                ISNULL(d.Han_Tt, 0) AS Han_Tt,
                ISNULL(d.Gioi_Han, 0) AS Gioi_Han,
                ISNULL(d.Toi_Han, 0) AS Toi_Han,
                ISNULL(nh.Ma_Bp, '') AS Ma_Bp,
                {fn}(ISNULL(bp.Ten_Bp, '')) AS Ten_Bp,
                RTRIM(ISNULL(d.Ma_Vm, '')) AS Ma_Vm
            FROM {self.sys_db}.dbo.DmDt d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmNhDt nh WITH (NOLOCK) ON nh.Ma_Nh_Dt = d.Ma_Nh_Dt
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = nh.Ma_Bp
        """
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE d.Ma_Dt LIKE ? OR {fn}(d.Ten_Dt) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY d.Ma_Dt"

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    ten_dt = (r[1] or "").strip()
                    doi_tac = (r[3] or "").strip()
                    # Per All_fix.md #24 (Record 11 & 50):
                    # IF EMPTY(Doi_Tac) -> Ong_Ba = Ten_Dt ELSE Ong_Ba = Doi_Tac
                    ong_ba = doi_tac if doi_tac else ten_dt
                    results.append(KhachHangLookup(
                        ma_dt=(r[0] or "").strip(),
                        ten_dt=ten_dt,
                        dia_chi=(r[2] or "").strip(),
                        ong_ba=ong_ba,
                        ms_thue=(r[4] or "").strip(),
                        han_tt=int(r[5] or 0),
                        gioi_han=float(r[6] or 0.0),
                        toi_han=float(r[7] or 0.0),
                        doi_tac=doi_tac,
                        ma_bp=(r[8] or "").strip(),
                        ten_bp=(r[9] or "").strip(),
                        ma_xe="",
                        ma_vm=(r[10] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmDt: {e}")
        return results

    def get_kho(self) -> List[KhoLookup]:
        results: List[KhoLookup] = []
        sql = f"SELECT Ma_Kho, {self.fn_uni}(Ten_Kho) AS Ten_Kho FROM {self.sys_db}.dbo.DmKho WITH (NOLOCK) ORDER BY Ma_Kho"
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    results.append(KhoLookup(
                        ma_kho=(r[0] or "").strip(),
                        ten_kho=(r[1] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmKho: {e}")
        return results

    def get_thue(self) -> List[ThueLookup]:
        results: List[ThueLookup] = []
        sql = f"""
            SELECT Ma_Thue, {self.fn_uni}(Ten_Thue) AS Ten_Thue, ISNULL(Thue_GTGT, 0) AS Thue_GTGT, Tk
            FROM {self.sys_db}.dbo.DmThue WITH (NOLOCK)
            ORDER BY Ma_Thue
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    results.append(ThueLookup(
                        ma_thue=(r[0] or "").strip(),
                        ten_thue=(r[1] or "").strip(),
                        thue_gtgt=float(r[2] or 0.0),
                        tk=(r[3] or "33311").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmThue: {e}")
        return results

    def get_tai_khoan(self, query: Optional[str] = None) -> List[TaiKhoanLookup]:
        results: List[TaiKhoanLookup] = []
        sql = f"SELECT Tk, {self.fn_uni}(Ten_Tk) AS Ten_Tk, Tk_Dt FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK)"
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE Tk LIKE ? OR {self.fn_uni}(Ten_Tk) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY Tk"

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(TaiKhoanLookup(
                        tk=(r[0] or "").strip(),
                        ten_tk=(r[1] or "").strip(),
                        tk_dt=(r[2] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmTk: {e}")
        return results

    def get_nhap_xuat(self) -> List[NhapXuatLookup]:
        results: List[NhapXuatLookup] = []
        sql = f"SELECT Ma_Nx, {self.fn_uni}(Ten_Nx) AS Ten_Nx, Dinh_Khoan FROM {self.sys_db}.dbo.DmNx WITH (NOLOCK) ORDER BY Ma_Nx"
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    results.append(NhapXuatLookup(
                        ma_nx=(r[0] or "").strip(),
                        ten_nx=(r[1] or "").strip(),
                        dinh_khoan=(r[2] or "C").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmNx: {e}")
        return results

    def get_xe(self, query: Optional[str] = None, limit: int = 200) -> List[XeLookup]:
        results: List[XeLookup] = []
        fn = self.fn_uni
        sql = f"SELECT TOP ({limit}) Ma_Xe, {fn}(Ten_Xe) AS Ten_Xe FROM {self.sys_db}.dbo.DmXe WITH (NOLOCK)"
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE Ma_Xe LIKE ? OR {fn}(Ten_Xe) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY Ma_Xe"
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(XeLookup(
                        ma_xe=(r[0] or "").strip(),
                        ten_xe=(r[1] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmXe: {e}")
        return results

    def get_bo_phan(self) -> List[BoPhanLookup]:
        results: List[BoPhanLookup] = []
        sql = f"SELECT Ma_Bp, {self.fn_uni}(Ten_Bp) AS Ten_Bp FROM {self.sys_db}.dbo.DmBp WITH (NOLOCK) ORDER BY Ma_Bp"
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    results.append(BoPhanLookup(
                        ma_bp=(r[0] or "").strip(),
                        ten_bp=(r[1] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmBp: {e}")
        return results

    def get_hop_dong(self, query: Optional[str] = None) -> List[HopDongLookup]:
        results: List[HopDongLookup] = []
        sql = f"SELECT Ma_HD, {self.fn_uni}(Ten_HD) AS Ten_HD FROM {self.sys_db}.dbo.DmHD WITH (NOLOCK)"
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE Ma_HD LIKE ? OR {self.fn_uni}(Ten_HD) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY Ma_HD"

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(HopDongLookup(
                        ma_hd=(r[0] or "").strip(),
                        ten_hd=(r[1] or "").strip()
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmHD: {e}")
        return results

    def get_tien_te(self) -> List[TienTeLookup]:
        results: List[TienTeLookup] = []
        sql = f"""
            SELECT Ma_Tte, {self.fn_uni}(Ten_Tte) AS Ten_Tte, ISNULL(Ty_Gia, 1.0) AS Ty_Gia
            FROM {self.sys_db}.dbo.DmTte WITH (NOLOCK)
            ORDER BY Ma_Tte
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    results.append(TienTeLookup(
                        ma_tte=(r[0] or "").strip(),
                        ten_tte=(r[1] or "").strip(),
                        ty_gia=float(r[2] or 1.0)
                    ))
        except Exception as e:
            logger.warning(f"Could not query DmTte: {e}")
        return results

lookup_repository = LookupRepository()
