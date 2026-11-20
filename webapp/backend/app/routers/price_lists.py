import base64
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.config import settings
from app.repositories.price_list_repo import price_list_repository
from app.schemas.price_list import (
    PriceListBulkCopyRequest,
    PriceListBulkDateRequest,
    PriceListDeleteItemsCommitRequest,
    PriceListImportNewCommitRequest,
    PriceListImportUpdateCommitRequest,
    PriceListSaveRequest,
)

logger = logging.getLogger("app.routers.price_lists")
router = APIRouter(prefix="/api/price-lists", tags=["Price Lists (BG/BG0)"])


def _safe_error_message(exc: Exception, fallback: str) -> str:
    return str(exc) if settings.DEBUG else fallback


class PriceListExcelPreviewRequest(BaseModel):
    filename: str
    content_base64: str
    stt_list: Optional[List[str]] = None


class PriceListExportRequest(BaseModel):
    stt_list: List[str]


@router.get("")
def list_price_lists(
    from_date: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    so_ct: Optional[str] = Query(None, description="Lọc theo Số CT"),
    ma_vm: Optional[str] = Query(None, description="Lọc theo Mã vùng"),
    ma_dt: Optional[str] = Query(None, description="Lọc theo Mã khách hàng"),
):
    items = price_list_repository.list_price_lists(
        from_date=from_date,
        to_date=to_date,
        so_ct=so_ct,
        ma_vm=ma_vm,
        ma_dt=ma_dt,
    )
    return {"success": True, "data": [it.model_dump() for it in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_price_list(req: PriceListSaveRequest):
    try:
        res = price_list_repository.save_price_list(req, mode="M")
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in create_price_list")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi khi tạo bảng giá."),
            },
        )


@router.post("/bulk-date")
def bulk_change_dates(req: PriceListBulkDateRequest):
    try:
        res = price_list_repository.change_dates(
            stt_list=req.stt_list,
            ngay_ct=req.ngay_ct,
            ngay_ct1=req.ngay_ct1,
            ngay_ct2=req.ngay_ct2,
        )
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in bulk_change_dates")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi khi đổi ngày bảng giá."),
            },
        )


@router.post("/bulk-copy", status_code=status.HTTP_201_CREATED)
def bulk_copy_price_lists(req: PriceListBulkCopyRequest):
    try:
        res = price_list_repository.copy_price_lists(
            stt_list=req.stt_list,
            ngay_ct=req.ngay_ct,
            user_name=req.user_name or "ADMIN",
        )
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in bulk_copy_price_lists")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi khi nhân bản bảng giá."),
            },
        )


@router.post("/import-new/preview")
def preview_import_new(req: PriceListExcelPreviewRequest):
    try:
        raw_b64 = req.content_base64.split(",", 1)[-1]
        content = base64.b64decode(raw_b64)
        res = price_list_repository.preview_import_new(req.filename, content)
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_PARSE_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in preview_import_new")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_PREVIEW_ERROR",
                "message": _safe_error_message(e, "Không thể đọc file Excel bảng giá."),
            },
        )


@router.post("/import-new/commit", status_code=status.HTTP_201_CREATED)
def commit_import_new(req: PriceListImportNewCommitRequest):
    try:
        res = price_list_repository.commit_import_new(req)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in commit_import_new")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_COMMIT_ERROR",
                "message": _safe_error_message(e, "Lỗi ghi dữ liệu import bảng giá (đã rollback)."),
            },
        )


@router.post("/import-update/preview")
def preview_import_update(req: PriceListExcelPreviewRequest):
    try:
        raw_b64 = req.content_base64.split(",", 1)[-1]
        content = base64.b64decode(raw_b64)
        res = price_list_repository.preview_import_update(
            req.filename, content, stt_list=req.stt_list
        )
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_PARSE_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in preview_import_update")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_PREVIEW_ERROR",
                "message": _safe_error_message(e, "Không thể đọc file Excel cập nhật giá."),
            },
        )


@router.post("/import-update/commit")
def commit_import_update(req: PriceListImportUpdateCommitRequest):
    try:
        res = price_list_repository.commit_import_update(req)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in commit_import_update")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_COMMIT_ERROR",
                "message": _safe_error_message(e, "Lỗi cập nhật bảng giá (đã rollback)."),
            },
        )


@router.post("/delete-items/preview")
def preview_delete_items(req: PriceListExcelPreviewRequest):
    try:
        raw_b64 = req.content_base64.split(",", 1)[-1]
        content = base64.b64decode(raw_b64)
        res = price_list_repository.preview_delete_items(
            req.filename, content, stt_list=req.stt_list
        )
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_PARSE_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in preview_delete_items")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_PREVIEW_ERROR",
                "message": _safe_error_message(e, "Không thể đọc file Excel danh sách mã xóa."),
            },
        )


@router.post("/delete-items/commit")
def commit_delete_items(req: PriceListDeleteItemsCommitRequest):
    try:
        res = price_list_repository.commit_delete_items(req)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DELETE_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in commit_delete_items")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DELETE_ERROR",
                "message": _safe_error_message(e, "Lỗi khi xóa hàng hóa khỏi bảng giá (đã rollback)."),
            },
        )


@router.post("/export")
def export_price_lists(req: PriceListExportRequest):
    rows = price_list_repository.export_price_lists(req.stt_list)
    return {"success": True, "data": [r.model_dump() for r in rows]}


@router.get("/{stt}")
def get_price_list_detail(stt: str):
    detail = price_list_repository.get_price_list_detail(stt)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PRICE_LIST_NOT_FOUND", "message": f"Không tìm thấy bảng giá {stt}."},
        )
    return {"success": True, "data": detail.model_dump()}


@router.put("/{stt}")
def update_price_list(stt: str, req: PriceListSaveRequest):
    try:
        res = price_list_repository.save_price_list(req, mode="S", stt_override=stt)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in update_price_list")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi khi cập nhật bảng giá."),
            },
        )


@router.delete("/{stt}")
def delete_price_list(stt: str):
    try:
        res = price_list_repository.delete_price_list(stt)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DELETE_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in delete_price_list")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DELETE_ERROR",
                "message": _safe_error_message(e, "Lỗi khi xóa bảng giá."),
            },
        )
