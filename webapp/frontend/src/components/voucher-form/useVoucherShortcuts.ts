import React, { useEffect, useRef } from "react";
import { isModalOpen } from "../../lib/modalLock";

export interface UseVoucherShortcutsParams {
  isEditable: boolean;
  isSuspended: boolean;
  isWarehouse: boolean;
  saving: boolean;
  activeRowIndex: number;
  onViewDebt?: (maDt: string) => void;
  openDebtLedger: () => void;
  requestClose: () => void;
  handleSave: (bypassChecks: boolean) => Promise<void>;
  handleDeleteItem: (idx: number) => void;
  handleAddItem: () => void;
  handleDuplicateRow: (idx?: number) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleOpenPriceCalc: () => void;
  onOpenAccountPicker: () => void;
  maDtInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

/**
 * Global keyboard shortcuts for VoucherForm:
 * Ctrl+Enter / Shift+Enter (save), Esc (close), F8 (delete row), F4 (account picker),
 * F5 (price calculator), Ctrl+Shift+E (debt), Ctrl+Shift+D (duplicate row),
 * Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (undo/redo), Ctrl+Q (focus customer), Ctrl+ / Ctrl- (add/delete row).
 */
export function useVoucherShortcuts(params: UseVoucherShortcutsParams) {
  const ctxRef = useRef(params);
  ctxRef.current = params;

  // Keyboard shortcut listener for Ctrl+Enter / Esc / F8 / F4 / Undo / Redo / Duplicate (attached once)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctx = ctxRef.current;
      // Khi có dialog đang mở (PickupDialog / DebtPanel / ...) hoặc form đang bị tạm dừng -> khóa cứng,
      // không cho ESC/Ctrl+Enter/F8/F4 thoát ra ngoài form.
      if (ctx.isSuspended || isModalOpen()) return;
      if (
        ctx.isEditable &&
        !ctx.saving &&
        e.key === "Enter" &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        ctx.handleSave(false);
      } else if (
        ctx.isEditable &&
        !ctx.saving &&
        e.key === "Enter" &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        ctx.handleSave(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "e" || e.code === "KeyE")
      ) {
        if (!ctx.onViewDebt) return;
        e.preventDefault();
        e.stopPropagation();
        ctx.openDebtLedger();
      } else if (
        ctx.isEditable &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "d" || e.code === "KeyD")
      ) {
        // Ctrl+Shift+D = Nhân đôi dòng đang chọn
        e.preventDefault();
        e.stopPropagation();
        ctx.handleDuplicateRow(ctx.activeRowIndex);
      } else if (
        ctx.isEditable &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        ((!e.shiftKey && (e.key.toLowerCase() === "y" || e.code === "KeyY")) ||
          (e.shiftKey && (e.key.toLowerCase() === "z" || e.code === "KeyZ")))
      ) {
        // Ctrl+Y hoặc Ctrl+Shift+Z = Làm lại (Redo) trên lưới hàng hóa
        const activeEl = document.activeElement;
        const inHeaderTextInput =
          activeEl instanceof HTMLInputElement &&
          !activeEl.readOnly &&
          Boolean(activeEl.closest('[data-purpose="master-form"]'));
        if (!inHeaderTextInput) {
          e.preventDefault();
          e.stopPropagation();
          ctx.handleRedo();
        }
      } else if (
        ctx.isEditable &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "z" || e.code === "KeyZ")
      ) {
        // Ctrl+Z = Hoàn tác (Undo) trên lưới hàng hóa (giữ undo gốc của trình duyệt cho các ô text header)
        const activeEl = document.activeElement;
        const inHeaderTextInput =
          activeEl instanceof HTMLInputElement &&
          !activeEl.readOnly &&
          Boolean(activeEl.closest('[data-purpose="master-form"]'));
        if (!inHeaderTextInput) {
          e.preventDefault();
          e.stopPropagation();
          ctx.handleUndo();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        ctx.requestClose();
      } else if (e.key === "F8" && ctx.isEditable) {
        e.preventDefault();
        ctx.handleDeleteItem(ctx.activeRowIndex);
      } else if (e.key === "F4" && ctx.isEditable && !ctx.isWarehouse) {
        e.preventDefault();
        ctx.onOpenAccountPicker();
      } else if (
        ctx.isEditable &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === "q" || e.code === "KeyQ")
      ) {
        // Ctrl+Q = focus và bôi đen ô Mã đối tượng
        e.preventDefault();
        e.stopPropagation();
        if (ctx.maDtInputRef.current) {
          ctx.maDtInputRef.current.focus();
          ctx.maDtInputRef.current.select();
        }
      } else if (
        ctx.isEditable &&
        e.ctrlKey &&
        (e.code === "NumpadAdd" ||
          e.key === "+" ||
          e.key === "=" ||
          e.code === "Equal")
      ) {
        // Ctrl + (numpad hoặc phím +/=) = thêm dòng
        e.preventDefault();
        ctx.handleAddItem();
      } else if (
        ctx.isEditable &&
        e.ctrlKey &&
        (e.code === "NumpadSubtract" || e.key === "-")
      ) {
        // Ctrl - (numpad) = xóa dòng đang chọn
        e.preventDefault();
        ctx.handleDeleteItem(ctx.activeRowIndex);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Khóa hẳn phím F5 tải lại trang trong VoucherForm; khi đang thêm/sửa sẽ mở Máy tính đơn giá cho dòng đang chọn.
  useEffect(() => {
    const handleF5Capture = (e: KeyboardEvent) => {
      const ctx = ctxRef.current;
      if (ctx.isSuspended) return;
      if (
        e.key !== "F5" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      ctx.handleOpenPriceCalc();
    };
    window.addEventListener("keydown", handleF5Capture, true);
    return () => window.removeEventListener("keydown", handleF5Capture, true);
  }, []);
}
