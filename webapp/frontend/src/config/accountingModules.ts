import { CashMaCt } from "../types/cashVoucher";

export interface NavModuleItem {
  id: string;
  label: string;
  shortCode: string;
  route: string;
  iconName:
    | "arrow-down-left"
    | "arrow-up-right"
    | "landmark"
    | "building-2"
    | "book-open"
    | "file-spreadsheet"
    | "rotate-ccw"
    | "warehouse"
    | "credit-card"
    | "shopping-cart"
    | "package"
    | "layers"
    | "calculator"
    | "bar-chart-3"
    | "database";
  implemented: boolean;
  keywords?: string;
  badgeTone?: "emerald" | "rose" | "sky" | "amber" | "primary" | "neutral";
}

export interface NavModuleGroup {
  id: string;
  title: string;
  items: NavModuleItem[];
}

export const NAV_GROUPS: NavModuleGroup[] = [
  {
    id: "cash-bank",
    title: "1. Tiền mặt & Ngân hàng",
    items: [
      {
        id: "C1",
        label: "Phiếu thu tiền mặt",
        shortCode: "PT",
        route: "/cash/receipts",
        iconName: "arrow-down-left",
        implemented: true,
        badgeTone: "emerald",
        keywords: "phieu thu tien mat c1 pt ctt 1111",
      },
      {
        id: "C2",
        label: "Phiếu chi tiền mặt",
        shortCode: "PC",
        route: "/cash/payments",
        iconName: "arrow-up-right",
        implemented: true,
        badgeTone: "rose",
        keywords: "phieu chi tien mat c2 pc ctt 1111",
      },
      {
        id: "C3",
        label: "Giấy báo Có (Thu NH)",
        shortCode: "BC",
        route: "/bank/credits",
        iconName: "landmark",
        implemented: true,
        badgeTone: "sky",
        keywords: "bao co thu ngan hang chuyen khoan excel c3 bc 11212",
      },
      {
        id: "C4",
        label: "Giấy báo Nợ (Chi NH)",
        shortCode: "BN",
        route: "/bank/debits",
        iconName: "building-2",
        implemented: true,
        badgeTone: "amber",
        keywords: "bao no chi ngan hang uy nhiem chi c4 bn 11212",
      },
      {
        id: "cash-ledger",
        label: "Sổ quỹ & Tiền gửi NH",
        shortCode: "SỔ",
        route: "/cash/ledger",
        iconName: "book-open",
        implemented: true,
        badgeTone: "primary",
        keywords: "so quy tien mat so tien gui ngan hang 1111 11212 luy ke",
      },
    ],
  },
  {
    id: "sales-ar",
    title: "2. Bán hàng & Công nợ thu",
    items: [
      {
        id: "X1",
        label: "Hóa đơn / Xuất bán",
        shortCode: "X1",
        route: "/sales-invoices",
        iconName: "file-spreadsheet",
        implemented: true,
        badgeTone: "primary",
        keywords: "ban hang hoa don phieu xuat ban x1 ctbh",
      },
      {
        id: "N5",
        label: "Hàng bán bị trả lại",
        shortCode: "N5",
        route: "/sales-returns",
        iconName: "rotate-ccw",
        implemented: true,
        badgeTone: "amber",
        keywords: "nhap lai hang ban tra lai n5",
      },
      {
        id: "KH",
        label: "Phiếu xuất kho (KH)",
        shortCode: "KH",
        route: "/warehouse-slips",
        iconName: "warehouse",
        implemented: true,
        badgeTone: "emerald",
        keywords: "phieu kho kh_2014 xuat kho",
      },
      {
        id: "price-lists",
        label: "Bảng giá bán (BG/BG0)",
        shortCode: "BG",
        route: "/price-lists",
        iconName: "file-spreadsheet",
        implemented: true,
        badgeTone: "sky",
        keywords: "bang gia bg bg0 import excel gia ban chiet khau",
      },
      {
        id: "receivables",
        label: "Công nợ phải thu (131)",
        shortCode: "131",
        route: "/receivables",
        iconName: "credit-card",
        implemented: true,
        badgeTone: "emerald",
        keywords: "cong no phai thu 131",
      },
    ],
  },
  {
    id: "purchases-ap",
    title: "3. Mua hàng & Công nợ trả",
    items: [
      {
        id: "purchase-receipts",
        label: "Phiếu nhập mua hàng",
        shortCode: "MH",
        route: "/purchases",
        iconName: "shopping-cart",
        implemented: true,
        badgeTone: "amber",
        keywords: "mua hang nhap kho ctmh",
      },
      {
        id: "payables",
        label: "Công nợ phải trả (331)",
        shortCode: "331",
        route: "/payables",
        iconName: "credit-card",
        implemented: true,
        badgeTone: "rose",
        keywords: "cong no phai tra ncc 331",
      },
    ],
  },
  {
    id: "inventory",
    title: "4. Kho & Vật tư",
    items: [
      {
        id: "inv-in-out",
        label: "Nhập / Xuất kho khác",
        shortCode: "NX",
        route: "/inventory/other",
        iconName: "package",
        implemented: true,
        badgeTone: "sky",
        keywords: "nhap xuat kho khac ctnx",
      },
      {
        id: "inv-transfer",
        label: "Chuyển kho nội bộ",
        shortCode: "CK",
        route: "/inventory/transfers",
        iconName: "layers",
        implemented: true,
        badgeTone: "primary",
        keywords: "chuyen kho noi bo ctck",
      },
    ],
  },
  {
    id: "general-ledger",
    title: "5. Kế toán tổng hợp",
    items: [
      {
        id: "gl-other",
        label: "Phiếu kế toán khác",
        shortCode: "PK",
        route: "/gl/vouchers",
        iconName: "calculator",
        implemented: true,
        badgeTone: "emerald",
        keywords: "phieu ke toan khac ctk pk chung tu nghiep vu",
      },
      {
        id: "gl-reports",
        label: "Sổ cái & Cân đối PS",
        shortCode: "BC",
        route: "/gl/reports",
        iconName: "bar-chart-3",
        implemented: true,
        badgeTone: "primary",
        keywords: "so cai can doi phat sinh bao cao tai chinh",
      },
    ],
  },
  {
    id: "catalogs",
    title: "6. Danh mục & Hệ thống",
    items: [
      {
        id: "cat-khach-hang",
        label: "Khách hàng / NCC",
        shortCode: "KH",
        route: "/catalogs/khach-hang",
        iconName: "database",
        implemented: true,
        badgeTone: "primary",
        keywords: "danh muc khach hang nha cung cap doi tuong dmdt",
      },
      {
        id: "cat-vat-tu",
        label: "Vật tư & Hàng hóa",
        shortCode: "VT",
        route: "/catalogs/vat-tu",
        iconName: "package",
        implemented: true,
        badgeTone: "emerald",
        keywords: "danh muc vat tu hang hoa san pham dmvt",
      },
      {
        id: "cat-tai-khoan",
        label: "Hệ thống Tài khoản",
        shortCode: "TK",
        route: "/catalogs/tai-khoan",
        iconName: "book-open",
        implemented: true,
        badgeTone: "sky",
        keywords: "danh muc tai khoan ke toan dmtk 111 112 131 331",
      },
      {
        id: "cat-kho",
        label: "Kho hàng",
        shortCode: "KHO",
        route: "/catalogs/kho",
        iconName: "warehouse",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc kho hang dmkho",
      },
      {
        id: "cat-bo-phan",
        label: "Bộ phận / Phòng ban",
        shortCode: "BP",
        route: "/catalogs/bo-phan",
        iconName: "layers",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc bo phan phong ban dmbp",
      },
      {
        id: "cat-xe",
        label: "Xe vận chuyển",
        shortCode: "XE",
        route: "/catalogs/xe",
        iconName: "building-2",
        implemented: true,
        badgeTone: "amber",
        keywords: "danh muc xe van chuyen bien so dmxe",
      },
      {
        id: "cat-hop-dong",
        label: "Hợp đồng",
        shortCode: "HĐ",
        route: "/catalogs/hop-dong",
        iconName: "file-spreadsheet",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc hop dong dmhd",
      },
      {
        id: "cat-nhap-xuat",
        label: "Mã Nhập xuất",
        shortCode: "NX",
        route: "/catalogs/nhap-xuat",
        iconName: "rotate-ccw",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc ma nhap xuat ly do dmnx",
      },
      {
        id: "cat-khoan-muc",
        label: "Khoản mục chi phí",
        shortCode: "KM",
        route: "/catalogs/khoan-muc",
        iconName: "calculator",
        implemented: true,
        badgeTone: "rose",
        keywords: "danh muc khoan muc chi phi dmkm",
      },
      {
        id: "cat-san-pham",
        label: "Sản phẩm / Công trình",
        shortCode: "SP",
        route: "/catalogs/san-pham",
        iconName: "layers",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc san pham cong trinh dmsp",
      },
      {
        id: "cat-thue",
        label: "Biểu Thuế GTGT",
        shortCode: "THUẾ",
        route: "/catalogs/thue",
        iconName: "calculator",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc thue gtgt vat dmthue",
      },
      {
        id: "cat-tien-te",
        label: "Tiền tệ & Tỷ giá",
        shortCode: "TTỆ",
        route: "/catalogs/tien-te",
        iconName: "credit-card",
        implemented: true,
        badgeTone: "neutral",
        keywords: "danh muc tien te ty gia vnd usd dmtte",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavModuleItem[] = NAV_GROUPS.flatMap((g) => g.items);

export interface CashVoucherModuleConfig {
  maCt: CashMaCt;
  nhCt: "1" | "2";
  shortCode: string;
  route: string;
  title: string;
  formTitleCreate: string;
  formTitleEdit: string;
  formTitleView: string;
  subtitle: string;
  badgeColor: string;
  headerGradient: string;
  fixedSide: "debit" | "credit";
  defaultMainAccount: string;
  defaultOffsetAccount: string;
  accountPrefixHint: string;
  mainAccountLabel: string;
  offsetAccountLabel: string;
  personLabel: string;
  defaultDienGiai: string;
  supportsExcelImport: boolean;
}

export const CASH_VOUCHER_CONFIGS: Record<CashMaCt, CashVoucherModuleConfig> = {
  C1: {
    maCt: "C1",
    nhCt: "1",
    shortCode: "PT",
    route: "/cash/receipts",
    title: "Phiếu thu tiền mặt",
    formTitleCreate: "Thêm Mới Phiếu Thu Tiền Mặt (C1)",
    formTitleEdit: "Sửa Phiếu Thu Tiền Mặt (C1)",
    formTitleView: "Xem Phiếu Thu Tiền Mặt (C1)",
    subtitle: "/ Tiền mặt · Phiếu thu (CtT)",
    badgeColor: "bg-emerald-700",
    headerGradient:
      "bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 border-emerald-950",
    fixedSide: "debit",
    defaultMainAccount: "1111",
    defaultOffsetAccount: "1311",
    accountPrefixHint: "111",
    mainAccountLabel: "TK Nợ (Quỹ TM)",
    offsetAccountLabel: "TK Có (Đối ứng)",
    personLabel: "Người nộp tiền",
    defaultDienGiai: "Thu tiền mặt",
    supportsExcelImport: false,
  },
  C2: {
    maCt: "C2",
    nhCt: "2",
    shortCode: "PC",
    route: "/cash/payments",
    title: "Phiếu chi tiền mặt",
    formTitleCreate: "Thêm Mới Phiếu Chi Tiền Mặt (C2)",
    formTitleEdit: "Sửa Phiếu Chi Tiền Mặt (C2)",
    formTitleView: "Xem Phiếu Chi Tiền Mặt (C2)",
    subtitle: "/ Tiền mặt · Phiếu chi (CtT)",
    badgeColor: "bg-rose-700",
    headerGradient:
      "bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 border-rose-950",
    fixedSide: "credit",
    defaultMainAccount: "1111",
    defaultOffsetAccount: "3311",
    accountPrefixHint: "111",
    mainAccountLabel: "TK Có (Quỹ TM)",
    offsetAccountLabel: "TK Nợ (Chi phí / NCC)",
    personLabel: "Người nhận tiền",
    defaultDienGiai: "Chi tiền mặt",
    supportsExcelImport: false,
  },
  C3: {
    maCt: "C3",
    nhCt: "1",
    shortCode: "BC",
    route: "/bank/credits",
    title: "Giấy báo Có (Thu ngân hàng)",
    formTitleCreate: "Thêm Mới Giấy Báo Có (C3)",
    formTitleEdit: "Sửa Giấy Báo Có (C3)",
    formTitleView: "Xem Giấy Báo Có (C3)",
    subtitle: "/ Ngân hàng · Báo Có (CtT)",
    badgeColor: "bg-sky-700",
    headerGradient:
      "bg-gradient-to-r from-sky-900 via-sky-800 to-sky-900 border-sky-950",
    fixedSide: "debit",
    defaultMainAccount: "11212",
    defaultOffsetAccount: "1311",
    accountPrefixHint: "112",
    mainAccountLabel: "TK Nợ (Ngân hàng)",
    offsetAccountLabel: "TK Có (Đối ứng)",
    personLabel: "Đơn vị trả tiền",
    defaultDienGiai: "Thu tiền qua ngân hàng",
    supportsExcelImport: true,
  },
  C4: {
    maCt: "C4",
    nhCt: "2",
    shortCode: "BN",
    route: "/bank/debits",
    title: "Giấy báo Nợ (Chi ngân hàng)",
    formTitleCreate: "Thêm Mới Giấy Báo Nợ (C4)",
    formTitleEdit: "Sửa Giấy Báo Nợ (C4)",
    formTitleView: "Xem Giấy Báo Nợ (C4)",
    subtitle: "/ Ngân hàng · Báo Nợ (CtT)",
    badgeColor: "bg-amber-700",
    headerGradient:
      "bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 border-amber-950",
    fixedSide: "credit",
    defaultMainAccount: "11212",
    defaultOffsetAccount: "3311",
    accountPrefixHint: "112",
    mainAccountLabel: "TK Có (Ngân hàng)",
    offsetAccountLabel: "TK Nợ (Đối ứng)",
    personLabel: "Đơn vị thụ hưởng",
    defaultDienGiai: "Chi tiền qua ngân hàng",
    supportsExcelImport: false,
  },
};

export function routeToCashMaCt(pathname: string): CashMaCt | null {
  if (pathname.startsWith("/cash/receipts")) return "C1";
  if (pathname.startsWith("/cash/payments")) return "C2";
  if (pathname.startsWith("/bank/credits")) return "C3";
  if (pathname.startsWith("/bank/debits")) return "C4";
  return null;
}
