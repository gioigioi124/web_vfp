import React, { useLayoutEffect, useRef, useState } from "react";
import {
  formatCompactNumber,
  formatLiveNumberInput,
  formatNumber0,
  formatNumber2,
  parseNumberInput,
} from "../../lib/format";
import { VfpNavDir } from "../ui/VfpLookupCell";
import {
  arrowDir,
  caretToEndLater,
  handleExcelMouseDown,
  isPrintableKey,
  selectAllLater,
  useExcelCellMode,
} from "../ui/excelCell";

export interface NumCellProps {
  value: number;
  disabled?: boolean;
  /** Khi true: nếu value === 0 (hoặc không có giá trị) thì hiển thị trống (blank) thay vì "0.00". */
  blankWhenZero?: boolean;
  /** Định dạng số nguyên (không có phần thập phân .00 và không phân nhóm nghìn). */
  integerOnly?: boolean;
  /** Làm tròn số nguyên có phân nhóm nghìn bằng dấu cách (VD: Thành tiền VND). */
  noDecimals?: boolean;
  /** Định dạng thập phân gọn: số chẵn bỏ .00, số lẻ hiện tối đa 2 chữ số thập phân. */
  compactDecimals?: boolean;
  dataField?: string;
  className?: string;
  title?: string;
  onCommit: (v: number) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Phím không thuộc điều hướng mũi tên (Enter / Tab / F8 ...). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Điều hướng bằng mũi tên (kiểu Excel). */
  onNavigate?: (dir: VfpNavDir, el: HTMLInputElement) => void;
}

/**
 * Ô nhập số có định dạng 2 chữ số thập phân (xxx xxx xxx.00), hành vi kiểu Excel:
 * - Click / mũi tên: chỉ CHỌN ô (không hiện con trỏ). Mũi tên luôn di chuyển ô.
 * - Gõ phím: nhập đè toàn bộ nội dung (chế độ "enter": mũi tên = xác nhận + di chuyển).
 * - F2 / double-click: sửa nội dung, con trỏ ở cuối chữ (← → di chuyển con trỏ).
 * - Delete: xóa trắng ô (= 0). Esc: hủy nội dung đang sửa, quay về chế độ chọn.
 * - Rời ô / Enter: parse và commit giá trị số.
 */
export const NumCell: React.FC<NumCellProps> = ({
  value,
  disabled,
  blankWhenZero = false,
  integerOnly = false,
  noDecimals = false,
  compactDecimals = false,
  dataField,
  className,
  title,
  onCommit,
  onFocus,
  onKeyDown,
  onNavigate,
}) => {
  const [text, setTextState] = useState<string | null>(null);
  // Bản đồng bộ của `text` để commit() không chạy 2 lần (mũi tên commit + blur).
  const textRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const setText = (t: string | null) => {
    textRef.current = t;
    setTextState(t);
  };
  const { mode, modeRef, setMode } = useExcelCellMode();
  // Cờ hủy: khi Esc -> không commit giá trị đang sửa (khôi phục giá trị cũ).
  const cancelRef = useRef(false);
  const formatVal = (v?: number | null) => {
    if (blankWhenZero && (!v || Number(v) === 0)) return "";
    if (noDecimals) {
      return formatNumber0(v);
    }
    if (integerOnly) {
      if (v === null || v === undefined || isNaN(v)) return "0";
      return Math.round(Number(v)).toString();
    }
    if (compactDecimals) {
      return formatCompactNumber(v);
    }
    return formatNumber2(v);
  };
  const formatted = formatVal(value);
  const display = text !== null ? text : formatted;

  useLayoutEffect(() => {
    const pos = pendingCaretRef.current;
    if (pos === null) return;
    pendingCaretRef.current = null;
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      el.setSelectionRange(pos, pos);
    }
  }, [display]);

  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setText(null);
      return;
    }
    if (textRef.current !== null) {
      const t = textRef.current;
      setText(null);
      const parsed = parseNumberInput(t);
      onCommit(integerOnly ? Math.round(parsed) : parsed);
    }
  };

  // Vào chế độ SỬA: con trỏ ở cuối chữ (không bôi đen) — dùng cho double-click / F2.
  const enterEdit = (el: HTMLInputElement) => {
    setMode("edit");
    setText(formatted);
    caretToEndLater(el);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={integerOnly ? "numeric" : "decimal"}
      autoComplete="off"
      spellCheck={false}
      value={display}
      disabled={false}
      readOnly={disabled}
      tabIndex={disabled ? -1 : undefined}
      data-readonly={disabled ? "true" : undefined}
      data-optional={blankWhenZero ? "true" : undefined}
      data-field={dataField}
      title={title}
      data-mode={mode}
      onChange={(e) => {
        if (disabled) return;
        if (modeRef.current === "select") setMode("enter");
        const val = e.target.value;
        if (integerOnly && !noDecimals) {
          pendingCaretRef.current = null;
          setText(val.replace(/[^\d\-]/g, ""));
          return;
        }
        const live = formatLiveNumberInput(
          val,
          e.target.selectionStart ?? val.length,
          !integerOnly,
        );
        pendingCaretRef.current = live.caret;
        setText(live.formatted);
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        handleExcelMouseDown(e, modeRef.current);
      }}
      onFocus={(e) => {
        if (disabled) {
          onFocus?.(e);
          return;
        }
        // Kiểu Excel: chọn ô -> bôi đen toàn bộ (gõ đè thay thế), chưa vào chế độ sửa.
        setMode("select");
        setText(null);
        selectAllLater(e.currentTarget);
        onFocus?.(e);
      }}
      onDoubleClick={(e) => {
        if (disabled) return;
        enterEdit(e.currentTarget);
      }}
      onBlur={() => {
        if (disabled) return;
        commit();
        setMode("select");
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        const m = modeRef.current;
        const el = e.currentTarget;
        const dir = arrowDir(e.key);
        if (dir) {
          // Chế độ sửa (F2): ← → di chuyển con trỏ trong chữ.
          if (m === "edit" && (dir === "left" || dir === "right")) return;
          e.preventDefault();
          commit();
          setMode("select");
          onNavigate?.(dir, el);
          return;
        }
        if (e.key === "Enter") {
          commit();
          setMode("select");
        } else if (e.key === "F2") {
          e.preventDefault();
          enterEdit(el);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (m !== "select") {
            // Hủy nội dung đang nhập, ở lại ô (giống Excel).
            setText(null);
            setMode("select");
            selectAllLater(el);
          } else {
            cancelRef.current = true;
            setText(null);
            el.blur();
          }
          return;
        } else if (m === "select" && e.key === "Delete") {
          // Delete ở chế độ chọn: xóa trắng ô.
          e.preventDefault();
          onCommit(0);
          setText(null);
          selectAllLater(el);
          return;
        } else if (m === "select" && isPrintableKey(e)) {
          // Gõ đè: nội dung đang bôi đen sẽ được thay bằng ký tự vừa gõ.
          setMode("enter");
          return;
        }
        onKeyDown?.(e);
      }}
      className={className}
    />
  );
};
