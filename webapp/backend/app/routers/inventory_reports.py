from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query

from app.repositories.inventory_report_repo import inventory_report_repository
from app.schemas.inventory_report import InventorySummaryResponse, StockCardResponse

router = APIRouter(prefix="/api/inventory/reports", tags=["Inventory Reports"])


@router.get("/summary", response_model=InventorySummaryResponse)
def get_inventory_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    ma_kho: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    include_zero: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    return inventory_report_repository.get_inventory_summary(
        from_date=from_date,
        to_date=to_date,
        ma_kho=ma_kho,
        q=q,
        include_zero=include_zero,
        page=page,
        page_size=page_size,
    )


@router.get("/card", response_model=StockCardResponse)
def get_stock_card(
    ma_vt: str = Query(..., min_length=1),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    ma_kho: Optional[str] = Query(None),
):
    return inventory_report_repository.get_stock_card(
        ma_vt=ma_vt,
        from_date=from_date,
        to_date=to_date,
        ma_kho=ma_kho,
    )
