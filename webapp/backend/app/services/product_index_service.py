import gzip
import json
import logging
import os
import pickle
import threading
import time
import unicodedata
from typing import Dict, List, Optional, Tuple

try:
    import orjson

    def _dumps_bytes(obj: object) -> bytes:
        return orjson.dumps(obj)

    def _loads_bytes(raw: bytes) -> object:
        return orjson.loads(raw)
except ImportError:  # pragma: no cover
    def _dumps_bytes(obj: object) -> bytes:
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    def _loads_bytes(raw: bytes) -> object:
        return json.loads(raw.decode("utf-8"))

from app.config import settings
from app.database import get_db_cursor

logger = logging.getLogger("app.services.product_index")

# Khoảng thời gian quét nền (giây) để phát hiện thay đổi danh mục vật tư.
REFRESH_INTERVAL = int(getattr(settings, "PRODUCT_INDEX_REFRESH_INTERVAL", 60))

# File cache trên đĩa để khởi động lại server tức thì và giữ nguyên epoch cho trình duyệt.
_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".cache",
)
_CACHE_FILE = os.path.join(_CACHE_DIR, "product_index.json.gz")
_LEGACY_PKL_FILE = os.path.join(_CACHE_DIR, "product_index.pkl")


def chuan(s: Optional[str]) -> str:
    """Chuẩn hóa chuỗi về NFC + chữ thường (không bỏ dấu)."""
    return unicodedata.normalize("NFC", s or "").lower()


class ProductIndexService:
    """
    Giữ bản chụp danh mục vật tư (`VTSYS.dbo.DmVt`) trong RAM và tự phát hiện
    thay đổi bằng cổng `CHECKSUM_AGG` (0 UDF khi không đổi).

    Tối ưu:
    - Tiền biên dịch `_items`, `_by_code` (O(1)), `_full_json_bytes`, `_full_gzip_bytes`
      ngoài lock mỗi khi `version` thay đổi → `/api/products/changes?since=0` trả <1ms,
      không làm treo asyncio event loop.
    - Nạp cache đĩa dạng JSON nén gzip trong `lifespan` thay vì lúc import module.
    - 100% READ-ONLY (chỉ SELECT).
    """

    def __init__(self):
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        self.qldh_db = settings.DB_QLDH
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self.snapshot: Dict[int, dict] = {}
        self.changes: List[dict] = []
        self.version = 0
        self.epoch = int(time.time())
        self._loaded = False
        self._disk_checked = False
        self._last_fingerprint: Optional[Tuple] = None

        # Precomputed immutable structures swapped atomically under self._lock
        self._items: List[dict] = []
        self._by_code: Dict[str, dict] = {}
        self._full_json_bytes: Optional[bytes] = None
        self._full_gzip_bytes: Optional[bytes] = None

    # ------------------------------------------------------------------ cache IO
    def _rebuild_precomputed(
        self,
        snapshot: Dict[int, dict],
        version: int,
        epoch: int,
    ) -> Tuple[List[dict], Dict[str, dict], bytes, bytes]:
        items: List[dict] = []
        by_code: Dict[str, dict] = {}
        for vtid, val in snapshot.items():
            it = self._to_item(vtid, val)
            items.append(it)
            if it["ma"]:
                by_code[it["ma"]] = it
        payload = {
            "success": True,
            "data": {
                "full": True,
                "items": items,
                "max_v": version,
                "epoch": epoch,
            },
        }
        raw_json = _dumps_bytes(payload)
        gz_bytes = gzip.compress(raw_json, compresslevel=5)
        return items, by_code, raw_json, gz_bytes

    def load_disk_cache(self) -> None:
        """Nạp nhanh bản chụp từ đĩa (chạy trong lifespan executor, không chặn import)."""
        with self._refresh_lock:
            if self._disk_checked or self._loaded:
                return
            self._disk_checked = True
            data = None
            if os.path.exists(_CACHE_FILE):
                try:
                    with gzip.open(_CACHE_FILE, "rb") as f:
                        data = _loads_bytes(f.read())
                except Exception as e:
                    logger.warning(f"Could not load JSON.gz product index cache: {e}")
            elif os.path.exists(_LEGACY_PKL_FILE):
                try:
                    with open(_LEGACY_PKL_FILE, "rb") as f:
                        data = pickle.load(f)
                except Exception as e:
                    logger.warning(f"Could not load legacy pkl product index cache: {e}")

            if not isinstance(data, dict) or not isinstance(data.get("snapshot"), dict) or not data["snapshot"]:
                return

            raw_snapshot = data["snapshot"]
            snapshot: Dict[int, dict] = {int(k): v for k, v in raw_snapshot.items()}
            sample = next(iter(snapshot.values()))
            if not isinstance(sample, dict) or "ma_kho" not in sample:
                logger.info("Product index disk cache missing 'ma_kho'; rebuilding from SQL.")
                return

            version = max(1, int(data.get("version", 1)))
            epoch = int(data.get("epoch", self.epoch))
            changes = data.get("changes", [])
            if not isinstance(changes, list):
                changes = []
            # Trim bloated legacy history on load
            if len(changes) > 5000:
                changes = changes[-2000:]

            items, by_code, raw_json, gz_bytes = self._rebuild_precomputed(snapshot, version, epoch)
            with self._lock:
                self.snapshot = snapshot
                self.changes = changes
                self.version = version
                self.epoch = epoch
                self._items = items
                self._by_code = by_code
                self._full_json_bytes = raw_json
                self._full_gzip_bytes = gz_bytes
                self._loaded = True
            logger.info(
                f"Loaded {len(snapshot)} products from disk cache (epoch={epoch}, v={version}, gz={len(gz_bytes)}B)"
            )

    def _save_disk_cache(self) -> None:
        """Lưu bản chụp dạng gzipped JSON xuống đĩa."""
        try:
            os.makedirs(_CACHE_DIR, exist_ok=True)
            with self._lock:
                payload = {
                    "snapshot": {str(k): v for k, v in self.snapshot.items()},
                    "changes": self.changes[-2000:],
                    "version": self.version,
                    "epoch": self.epoch,
                }
            tmp_file = f"{_CACHE_FILE}.tmp"
            raw = _dumps_bytes(payload)
            with gzip.open(tmp_file, "wb", compresslevel=5) as f:
                f.write(raw)
            os.replace(tmp_file, _CACHE_FILE)
        except Exception as e:
            logger.warning(f"Could not save product index disk cache: {e}")

    # ------------------------------------------------------------------ loading
    def _compute_fingerprint(self) -> Optional[Tuple]:
        """
        Kiểm tra nhanh bằng CHECKSUM_AGG (0 lệnh UDF) xem DmVt hoặc QLDH.Products có thay đổi không.
        Trả về None nếu query checksum lỗi (khi đó fallback về full _read_all).
        """
        dmvt_fp = None
        qldh_fp = None
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(1),
                        ISNULL(MAX(VTID), 0),
                        ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(
                            VTID, Ma_Vt, Ten_Vt, Dvt, Dvt_Ban, Loai_Vt,
                            Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck, He_So0
                        )), 0)
                    FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
                    """
                )
                r = cur.fetchone()
                if r:
                    dmvt_fp = (int(r[0] or 0), int(r[1] or 0), int(r[2] or 0))
        except Exception as e:
            logger.debug(f"DmVt fingerprint check skipped: {e}")
            return None

        try:
            with get_db_cursor(self.qldh_db) as cur:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(1),
                        ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(Code, WarehouseCode)), 0)
                    FROM {self.qldh_db}.dbo.Products WITH (NOLOCK)
                    WHERE ISNULL(IsDeleted, 0) = 0
                      AND WarehouseCode IS NOT NULL
                      AND LTRIM(RTRIM(WarehouseCode)) <> ''
                    """
                )
                r = cur.fetchone()
                if r:
                    qldh_fp = (int(r[0] or 0), int(r[1] or 0))
        except Exception as e:
            logger.debug(f"QLDH fingerprint check skipped: {e}")
            qldh_fp = (0, 0)

        return (dmvt_fp, qldh_fp)

    def _read_warehouse_map(self) -> Dict[str, str]:
        """Đọc ánh xạ Code -> WarehouseCode từ QLDH.dbo.Products (100% READ-ONLY)."""
        out: Dict[str, str] = {}
        sql = f"""
            SELECT RTRIM(Code), RTRIM(WarehouseCode)
            FROM {self.qldh_db}.dbo.Products WITH (NOLOCK)
            WHERE ISNULL(IsDeleted, 0) = 0
              AND WarehouseCode IS NOT NULL
              AND LTRIM(RTRIM(WarehouseCode)) <> ''
        """
        try:
            with get_db_cursor(self.qldh_db) as cur:
                cur.execute(sql)
                for r in cur.fetchall():
                    code = (r[0] or "").strip().upper()
                    wh = (r[1] or "").strip().upper()
                    if code and wh:
                        out[code] = wh
        except Exception as e:
            logger.warning(f"Could not read {self.qldh_db}.dbo.Products warehouse map: {e}")
        return out

    def _read_all(self) -> Dict[int, dict]:
        wh_map = self._read_warehouse_map()
        fn = self.fn_uni
        sql = f"""
            SELECT VTID, RTRIM(Ma_Vt) AS Ma_Vt, {fn}(Ten_Vt) AS Ten_Vt,
                   {fn}(Dvt) AS Dvt, {fn}(Dvt_Ban) AS Dvt_Ban, Loai_Vt,
                   Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck,
                   ISNULL(He_So0, 1) AS He_So0
            FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
        """
        out: Dict[int, dict] = {}
        with get_db_cursor(self.sys_db) as cur:
            cur.execute(sql)
            for r in cur.fetchall():
                ma = (r[1] or "").strip()
                out[int(r[0])] = {
                    "ma": ma,
                    "ten": (r[2] or "").strip(),
                    "dvt": (r[3] or "").strip(),
                    "dvt_ban": (r[4] or "").strip(),
                    "loai_vt": (r[5] or "1").strip(),
                    "tk_gv": (r[6] or "632").strip(),
                    "tk_vt": (r[7] or "1561").strip(),
                    "tk_dt": (r[8] or "5111").strip(),
                    "tk_ck": (r[9] or "").strip(),
                    "he_so0": float(r[10] or 1.0),
                    "ma_kho": wh_map.get(ma.upper(), ""),
                }
        return out

    @staticmethod
    def _to_item(vtid: int, val: dict) -> dict:
        """Dựng payload index cho client (mã IN HOA + khóa tìm kiếm + trường danh mục)."""
        return {
            "id": vtid,
            "ma": chuan(val["ma"]).upper(),
            "ten": val["ten"],
            "dvt": val["dvt"],
            "dvt_ban": val["dvt_ban"],
            "loai_vt": val["loai_vt"],
            "tk_gv": val["tk_gv"],
            "tk_vt": val["tk_vt"],
            "tk_dt": val["tk_dt"],
            "tk_ck": val["tk_ck"],
            "he_so0": val["he_so0"],
            "ma_kho": val.get("ma_kho", ""),
            "k": chuan(f"{val['ma']} {val['ten']}"),
        }

    def refresh(self, force: bool = False) -> None:
        """Kiểm tra fingerprint; chỉ đọc lại toàn bộ danh mục khi thực sự có thay đổi."""
        with self._refresh_lock:
            if not force and self._loaded:
                fp = self._compute_fingerprint()
                if fp is not None and fp == self._last_fingerprint:
                    return
            else:
                fp = self._compute_fingerprint()

            try:
                new = self._read_all()
            except Exception as e:
                logger.warning(f"Could not refresh product index: {e}")
                return

            with self._lock:
                was_loaded = self._loaded and bool(self.snapshot)
                old_snapshot = self.snapshot
                version = self.version
                epoch = self.epoch
                changes = list(self.changes)

            changed = False
            if not was_loaded:
                # Cold start: never dump 37k rows into `changes` history.
                version = max(1, version)
                changes = []
                changed = True
            else:
                for vtid, val in new.items():
                    if old_snapshot.get(vtid) != val:
                        version += 1
                        changed = True
                        changes.append({
                            "v": version,
                            **self._to_item(vtid, val),
                            "del": False,
                        })
                for vtid in old_snapshot.keys() - new.keys():
                    version += 1
                    changed = True
                    changes.append({"v": version, "id": vtid, "del": True})
                if len(changes) > 5000:
                    changes = changes[-2000:]

            if changed or not self._loaded or self._full_json_bytes is None:
                items, by_code, raw_json, gz_bytes = self._rebuild_precomputed(new, version, epoch)
                with self._lock:
                    self.snapshot = new
                    self.changes = changes
                    self.version = version
                    self._items = items
                    self._by_code = by_code
                    self._full_json_bytes = raw_json
                    self._full_gzip_bytes = gz_bytes
                    self._loaded = True
            else:
                with self._lock:
                    self._loaded = True

            if fp is not None:
                self._last_fingerprint = fp

            if changed or not os.path.exists(_CACHE_FILE):
                self._save_disk_cache()

    def ensure_loaded(self) -> None:
        if not self._loaded:
            if not self._disk_checked:
                self.load_disk_cache()
            if not self._loaded:
                self.refresh(force=True)

    # ------------------------------------------------------------------- query
    def get_etag(self) -> str:
        with self._lock:
            return f'W/"{self.epoch}-{self.version}"'

    def get_changes_response_bytes(
        self,
        since: int = 0,
        epoch_c: int = 0,
        accept_gzip: bool = False,
    ) -> Tuple[bytes, bool, str]:
        """
        Fast-path trả thẳng bytes JSON (hoặc gzip đã nén sẵn) + ETag cho `/api/products/changes`.
        Tránh hoàn toàn jsonable_encoder và GZipMiddleware đồng bộ trên event loop.
        Returns: (body_bytes, is_gzipped, etag)
        """
        self.ensure_loaded()
        with self._lock:
            oldest = self.changes[0]["v"] if self.changes else self.version
            need_full = (
                epoch_c != self.epoch
                or since == 0
                or (self.changes and since < oldest - 1)
            )
            etag = f'W/"{self.epoch}-{self.version}"'
            if need_full:
                if accept_gzip and self._full_gzip_bytes is not None:
                    return self._full_gzip_bytes, True, etag
                if self._full_json_bytes is not None:
                    return self._full_json_bytes, False, etag
            delta = {
                "success": True,
                "data": {
                    "full": False,
                    "items": [c for c in self.changes if c["v"] > since],
                    "max_v": self.version,
                    "epoch": self.epoch,
                },
            }
        return _dumps_bytes(delta), False, etag

    def get_changes(self, since: int = 0, epoch_c: int = 0) -> dict:
        """
        Trả về thay đổi kể từ `since`.
        - `full=True` khi client cần tải lại toàn bộ (epoch khác, since=0, hoặc
          since quá cũ so với lịch sử còn giữ).
        """
        self.ensure_loaded()
        with self._lock:
            oldest = self.changes[0]["v"] if self.changes else self.version
            need_full = (
                epoch_c != self.epoch
                or since == 0
                or (self.changes and since < oldest - 1)
            )
            if need_full:
                return {
                    "full": True,
                    "items": self._items,
                    "max_v": self.version,
                    "epoch": self.epoch,
                }
            return {
                "full": False,
                "items": [c for c in self.changes if c["v"] > since],
                "max_v": self.version,
                "epoch": self.epoch,
            }

    def search(self, q: str, limit: int = 30) -> List[dict]:
        """Tìm phía server dùng danh sách `_items` đã chuẩn hóa sẵn (không cần giữ lock lâu)."""
        self.ensure_loaded()
        needle = chuan(q).strip()
        if not needle:
            return []
        words = [w for w in needle.split() if w]
        with self._lock:
            items_ref = self._items
        out: List[dict] = []
        for it in items_ref:
            hay = it["k"]
            if all(w in hay for w in words):
                out.append(it)
                if len(out) >= limit:
                    break
        return out

    def get_by_code(self, ma_vt: str) -> Optional[dict]:
        """Tra chính xác theo mã: ưu tiên O(1) RAM index, chỉ query SQL khi cache miss."""
        code = (ma_vt or "").strip().upper()
        if not code:
            return None
        if self._loaded:
            with self._lock:
                cached = self._by_code.get(code)
            if cached is not None:
                return cached

        fn = self.fn_uni
        sql = f"""
            SELECT TOP 1 VTID, RTRIM(Ma_Vt) AS Ma_Vt, {fn}(Ten_Vt) AS Ten_Vt,
                   {fn}(Dvt) AS Dvt, {fn}(Dvt_Ban) AS Dvt_Ban, Loai_Vt,
                   Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck,
                   ISNULL(He_So0, 1) AS He_So0
            FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
            WHERE Ma_Vt = ?
        """
        r = None
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [code])
                r = cur.fetchone()
        except Exception as e:
            logger.warning(f"Could not read DmVt by code {ma_vt}: {e}")
            return None

        if not r:
            return None

        ma = (r[1] or "").strip()
        ma_kho = ""
        # Separate sequential cursor (never nested inside VTSYS cursor)
        try:
            with get_db_cursor(self.qldh_db) as qcur:
                qcur.execute(
                    f"""
                    SELECT TOP 1 RTRIM(WarehouseCode)
                    FROM {self.qldh_db}.dbo.Products WITH (NOLOCK)
                    WHERE Code = ? AND ISNULL(IsDeleted, 0) = 0
                    """,
                    [ma],
                )
                qr = qcur.fetchone()
                if qr and qr[0]:
                    ma_kho = qr[0].strip().upper()
        except Exception as qe:
            logger.warning(f"Could not read {self.qldh_db} warehouse for {ma}: {qe}")

        val = {
            "ma": ma,
            "ten": (r[2] or "").strip(),
            "dvt": (r[3] or "").strip(),
            "dvt_ban": (r[4] or "").strip(),
            "loai_vt": (r[5] or "1").strip(),
            "tk_gv": (r[6] or "632").strip(),
            "tk_vt": (r[7] or "1561").strip(),
            "tk_dt": (r[8] or "5111").strip(),
            "tk_ck": (r[9] or "").strip(),
            "he_so0": float(r[10] or 1.0),
            "ma_kho": ma_kho,
        }
        return self._to_item(int(r[0]), val)


product_index_service = ProductIndexService()
