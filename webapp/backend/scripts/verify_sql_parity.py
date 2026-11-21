"""READ-ONLY SQL parity inspection script for VP_2014 & VTSYS.

Run once on a machine connected to SQL Server (192.168.10.8,14333) to verify:
1. Actual Ma_Ct / Nh_Ct / Ma_Nvu / Report rows in VTSYS.dbo.Document
2. DmNx rows (Ma_Nx, Dinh_Khoan, Ct_Nx, Tk)
3. Existing Ct*_Post / Ct*_SoCai* / Ct*_Delete Stored Procedures & parameters in VP_2014
4. Sample latest VFP vouchers and their corresponding SoCai / SoCaiVT rows

SAFETY: 100% READ-ONLY (uses SELECT ... WITH (NOLOCK) only). Never modifies DB.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import get_db_cursor


def main() -> None:
    vp = settings.DB_VP
    sys_db = settings.DB_SYS
    fn_uni = f"{vp}.dbo.fn_TCVNToUnicode"

    print(f"=== CONNECTING READ-ONLY TO {settings.DB_SERVER} ({vp} / {sys_db}) ===")
    with get_db_cursor(vp) as cur:
        print("\n--- 1. VTSYS.dbo.Document ---")
        cur.execute(
            f"""
            SELECT CtID, RTRIM(Ma_Ct), {fn_uni}(ISNULL(Ten_Ct,'')), RTRIM(Ma_Nvu), RTRIM(Nh_Ct),
                   RTRIM(Ct_HD), RTRIM(Ct_CP), RTRIM(ISNULL(No_Co,'')), RTRIM(ISNULL(Tk,'')),
                   RTRIM(Report), RTRIM(HD_Ck), RTRIM(BP_Ck), RTRIM(ISNULL(Thue,''))
            FROM {sys_db}.dbo.Document WITH (NOLOCK)
            ORDER BY CtID
            """
        )
        for r in cur.fetchall():
            print(tuple(r))

        print("\n--- 2. VTSYS.dbo.DmNx ---")
        cur.execute(
            f"""
            SELECT RTRIM(Ma_Nx), {fn_uni}(ISNULL(Ten_Nx,'')), RTRIM(ISNULL(Dinh_Khoan,'')),
                   RTRIM(ISNULL(Ct_Nx,'')), RTRIM(ISNULL(Tk,''))
            FROM {sys_db}.dbo.DmNx WITH (NOLOCK)
            ORDER BY Ma_Nx
            """
        )
        for r in cur.fetchall():
            print(tuple(r))

        print("\n--- 3. VP_2014 Stored Procedures (Ct* / GL* / IN*) ---")
        cur.execute(
            f"""
            SELECT p.name, pr.parameter_id, pr.name, TYPE_NAME(pr.user_type_id), pr.is_output
            FROM {vp}.sys.procedures p WITH (NOLOCK)
            LEFT JOIN {vp}.sys.parameters pr WITH (NOLOCK) ON pr.object_id = p.object_id
            WHERE p.name LIKE 'Ct%' OR p.name LIKE 'ST_%'
            ORDER BY p.name, pr.parameter_id
            """
        )
        for r in cur.fetchall():
            print(tuple(r))

        print("\n--- 4. Sample Latest VFP Vouchers & SoCai / SoCaiVT ---")
        for tbl in ("CtMH", "CtNX", "CtCK", "CtK", "CtT"):
            cur.execute(
                f"SELECT TOP 1 RTRIM(Stt), RTRIM(Ma_Ct), RTRIM(Nh_Ct), Ngay_Ct, RTRIM(So_Ct), TTien_Nt "
                f"FROM {vp}.dbo.{tbl} WITH (NOLOCK) ORDER BY Ngay_Ct DESC, Stt DESC"
            )
            row = cur.fetchone()
            print(f"\n  Latest {tbl}: {tuple(row) if row else 'EMPTY'}")
            if row:
                stt = row[0]
                cur.execute(
                    f"SELECT TOP 5 Stt_Bt, RTRIM(Ma_Ct), RTRIM(Nh_Ct), RTRIM(Tk_No), RTRIM(Ma_Dt_No), "
                    f"RTRIM(Tk_Co), RTRIM(Ma_Dt_Co), Tien_Nt, Tien "
                    f"FROM {vp}.dbo.SoCai WITH (NOLOCK) WHERE Stt = ?",
                    [stt],
                )
                print("    SoCai:", [tuple(x) for x in cur.fetchall()])
                if tbl != "CtK":
                    cur.execute(
                        f"SELECT TOP 5 RTRIM(Ma_Vt), RTRIM(Ma_Kho), RTRIM(Ma_KhoN), He_So9, So_Luong9, So_Luong, Tien_Nt, Tien, RTRIM(Tk), RTRIM(Tk_Du) "
                        f"FROM {vp}.dbo.SoCaiVT WITH (NOLOCK) WHERE Stt = ?",
                        [stt],
                    )
                    print("    SoCaiVT:", [tuple(x) for x in cur.fetchall()])


if __name__ == "__main__":
    main()
