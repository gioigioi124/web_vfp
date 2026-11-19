"""Voucher numbering, duplicate checks, and ERP key (Stt / Stt0) allocation."""

from datetime import date
import logging
import random
import re
import time
from typing import Any, List, Optional, Tuple

from app.repositories.voucher.helpers import increment_voucher_number

logger = logging.getLogger("app.repositories.voucher")


class VoucherNumberingMixin:
    """Voucher number allocation, duplicate checks, and ST_Increase_KeyIndex generators."""

    def _exec_check_number(
        self,
        c: Any,
        target_db: str,
        ma_dvcs: str,
        moi_sua: str,
        stt: str,
        ma_ct: str,
        ngay_ct: str,
        s_num: str,
    ) -> bool:
        check_sql = f"""
            SET NOCOUNT ON;
            DECLARE @p_Check bit = 0;
            EXEC {target_db}.dbo.ST_Check_Number
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

    def get_next_voucher_number(
        self,
        ma_dvcs: str = "S1",
        ma_ct: str = "X1",
        ngay_ct: Optional[str] = None,
        cur: Optional[Any] = None,
        db_mode: Optional[str] = "sales",
        prefix_so_ct: Optional[str] = None,
    ) -> str:
        """
        Finds the highest voucher number within the target month in VP_2014 or KH_2014,
        adds 1, and verifies uniqueness via ST_Check_Number.
        """
        is_wh = self._is_warehouse(db_mode)
        target_db = self._get_target_db(db_mode)
        clean_ma_ct = (ma_ct or "X1").strip().upper()
        month_start, next_month_start, _ = self._month_date_bounds(ngay_ct)
        # Khi chạy bên trong transaction ghi (cur != None), đọc committed data thay vì NOLOCK
        # để nhận diện chính xác phiếu vừa được transaction trước chèn vào.
        lock_hint = "" if cur is not None else "WITH (NOLOCK)"

        def _query_rows(sql: str, params: List[Any]) -> List[str]:
            try:
                if cur is not None:
                    cur.execute(sql, params)
                    fetched = cur.fetchall()
                else:
                    with self._get_db_cursor(target_db) as c:
                        c.execute(sql, params)
                        fetched = c.fetchall()
                return [r[0] for r in fetched if r and r[0] and isinstance(r[0], str)]
            except Exception as e:
                logger.warning(f"Error querying max So_Ct ({db_mode}): {e}")
                return []

        if is_wh:
            prefix = ""
            pad_len = 3
            if prefix_so_ct:
                m_hint = re.match(r"^(.*?)(\d+)$", prefix_so_ct.strip())
                if m_hint:
                    prefix = m_hint.group(1)
                    pad_len = max(3, len(m_hint.group(2)))
            if not prefix:
                latest_in_month = _query_rows(
                    f"""
                    SELECT TOP 1 RTRIM(So_Ct)
                    FROM {target_db}.dbo.CtBH {lock_hint}
                    WHERE Ma_Ct = ? AND Ngay_Ct >= ? AND Ngay_Ct < ?
                    ORDER BY Ngay_Ct DESC, Stt DESC
                    """,
                    [clean_ma_ct, month_start, next_month_start],
                )
                sample_list = latest_in_month or _query_rows(
                    f"""
                    SELECT TOP 1 RTRIM(So_Ct)
                    FROM {target_db}.dbo.CtBH {lock_hint}
                    WHERE Ma_Ct = ?
                    ORDER BY Ngay_Ct DESC, Stt DESC
                    """,
                    [clean_ma_ct],
                )
                for s in sample_list:
                    m = re.match(r"^(.*?)(\d+)$", s.strip())
                    if m:
                        prefix = m.group(1)
                        pad_len = max(3, len(m.group(2)))
                        break
            if not prefix:
                prefix = "K01/BH"

            rows = _query_rows(
                f"""
                SELECT RTRIM(So_Ct)
                FROM {target_db}.dbo.CtBH {lock_hint}
                WHERE Ma_Ct = ? AND Ngay_Ct >= ? AND Ngay_Ct < ? AND So_Ct LIKE ?
                """,
                [clean_ma_ct, month_start, next_month_start, f"{prefix}[0-9]%"],
            )
            max_num = 0
            pat = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
            for s in rows:
                m = pat.match(s.strip())
                if m:
                    num = int(m.group(1))
                    if num > max_num:
                        max_num = num
                        pad_len = max(pad_len, len(m.group(1)))
            candidate = f"{prefix}{str(max_num + 1).zfill(pad_len)}"
        else:
            rows = _query_rows(
                f"""
                SELECT TOP 1 RTRIM(So_Ct)
                FROM {target_db}.dbo.CtBH {lock_hint}
                WHERE Ma_Ct = ? AND Ngay_Ct >= ? AND Ngay_Ct < ?
                  AND So_Ct LIKE 'HD[0-9]%'
                  AND TRY_CAST(SUBSTRING(RTRIM(So_Ct), 3, 20) AS INT) IS NOT NULL
                ORDER BY TRY_CAST(SUBSTRING(RTRIM(So_Ct), 3, 20) AS INT) DESC
                """,
                [clean_ma_ct, month_start, next_month_start],
            )
            max_num = 0
            pad_len = 4
            prefix = "HD"
            for s in rows:
                m = re.match(r"^(HD)(\d+)$", s.strip(), re.IGNORECASE)
                if m:
                    num = int(m.group(2))
                    if num > max_num:
                        max_num = num
                        pad_len = max(4, len(m.group(2)))
                        prefix = m.group(1).upper()

            if max_num > 0:
                candidate = f"{prefix}{str(max_num + 1).zfill(pad_len)}"
            else:
                candidate = "HD0001"

        check_ngay = ngay_ct or date.today().strftime("%Y-%m-%d")
        try:
            if cur is not None:
                for _ in range(500):
                    is_dup = self._exec_check_number(
                        cur, target_db, ma_dvcs or "S1", "M", "", clean_ma_ct, check_ngay, candidate
                    )
                    if not is_dup:
                        return candidate
                    candidate = increment_voucher_number(candidate)
            else:
                with self._get_db_cursor(target_db) as c:
                    for _ in range(500):
                        is_dup = self._exec_check_number(
                            c, target_db, ma_dvcs or "S1", "M", "", clean_ma_ct, check_ngay, candidate
                        )
                        if not is_dup:
                            return candidate
                        candidate = increment_voucher_number(candidate)
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
        cur: Optional[Any] = None,
        db_mode: Optional[str] = "sales",
        prefer_month_max: bool = False,
    ) -> Tuple[bool, str]:
        """
        Ensure unique voucher number within the transaction:
        - Acquires sp_getapplock when inside a DB transaction so concurrent saves serialize cleanly.
        - If `prefer_month_max` is True (e.g. creating a voucher in save_voucher) or `so_ct` is empty:
          allocates (max in month + 1) on the serialized cursor and verifies via ST_Check_Number.
        - Otherwise: checks ST_Check_Number on `so_ct` and auto-increments until unique.
        """
        target_db = self._get_target_db(db_mode)
        clean_ma_ct = (ma_ct or "X1").strip().upper()
        curr_so_ct = (so_ct or "").strip()

        if cur is not None:
            _, _, ym_key = self._month_date_bounds(ngay_ct)
            try:
                cur.execute(
                    """
                    SET NOCOUNT ON;
                    DECLARE @rc int;
                    EXEC @rc = sp_getapplock @Resource=?, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                    IF @rc < 0
                        THROW 50001, 'Could not acquire voucher number lock (sp_getapplock timeout)', 1;
                    """,
                    [f"web_vfp_soct:{target_db}:{clean_ma_ct}:{ym_key}"],
                )
            except Exception as e:
                if "50001" in str(e) or "sp_getapplock timeout" in str(e):
                    raise ValueError(
                        "Hệ thống đang bận cấp số chứng từ cho máy khác, vui lòng thử lưu lại sau giây lát."
                    ) from e
                logger.warning(f"sp_getapplock warning ({target_db}): {e}")

        if prefer_month_max or not curr_so_ct:
            next_so_ct = self.get_next_voucher_number(
                ma_dvcs=ma_dvcs,
                ma_ct=clean_ma_ct,
                ngay_ct=ngay_ct,
                cur=cur,
                db_mode=db_mode,
                prefix_so_ct=curr_so_ct,
            )
            return bool(curr_so_ct and next_so_ct != curr_so_ct), next_so_ct

        is_dup_initially = False
        check_so_ct = curr_so_ct
        if cur is not None:
            for attempt in range(500):
                is_dup = self._exec_check_number(
                    cur, target_db, ma_dvcs or "S1", moi_sua or "S", stt or "", clean_ma_ct, ngay_ct, check_so_ct
                )
                if attempt == 0:
                    is_dup_initially = is_dup
                if not is_dup:
                    return is_dup_initially, check_so_ct
                check_so_ct = increment_voucher_number(check_so_ct)
        else:
            with self._get_db_cursor(target_db) as c:
                for attempt in range(500):
                    is_dup = self._exec_check_number(
                        c, target_db, ma_dvcs or "S1", moi_sua or "S", stt or "", clean_ma_ct, ngay_ct, check_so_ct
                    )
                    if attempt == 0:
                        is_dup_initially = is_dup
                    if not is_dup:
                        return is_dup_initially, check_so_ct
                    check_so_ct = increment_voucher_number(check_so_ct)

        return is_dup_initially, check_so_ct

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

    def generate_stts_batch(self, ma_dvcs: str, count: int, cur: Optional[Any] = None) -> List[str]:
        """
        Cấp phát `count` mã Stt0 trong 1 lượt round-trip T-SQL duy nhất khi lưu chứng từ nhiều dòng,
        fallback an toàn về `generate_stt` nếu SP không trả đủ khóa.
        """
        if count <= 0:
            return []
        if count == 1 or cur is None:
            return [self.generate_stt(ma_dvcs, cur) for _ in range(count)]

        clean_dvcs = (ma_dvcs or "S1").strip().upper()[:2]
        batch_sql = f"""
            SET NOCOUNT ON;
            DECLARE @i int = 0;
            DECLARE @p_Stt char(20);
            DECLARE @keys TABLE (seq int IDENTITY(1,1), stt char(20));
            WHILE @i < ?
            BEGIN
                SET @p_Stt = '';
                EXEC {self.sys_db}.dbo.ST_Increase_KeyIndex @p_Ma_DvCs=?, @p_Stt=@p_Stt OUTPUT;
                INSERT INTO @keys(stt) VALUES (@p_Stt);
                SET @i = @i + 1;
            END
            SELECT stt FROM @keys ORDER BY seq;
        """
        try:
            cur.execute(batch_sql, [count, clean_dvcs])
            rows = cur.fetchall()
            keys = [
                str(r[0]).strip()
                for r in (rows or [])
                if r and r[0] and isinstance(r[0], str) and r[0].strip()
            ]
            if len(keys) == count:
                return keys
        except Exception as e:
            logger.warning(f"Batch ST_Increase_KeyIndex warning, falling back to per-row: {e}")

        return [self.generate_stt(ma_dvcs, cur) for _ in range(count)]
