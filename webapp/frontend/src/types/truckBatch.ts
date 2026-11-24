import { DebtSummary } from "./debt";
import { VoucherDetail } from "./voucher";

export type TruckSourceAdapterName = "mock" | "kh2014" | "sql";

export interface TruckTripSummary {
  trip_id: string;
  trip_date: string;
  ma_xe: string;
  ten_xe: string;
  driver_name: string;
  note: string;
  source_adapter: string;
  total_approved_orders: number;
  exported_orders: number;
  pending_orders: number;
  total_customers: number;
}

export interface TruckSourceOrderRef {
  source_order_key: string;
  order_code: string;
  order_date: string;
  ma_kho: string;
  group_note: string;
  item_count: number;
  total_qty: number;
}

export interface TruckDraftItem extends VoucherDetail {
  source_order_key?: string;
  source_order_code?: string;
  source_group_note?: string;
  is_gift?: boolean;
}

export interface TruckDraftVoucher {
  draft_id: string;
  ma_ct: string;
  ngay_ct: string;
  ma_xe: string;
  ten_xe: string;
  ma_dt: string;
  ten_dt: string;
  ong_ba: string;
  dia_chi: string;
  ma_bp: string;
  han_tt: number;
  ma_nx: string;
  tk2: string;
  ma_tte: string;
  ty_gia: number;
  dien_giai0: string;
  normalized_group_note: string;
  source_orders: TruckSourceOrderRef[];
  items: TruckDraftItem[];
  ttien_nt9: number;
  ttien_nt4: number;
  ttien_nt2: number;
  ttien_nt0: number;
  ttien0: number;
  skip_debt_check: boolean;

  // UI-only staging flags
  selected: boolean;
  userEditedDiaChi?: boolean;
  customerSwapped?: boolean;
  errorMsg?: string | null;
}

export interface TruckStagePayload {
  trip: TruckTripSummary;
  ngay_ct: string;
  vouchers: Omit<TruckDraftVoucher, "selected">[];
  customer_debts: Record<string, DebtSummary & { du_cuoi_kiem_tra?: number }>;
  already_exported_order_keys: string[];
  total_pending_orders: number;
  total_exported_orders: number;
}

export interface CumulativeDebtStatus {
  maDt: string;
  baseDebt: number;
  addedBefore: number;
  duCuoiBefore: number;
  voucherAmount: number;
  duCuoiAfter: number;
  gioiHan: number;
  toiHan: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  willExceedAfter: boolean;
}

export interface TruckBatchCreatedItem {
  stt: string;
  so_ct: string;
  message: string;
  draft_id?: string | null;
  ma_dt: string;
  ten_dt: string;
  ttien0: number;
  item_count: number;
  source_order_keys: string[];
}

export interface TruckBatchCommitResult {
  trip_id: string;
  created_vouchers: TruckBatchCreatedItem[];
  total_vouchers: number;
  total_items: number;
  total_amount: number;
  message: string;
}
