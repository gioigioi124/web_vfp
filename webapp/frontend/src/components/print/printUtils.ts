/**
 * Định dạng số tiền/giá theo mẫu HD2259 Template (dấu chấm phân tách hàng nghìn, 0 hiển thị trống).
 */
export function formatVfpNum(
  value?: number | null,
  decimals: number = 0,
): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  if (Math.abs(value) < 1e-9) return "";
  const neg = value < 0;
  const absVal = Math.abs(value);
  const fixed =
    decimals > 0
      ? absVal.toFixed(decimals)
      : Math.round(absVal).toString();
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `,${decPart}` : ""}`;
}

/**
 * Định dạng số lượng / hệ số gọn theo mẫu HD2259 Template:
 * bỏ phần `.00` nếu là số nguyên, tối đa 2 chữ số thập phân gọn nếu có lẻ, phân nhóm nghìn bằng dấu chấm.
 */
export function formatQtyNum(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  if (Math.abs(value) < 1e-9) return "";
  const neg = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    const groupedInt = Math.round(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${neg ? "-" : ""}${groupedInt}`;
  }
  const fixed = rounded.toFixed(2).replace(/\.?0+$/, "");
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `,${decPart}` : ""}`;
}
