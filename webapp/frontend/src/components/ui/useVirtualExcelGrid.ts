import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { arrowDir } from "./excelCell";
import { copyGridCellValue, ensureGridRowVisible } from "./useExcelGridNav";

export interface UseVirtualExcelGridOptions {
  totalRows: number;
  /** Scroll container holding the <table> with sticky <thead>. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Estimated row height in px before measuring first <tr>. Matches .xl-grid (~25px). */
  estimatedRowHeight?: number;
  /** Extra rows rendered above and below viewport for smooth scrolling & arrow nav. */
  overscan?: number;
  /** Only virtualize when totalRows exceeds this threshold (default 80). */
  threshold?: number;
  /** Called whenever active row changes by keyboard navigation. */
  onSelectRow?: (rowIndex: number) => void;
  /** Called when Enter is pressed on a row. */
  onEnterRow?: (rowIndex: number) => void;
  /** Called when Space is pressed on a row (e.g. checkbox mark). */
  onSpaceRow?: (rowIndex: number) => void;
}

export interface VirtualExcelWindow {
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  isVirtualized: boolean;
  rowHeight: number;
}

/**
 * High-performance viewport virtualizer + Excel keyboard navigation for large tables (10,000+ rows).
 * Keeps DOM size constant (~30-45 rows) regardless of dataset length while preserving exact
 * Sales-Invoice `.xl-grid` keyboard navigation (`Arrow*`, `Tab`, `PageUp/Down`, `Ctrl+Home/End`, `Ctrl+C`).
 */
export function useVirtualExcelGrid(options: UseVirtualExcelGridOptions) {
  const {
    totalRows,
    scrollContainerRef,
    estimatedRowHeight = 25,
    overscan = 10,
    threshold = 80,
    onSelectRow,
    onEnterRow,
    onSpaceRow,
  } = options;

  const [rowHeight, setRowHeight] = useState<number>(estimatedRowHeight);
  const [scrollState, setScrollState] = useState<{ top: number; height: number }>({
    top: 0,
    height: 480,
  });

  const rafRef = useRef<number | null>(null);
  const pendingFocusRef = useRef<{ rowIndex: number; colIndex: number } | null>(
    null,
  );

  const syncScrollMetrics = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nextTop = el.scrollTop;
    const nextHeight = el.clientHeight || 480;
    setScrollState((prev) =>
      Math.abs(prev.top - nextTop) < 1 && Math.abs(prev.height - nextHeight) < 1
        ? prev
        : { top: nextTop, height: nextHeight },
    );
  }, [scrollContainerRef]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      syncScrollMetrics();
    });
  }, [syncScrollMetrics]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    syncScrollMetrics();
    el.addEventListener("scroll", handleScroll, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => syncScrollMetrics());
      ro.observe(el);
    }
    return () => {
      el.removeEventListener("scroll", handleScroll);
      ro?.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scrollContainerRef, handleScroll, syncScrollMetrics]);

  const isVirtualized = totalRows > threshold;

  const windowMetrics: VirtualExcelWindow = useMemo(() => {
    if (!isVirtualized || totalRows === 0) {
      return {
        startIndex: 0,
        endIndex: totalRows,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        isVirtualized: false,
        rowHeight,
      };
    }
    const headerReserve = 32;
    const effectiveTop = Math.max(0, scrollState.top - headerReserve);
    const visibleCount = Math.max(
      1,
      Math.ceil(scrollState.height / Math.max(16, rowHeight)),
    );
    const rawStart = Math.floor(effectiveTop / Math.max(16, rowHeight)) - overscan;
    const startIndex = Math.max(0, Math.min(totalRows - 1, rawStart));
    const endIndex = Math.min(totalRows, rawStart + visibleCount + overscan * 2);

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * rowHeight,
      bottomSpacerHeight: Math.max(0, (totalRows - endIndex) * rowHeight),
      isVirtualized: true,
      rowHeight,
    };
  }, [isVirtualized, totalRows, scrollState.top, scrollState.height, rowHeight, overscan]);

  // Measure actual rendered row height once rows exist to keep spacer math exact.
  useLayoutEffect(() => {
    if (!totalRows) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const firstRow = el.querySelector<HTMLTableRowElement>("tbody tr[data-vrow]");
    if (firstRow) {
      const measured = firstRow.getBoundingClientRect().height;
      if (measured >= 18 && measured <= 60 && Math.abs(measured - rowHeight) >= 0.75) {
        setRowHeight(measured);
      }
    }
  }, [totalRows, windowMetrics.startIndex, scrollContainerRef, rowHeight]);

  // Complete deferred cell focus after virtualizer mounts the scrolled target row.
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetRowEl = el.querySelector<HTMLTableRowElement>(
      `tbody tr[data-vrow="${pending.rowIndex}"]`,
    );
    if (!targetRowEl) return;
    pendingFocusRef.current = null;
    const targetCell = targetRowEl.children[pending.colIndex] as
      | HTMLElement
      | undefined;
    const targetInput =
      targetCell?.querySelector<HTMLInputElement>("input.xl-input") ||
      targetCell?.querySelector<HTMLInputElement>("input") ||
      targetRowEl.querySelector<HTMLInputElement>("input.xl-input");
    if (targetInput) {
      targetInput.focus({ preventScroll: true });
      targetInput.select();
    }
  });

  const scrollToRow = useCallback(
    (rowIndex: number) => {
      const container = scrollContainerRef.current;
      if (!container || totalRows <= 0) return;
      const clamped = Math.max(0, Math.min(totalRows - 1, rowIndex));

      const mounted = container.querySelector<HTMLTableRowElement>(
        `tbody tr[data-vrow="${clamped}"]`,
      );
      if (mounted) {
        ensureGridRowVisible(mounted);
        syncScrollMetrics();
        return;
      }

      const thead = container.querySelector("thead");
      const headerHeight = thead ? thead.getBoundingClientRect().height : 28;
      const rowTop = headerHeight + clamped * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const visibleTop = container.scrollTop + headerHeight;
      const visibleBottom = container.scrollTop + container.clientHeight;

      if (rowTop < visibleTop) {
        container.scrollTop = Math.max(0, rowTop - headerHeight);
      } else if (rowBottom > visibleBottom) {
        container.scrollTop = Math.max(0, rowBottom - container.clientHeight);
      }
      syncScrollMetrics();
    },
    [scrollContainerRef, totalRows, rowHeight, syncScrollMetrics],
  );

  const navigateToCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (totalRows <= 0) return;
      const targetRow = Math.max(0, Math.min(totalRows - 1, rowIndex));
      onSelectRow?.(targetRow);

      const container = scrollContainerRef.current;
      const mountedRow = container?.querySelector<HTMLTableRowElement>(
        `tbody tr[data-vrow="${targetRow}"]`,
      );
      if (mountedRow) {
        ensureGridRowVisible(mountedRow);
        const targetCell = mountedRow.children[colIndex] as HTMLElement | undefined;
        const targetInput =
          targetCell?.querySelector<HTMLInputElement>("input.xl-input") ||
          targetCell?.querySelector<HTMLInputElement>("input") ||
          mountedRow.querySelector<HTMLInputElement>("input.xl-input");
        if (targetInput) {
          targetInput.focus({ preventScroll: true });
          targetInput.select();
          return;
        }
      }

      pendingFocusRef.current = { rowIndex: targetRow, colIndex };
      scrollToRow(targetRow);
    },
    [totalRows, onSelectRow, scrollContainerRef, scrollToRow],
  );

  const handleCellCopy = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      copyGridCellValue(e);
    },
    [],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.blur();
        return;
      }

      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.altKey &&
        onEnterRow
      ) {
        e.preventDefault();
        e.stopPropagation();
        onEnterRow(rowIndex);
        return;
      }

      if (
        e.key === " " &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.altKey &&
        onSpaceRow
      ) {
        e.preventDefault();
        e.stopPropagation();
        onSpaceRow(rowIndex);
        return;
      }

      const el = e.currentTarget;
      const tr = el.closest("tr");
      const td = el.closest("td");
      const colIndex = tr && td ? Array.from(tr.children).indexOf(td) : 1;

      const dir = arrowDir(e.key);
      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        const delta = dir === "down" ? 1 : -1;
        navigateToCell(rowIndex + delta, colIndex);
        return;
      }

      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        e.stopPropagation();
        const container = scrollContainerRef.current;
        const pageRows = Math.max(
          5,
          Math.floor(((container?.clientHeight || 400) - 32) / rowHeight) - 1,
        );
        const delta = e.key === "PageDown" ? pageRows : -pageRows;
        navigateToCell(rowIndex + delta, colIndex);
        return;
      }

      if ((e.key === "Home" || e.key === "End") && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        navigateToCell(e.key === "Home" ? 0 : Math.max(0, totalRows - 1), colIndex);
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (!tr) return;
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>("input.xl-input:not([disabled])"),
        );
        const idx = rowInputs.indexOf(el);
        if (idx < 0) return;
        const forward = dir === "right" || (e.key === "Tab" && !e.shiftKey);
        const targetIdx = forward ? idx + 1 : idx - 1;
        if (targetIdx >= 0 && targetIdx < rowInputs.length) {
          rowInputs[targetIdx].focus({ preventScroll: true });
          rowInputs[targetIdx].select();
          return;
        }
        if (e.key === "Tab") {
          const nextRow = rowIndex + (forward ? 1 : -1);
          if (nextRow >= 0 && nextRow < totalRows) {
            const cells = Array.from(tr.children);
            const firstInputCol = cells.findIndex((c) =>
              Boolean(c.querySelector("input.xl-input")),
            );
            let lastInputCol = cells.length - 1;
            for (let i = cells.length - 1; i >= 0; i--) {
              if (cells[i].querySelector("input.xl-input")) {
                lastInputCol = i;
                break;
              }
            }
            const wrapCellCol = forward
              ? Math.max(0, firstInputCol)
              : lastInputCol;
            navigateToCell(nextRow, wrapCellCol);
          }
        }
      }
    },
    [
      onEnterRow,
      onSpaceRow,
      navigateToCell,
      scrollContainerRef,
      rowHeight,
      totalRows,
    ],
  );

  return {
    ...windowMetrics,
    handleCellKeyDown,
    handleCellCopy,
    scrollToRow,
    navigateToCell,
  };
}
