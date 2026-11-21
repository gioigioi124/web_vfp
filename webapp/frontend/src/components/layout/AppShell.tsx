import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Menu, Search, User } from "lucide-react";
import { isModalOpen } from "../../lib/modalLock";
import { ALL_NAV_ITEMS } from "../../config/accountingModules";
import { useIsCompactLayout } from "../../hooks/useViewport";
import { AccountingSidebar } from "./AccountingSidebar";
import { QuickJumpModal } from "./QuickJumpModal";

const SIDEBAR_COLLAPSED_KEY = "accountingSidebar.collapsed";
const SIDEBAR_WIDTH_KEY = "accountingSidebar.width";
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 210;
const MAX_SIDEBAR_WIDTH = 360;
const OPEN_THRESHOLD_PX = 72;
const COLLAPSE_THRESHOLD_PX = 120;

function loadSavedWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= MIN_SIDEBAR_WIDTH && n <= MAX_SIDEBAR_WIDTH) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export const AppShell: React.FC = () => {
  const isCompactLayout = useIsCompactLayout();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSavedWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);

  // Auto-close overlay drawer whenever route changes on mobile/tablet
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const activeNavItem = useMemo(
    () =>
      ALL_NAV_ITEMS.find(
        (it) =>
          location.pathname === it.route ||
          location.pathname.startsWith(`${it.route}/`),
      ) || ALL_NAV_ITEMS.find((it) => it.id === "X1"),
    [location.pathname],
  );

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const persistWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w));
    setSidebarWidth(clamped);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    if (isCompactLayout) {
      setMobileDrawerOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [isCompactLayout]);

  // Dragging from left edge (when collapsed) or right edge (when open) - desktop only
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startEdgeDrag = useCallback(
    (mode: "open-from-left" | "resize-from-right", startClientX: number) => {
      if (isCompactLayout) return;
      dragCleanupRef.current?.();
      let moved = false;
      let latestWidth = mode === "open-from-left" ? 0 : sidebarWidth;

      const onMove = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - startClientX) > 3) {
          moved = true;
        }
        const nextW = Math.max(0, Math.min(MAX_SIDEBAR_WIDTH, ev.clientX));
        latestWidth = nextW;
        setDragWidth(nextW);
      };

      const onFinish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onFinish);
        window.removeEventListener("pointercancel", onFinish);
        dragCleanupRef.current = null;
        setDragWidth(null);

        if (mode === "open-from-left") {
          if (!moved || latestWidth >= OPEN_THRESHOLD_PX) {
            persistCollapsed(false);
            if (latestWidth >= MIN_SIDEBAR_WIDTH) {
              persistWidth(latestWidth);
            }
          } else {
            persistCollapsed(true);
          }
        } else {
          if (moved && latestWidth < COLLAPSE_THRESHOLD_PX) {
            persistCollapsed(true);
          } else if (moved) {
            persistCollapsed(false);
            persistWidth(latestWidth);
          }
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onFinish);
      window.addEventListener("pointercancel", onFinish);
      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onFinish);
        window.removeEventListener("pointercancel", onFinish);
      };
    },
    [isCompactLayout, sidebarWidth, persistCollapsed, persistWidth],
  );

  // Desktop only: left edge viewport grab (disabled on mobile/tablet to avoid OS back-swipe conflict)
  useEffect(() => {
    if (isCompactLayout || !collapsed) return;
    const onGlobalPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.clientX > 10 || isModalOpen()) return;
      if ((e.target as HTMLElement | null)?.dataset?.edgeGrab === "true") return;
      e.preventDefault();
      startEdgeDrag("open-from-left", e.clientX);
    };
    window.addEventListener("pointerdown", onGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", onGlobalPointerDown);
  }, [isCompactLayout, collapsed, startEdgeDrag]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCompactLayout && mobileDrawerOpen) {
        e.preventDefault();
        setMobileDrawerOpen(false);
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() === "k" || e.code === "KeyK") {
        if (isModalOpen()) return;
        e.preventDefault();
        setIsQuickJumpOpen(true);
      } else if (e.key.toLowerCase() === "b" || e.code === "KeyB") {
        if (isModalOpen()) return;
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCompactLayout, mobileDrawerOpen, toggleCollapse]);

  const isDragging = !isCompactLayout && dragWidth !== null;
  const effectiveWidth = isDragging ? dragWidth : collapsed ? 0 : sidebarWidth;
  const innerWidth = Math.max(sidebarWidth, effectiveWidth);

  return (
    <div
      className={`relative flex h-[100dvh] w-full overflow-hidden bg-surface ${
        isDragging ? "select-none cursor-ew-resize" : ""
      }`}
    >
      {/* Desktop Push Sidebar (>= 1024px) */}
      {!isCompactLayout && (
        <AccountingSidebar
          width={effectiveWidth}
          innerWidth={innerWidth}
          isDragging={isDragging}
          onCollapse={() => persistCollapsed(true)}
          onOpenQuickJump={() => setIsQuickJumpOpen(true)}
          onStartResizeFromRightEdge={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startEdgeDrag("resize-from-right", e.clientX);
          }}
        />
      )}

      {/* Mobile / Tablet Overlay Drawer (< 1024px) */}
      {isCompactLayout && mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-neutral-950/60 backdrop-blur-[1px] animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMobileDrawerOpen(false);
            }
          }}
        >
          <div className="h-full w-[82vw] max-w-[300px] shadow-2xl pt-safe pb-safe bg-neutral-950">
            <AccountingSidebar
              width={300}
              innerWidth={300}
              isDragging={false}
              isOverlay
              onCollapse={() => setMobileDrawerOpen(false)}
              onOpenQuickJump={() => {
                setMobileDrawerOpen(false);
                setIsQuickJumpOpen(true);
              }}
              onStartResizeFromRightEdge={() => {}}
            />
          </div>
        </div>
      )}

      {/* Desktop Left-edge drag-to-open strip & floating pull tab */}
      {!isCompactLayout && collapsed && dragWidth === null && (
        <div
          data-edge-grab="true"
          role="button"
          tabIndex={0}
          aria-label="Kéo từ mép trái hoặc bấm để mở Sidebar phần hành"
          title="Kéo từ mép trái sang phải hoặc bấm để mở Sidebar (Ctrl+B)"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startEdgeDrag("open-from-left", e.clientX);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              persistCollapsed(false);
            }
          }}
          className="group fixed left-0 top-0 bottom-0 w-3 z-40 cursor-ew-resize touch-none flex items-center"
        >
          <div className="w-[3px] h-full bg-transparent group-hover:bg-primary-600/80 transition-colors" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-14 rounded-r-md bg-neutral-900/75 group-hover:bg-primary-700 text-neutral-300 group-hover:text-white border border-l-0 border-neutral-700 group-hover:border-primary-500 shadow flex items-center justify-center opacity-55 group-hover:opacity-100 group-hover:w-5 transition-all">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Compact Mobile/Tablet Top Navigation Bar (< 1024px) */}
        {isCompactLayout && (
          <div className="h-12 pt-safe bg-neutral-950 text-white border-b border-neutral-800 px-2 flex items-center justify-between gap-2 shrink-0 z-30">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Mở danh mục phần hành"
                className="w-11 h-11 -ml-1 rounded-lg flex items-center justify-center text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700 cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary-700 text-white border border-primary-500/60 shrink-0">
                  {activeNavItem?.shortCode || "1S"}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {activeNavItem?.label || "Kế toán 1S"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsQuickJumpOpen(true)}
                aria-label="Tìm nhanh phần hành"
                className="h-10 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-800 text-neutral-300 flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Search className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Tìm nhanh</span>
              </button>
              <div className="h-9 px-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center gap-1 text-[11px] text-neutral-300">
                <User className="w-3.5 h-3.5 text-primary-300" />
                <span className="font-semibold">KTCN3</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>

      <QuickJumpModal
        isOpen={isQuickJumpOpen}
        onClose={() => setIsQuickJumpOpen(false)}
      />
    </div>
  );
};

