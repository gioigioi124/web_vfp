import logging
import unicodedata
from typing import List, Optional

from app.config import settings
from app.database import get_db_cursor
from app.schemas.lookup import (
    VatTuLookup, KhachHangLookup, KhoLookup, ThueLookup,
    TaiKhoanLookup, NhapXuatLookup, XeLookup, BoPhanLookup,
    HopDongLookup, TienTeLookup, KhoanMucLookup, SanPhamLookup
)
from app.utils.ttl_cache import TTLCache

logger = logging.getLogger("app.repositories.lookup")

_STATIC_TTL = 300.0   # 5 phút cho danh mục nhỏ ít biến động
_CUSTOMER_TTL = 60.0  # 60 giây cho DmDt (5.199 dòng)


def _strip_accents_lower(text: str) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    cleaned = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return cleaned.replace("đ", "d").replace("Đ", "d").lower().strip()


class LookupRepository:
    def __init__(self):
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        # fn_TCVNToUnicode is defined in VP_2014; qualify it so the call works
        # even when the connection's default database is VTSYS.
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self._cache = TTLCache(default_ttl=_STATIC_TTL, max_size=32)

    def invalidate_cache(self, prefix: Optional[str] = None) -> None:
        self._cache.invalidate(prefix)

    def get_vat_tu(self, query: Optional[str] = None, limit: int = 200) -> List[VatTuLookup]:
        results: List[VatTuLookup] = []
        fn = self.fn_uni
        safe_limit = max(1, min(int(limit or 200), 50000))
        sql = f"""
            SELECT TOP ({safe_limit})
                Ma_Vt, {fn}(Ten_Vt) AS Ten_Vt, {fn}(Dvt) AS Dvt, {fn}(Dvt_Ban) AS Dvt_Ban, Loai_Vt,
                Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck,
                ISNULL(He_So0, 1) AS He_So0,
                ISNULL(He_So1, 1) AS He_So1,
                ISNULL(He_So2, 1) AS He_So2,
                {fn}(Dvt0) AS Dvt0, {fn}(Dvt1) AS Dvt1, {fn}(Dvt2) AS Dvt2,
                ISNULL(Tk_HBTL, '') AS Tk_HBTL
            FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
        """
        params = []
        if query:
            q_like = f"%{query}%"
            sql += f" WHERE Ma_Vt LIKE ? OR {fn}(Ten_Vt) LIKE ?"
            params.extend([q_like, q_like])
        sql += " ORDER BY Ma_Vt"

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
                    dvt2=(r[14] or "").strip(),
                    tk_hbtl=(r[15] or "").strip(),
                ))
        return results

    def _load_all_khach_hang(self) -> List[dict]:
        """Tải toàn bộ DmDt (5.199 dòng) một lần và cache RAM 60s để tra tức thì <2ms."""
        fn = self.fn_uni
        sql = f"""
            SELECT
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
            ORDER BY d.Ma_Dt
        """
        out: List[dict] = []
        with get_db_cursor(self.sys_db) as cur:
            cur.execute(sql)
            for r in cur.fetchall():
                ma_dt = (r[0] or "").strip()
                ten_dt = (r[1] or "").strip()
                dia_chi = (r[2] or "").strip()
                doi_tac = (r[3] or "").strip()
                # Per All_fix.md #24 (Record 11 & 50):
                # IF EMPTY(Doi_Tac) -> Ong_Ba = Ten_Dt ELSE Ong_Ba = Doi_Tac
                ong_ba = doi_tac if doi_tac else ten_dt
                item = KhachHangLookup(
                    ma_dt=ma_dt,
                    ten_dt=ten_dt,
                    dia_chi=dia_chi,
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
                )
                out.append({
                    "item": item,
                    "dict": item.model_dump(),
                    "hay": _strip_accents_lower(f"{ma_dt} {ten_dt} {dia_chi}"),
                })
        return out

    def get_khach_hang_dicts(self, query: Optional[str] = None, limit: int = 200) -> List[dict]:
        """Fast-path trả sẵn list dict từ TTL cache (bỏ bước re-serialize model_dump)."""
        entries: List[dict] = self._cache.get_or_set(
            "khach_hang", self._load_all_khach_hang, ttl=_CUSTOMER_TTL, cache_empty=False
        )
        safe_limit = max(1, min(int(limit or 200), 50000))
        if not query or not query.strip():
            return [e["dict"] for e in entries[:safe_limit]]
        words = [w for w in _strip_accents_lower(query).split() if w]
        out: List[dict] = []
        for e in entries:
            hay = e["hay"]
            if all(w in hay for w in words):
                out.append(e["dict"])
                if len(out) >= safe_limit:
                    break
        return out

    def get_khach_hang(self, query: Optional[str] = None, limit: int = 200) -> List[KhachHangLookup]:
        entries: List[dict] = self._cache.get_or_set(
            "khach_hang", self._load_all_khach_hang, ttl=_CUSTOMER_TTL, cache_empty=False
        )
        safe_limit = max(1, min(int(limit or 200), 50000))
        if not query or not query.strip():
            return [e["item"] for e in entries[:safe_limit]]
        words = [w for w in _strip_accents_lower(query).split() if w]
        out: List[KhachHangLookup] = []
        for e in entries:
            hay = e["hay"]
            if all(w in hay for w in words):
                out.append(e["item"])
                if len(out) >= safe_limit:
                    break
        return out

    def get_kho(self) -> List[KhoLookup]:
        def _load() -> List[KhoLookup]:
            sql = f"SELECT Ma_Kho, {self.fn_uni}(Ten_Kho) AS Ten_Kho FROM {self.sys_db}.dbo.DmKho WITH (NOLOCK) ORDER BY Ma_Kho"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    KhoLookup(ma_kho=(r[0] or "").strip(), ten_kho=(r[1] or "").strip())
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("kho", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_thue(self) -> List[ThueLookup]:
        def _load() -> List[ThueLookup]:
            sql = f"""
                SELECT Ma_Thue, {self.fn_uni}(Ten_Thue) AS Ten_Thue, ISNULL(Thue_GTGT, 0) AS Thue_GTGT, Tk
                FROM {self.sys_db}.dbo.DmThue WITH (NOLOCK)
                ORDER BY Ma_Thue
            """
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    ThueLookup(
                        ma_thue=(r[0] or "").strip(),
                        ten_thue=(r[1] or "").strip(),
                        thue_gtgt=float(r[2] or 0.0),
                        tk=(r[3] or "33311").strip()
                    )
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("thue", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_tai_khoan(self, query: Optional[str] = None) -> List[TaiKhoanLookup]:
        def _load() -> List[TaiKhoanLookup]:
            sql = f"SELECT Tk, {self.fn_uni}(Ten_Tk) AS Ten_Tk, Tk_Dt FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK) ORDER BY Tk"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    TaiKhoanLookup(
                        tk=(r[0] or "").strip(),
                        ten_tk=(r[1] or "").strip(),
                        tk_dt=(r[2] or "").strip()
                    )
                    for r in cur.fetchall()
                ]
        all_items: List[TaiKhoanLookup] = self._cache.get_or_set(
            "tai_khoan", _load, ttl=_STATIC_TTL, cache_empty=False
        )
        if not query or not query.strip():
            return all_items
        needle = _strip_accents_lower(query)
        return [
            it for it in all_items
            if needle in _strip_accents_lower(f"{it.tk} {it.ten_tk}")
        ]

    def get_nhap_xuat(self) -> List[NhapXuatLookup]:
        def _load() -> List[NhapXuatLookup]:
            sql = f"SELECT Ma_Nx, {self.fn_uni}(Ten_Nx) AS Ten_Nx, Dinh_Khoan FROM {self.sys_db}.dbo.DmNx WITH (NOLOCK) ORDER BY Ma_Nx"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    NhapXuatLookup(
                        ma_nx=(r[0] or "").strip(),
                        ten_nx=(r[1] or "").strip(),
                        dinh_khoan=(r[2] or "C").strip()
                    )
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("nhap_xuat", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_xe(self, query: Optional[str] = None, limit: int = 200) -> List[XeLookup]:
        def _load() -> List[XeLookup]:
            sql = f"SELECT Ma_Xe, {self.fn_uni}(Ten_Xe) AS Ten_Xe FROM {self.sys_db}.dbo.DmXe WITH (NOLOCK) ORDER BY Ma_Xe"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    XeLookup(ma_xe=(r[0] or "").strip(), ten_xe=(r[1] or "").strip())
                    for r in cur.fetchall()
                ]
        all_items: List[XeLookup] = self._cache.get_or_set("xe", _load, ttl=_STATIC_TTL, cache_empty=False)
        if not query or not query.strip():
            return all_items[:limit]
        needle = _strip_accents_lower(query)
        return [
            it for it in all_items
            if needle in _strip_accents_lower(f"{it.ma_xe} {it.ten_xe}")
        ][:limit]

    def get_bo_phan(self) -> List[BoPhanLookup]:
        def _load() -> List[BoPhanLookup]:
            sql = f"SELECT Ma_Bp, {self.fn_uni}(Ten_Bp) AS Ten_Bp FROM {self.sys_db}.dbo.DmBp WITH (NOLOCK) ORDER BY Ma_Bp"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    BoPhanLookup(ma_bp=(r[0] or "").strip(), ten_bp=(r[1] or "").strip())
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("bo_phan", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_hop_dong(self, query: Optional[str] = None) -> List[HopDongLookup]:
        def _load() -> List[HopDongLookup]:
            sql = f"SELECT Ma_HD, {self.fn_uni}(Ten_HD) AS Ten_HD FROM {self.sys_db}.dbo.DmHD WITH (NOLOCK) ORDER BY Ma_HD"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    HopDongLookup(ma_hd=(r[0] or "").strip(), ten_hd=(r[1] or "").strip())
                    for r in cur.fetchall()
                ]
        all_items: List[HopDongLookup] = self._cache.get_or_set(
            "hop_dong", _load, ttl=_STATIC_TTL, cache_empty=False
        )
        if not query or not query.strip():
            return all_items
        needle = _strip_accents_lower(query)
        return [
            it for it in all_items
            if needle in _strip_accents_lower(f"{it.ma_hd} {it.ten_hd}")
        ]

    def get_tien_te(self) -> List[TienTeLookup]:
        def _load() -> List[TienTeLookup]:
            sql = f"""
                SELECT Ma_Tte, {self.fn_uni}(Ten_Tte) AS Ten_Tte, ISNULL(Ty_Gia, 1.0) AS Ty_Gia
                FROM {self.sys_db}.dbo.DmTte WITH (NOLOCK)
                ORDER BY Ma_Tte
            """
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    TienTeLookup(
                        ma_tte=(r[0] or "").strip(),
                        ten_tte=(r[1] or "").strip(),
                        ty_gia=float(r[2] or 1.0)
                    )
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("tien_te", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_khoan_muc(self) -> List[KhoanMucLookup]:
        def _load() -> List[KhoanMucLookup]:
            sql = f"SELECT Ma_Km, {self.fn_uni}(Ten_Km) AS Ten_Km FROM {self.sys_db}.dbo.DmKm WITH (NOLOCK) ORDER BY Ma_Km"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    KhoanMucLookup(ma_km=(r[0] or "").strip(), ten_km=(r[1] or "").strip())
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("khoan_muc", _load, ttl=_STATIC_TTL, cache_empty=False)

    def get_san_pham(self) -> List[SanPhamLookup]:
        def _load() -> List[SanPhamLookup]:
            sql = f"SELECT Ma_Sp, {self.fn_uni}(Ten_Sp) AS Ten_Sp, {self.fn_uni}(Dvt) AS Dvt, Loai_Sp FROM {self.sys_db}.dbo.DmSp WITH (NOLOCK) ORDER BY Ma_Sp"
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql)
                return [
                    SanPhamLookup(
                        ma_sp=(r[0] or "").strip(),
                        ten_sp=(r[1] or "").strip(),
                        dvt=(r[2] or "").strip(),
                        loai_sp=(r[3] or "").strip(),
                    )
                    for r in cur.fetchall()
                ]
        return self._cache.get_or_set("san_pham", _load, ttl=_STATIC_TTL, cache_empty=False)


lookup_repository = LookupRepository()
