import { VoucherDetail, VoucherFullDetail } from "../../types/voucher";

export interface VoucherFormProps {
  stt?: string;
  voucher?: VoucherFullDetail | null;
  mode?: "M" | "S" | "VIEW";
  voucherMode?: "sales" | "return" | "warehouse";
  maCt?: "X1" | "N5";
  isSuspended?: boolean;
  initialInherited?: Partial<VoucherFullDetail>;
  /** Gợi ý số chứng từ tức thì (0ms) tính từ danh sách đang mở khi tạo phiếu mới */
  suggestedSoCt?: string;
  onBack: () => void;
  onPrint?: () => void;
  onViewDebt?: (maDt: string) => void;
  onOpenPickup?: (maDt?: string, ngayCt?: string) => void;
  onSaveSuccess?: (stt: string, savedVoucher?: VoucherFullDetail) => void;
  pickupPayload?: {
    items: VoucherDetail[];
    ma_xe?: string;
    ma_dt?: string;
    ngay_ct?: string;
  } | null;
  onClearPickupPayload?: () => void;
}

export interface VoucherDraftPayload {
  savedAt: number;
  ngayCt: string;
  soCt: string;
  maDt: string;
  tenDt: string;
  dienGiai0: string;
  maXe: string;
  items: VoucherDetail[];
}

export interface DebtInfoSummary {
  du_no: number;
  du_co: number;
  du_cuoi: number;
  du_cuoi_kiem_tra?: number;
  gioi_han: number;
  toi_han: number;
  is_over_limit: boolean;
  is_near_limit: boolean;
  status_message: string;
}

export interface DebtDialogState {
  title: string;
  message: string;
  tone: "danger" | "warning";
  focusTarget?: "tenDt" | "maDt" | "none";
}

export type InvalidVoucherField = "maDt" | "ngayCt" | "maNx" | "items" | null;

export const CURRENT_USER = "KTCN3";
export const MAX_UNDO_STEPS = 20;
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const emptyDetailRow = (isReturn = false): VoucherDetail => ({
  stt0: Math.random().toString(36).substring(2, 9),
  ma_vt: "",
  ten_vt: "",
  dvt: "",
  dvt_ban: "",
  loai_vt: "1",
  so_tam: 1,
  he_so8: 1,
  so_luong8: 1,
  he_so9: 1,
  so_luong9: 1,
  gia_nt9: 0,
  gia9: 0,
  tien_nt9: 0,
  tien9: 0,
  so_luong: 1,
  gia_nt: 0,
  gia: 0,
  tien_nt: 0,
  tien: 0,
  chiet_khau: 0,
  tien_nt4: 0,
  tien4: 0,
  tien_nt2: 0,
  tien2: 0,
  tien_nt3: 0,
  tien3: 0,
  tk: isReturn ? "1561" : "632",
  tk_du: isReturn ? "632" : "1561",
  tk_du2: isReturn ? "5212" : "5111",
  tk_du4: "521",
  ma_kho: "K0101",
  gia_tb_tt: isReturn ? "K" : "C",
});

export const buildVoucherSnapshot = (params: {
  ngayCt: string;
  effectiveSoCt: string;
  maDt: string;
  tenDt: string;
  includeTenDt: boolean;
  dienGiai0: string;
  maXe: string;
  items: VoucherDetail[];
}): string =>
  JSON.stringify({
    ngayCt: (params.ngayCt || "").trim(),
    soCt: (params.effectiveSoCt || "").trim().toUpperCase(),
    maDt: (params.maDt || "").trim().toUpperCase(),
    tenDt: params.includeTenDt ? (params.tenDt || "").trim() : "",
    dienGiai0: (params.dienGiai0 || "").trim(),
    maXe: (params.maXe || "").trim().toUpperCase(),
    items: params.items
      .filter((it) => Boolean(it.ma_vt?.trim()))
      .map((it) => [
        (it.ma_vt || "").trim().toUpperCase(),
        (it.ma_kho || "").trim().toUpperCase(),
        Number(it.so_tam ?? 0),
        Number(it.he_so8 ?? 1),
        Number(it.so_luong9 ?? 0),
        Number(it.gia_nt9 ?? 0),
        Number(it.chiet_khau ?? 0),
        Number(it.tien_nt2 ?? 0),
        (it.tk_du2 || "").trim(),
      ]),
  });

export const clampField = (
  val: string | null | undefined,
  max: number,
): string => (val || "").normalize("NFC").slice(0, max);
