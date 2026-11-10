from typing import List, Optional
from fastapi import APIRouter, Query
from app.repositories.lookup_repo import lookup_repository
from app.schemas.lookup import (
    VatTuLookup, KhachHangLookup, KhoLookup, ThueLookup,
    TaiKhoanLookup, NhapXuatLookup, XeLookup, BoPhanLookup,
    HopDongLookup, TienTeLookup
)

router = APIRouter(prefix="/api/lookups", tags=["Lookups"])

@router.get("/vat-tu", response_model=dict)
def get_vat_tu(
    q: Optional[str] = Query(None, description="Mã hoặc tên vật tư"),
    limit: int = Query(200, ge=1, le=50000),
):
    items = lookup_repository.get_vat_tu(query=q, limit=limit)
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/khach-hang", response_model=dict)
def get_khach_hang(
    q: Optional[str] = Query(None, description="Mã hoặc tên khách hàng"),
    limit: int = Query(200, ge=1, le=50000),
):
    items = lookup_repository.get_khach_hang(query=q, limit=limit)
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/kho", response_model=dict)
def get_kho():
    items = lookup_repository.get_kho()
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/thue", response_model=dict)
def get_thue():
    items = lookup_repository.get_thue()
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/tai-khoan", response_model=dict)
def get_tai_khoan(q: Optional[str] = Query(None, description="Số tài khoản hoặc tên")):
    items = lookup_repository.get_tai_khoan(query=q)
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/nhap-xuat", response_model=dict)
def get_nhap_xuat():
    items = lookup_repository.get_nhap_xuat()
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/xe", response_model=dict)
def get_xe(q: Optional[str] = Query(None, description="Mã xe hoặc biển số")):
    items = lookup_repository.get_xe(query=q)
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/bo-phan", response_model=dict)
def get_bo_phan():
    items = lookup_repository.get_bo_phan()
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/hop-dong", response_model=dict)
def get_hop_dong(q: Optional[str] = Query(None, description="Mã hoặc tên hợp đồng")):
    items = lookup_repository.get_hop_dong(query=q)
    return {"success": True, "data": [item.model_dump() for item in items]}

@router.get("/tien-te", response_model=dict)
def get_tien_te():
    items = lookup_repository.get_tien_te()
    return {"success": True, "data": [item.model_dump() for item in items]}
