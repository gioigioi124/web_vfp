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

export interface DebtLedgerEntry {
  stt?: string;
  ma_ct: string;
  ngay_ct: string;
  so_ct: string;
  dien_giai: string;
  ps_tang: number;
  ps_giam: number;
}

export interface DebtLedgerData {
  ma_dt: string;
  ten_dt?: string;
  tk: string;
  ngay_bd: string;
  ngay_kt: string;
  du_dau: number;
  du_dau_tang: number;
  du_dau_giam: number;
  tong_ps_tang: number;
  tong_ps_giam: number;
  du_cuoi: number;
  du_cuoi_tang: number;
  du_cuoi_giam: number;
  entries: DebtLedgerEntry[];
}
