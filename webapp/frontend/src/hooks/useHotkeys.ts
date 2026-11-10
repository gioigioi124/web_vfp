import { useEffect, useRef } from "react";

export interface HotkeyHandlers {
  onF2?: () => void;
  onCtrlF2?: () => void;
  onF3?: () => void;
  onCtrlF3?: () => void;
  onF4?: () => void;
  onF6?: () => void;
  onF7?: () => void;
  onPreview?: () => void; // Shift+F7 và Ctrl+F7 (VFP alias)
  onF8?: () => void;
  onF9?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onCtrlA?: () => void;
  onCtrlU?: () => void;
  onCtrlHome?: () => void;
  onCtrlEnd?: () => void;
  onCtrlF?: () => void;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    return [
      "text",
      "search",
      "email",
      "password",
      "tel",
      "url",
      "number",
      "date",
    ].includes(t);
  }
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/**
 * Xử lý phím tắt giống hệt VFP (ctbhh / ctbhd / ctbhch).
 * Xem plan.md §7.2 — dùng đúng F2/F3/F4/F6/F7/F8/F9, Shift+F7, Ctrl+F7,
 * Ctrl+A, Ctrl+U, Ctrl+Home, Ctrl+End, Space, Enter, Esc.
 */
export function useHotkeys(
  handlers: HotkeyHandlers,
  isEnabled: boolean = true,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const activeEl = document.activeElement;
      const inText = isTextInput(activeEl);
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key;

      // 1. Ctrl+Home / Ctrl+End — điều hướng danh sách
      if (ctrl && key === "Home") {
        e.preventDefault();
        h.onCtrlHome?.();
        return;
      }
      if (ctrl && key === "End") {
        e.preventDefault();
        h.onCtrlEnd?.();
        return;
      }

      // 2. Ctrl+F7 — VFP alias sang Shift+F7 (xem trước)
      if (ctrl && key === "F7") {
        e.preventDefault();
        h.onPreview?.();
        return;
      }
      // Shift+F7 — xem trước
      if (e.shiftKey && key === "F7") {
        e.preventDefault();
        h.onPreview?.();
        return;
      }

      // 3. Ctrl+F2 (SaveAs) và Ctrl+F3 (sửa mẫu in)
      if (ctrl && key === "F2") {
        e.preventDefault();
        h.onCtrlF2?.();
        return;
      }
      if (ctrl && key === "F3") {
        e.preventDefault();
        h.onCtrlF3?.();
        return;
      }

      // 4. Ctrl+A — chọn tất cả (chỉ khi không ở ô nhập text)
      if (ctrl && key.toLowerCase() === "a") {
        if (!inText) {
          e.preventDefault();
          h.onCtrlA?.();
        }
        return;
      }
      // 5. Ctrl+U — bỏ chọn tất cả
      if (ctrl && key.toLowerCase() === "u") {
        e.preventDefault();
        h.onCtrlU?.();
        return;
      }
      // 6. Ctrl+F — VFP dùng cho Danh_So_Ct (KHÔNG phải mở lọc)
      if (ctrl && key.toLowerCase() === "f") {
        e.preventDefault();
        h.onCtrlF?.();
        return;
      }

      // 7. Các phím chức năng đơn (luôn chặn hành vi mặc định của trình duyệt)
      switch (key) {
        case "F2":
          e.preventDefault();
          h.onF2?.();
          return;
        case "F3":
          e.preventDefault();
          h.onF3?.();
          return;
        case "F4":
          e.preventDefault();
          h.onF4?.();
          return;
        case "F6":
          e.preventDefault();
          h.onF6?.();
          return;
        case "F7":
          e.preventDefault();
          h.onF7?.();
          return;
        case "F8":
          e.preventDefault();
          h.onF8?.();
          return;
        case "F9":
          e.preventDefault();
          h.onF9?.();
          return;
        case "Escape":
          h.onEscape?.();
          return;
      }

      // 8. Enter / Space — chỉ khi không ở ô nhập text hoặc button
      const inButton = activeEl instanceof HTMLButtonElement;
      if (key === "Enter" && !inText && !inButton) {
        e.preventDefault();
        h.onEnter?.();
        return;
      }
      if (key === " " && !inText && !inButton) {
        e.preventDefault();
        h.onSpace?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled]);
}
