from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.repositories.module_voucher_repo import module_voucher_repository
from app.schemas.module_voucher import (
    GlLedgerResponse,
    ModuleVoucherDetailResponse,
    ModuleVoucherPageResponse,
    ModuleVoucherSaveRequest,
    PartnerBalancePageResponse,
    PartnerLedgerResponse,
    TrialBalanceResponse,
)

router = APIRouter(tags=["General Modules"])

VALID_MODULE_KEYS = {"purchase", "inv-io", "inv-transfer", "gl-voucher"}


def _ensure_module_key(module_key: str) -> str:
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown accounting module key: {module_key}",
        )
    return module_key


@router.get(
    "/api/modules/{module_key}/vouchers",
    response_model=ModuleVoucherPageResponse,
)
def list_module_vouchers(
    module_key: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    _ensure_module_key(module_key)
    return module_voucher_repository.list_vouchers(
        module_key=module_key,
        from_date=from_date,
        to_date=to_date,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/api/modules/{module_key}/vouchers/{stt}",
    response_model=ModuleVoucherDetailResponse,
)
def get_module_voucher(module_key: str, stt: str):
    _ensure_module_key(module_key)
    res = module_voucher_repository.get_voucher(module_key=module_key, stt=stt)
    if res is None:
        raise HTTPException(status_code=404, detail=f"Voucher {stt} not found")
    return res


@router.post(
    "/api/modules/{module_key}/vouchers",
    response_model=ModuleVoucherDetailResponse,
)
def create_module_voucher(module_key: str, req: ModuleVoucherSaveRequest):
    _ensure_module_key(module_key)
    try:
        return module_voucher_repository.save_voucher(module_key=module_key, req=req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/api/modules/{module_key}/vouchers/{stt}",
    response_model=ModuleVoucherDetailResponse,
)
def update_module_voucher(
    module_key: str, stt: str, req: ModuleVoucherSaveRequest
):
    _ensure_module_key(module_key)
    try:
        return module_voucher_repository.save_voucher(
            module_key=module_key, req=req, stt_override=stt
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/api/modules/{module_key}/vouchers/{stt}")
def delete_module_voucher(module_key: str, stt: str):
    _ensure_module_key(module_key)
    return module_voucher_repository.delete_voucher(module_key=module_key, stt=stt)


@router.get(
    "/api/accounting/partner-balances",
    response_model=PartnerBalancePageResponse,
)
def get_partner_balances(
    tk_prefix: str = Query("131", min_length=1, max_length=20),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    return module_voucher_repository.get_partner_balances(
        tk_prefix=tk_prefix,
        from_date=from_date,
        to_date=to_date,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/api/accounting/partner-ledger",
    response_model=PartnerLedgerResponse,
)
def get_partner_ledger(
    tk_prefix: str = Query("131", min_length=1, max_length=20),
    ma_dt: str = Query(..., min_length=1),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    return module_voucher_repository.get_partner_ledger(
        tk_prefix=tk_prefix,
        ma_dt=ma_dt,
        from_date=from_date,
        to_date=to_date,
    )


@router.get(
    "/api/accounting/trial-balance",
    response_model=TrialBalanceResponse,
)
def get_trial_balance(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    return module_voucher_repository.get_trial_balance(
        from_date=from_date,
        to_date=to_date,
        q=q,
    )


@router.get(
    "/api/accounting/gl-ledger",
    response_model=GlLedgerResponse,
)
def get_gl_ledger(
    tk: str = Query("1111", min_length=1),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    return module_voucher_repository.get_gl_ledger(
        tk=tk,
        from_date=from_date,
        to_date=to_date,
        q=q,
    )
