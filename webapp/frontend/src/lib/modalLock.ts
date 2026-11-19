import { useEffect, RefObject } from "react";

/**
 * Khóa modal toàn cục: khi có ít nhất 1 dialog đang mở, các handler phím ở tầng
 * ngoài (VoucherForm / App) phải bỏ qua để ESC/Enter/Space không thoát ra ngoài.
 */
let openCount = 0;

export function pushModal(): void {
  openCount += 1;
}

export function popModal(): void {
  openCount = Math.max(0, openCount - 1);
}

export function isModalOpen(): boolean {
  return openCount > 0;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisibleFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isVisibleFocusable,
  );
}

/**
 * Gắn hành vi modal cho một dialog:
 * - Tăng/giảm bộ đếm modal (để tầng ngoài biết mà khóa phím).
 * - Lưu và khôi phục focus của phần tử trước khi mở dialog.
 * - Tự focus phần tử `[data-autofocus]` (hoặc phần tử focusable đầu tiên).
 * - Giữ focus (Tab/Shift+Tab) luẩn quẩn trong dialog kể cả khi focus đang ở body.
 */
export function useModalLock(
  isOpen: boolean,
  containerRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    pushModal();

    const root = containerRef?.current ?? null;

    // Focus phần tử ưu tiên sau khi dialog render xong.
    const timer = setTimeout(() => {
      if (!root) return;
      const preferred =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        getFocusable(root)[0];
      if (preferred && isVisibleFocusable(preferred)) {
        preferred.focus();
      } else {
        getFocusable(root)[0]?.focus();
      }
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !root) return;
      const focusables = getFocusable(root);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const insideRoot = active !== null && root.contains(active);

      if (!insideRoot) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      popModal();
      if (previouslyFocused && previouslyFocused.isConnected) {
        requestAnimationFrame(() => {
          if (previouslyFocused.isConnected) {
            previouslyFocused.focus({ preventScroll: true });
          }
        });
      }
    };
  }, [isOpen, containerRef]);
}
