import logging
from typing import Dict, List, Optional
from app.repositories.pickup_repo import pickup_repository
from app.repositories.price_repo import price_repository
from app.schemas.pickup import (
    PickupSlipSchema, PickupDetailResponse,
    PickupAcceptRow, PickupAcceptResponse,
)
from app.utils.money import round_amount, round_vnd

logger = logging.getLogger("app.services.pickup")


class PickupService:
    def __init__(self):
        self.repo = pickup_repository
        self.price_repo = price_repository

    def list_ready_to_pickup(
        self,
        ma_dt: Optional[str] = None,
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None
    ) -> List[PickupSlipSchema]:
        return self.repo.list_ready_to_pickup(ma_dt=ma_dt, ngay_ct1=ngay_ct1, ngay_ct2=ngay_ct2)

    def get_pickup_detail(self, stt: str) -> Optional[PickupDetailResponse]:
        return self.repo.get_pickup_detail(stt=stt)

    def accept_pickup(
        self,
        stts: List[str],
        ma_dt: Optional[str] = None,
        ngay_ct: Optional[str] = None,
        ty_gia: Optional[float] = 1.0,
        ma_tte: Optional[str] = "VND"
    ) -> PickupAcceptResponse:
        """
        Accept warehouse slips and transform items into detail rows for K_CtTemp.
        - Batches KH_2014 header/detail reads onto 1 connection (eliminates 2*M N+1).
        - Batches price & discount lookup from VP_2014.dbo.BG/BG0 in 1 query (eliminates 2*N N+1).
        - Preserves each distinct row per slip (no grouping).
        - Assigns stt_px = slip.stt (Header Stt of KH_2014.dbo.CtBH).
        - Inherits vehicle code (ma_xe) from warehouse slips.
        100% READ-ONLY: purely computes and returns rows, never writes to DB.
        """
        safe_ty_gia = float(ty_gia) if ty_gia and ty_gia > 0 else 1.0
        safe_ma_tte = (ma_tte or "VND").strip().upper()
        inherited_ma_xe = ""

        clean_stts = [s.strip() for s in (stts or []) if s and s.strip()]
        if not clean_stts:
            return PickupAcceptResponse(rows=[], total_rows=0, ma_xe="")

        # 1. Batch-fetch all headers and detail rows in 1 connection.
        headers_by_stt, items_by_stt = self.repo.get_pickup_slips_batch(clean_stts)

        # Collect ordered (stt, item) pairs and unique ma_vt codes for single batch price lookup.
        ordered_items = []
        unique_codes: List[str] = []
        seen_codes = set()

        for clean_stt in clean_stts:
            if not inherited_ma_xe:
                slip_hdr = headers_by_stt.get(clean_stt)
                if slip_hdr and slip_hdr.get("ma_xe"):
                    inherited_ma_xe = slip_hdr["ma_xe"]

            slip_items = items_by_stt.get(clean_stt) or []
            for it in slip_items:
                ordered_items.append((clean_stt, it))
                code = (it.ma_vt or "").strip().upper()
                if code and code not in seen_codes:
                    seen_codes.add(code)
                    unique_codes.append(code)

        # 2. Single batched price & discount lookup from BG/BG0.
        price_map: Dict[str, dict] = {}
        if ma_dt and ngay_ct and unique_codes:
            try:
                price_map = self.price_repo.get_prices_batch(
                    ma_dt=ma_dt,
                    ma_vt_list=unique_codes,
                    ngay_ct=ngay_ct,
                )
            except Exception as e:
                logger.warning(f"Batch price lookup failed in accept_pickup: {e}")

        rows: List[PickupAcceptRow] = []

        for clean_stt, it in ordered_items:
            loai_vt = (it.loai_vt or "1").strip()
            so_tam = float(it.so_tam or 0.0)
            he_so8 = float(it.he_so8 if it.he_so8 and it.he_so8 > 0 else 1.0)
            he_so9 = 1.0
            so_luong9 = float(it.so_luong9 or 0.0)

            # 1. Determine sales quantity based on loai_vt
            #    Loai_Vt '2' (Mút xốp) và '4' dùng cùng quy cách So_Tam * He_So8
            if loai_vt in ("2", "4"):
                so_luong_ban = round_amount(so_tam * he_so8, 2)
                so_luong8 = so_luong_ban
                so_luong9 = so_luong_ban
                so_luong = so_luong_ban
            elif loai_vt == "1":
                so_luong8 = 0.0
                so_luong_ban = so_luong9
                so_luong = round_amount(so_luong9 * he_so9, 2)
            else:
                so_luong8 = 0.0
                so_luong_ban = so_luong9
                so_luong = so_luong9

            # 2. Look up selling price and discount from batched BG/BG0 result
            gia_nt9 = 0.0
            chiet_khau = 0.0
            code = (it.ma_vt or "").strip().upper()
            picked_price = price_map.get(code)
            if picked_price is not None:
                gia_nt9 = float(picked_price.get("gia") or 0.0)
                chiet_khau = float(picked_price.get("chiet_khau") or 0.0)

            # Fix #17: If VND and promotional price 1 to 10 VND, discount is forced to 0
            if safe_ma_tte == "VND" and 1 <= gia_nt9 <= 10:
                chiet_khau = 0.0

            # 3. Calculate forward amount
            tien_nt9 = round_amount(so_luong_ban * gia_nt9, 2)
            gia9 = float(round_vnd(gia_nt9 * safe_ty_gia))
            tien9 = float(round_vnd(tien_nt9 * safe_ty_gia))

            # 4. Calculate discount amount
            if chiet_khau > 0:
                tien_nt4 = round_amount(tien_nt9 * chiet_khau / 100.0, 2)
                tien4 = float(round_vnd(tien9 * chiet_khau / 100.0))
                tien_nt2 = round_amount(tien_nt9 - tien_nt4, 2)
                tien2 = float(round_vnd(tien9 - tien4))
                gia_nt2 = round_amount(gia_nt9 * (100.0 - chiet_khau) / 100.0, 2)
                gia2 = float(round_vnd(gia9 * (100.0 - chiet_khau) / 100.0))
            else:
                tien_nt4 = 0.0
                tien4 = 0.0
                tien_nt2 = tien_nt9
                tien2 = tien9
                gia_nt2 = gia_nt9
                gia2 = gia9

            rows.append(PickupAcceptRow(
                stt_px=clean_stt,
                stt0_px=it.stt0,
                stt0=None,
                stt=None,
                tk=it.tk_gv or "632",
                tk_du=it.tk_vt or "1561",
                tk_du2=it.tk_dt or "5111",
                tk_du4=it.tk_ck or "521",
                ma_kho=it.ma_kho or "",
                ma_vt=it.ma_vt,
                ten_vt=it.ten_vt or "",
                dvt=it.dvt or "",
                dvt_ban=it.dvt_ban or it.dvt or "",
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
                gia_nt=0.0,
                gia=0.0,
                tien_nt=0.0,
                tien=0.0,
                gia_nt2=gia_nt2,
                gia2=gia2,
                tien_nt2=tien_nt2,
                tien2=tien2,
                tien_nt3=0.0,
                tien3=0.0,
                chiet_khau=chiet_khau,
                tien_nt4=tien_nt4,
                tien4=tien4,
                gia_tb_tt="C",
                loai_vt=loai_vt
            ))

        return PickupAcceptResponse(rows=rows, total_rows=len(rows), ma_xe=inherited_ma_xe)


pickup_service = PickupService()
