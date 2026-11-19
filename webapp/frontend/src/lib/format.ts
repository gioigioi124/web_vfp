const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});
const FX_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const QTY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function formatCurrency(
  amount?: number | null,
  currency: string = "VND",
): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0";
  if (currency === "VND") {
    return VND_FORMATTER.format(Math.round(amount));
  }
  return FX_FORMATTER.format(amount);
}

export function formatQuantity(qty?: number | null): string {
  if (qty === null || qty === undefined || isNaN(qty)) return "0";
  return QTY_FORMATTER.format(Math.round(qty * 100) / 100);
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

/**
 * Định dạng số 2 chữ số thập phân gọn: phân nhóm nghìn bằng dấu cách,
 * chỉ hiện phần thập phân (tối đa 2 số, bỏ 0 dư) khi khác số nguyên.
 * VD: 1000 -> "1 000", 1234.5 -> "1 234.5", 2.88 -> "2.88"
 */
export function formatCompactNumber(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(2);
  if (fixed === "0.00") return "0";
  const [intPart, rawDec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const dec = rawDec.replace(/0+$/, "");
  return `${neg ? "-" : ""}${dec ? `${grouped}.${dec}` : grouped}`;
}

/**
 * Bỏ mọi ký tự phân nhóm để parse số người dùng nhập/dán.
 * Hỗ trợ cả định dạng chuẩn Mỹ/VFP ("1 250 000.5", "1,250,000.5")
 * và định dạng Việt Nam dùng dấu chấm phân nhóm nghìn ("1.250.000", "1.250.000,5").
 */
export function parseNumberInput(s: string): number {
  if (!s) return 0;
  const trimmed = s.replace(/\s+/g, "").trim();
  if (!trimmed) return 0;

  let normalized: string;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) {
    // Dạng Việt Nam: "1.250.000" hoặc "1.250.000,5" hoặc "250.000"
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+,\d{1,2}$/.test(trimmed)) {
    // Số thập phân dùng dấu phẩy đơn lẻ: "12,5" hoặc "0,75"
    normalized = trimmed.replace(",", ".");
  } else {
    // Chuẩn VFP/US: dấu phẩy là phân nhóm nghìn, dấu chấm là thập phân
    normalized = trimmed.replace(/,/g, "");
  }

  const cleaned = normalized.replace(/[^\d.\-]/g, "");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

/**
 * Định dạng chuỗi số ngay lúc đang gõ (phân nhóm nghìn/triệu bằng dấu cách),
 * đồng thời giữ đúng vị trí con trỏ.
 */
export function formatLiveNumberInput(
  raw: string,
  caret: number,
  allowDecimal: boolean = true,
): { formatted: string; caret: number } {
  if (!raw) return { formatted: "", caret: 0 };

  let rawBeforeCaret = 0;
  let seenDotBefore = false;
  const limit = Math.min(Math.max(0, caret), raw.length);
  for (let i = 0; i < limit; i++) {
    const ch = raw[i];
    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "-" && i === 0) ||
      (allowDecimal && ch === "." && !seenDotBefore)
    ) {
      if (ch === ".") seenDotBefore = true;
      rawBeforeCaret += 1;
    }
  }

  const isNeg = raw.trimStart().startsWith("-");
  let cleanedBody = "";
  let seenDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      cleanedBody += ch;
    } else if (allowDecimal && ch === "." && !seenDot) {
      seenDot = true;
      cleanedBody += ch;
    }
  }

  if (!cleanedBody && !isNeg) return { formatted: "", caret: 0 };
  if (!cleanedBody && isNeg) {
    return { formatted: "-", caret: rawBeforeCaret > 0 ? 1 : 0 };
  }

  const dotIdx = cleanedBody.indexOf(".");
  let intPart = dotIdx >= 0 ? cleanedBody.slice(0, dotIdx) : cleanedBody;
  const decPart = dotIdx >= 0 ? cleanedBody.slice(dotIdx) : "";

  if (!intPart && dotIdx >= 0) {
    intPart = "0";
    if (rawBeforeCaret > 0) rawBeforeCaret += 1;
  } else if (intPart.length > 1) {
    const stripped = intPart.replace(/^0+/, "") || "0";
    const diff = intPart.length - stripped.length;
    if (diff > 0) {
      rawBeforeCaret = Math.max(0, rawBeforeCaret - diff);
    }
    intPart = stripped;
  }

  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formatted = `${isNeg ? "-" : ""}${groupedInt}${decPart}`;

  if (rawBeforeCaret <= 0) return { formatted, caret: 0 };
  let seen = 0;
  let nextCaret = formatted.length;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== " ") {
      seen += 1;
      if (seen === rawBeforeCaret) {
        nextCaret = i + 1;
        break;
      }
    }
  }
  return { formatted, caret: nextCaret };
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
