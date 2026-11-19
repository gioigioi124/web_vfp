import gzip
import json
import logging
import os
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

logger = logging.getLogger("app.services.customer_index")

# Khoảng thời gian quét nền (giây) để phát hiện thay đổi danh mục khách hàng.
REFRESH_INTERVAL = int(getattr(settings, "CUSTOMER_INDEX_REFRESH_INTERVAL", 60))

# File cache trên đĩa để khởi động lại server tức thì và giữ nguyên epoch cho trình duyệt.
_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".cache",
)
_CACHE_FILE = os.path.join(_CACHE_DIR, "customer_index.json.gz")


def _strip_accents_lower(text: Optional[str]) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    cleaned = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return cleaned.replace("đ", "d").replace("Đ", "d").lower().strip()


class CustomerIndexService:
    """
    Giữ bản chụp danh mục khách hàng (`VTSYS.dbo.DmDt`) trong RAM và tự phát hiện
    thay đổi bằng cổng `CHECKSUM_AGG` (0 UDF khi không đổi).

    Tối ưu tương đương ProductIndexService:
    - Tiền biên dịch `_items`, `_by_code` (O(1)), `_full_json_bytes`, `_full_gzip_bytes`
      ngoài lock mỗi khi `version` thay đổi → `/api/customers/changes?since=0` trả <1ms.
    - Hỗ trợ delta sync (`since`, `epoch_c`) và ETag / 304 Not Modified.
    - Nạp cache đĩa dạng JSON nén gzip trong `lifespan` thay vì lúc import module.
    - 100% READ-ONLY (chỉ SELECT).
    """

    def __init__(self):
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self.snapshot: Dict[str, dict] = {}
        self.changes: List[dict] = []
        self.version = 0
        self.epoch = int(time.time())
        self._loaded = False
        self._disk_checked = False
        self._last_fingerprint: Optional[Tuple] = None

        # Precomputed immutable structures swapped atomically under self._lock
        self._items: List[dict] = []
        self._by_code: Dict[str, dict] = {}
        self._hay_list: List[str] = []
        self._full_json_bytes: Optional[bytes] = None
        self._full_gzip_bytes: Optional[bytes] = None

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _to_item(code: str, val: dict) -> dict:
        return {
            "ma_dt": val.get("ma_dt") or code,
            "ten_dt": val.get("ten_dt", ""),
            "dia_chi": val.get("dia_chi", ""),
            "ong_ba": val.get("ong_ba", ""),
            "ms_thue": val.get("ms_thue", ""),
            "han_tt": int(val.get("han_tt", 0) or 0),
            "gioi_han": float(val.get("gioi_han", 0.0) or 0.0),
            "toi_han": float(val.get("toi_han", 0.0) or 0.0),
            "doi_tac": val.get("doi_tac", ""),
            "ma_bp": val.get("ma_bp", ""),
            "ten_bp": val.get("ten_bp", ""),
            "ma_xe": val.get("ma_xe", ""),
            "ma_vm": val.get("ma_vm", ""),
        }

    def _rebuild_precomputed(
        self,
        snapshot: Dict[str, dict],
        version: int,
        epoch: int,
    ) -> Tuple[List[dict], Dict[str, dict], List[str], bytes, bytes]:
        sorted_codes = sorted(snapshot.keys())
        items: List[dict] = []
        by_code: Dict[str, dict] = {}
        hay_list: List[str] = []
        for code in sorted_codes:
            it = self._to_item(code, snapshot[code])
            items.append(it)
            by_code[code] = it
            hay_list.append(
                _strip_accents_lower(
                    f"{it['ma_dt']} {it['ten_dt']} {it['dia_chi']}"
                )
            )

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
        return items, by_code, hay_list, raw_json, gz_bytes

    # ------------------------------------------------------------------ cache IO
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
                    logger.warning(f"Could not load JSON.gz customer index cache: {e}")

            if (
                not isinstance(data, dict)
                or not isinstance(data.get("snapshot"), dict)
                or not data["snapshot"]
            ):
                return

            snapshot: Dict[str, dict] = {
                str(k).strip().upper(): v
                for k, v in data["snapshot"].items()
                if str(k).strip() and isinstance(v, dict)
            }
            if not snapshot:
                return

            version = max(1, int(data.get("version", 1)))
            epoch = int(data.get("epoch", self.epoch))
            changes = data.get("changes", [])
            if not isinstance(changes, list):
                changes = []
            if len(changes) > 5000:
                changes = changes[-2000:]

            items, by_code, hay_list, raw_json, gz_bytes = self._rebuild_precomputed(
                snapshot, version, epoch
            )
            with self._lock:
                self.snapshot = snapshot
                self.changes = changes
                self.version = version
                self.epoch = epoch
                self._items = items
                self._by_code = by_code
                self._hay_list = hay_list
                self._full_json_bytes = raw_json
                self._full_gzip_bytes = gz_bytes
                self._loaded = True
            logger.info(
                f"Loaded {len(snapshot)} customers from disk cache "
                f"(epoch={epoch}, v={version}, gz={len(gz_bytes)}B)"
            )

    def _save_disk_cache(self) -> None:
        """Lưu bản chụp dạng gzipped JSON xuống đĩa."""
        try:
            os.makedirs(_CACHE_DIR, exist_ok=True)
            with self._lock:
                payload = {
                    "snapshot": self.snapshot,
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
            logger.warning(f"Could not save customer index disk cache: {e}")

    # ------------------------------------------------------------------ loading
    def _compute_fingerprint(self) -> Optional[Tuple]:
        """
        Kiểm tra nhanh bằng CHECKSUM_AGG (0 lệnh UDF) xem DmDt / DmNhDt / DmBp có thay đổi không.
        Bao gồm cả Han_Tt, Gioi_Han, Toi_Han, Ma_Nh_Dt, Ma_Vm để thay đổi hạn mức được sync ngay.
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(1),
                        ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(
                            Ma_Dt, Ten_Dt, Dia_Chi, Doi_Tac, Ms_Thue,
                            Han_Tt, Gioi_Han, Toi_Han, Ma_Nh_Dt, Ma_Vm
                        )), 0)
                    FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK)
                    """
                )
                r1 = cur.fetchone()
                dmdt_fp = (int(r1[0] or 0), int(r1[1] or 0)) if r1 else (0, 0)

                cur.execute(
                    f"""
                    SELECT
                        COUNT(1),
                        ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(Ma_Nh_Dt, Ma_Bp)), 0)
                    FROM {self.sys_db}.dbo.DmNhDt WITH (NOLOCK)
                    """
                )
                r2 = cur.fetchone()
                nhdt_fp = (int(r2[0] or 0), int(r2[1] or 0)) if r2 else (0, 0)

                cur.execute(
                    f"""
                    SELECT
                        COUNT(1),
                        ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(Ma_Bp, Ten_Bp)), 0)
                    FROM {self.sys_db}.dbo.DmBp WITH (NOLOCK)
                    """
                )
                r3 = cur.fetchone()
                bp_fp = (int(r3[0] or 0), int(r3[1] or 0)) if r3 else (0, 0)
            return (dmdt_fp, nhdt_fp, bp_fp)
        except Exception as e:
            logger.debug(f"DmDt fingerprint check skipped: {e}")
            return None

    def _read_all(self) -> Dict[str, dict]:
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
        out: Dict[str, dict] = {}
        with get_db_cursor(self.sys_db) as cur:
            cur.execute(sql)
            for r in cur.fetchall():
                ma_dt = (r[0] or "").strip()
                key = ma_dt.upper()
                if not key:
                    continue
                ten_dt = (r[1] or "").strip()
                dia_chi = (r[2] or "").strip()
                doi_tac = (r[3] or "").strip()
                ong_ba = doi_tac if doi_tac else ten_dt
                out[key] = {
                    "ma_dt": ma_dt,
                    "ten_dt": ten_dt,
                    "dia_chi": dia_chi,
                    "ong_ba": ong_ba,
                    "ms_thue": (r[4] or "").strip(),
                    "han_tt": int(r[5] or 0),
                    "gioi_han": float(r[6] or 0.0),
                    "toi_han": float(r[7] or 0.0),
                    "doi_tac": doi_tac,
                    "ma_bp": (r[8] or "").strip(),
                    "ten_bp": (r[9] or "").strip(),
                    "ma_xe": "",
                    "ma_vm": (r[10] or "").strip(),
                }
        return out

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
                logger.warning(f"Could not refresh customer index: {e}")
                return

            with self._lock:
                was_loaded = self._loaded and bool(self.snapshot)
                old_snapshot = self.snapshot
                version = self.version
                epoch = self.epoch
                changes = list(self.changes)

            changed = False
            if not was_loaded:
                version = max(1, version)
                changes = []
                changed = True
            else:
                for code, val in new.items():
                    if old_snapshot.get(code) != val:
                        version += 1
                        changed = True
                        changes.append({
                            "v": version,
                            **self._to_item(code, val),
                            "del": False,
                        })
                for code in old_snapshot.keys() - new.keys():
                    version += 1
                    changed = True
                    changes.append({"v": version, "ma_dt": code, "del": True})
                if len(changes) > 5000:
                    changes = changes[-2000:]

            if changed or not self._loaded or self._full_json_bytes is None:
                items, by_code, hay_list, raw_json, gz_bytes = self._rebuild_precomputed(
                    new, version, epoch
                )
                with self._lock:
                    self.snapshot = new
                    self.changes = changes
                    self.version = version
                    self._items = items
                    self._by_code = by_code
                    self._hay_list = hay_list
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
        Fast-path trả thẳng bytes JSON (hoặc gzip đã nén sẵn) + ETag cho `/api/customers/changes`.
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

    def search(self, q: Optional[str] = None, limit: int = 50) -> List[dict]:
        """Tìm phía server dùng danh sách `_items` & `_hay_list` trong RAM."""
        self.ensure_loaded()
        safe_limit = max(1, min(int(limit or 50), 50000))
        with self._lock:
            items_ref = self._items
            hay_ref = self._hay_list
        if not q or not q.strip():
            return items_ref[:safe_limit]
        words = [w for w in _strip_accents_lower(q).split() if w]
        if not words:
            return items_ref[:safe_limit]
        out: List[dict] = []
        for it, hay in zip(items_ref, hay_ref):
            if all(w in hay for w in words):
                out.append(it)
                if len(out) >= safe_limit:
                    break
        return out

    def get_by_code(self, ma_dt: str) -> Optional[dict]:
        """Tra chính xác theo mã: ưu tiên O(1) RAM index, chỉ query SQL khi cache miss."""
        code = (ma_dt or "").strip().upper()
        if not code:
            return None
        if self._loaded:
            with self._lock:
                cached = self._by_code.get(code)
            if cached is not None:
                return cached

        fn = self.fn_uni
        sql = f"""
            SELECT TOP 1
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
            WHERE d.Ma_Dt = ?
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [code])
                r = cur.fetchone()
        except Exception as e:
            logger.warning(f"Could not read DmDt by code {ma_dt}: {e}")
            return None

        if not r:
            return None

        ten_dt = (r[1] or "").strip()
        doi_tac = (r[3] or "").strip()
        ong_ba = doi_tac if doi_tac else ten_dt
        val = {
            "ma_dt": (r[0] or "").strip(),
            "ten_dt": ten_dt,
            "dia_chi": (r[2] or "").strip(),
            "ong_ba": ong_ba,
            "ms_thue": (r[4] or "").strip(),
            "han_tt": int(r[5] or 0),
            "gioi_han": float(r[6] or 0.0),
            "toi_han": float(r[7] or 0.0),
            "doi_tac": doi_tac,
            "ma_bp": (r[8] or "").strip(),
            "ten_bp": (r[9] or "").strip(),
            "ma_xe": "",
            "ma_vm": (r[10] or "").strip(),
        }
        return self._to_item(code, val)


customer_index_service = CustomerIndexService()
