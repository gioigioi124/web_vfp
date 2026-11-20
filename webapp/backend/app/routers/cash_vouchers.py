import base64
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.config import settings
from app.repositories.cash_voucher_repo import cash_voucher_repository
from app.schemas.cash_voucher import (
    BaoCoImportCommitRequest,
    CashVoucherCreateRequest,
    CashVoucherUpdateRequest,
)

logger = logging.getLogger("app.routers.cash_vouchers")
router = APIRouter(prefix="/api/cash-vouchers", tags=["Cash & Bank Vouchers"])


def _safe_error_message(exc: Exception, fallback: str) -> str:
    return str(exc) if settings.DEBUG else fallback


class BaoCoPreviewUploadRequest(BaseModel):
    filename: str
    content_base64: str


@router.get("")
def list_cash_vouchers(
    ma_ct: Optional[str] = Query("C1", description="Mã chứng từ: C1 (PT), C2 (PC), C3 (BC), C4 (BN)"),
    ngay_ct1: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    ngay_ct2: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    so_ct1: Optional[str] = Query(None, description="Từ số chứng từ"),
    so_ct2: Optional[str] = Query(None, description="Đến số chứng từ"),
    ma_dt: Optional[str] = Query(None, description="Mã đối tượng"),
    ma_tte: Optional[str] = Query(None, description="Loại tiền tệ"),
    tk: Optional[str] = Query(None, description="Tài khoản Nợ/Có"),
    tien_nt1: Optional[float] = Query(None, description="Tổng tiền từ"),
    tien_nt2: Optional[float] = Query(None, description="Tổng tiền đến"),
    filter_by_user: Optional[str] = Query(None, description="Lọc theo người lập"),
    dien_giai: Optional[str] = Query(None, description="Tìm theo diễn giải"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    res = cash_voucher_repository.list_cash_vouchers(
        ma_ct=ma_ct,
        ngay_ct1=ngay_ct1,
        ngay_ct2=ngay_ct2,
        so_ct1=so_ct1,
        so_ct2=so_ct2,
        ma_dt=ma_dt,
        ma_tte=ma_tte,
        tk=tk,
        tien_nt1=tien_nt1,
        tien_nt2=tien_nt2,
        filter_by_user=filter_by_user,
        dien_giai=dien_giai,
        page=page,
        page_size=page_size,
    )
    return {
        "success": True,
        "data": {
            "items": [item.model_dump() for item in res.items],
            "pagination": res.pagination.model_dump(),
            "summary": res.summary.model_dump(),
        },
    }


@router.get("/next-number")
def get_next_cash_voucher_number(
    ma_dvcs: Optional[str] = Query("S1"),
    ma_ct: Optional[str] = Query("C1"),
    ngay_ct: Optional[str] = Query(None),
):
    next_so_ct = cash_voucher_repository.get_next_voucher_number(
        ma_dvcs=ma_dvcs or "S1",
        ma_ct=ma_ct or "C1",
        ngay_ct=ngay_ct,
    )
    return {"success": True, "data": {"so_ct": next_so_ct}}


@router.get("/ledger")
def get_cash_bank_ledger(
    tk: str = Query("11212", description="Tài khoản quỹ/ngân hàng (VD: 1111, 11212)"),
    ngay_bd: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    ngay_kt: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
):
    res = cash_voucher_repository.get_cash_ledger(tk=tk, ngay_bd=ngay_bd, ngay_kt=ngay_kt)
    return {"success": True, "data": res.model_dump()}


@router.post("/import-baoco/preview")
def preview_baoco_import(req: BaoCoPreviewUploadRequest):
    try:
        raw_b64 = req.content_base64.split(",", 1)[-1]
        content = base64.b64decode(raw_b64)
        res = cash_voucher_repository.preview_baoco_upload(req.filename, content)
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_PARSE_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in preview_baoco_import")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_PREVIEW_ERROR",
                "message": _safe_error_message(e, "Không thể đọc file Excel. Vui lòng kiểm tra định dạng."),
            },
        )


@router.post("/import-baoco/commit", status_code=status.HTTP_201_CREATED)
def commit_baoco_import(req: BaoCoImportCommitRequest):
    try:
        res = cash_voucher_repository.commit_baoco_import(req)
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMPORT_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in commit_baoco_import")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_COMMIT_ERROR",
                "message": _safe_error_message(e, "Lỗi ghi dữ liệu import (đã rollback toàn bộ)."),
            },
        )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_cash_voucher(req: CashVoucherCreateRequest):
    try:
        res = cash_voucher_repository.save_cash_voucher(
            data=req,
            mode="M",
            user_name=req.user_name or "KTCN3",
        )
        return {"success": True, "data": res.model_dump()}
    except (ValueError, AssertionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in create_cash_voucher")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi máy chủ khi lưu chứng từ thu chi."),
            },
        )


@router.get("/{stt}")
def get_cash_voucher_detail(stt: str):
    voucher = cash_voucher_repository.get_cash_voucher_detail(stt)
    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOUCHER_NOT_FOUND", "message": f"Không tìm thấy chứng từ có mã {stt}."},
        )
    return {"success": True, "data": voucher.model_dump()}


@router.put("/{stt}")
def update_cash_voucher(stt: str, req: CashVoucherUpdateRequest):
    try:
        res = cash_voucher_repository.save_cash_voucher(
            data=req,
            mode="S",
            stt_override=stt,
            user_name=req.user_name or "KTCN3",
        )
        return {"success": True, "data": res.model_dump()}
    except (ValueError, AssertionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in update_cash_voucher")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_SERVER_ERROR",
                "message": _safe_error_message(e, "Lỗi máy chủ khi cập nhật chứng từ thu chi."),
            },
        )


@router.delete("/{stt}")
def delete_cash_voucher(stt: str, user_name: Optional[str] = Query("KTCN3")):
    try:
        res = cash_voucher_repository.delete_cash_voucher(stt=stt, user_name=user_name or "KTCN3")
        return {"success": True, "data": res.model_dump()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DELETE_VALIDATION_ERROR", "message": str(e)},
        )
    except Exception as e:
        logger.exception("Unhandled error in delete_cash_voucher")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DELETE_ERROR",
                "message": _safe_error_message(e, "Lỗi máy chủ khi xóa chứng từ thu chi."),
            },
        )
