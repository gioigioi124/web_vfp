from typing import Optional, Tuple
from app.repositories.voucher_repo import voucher_repository
from app.schemas.voucher import (
    VoucherListResponse, VoucherDetailResponse,
    VoucherCreateRequest, VoucherUpdateRequest,
    VoucherSaveResponse, VoucherDeleteResponse,
    CheckNumberRequest, CheckNumberResponse
)

class VoucherService:
    def __init__(self):
        self.repo = voucher_repository

    def list_vouchers(
        self,
        ma_ct: Optional[str] = "X1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_bp: Optional[str] = None,
        ma_hd: Optional[str] = None,
        ma_nx: Optional[str] = None,
        ma_kho: Optional[str] = None,
        ma_vt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tk_du: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> VoucherListResponse:
        return self.repo.list_vouchers(
            ma_ct=ma_ct,
            ngay_ct1=ngay_ct1,
            ngay_ct2=ngay_ct2,
            so_ct1=so_ct1,
            so_ct2=so_ct2,
            ma_dt=ma_dt,
            ma_bp=ma_bp,
            ma_hd=ma_hd,
            ma_nx=ma_nx,
            ma_kho=ma_kho,
            ma_vt=ma_vt,
            ma_tte=ma_tte,
            tk=tk,
            tk_du=tk_du,
            tien_nt1=tien_nt1,
            tien_nt2=tien_nt2,
            filter_by_user=filter_by_user,
            page=page,
            page_size=page_size
        )

    def get_voucher(self, stt: str) -> Optional[VoucherDetailResponse]:
        return self.repo.get_voucher_detail(stt)

    def create_voucher(self, data: VoucherCreateRequest, user_name: str = "KTCN3") -> VoucherSaveResponse:
        """
        Create a new sales voucher (mode 'M') on VP_2014 with ACID transaction.
        """
        return self.repo.save_voucher(data, mode="M", user_name=user_name)

    def update_voucher(self, stt: str, data: VoucherUpdateRequest, user_name: str = "KTCN3") -> VoucherSaveResponse:
        """
        Update an existing sales voucher (mode 'S') on VP_2014 with ACID transaction.
        """
        return self.repo.save_voucher(data, mode="S", stt_override=stt, user_name=user_name)

    def delete_voucher(self, stt: str, user_name: str = "KTCN3") -> VoucherDeleteResponse:
        """
        Delete an existing voucher from VP_2014 via CtBH_Delete with ACID transaction.
        """
        return self.repo.delete_voucher(stt=stt, user_name=user_name)

    def get_next_number(self, ma_dvcs: str = "S1", ma_ct: str = "X1", ngay_ct: Optional[str] = None) -> str:
        """
        Get suggested next voucher number (e.g. HD1000 -> HD1001).
        """
        return self.repo.get_next_voucher_number(ma_dvcs=ma_dvcs, ma_ct=ma_ct, ngay_ct=ngay_ct)

    def check_number(self, req: CheckNumberRequest) -> CheckNumberResponse:
        """
        Check duplicate voucher number and auto-increment if duplicate.
        """
        is_dup, valid_so_ct = self.repo.check_duplicate_number(
            ma_dvcs=req.ma_dvcs or "S1",
            moi_sua=req.moi_sua or "M",
            stt=req.stt or "",
            ma_ct=req.ma_ct or "X1",
            ngay_ct=req.ngay_ct,
            so_ct=req.so_ct
        )
        msg = "Số chứng từ hợp lệ." if not is_dup else f"Số chứng từ đã trùng, tự động tăng thành {valid_so_ct}."
        return CheckNumberResponse(is_duplicate=is_dup, valid_so_ct=valid_so_ct, message=msg)

voucher_service = VoucherService()
