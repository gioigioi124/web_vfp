from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.debt_service import debt_service

router = APIRouter(prefix="/api/debt", tags=["Debt"])

@router.get("/customer", response_model=dict)
def get_customer_debt(
    ma_dt: str = Query(..., description="Mã khách hàng cần kiểm tra công nợ"),
    tk: str = Query("131", description="Tài khoản công nợ (mặc định 131)")
):
    """
    Tra cứu dư nợ realtime và hạn mức công nợ theo Fix #1, #2, #3.
    100% READ-ONLY.
    """
    debt_info = debt_service.get_customer_debt(ma_dt=ma_dt, tk=tk)
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
