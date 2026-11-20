export type CatalogColumnType = "text" | "mono" | "currency" | "number" | "badge";

export interface CatalogColumnDef {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  type?: CatalogColumnType;
}

export interface CatalogConfig {
  id: string;
  shortCode: string;
  title: string;
  tableName: string;
  endpoint: string;
  badgeColor: string;
  defaultSortKey: string;
  searchKeys: string[];
  columns: CatalogColumnDef[];
}

export const CATALOG_CONFIGS: CatalogConfig[] = [
  {
    id: "khach-hang",
    shortCode: "KH",
    title: "Khách hàng & Nhà cung cấp",
    tableName: "VTSYS.dbo.DmDt",
    endpoint: "/api/lookups/khach-hang?limit=50000",
    badgeColor: "bg-primary-700",
    defaultSortKey: "ma_dt",
    searchKeys: ["ma_dt", "ten_dt", "dia_chi", "ms_thue", "ong_ba", "ma_bp", "ten_bp"],
    columns: [
      { key: "ma_dt", label: "Mã ĐT", width: "w-28", type: "mono" },
      { key: "ten_dt", label: "Tên đối tượng", width: "min-w-[220px]", type: "text" },
      { key: "dia_chi", label: "Địa chỉ", width: "min-w-[240px]", type: "text" },
      { key: "ong_ba", label: "Người giao dịch", width: "w-40", type: "text" },
      { key: "ms_thue", label: "Mã số thuế", width: "w-32", type: "mono" },
      { key: "han_tt", label: "Hạn TT", width: "w-20", align: "right", type: "number" },
      { key: "gioi_han", label: "Giới hạn nợ", width: "w-32", align: "right", type: "currency" },
      { key: "toi_han", label: "Cảnh báo nợ", width: "w-32", align: "right", type: "currency" },
      { key: "ma_bp", label: "Mã BP", width: "w-24", align: "center", type: "mono" },
      { key: "ma_vm", label: "Khu vực", width: "w-24", align: "center", type: "mono" },
    ],
  },
  {
    id: "vat-tu",
    shortCode: "VT",
    title: "Vật tư & Hàng hóa",
    tableName: "VTSYS.dbo.DmVt",
    endpoint: "/api/lookups/vat-tu?limit=50000",
    badgeColor: "bg-emerald-700",
    defaultSortKey: "ma_vt",
    searchKeys: ["ma_vt", "ten_vt", "dvt", "dvt_ban", "tk_vt", "tk_gv", "tk_dt"],
    columns: [
      { key: "ma_vt", label: "Mã VT", width: "w-32", type: "mono" },
      { key: "ten_vt", label: "Tên vật tư / hàng hóa", width: "min-w-[260px]", type: "text" },
      { key: "loai_vt", label: "Loại", width: "w-16", align: "center", type: "badge" },
      { key: "dvt", label: "ĐVT", width: "w-20", align: "center", type: "text" },
      { key: "dvt_ban", label: "ĐVT bán", width: "w-20", align: "center", type: "text" },
      { key: "he_so0", label: "Hệ số 0", width: "w-20", align: "right", type: "number" },
      { key: "tk_vt", label: "TK Kho", width: "w-20", align: "center", type: "mono" },
      { key: "tk_gv", label: "TK GV", width: "w-20", align: "center", type: "mono" },
      { key: "tk_dt", label: "TK DT", width: "w-20", align: "center", type: "mono" },
      { key: "tk_ck", label: "TK CK", width: "w-20", align: "center", type: "mono" },
    ],
  },
  {
    id: "tai-khoan",
    shortCode: "TK",
    title: "Hệ thống Tài khoản",
    tableName: "VTSYS.dbo.DmTk",
    endpoint: "/api/lookups/tai-khoan",
    badgeColor: "bg-sky-700",
    defaultSortKey: "tk",
    searchKeys: ["tk", "ten_tk", "tk_dt"],
    columns: [
      { key: "tk", label: "Số tài khoản", width: "w-32", type: "mono" },
      { key: "ten_tk", label: "Tên tài khoản", width: "min-w-[320px]", type: "text" },
      { key: "tk_dt", label: "Theo dõi ĐT", width: "w-28", align: "center", type: "badge" },
    ],
  },
  {
    id: "kho",
    shortCode: "KHO",
    title: "Danh mục Kho hàng",
    tableName: "VTSYS.dbo.DmKho",
    endpoint: "/api/lookups/kho",
    badgeColor: "bg-teal-700",
    defaultSortKey: "ma_kho",
    searchKeys: ["ma_kho", "ten_kho"],
    columns: [
      { key: "ma_kho", label: "Mã kho", width: "w-36", type: "mono" },
      { key: "ten_kho", label: "Tên kho hàng", width: "min-w-[300px]", type: "text" },
    ],
  },
  {
    id: "bo-phan",
    shortCode: "BP",
    title: "Danh mục Bộ phận",
    tableName: "VTSYS.dbo.DmBp",
    endpoint: "/api/lookups/bo-phan",
    badgeColor: "bg-indigo-700",
    defaultSortKey: "ma_bp",
    searchKeys: ["ma_bp", "ten_bp"],
    columns: [
      { key: "ma_bp", label: "Mã bộ phận", width: "w-36", type: "mono" },
      { key: "ten_bp", label: "Tên bộ phận / phòng ban", width: "min-w-[300px]", type: "text" },
    ],
  },
  {
    id: "xe",
    shortCode: "XE",
    title: "Danh mục Xe vận chuyển",
    tableName: "VTSYS.dbo.DmXe",
    endpoint: "/api/lookups/xe",
    badgeColor: "bg-amber-700",
    defaultSortKey: "ma_xe",
    searchKeys: ["ma_xe", "ten_xe"],
    columns: [
      { key: "ma_xe", label: "Mã xe", width: "w-36", type: "mono" },
      { key: "ten_xe", label: "Tên xe / Biển kiểm soát", width: "min-w-[300px]", type: "text" },
    ],
  },
  {
    id: "hop-dong",
    shortCode: "HĐ",
    title: "Danh mục Hợp đồng",
    tableName: "VTSYS.dbo.DmHD",
    endpoint: "/api/lookups/hop-dong",
    badgeColor: "bg-violet-700",
    defaultSortKey: "ma_hd",
    searchKeys: ["ma_hd", "ten_hd"],
    columns: [
      { key: "ma_hd", label: "Mã hợp đồng", width: "w-40", type: "mono" },
      { key: "ten_hd", label: "Tên hợp đồng / đơn hàng", width: "min-w-[320px]", type: "text" },
    ],
  },
  {
    id: "nhap-xuat",
    shortCode: "NX",
    title: "Mã Nhập xuất / Lý do",
    tableName: "VTSYS.dbo.DmNx",
    endpoint: "/api/lookups/nhap-xuat",
    badgeColor: "bg-cyan-700",
    defaultSortKey: "ma_nx",
    searchKeys: ["ma_nx", "ten_nx", "dinh_khoan"],
    columns: [
      { key: "ma_nx", label: "Mã NX", width: "w-32", type: "mono" },
      { key: "ten_nx", label: "Tên nhập xuất / Diễn giải", width: "min-w-[300px]", type: "text" },
      { key: "dinh_khoan", label: "Định khoản", width: "w-28", align: "center", type: "badge" },
    ],
  },
  {
    id: "khoan-muc",
    shortCode: "KM",
    title: "Khoản mục chi phí",
    tableName: "VTSYS.dbo.DmKm",
    endpoint: "/api/lookups/khoan-muc",
    badgeColor: "bg-rose-700",
    defaultSortKey: "ma_km",
    searchKeys: ["ma_km", "ten_km"],
    columns: [
      { key: "ma_km", label: "Mã khoản mục", width: "w-40", type: "mono" },
      { key: "ten_km", label: "Tên khoản mục chi phí", width: "min-w-[320px]", type: "text" },
    ],
  },
  {
    id: "san-pham",
    shortCode: "SP",
    title: "Sản phẩm / Công trình",
    tableName: "VTSYS.dbo.DmSp",
    endpoint: "/api/lookups/san-pham",
    badgeColor: "bg-orange-700",
    defaultSortKey: "ma_sp",
    searchKeys: ["ma_sp", "ten_sp", "dvt"],
    columns: [
      { key: "ma_sp", label: "Mã SP", width: "w-36", type: "mono" },
      { key: "ten_sp", label: "Tên sản phẩm / công trình", width: "min-w-[280px]", type: "text" },
      { key: "dvt", label: "ĐVT", width: "w-24", align: "center", type: "text" },
      { key: "loai_sp", label: "Loại", width: "w-20", align: "center", type: "badge" },
    ],
  },
  {
    id: "thue",
    shortCode: "THUẾ",
    title: "Biểu Thuế GTGT",
    tableName: "VTSYS.dbo.DmThue",
    endpoint: "/api/lookups/thue",
    badgeColor: "bg-slate-700",
    defaultSortKey: "ma_thue",
    searchKeys: ["ma_thue", "ten_thue", "tk"],
    columns: [
      { key: "ma_thue", label: "Mã thuế", width: "w-28", type: "mono" },
      { key: "ten_thue", label: "Tên mức thuế GTGT", width: "min-w-[260px]", type: "text" },
      { key: "thue_gtgt", label: "Thuế suất (%)", width: "w-32", align: "right", type: "number" },
      { key: "tk", label: "TK Thuế", width: "w-28", align: "center", type: "mono" },
    ],
  },
  {
    id: "tien-te",
    shortCode: "TTỆ",
    title: "Tiền tệ & Tỷ giá",
    tableName: "VTSYS.dbo.DmTte",
    endpoint: "/api/lookups/tien-te",
    badgeColor: "bg-zinc-700",
    defaultSortKey: "ma_tte",
    searchKeys: ["ma_tte", "ten_tte"],
    columns: [
      { key: "ma_tte", label: "Mã tiền tệ", width: "w-28", type: "mono" },
      { key: "ten_tte", label: "Tên loại tiền", width: "min-w-[260px]", type: "text" },
      { key: "ty_gia", label: "Tỷ giá quy đổi", width: "w-36", align: "right", type: "currency" },
    ],
  },
];

export const CATALOG_CONFIG_MAP: Record<string, CatalogConfig> = Object.fromEntries(
  CATALOG_CONFIGS.map((c) => [c.id, c]),
);
