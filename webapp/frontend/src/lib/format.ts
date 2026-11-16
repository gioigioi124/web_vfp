export function formatCurrency(
  amount?: number | null,
  currency: string = "VND",
): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0";
  if (currency === "VND") {
    return Math.round(amount).toLocaleString("vi-VN");
  }
  return Number(amount.toFixed(2)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatQuantity(qty?: number | null): string {
  if (qty === null || qty === undefined || isNaN(qty)) return "0";
  return Number(qty.toFixed(2)).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
}

/**
 * Định dạng số 2 chữ số thập phân, phân nhóm nghìn bằng dấu cách.
 * VD: 1234567.5 -> "1 234 567.50"
 */
export function formatNumber2(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "0.00";
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}.${decPart}`;
}

/**
 * Định dạng số nguyên đã làm tròn, phân nhóm nghìn bằng dấu cách (dùng cho Thành tiền VND).
 * VD: 1234567.6 -> "1 234 568"
 */
export function formatNumber0(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const rounded = Math.round(n);
  const neg = rounded < 0;
  const intPart = Math.abs(rounded).toString();
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}`;
}

/** Bỏ mọi ký tự phân nhóm (dấu cách, dấu phẩy) để parse số người dùng nhập. */
export function parseNumberInput(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[\s,]/g, "").replace(/[^\d.\-]/g, "");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
