from fastapi import APIRouter, Query

from app.schemas.price import PriceBatchRequest
from app.services.price_service import price_service

router = APIRouter(prefix="/api/prices", tags=["Prices"])


@router.get("/{ma_vt}", response_model=dict)
def get_price(
    ma_vt: str,
    ma_dt: str = Query("", description="Mã khách hàng (để chọn bảng giá theo khách/khu vực)"),
    ngay_ct: str = Query(..., description="Ngày hạch toán (YYYY-MM-DD)"),
):
    """
    Tra đơn giá bán & chiết khấu cho một mã vật tư từ bảng giá `VP_2014.dbo.BG`/`BG0`.
    Trả về `data = null` nếu không có bảng giá áp dụng.
    """
    item = price_service.get_price(ma_dt=ma_dt, ma_vt=ma_vt, ngay_ct=ngay_ct)
    return {"success": True, "data": item.model_dump() if item else None}


@router.post("/batch", response_model=dict)
def get_prices_batch(payload: PriceBatchRequest):
    """
    Tra giá cho nhiều mã vật tư trong một lượt (dùng khi đổ dòng hàng từ phiếu xuất).
    """
    result = price_service.get_prices_batch(
        ma_dt=payload.ma_dt,
        ma_vt_list=payload.ma_vt_list,
        ngay_ct=payload.ngay_ct,
    )
    return {"success": True, "data": result.model_dump()}
