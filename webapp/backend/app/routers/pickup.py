from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.pickup_service import pickup_service
from app.schemas.pickup import PickupAcceptRequest

router = APIRouter(prefix="/api/pickup", tags=["Pickup"])

@router.get("/list", response_model=dict)
def list_pickup_slips(
    ma_dt: Optional[str] = Query(None, description="Mã khách hàng cần lấy phiếu xuất"),
    ngay_ct1: Optional[str] = Query(None, description="Từ ngày"),
    ngay_ct2: Optional[str] = Query(None, description="Đến ngày")
):
    """
    Danh sách phiếu xuất kho chưa lập hóa đơn từ CSDL KH_2014 (ListReadyToPickup / ctbhch.scx).
    100% READ-ONLY.
    """
    slips = pickup_service.list_ready_to_pickup(ma_dt=ma_dt, ngay_ct1=ngay_ct1, ngay_ct2=ngay_ct2)
    return {
        "success": True,
        "data": {
            "items": [s.model_dump() for s in slips]
        }
    }

@router.get("/detail/{stt}", response_model=dict)
def get_pickup_detail(stt: str):
    """
    Chi tiết các mặt hàng trên phiếu xuất kho từ CSDL KH_2014 (DetailViewToPickup).
    100% READ-ONLY.
    """
    detail = pickup_service.get_pickup_detail(stt)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PICKUP_NOT_FOUND", "message": f"Không tìm thấy phiếu xuất kho {stt}."}
        )
    return {
        "success": True,
        "data": detail.model_dump()
    }

@router.post("/accept", response_model=dict)
def accept_pickup_slips(req: PickupAcceptRequest):
    """
    Nhận các phiếu xuất kho đã chọn và trả về danh sách dòng hàng đã ánh xạ
    sang K_CtTemp (chi tiết chứng từ). 100% READ-ONLY — KHÔNG ghi CSDL.
    Tự động tra cứu giá bán, chiết khấu và tính toán theo Loại vật tư.
    """
    result = pickup_service.accept_pickup(
        stts=req.stts,
        ma_dt=req.ma_dt,
        ngay_ct=req.ngay_ct,
        ty_gia=req.ty_gia,
        ma_tte=req.ma_tte
    )
    return {
        "success": True,
        "data": result.model_dump()
    }

