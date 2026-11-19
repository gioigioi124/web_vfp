import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response, status

from app.repositories.lookup_repo import lookup_repository

logger = logging.getLogger("app.routers.lookups")
router = APIRouter(prefix="/api/lookups", tags=["Lookups"])


def _handle_lookup_error(name: str, exc: Exception) -> HTTPException:
    logger.warning(f"Lookup error ({name}): {exc}")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "LOOKUP_UNAVAILABLE", "message": f"Không thể tải danh mục {name} từ SQL Server."},
    )


@router.get("/vat-tu")
def get_vat_tu(
    q: Optional[str] = Query(None, description="Mã hoặc tên vật tư"),
    limit: int = Query(200, ge=1, le=50000),
):
    try:
        items = lookup_repository.get_vat_tu(query=q, limit=limit)
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("vật tư", exc)


@router.get("/khach-hang")
def get_khach_hang(
    response: Response,
    q: Optional[str] = Query(None, description="Mã hoặc tên khách hàng"),
    limit: int = Query(200, ge=1, le=50000),
):
    try:
        data = lookup_repository.get_khach_hang_dicts(query=q, limit=limit)
        response.headers["Cache-Control"] = "private, max-age=60"
        return {"success": True, "data": data}
    except Exception as exc:
        raise _handle_lookup_error("khách hàng", exc)


@router.get("/kho")
def get_kho(response: Response):
    try:
        items = lookup_repository.get_kho()
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("kho", exc)


@router.get("/thue")
def get_thue(response: Response):
    try:
        items = lookup_repository.get_thue()
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("thuế", exc)


@router.get("/tai-khoan")
def get_tai_khoan(
    response: Response,
    q: Optional[str] = Query(None, description="Số tài khoản hoặc tên"),
):
    try:
        items = lookup_repository.get_tai_khoan(query=q)
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("tài khoản", exc)


@router.get("/nhap-xuat")
def get_nhap_xuat(response: Response):
    try:
        items = lookup_repository.get_nhap_xuat()
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("nhập xuất", exc)


@router.get("/xe")
def get_xe(
    response: Response,
    q: Optional[str] = Query(None, description="Mã xe hoặc biển số"),
):
    try:
        items = lookup_repository.get_xe(query=q)
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("xe", exc)


@router.get("/bo-phan")
def get_bo_phan(response: Response):
    try:
        items = lookup_repository.get_bo_phan()
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("bộ phận", exc)


@router.get("/hop-dong")
def get_hop_dong(
    response: Response,
    q: Optional[str] = Query(None, description="Mã hoặc tên hợp đồng"),
):
    try:
        items = lookup_repository.get_hop_dong(query=q)
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("hợp đồng", exc)


@router.get("/tien-te")
def get_tien_te(response: Response):
    try:
        items = lookup_repository.get_tien_te()
        response.headers["Cache-Control"] = "private, max-age=300"
        return {"success": True, "data": [item.model_dump() for item in items]}
    except Exception as exc:
        raise _handle_lookup_error("tiền tệ", exc)
