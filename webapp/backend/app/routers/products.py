from fastapi import APIRouter, Query

from app.services.product_index_service import product_index_service

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("/changes", response_model=dict)
def get_product_changes(
    since: int = Query(0, description="Version client đang giữ (0 = tải toàn bộ)"),
    epoch_c: int = Query(0, description="Epoch client đang giữ (đổi khi server khởi động lại)"),
):
    """
    Trả về thay đổi danh mục vật tư kể từ `since`.
    `full=True` -> client phải thay toàn bộ index; ngược lại chỉ áp delta.
    """
    data = product_index_service.get_changes(since=since, epoch_c=epoch_c)
    return {"success": True, "data": data}


@router.get("/search", response_model=dict)
def search_products(
    q: str = Query(..., description="Mã hoặc tên vật tư"),
    limit: int = Query(30, ge=1, le=200),
):
    """Tìm vật tư phía server (phương án dự phòng khi client chưa tải xong index)."""
    items = product_index_service.search(q=q, limit=limit)
    return {"success": True, "data": items}


@router.get("/by-code/{ma_vt}", response_model=dict)
def get_product_by_code(ma_vt: str):
    """Tra chính xác một mã vật tư (hàng mới chưa kịp có trong index)."""
    item = product_index_service.get_by_code(ma_vt)
    return {"success": True, "data": item}
