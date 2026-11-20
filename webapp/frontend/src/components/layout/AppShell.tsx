import React, { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { isModalOpen } from "../../lib/modalLock";
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
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Dragging from left edge (when collapsed) or right edge (when open)
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startEdgeDrag = useCallback(
    (mode: "open-from-left" | "resize-from-right", startClientX: number) => {
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
    [sidebarWidth, persistCollapsed, persistWidth],
  );

  // Also allow grabbing right from the very left edge of the viewport (<= 10px) when collapsed
  useEffect(() => {
    if (!collapsed) return;
    const onGlobalPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.clientX > 10 || isModalOpen()) return;
      // Avoid intercepting if handled directly by the edge handle
      if ((e.target as HTMLElement | null)?.dataset?.edgeGrab === "true") return;
      e.preventDefault();
      startEdgeDrag("open-from-left", e.clientX);
    };
    window.addEventListener("pointerdown", onGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", onGlobalPointerDown);
  }, [collapsed, startEdgeDrag]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
  }, [toggleCollapse]);

  const isDragging = dragWidth !== null;
  const effectiveWidth = isDragging ? dragWidth : collapsed ? 0 : sidebarWidth;
  const innerWidth = Math.max(sidebarWidth, effectiveWidth);

  return (
    <div
      className={`relative flex h-screen w-screen overflow-hidden bg-surface ${
        isDragging ? "select-none cursor-ew-resize" : ""
      }`}
    >
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

      {/* Left-edge drag-to-open strip & floating pull tab when fully collapsed */}
      {collapsed && dragWidth === null && (
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
          {/* Thin highlight rail on hover */}
          <div className="w-[3px] h-full bg-transparent group-hover:bg-primary-600/80 transition-colors" />
          {/* Subtle pull handle */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-14 rounded-r-md bg-neutral-900/75 group-hover:bg-primary-700 text-neutral-300 group-hover:text-white border border-l-0 border-neutral-700 group-hover:border-primary-500 shadow flex items-center justify-center opacity-55 group-hover:opacity-100 group-hover:w-5 transition-all">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </div>

      <QuickJumpModal
        isOpen={isQuickJumpOpen}
        onClose={() => setIsQuickJumpOpen(false)}
      />
    </div>
  );
};
