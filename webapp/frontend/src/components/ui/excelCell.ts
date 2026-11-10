import React, { useCallback, useRef, useState } from "react";

/**
 * Chế độ của một ô trong grid kiểu Excel:
 * - "select": ô đang được CHỌN (viền đậm), chưa sửa. Mũi tên di chuyển ô, gõ phím
 *             bất kỳ sẽ thay thế nội dung và chuyển sang "enter".
 * - "enter" : đang nhập (bắt đầu bằng gõ phím). Mũi tên = xác nhận + di chuyển ô.
 * - "edit"  : đang sửa (F2 / double-click). ← → di chuyển con trỏ trong chữ.
 */
export type ExcelCellMode = "select" | "enter" | "edit";

export function useExcelCellMode() {
  const [mode, setModeState] = useState<ExcelCellMode>("select");
  const modeRef = useRef<ExcelCellMode>("select");
  const setMode = useCallback((m: ExcelCellMode) => {
    modeRef.current = m;
    setModeState(m);
  }, []);
  return { mode, modeRef, setMode };
}

/** Phím ký tự in được (bắt đầu nhập đè kiểu Excel). */
export function isPrintableKey(e: React.KeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** Bôi đen toàn bộ nội dung (sau khi focus ổn định). */
export function selectAllLater(el: HTMLInputElement) {
  window.setTimeout(() => {
    if (document.activeElement === el) el.select();
  }, 0);
}

/** Đặt con trỏ ở cuối chữ (vào chế độ sửa). */
export function caretToEndLater(el: HTMLInputElement) {
  window.setTimeout(() => {
    if (document.activeElement === el) {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    }
  }, 0);
}

/**
 * MouseDown kiểu Excel: ở chế độ "select", click chỉ CHỌN ô (không đặt con trỏ),
 * giữ nguyên trạng thái bôi đen để gõ phím sẽ thay thế toàn bộ nội dung.
 * Ở chế độ sửa thì để trình duyệt xử lý bình thường (đặt con trỏ).
 */
export function handleExcelMouseDown(
  e: React.MouseEvent<HTMLInputElement>,
  mode: ExcelCellMode,
) {
  if (e.button !== 0) return;
  const el = e.currentTarget;
  if (el.disabled) return;
  if (mode !== "select" && document.activeElement === el) return;
  e.preventDefault();
  if (document.activeElement !== el) el.focus();
  el.select();
}

/** Mũi tên -> hướng điều hướng. */
export function arrowDir(
  key: string,
): "up" | "down" | "left" | "right" | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}
