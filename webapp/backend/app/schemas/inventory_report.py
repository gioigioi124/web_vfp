from typing import List
from pydantic import BaseModel


class InventorySummaryRow(BaseModel):
    ma_kho: str
    ten_kho: str = ""
    ma_vt: str
    ten_vt: str = ""
    dvt: str = ""
    ton_dau: float = 0.0
    tien_dau: float = 0.0
    sl_nhap: float = 0.0
    tien_nhap: float = 0.0
    sl_xuat: float = 0.0
    tien_xuat: float = 0.0
    ton_cuoi: float = 0.0
    tien_cuoi: float = 0.0


class InventorySummaryResponse(BaseModel):
    from_date: str
    to_date: str
    ma_kho: str = ""
    items: List[InventorySummaryRow] = []
    total_records: int = 0
    page: int = 1
    page_size: int = 100
    total_pages: int = 1
    sum_ton_dau: float = 0.0
    sum_tien_dau: float = 0.0
    sum_sl_nhap: float = 0.0
    sum_tien_nhap: float = 0.0
    sum_sl_xuat: float = 0.0
    sum_tien_xuat: float = 0.0
    sum_ton_cuoi: float = 0.0
    sum_tien_cuoi: float = 0.0


class StockCardEntry(BaseModel):
    stt: str = ""
    stt0: str = ""
    ngay_ct: str
    ma_ct: str
    so_ct: str
    ma_dt: str = ""
    ten_dt: str = ""
    dien_giai: str = ""
    ma_kho: str = ""
    ma_kho_n: str = ""
    sl_nhap: float = 0.0
    tien_nhap: float = 0.0
    sl_xuat: float = 0.0
    tien_xuat: float = 0.0
    don_gia: float = 0.0
    ton_luy_ke: float = 0.0
    tien_luy_ke: float = 0.0


class StockCardResponse(BaseModel):
    from_date: str
    to_date: str
    ma_vt: str
    ten_vt: str = ""
    dvt: str = ""
    ma_kho: str = ""
    ten_kho: str = ""
    ton_dau: float = 0.0
    tien_dau: float = 0.0
    sum_sl_nhap: float = 0.0
    sum_tien_nhap: float = 0.0
    sum_sl_xuat: float = 0.0
    sum_tien_xuat: float = 0.0
    ton_cuoi: float = 0.0
    tien_cuoi: float = 0.0
    entries: List[StockCardEntry] = []
