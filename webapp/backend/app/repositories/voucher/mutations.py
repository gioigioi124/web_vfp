"""ACID mutation methods (save_voucher & delete_voucher) for VoucherRepository."""

import logging
import re
from typing import Any, Dict, List, Optional

from app.repositories.voucher.helpers import _DETAIL_INSERT_BATCH_SIZE
from app.schemas.voucher import (
    VoucherCreateRequest,
    VoucherDeleteResponse,
    VoucherSaveResponse,
)
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.repositories.voucher")


class VoucherMutationMixin:
    """Create, update, ledger posting, integrity assertion, and delete operations."""

    def _normalize_voucher_items(
        self,
        data: VoucherCreateRequest,
        is_wh: bool,
        safe_ty_gia: float,
        safe_ma_tte: str,
    ) -> None:
        """CHỐT 4 & 5: Chuẩn hóa dòng hàng, chiết khấu = 0 & hàng KM."""
        for it in data.items:
            loai_vt = (it.loai_vt or "1").strip()
            so_tam = float(it.so_tam or 0.0)
            he_so8 = float(it.he_so8 if it.he_so8 and it.he_so8 > 0 else 1.0)
            he_so9 = float(it.he_so9 if it.he_so9 and it.he_so9 > 0 else 1.0)
            so_luong9 = float(it.so_luong9 or 0.0)
            gia_nt9 = float(it.gia_nt9 or 0.0)
            chiet_khau = float(it.chiet_khau or 0.0)

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

                # Fix #21 (mở rộng): 4 cột GIÁ VỐN bên phiếu bán hàng LUÔN để NULL.
                it.gia_nt = None
                it.gia = None
                it.tien_nt = None
                it.tien = None

                # NULL-policy khớp VFP (Ma_Ct='X1'): chiết khấu 0 -> Chiet_Khau/Tien_Nt4/Tien4 = NULL
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
                stt, data.ma_dvcs or "S1", data.ma_ct or "X1", data.nh_ct or "2", data.ma_tte or "VND", safe_ty_gia,
                data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or ("xuất bán" if is_wh else ""), data.desc_en0 or None,
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
                data.ma_dvcs or "S1", data.ma_ct or "X1", data.nh_ct or "2", data.ma_tte or "VND", safe_ty_gia,
                data.ngay_ps or data.ngay_ct, data.ngay_ct, final_so_ct, data.ma_xe or None, data.ma_bp or "", data.ma_hd or None,
                data.ma_dt, data.ma_nx or "131", data.tk2 or "1311", None, None, None,
                data.ong_ba or "", data.dia_chi or "", data.dien_giai0 or ("xuất bán" if is_wh else ""), data.desc_en0 or None,
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
    ) -> None:
        """2. Ghi Detail dbo.CtBH0 (Delete cũ nếu 'S' + Batch cấp Stt0 & Multi-row INSERT)."""
        if mode == "S":
            cur.execute(f"DELETE FROM {target_db}.dbo.CtBH0 WHERE Stt = ?", [stt])

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
                    it.tk or ("6322" if is_wh else "632"),
                    it.tk_du or ("155" if is_wh else "1561"),
                    it.tk_du2 or ("5112" if is_wh else "5111"),
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
                    "C",
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
    ) -> None:
        """2b & 3. Xóa sổ cái cũ (nếu S), chạy CtBH_Post, CtBH_SoCai, CtBH_SoCaiVT_Save, ST_Save_Number."""
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
            if mode == "S":
                raise

        # 3b. Ghi SỔ CÁI TÀI KHOẢN (SoCai) — bút toán DOANH THU (chỉ ghi trên VP_2014):
        if not is_wh:
            revenue_groups: Dict[str, float] = {}
            for it in data.items:
                tk_co = (it.tk_du2 or "").strip()
                if not tk_co:
                    continue
                revenue_groups[tk_co] = revenue_groups.get(tk_co, 0.0) + float(it.tien_nt2 or 0.0)

            if revenue_groups:
                tk_no = (data.tk2 or "1311").strip() or "1311"
                safe_ccy = (data.ma_tte or "VND").strip().upper()
                fn = self.fn_tcvn
                for tk_co, group_amount_nt in revenue_groups.items():
                    amount_nt = round_amount(group_amount_nt, 2)
                    if abs(amount_nt) < 0.005:
                        continue
                    amount_vnd = float(round_vnd(amount_nt * safe_ty_gia))
                    tien_vnd = amount_vnd
                    tien_nt = None if safe_ccy == "VND" else amount_nt
                    so_ct_line = (final_so_ct or "").strip() or None
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
                            data.ma_dvcs or "S1", stt, stt, data.ma_ct or "X1", data.nh_ct or "2",
                            data.ngay_ct, so_ct_line, data.ma_dt,
                            tk_no, data.ma_dt, tk_co, "",
                            data.ma_tte or "VND", safe_ty_gia, data.ma_hd or None, data.ma_bp or None,
                            tien_nt, tien_vnd, "2",
                        ])
                    except Exception as e:
                        logger.warning(f"CtBH_SoCai warning: {e}")
                        if mode == "S":
                            raise

        try:
            cur.execute(f"SET NOCOUNT ON; EXEC {target_db}.dbo.CtBH_SoCaiVT_Save @p_Stt=?", [stt])
        except Exception as e:
            logger.warning(f"CtBH_SoCaiVT_Save ({db_mode}) warning: {e}")
            if mode == "S":
                raise
        try:
            cur.execute(
                f"SET NOCOUNT ON; EXEC {self.sys_db}.dbo.ST_Save_Number @p_Ma_DvCs=?, @p_Ma_Ct=?, @p_So_Ct=?",
                [data.ma_dvcs or "S1", data.ma_ct or "X1", final_so_ct],
            )
        except Exception as e:
            logger.warning(f"ST_Save_Number warning: {e}")

    def save_voucher(
        self,
        data: VoucherCreateRequest,
        mode: str = "M",
        stt_override: Optional[str] = None,
        user_name: str = "KTCN3",
        db_mode: Optional[str] = "sales",
    ) -> VoucherSaveResponse:
        """
        Save sales invoice (VP_2014) or warehouse slip (KH_2014) with Pre-Save checks & ACID transaction.
        """
        is_wh = self._is_warehouse(db_mode)
        target_db = self._get_target_db(db_mode)

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

        # ===== CHỐT 3: KIỂM TRA HẠN MỨC CÔNG NỢ REALTIME (CHỈ ÁP DỤNG CHO PHIẾU BÁN VP_2014) =====
        if not is_wh and not getattr(data, "skip_debt_check", False):
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
        self._normalize_voucher_items(data, is_wh, safe_ty_gia, safe_ma_tte)

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
                ma_ct=data.ma_ct or "X1",
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
            message="Lưu phiếu xuất kho thành công." if is_wh else "Lưu chứng từ thành công.",
        )

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
