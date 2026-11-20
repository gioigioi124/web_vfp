from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class PriceListDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt0: Optional[str] = None
    stt: Optional[str] = None
    ma_vt: str
    ten_vt: Optional[str] = ""
    dvt: Optional[str] = ""
    gia: float = 0.0
    ck: float = 0.0


class PriceListHeaderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stt: str
    ma_dvcs: str = "S1"
    ngay_ct: str
    so_ct: str = ""
    ma_dt: str = ""
    ten_dt: Optional[str] = ""
    ma_vm: str = ""
    ten_vm: Optional[str] = ""
    ma_tte: str = "VND"
    ty_gia: float = 1.0
    ngay_ct1: Optional[str] = None
    ngay_ct2: Optional[str] = None
    user_name: str = ""
    confirmed: bool = True
    closed: str = "0"
    item_count: int = 0


class PriceListDetailResponse(PriceListHeaderSchema):
    items: List[PriceListDetailSchema] = []


class PriceListPageResponse(BaseModel):
    items: List[PriceListHeaderSchema]
    total_records: int
    page: int
    page_size: int
    total_pages: int


class PriceListItemsPageResponse(BaseModel):
    stt: str
    total_count: int
    filtered_count: int
    offset: int
    limit: int
    has_more: bool
    items: List[PriceListDetailSchema]


class PriceListSaveItemInput(BaseModel):
    ma_vt: str
    gia: float = 0.0
    ck: float = 0.0


class PriceListSaveRequest(BaseModel):
    ma_dvcs: Optional[str] = "S1"
    ngay_ct: str
    so_ct: str
    ma_dt: Optional[str] = ""
    ma_vm: Optional[str] = ""
    ma_tte: Optional[str] = "VND"
    ty_gia: Optional[float] = 1.0
    ngay_ct1: Optional[str] = None
    ngay_ct2: Optional[str] = None
    closed: Optional[str] = "0"
    user_name: Optional[str] = "ADMIN"
    items: List[PriceListSaveItemInput]


class PriceListBulkDateRequest(BaseModel):
    stt_list: List[str]
    ngay_ct: str
    ngay_ct1: Optional[str] = None
    ngay_ct2: Optional[str] = None


class PriceListBulkCopyRequest(BaseModel):
    stt_list: List[str]
    ngay_ct: str
    user_name: Optional[str] = "ADMIN"


class PriceListImportNewItemPreview(BaseModel):
    ma_vt: str
    ten_vt: str = ""
    dvt: str = ""
    gia: float
    ck: float = 0.0


class PriceListImportNewGroupPreview(BaseModel):
    ngay_ct: str
    so_ct: str
    ma_dt: str = ""
    ten_dt: str = ""
    ma_vm: str = ""
    items: List[PriceListImportNewItemPreview]


class PriceListImportNewPreviewResponse(BaseModel):
    total_rows: int
    skipped_rows: int
    duplicate_rows: int
    groups_count: int
    details_count: int
    preview_token: Optional[str] = None
    truncated_preview: bool = False
    groups: List[PriceListImportNewGroupPreview]


class PriceListImportNewCommitRequest(BaseModel):
    user_name: Optional[str] = "ADMIN"
    preview_token: Optional[str] = None
    groups: List[PriceListImportNewGroupPreview] = []


class PriceListUpdateItemPreview(BaseModel):
    ma_vt: str
    ten_vt: str = ""
    dvt: str = ""
    gia: float
    ck: float = 0.0


class PriceListImportUpdatePreviewResponse(BaseModel):
    total_rows: int
    skipped_rows: int
    duplicate_rows: int
    unique_items: int
    existing_updates_estimate: int = 0
    new_inserts_estimate: int = 0
    preview_token: Optional[str] = None
    truncated_preview: bool = False
    items: List[PriceListUpdateItemPreview]


class PriceListImportUpdateCommitRequest(BaseModel):
    stt_list: List[str]
    preview_token: Optional[str] = None
    items: List[PriceListSaveItemInput] = []


class PriceListDeleteItemsPreviewResponse(BaseModel):
    ma_vt_count: int
    ma_vt_list: List[str]
    affected_rows_estimate: int = 0


class PriceListDeleteItemsCommitRequest(BaseModel):
    stt_list: List[str]
    ma_vt_list: List[str]


class PriceListExportRow(BaseModel):
    stt_id: str
    so_ct: str
    ngay_ct: str
    ngay_ct2: Optional[str] = None
    khu_vuc: str = ""
    doi_tuong: str = ""
    ten_doi_tuong: str = ""
    ma_vat_tu: str
    ten_vat_tu: str = ""
    dvt: str = ""
    gia_ban: float = 0.0
    chiet_khau_phan_tram: float = 0.0
