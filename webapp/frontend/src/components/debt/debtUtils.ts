import { DebtLedgerData, DebtLedgerEntry } from "../../types/debt";
import { formatDate } from "../../lib/format";

export const SESSION_FROM_KEY = "debtPanel.fromDate";
export const SESSION_TO_KEY = "debtPanel.toDate";
export const SESSION_MAX_KEY = "debtPanel.isMaximized";

export function getCurrentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getInitialDateBounds(): { start: string; end: string } {
  const defaults = getCurrentMonthBounds();
  try {
    const savedFrom = window.sessionStorage.getItem(SESSION_FROM_KEY);
    const savedTo = window.sessionStorage.getItem(SESSION_TO_KEY);
    return {
      start:
        savedFrom && /^\d{4}-\d{2}-\d{2}$/.test(savedFrom)
          ? savedFrom
          : defaults.start,
      end:
        savedTo && /^\d{4}-\d{2}-\d{2}$/.test(savedTo)
          ? savedTo
          : defaults.end,
    };
  } catch {
    return defaults;
  }
}

export function formatSpaceNumber(val: number | undefined | null): string {
  const num = Math.round(Number(val) || 0);
  const absStr = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return num < 0 ? `-${absStr}` : absStr;
}

export function escapeCsvCell(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportDebtLedgerCsv(params: {
  ledger: DebtLedgerData | null;
  fallbackCode: string;
  tenDt: string;
  fromDate: string;
  toDate: string;
}): void {
  const { ledger, fallbackCode, tenDt, fromDate, toDate } = params;
  const code = (ledger?.ma_dt || fallbackCode || "ALL").trim();
  const customerName = tenDt || ledger?.ten_dt || "";
  const entries: DebtLedgerEntry[] = ledger?.entries || [];

  let running = ledger?.du_dau || 0;
  const csvRows: (string | number)[][] = [
    [`SỔ CHI TIẾT CÔNG NỢ PHẢI THU (TK ${ledger?.tk || "131"})`],
    [
      `Đối tượng: ${code}${customerName ? ` - ${customerName}` : ""}`,
      `Từ ngày: ${formatDate(fromDate)}`,
      `Đến ngày: ${formatDate(toDate)}`,
    ],
    [],
    ["Mã CT", "Ngày", "Số phiếu", "Diễn giải", "Ps tăng", "Ps giảm", "Lũy kế"],
    [
      "",
      "",
      "",
      "Dư đầu kỳ",
      ledger && ledger.du_dau_tang > 0 ? Math.round(ledger.du_dau_tang) : "",
      ledger && ledger.du_dau_giam > 0 ? Math.round(ledger.du_dau_giam) : "",
      ledger ? Math.round(ledger.du_dau) : "",
    ],
    ...entries.map((en) => {
      running =
        en.luy_ke !== undefined
          ? en.luy_ke
          : running + (Number(en.ps_tang) || 0) - (Number(en.ps_giam) || 0);
      return [
        en.ma_ct || "",
        formatDate(en.ngay_ct),
        en.so_ct || "",
        en.dien_giai || "",
        en.ps_tang !== 0 ? Math.round(en.ps_tang) : "",
        en.ps_giam !== 0 ? Math.round(en.ps_giam) : "",
        Math.round(running),
      ];
    }),
    [
      "",
      "",
      "",
      "Phát sinh trong kỳ",
      Math.round(ledger?.tong_ps_tang || 0),
      Math.round(ledger?.tong_ps_giam || 0),
      "",
    ],
    [
      "",
      "",
      "",
      "Dư cuối kỳ",
      Math.round(ledger?.du_cuoi_tang || 0),
      Math.round(ledger?.du_cuoi_giam || 0),
      Math.round(ledger?.du_cuoi || 0),
    ],
  ];

  const csvContent = csvRows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SoChiTietCongNo_${code}_${fromDate}_${toDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
