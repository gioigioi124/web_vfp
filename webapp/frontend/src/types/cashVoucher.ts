export type CashMaCt = "C1" | "C2" | "C3" | "C4";

export interface CashVoucherDetail {
  stt0?: string;
  stt?: string;
  stt_nv?: number;
  tien_nt: number;
  tien: number;
  tien_nt3?: number;
  tien3?: number;
  ma_dt?: string;
  ma_hd?: string;
  ma_bp?: string;
  ma_km?: string;
  ma_sp?: string;
  tk_no: string;
  tk_co: string;
  tk_no3?: string;
  tk_co3?: string;
  dien_giai?: string;
  desc_en?: string;
  ma_thue?: string;
  thue_gtgt?: number;
  ma_dtgtgt?: string;
  ten_dtgtgt?: string;
  ngay_ct0?: string | null;
  so_ct0?: string;
  so_seri0?: string;
  loai_vat?: string;
  dieu_chinh?: string;

  // Joined display fields
  ten_dt?: string;
  ten_tk_no?: string;
  ten_tk_co?: string;
  ten_bp?: string;
  ten_hd?: string;
}

export interface CashVoucherHeader {
  stt: string;
  ma_dvcs: string;
  ma_ct: CashMaCt;
  kieu_ct?: string;
  nh_ct: "1" | "2" | string;
  ngay_ct: string;
  so_ct?: string;
  so_seri?: string;
  ma_tte: string;
  ty_gia: number;
  ma_dt0?: string;
  ong_ba?: string;
  dia_chi?: string;
  dien_giai0?: string;
  desc_en0?: string;
  ttien_nt?: number;
  ttien?: number;
  ttien_nt3?: number;
  ttien3?: number;
  ttien_nt0?: number;
  ttien0?: number;
  han_tt?: number;
  ct_di_kem?: string;
  so_ct0?: string;
  ngay_ct0?: string | null;
  user_name?: string;
  posted?: boolean;
  confirmed?: boolean;
  printed?: boolean;

  // Joined / summary fields
  ten_dt0?: string;
  tk_chinh?: string;
  tk_doi_ung?: string;
}

export interface CashVoucherFullDetail extends CashVoucherHeader {
  items: CashVoucherDetail[];
}

export interface CashVoucherSummaryTotals {
  total_ttien_nt: number;
  total_ttien: number;
  total_ttien_nt3: number;
  total_ttien3: number;
  total_ttien_nt0: number;
  total_ttien0: number;
}

export interface CashVoucherFilterParams {
  ma_ct?: string;
  ngay_ct1?: string;
  ngay_ct2?: string;
  so_ct1?: string;
  so_ct2?: string;
  ma_dt?: string;
  ma_tte?: string;
  tk?: string;
  dien_giai?: string;
  page?: number;
  page_size?: number;
}

export interface CashLedgerEntry {
  stt: string;
  ma_ct: string;
  ngay_ct: string;
  so_ct: string;
  ma_dt: string;
  ten_dt: string;
  dien_giai: string;
  tk_doi_ung: string;
  ps_thu: number;
  ps_chi: number;
  luy_ke: number;
}

export interface CashLedgerResponse {
  tk: string;
  ten_tk: string;
  ngay_bd: string;
  ngay_kt: string;
  du_dau: number;
  tong_thu: number;
  tong_chi: number;
  du_cuoi: number;
  entries: CashLedgerEntry[];
}

export interface BaoCoImportRowPreview {
  row_index: number;
  ten_tk: string;
  so_tk: string;
  noi_dung: string;
  so_tien: number;
  ngay_ct: string;
  ma_dt: string;
  ten_dt: string;
  dia_chi: string;
  valid: boolean;
  error?: string | null;
}

export interface BaoCoImportPreviewResponse {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: BaoCoImportRowPreview[];
}
