"""ACID Ledger Posting helpers for VP_2014.dbo.SoCai and VP_2014.dbo.SoCaiVT.

Supports:
- CtMH (Purchase receipts / returns) -> SoCai + SoCaiVT
- CtNX (Other inventory in/out)     -> SoCai + SoCaiVT
- CtCK (Warehouse transfers)        -> SoCaiVT (+ SoCai when accounts differ)
- CtK  (General accounting journal) -> SoCai (paired by Stt_NV, balanced Dr=Cr)
- CtT  (Cash/Bank fallback guard)   -> SoCai if CtT_Post produced 0 rows
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from app.utils.money import round_amount, round_vnd


def _clean_str(val: Optional[str]) -> str:
    return (val or "").strip()


def _nullable_str(val: Optional[str]) -> Optional[str]:
    s = _clean_str(val)
    return s if s else None


def _is_vnd(ma_tte: str) -> bool:
    return (_clean_str(ma_tte) or "VND").upper() == "VND"


def delete_voucher_ledgers(cur: Any, vp_db: str, stt: str, include_inventory: bool = True) -> None:
    """Remove existing ledger rows for stt inside the active transaction before reposting."""
    cur.execute(f"DELETE FROM {vp_db}.dbo.SoCai WHERE Stt = ?", [stt])
    if include_inventory:
        cur.execute(f"DELETE FROM {vp_db}.dbo.SoCaiVT WHERE Stt = ?", [stt])


def _insert_socai_row(
    cur: Any,
    vp_db: str,
    fn_tcvn: str,
    *,
    ma_dvcs: str,
    stt: str,
    stt0: str,
    stt_bt: str,
    ma_ct: str,
    nh_ct: str,
    ngay_ct: str,
    so_ct: str,
    ma_dt0: Optional[str],
    ong_ba: str,
    dien_giai: str,
    tk_no: str,
    ma_dt_no: str,
    tk_co: str,
    ma_dt_co: str,
    ma_tte: str,
    ty_gia: float,
    tien_nt_val: float,
    tien_vnd_val: float,
    ma_sp: Optional[str] = None,
    ma_hd: Optional[str] = None,
    ma_bp: Optional[str] = None,
    ma_km: Optional[str] = None,
) -> None:
    vnd = _is_vnd(ma_tte)
    tien_nt_sql = None if vnd else round_amount(tien_nt_val, 2)
    tien_vnd_sql = float(round_vnd(tien_vnd_val))
    if abs(tien_vnd_sql) < 0.01 and (tien_nt_sql is None or abs(tien_nt_sql) < 0.005):
        return

    cur.execute(
        f"""
        INSERT INTO {vp_db}.dbo.SoCai (
            Ma_DvCs, Stt, Stt0, Stt_Bt, Ma_Ct, Nh_Ct, Ngay_Ct, So_Ct,
            Ma_Dt0, Ong_Ba, Dien_Giai,
            Tk_No, Ma_Dt_No, Tk_Co, Ma_Dt_Co,
            Ma_Tte, Ty_Gia, Tien_Nt, Tien,
            Ma_Sp, Ma_Hd, Ma_Bp, Ma_Km,
            Dien_GiaiN, Dien_GiaiC
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, {fn_tcvn}(?), {fn_tcvn}(?),
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            {fn_tcvn}(?), {fn_tcvn}(?)
        )
        """,
        [
            ma_dvcs,
            stt,
            stt0,
            stt_bt,
            ma_ct,
            nh_ct,
            ngay_ct,
            _nullable_str(so_ct),
            _nullable_str(ma_dt0),
            ong_ba or "",
            dien_giai or "",
            tk_no,
            ma_dt_no or "",
            tk_co,
            ma_dt_co or "",
            (ma_tte or "VND").upper(),
            float(ty_gia or 1.0),
            tien_nt_sql,
            tien_vnd_sql,
            _nullable_str(ma_sp),
            _nullable_str(ma_hd),
            _nullable_str(ma_bp),
            _nullable_str(ma_km),
            dien_giai or "",
            dien_giai or "",
        ],
    )


def pair_gl_journal_entries(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Pair CtK0 lines grouped by stt_nv into balanced (Tk_No, Tk_Co, Tien_Nt, Tien) postings.

    Validates per Stt_NV group:
    - Both Debit ('N') and Credit ('C') sides must exist
    - SUM(Debit) == SUM(Credit) within 1.0 VND / 0.01 foreign currency
    - Rejects ambiguous many-to-many postings within the same Stt_NV group
      (follows standard Vietnamese accounting rule: 1N-nC, nN-1C, or 1N-1C).
    """
    groups: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for idx, row in enumerate(rows):
        stt_nv = int(row.get("stt_nv") or 1)
        groups[stt_nv].append({**row, "_idx": idx + 1})

    postings: List[Dict[str, Any]] = []
    for stt_nv in sorted(groups.keys()):
        grp = groups[stt_nv]
        debits = [r for r in grp if (_clean_str(r.get("no_co")) or "N").upper() == "N"]
        credits = [r for r in grp if (_clean_str(r.get("no_co")) or "N").upper() == "C"]
        if not debits or not credits:
            raise ValueError(
                f"Nhóm định khoản (Stt_NV={stt_nv}) phải có đủ cả dòng Nợ ('N') và dòng Có ('C')."
            )

        sum_dr_nt = sum(float(r.get("tien_nt") or 0.0) for r in debits)
        sum_cr_nt = sum(float(r.get("tien_nt") or 0.0) for r in credits)
        sum_dr = sum(float(r.get("tien") or 0.0) for r in debits)
        sum_cr = sum(float(r.get("tien") or 0.0) for r in credits)

        if abs(sum_dr_nt - sum_cr_nt) > 0.01 or abs(sum_dr - sum_cr) > 1.0:
            raise ValueError(
                f"Nhóm định khoản (Stt_NV={stt_nv}) chưa cân đối: "
                f"Tổng Nợ ({sum_dr:,.0f}) ≠ Tổng Có ({sum_cr:,.0f})."
            )

        if len(debits) > 1 and len(credits) > 1:
            raise ValueError(
                f"Nhóm định khoản (Stt_NV={stt_nv}) không được hạch toán đồng thời "
                "nhiều Nợ và nhiều Có. Hãy tách thành các nhóm Stt_NV riêng."
            )

        if len(debits) == 1:
            dr = debits[0]
            for cr in credits:
                postings.append(
                    {
                        "stt0": cr.get("stt0") or dr.get("stt0") or "",
                        "tk_no": _clean_str(dr.get("tk")),
                        "ma_dt_no": _clean_str(dr.get("ma_dt")),
                        "tk_co": _clean_str(cr.get("tk")),
                        "ma_dt_co": _clean_str(cr.get("ma_dt")),
                        "tien_nt": float(cr.get("tien_nt") or 0.0),
                        "tien": float(cr.get("tien") or 0.0),
                        "dien_giai": _clean_str(cr.get("dien_giai")) or _clean_str(dr.get("dien_giai")),
                        "ma_bp": _clean_str(cr.get("ma_bp")) or _clean_str(dr.get("ma_bp")),
                        "ma_km": _clean_str(cr.get("ma_km")) or _clean_str(dr.get("ma_km")),
                        "ma_sp": _clean_str(cr.get("ma_sp")) or _clean_str(dr.get("ma_sp")),
                        "ma_hd": _clean_str(cr.get("ma_hd")) or _clean_str(dr.get("ma_hd")),
                    }
                )
        else:
            cr = credits[0]
            for dr in debits:
                postings.append(
                    {
                        "stt0": dr.get("stt0") or cr.get("stt0") or "",
                        "tk_no": _clean_str(dr.get("tk")),
                        "ma_dt_no": _clean_str(dr.get("ma_dt")),
                        "tk_co": _clean_str(cr.get("tk")),
                        "ma_dt_co": _clean_str(cr.get("ma_dt")),
                        "tien_nt": float(dr.get("tien_nt") or 0.0),
                        "tien": float(dr.get("tien") or 0.0),
                        "dien_giai": _clean_str(dr.get("dien_giai")) or _clean_str(cr.get("dien_giai")),
                        "ma_bp": _clean_str(dr.get("ma_bp")) or _clean_str(cr.get("ma_bp")),
                        "ma_km": _clean_str(dr.get("ma_km")) or _clean_str(cr.get("ma_km")),
                        "ma_sp": _clean_str(dr.get("ma_sp")) or _clean_str(cr.get("ma_sp")),
                        "ma_hd": _clean_str(dr.get("ma_hd")) or _clean_str(cr.get("ma_hd")),
                    }
                )

    return postings


def post_gl_voucher(
    cur: Any,
    vp_db: str,
    fn_tcvn: str,
    *,
    ma_dvcs: str,
    stt: str,
    ma_ct: str,
    nh_ct: str,
    ngay_ct: str,
    so_ct: str,
    ma_dt0: str,
    ong_ba: str,
    dien_giai0: str,
    ma_tte: str,
    ty_gia: float,
    detail_rows: List[Dict[str, Any]],
) -> float:
    """Post balanced CtK0 rows into SoCai and return total posted VND amount."""
    postings = pair_gl_journal_entries(detail_rows)
    total_posted = 0.0
    for p in postings:
        _insert_socai_row(
            cur,
            vp_db,
            fn_tcvn,
            ma_dvcs=ma_dvcs,
            stt=stt,
            stt0=p["stt0"] or stt,
            stt_bt="1",
            ma_ct=ma_ct,
            nh_ct=nh_ct,
            ngay_ct=ngay_ct,
            so_ct=so_ct,
            ma_dt0=ma_dt0 or p["ma_dt_no"] or p["ma_dt_co"],
            ong_ba=ong_ba,
            dien_giai=p["dien_giai"] or dien_giai0,
            tk_no=p["tk_no"],
            ma_dt_no=p["ma_dt_no"] or ma_dt0,
            tk_co=p["tk_co"],
            ma_dt_co=p["ma_dt_co"] or ma_dt0,
            ma_tte=ma_tte,
            ty_gia=ty_gia,
            tien_nt_val=p["tien_nt"],
            tien_vnd_val=p["tien"],
            ma_sp=p["ma_sp"],
            ma_hd=p["ma_hd"],
            ma_bp=p["ma_bp"],
            ma_km=p["ma_km"],
        )
        total_posted += float(round_vnd(p["tien"]))
    return total_posted


def post_inventory_voucher(
    cur: Any,
    vp_db: str,
    fn_tcvn: str,
    *,
    module_key: str,
    ma_dvcs: str,
    stt: str,
    ma_ct: str,
    nh_ct: str,
    ngay_ct: str,
    so_ct: str,
    ma_dt: str,
    ong_ba: str,
    dien_giai0: str,
    ma_nx: str,
    header_tk: str,
    tk3: str,
    tk_du3: str,
    ma_tte: str,
    ty_gia: float,
    ma_hd: str,
    ma_bp: str,
    ma_xe: str,
    ma_km: str,
    user_name: str,
    posted: bool,
    dinh_khoan: str,
    detail_rows: List[Dict[str, Any]],
    total_tax_nt: float = 0.0,
    total_tax_vnd: float = 0.0,
) -> None:
    """Post CtMH / CtNX / CtCK rows into VP_2014.dbo.SoCaiVT and VP_2014.dbo.SoCai."""
    posted_bit = 1 if posted else 0
    is_transfer = module_key == "inv-transfer"
    is_purchase = module_key == "purchase"
    should_post_gl = posted and (_clean_str(dinh_khoan).upper() != "K")

    # 1. Always write SoCaiVT so Inventory Summary & Stock Card stay in sync
    for row in detail_rows:
        tien_nt = float(row.get("tien_nt") or 0.0)
        tien = float(row.get("tien") or 0.0)
        tien_nt3 = float(row.get("tien_nt3") or 0.0) if is_purchase else None
        tien3 = float(row.get("tien3") or 0.0) if is_purchase else None

        cur.execute(
            f"""
            INSERT INTO {vp_db}.dbo.SoCaiVT (
                Stt, Stt0, Ma_DvCs, Ma_Ct, Nh_Ct, Ngay_Ct, So_Ct,
                Ma_Tte, Ty_Gia, Dien_Giai,
                Ma_Hd, Ma_Dt, Ma_Bp, Ma_Xe, Ma_Km, Ma_Sp,
                Ma_Kho, Ma_KhoN, Ma_Vt, Dvt, Gia_Tb_TT,
                He_So9, So_Luong9, Gia_Nt9, Gia9, Tien_Nt9, Tien9,
                So_Luong, Gia_Nt, Gia, Tien_Nt, Tien,
                Tien_Nt3, Tien3,
                Ma_Nx, Tk, Tk_Du, Tk3, Tk_Du3,
                UserName, Posted
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, {fn_tcvn}(?),
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, {fn_tcvn}(?), ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?
            )
            """,
            [
                stt,
                row["stt0"],
                ma_dvcs,
                ma_ct,
                nh_ct,
                ngay_ct,
                _nullable_str(so_ct),
                (ma_tte or "VND").upper(),
                float(ty_gia or 1.0),
                _clean_str(row.get("dien_giai")) or dien_giai0 or "",
                _nullable_str(row.get("ma_hd") or ma_hd),
                _nullable_str(ma_dt),
                _nullable_str(row.get("ma_bp") or ma_bp),
                _nullable_str(ma_xe),
                _nullable_str(row.get("ma_km") or ma_km),
                _nullable_str(row.get("ma_sp")),
                _nullable_str(row.get("ma_kho")),
                _nullable_str(row.get("ma_kho_n")) if is_transfer else None,
                _nullable_str(row.get("ma_vt")),
                _clean_str(row.get("dvt")),
                (_clean_str(row.get("gia_tb_tt")) or " ")[:1],
                float(row.get("he_so9") or 1.0),
                float(row.get("so_luong9") or 0.0),
                float(row.get("gia_nt9") or 0.0),
                float(row.get("gia9") or 0.0),
                float(row.get("tien_nt9") or 0.0),
                float(row.get("tien9") or 0.0),
                float(row.get("so_luong") or 0.0),
                float(row.get("gia_nt") or 0.0),
                float(row.get("gia") or 0.0),
                tien_nt,
                tien,
                tien_nt3,
                tien3,
                _nullable_str(ma_nx),
                _nullable_str(row.get("tk") or header_tk),
                _nullable_str(row.get("tk_du")),
                _nullable_str(tk3) if is_purchase else None,
                _nullable_str(tk_du3) if is_purchase else None,
                user_name or "ADMIN",
                posted_bit,
            ],
        )

    if not should_post_gl:
        return

    # 2. Write SoCai entries grouped by account pair
    grouped: Dict[Tuple[str, str], Tuple[float, float, str, str]] = {}
    for row in detail_rows:
        row_tk = _clean_str(row.get("tk")) or _clean_str(header_tk)
        row_tk_du = _clean_str(row.get("tk_du"))
        if is_purchase:
            # VFP ctmhd: Header Tk (3311/1111), Grid Tk_Du (152/1561)
            cr_acc = row_tk
            dr_acc = row_tk_du
            if nh_ct == "2":
                dr_acc, cr_acc = cr_acc, dr_acc
        elif is_transfer:
            # CtCK: Tk_Du = Tk Nhan (Dr), Tk = Tk Xuat (Cr) when Nh_Ct='2' (or vice versa)
            if nh_ct == "1":
                dr_acc, cr_acc = row_tk, row_tk_du
            else:
                dr_acc, cr_acc = row_tk_du, row_tk
            if not dr_acc or not cr_acc or dr_acc == cr_acc:
                continue
        else:
            # CtNX: Nh_Ct='1' (Nhap kho) -> Dr Tk_Du (15x) / Cr Tk (154/711)
            #       Nh_Ct='2' (Xuat kho) -> Dr Tk_Du (621/154/642) / Cr Tk (15x)
            # Note: In VFP ctnxd Column9 = Tk_Du (Tk No), Column11 = Tk (Tk Co).
            dr_acc = row_tk_du
            cr_acc = row_tk
            if not dr_acc or not cr_acc:
                continue

        if not dr_acc or not cr_acc:
            continue

        key = (dr_acc, cr_acc)
        prev_nt, prev_vnd, prev_sp, prev_stt0 = grouped.get(key, (0.0, 0.0, "", row["stt0"]))
        grouped[key] = (
            prev_nt + float(row.get("tien_nt") or 0.0),
            prev_vnd + float(row.get("tien") or 0.0),
            prev_sp or _clean_str(row.get("ma_sp")),
            prev_stt0,
        )

    for (dr_acc, cr_acc), (amt_nt, amt_vnd, ma_sp_val, stt0_ref) in grouped.items():
        ma_dt_no = ma_dt if (is_purchase and nh_ct == "2") or (not is_purchase and dr_acc.startswith(("131", "331", "141"))) else ""
        ma_dt_co = ma_dt if (is_purchase and nh_ct != "2") or (not is_purchase and cr_acc.startswith(("131", "331", "141"))) else ""
        _insert_socai_row(
            cur,
            vp_db,
            fn_tcvn,
            ma_dvcs=ma_dvcs,
            stt=stt,
            stt0=stt0_ref,
            stt_bt="1",
            ma_ct=ma_ct,
            nh_ct=nh_ct,
            ngay_ct=ngay_ct,
            so_ct=so_ct,
            ma_dt0=ma_dt,
            ong_ba=ong_ba,
            dien_giai=dien_giai0,
            tk_no=dr_acc,
            ma_dt_no=ma_dt_no,
            tk_co=cr_acc,
            ma_dt_co=ma_dt_co,
            ma_tte=ma_tte,
            ty_gia=ty_gia,
            tien_nt_val=amt_nt,
            tien_vnd_val=amt_vnd,
            ma_sp=ma_sp_val,
            ma_hd=ma_hd,
            ma_bp=ma_bp,
            ma_km=ma_km,
        )

    # 3. Purchase Input VAT line (Stt_Bt = '3')
    if is_purchase and total_tax_vnd > 0.01:
        vat_dr = _clean_str(tk3) or "1331"
        vat_cr = _clean_str(tk_du3) or _clean_str(header_tk) or "3311"
        if nh_ct == "2":
            vat_dr, vat_cr = vat_cr, vat_dr
        _insert_socai_row(
            cur,
            vp_db,
            fn_tcvn,
            ma_dvcs=ma_dvcs,
            stt=stt,
            stt0=stt,
            stt_bt="3",
            ma_ct=ma_ct,
            nh_ct=nh_ct,
            ngay_ct=ngay_ct,
            so_ct=so_ct,
            ma_dt0=ma_dt,
            ong_ba=ong_ba,
            dien_giai=f"Thuế GTGT đầu vào - {dien_giai0}".strip(" -"),
            tk_no=vat_dr,
            ma_dt_no=ma_dt if vat_dr.startswith(("131", "331")) else "",
            tk_co=vat_cr,
            ma_dt_co=ma_dt if vat_cr.startswith(("131", "331")) else "",
            ma_tte=ma_tte,
            ty_gia=ty_gia,
            tien_nt_val=total_tax_nt,
            tien_vnd_val=total_tax_vnd,
            ma_hd=ma_hd,
            ma_bp=ma_bp,
            ma_km=ma_km,
        )


def ensure_cash_voucher_socai(
    cur: Any,
    vp_db: str,
    fn_tcvn: str,
    *,
    ma_dvcs: str,
    stt: str,
    ma_ct: str,
    nh_ct: str,
    ngay_ct: str,
    so_ct: str,
    ma_dt0: str,
    ong_ba: str,
    dien_giai0: str,
    ma_tte: str,
    ty_gia: float,
    posted: bool,
    items: List[Any],
) -> None:
    """Guard for CtT_Post: if posted=True and CtT_Post wrote 0 rows to SoCai, write them in ACID tx."""
    if not posted:
        return
    cur.execute(f"SELECT COUNT(1) FROM {vp_db}.dbo.SoCai WHERE Stt = ?", [stt])
    cnt_row = cur.fetchone()
    if cnt_row and int(cnt_row[0] or 0) > 0:
        return

    for idx, it in enumerate(items, start=1):
        ma_dt_line = _clean_str(getattr(it, "ma_dt", "")) or _clean_str(ma_dt0)
        _insert_socai_row(
            cur,
            vp_db,
            fn_tcvn,
            ma_dvcs=ma_dvcs,
            stt=stt,
            stt0=f"{stt}_{idx}",
            stt_bt="1",
            ma_ct=ma_ct,
            nh_ct=nh_ct,
            ngay_ct=ngay_ct,
            so_ct=so_ct,
            ma_dt0=ma_dt0 or ma_dt_line,
            ong_ba=ong_ba,
            dien_giai=_clean_str(getattr(it, "dien_giai", "")) or dien_giai0,
            tk_no=_clean_str(getattr(it, "tk_no", "")),
            ma_dt_no=ma_dt_line,
            tk_co=_clean_str(getattr(it, "tk_co", "")),
            ma_dt_co=ma_dt_line,
            ma_tte=ma_tte,
            ty_gia=ty_gia,
            tien_nt_val=float(getattr(it, "tien_nt", 0.0) or 0.0),
            tien_vnd_val=float(getattr(it, "tien", 0.0) or 0.0),
            ma_sp=_clean_str(getattr(it, "ma_sp", "")),
            ma_hd=_clean_str(getattr(it, "ma_hd", "")),
            ma_bp=_clean_str(getattr(it, "ma_bp", "")),
            ma_km=_clean_str(getattr(it, "ma_km", "")),
        )
        tien3 = float(getattr(it, "tien3", 0.0) or 0.0)
        tien_nt3 = float(getattr(it, "tien_nt3", 0.0) or 0.0)
        tk_no3 = _clean_str(getattr(it, "tk_no3", ""))
        tk_co3 = _clean_str(getattr(it, "tk_co3", ""))
        if tien3 > 0 and tk_no3 and tk_co3:
            _insert_socai_row(
                cur,
                vp_db,
                fn_tcvn,
                ma_dvcs=ma_dvcs,
                stt=stt,
                stt0=f"{stt}_{idx}T",
                stt_bt="3",
                ma_ct=ma_ct,
                nh_ct=nh_ct,
                ngay_ct=ngay_ct,
                so_ct=so_ct,
                ma_dt0=ma_dt0 or ma_dt_line,
                ong_ba=ong_ba,
                dien_giai=_clean_str(getattr(it, "dien_giai", "")) or dien_giai0,
                tk_no=tk_no3,
                ma_dt_no=ma_dt_line,
                tk_co=tk_co3,
                ma_dt_co=ma_dt_line,
                ma_tte=ma_tte,
                ty_gia=ty_gia,
                tien_nt_val=tien_nt3,
                tien_vnd_val=tien3,
                ma_sp=_clean_str(getattr(it, "ma_sp", "")),
                ma_hd=_clean_str(getattr(it, "ma_hd", "")),
                ma_bp=_clean_str(getattr(it, "ma_bp", "")),
                ma_km=_clean_str(getattr(it, "ma_km", "")),
            )
