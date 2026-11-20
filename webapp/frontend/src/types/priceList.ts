export interface PriceListDetailItem {
  stt0?: string;
  stt?: string;
  ma_vt: string;
  ten_vt?: string;
  dvt?: string;
  gia: number;
  ck: number;
}

export interface PriceListHeader {
  stt: string;
  ma_dvcs: string;
  ngay_ct: string;
  so_ct: string;
  ma_dt: string;
  ten_dt?: string;
  ma_vm: string;
  ten_vm?: string;
  ma_tte: string;
  ty_gia: number;
  ngay_ct1?: string | null;
  ngay_ct2?: string | null;
  user_name: string;
  confirmed: boolean;
  closed: string;
  item_count: number;
}

export interface PriceListFullDetail extends PriceListHeader {
  items: PriceListDetailItem[];
}

export interface PriceListSavePayload {
  ma_dvcs?: string;
  ngay_ct: string;
  so_ct: string;
  ma_dt?: string;
  ma_vm?: string;
  ma_tte?: string;
  ty_gia?: number;
  ngay_ct1?: string | null;
  ngay_ct2?: string | null;
  closed?: string;
  user_name?: string;
  items: Array<{
    ma_vt: string;
    gia: number;
    ck: number;
  }>;
}

export interface PriceListImportNewItemPreview {
  ma_vt: string;
  ten_vt: string;
  dvt: string;
  gia: number;
  ck: number;
}

export interface PriceListImportNewGroupPreview {
  ngay_ct: string;
  so_ct: string;
  ma_dt: string;
  ten_dt: string;
  ma_vm: string;
  items: PriceListImportNewItemPreview[];
}

export interface PriceListImportNewPreviewResponse {
  total_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  groups_count: number;
  details_count: number;
  groups: PriceListImportNewGroupPreview[];
}

export interface PriceListUpdateItemPreview {
  ma_vt: string;
  ten_vt: string;
  dvt: string;
  gia: number;
  ck: number;
}

export interface PriceListImportUpdatePreviewResponse {
  total_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  unique_items: number;
  existing_updates_estimate: number;
  new_inserts_estimate: number;
  items: PriceListUpdateItemPreview[];
}

export interface PriceListDeleteItemsPreviewResponse {
  ma_vt_count: number;
  ma_vt_list: string[];
  affected_rows_estimate: number;
}

export interface PriceListExportRow {
  stt_id: string;
  so_ct: string;
  ngay_ct: string;
  ngay_ct2?: string | null;
  khu_vuc: string;
  doi_tuong: string;
  ten_doi_tuong: string;
  ma_vat_tu: string;
  ten_vat_tu: string;
  dvt: string;
  gia_ban: number;
  chiet_khau_phan_tram: number;
}

export interface PriceListPageResponse {
  items: PriceListHeader[];
  total_records: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PriceListItemsPageResponse {
  stt: string;
  total_count: number;
  filtered_count: number;
  offset: number;
  limit: number;
  has_more: boolean;
  items: PriceListDetailItem[];
}

