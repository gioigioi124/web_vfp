import logging
from typing import List, Optional
from app.config import settings
from app.database import get_db_cursor
from app.utils.unicode import tcvn_to_unicode
from app.schemas.debt import CustomerDebtSummary, DebtDetailResponse, DebtTransaction

logger = logging.getLogger("app.repositories.debt")

class DebtRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        # fn_TCVNToUnicode is defined in VP_2014; qualify it so calls work from any connection.
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"

    def get_customer_debt_summary(self, ma_dt: str, tk: str = "131") -> CustomerDebtSummary:
        """
        Query customer realtime debt and credit limit according to Fix #1, #2, #3.
        100% READ-ONLY (SELECT only).

        NOTE: dbo.SoCai stores Dr/Cr legs as Tk_No/Ma_Dt_No and Tk_Co/Ma_Dt_Co
        with the VND amount in [Tien] and the foreign amount in [Tien_Nt].
        There is NO Ps_No/Ps_Co column in SoCai (that belongs to CdCt).
        """
        limit_sql = f"""
            SELECT {self.fn_uni}(Ten_Dt) AS Ten_Dt, ISNULL(Gioi_Han, 0) AS Gioi_Han, ISNULL(Toi_Han, 0) AS Toi_Han
            FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK)
            WHERE Ma_Dt = ?
        """

        # Debit leg (TK 131 nợ): Tk_No LIKE '131%' against this customer, đến ngày hiện tại
        debit_sql = f"""
            SELECT
                ISNULL(SUM(Tien), 0)    AS ps_no,
                ISNULL(SUM(Tien_Nt), 0) AS ps_no_nt
            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
            WHERE Tk_No LIKE ? AND Ma_Dt_No = ? AND Ngay_Ct <= ?
        """

        # Credit leg (TK 131 có): Tk_Co LIKE '131%' against this customer, đến ngày hiện tại
        credit_sql = f"""
            SELECT
                ISNULL(SUM(Tien), 0)    AS ps_co,
                ISNULL(SUM(Tien_Nt), 0) AS ps_co_nt
            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
            WHERE Tk_Co LIKE ? AND Ma_Dt_Co = ? AND Ngay_Ct <= ?
        """

        ten_dt = ""
        gioi_han = 0.0
        toi_han = 0.0
        ps_no = 0.0
        ps_co = 0.0
        ps_no_nt = 0.0
        ps_co_nt = 0.0

        tk_param = f"{tk}%"

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(limit_sql, [ma_dt])
                r = cur.fetchone()
                if r:
                    ten_dt = (r[0] or "").strip()
                    gioi_han = float(r[1] or 0.0)
                    toi_han = float(r[2] or 0.0)
        except Exception as e:
            logger.warning(f"Error querying DmDt for debt limit: {e}")

        # Try calling standard SP GL_Alert_ClosingAccount4Customer (realtime balance at current date).
        # NOTE: Mọi EXEC SP PHẢI có SET NOCOUNT ON; nếu không pyodbc sẽ ném
        # "No results. Previous SQL was not a query" và rơi vào nhánh fallback sai.
        sp_success = False
        try:
            with get_db_cursor(self.vp_db) as cur:
                import datetime
                today_str = datetime.date.today().strftime("%Y-%m-%d")
                sp_sql = f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Ten_Tk nvarchar(64), @p_Ten_Tk_E nvarchar(64), @p_Ten_Dt nvarchar(64), @p_Du_No numeric(18,2), @p_Du_Co numeric(18,2);
                    EXEC {self.vp_db}.dbo.GL_Alert_ClosingAccount4Customer
                        @p_Ma_Dvcs='S1',
                        @p_Stt='',
                        @p_Ngay_Ct=?,
                        @p_Tk=?,
                        @p_Ten_Tk=@p_Ten_Tk OUTPUT,
                        @p_Ten_Tk_E=@p_Ten_Tk_E OUTPUT,
                        @p_Ma_Dt=?,
                        @p_Ten_Dt=@p_Ten_Dt OUTPUT,
                        @p_Du_No=@p_Du_No OUTPUT,
                        @p_Du_Co=@p_Du_Co OUTPUT;
                    SELECT @p_Du_No AS Du_No, @p_Du_Co AS Du_Co, @p_Ten_Dt AS Ten_Dt;
                """
                cur.execute(sp_sql, [today_str, tk or "131", ma_dt])
                row = cur.fetchone()
                if row:
                    du_no = float(row[0] or 0.0)
                    du_co = float(row[1] or 0.0)
                    du_cuoi = du_no - du_co
                    ps_no = du_no
                    ps_co = du_co
                    if row[2] and not ten_dt:
                        ten_dt = (row[2] or "").strip()
                    sp_success = True
        except Exception as e:
            logger.warning(f"Error calling GL_Alert_ClosingAccount4Customer: {e}")

        if not sp_success:
            # Fallback: cộng sổ cái TK 131 ĐẾN NGÀY HIỆN TẠI (không lấy toàn bộ lịch sử).
            try:
                import datetime
                today_str = datetime.date.today().strftime("%Y-%m-%d")
                with get_db_cursor(self.vp_db) as cur:
                    cur.execute(debit_sql, [tk_param, ma_dt, today_str])
                    r = cur.fetchone()
                    if r:
                        ps_no = float(r[0] or 0.0)
                        ps_no_nt = float(r[1] or 0.0)

                    cur.execute(credit_sql, [tk_param, ma_dt, today_str])
                    r = cur.fetchone()
                    if r:
                        ps_co = float(r[0] or 0.0)
                        ps_co_nt = float(r[1] or 0.0)
                du_cuoi = ps_no - ps_co
            except Exception as e:
                logger.warning(f"Error querying SoCai for balance: {e}")
                du_cuoi = 0.0

        du_cuoi_nt = ps_no_nt - ps_co_nt

        is_over_limit = (gioi_han > 0 and du_cuoi >= gioi_han)
        # Fix #3: Only warn near limit if Toi_Han <> 0
        is_near_limit = (toi_han > 0 and du_cuoi >= toi_han and not is_over_limit)

        if is_over_limit:
            status_msg = f"Quá giới hạn nợ! ({du_cuoi:,.0f} >= {gioi_han:,.0f})"
        elif is_near_limit:
            status_msg = f"Đến hạn mức thanh toán! ({du_cuoi:,.0f} >= {toi_han:,.0f})"
        else:
            status_msg = "Trong hạn mức an toàn"

        return CustomerDebtSummary(
            ma_dt=ma_dt,
            ten_dt=ten_dt,
            tk=tk,
            du_no=ps_no,
            du_co=ps_co,
            du_no_nt=ps_no_nt,
            du_co_nt=ps_co_nt,
            du_cuoi=du_cuoi,
            gioi_han=gioi_han,
            toi_han=toi_han,
            is_over_limit=is_over_limit,
            is_near_limit=is_near_limit,
            status_message=status_msg
        )

    def get_voucher_debt_detail(self, stt: str) -> DebtDetailResponse:
        """
        Get detailed debt transactions for a customer related to a voucher. 100% READ-ONLY.
        """
        voucher_sql = f"""
            SELECT h.Ma_Dt, {self.fn_uni}(c.Ten_Dt) AS Ten_Dt, h.So_Ct, h.Ngay_Ct, ISNULL(h.TTien_Nt0, 0) AS TTien_Nt0, ISNULL(h.TTien0, 0) AS TTien0
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            WHERE h.Stt = ?
        """

        ma_dt = ""
        ten_dt = ""
        so_ct = ""
        ngay_ct = ""
        tong_no = 0.0

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(voucher_sql, [stt])
                r = cur.fetchone()
                if r:
                    ma_dt = (r[0] or "").strip()
                    ten_dt = (r[1] or "").strip()
                    so_ct = (r[2] or "").strip()
                    ngay_ct = r[3].strftime("%Y-%m-%d") if r[3] else ""
                    tong_no = float(r[5] or r[4] or 0.0)
        except Exception as e:
            logger.warning(f"Error querying voucher header for debt detail: {e}")

        # Query transactions from SoCai for this customer (both Dr and Cr legs on TK 131x)
        tx_sql = f"""
            SELECT TOP 50
                Ngay_Ct, So_Ct, {self.fn_uni}(Dien_Giai) AS Dien_Giai,
                CASE WHEN Tk_No LIKE '131%' THEN ISNULL(Tien, 0) ELSE 0 END      AS Ps_No,
                CASE WHEN Tk_Co LIKE '131%' THEN ISNULL(Tien, 0) ELSE 0 END      AS Ps_Co,
                CASE WHEN Tk_No LIKE '131%' THEN ISNULL(Tien_Nt, 0) ELSE 0 END   AS Ps_No_Nt,
                CASE WHEN Tk_Co LIKE '131%' THEN ISNULL(Tien_Nt, 0) ELSE 0 END   AS Ps_Co_Nt
            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
            WHERE (Tk_No LIKE '131%' AND Ma_Dt_No = ?)
               OR (Tk_Co LIKE '131%' AND Ma_Dt_Co = ?)
            ORDER BY Ngay_Ct DESC, So_Ct DESC
        """

        transactions: List[DebtTransaction] = []
        da_thanh_toan = 0.0
        try:
            if ma_dt:
                with get_db_cursor(self.vp_db) as cur:
                    cur.execute(tx_sql, [ma_dt, ma_dt])
                    rows = cur.fetchall()
                    for tr in rows:
                        p_co = float(tr[4] or 0.0)
                        da_thanh_toan += p_co
                        transactions.append(DebtTransaction(
                            ngay_ct=tr[0].strftime("%Y-%m-%d") if tr[0] else "",
                            so_ct=(tr[1] or "").strip(),
                            dien_giai=(tr[2] or "").strip(),
                            ps_no=float(tr[3] or 0.0),
                            ps_co=p_co,
                            ps_no_nt=float(tr[5] or 0.0),
                            ps_co_nt=float(tr[6] or 0.0)
                        ))
        except Exception as e:
            logger.warning(f"Error querying SoCai transactions: {e}")

        con_lai = max(0.0, tong_no - da_thanh_toan)

        return DebtDetailResponse(
            ma_dt=ma_dt,
            ten_dt=ten_dt,
            stt=stt,
            so_ct=so_ct,
            ngay_ct=ngay_ct,
            tong_no=tong_no,
            da_thanh_toan=da_thanh_toan,
            con_lai=con_lai,
            transactions=transactions
        )

debt_repository = DebtRepository()
