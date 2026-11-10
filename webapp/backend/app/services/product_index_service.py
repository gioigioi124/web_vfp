import logging
import os
import pickle
import threading
import time
import unicodedata
from typing import Dict, List, Optional

from app.config import settings
from app.database import get_db_cursor

logger = logging.getLogger("app.services.product_index")

# Khoảng thời gian quét nền (giây) để phát hiện thay đổi danh mục vật tư.
REFRESH_INTERVAL = 45

# File cache trên đĩa để khởi động lại server tức thì và giữ nguyên epoch cho trình duyệt.
_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".cache",
)
_CACHE_FILE = os.path.join(_CACHE_DIR, "product_index.pkl")


def chuan(s: Optional[str]) -> str:
    """Chuẩn hóa chuỗi về NFC + chữ thường (không bỏ dấu)."""
    return unicodedata.normalize("NFC", s or "").lower()


class ProductIndexService:
    """
    Giữ bản chụp danh mục vật tư (`VTSYS.dbo.DmVt`) trong RAM và tự phát hiện
    thay đổi bằng cách so sánh định kỳ (bảng không có cột ngày sửa).

    - `snapshot`: {VTID: {ma, ten, dvt, dvt_ban, loai_vt, tk_gv, tk_vt, tk_dt, tk_ck, he_so0}}
    - `changes`: danh sách thay đổi tăng dần, mỗi phần tử gắn `v` (version).
    - `version`: version hiện tại (do service tự cấp).
    - `epoch`: giữ cố định qua file cache trên đĩa để client tái sử dụng IndexedDB.

    Chạy MỘT tiến trình uvicorn duy nhất để bản chụp không lệch version.
    100% READ-ONLY (chỉ SELECT).
    """

    def __init__(self):
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self.snapshot: Dict[int, dict] = {}
        self.changes: List[dict] = []
        self.version = 0
        self.epoch = int(time.time())
        self._loaded = False
        self._load_disk_cache()

    def _load_disk_cache(self) -> None:
        """Nạp nhanh bản chụp từ đĩa (nếu có) để không phải chờ SQL lúc mới bật server."""
        if not os.path.exists(_CACHE_FILE):
            return
        try:
            with open(_CACHE_FILE, "rb") as f:
                data = pickle.load(f)
            if isinstance(data, dict) and isinstance(data.get("snapshot"), dict) and data["snapshot"]:
                self.snapshot = data["snapshot"]
                self.changes = data.get("changes", [])
                self.version = int(data.get("version", 0))
                self.epoch = int(data.get("epoch", self.epoch))
                self._loaded = True
                logger.info(
                    f"Loaded {len(self.snapshot)} products from disk cache (epoch={self.epoch}, v={self.version})"
                )
        except Exception as e:
            logger.warning(f"Could not load product index disk cache: {e}")

    def _save_disk_cache(self) -> None:
        """Lưu bản chụp xuống đĩa để lần bật server tiếp theo dùng lại ngay."""
        try:
            os.makedirs(_CACHE_DIR, exist_ok=True)
            tmp_file = f"{_CACHE_FILE}.tmp"
            with open(tmp_file, "wb") as f:
                pickle.dump(
                    {
                        "snapshot": self.snapshot,
                        "changes": self.changes,
                        "version": self.version,
                        "epoch": self.epoch,
                    },
                    f,
                    protocol=pickle.HIGHEST_PROTOCOL,
                )
            os.replace(tmp_file, _CACHE_FILE)
        except Exception as e:
            logger.warning(f"Could not save product index disk cache: {e}")

    # ------------------------------------------------------------------ loading
    def _read_all(self) -> Dict[int, dict]:
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
                out[int(r[0])] = {
                    "ma": (r[1] or "").strip(),
                    "ten": (r[2] or "").strip(),
                    "dvt": (r[3] or "").strip(),
                    "dvt_ban": (r[4] or "").strip(),
                    "loai_vt": (r[5] or "1").strip(),
                    "tk_gv": (r[6] or "632").strip(),
                    "tk_vt": (r[7] or "1561").strip(),
                    "tk_dt": (r[8] or "5111").strip(),
                    "tk_ck": (r[9] or "").strip(),
                    "he_so0": float(r[10] or 1.0),
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
            "k": chuan(f"{val['ma']} {val['ten']}"),
        }

    def refresh(self) -> None:
        """Đọc lại toàn bộ danh mục, so sánh với bản chụp và ghi nhận thay đổi."""
        with self._refresh_lock:
            try:
                new = self._read_all()
            except Exception as e:
                logger.warning(f"Could not refresh product index: {e}")
                return

            changed = False
            with self._lock:
                for vtid, val in new.items():
                    if self.snapshot.get(vtid) != val:
                        self.version += 1
                        changed = True
                        self.changes.append({
                            "v": self.version,
                            **self._to_item(vtid, val),
                            "del": False,
                        })
                for vtid in self.snapshot.keys() - new.keys():
                    self.version += 1
                    changed = True
                    self.changes.append({"v": self.version, "id": vtid, "del": True})

                self.snapshot = new
                self._loaded = True
                # Cắt bớt lịch sử thay đổi cũ (giữ ~vài giờ) để không phình RAM.
                if len(self.changes) > 20000:
                    self.changes = self.changes[-10000:]

            if changed or not os.path.exists(_CACHE_FILE):
                self._save_disk_cache()

    def ensure_loaded(self) -> None:
        if not self._loaded:
            self.refresh()

    # ------------------------------------------------------------------- query
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
                items = [self._to_item(i, v) for i, v in self.snapshot.items()]
                return {
                    "full": True,
                    "items": items,
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
        """Tìm phía server (phương án dự phòng khi client chưa tải xong index)."""
        self.ensure_loaded()
        needle = chuan(q).strip()
        if not needle:
            return []
        words = [w for w in needle.split() if w]
        out: List[dict] = []
        with self._lock:
            for vtid, val in self.snapshot.items():
                hay = chuan(f"{val['ma']} {val['ten']}")
                if all(w in hay for w in words):
                    out.append(self._to_item(vtid, val))
                    if len(out) >= limit:
                        break
        return out

    def get_by_code(self, ma_vt: str) -> Optional[dict]:
        """Tra chính xác theo mã (hàng mới chưa kịp có trong index)."""
        code = (ma_vt or "").strip().upper()
        if not code:
            return None
        fn = self.fn_uni
        sql = f"""
            SELECT TOP 1 VTID, RTRIM(Ma_Vt) AS Ma_Vt, {fn}(Ten_Vt) AS Ten_Vt,
                   {fn}(Dvt) AS Dvt, {fn}(Dvt_Ban) AS Dvt_Ban, Loai_Vt,
                   Tk_Gv, Tk_Vt, Tk_Dt, Tk_Ck,
                   ISNULL(He_So0, 1) AS He_So0
            FROM {self.sys_db}.dbo.DmVt WITH (NOLOCK)
            WHERE RTRIM(Ma_Vt) = ?
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [code])
                r = cur.fetchone()
                if r:
                    val = {
                        "ma": (r[1] or "").strip(),
                        "ten": (r[2] or "").strip(),
                        "dvt": (r[3] or "").strip(),
                        "dvt_ban": (r[4] or "").strip(),
                        "loai_vt": (r[5] or "1").strip(),
                        "tk_gv": (r[6] or "632").strip(),
                        "tk_vt": (r[7] or "1561").strip(),
                        "tk_dt": (r[8] or "5111").strip(),
                        "tk_ck": (r[9] or "").strip(),
                        "he_so0": float(r[10] or 1.0),
                    }
                    return self._to_item(int(r[0]), val)
        except Exception as e:
            logger.warning(f"Could not read DmVt by code {ma_vt}: {e}")
        return None


product_index_service = ProductIndexService()
