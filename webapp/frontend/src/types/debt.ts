export interface DebtSummary {
  ma_dt: string;
  ten_dt?: string;
  tk: string;
  du_no: number;
  du_co: number;
  du_no_nt: number;
  du_co_nt: number;
  du_cuoi: number;
  gioi_han: number;
  toi_han: number;
  is_over_limit: boolean;
  is_near_limit: boolean;
  status_message: string;
}

export interface DebtTransactionItem {
  ngay_ct: string;
  so_ct: string;
  dien_giai?: string;
  ps_no: number;
  ps_co: number;
  ps_no_nt: number;
  ps_co_nt: number;
}

export interface DebtDetailData {
  ma_dt: string;
  ten_dt?: string;
  stt?: string;
  so_ct?: string;
  ngay_ct?: string;
  tong_no: number;
  da_thanh_toan: number;
  con_lai: number;
  transactions: DebtTransactionItem[];
}
