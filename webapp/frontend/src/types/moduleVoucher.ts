export type DocModuleKey = "purchase" | "inv-io" | "inv-transfer" | "gl-voucher";

export type DocDetailKind = "inventory" | "transfer" | "gl";

export interface DocModuleConfig {
  key: DocModuleKey;
  title: string;
  shortTitle: string;
  shortCode: string;
  route: string;
  sqlTables: string;
  defaultMaCt: string;
  defaultMainTk: string;
  defaultOffsetTk: string;
  partnerLabel: string;
  detailKind: DocDetailKind;
  showTaxFields: boolean;
  accentClass: string;
}

export const DOC_MODULE_CONFIGS: Record<DocModuleKey, DocModuleConfig> = {
  purchase: {
    key: "purchase",
    title: "Phiếu nhập mua hàng",
    shortTitle: "Nhập mua hàng",
    shortCode: "MH",
    route: "/purchases",
    sqlTables: "CtMH / CtMH0",
    defaultMaCt: "MH",
    defaultMainTk: "331",
    defaultOffsetTk: "1561",
    partnerLabel: "Nhà cung cấp",
    detailKind: "inventory",
    showTaxFields: true,
    accentClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
  "inv-io": {
    key: "inv-io",
    title: "Nhập / Xuất kho khác",
    shortTitle: "Nhập xuất khác",
    shortCode: "NX",
    route: "/inventory/other",
    sqlTables: "CtNX / CtNX0",
    defaultMaCt: "NX",
    defaultMainTk: "1561",
    defaultOffsetTk: "711",
    partnerLabel: "Đối tượng / Bộ phận",
    detailKind: "inventory",
    showTaxFields: false,
    accentClass: "text-sky-700 bg-sky-50 border-sky-200",
  },
  "inv-transfer": {
    key: "inv-transfer",
    title: "Chuyển kho nội bộ",
    shortTitle: "Chuyển kho",
    shortCode: "CK",
    route: "/inventory/transfers",
    sqlTables: "CtCK / CtCK0",
    defaultMaCt: "CK",
    defaultMainTk: "1561",
    defaultOffsetTk: "1561",
    partnerLabel: "Người nhận / Kho nhận",
    detailKind: "transfer",
    showTaxFields: false,
    accentClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  "gl-voucher": {
    key: "gl-voucher",
    title: "Phiếu kế toán khác",
    shortTitle: "Phiếu kế toán",
    shortCode: "PK",
    route: "/gl/vouchers",
    sqlTables: "CtK / CtK0",
    defaultMaCt: "PK",
    defaultMainTk: "1111",
    defaultOffsetTk: "642",
    partnerLabel: "Đối tượng",
    detailKind: "gl",
    showTaxFields: false,
    accentClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
};

export interface ModuleVoucherDetailItem {
  stt0?: string | null;
  stt?: string | null;
  ma_kho: string;
  ma_kho_n: string;
  ma_vt: string;
  ten_vt: string;
  dvt: string;
  so_luong: number;
  gia_nt: number;
  tien_nt: number;
  tien_nt3: number;
  no_co: string;
  tk: string;
  tk_du: string;
  dien_giai: string;
  ma_dt: string;
  ma_bp: string;
  ma_km: string;
  ma_sp: string;
  ma_hd: string;
}

export interface ModuleVoucherHeader {
  stt: string;
  ma_dvcs: string;
  ma_ct: string;
  nh_ct: string;
  ngay_ct: string;
  so_ct: string;
  ma_dt: string;
  ten_dt: string;
  ong_ba: string;
  dia_chi: string;
  dien_giai0: string;
  ma_nx: string;
  tk: string;
  ma_tte: string;
  ty_gia: number;
  ttien_nt0: number;
  ttien_nt3: number;
  ttien_nt: number;
  posted: boolean;
  confirmed: boolean;
  user_name: string;
  so_ct0: string;
  ngay_ct0?: string | null;
  so_seri0: string;
  ma_thue: string;
  thue_gtgt: number;
  item_count: number;
}

export interface ModuleVoucherDetailResponse extends ModuleVoucherHeader {
  items: ModuleVoucherDetailItem[];
  is_mock: boolean;
}

export interface ModuleVoucherPageResponse {
  items: ModuleVoucherHeader[];
  total_records: number;
  page: number;
  page_size: number;
  total_pages: number;
  total_amount: number;
  is_mock: boolean;
}

export interface ModuleVoucherSavePayload {
  ma_dvcs?: string;
  ma_ct?: string;
  nh_ct?: string;
  ngay_ct: string;
  so_ct: string;
  ma_dt?: string;
  ten_dt?: string;
  ong_ba?: string;
  dia_chi?: string;
  dien_giai0?: string;
  ma_nx?: string;
  tk?: string;
  ma_tte?: string;
  ty_gia?: number;
  posted?: boolean;
  user_name?: string;
  so_ct0?: string;
  ngay_ct0?: string | null;
  so_seri0?: string;
  ma_thue?: string;
  thue_gtgt?: number;
  items: ModuleVoucherDetailItem[];
}

export interface PartnerBalanceRow {
  ma_dt: string;
  ten_dt: string;
  dia_chi: string;
  du_no_dau: number;
  du_co_dau: number;
  ps_no: number;
  ps_co: number;
  du_no_cuoi: number;
  du_co_cuoi: number;
  tx_count: number;
}

export interface PartnerBalancePageResponse {
  tk_prefix: string;
  items: PartnerBalanceRow[];
  total_records: number;
  page: number;
  page_size: number;
  total_pages: number;
  sum_du_no_dau: number;
  sum_du_co_dau: number;
  sum_ps_no: number;
  sum_ps_co: number;
  sum_du_no_cuoi: number;
  sum_du_co_cuoi: number;
  is_mock: boolean;
}

export interface PartnerLedgerRow {
  stt: string;
  ngay_ct: string;
  ma_ct: string;
  so_ct: string;
  dien_giai: string;
  tk: string;
  tk_du: string;
  ps_no: number;
  ps_co: number;
  luy_ke: number;
}

export interface PartnerLedgerResponse {
  tk_prefix: string;
  ma_dt: string;
  ten_dt: string;
  du_dau: number;
  du_cuoi: number;
  entries: PartnerLedgerRow[];
  is_mock: boolean;
}

export interface TrialBalanceRow {
  tk: string;
  ten_tk: string;
  bac_tk: number;
  du_no_dau: number;
  du_co_dau: number;
  ps_no: number;
  ps_co: number;
  du_no_cuoi: number;
  du_co_cuoi: number;
}

export interface TrialBalanceResponse {
  items: TrialBalanceRow[];
  sum_du_no_dau: number;
  sum_du_co_dau: number;
  sum_ps_no: number;
  sum_ps_co: number;
  sum_du_no_cuoi: number;
  sum_du_co_cuoi: number;
  is_mock: boolean;
}

export interface GlLedgerRow {
  stt: string;
  ngay_ct: string;
  ma_ct: string;
  so_ct: string;
  ma_dt: string;
  ten_dt: string;
  dien_giai: string;
  tk_no: string;
  tk_co: string;
  ps_no: number;
  ps_co: number;
  luy_ke: number;
}

export interface GlLedgerResponse {
  tk: string;
  ten_tk: string;
  du_dau: number;
  du_cuoi: number;
  entries: GlLedgerRow[];
  is_mock: boolean;
}
