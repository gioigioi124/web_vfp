from fastapi import APIRouter, Query, Request, Response

from app.services.customer_index_service import customer_index_service

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("/changes")
def get_customer_changes(
    request: Request,
    since: int = Query(0, description="Version client đang giữ (0 = tải toàn bộ)"),
    epoch_c: int = Query(0, description="Epoch client đang giữ (đổi khi server khởi động lại)"),
):
    """
    Trả về thay đổi danh mục khách hàng kể từ `since`.
    - Hỗ trợ ETag / 304 Not Modified khi client đã đồng bộ phiên bản mới nhất.
    - Trả thẳng bytes JSON/gzip đã nén sẵn (<1ms, không block asyncio event loop).
    """
    accept_encoding = request.headers.get("accept-encoding", "")
    accept_gzip = "gzip" in accept_encoding.lower()

    customer_index_service.ensure_loaded()
    etag = customer_index_service.get_etag()
    if_none_match = request.headers.get("if-none-match", "").strip()
    if (
        if_none_match
        and if_none_match == etag
        and since > 0
        and epoch_c == customer_index_service.epoch
    ):
        return Response(
            status_code=304,
            headers={"ETag": etag, "Cache-Control": "no-cache"},
        )

    body, is_gzipped, etag = customer_index_service.get_changes_response_bytes(
        since=since,
        epoch_c=epoch_c,
        accept_gzip=accept_gzip,
    )
    headers = {
        "ETag": etag,
        "Vary": "Accept-Encoding",
        "Cache-Control": "no-cache",
    }
    if is_gzipped:
        headers["Content-Encoding"] = "gzip"
    return Response(content=body, media_type="application/json", headers=headers)


@router.get("/search")
def search_customers(
    q: str = Query(..., description="Mã hoặc tên khách hàng"),
    limit: int = Query(30, ge=1, le=200),
):
    """Tìm khách hàng phía server dùng RAM index."""
    items = customer_index_service.search(q=q, limit=limit)
    return {"success": True, "data": items}


@router.get("/by-code/{ma_dt}")
def get_customer_by_code(ma_dt: str):
    """Tra chính xác một mã khách hàng (ưu tiên RAM index O(1), fallback SQL khi mới thêm)."""
    item = customer_index_service.get_by_code(ma_dt)
    return {"success": True, "data": item}
