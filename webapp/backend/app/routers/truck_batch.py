"""FastAPI router for Truck Batch Export (Xuất nhanh cả xe hàng)."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings
from app.repositories.voucher.mutations import BatchVoucherError
from app.schemas.truck_batch import (
    TruckBatchCommitRequest,
    TruckCustomerDebtRequest,
    TruckRepriceRequest,
)
from app.services.truck_batch_service import truck_batch_service

logger = logging.getLogger("app.routers.truck_batch")
router = APIRouter(prefix="/api/truck-batch", tags=["Truck Batch Export"])


def _safe_error(exc: Exception, fallback: str) -> str:
    return str(exc) if settings.DEBUG else fallback


@router.get("/trips")
def list_truck_trips(
    ngay_tu: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    ngay_den: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    ma_xe: Optional[str] = Query(None, description="Lọc theo mã xe"),
    adapter: Optional[str] = Query(None, description="Adapter nguồn: mock | kh2014 | sql"),
    limit: int = Query(50, ge=1, le=200),
):
    try:
        trips = truck_batch_service.list_trips(
            ngay_tu=ngay_tu,
            ngay_den=ngay_den,
            ma_xe=ma_xe,
            adapter_name=adapter,
            limit=limit,
        )
        return {
            "success": True,
            "data": {
                "adapter": (adapter or settings.TRUCK_SOURCE_ADAPTER or "mock").strip().lower(),
                "trips": [t.model_dump() for t in trips],
            },
        }
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"code": "ADAPTER_NOT_CONFIGURED", "message": str(e)},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ADAPTER", "message": str(e)},
        )


@router.get("/trips/{trip_id}/stage")
def stage_truck_trip(
    trip_id: str,
    ngay_ct: Optional[str] = Query(None, description="Ngày chứng từ dự kiến (YYYY-MM-DD)"),
    adapter: Optional[str] = Query(None, description="Adapter nguồn: mock | kh2014 | sql"),
):
    try:
        staged = truck_batch_service.stage_trip(
            trip_id=trip_id,
            ngay_ct=ngay_ct,
            adapter_name=adapter,
        )
        if staged is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "TRIP_NOT_FOUND", "message": f"Không tìm thấy chuyến xe '{trip_id}'."},
            )
        return {
            "success": True,
            "data": staged.model_dump(),
        }
    except HTTPException:
        raise
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"code": "ADAPTER_NOT_CONFIGURED", "message": str(e)},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "STAGE_ERROR", "message": str(e)},
        )


@router.post("/commit", status_code=status.HTTP_201_CREATED)
def commit_truck_batch(req: TruckBatchCommitRequest):
    """
    Xuất toàn bộ các phiếu đã chọn của chuyến xe trong 1 Transaction duy nhất (All-or-Nothing).
    """
    try:
        result = truck_batch_service.commit_batch(req)
        return {
            "success": True,
            "data": result.model_dump(),
        }
    except BatchVoucherError as e:
        http_status = (
            status.HTTP_409_CONFLICT
            if e.code == "DUPLICATE_STT_PX"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=http_status,
            detail={
                "code": e.code,
                "message": str(e),
                "voucher_index": e.voucher_index,
                "draft_id": e.draft_id,
                "conflict_order_keys": e.conflict_order_keys,
                "debt_info": e.debt_info,
            },
        )
    except (ValueError, AssertionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in commit_truck_batch")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error(e, "Lỗi máy chủ khi xuất lô chứng từ theo xe. Toàn bộ giao dịch đã được hoàn tác."),
            },
        )


@router.post("/customer-debt")
def lookup_customer_debt(
    req: TruckCustomerDebtRequest,
    adapter: Optional[str] = Query(None, description="Adapter nguồn hiện tại"),
):
    """Tra cứu nhanh công nợ & hạn mức khi đổi khách hàng ngay trên Master Grid."""
    summary = truck_batch_service.lookup_customer_debt(req.ma_dt, adapter_name=adapter)
    return {
        "success": True,
        "data": summary.model_dump(),
    }


@router.post("/reprice")
def reprice_for_customer(req: TruckRepriceRequest):
    """Nút phụ: chỉ nạp lại bảng giá khi kế toán chủ động bấm sau khi đổi khách."""
    price_map = truck_batch_service.reprice_for_customer(
        ma_dt=req.ma_dt,
        ngay_ct=req.ngay_ct,
        ma_vt_list=req.ma_vt_list,
    )
    return {
        "success": True,
        "data": {
            "prices": price_map,
        },
    }
