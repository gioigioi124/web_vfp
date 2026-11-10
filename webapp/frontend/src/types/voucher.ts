export interface VoucherDetail {
  stt_px?: string | null;
  stt0?: string;
  stt?: string;
  tk?: string;
  tk_du?: string;
  tk_du2?: string;
  tk_du4?: string;
  ma_kho?: string;
  ma_vt?: string;
  dvt?: string;
  dvt_ban?: string;
  so_tam?: number;
  he_so8?: number;
  so_luong8?: number;
  he_so9?: number;
  so_luong9?: number;
  gia_nt9?: number;
  gia9?: number;
  tien_nt9?: number;
  tien9?: number;
  so_luong?: number;
  gia_nt?: number;
  gia?: number;
  tien_nt?: number;
  tien?: number;
  gia_nt2?: number;
  gia2?: number;
  tien_nt2?: number;
  tien2?: number;
  tien_nt3?: number;
  tien3?: number;
  chiet_khau?: number;
  tien_nt4?: number;
  tien4?: number;
  gia_tb_tt?: string;

  // Joined display fields
  ten_vt?: string;
  ten_kho?: string;
  loai_vt?: string;
}

export interface VoucherHeader {
  stt: string;
  ma_dvcs: string;
  ma_ct: string;
  nh_ct: string;
  ma_tte: string;
  ty_gia: number;
  ngay_ps?: string | null;
  ngay_ct: string;
  so_ct?: string;
  ma_xe?: string;
  ma_bp?: string;
  ma_hd?: string;
  ma_dt: string;
  ma_nx?: string;
  tk2?: string;
  tk3?: string;
  tk_du3?: string;
  tk4?: string;
  ong_ba?: string;
  dia_chi?: string;
  dien_giai0?: string;
  desc_en0?: string;
  ttien_nt?: number;
  ttien_nt0?: number;
  ttien_nt2?: number;
  ttien_nt3?: number;
  ttien_nt4?: number;
  ttien?: number;
  ttien0?: number;
  ttien3?: number;
  ttien2?: number;
  ttien4?: number;
  loai_ck?: string;
  tyle_ck?: number;
  han_tt?: number;
  ma_thue?: string;
  thue_gtgt?: number;
  ma_dtgtgt?: string;
  ten_dtgtgt?: string;
  so_ct0?: string;
  ngay_ct0?: string | null;
  stt_hbtl?: string;
  confirmed?: boolean;
  posted?: boolean;
  printed?: boolean;
  user_name?: string;

  // Joined display fields
  ten_dt?: string;
  ten_xe?: string;
  ten_bp?: string;
  ten_nx?: string;
  ten_tk2?: string;
  ten_hd?: string;
}

export interface VoucherFullDetail extends VoucherHeader {
  items: VoucherDetail[];
}

export interface VoucherPagination {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  has_next: boolean;
}

export interface VoucherSummaryTotals {
  total_ttien_nt: number;
  total_ttien_nt2: number;
  total_ttien_nt3: number;
  total_ttien_nt4: number;
  total_ttien_nt0: number;
  total_ttien: number;
  total_ttien2: number;
  total_ttien3: number;
  total_ttien4: number;
  total_ttien0: number;
}

export interface VoucherListResponseData {
  items: VoucherHeader[];
  pagination: VoucherPagination;
  summary: VoucherSummaryTotals;
}

export interface VoucherFilterParams {
  ma_ct?: string;
  ngay_ct1?: string;
  ngay_ct2?: string;
  so_ct1?: string;
  so_ct2?: string;
  ma_dt?: string;
  ma_kho?: string;
  ma_vt?: string;
  ma_tte?: string;
  page?: number;
  page_size?: number;
}
