from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.debt_service import debt_service

router = APIRouter(prefix="/api/debt", tags=["Debt"])

@router.get("/customer", response_model=dict)
def get_customer_debt(
    ma_dt: str = Query(..., description="Mã khách hàng cần kiểm tra công nợ"),
    tk: str = Query("131", description="Tài khoản công nợ (mặc định 131)"),
    stt: Optional[str] = Query("", description="Mã chứng từ cần loại trừ khi đang sửa phiếu"),
):
    """
    Tra cứu dư nợ realtime và hạn mức công nợ theo Fix #1, #2, #3.
    100% READ-ONLY.
    """
    debt_info = debt_service.get_customer_debt(ma_dt=ma_dt, tk=tk, stt=stt or "")
    return {
        "success": True,
        "data": debt_info.model_dump()
    }

@router.get("/detail/{stt}", response_model=dict)
def get_debt_detail(stt: str):
    """
    Chi tiết phát sinh công nợ và lịch sử thanh toán liên quan đến chứng từ.
    100% READ-ONLY.
    """
    detail = debt_service.get_voucher_debt_detail(stt)
    return {
        "success": True,
        "data": detail.model_dump()
    }

@router.get("/ledger", response_model=dict)
def get_customer_debt_ledger(
    ma_dt: Optional[str] = Query("", description="Mã khách hàng (bỏ trống trả bảng rỗng)"),
    ngay_bd: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD), mặc định đầu tháng hiện tại"),
    ngay_kt: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD), mặc định cuối tháng hiện tại"),
    tk: str = Query("131", description="Tài khoản công nợ (mặc định 131)"),
):
    """
    Sổ chi tiết công nợ phải thu theo khoảng ngày (Dư đầu kỳ, phát sinh trong kỳ, dư cuối kỳ).
    100% READ-ONLY.
    """
    ledger = debt_service.get_customer_debt_ledger(
        ma_dt=ma_dt or "",
        ngay_bd=ngay_bd,
        ngay_kt=ngay_kt,
        tk=tk or "131",
    )
    return {
        "success": True,
        "data": ledger.model_dump(),
    }
