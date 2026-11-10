from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.voucher_service import voucher_service
from app.services.calc_service import calc_service
from app.schemas.calc import CalcRequest
from app.schemas.voucher import (
    VoucherListResponse, VoucherDetailResponse,
    VoucherCreateRequest, VoucherUpdateRequest,
    CheckNumberRequest
)

router = APIRouter(prefix="/api/vouchers", tags=["Vouchers"])

@router.get("", response_model=dict)
def list_vouchers(
    ma_ct: Optional[str] = Query("X1", description="Mã loại chứng từ (mặc định X1)"),
    ngay_ct1: Optional[str] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    ngay_ct2: Optional[str] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    so_ct1: Optional[str] = Query(None, description="Từ số chứng từ"),
    so_ct2: Optional[str] = Query(None, description="Đến số chứng từ"),
    ma_dt: Optional[str] = Query(None, description="Mã khách hàng"),
    ma_bp: Optional[str] = Query(None, description="Mã bộ phận"),
    ma_hd: Optional[str] = Query(None, description="Mã hợp đồng"),
    ma_nx: Optional[str] = Query(None, description="Mã nhập xuất"),
    ma_kho: Optional[str] = Query(None, description="Mã kho xuất"),
    ma_vt: Optional[str] = Query(None, description="Mã vật tư trong chi tiết"),
    ma_tte: Optional[str] = Query(None, description="Loại tiền tệ"),
    tk: Optional[str] = Query(None, description="Tài khoản (Tk2/Tk3)"),
    tk_du: Optional[str] = Query(None, description="Tài khoản đối ứng (Tk_Du3)"),
    tien_nt1: Optional[float] = Query(None, description="Tổng tiền từ"),
    tien_nt2: Optional[float] = Query(None, description="Tổng tiền đến"),
    filter_by_user: Optional[str] = Query(None, description="Lọc theo người lập"),
    page: int = Query(1, ge=1, description="Trang hiện tại"),
    page_size: int = Query(50, ge=1, le=500, description="Kích thước trang")
):
    """
    Danh sách chứng từ bán hàng (ctbhh).
    Hỗ trợ lọc đa tiêu chí, phân trang và dòng tổng cộng.
    """
    res = voucher_service.list_vouchers(
        ma_ct=ma_ct,
        ngay_ct1=ngay_ct1,
        ngay_ct2=ngay_ct2,
        so_ct1=so_ct1,
        so_ct2=so_ct2,
        ma_dt=ma_dt,
        ma_bp=ma_bp,
        ma_hd=ma_hd,
        ma_nx=ma_nx,
        ma_kho=ma_kho,
        ma_vt=ma_vt,
        ma_tte=ma_tte,
        tk=tk,
        tk_du=tk_du,
        tien_nt1=tien_nt1,
        tien_nt2=tien_nt2,
        filter_by_user=filter_by_user,
        page=page,
        page_size=page_size
    )
    return {
        "success": True,
        "data": {
            "items": [item.model_dump() for item in res.items],
            "pagination": res.pagination.model_dump(),
            "summary": res.summary.model_dump()
        }
    }

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_voucher(req: VoucherCreateRequest):
    """
    Tạo mới chứng từ bán hàng (mode = 'M') vào VP_2014 với ACID transaction.
    """
    try:
        res = voucher_service.create_voucher(req, user_name=req.user_name or "KTCN3")
        return {
            "success": True,
            "data": res.model_dump()
        }
    except (ValueError, AssertionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_SERVER_ERROR", "message": str(e)}
        )

@router.get("/next-number", response_model=dict)
def get_next_voucher_number(
    ma_dvcs: Optional[str] = Query("S1", description="Mã đơn vị cơ sở"),
    ma_ct: Optional[str] = Query("X1", description="Mã chứng từ"),
    ngay_ct: Optional[str] = Query(None, description="Ngày chứng từ (YYYY-MM-DD)")
):
    """
    Lấy số chứng từ tự động tiếp theo (ví dụ: lớn nhất là HD1000 -> trả về HD1001).
    """
    next_so_ct = voucher_service.get_next_number(
        ma_dvcs=ma_dvcs or "S1",
        ma_ct=ma_ct or "X1",
        ngay_ct=ngay_ct
    )
    return {
        "success": True,
        "data": {
            "so_ct": next_so_ct
        }
    }

@router.post("/check-number", response_model=dict)
def check_voucher_number(req: CheckNumberRequest):
    """
    Kiểm tra trùng số chứng từ (ST_Check_Number) và tự tăng nếu trùng.
    """
    try:
        res = voucher_service.check_number(req)
        return {
            "success": True,
            "data": res.model_dump()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CHECK_NUMBER_ERROR", "message": str(e)}
        )

@router.post("/calc", response_model=dict)
def calculate_voucher(req: CalcRequest):
    """
    Mô phỏng tính toán nghiệp vụ (Calc_Loai2, chiết khấu dòng/tổng, thuế VAT).
    Tuyệt đối KHÔNG ghi dữ liệu vào CSDL.
    """
    res = calc_service.calculate_voucher(req)
    return {
        "success": True,
        "data": res.model_dump()
    }

@router.get("/{stt}", response_model=dict)
def get_voucher_detail(stt: str):
    """
    Chi tiết 1 chứng từ bán hàng (ctbhd).
    Trả về toàn bộ 46 cột Header và mảng các dòng với 35 cột Detail.
    """
    voucher = voucher_service.get_voucher(stt)
    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOUCHER_NOT_FOUND", "message": f"Không tìm thấy chứng từ có mã {stt}."}
        )
    return {
        "success": True,
        "data": voucher.model_dump()
    }

@router.put("/{stt}", response_model=dict)
def update_voucher(stt: str, req: VoucherUpdateRequest):
    """
    Sửa chứng từ bán hàng (mode = 'S') trên VP_2014 với ACID transaction.
    """
    try:
        res = voucher_service.update_voucher(stt=stt, data=req, user_name=req.user_name or "KTCN3")
        return {
            "success": True,
            "data": res.model_dump()
        }
    except (ValueError, AssertionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_SERVER_ERROR", "message": str(e)}
        )

@router.delete("/{stt}", response_model=dict)
def delete_voucher(stt: str, user_name: Optional[str] = Query("KTCN3")):
    """
    Xóa chứng từ trên VP_2014 qua CtBH_Delete với ACID transaction.
    """
    try:
        res = voucher_service.delete_voucher(stt=stt, user_name=user_name or "KTCN3")
        return {
            "success": True,
            "data": res.model_dump()
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DELETE_VALIDATION_ERROR", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DELETE_ERROR", "message": str(e)}
        )
