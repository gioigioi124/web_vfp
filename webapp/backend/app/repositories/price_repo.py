import logging
from typing import Dict, List, Optional

from app.config import settings
from app.database import get_db_cursor

logger = logging.getLogger("app.repositories.price")

# SQL Server allows at most 2100 parameters per statement; keep the IN (...) list
# comfortably below that.
_CHUNK_SIZE = 500


class PriceRepository:
    """
    Tra đơn giá bán & chiết khấu từ bảng giá văn phòng `VP_2014.dbo.BG` (header)
    + `VP_2014.dbo.BG0` (detail).

    Quy tắc chọn bảng giá (khớp hành vi VFP `SO_Get_Price` + `SO_Price_Fix`):
      1. Chỉ xét các đợt bảng giá có `Ngay_Ct <= ngay_ct` (không lấy bảng giá tương lai).
      2. Ưu tiên bảng giá theo KHÁCH HÀNG (`BG.Ma_Dt` = mã khách) hơn bảng giá theo
         KHU VỰC (`BG.Ma_Vm` = `DmDt.Ma_Vm` của khách). `Ma_Dt` và `Ma_Vm` loại trừ
         lẫn nhau trên mỗi dòng `BG`.
      3. Trong cùng mức ưu tiên, lấy bản ghi có `Ngay_Ct` mới nhất (tie-break `Stt` DESC).
      4. Nếu bảng giá đã hết hiệu lực (`Ngay_Ct2` khác NULL và `Ngay_Ct > Ngay_Ct2`)
         thì ép `gia = 0`, `chiet_khau = 0` (giống `CheckPriceExpiry`/`CheckDiscountExpiry`).

    100% READ-ONLY: chỉ SELECT + WITH (NOLOCK).
    """

    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS

    # ------------------------------------------------------------------ helpers
    def get_customer_region(self, ma_dt: str) -> str:
        """Lấy `Ma_Vm` (khu vực) của khách hàng từ `VTSYS.dbo.DmDt`."""
        if not ma_dt or not ma_dt.strip():
            return ""
        sql = f"""
            SELECT RTRIM(ISNULL(Ma_Vm, '')) AS Ma_Vm
            FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK)
            WHERE RTRIM(Ma_Dt) = ?
        """
        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(sql, [ma_dt.strip().upper()])
                r = cur.fetchone()
                if r and r[0]:
                    return str(r[0]).strip()
        except Exception as e:
            logger.warning(f"Could not read DmDt.Ma_Vm for {ma_dt}: {e}")
        return ""

    @staticmethod
    def _pick_best(rows: List[tuple], ma_dt: str) -> Optional[dict]:
        """
        Chọn dòng bảng giá tốt nhất cho một mã vật tư.

        Mỗi `row` = (Ma_Vt, Gia, CK, Ma_Dt, Ma_Vm, Ngay_Ct, Ngay_Ct2, Stt).
        Trả về dict {gia, chiet_khau, expired, source, ngay_ct, ngay_ct2} hoặc None.
        """
        target_dt = (ma_dt or "").strip().upper()
        best = None
        best_key = None
        for r in rows:
            row_dt = (r[3] or "").strip().upper()
            row_vm = (r[4] or "").strip().upper()
            # Mức ưu tiên: khớp khách hàng = 2, khớp khu vực = 1.
            if target_dt and row_dt == target_dt:
                priority = 2
            elif row_vm:
                priority = 1
            else:
                priority = 0
            ngay_ct = r[5]
            stt = (r[7] or "").strip()
            # Sắp xếp: ưu tiên cao trước, rồi Ngay_Ct mới nhất, rồi Stt lớn nhất.
            key = (priority, ngay_ct or 0, stt)
            if best_key is None or key > best_key:
                best_key = key
                best = r

        if best is None:
            return None

        ngay_ct = best[5]
        ngay_ct2 = best[6]
        expired = bool(ngay_ct2 is not None and ngay_ct is not None and ngay_ct > ngay_ct2)
        gia = 0.0 if expired else float(best[1] or 0.0)
        ck = 0.0 if expired else float(best[2] or 0.0)
        row_dt = (best[3] or "").strip().upper()
        source = "customer" if (target_dt and row_dt == target_dt) else "region"
        return {
            "gia": gia,
            "chiet_khau": ck,
            "expired": expired,
            "source": source,
            "ngay_ct": ngay_ct.strftime("%Y-%m-%d") if ngay_ct else None,
            "ngay_ct2": ngay_ct2.strftime("%Y-%m-%d") if ngay_ct2 else None,
        }

    def _query_rows(
        self,
        ma_vt_list: List[str],
        ma_dt: str,
        ma_vm: str,
        ngay_ct: str,
    ) -> List[tuple]:
        """Một câu SELECT gom mọi dòng BG0 khớp danh sách mã vật tư."""
        if not ma_vt_list:
            return []

        placeholders = ",".join(["?"] * len(ma_vt_list))
        params: List[object] = [v.strip().upper() for v in ma_vt_list]
        params.append(ngay_ct)

        # Điều kiện đối tượng áp dụng: khớp khách hàng HOẶC khớp khu vực của khách.
        if ma_dt:
            obj_clause = (
                "(RTRIM(ISNULL(b.Ma_Dt,'')) = ? "
                " OR (RTRIM(ISNULL(b.Ma_Dt,'')) = '' AND RTRIM(ISNULL(b.Ma_Vm,'')) = ?))"
            )
            params.extend([ma_dt.strip().upper(), (ma_vm or "").strip().upper()])
        elif ma_vm:
            obj_clause = "(RTRIM(ISNULL(b.Ma_Dt,'')) = '' AND RTRIM(ISNULL(b.Ma_Vm,'')) = ?)"
            params.append(ma_vm.strip().upper())
        else:
            return []

        sql = f"""
            SELECT
                RTRIM(b0.Ma_Vt) AS Ma_Vt,
                b0.Gia, b0.CK,
                b.Ma_Dt, b.Ma_Vm,
                b.Ngay_Ct, b.Ngay_Ct2, b.Stt
            FROM {self.vp_db}.dbo.BG b WITH (NOLOCK)
            JOIN {self.vp_db}.dbo.BG0 b0 WITH (NOLOCK) ON b0.Stt = b.Stt
            WHERE RTRIM(b0.Ma_Vt) IN ({placeholders})
              AND b.Ngay_Ct <= ?
              AND {obj_clause}
        """
        with get_db_cursor(self.vp_db) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    # ------------------------------------------------------------------- public
    def get_prices_batch(
        self,
        ma_dt: str,
        ma_vt_list: List[str],
        ngay_ct: str,
    ) -> Dict[str, dict]:
        """
        Tra giá cho nhiều mã vật tư trong MỘT lượt (gom theo mã).

        Trả về dict {ma_vt (IN HOA): {gia, chiet_khau, expired, source, ngay_ct, ngay_ct2}}.
        Mã không có bảng giá sẽ KHÔNG xuất hiện trong dict.
        """
        result: Dict[str, dict] = {}
        clean_list = []
        seen = set()
        for v in ma_vt_list or []:
            code = (v or "").strip().upper()
            if code and code not in seen:
                seen.add(code)
                clean_list.append(code)
        if not clean_list or not ngay_ct:
            return result

        ma_vm = self.get_customer_region(ma_dt)

        # Gom dòng theo mã vật tư (chunk để không vượt giới hạn tham số).
        grouped: Dict[str, List[tuple]] = {}
        for i in range(0, len(clean_list), _CHUNK_SIZE):
            chunk = clean_list[i:i + _CHUNK_SIZE]
            try:
                rows = self._query_rows(chunk, ma_dt, ma_vm, ngay_ct)
            except Exception as e:
                logger.warning(f"Could not query BG/BG0: {e}")
                continue
            for r in rows:
                code = (r[0] or "").strip().upper()
                grouped.setdefault(code, []).append(r)

        for code, rows in grouped.items():
            picked = self._pick_best(rows, ma_dt)
            if picked is not None:
                result[code] = picked
        return result

    def get_price(self, ma_dt: str, ma_vt: str, ngay_ct: str) -> Optional[dict]:
        """Tra giá cho một mã vật tư. Trả về dict hoặc None nếu không có bảng giá."""
        if not ma_vt or not ma_vt.strip() or not ngay_ct:
            return None
        batch = self.get_prices_batch(ma_dt, [ma_vt], ngay_ct)
        return batch.get(ma_vt.strip().upper())


price_repository = PriceRepository()
