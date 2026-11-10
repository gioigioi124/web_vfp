import logging
from typing import Any, Dict, List, Optional
from app.config import settings
from app.database import get_db_cursor
from app.schemas.pickup import PickupSlipSchema, PickupItemSchema, PickupDetailResponse

logger = logging.getLogger("app.repositories.pickup")

class PickupRepository:
    def __init__(self):
        self.kh_db = settings.DB_KH
        self.sys_db = settings.DB_SYS
        self.vp_db = settings.DB_VP
        self.fn_db = settings.DB_VP
        self.fn_uni = f"{self.fn_db}.dbo.fn_TCVNToUnicode"

    def list_ready_to_pickup(
        self,
        ma_dt: Optional[str] = None,
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None
    ) -> List[PickupSlipSchema]:
        """
        List warehouse slips from KH_2014 not yet invoiced in VP_2014.
        Cross-checks: NOT EXISTS (SELECT 1 FROM VP_2014.dbo.CtBH0 vp WHERE vp.Stt_PX = h.Stt).
        100% READ-ONLY (SELECT only).
        """
        where_clauses = ["h.Confirmed = 1", "h.Ma_Ct IN ('X1', 'N5')"]
        params = []

        if ma_dt and ma_dt.strip():
            where_clauses.append("h.Ma_Dt = ?")
            params.append(ma_dt.strip())
        if ngay_ct1 and ngay_ct1.strip():
            where_clauses.append("h.Ngay_Ct >= ?")
            params.append(ngay_ct1.strip())
        if ngay_ct2 and ngay_ct2.strip():
            where_clauses.append("h.Ngay_Ct <= ?")
            params.append(ngay_ct2.strip())

        # Exclude slips whose header Stt is already linked as Stt_PX in VP_2014.dbo.CtBH0
        where_clauses.append(f"""
            NOT EXISTS (
                SELECT 1 FROM {self.vp_db}.dbo.CtBH0 vp WITH (NOLOCK)
                WHERE vp.Stt_PX = h.Stt
            )
        """)

        where_sql = " AND ".join(where_clauses)

        sql = f"""
            SELECT
                h.Stt, h.So_Ct, h.Ngay_Ct, h.Ma_Dt,
                {self.fn_uni}(h.Dia_Chi) AS Dia_Chi,
                h.Ma_Xe,
                {self.fn_uni}(c.Ten_Dt) AS Ten_Dt,
                COUNT(d.Stt0) AS total_items,
                ISNULL(SUM(d.So_Tam), 0) AS total_so_tam,
                ISNULL(SUM(d.So_Luong9), 0) AS total_so_luong9
            FROM {self.kh_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            JOIN {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK) ON d.Stt = h.Stt
            WHERE {where_sql}
            GROUP BY h.Stt, h.So_Ct, h.Ngay_Ct, h.Ma_Dt, h.Dia_Chi, h.Ma_Xe, c.Ten_Dt
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC
        """

        results: List[PickupSlipSchema] = []
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(PickupSlipSchema(
                        stt=(r[0] or "").strip(),
                        so_ct=(r[1] or "").strip(),
                        ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                        ma_dt=(r[3] or "").strip(),
                        dia_chi=(r[4] or "").strip(),
                        ma_xe=(r[5] or "").strip(),
                        ten_dt=(r[6] or "").strip(),
                        total_items=int(r[7] or 0),
                        total_so_tam=float(r[8] or 0.0),
                        total_so_luong9=float(r[9] or 0.0)
                    ))
        except Exception as e:
            logger.error(f"Error querying pickup slips from {self.kh_db}: {e}")

        return results

    def get_pickup_detail(self, stt: str) -> Optional[PickupDetailResponse]:
        """
        Get items of a pickup slip from KH_2014.dbo.CtBH0. 100% READ-ONLY (SELECT only).
        """
        sql = f"""
            SELECT
                d.Stt0, d.Stt, d.Ma_Vt,
                {self.fn_uni}(d.Dvt) AS Dvt,
                {self.fn_uni}(d.Dvt_Ban) AS Dvt_Ban,
                d.Ma_Kho,
                ISNULL(d.So_Tam, 0) AS So_Tam,
                ISNULL(d.He_So8, 1) AS He_So8,
                ISNULL(d.So_Luong8, 0) AS So_Luong8,
                ISNULL(d.So_Luong9, 0) AS So_Luong9,
                {self.fn_uni}(v.Ten_Vt) AS Ten_Vt,
                ISNULL(v.Loai_Vt, '1') AS Loai_Vt,
                ISNULL(v.Tk_Gv, '632') AS Tk_Gv,
                ISNULL(v.Tk_Vt, '1561') AS Tk_Vt,
                ISNULL(v.Tk_Dt, '5111') AS Tk_Dt,
                ISNULL(v.Tk_Ck, '521') AS Tk_Ck
            FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
            WHERE d.Stt = ?
            ORDER BY d.Stt0
        """

        items: List[PickupItemSchema] = []
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, [stt])
                rows = cur.fetchall()
                for r in rows:
                    items.append(PickupItemSchema(
                        stt0=(r[0] or "").strip(),
                        stt=(r[1] or "").strip(),
                        ma_vt=(r[2] or "").strip(),
                        dvt=(r[3] or "").strip(),
                        dvt_ban=(r[4] or "").strip(),
                        ma_kho=(r[5] or "").strip(),
                        so_tam=float(r[6] or 0.0),
                        he_so8=float(r[7] or 1.0),
                        so_luong8=float(r[8] or 0.0),
                        so_luong9=float(r[9] or 0.0),
                        ten_vt=(r[10] or "").strip(),
                        loai_vt=(r[11] or "1").strip(),
                        tk_gv=(r[12] or "632").strip(),
                        tk_vt=(r[13] or "1561").strip(),
                        tk_dt=(r[14] or "5111").strip(),
                        tk_ck=(r[15] or "521").strip()
                    ))
            return PickupDetailResponse(stt=stt, items=items)
        except Exception as e:
            logger.error(f"Error querying pickup items for slip {stt}: {e}")
            return PickupDetailResponse(stt=stt, items=items)

    def get_slip_header(self, stt: str) -> Optional[Dict[str, Any]]:
        """
        Query slip header info to inherit vehicle and partner.
        """
        sql = f"""
            SELECT h.Stt, h.Ma_Xe, h.Ma_Dt, h.Ngay_Ct
            FROM {self.kh_db}.dbo.CtBH h WITH (NOLOCK)
            WHERE h.Stt = ?
        """
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, [stt])
                r = cur.fetchone()
                if r:
                    return {
                        "stt": (r[0] or "").strip(),
                        "ma_xe": (r[1] or "").strip(),
                        "ma_dt": (r[2] or "").strip(),
                        "ngay_ct": r[3].strftime("%Y-%m-%d") if r[3] else ""
                    }
        except Exception as e:
            logger.warning(f"Error reading slip header {stt}: {e}")
        return None

    def get_item_price(self, ma_dt: str, ma_vt: str, ngay_ct: str) -> float:
        """
        Look up unit selling price from VP_2014 via SO_Get_Price.
        """
        if not ma_dt or not ma_vt:
            return 0.0
        sql = """
            DECLARE @p_Gia numeric(18,4) = 0;
            EXEC dbo.SO_Get_Price @p_Ngay_Ct=?, @p_Ma_Dt=?, @p_Ma_Vt=?, @p_Gia=@p_Gia OUTPUT;
            SELECT @p_Gia;
        """
        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(sql, [ngay_ct, ma_dt, ma_vt])
                r = cur.fetchone()
                if r and r[0] is not None:
                    return float(r[0])
        except Exception as e:
            logger.warning(f"Error calling SO_Get_Price for {ma_vt}: {e}")
        return 0.0

    def get_item_discount(self, ma_dt: str, ma_vt: str, ngay_ct: str) -> float:
        """
        Look up discount % from VP_2014 via SO_Get_Discount.
        """
        if not ma_dt or not ma_vt:
            return 0.0
        sql = """
            DECLARE @p_CK numeric(5,2) = 0;
            EXEC dbo.SO_Get_Discount @p_Ngay_Ct=?, @p_Ma_Dt=?, @p_Ma_Vt=?, @p_CK=@p_CK OUTPUT;
            SELECT @p_CK;
        """
        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(sql, [ngay_ct, ma_dt, ma_vt])
                r = cur.fetchone()
                if r and r[0] is not None:
                    return float(r[0])
        except Exception as e:
            logger.warning(f"Error calling SO_Get_Discount for {ma_vt}: {e}")
        return 0.0

pickup_repository = PickupRepository()
