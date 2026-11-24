"""ACID mutation methods (save_voucher & delete_voucher) for VoucherRepository."""

import logging
import re
from typing import Any, Dict, List, Optional

from app.repositories.voucher.helpers import (
    _DETAIL_INSERT_BATCH_SIZE,
    increment_voucher_number,
)
from app.schemas.voucher import (
    VoucherCreateRequest,
    VoucherDeleteResponse,
    VoucherSaveResponse,
)
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.repositories.voucher")


class BatchVoucherError(ValueError):
    """Structured error raised during batch voucher commit (All-or-Nothing)."""

    def __init__(
        self,
        message: str,
        code: str = "BATCH_VALIDATION_ERROR",
        voucher_index: Optional[int] = None,
        draft_id: Optional[str] = None,
        conflict_order_keys: Optional[List[str]] = None,
        debt_info: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.voucher_index = voucher_index
        self.draft_id = draft_id
        self.conflict_order_keys = conflict_order_keys or []
        self.debt_info = debt_info


class VoucherMutationMixin:
    """Create, update, ledger posting, integrity assertion, and delete operations."""

    def _normalize_voucher_items(
        self,
        data: VoucherCreateRequest,
        is_wh: bool,
        safe_ty_gia: float,
        safe_ma_tte: str,
        is_return: bool = False,
    ) -> None:
        """CHỐT 4 & 5: Chuẩn hóa dòng hàng, chiết khấu = 0 & hàng KM."""
        default_tk = ("155" if is_wh else "1561") if is_return else ("6322" if is_wh else "632")
        default_tk_du = ("6322" if is_wh else "632") if is_return else ("155" if is_wh else "1561")
        default_tk_du2 = "5212" if is_return else ("5112" if is_wh else "5111")
        fixed_gia_tb_tt = "K" if is_return else "C"
        for it in data.items:
            loai_vt = (it.loai_vt or "1").strip()
            so_tam = float(it.so_tam or 0.0)
            he_so8 = float(it.he_so8 if it.he_so8 and it.he_so8 > 0 else 1.0)
            he_so9 = float(it.he_so9 if it.he_so9 and it.he_so9 > 0 else 1.0)
            so_luong9 = float(it.so_luong9 or 0.0)
            gia_nt9 = float(it.gia_nt9 or 0.0)
            chiet_khau = float(it.chiet_khau or 0.0)

            it.tk = (it.tk or "").strip() or default_tk
            it.tk_du = (it.tk_du or "").strip() or default_tk_du
            it.tk_du2 = (it.tk_du2 or "").strip() or default_tk_du2
            it.gia_tb_tt = fixed_gia_tb_tt

            # Tất cả loại vật tư trên Grid đều tính So_Luong8 = So_Luong9 = So_Tam * He_So8 (khớp dữ liệu VFP thật)
            if so_tam > 0:
                so_luong_ban = round_amount(so_tam * he_so8, 2)
            else:
                so_luong_ban = so_luong9
                so_tam = round_amount(so_luong9 / he_so8, 2) if he_so8 > 0 else so_luong9
            it.so_tam = so_tam
            it.so_luong8 = so_luong_ban
            it.so_luong9 = so_luong_ban
            if loai_vt == "1":
                it.so_luong = round_amount(so_luong_ban * he_so9, 2)
            else:
                it.so_luong = so_luong_ban

            if is_wh:
                # Phiếu kho KH_2014: Toàn bộ các cột giá bán / thành tiền / chiết khấu để NULL
                it.gia_nt9 = None
                it.gia9 = None
                it.tien_nt9 = None
                it.tien9 = None
                it.gia_nt = None
                it.gia = None
                it.tien_nt = None
                it.tien = None
                it.gia_nt2 = None
                it.gia2 = None
                it.tien_nt2 = None
                it.tien2 = None
                it.tien_nt3 = None
                it.tien3 = None
                it.chiet_khau = None
                it.tien_nt4 = None
                it.tien4 = None
                it.tk_du4 = None
            else:
                # Fix #17: VND promotional item 1-10 VND
                if safe_ma_tte == "VND" and 1 <= gia_nt9 <= 10:
                    chiet_khau = 0.0

                is_vnd = safe_ma_tte == "VND"
                it.tien_nt9 = float(round_vnd(so_luong_ban * gia_nt9)) if is_vnd else round_amount(so_luong_ban * gia_nt9, 2)
                it.gia9 = float(round_vnd(gia_nt9 * safe_ty_gia))
                it.tien9 = float(round_vnd(it.tien_nt9 * safe_ty_gia))

                if chiet_khau > 0:
                    it.tien_nt4 = float(round_vnd(it.tien_nt9 * chiet_khau / 100.0)) if is_vnd else round_amount(it.tien_nt9 * chiet_khau / 100.0, 2)
                    it.tien4 = float(round_vnd(it.tien9 * chiet_khau / 100.0))
                    it.tien_nt2 = float(round_vnd(it.tien_nt9 - it.tien_nt4)) if is_vnd else round_amount(it.tien_nt9 - it.tien_nt4, 2)
                    it.tien2 = float(round_vnd(it.tien9 - it.tien4))
                    it.gia_nt2 = round_amount(gia_nt9 * (100.0 - chiet_khau) / 100.0, 2)
                    it.gia2 = float(round_vnd(it.gia9 * (100.0 - chiet_khau) / 100.0))
                else:
                    it.tien_nt4 = 0.0
                    it.tien4 = 0.0
                    it.tien_nt2 = it.tien_nt9
                    it.tien2 = it.tien9
                    it.gia_nt2 = gia_nt9
                    it.gia2 = it.gia9

                it.chiet_khau = chiet_khau

                # Fix #21 (mở rộng): 4 cột GIÁ VỐN bên phiếu bán hàng / nhập lại LUÔN để NULL.
                it.gia_nt = None
                it.gia = None
                it.tien_nt = None
                it.tien = None

                # NULL-policy khớp VFP (Ma_Ct='X1'/'N5'): chiết khấu 0 -> Chiet_Khau/Tien_Nt4/Tien4 = NULL
                if chiet_khau <= 0:
                    it.chiet_khau = None
                    it.tien_nt4 = None
                    it.tien4 = None
                    it.tk_du4 = None
                it.tien_nt3 = None
                it.tien3 = None

    def _sync_header_totals(self, data: VoucherCreateRequest, is_wh: bool) -> None:
        """CHỐT 6: Đồng bộ tổng Header & thuế GTGT."""
        data.loai_ck = "2"
        data.ma_thue = None
        data.thue_gtgt = None
        data.ttien_nt = None
        data.ttien = None
        data.ttien_nt3 = None
        data.ttien3 = None

        if is_wh:
            data.ttien_nt0 = None
            data.ttien_nt2 = None
            data.ttien_nt4 = None
            data.ttien0 = None
            data.ttien2 = None
            data.ttien4 = None
        else:
            data.ttien_nt2 = round_amount(sum(it.tien_nt2 for it in data.items if it.tien_nt2), 2)
            _nt4 = round_amount(sum(it.tien_nt4 for it in data.items if it.tien_nt4), 2)
            _t4 = float(round_vnd(sum(it.tien4 for it in data.items if it.tien4)))
            data.ttien2 = float(round_vnd(sum(it.tien2 for it in data.items if it.tien2)))
            data.ttien_nt4 = _nt4 if _nt4 > 0 else None
            data.ttien4 = _t4 if _t4 > 0 else None
            data.ttien_nt0 = round_amount((data.ttien_nt2 or 0.0) + (data.ttien_nt3 or 0.0), 2)
            data.ttien0 = float(round_vnd((data.ttien2 or 0.0) + (data.ttien3 or 0.0)))

    def _write_header(
        self,
        cur: Any,
        target_db: str,
        mode: str,
        stt: str,
        final_so_ct: str,
        data: VoucherCreateRequest,
        safe_ty_gia: float,
        is_wh: bool,
        user_name: str,
    ) -> None:
        """1. Ghi Header dbo.CtBH."""
        clean_ma_ct = (data.ma_ct or "X1").strip().upper()
        is_return = clean_ma_ct == "N5"
        clean_nh_ct = "1" if is_return else (data.nh_ct or "2")
        default_dg = ("nhập lại" if is_return else "xuất bán") if is_wh else ""

        if mode == "M":
            insert_header_sql = f"""
                INSERT INTO {target_db}.dbo.CtBH (
                    Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ma_Tte, Ty_Gia,
                    Ngay_Ps, Ngay_Ct, So_Ct, Ma_Xe, Ma_Bp, Ma_HD,
                    Ma_Dt, Ma_Nx, Tk2, Tk3, Tk_Du3, Tk4,
                    Ong_Ba, Dia_Chi, Dien_Giai0, Desc_EN0,
                    TTien_Nt, TTien_Nt0, TTien_Nt2, TTien_Nt3, TTien_Nt4,
                    TTien, TTien0, TTien3, TTien2, TTien4,
                    Loai_Ck, TyLeCK, Han_Tt, Ma_Thue, Thue_GTGT,
                    Ma_DtGtGt, Ten_DtGtGt, So_Ct0, Ngay_Ct0, Stt_HBTL,
                    Confirmed, Posted, Printed, UserName
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?),
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, {self.fn_tcvn}(?), ?, ?, ?,
                    ?, ?, ?, ?
                )
            """
            cur.execute(insert_header_sql, [
                stt, data.ma_dvcs or "S1", clean_ma_ct, clean_nh_ct, data.ma_tte or "VND", safe_ty_gia,
                data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or default_dg, data.desc_en0 or None,
                data.ttien_nt, data.ttien_nt0, data.ttien_nt2, data.ttien_nt3, data.ttien_nt4,
                data.ttien, data.ttien0, data.ttien3, data.ttien2, data.ttien4,
                data.loai_ck or "2", None, None, data.ma_thue, data.thue_gtgt,
                data.ma_dtgtgt or None, data.ten_dtgtgt or None, data.so_ct0 or None, data.ngay_ct0, data.stt_hbtl or None,
                1 if data.confirmed is not False else 1, 1 if data.posted else 0, (1 if data.printed else None), user_name or "KTCN3",
            ])
        else:
            update_header_sql = f"""
                UPDATE {target_db}.dbo.CtBH SET
                    Ma_DvCs = ?, Ma_Ct = ?, Nh_Ct = ?, Ma_Tte = ?, Ty_Gia = ?,
                    Ngay_Ps = ?, Ngay_Ct = ?, So_Ct = ?, Ma_Xe = ?, Ma_Bp = ?, Ma_HD = ?,
                    Ma_Dt = ?, Ma_Nx = ?, Tk2 = ?, Tk3 = ?, Tk_Du3 = ?, Tk4 = ?,
                    Ong_Ba = {self.fn_tcvn}(?), Dia_Chi = {self.fn_tcvn}(?),
                    Dien_Giai0 = {self.fn_tcvn}(?), Desc_EN0 = {self.fn_tcvn}(?),
                    TTien_Nt = ?, TTien_Nt0 = ?, TTien_Nt2 = ?, TTien_Nt3 = ?, TTien_Nt4 = ?,
                    TTien = ?, TTien0 = ?, TTien3 = ?, TTien2 = ?, TTien4 = ?,
                    Loai_Ck = ?, TyLeCK = ?, Han_Tt = ?, Ma_Thue = ?, Thue_GTGT = ?,
                    Ma_DtGtGt = ?, Ten_DtGtGt = {self.fn_tcvn}(?), So_Ct0 = ?, Ngay_Ct0 = ?,
                    Confirmed = ?, Posted = ?, Printed = ?
                WHERE Stt = ?
            """
            cur.execute(update_header_sql, [
                data.ma_dvcs or "S1", clean_ma_ct, clean_nh_ct, data.ma_tte or "VND", safe_ty_gia,
                data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or default_dg, data.desc_en0 or None,
                data.ttien_nt, data.ttien_nt0, data.ttien_nt2, data.ttien_nt3, data.ttien_nt4,
                data.ttien, data.ttien0, data.ttien3, data.ttien2, data.ttien4,
                data.loai_ck or "2", None, None, data.ma_thue, data.thue_gtgt,
                data.ma_dtgtgt or None, data.ten_dtgtgt or None, data.so_ct0 or None, data.ngay_ct0,
                1 if data.confirmed is not False else 1, 1 if data.posted else 0, (1 if data.printed else None),
                stt,
            ])

    def _write_details(
        self,
        cur: Any,
        target_db: str,
        mode: str,
        stt: str,
        data: VoucherCreateRequest,
        is_wh: bool,
        preallocated_stt0s: Optional[List[str]] = None,
    ) -> None:
        """2. Ghi Detail dbo.CtBH0 (Delete cũ nếu 'S' + Batch cấp Stt0 & Multi-row INSERT)."""
        if mode == "S":
            cur.execute(f"DELETE FROM {target_db}.dbo.CtBH0 WHERE Stt = ?", [stt])

        is_return = (data.ma_ct or "X1").strip().upper() == "N5"
        default_tk = ("155" if is_wh else "1561") if is_return else ("6322" if is_wh else "632")
        default_tk_du = ("6322" if is_wh else "632") if is_return else ("155" if is_wh else "1561")
        default_tk_du2 = "5212" if is_return else ("5112" if is_wh else "5111")
        fixed_gia_tb_tt = "K" if is_return else "C"

        if preallocated_stt0s is not None and len(preallocated_stt0s) == len(data.items):
            stt0_list = preallocated_stt0s
        else:
            stt0_list = self.generate_stts_batch(data.ma_dvcs or "S1", len(data.items), cur)
        row_placeholder = (
            f"(?, ?, ?, ?, ?, ?, ?, "
            f"?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), ?, ?, "
            f"?, ?, ?, ?, ?, "
            f"?, ?, ?, ?, ?, ?, "
            f"?, ?, ?, ?, ?, ?, "
            f"?, ?, ?, ?, ?)"
        )
        insert_detail_prefix = f"""
            INSERT INTO {target_db}.dbo.CtBH0 (
                Stt_PX, Stt0, Stt, Tk, Tk_Du, Tk_Du2, Tk_Du4,
                Ma_Kho, Ma_Vt, Dvt, Dvt_Ban, So_Tam, He_So8,
                So_Luong8, He_So9, So_Luong9, Gia_Nt9, Gia9,
                Tien_Nt9, Tien9, So_Luong, Gia_Nt, Gia, Tien_Nt,
                Tien, Gia_Nt2, Gia2, Tien_Nt2, Tien2, Tien_Nt3,
                Tien3, Chiet_Khau, Tien_Nt4, Tien4, Gia_Tb_TT
            ) VALUES """

        for batch_start in range(0, len(data.items), _DETAIL_INSERT_BATCH_SIZE):
            batch_items = data.items[batch_start:batch_start + _DETAIL_INSERT_BATCH_SIZE]
            batch_stt0s = stt0_list[batch_start:batch_start + _DETAIL_INSERT_BATCH_SIZE]
            batch_params: List[Any] = []
            for it, stt0 in zip(batch_items, batch_stt0s):
                batch_params.extend([
                    None if is_wh else (it.stt_px or None),
                    stt0,
                    stt,
                    it.tk or default_tk,
                    it.tk_du or default_tk_du,
                    it.tk_du2 or default_tk_du2,
                    it.tk_du4 or None,
                    it.ma_kho or "",
                    it.ma_vt,
                    it.dvt or "",
                    it.dvt_ban or None,
                    it.so_tam or 0.0,
                    it.he_so8 or 1.0,
                    it.so_luong8 or 0.0,
                    it.he_so9 or 1.0,
                    it.so_luong9 or 0.0,
                    None if is_wh else (it.gia_nt9 or 0.0),
                    None if is_wh else (it.gia9 or 0.0),
                    None if is_wh else (it.tien_nt9 or 0.0),
                    None if is_wh else (it.tien9 or 0.0),
                    it.so_luong or 0.0,
                    None,
                    None,
                    None,
                    None,
                    None if is_wh else (it.gia_nt2 or 0.0),
                    None if is_wh else (it.gia2 or 0.0),
                    None if is_wh else (it.tien_nt2 or 0.0),
                    None if is_wh else (it.tien2 or 0.0),
                    it.tien_nt3,
                    it.tien3,
                    it.chiet_khau,
                    it.tien_nt4,
                    it.tien4,
                    fixed_gia_tb_tt,
                ])
            values_sql = ",\n".join([row_placeholder] * len(batch_items))
            cur.execute(insert_detail_prefix + values_sql, batch_params)

    def _post_ledgers(
        self,
        cur: Any,
        target_db: str,
        mode: str,
        stt: str,
        final_so_ct: str,
        data: VoucherCreateRequest,
        safe_ty_gia: float,
        is_wh: bool,
        user_name: str,
        db_mode: Optional[str],
        strict: bool = False,
    ) -> None:
        """2b & 3. Xóa sổ cái cũ (nếu S), chạy CtBH_Post, CtBH_SoCai, CtBH_SoCaiVT_Save, ST_Save_Number."""
        clean_ma_ct = (data.ma_ct or "X1").strip().upper()
        is_return = clean_ma_ct == "N5"
        clean_nh_ct = "1" if is_return else (data.nh_ct or "2")

        # 2b. Chế độ Sửa 'S': xóa sổ cái cũ của chứng từ TRONG transaction trước khi post lại.
        if mode == "S":
            cur.execute(f"DELETE FROM {target_db}.dbo.SoCai WHERE Stt = ?", [stt])
            cur.execute(f"DELETE FROM {target_db}.dbo.SoCaiVT WHERE Stt = ?", [stt])

        # 3. Post Ledger & Save Document Number
        post_user_name = (user_name or "") if mode == "S" else (user_name or "KTCN3")
        try:
            cur.execute(
                f"SET NOCOUNT ON; EXEC {target_db}.dbo.CtBH_Post @p_Kieu='1', @p_Stt=?, @p_UserName=?",
                [stt, post_user_name],
            )
        except Exception as e:
            logger.warning(f"CtBH_Post ({db_mode}) warning: {e}")
            if mode == "S" or strict:
                raise

        # 3b. Ghi SỔ CÁI TÀI KHOẢN (SoCai) — bút toán DOANH THU (X1) hoặc HÀNG BÁN TRẢ LẠI (N5) (chỉ ghi trên VP_2014):
        if not is_wh:
            revenue_groups: Dict[str, float] = {}
            for it in data.items:
                tk_item = (it.tk_du2 or "").strip()
                if not tk_item:
                    continue
                revenue_groups[tk_item] = revenue_groups.get(tk_item, 0.0) + float(it.tien_nt2 or 0.0)

            if revenue_groups:
                tk2_val = (data.tk2 or "1311").strip() or "1311"
                safe_ccy = (data.ma_tte or "VND").strip().upper()
                fn = self.fn_tcvn
                for tk_item, group_amount_nt in revenue_groups.items():
                    amount_nt = round_amount(group_amount_nt, 2)
                    if abs(amount_nt) < 0.005:
                        continue
                    amount_vnd = float(round_vnd(amount_nt * safe_ty_gia))
                    tien_vnd = amount_vnd
                    tien_nt = None if safe_ccy == "VND" else amount_nt
                    so_ct_line = (final_so_ct or "").strip() or None
                    if is_return:
                        # N5 (Hàng bán bị trả lại): Nợ TK_HBTL (5212/531) / Có TK phải thu (1311, Ma_Dt_Co = Ma_Dt) -> giảm công nợ
                        tk_no = tk_item
                        ma_dt_no = ""
                        tk_co = tk2_val
                        ma_dt_co = data.ma_dt
                    else:
                        # X1 (Xuất bán): Nợ TK phải thu (1311, Ma_Dt_No = Ma_Dt) / Có TK doanh thu (5111/5112) -> tăng công nợ
                        tk_no = tk2_val
                        ma_dt_no = data.ma_dt
                        tk_co = tk_item
                        ma_dt_co = ""
                    try:
                        cur.execute(f"""
                            SET NOCOUNT ON;
                            DECLARE @p_Ong_Ba nvarchar(64)      = {fn}(?);
                            DECLARE @p_Dien_Giai nvarchar(128)  = {fn}(?);
                            DECLARE @p_Dien_GiaiN nvarchar(128) = {fn}(?);
                            DECLARE @p_Dien_GiaiC nvarchar(128) = {fn}(?);
                            EXEC {target_db}.dbo.CtBH_SoCai
                              @p_Ma_Dvcs=?, @p_Stt=?, @p_Stt0=?, @p_Ma_Ct=?, @p_Nh_Ct=?,
                              @p_Ngay_Ct=?, @p_So_Ct=?, @p_Ma_Dt0=?, @p_Ong_Ba=@p_Ong_Ba,
                              @p_Dien_Giai=@p_Dien_Giai, @p_Tk_No=?, @p_Ma_Dt_No=?, @p_Tk_Co=?, @p_Ma_Dt_Co=?,
                              @p_Ma_Tte=?, @p_Ty_Gia=?, @p_Ma_HD=?, @p_Ma_Bp=?,
                              @p_Dien_GiaiN=@p_Dien_GiaiN, @p_Dien_GiaiC=@p_Dien_GiaiC,
                              @p_Tien_Nt=?, @p_Tien=?, @p_Stt_Bt=?,
                              @p_Desc_EN=NULL, @p_Desc_ENN=NULL, @p_Desc_ENC=NULL;
                        """, [
                            data.ong_ba or "",
                            data.dien_giai0 or "",
                            data.dien_giai0 or "",
                            data.dien_giai0 or "",
                            data.ma_dvcs or "S1", stt, stt, clean_ma_ct, clean_nh_ct,
                            data.ngay_ct, so_ct_line, data.ma_dt,
                            tk_no, ma_dt_no, tk_co, ma_dt_co,
                            data.ma_tte or "VND", safe_ty_gia, data.ma_hd or None, data.ma_bp or None,
                            tien_nt, tien_vnd, "2",
                        ])
                    except Exception as e:
                        logger.warning(f"CtBH_SoCai warning: {e}")
                        if mode == "S" or strict:
                            raise

        try:
            cur.execute(f"SET NOCOUNT ON; EXEC {target_db}.dbo.CtBH_SoCaiVT_Save @p_Stt=?", [stt])
        except Exception as e:
            logger.warning(f"CtBH_SoCaiVT_Save ({db_mode}) warning: {e}")
            if mode == "S" or strict:
                raise
        try:
            cur.execute(
                f"SET NOCOUNT ON; EXEC {self.sys_db}.dbo.ST_Save_Number @p_Ma_DvCs=?, @p_Ma_Ct=?, @p_So_Ct=?",
                [data.ma_dvcs or "S1", clean_ma_ct, final_so_ct],
            )
        except Exception as e:
            logger.warning(f"ST_Save_Number warning: {e}")
            if strict:
                raise

    def save_voucher(
        self,
        data: VoucherCreateRequest,
        mode: str = "M",
        stt_override: Optional[str] = None,
        user_name: str = "KTCN3",
        db_mode: Optional[str] = "sales",
    ) -> VoucherSaveResponse:
        """
        Save sales/return invoice (VP_2014) or warehouse slip (KH_2014) with Pre-Save checks & ACID transaction.
        """
        is_wh = self._is_warehouse(db_mode)
        target_db = self._get_target_db(db_mode)
        clean_ma_ct = (data.ma_ct or "X1").strip().upper()
        is_return = clean_ma_ct == "N5"
        data.ma_ct = clean_ma_ct
        data.nh_ct = "1" if is_return else (data.nh_ct or "2")

        # ===== CHỐT 1: KIỂM TRA NGÀY KHÓA SỔ =====
        ngay_kt_ht = self.get_closing_date(data.ma_dvcs or "S1")
        if ngay_kt_ht and data.ngay_ct <= ngay_kt_ht:
            raise ValueError(f"Ngày chứng từ ({data.ngay_ct}) nằm trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

        # ===== CHỐT 2: TRƯỜNG BẮT BUỘC =====
        if not data.ma_dt or not data.ma_dt.strip():
            raise ValueError("Mã khách hàng (Ma_Dt) là bắt buộc!")
        if not data.ma_nx or not data.ma_nx.strip():
            data.ma_nx = "131"
        if not data.items or len(data.items) == 0:
            raise ValueError("Chứng từ phải có ít nhất 1 dòng chi tiết hàng hóa!")

        # ===== CHỐT 3: KIỂM TRA HẠN MỨC CÔNG NỢ REALTIME (CHỈ ÁP DỤNG CHO PHIẾU XUẤT BÁN X1 TRÊN VP_2014) =====
        if not is_wh and not is_return and not getattr(data, "skip_debt_check", False):
            # Khi sửa phiếu (mode == "S"), loại trừ chính stt của phiếu đang sửa khỏi dư nợ
            # (check_only=True chỉ chạy 1 lần SP thay vì 2 lần).
            exclude_stt = (stt_override or "").strip() if mode == "S" else ""
            debt_summary = self._get_debt_repository().get_customer_debt_summary(
                data.ma_dt.strip(),
                stt=exclude_stt,
                check_only=True,
            )
            if debt_summary.is_over_limit:
                raw_check = getattr(debt_summary, "du_cuoi_kiem_tra", None)
                check_debt = raw_check if isinstance(raw_check, (int, float)) else debt_summary.du_cuoi
                raise ValueError(
                    f"Khách hàng {data.ma_dt} vượt quá hạn mức nợ cho phép! "
                    f"(Dư nợ: {check_debt:,.0f} >= Giới hạn: {debt_summary.gioi_han:,.0f})"
                )

        # ===== CHỐT 4 & 5: CHUẨN HÓA DÒNG HÀNG & CHIẾT KHẤU = 0 & HÀNG KM =====
        safe_ty_gia = float(data.ty_gia) if data.ty_gia and data.ty_gia > 0 else 1.0
        safe_ma_tte = (data.ma_tte or "VND").strip().upper()
        self._normalize_voucher_items(data, is_wh, safe_ty_gia, safe_ma_tte, is_return=is_return)

        # ===== CHỐT 6: ĐỒNG BỘ TỔNG HEADER & THUẾ GTGT =====
        self._sync_header_totals(data, is_wh)

        # ===== CHỐT 7: CHỐNG TRÙNG SỐ & GHI BỀN VỮNG TRONG TRANSACTION ACID =====
        with self._get_db_transaction(target_db) as (conn, cur):
            # CHỐT 2b (trong transaction): MÃ KHÁCH HÀNG PHẢI TỒN TẠI TRONG DmDt (SARGable).
            clean_ma_dt = (data.ma_dt or "").strip().upper()
            cur.execute(
                f"SELECT TOP 1 1 FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) "
                f"WHERE Ma_Dt = ?",
                [clean_ma_dt],
            )
            if cur.fetchone() is None:
                raise ValueError(
                    f"Mã khách hàng '{clean_ma_dt}' không tồn tại trong danh mục DmDt! "
                    f"Vui lòng chọn mã hợp lệ từ danh sách gợi ý."
                )
            data.ma_dt = clean_ma_dt

            raw_so_ct = (data.so_ct or "").strip()
            is_custom_so_ct = bool(getattr(data, "custom_so_ct", False))
            if is_return:
                looks_non_standard_custom = (
                    bool(raw_so_ct)
                    and not re.match(r"^\d+$", raw_so_ct)
                )
            else:
                looks_non_standard_custom = (
                    bool(raw_so_ct)
                    and not is_wh
                    and not re.match(r"^HD\d+$", raw_so_ct, re.IGNORECASE)
                )
            use_month_max = (mode == "M") and not is_custom_so_ct and not looks_non_standard_custom

            is_dup, final_so_ct = self.check_duplicate_number(
                ma_dvcs=data.ma_dvcs or "S1",
                moi_sua=mode,
                stt=stt_override or "",
                ma_ct=clean_ma_ct,
                ngay_ct=data.ngay_ct,
                so_ct=raw_so_ct,
                cur=cur,
                db_mode=db_mode,
                prefer_month_max=use_month_max,
            )
            data.so_ct = final_so_ct

            if mode == "M":
                stt = self.generate_stt(data.ma_dvcs or "S1", cur)
            else:
                if not stt_override or not stt_override.strip():
                    raise ValueError("Chế độ sửa yêu cầu mã chứng từ (stt) hợp lệ!")
                stt = stt_override.strip()

            self._write_header(cur, target_db, mode, stt, final_so_ct, data, safe_ty_gia, is_wh, user_name)
            self._write_details(cur, target_db, mode, stt, data, is_wh)
            self._post_ledgers(cur, target_db, mode, stt, final_so_ct, data, safe_ty_gia, is_wh, user_name, db_mode)

            # 4. Integrity Assertion before COMMIT
            cur.execute(f"SELECT ISNULL(SUM(Tien_Nt2), 0), COUNT(1) FROM {target_db}.dbo.CtBH0 WHERE Stt = ?", [stt])
            check_row = cur.fetchone()
            if check_row:
                db_sum2 = float(check_row[0] or 0.0)
                db_count = int(check_row[1] or 0)
                if not is_wh and abs(db_sum2 - (data.ttien_nt2 or 0.0)) > 0.05:
                    raise AssertionError(
                        f"Lệch tổng tiền Header và Detail: DB Tien_Nt2={db_sum2} vs Header={data.ttien_nt2}"
                    )
                if db_count != len(data.items):
                    raise AssertionError(f"Số lượng dòng chi tiết không khớp: DB={db_count} vs Form={len(data.items)}")

        return VoucherSaveResponse(
            stt=stt,
            so_ct=final_so_ct,
            message=(
                ("Lưu phiếu nhập lại kho thành công." if is_return else "Lưu phiếu xuất kho thành công.")
                if is_wh
                else ("Lưu phiếu nhập hàng trả lại thành công." if is_return else "Lưu chứng từ thành công.")
            ),
        )

    def save_vouchers_batch(
        self,
        vouchers: List[VoucherCreateRequest],
        user_name: str = "KTCN3",
        draft_ids: Optional[List[Optional[str]]] = None,
    ) -> List[VoucherSaveResponse]:
        """
        Xuất nhanh cả xe hàng trong 1 ACID Transaction duy nhất (All-or-Nothing) vào VP_2014:
        - Phase 1 (NGOÀI transaction, 0 lock): kiểm tra khóa sổ, trường bắt buộc, chống trùng Stt_PX
          nội bộ batch, chuẩn hóa dòng hàng (4 cột giá vốn = NULL), đồng bộ tổng header,
          kiểm tra hạn mức công nợ cộng dồn theo từng Ma_Dt.
        - Phase 2 (TRONG 1 transaction duy nhất): xác minh DmDt, sp_getapplock tuần tự theo kỳ,
          kiểm tra chống trùng Stt_PX đồng thời (UPDLOCK, HOLDLOCK), cấp khóa Stt/Stt0 1 round-trip,
          cấp số hóa đơn So_Ct liên tục không trùng (ST_Check_Number + tập đã cấp),
          ghi CtBH + CtBH0 + CtBH_Post + CtBH_SoCai + CtBH_SoCaiVT_Save + ST_Save_Number (strict),
          và Integrity Assertion hàng loạt trước COMMIT.
        """
        if not vouchers:
            raise BatchVoucherError(
                "Danh sách chứng từ xuất theo xe không được rỗng!",
                code="EMPTY_BATCH",
            )

        target_db = self.vp_db
        resolved_draft_ids: List[Optional[str]] = [
            draft_ids[i] if draft_ids and i < len(draft_ids) else None
            for i in range(len(vouchers))
        ]

        # ===== PHASE 1: PRE-VALIDATION (NGOÀI TRANSACTION ĐỂ RÚT NGẮN THỜI GIAN GIỮ LOCK) =====
        closing_cache: Dict[str, Optional[str]] = {}
        seen_stt_px_owner: Dict[str, int] = {}
        prepared: List[Dict[str, Any]] = []
        debt_check_customers: List[str] = []
        debt_check_seen = set()

        for idx, data in enumerate(vouchers):
            draft_id = resolved_draft_ids[idx]
            dvcs = (data.ma_dvcs or "S1").strip().upper() or "S1"
            clean_ma_ct = (data.ma_ct or "X1").strip().upper()
            is_return = clean_ma_ct == "N5"
            data.ma_dvcs = dvcs
            data.ma_ct = clean_ma_ct
            data.nh_ct = "1" if is_return else (data.nh_ct or "2")

            # CHỐT 1: Ngày khóa sổ
            if dvcs not in closing_cache:
                closing_cache[dvcs] = self.get_closing_date(dvcs)
            ngay_kt_ht = closing_cache[dvcs]
            if ngay_kt_ht and data.ngay_ct <= ngay_kt_ht:
                raise BatchVoucherError(
                    f"Phiếu #{idx + 1}: Ngày chứng từ ({data.ngay_ct}) nằm trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!",
                    code="CLOSING_DATE",
                    voucher_index=idx,
                    draft_id=draft_id,
                )

            # CHỐT 2: Trường bắt buộc
            clean_ma_dt = (data.ma_dt or "").strip().upper()
            if not clean_ma_dt:
                raise BatchVoucherError(
                    f"Phiếu #{idx + 1}: Mã khách hàng (Ma_Dt) là bắt buộc!",
                    code="VALIDATION_ERROR",
                    voucher_index=idx,
                    draft_id=draft_id,
                )
            data.ma_dt = clean_ma_dt
            if not data.ma_nx or not data.ma_nx.strip():
                data.ma_nx = "131"
            if not data.items or len(data.items) == 0:
                raise BatchVoucherError(
                    f"Phiếu #{idx + 1} ({clean_ma_dt}): Chứng từ phải có ít nhất 1 dòng hàng hóa!",
                    code="VALIDATION_ERROR",
                    voucher_index=idx,
                    draft_id=draft_id,
                )

            # Kiểm tra Stt_PX không bị 2 phiếu khác nhau cùng nhận trong cùng 1 batch
            voucher_stt_pxs = set()
            for it in data.items:
                raw_px = (it.stt_px or "").strip()
                if raw_px:
                    if len(raw_px) > 20:
                        raise BatchVoucherError(
                            f"Phiếu #{idx + 1} ({clean_ma_dt}): Mã đơn nguồn Stt_PX '{raw_px}' vượt quá 20 ký tự!",
                            code="VALIDATION_ERROR",
                            voucher_index=idx,
                            draft_id=draft_id,
                        )
                    it.stt_px = raw_px
                    voucher_stt_pxs.add(raw_px)
                else:
                    it.stt_px = None

            for px in voucher_stt_pxs:
                prev_idx = seen_stt_px_owner.get(px)
                if prev_idx is not None and prev_idx != idx:
                    raise BatchVoucherError(
                        f"Đơn nguồn '{px}' bị trùng giữa phiếu #{prev_idx + 1} và phiếu #{idx + 1} trong cùng lô xuất!",
                        code="DUPLICATE_STT_PX",
                        voucher_index=idx,
                        draft_id=draft_id,
                        conflict_order_keys=[px],
                    )
                seen_stt_px_owner[px] = idx

            # CHỐT 4, 5, 6: Chuẩn hóa dòng hàng (4 cột giá vốn = NULL) & tổng Header
            safe_ty_gia = float(data.ty_gia) if data.ty_gia and data.ty_gia > 0 else 1.0
            safe_ma_tte = (data.ma_tte or "VND").strip().upper()
            self._normalize_voucher_items(data, False, safe_ty_gia, safe_ma_tte, is_return=is_return)
            self._sync_header_totals(data, False)

            if not is_return and not getattr(data, "skip_debt_check", False):
                if clean_ma_dt not in debt_check_seen:
                    debt_check_seen.add(clean_ma_dt)
                    debt_check_customers.append(clean_ma_dt)

            prepared.append({
                "idx": idx,
                "draft_id": draft_id,
                "data": data,
                "dvcs": dvcs,
                "clean_ma_ct": clean_ma_ct,
                "is_return": is_return,
                "safe_ty_gia": safe_ty_gia,
            })

        # CHỐT 3: Kiểm tra hạn mức công nợ CỘNG DỒN theo từng khách hàng (khớp VFP 1S: check dư nợ trước phiếu >= giới hạn)
        if debt_check_customers:
            debt_repo = self._get_debt_repository()
            debt_summaries: Dict[str, Any] = {}
            for ma_dt in debt_check_customers:
                debt_summaries[ma_dt] = debt_repo.get_customer_debt_summary(ma_dt, check_only=True)

            running_added: Dict[str, float] = {}
            for entry in prepared:
                data = entry["data"]
                if entry["is_return"]:
                    continue
                ma_dt = data.ma_dt
                voucher_amount = float(data.ttien0 or 0.0)
                if not getattr(data, "skip_debt_check", False) and ma_dt in debt_summaries:
                    summary = debt_summaries[ma_dt]
                    raw_check = getattr(summary, "du_cuoi_kiem_tra", None)
                    base_debt = raw_check if isinstance(raw_check, (int, float)) else float(summary.du_cuoi or 0.0)
                    gioi_han = float(summary.gioi_han or 0.0)
                    du_cuoi_before = base_debt + running_added.get(ma_dt, 0.0)
                    if gioi_han > 0 and du_cuoi_before >= gioi_han:
                        raise BatchVoucherError(
                            f"Phiếu #{entry['idx'] + 1} - Khách hàng {ma_dt} vượt quá hạn mức nợ cho phép! "
                            f"(Dư nợ cộng dồn: {du_cuoi_before:,.0f} >= Giới hạn: {gioi_han:,.0f})",
                            code="DEBT_OVER_LIMIT",
                            voucher_index=entry["idx"],
                            draft_id=entry["draft_id"],
                            debt_info={
                                "ma_dt": ma_dt,
                                "du_cuoi_before": du_cuoi_before,
                                "voucher_amount": voucher_amount,
                                "gioi_han": gioi_han,
                            },
                        )
                running_added[ma_dt] = running_added.get(ma_dt, 0.0) + voucher_amount

        # ===== PHASE 2: SINGLE ACID TRANSACTION (ALL-OR-NOTHING) =====
        all_ma_dts = sorted({entry["data"].ma_dt for entry in prepared})
        all_stt_pxs = sorted(seen_stt_px_owner.keys())
        responses: List[VoucherSaveResponse] = []

        with self._get_db_transaction(target_db) as (conn, cur):
            # 1. Xác minh toàn bộ mã khách hàng tồn tại trong VTSYS.dbo.DmDt
            found_dts = set()
            for i in range(0, len(all_ma_dts), 500):
                chunk = all_ma_dts[i:i + 500]
                ph = ",".join(["?"] * len(chunk))
                cur.execute(
                    f"SELECT RTRIM(Ma_Dt) FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt IN ({ph})",
                    chunk,
                )
                for row in cur.fetchall() or []:
                    if row and row[0]:
                        found_dts.add(str(row[0]).strip().upper())

            missing_dts = [dt for dt in all_ma_dts if dt not in found_dts]
            if missing_dts:
                missing_dt = missing_dts[0]
                bad_entry = next(e for e in prepared if e["data"].ma_dt == missing_dt)
                raise BatchVoucherError(
                    f"Phiếu #{bad_entry['idx'] + 1}: Mã khách hàng '{missing_dt}' không tồn tại trong danh mục DmDt!",
                    code="CUSTOMER_NOT_FOUND",
                    voucher_index=bad_entry["idx"],
                    draft_id=bad_entry["draft_id"],
                )

            # 2. Acquire sp_getapplock tuần tự theo kỳ (chống deadlock & chống trùng số chứng từ)
            lock_resources = set()
            for entry in prepared:
                clean_ma_ct = entry["clean_ma_ct"]
                ngay_ct = entry["data"].ngay_ct
                if clean_ma_ct == "N5":
                    _, _, period = self._day_date_bounds(ngay_ct)
                else:
                    _, _, period = self._month_date_bounds(ngay_ct)
                entry["period"] = period
                lock_resources.add(f"web_vfp_soct:{target_db}:{clean_ma_ct}:{period}")

            for res_name in sorted(lock_resources):
                try:
                    cur.execute(
                        """
                        SET NOCOUNT ON;
                        DECLARE @rc int;
                        EXEC @rc = sp_getapplock @Resource=?, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                        IF @rc < 0
                            THROW 50001, 'Could not acquire voucher number lock (sp_getapplock timeout)', 1;
                        """,
                        [res_name],
                    )
                except Exception as e:
                    if "50001" in str(e) or "sp_getapplock timeout" in str(e):
                        raise BatchVoucherError(
                            "Hệ thống đang bận cấp số chứng từ cho máy khác, vui lòng thử xuất lại sau giây lát.",
                            code="LOCK_TIMEOUT",
                        ) from e
                    logger.warning(f"sp_getapplock batch warning ({res_name}): {e}")

            # 3. Chống xuất trùng Stt_PX đồng thời ngay trong transaction (UPDLOCK, HOLDLOCK)
            if all_stt_pxs:
                existing_pxs: List[str] = []
                for i in range(0, len(all_stt_pxs), 500):
                    chunk = all_stt_pxs[i:i + 500]
                    ph = ",".join(["?"] * len(chunk))
                    cur.execute(
                        f"SELECT DISTINCT RTRIM(Stt_PX) FROM {target_db}.dbo.CtBH0 WITH (UPDLOCK, HOLDLOCK) WHERE Stt_PX IN ({ph})",
                        chunk,
                    )
                    for row in cur.fetchall() or []:
                        if row and row[0]:
                            existing_pxs.append(str(row[0]).strip())
                if existing_pxs:
                    first_conflict = existing_pxs[0]
                    conflict_idx = seen_stt_px_owner.get(first_conflict)
                    conflict_draft = (
                        resolved_draft_ids[conflict_idx]
                        if conflict_idx is not None and conflict_idx < len(resolved_draft_ids)
                        else None
                    )
                    raise BatchVoucherError(
                        f"Phát hiện {len(existing_pxs)} đơn kho đã được xuất trước đó ({', '.join(existing_pxs[:5])}). "
                        "Toàn bộ lô xuất đã được hoàn tác — vui lòng tải lại dữ liệu xe.",
                        code="DUPLICATE_STT_PX",
                        voucher_index=conflict_idx,
                        draft_id=conflict_draft,
                        conflict_order_keys=existing_pxs,
                    )

            # 4. Cấp phát toàn bộ Stt (header) và Stt0 (detail) trong 1 round-trip mỗi Ma_DvCs
            key_counts_by_dvcs: Dict[str, int] = {}
            for entry in prepared:
                dvcs = entry["dvcs"]
                key_counts_by_dvcs[dvcs] = key_counts_by_dvcs.get(dvcs, 0) + 1 + len(entry["data"].items)

            key_pools: Dict[str, List[str]] = {
                dvcs: self.generate_stts_batch(dvcs, count, cur)
                for dvcs, count in key_counts_by_dvcs.items()
            }
            key_offsets: Dict[str, int] = {dvcs: 0 for dvcs in key_pools}

            # 5. Cấp số chứng từ So_Ct tuần tự không trùng & ghi từng phiếu
            last_so_ct_by_bucket: Dict[tuple, str] = {}
            allocated_so_ct: set = set()
            expected_integrity: Dict[str, tuple] = {}

            for entry in prepared:
                data: VoucherCreateRequest = entry["data"]
                dvcs = entry["dvcs"]
                clean_ma_ct = entry["clean_ma_ct"]
                period = entry["period"]
                bucket = (dvcs, clean_ma_ct, period)

                raw_so_ct = (data.so_ct or "").strip()
                is_custom_so_ct = bool(getattr(data, "custom_so_ct", False))
                if is_custom_so_ct and raw_so_ct:
                    candidate = raw_so_ct
                elif bucket in last_so_ct_by_bucket:
                    candidate = increment_voucher_number(last_so_ct_by_bucket[bucket])
                else:
                    candidate = self.get_next_voucher_number(
                        ma_dvcs=dvcs,
                        ma_ct=clean_ma_ct,
                        ngay_ct=data.ngay_ct,
                        cur=cur,
                        db_mode="sales",
                    )

                final_so_ct = candidate
                for _ in range(500):
                    cand_norm = final_so_ct.strip().upper()
                    if cand_norm not in allocated_so_ct:
                        is_dup = self._exec_check_number(
                            cur, target_db, dvcs, "M", "", clean_ma_ct, data.ngay_ct, final_so_ct
                        )
                        if not is_dup:
                            break
                    final_so_ct = increment_voucher_number(final_so_ct)

                allocated_so_ct.add(final_so_ct.strip().upper())
                if not (is_custom_so_ct and raw_so_ct):
                    last_so_ct_by_bucket[bucket] = final_so_ct
                data.so_ct = final_so_ct

                # Lấy Stt & danh sách Stt0 từ pool đã cấp sẵn
                offset = key_offsets[dvcs]
                stt = key_pools[dvcs][offset]
                n_items = len(data.items)
                stt0_slice = key_pools[dvcs][offset + 1:offset + 1 + n_items]
                key_offsets[dvcs] = offset + 1 + n_items

                self._write_header(cur, target_db, "M", stt, final_so_ct, data, entry["safe_ty_gia"], False, user_name)
                self._write_details(cur, target_db, "M", stt, data, False, preallocated_stt0s=stt0_slice)
                self._post_ledgers(
                    cur,
                    target_db,
                    "M",
                    stt,
                    final_so_ct,
                    data,
                    entry["safe_ty_gia"],
                    False,
                    user_name,
                    "sales",
                    strict=True,
                )

                expected_integrity[stt] = (
                    float(data.ttien_nt2 or 0.0),
                    n_items,
                    entry["idx"],
                    entry["draft_id"],
                )
                responses.append(
                    VoucherSaveResponse(
                        stt=stt,
                        so_ct=final_so_ct,
                        message="Lưu chứng từ thành công.",
                    )
                )

            # 6. Batch Integrity Assertion TRƯỚC COMMIT
            created_stts = list(expected_integrity.keys())
            db_totals: Dict[str, tuple] = {}
            for i in range(0, len(created_stts), 500):
                chunk = created_stts[i:i + 500]
                ph = ",".join(["?"] * len(chunk))
                cur.execute(
                    f"""
                    SELECT RTRIM(Stt), ISNULL(SUM(Tien_Nt2), 0), COUNT(1)
                    FROM {target_db}.dbo.CtBH0
                    WHERE Stt IN ({ph})
                    GROUP BY Stt
                    """,
                    chunk,
                )
                for row in cur.fetchall() or []:
                    if row and row[0]:
                        db_totals[str(row[0]).strip()] = (float(row[1] or 0.0), int(row[2] or 0))

            for stt, (exp_sum2, exp_count, idx, draft_id) in expected_integrity.items():
                actual = db_totals.get(stt)
                if actual is None:
                    raise AssertionError(
                        f"Phiếu #{idx + 1} ({stt}): Không tìm thấy dòng chi tiết trong CtBH0 trước khi COMMIT!"
                    )
                db_sum2, db_count = actual
                if abs(db_sum2 - exp_sum2) > 0.05:
                    raise AssertionError(
                        f"Phiếu #{idx + 1} ({stt}): Lệch tổng tiền Header/Detail: DB Tien_Nt2={db_sum2} vs Header={exp_sum2}"
                    )
                if db_count != exp_count:
                    raise AssertionError(
                        f"Phiếu #{idx + 1} ({stt}): Số dòng chi tiết không khớp: DB={db_count} vs Form={exp_count}"
                    )

        return responses

    def delete_voucher(
        self, stt: str, user_name: str = "KTCN3", db_mode: Optional[str] = "sales"
    ) -> VoucherDeleteResponse:
        """
        Delete voucher from VP_2014 or KH_2014 via CtBH_Delete SP with ACID transaction.
        Checks locked period and voucher existence.
        """
        if not stt or not stt.strip():
            raise ValueError("Mã chứng từ không được để trống!")
        clean_stt = stt.strip()
        target_db = self._get_target_db(db_mode)

        with self._get_db_transaction(target_db) as (conn, cur):
            cur.execute(
                f"SELECT Confirmed, Posted, Ngay_Ct FROM {target_db}.dbo.CtBH WITH (NOLOCK) WHERE Stt = ?",
                [clean_stt],
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Không tìm thấy chứng từ có mã {clean_stt}.")

            ngay_ct = row[2].strftime("%Y-%m-%d") if row[2] else ""
            ngay_kt_ht = self.get_closing_date()
            if ngay_kt_ht and ngay_ct and ngay_ct <= ngay_kt_ht:
                raise ValueError(f"Không thể xóa chứng từ trong kỳ đã khóa sổ (đến ngày {ngay_kt_ht})!")

            try:
                cur.execute(
                    f"SET NOCOUNT ON; EXEC {target_db}.dbo.CtBH_Delete @p_Stt=?, @p_UserName=?",
                    [clean_stt, user_name or "KTCN3"],
                )
            except Exception as e:
                logger.warning(f"CtBH_Delete SP warning, executing cascaded SQL delete: {e}")
                cur.execute(f"DELETE FROM {target_db}.dbo.SoCai WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {target_db}.dbo.SoCaiVT WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {target_db}.dbo.CtBH0 WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {target_db}.dbo.CtBH WHERE Stt = ?", [clean_stt])

        return VoucherDeleteResponse(stt=clean_stt, message="Xóa chứng từ thành công.")
