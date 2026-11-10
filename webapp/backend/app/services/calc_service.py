from typing import List, Tuple
from app.schemas.calc import (
    CalcItemInput, CalcItemOutput, CalcHeaderOutput,
    CalcRequest, CalcResponse
)
from app.utils.money import round_amount, round_vnd

class CalcService:
    @staticmethod
    def calculate_voucher(req: CalcRequest) -> CalcResponse:
        """
        Executes genuine business logic calculation for 1S Sales Vouchers without writing to DB.
        Implements Calc_Loai2, line/header discount, invariant TTien_Nt0 = TTien_Nt2 + TTien_Nt3,
        USD currency trap protection, and zero-division safeguards.
        """
        ty_gia = float(req.ty_gia) if req.ty_gia and req.ty_gia > 0 else 1.0
        thue_gtgt = float(req.thue_gtgt or 0.0)
        loai_ck = req.loai_ck if req.loai_ck in ["0", "1", "2"] else "2"
        ma_tte = (req.ma_tte or "VND").strip().upper()

        warnings: List[str] = []
        calc_items: List[CalcItemOutput] = []

        # Step 1: Process each line item
        for idx, item in enumerate(req.items, start=1):
            loai_vt = (item.loai_vt or "1").strip()
            so_tam = float(item.so_tam or 0.0)
            he_so8 = float(item.he_so8 if item.he_so8 and item.he_so8 > 0 else 1.0)
            he_so9 = float(item.he_so9 if item.he_so9 and item.he_so9 > 0 else 1.0)
            so_luong9 = float(item.so_luong9 or 0.0)
            gia_nt9 = float(item.gia_nt9 or 0.0)
            tien_nt9 = float(item.tien_nt9 or 0.0)
            chiet_khau = float(item.chiet_khau or 0.0)
            var_read = (item.var_read or "").strip().upper()

            # Fix #17: If VND and promotional price 1 to 10 VND, discount forced to 0
            if ma_tte == "VND" and 1 <= gia_nt9 <= 10:
                chiet_khau = 0.0

            # 1.1 Category specific quantity calculation
            #     Loai_Vt '2' (Mút xốp) và '4' dùng cùng quy cách So_Tam * He_So8
            if loai_vt in ("2", "4"):
                # Calc_Loai2 (Mút xốp / hàng Loai_Vt='4')
                so_luong_ban = round_amount(so_tam * he_so8, 2)
                so_luong8 = so_luong_ban
                so_luong9 = so_luong_ban
                so_luong = so_luong_ban  # Inventory deduction
            elif loai_vt == "1":
                # Standard item
                so_luong8 = 0.0
                so_luong = round_amount(so_luong9 * he_so9, 2)
                so_luong_ban = so_luong9
            else:
                # Type 3
                so_luong8 = 0.0
                so_luong = so_luong9
                so_luong_ban = so_luong9

            # 1.2 Price and Amount forward/reverse calculation
            if var_read == "TIEN_NT9":
                if so_luong_ban > 0:
                    gia_nt9 = round_amount(tien_nt9 / so_luong_ban, 2)
                else:
                    gia_nt9 = 0.0
                    warnings.append(f"Dòng {idx}: Số lượng bằng 0 khi nhập thành tiền, không thể tính đơn giá.")
            else:
                tien_nt9 = round_amount(so_luong_ban * gia_nt9, 2)

            # Local VND currency conversion
            gia9 = float(round_vnd(gia_nt9 * ty_gia))
            tien9 = float(round_vnd(tien_nt9 * ty_gia))

            # 1.3 Line Discount calculation
            if chiet_khau > 0:
                tien_nt4 = round_amount(tien_nt9 * chiet_khau / 100.0, 2)
                tien4 = float(round_vnd(tien9 * chiet_khau / 100.0))
                tien_nt2 = round_amount(tien_nt9 - tien_nt4, 2)
                tien2 = float(round_vnd(tien9 - tien4))
                gia_nt2 = round_amount(gia_nt9 * (100.0 - chiet_khau) / 100.0, 2)
                gia2 = float(round_vnd(gia9 * (100.0 - chiet_khau) / 100.0))
            else:
                # Fix #5, #17, #21: Normalized reset when discount is 0
                tien_nt4 = 0.0
                tien4 = 0.0
                tien_nt2 = tien_nt9
                tien2 = tien9
                gia_nt2 = gia_nt9
                gia2 = gia9

            # Fix #21: NEVER overwrite gia_nt, gia, tien_nt, tien
            calc_items.append(CalcItemOutput(
                stt0=item.stt0,
                ma_vt=item.ma_vt,
                ten_vt=item.ten_vt,
                dvt=item.dvt,
                dvt_ban=item.dvt_ban,
                loai_vt=loai_vt,
                so_tam=so_tam,
                he_so8=he_so8,
                so_luong8=so_luong8,
                he_so9=he_so9,
                so_luong9=so_luong9,
                so_luong=so_luong,
                gia_nt9=gia_nt9,
                gia9=gia9,
                tien_nt9=tien_nt9,
                tien9=tien9,
                chiet_khau=chiet_khau,
                tien_nt4=tien_nt4,
                tien4=tien4,
                tien_nt2=tien_nt2,
                tien2=tien2,
                gia_nt2=gia_nt2,
                gia2=gia2,
                tk_du2=item.tk_du2 or "5111",
                gia_tb_tt=item.gia_tb_tt or "K"
            ))

        # Step 2: Handle manual header discount allocation if requested (TTien_Nt4_manual)
        if req.ttien_nt4_manual is not None and req.ttien_nt4_manual > 0 and calc_items:
            manual_discount = round_amount(req.ttien_nt4_manual, 2)
            total_pre_discount = sum(item.tien_nt9 for item in calc_items)
            if total_pre_discount > 0:
                allocated_sum = 0.0
                max_item_idx = 0
                max_val = -1.0

                for i, it in enumerate(calc_items):
                    ratio = it.tien_nt9 / total_pre_discount
                    it_discount = round_amount(manual_discount * ratio, 2)
                    it.tien_nt4 = it_discount
                    it.tien4 = float(round_vnd(it_discount * ty_gia))
                    it.tien_nt2 = round_amount(it.tien_nt9 - it.tien_nt4, 2)
                    it.tien2 = float(round_vnd(it.tien9 - it.tien4))
                    if it.so_luong9 > 0:
                        it.gia_nt2 = round_amount(it.tien_nt2 / it.so_luong9, 2)
                        it.gia2 = float(round_vnd(it.gia_nt2 * ty_gia))
                    allocated_sum += it_discount

                    if it.tien_nt9 > max_val:
                        max_val = it.tien_nt9
                        max_item_idx = i

                # Adjust penny remainder to line with largest amount
                remainder = round_amount(manual_discount - allocated_sum, 2)
                if abs(remainder) > 0:
                    target = calc_items[max_item_idx]
                    target.tien_nt4 = round_amount(target.tien_nt4 + remainder, 2)
                    target.tien4 = float(round_vnd(target.tien_nt4 * ty_gia))
                    target.tien_nt2 = round_amount(target.tien_nt9 - target.tien_nt4, 2)
                    target.tien2 = float(round_vnd(target.tien9 - target.tien4))
                    if target.so_luong9 > 0:
                        target.gia_nt2 = round_amount(target.tien_nt2 / target.so_luong9, 2)
                        target.gia2 = float(round_vnd(target.gia_nt2 * ty_gia))

        # Step 3: Compute Header Totals
        # INVARIANT: VND header totals MUST sum directly from details, not multiply total by ty_gia!
        ttien_nt = round_amount(sum(item.tien_nt9 for item in calc_items), 2)
        ttien_nt4 = round_amount(sum(item.tien_nt4 for item in calc_items), 2)
        ttien_nt2 = round_amount(sum(item.tien_nt2 for item in calc_items), 2)

        ttien = float(sum(round_vnd(item.tien9) for item in calc_items))
        ttien4 = float(sum(round_vnd(item.tien4) for item in calc_items))
        ttien2 = float(sum(round_vnd(item.tien2) for item in calc_items))

        # Step 4: VAT Calculation
        if loai_ck == "1":
            # Discount before tax: VAT calculated on ttien_nt2
            ttien_nt3 = round_amount(ttien_nt2 * thue_gtgt / 100.0, 2)
        else:
            # Discount after tax: VAT calculated on ttien_nt
            ttien_nt3 = round_amount(ttien_nt * thue_gtgt / 100.0, 2)

        ttien3 = float(round_vnd(ttien_nt3 * ty_gia))

        # Step 5: ULTIMATE INVARIANT: TTien_Nt0 = TTien_Nt2 + TTien_Nt3
        ttien_nt0 = round_amount(ttien_nt2 + ttien_nt3, 2)
        ttien0 = float(round_vnd(ttien2 + ttien3))

        header_out = CalcHeaderOutput(
            ma_tte=ma_tte,
            ty_gia=ty_gia,
            thue_gtgt=thue_gtgt,
            loai_ck=loai_ck,
            ttien_nt=ttien_nt,
            ttien_nt4=ttien_nt4,
            ttien_nt2=ttien_nt2,
            ttien_nt3=ttien_nt3,
            ttien_nt0=ttien_nt0,
            ttien=ttien,
            ttien4=ttien4,
            ttien2=ttien2,
            ttien3=ttien3,
            ttien0=ttien0
        )

        return CalcResponse(header=header_out, items=calc_items, warnings=warnings)

calc_service = CalcService()
