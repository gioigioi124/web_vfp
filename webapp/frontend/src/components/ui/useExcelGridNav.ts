import React, { useCallback } from "react";
import { arrowDir } from "./excelCell";

export interface UseExcelGridNavOptions {
  /** Called when Enter is pressed on a row (e.g., open/edit row). */
  onEnterRow?: (rowIndex: number) => void;
  /** Called when Space is pressed on a row (e.g., toggle mark checkbox). */
  onSpaceRow?: (rowIndex: number) => void;
}

export function ensureGridRowVisible(tr: HTMLTableRowElement | null): void {
  if (!tr) return;
  const table = tr.closest("table");
  const container = table?.parentElement;
  if (!table || !container) return;
  const thead = table.querySelector("thead");
  const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
  const cRect = container.getBoundingClientRect();
  const rRect = tr.getBoundingClientRect();
  const visibleTop = cRect.top + headerHeight;
  const visibleBottom = cRect.top + container.clientHeight;
  if (rRect.top < visibleTop) {
    container.scrollTop -= visibleTop - rRect.top;
  } else if (rRect.bottom > visibleBottom) {
    container.scrollTop += rRect.bottom - visibleBottom;
  }
}

export function copyGridCellValue(
  e: React.ClipboardEvent<HTMLInputElement>,
): void {
  const el = e.currentTarget;
  if (el.selectionStart === el.selectionEnd && el.value) {
    e.clipboardData.setData("text/plain", el.value);
    e.preventDefault();
  }
}

/**
 * Shared Excel-like keyboard navigation & copy hook matching Sales Invoice grids
 * (`DetailGrid` / `VoucherList` / `DebtLedgerTable`):
 * - ArrowUp / ArrowDown: move to same column in adjacent row + scroll into view.
 * - ArrowLeft / ArrowRight / Tab / Shift+Tab: move between cells horizontally (Tab wraps rows).
 * - Escape: blur cell.
 * - Ctrl+C: copy full cell text when in cell-select mode.
 * - Optional Enter / Space row actions.
 */
export function useExcelGridNav(options: UseExcelGridNavOptions = {}) {
  const { onEnterRow, onSpaceRow } = options;

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

      const dir = arrowDir(e.key);
      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        const tr = el.closest("tr");
        const tbody = tr?.parentElement;
        if (!tr || !tbody) return;
        const rows = Array.from(
          tbody.querySelectorAll<HTMLTableRowElement>("tr"),
        );
        const rIdx = rows.indexOf(tr);
        const targetRow = rows[rIdx + (dir === "down" ? 1 : -1)];
        if (!targetRow) return;
        const td = el.closest("td");
        const cellIdx = td ? Array.from(tr.children).indexOf(td) : -1;
        if (cellIdx < 0) return;
        const targetCell = targetRow.children[cellIdx] as
          | HTMLElement
          | undefined;
        const targetInput =
          targetCell?.querySelector<HTMLInputElement>("input.xl-input") ||
          targetCell?.querySelector<HTMLInputElement>("input");
        if (targetInput) {
          targetInput.focus({ preventScroll: true });
          targetInput.select();
          ensureGridRowVisible(targetRow);
        }
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        const tr = el.closest("tr");
        if (!tr) return;
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>(
            "input.xl-input:not([disabled])",
          ),
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
          const tbody = tr.parentElement;
          if (!tbody) return;
          const rows = Array.from(
            tbody.querySelectorAll<HTMLTableRowElement>("tr"),
          );
          const rIdx = rows.indexOf(tr);
          const targetRow = rows[rIdx + (forward ? 1 : -1)];
          if (!targetRow) return;
          const nextRowInputs = Array.from(
            targetRow.querySelectorAll<HTMLInputElement>(
              "input.xl-input:not([disabled])",
            ),
          );
          const wrapInput = forward
            ? nextRowInputs[0]
            : nextRowInputs[nextRowInputs.length - 1];
          if (wrapInput) {
            wrapInput.focus({ preventScroll: true });
            wrapInput.select();
            ensureGridRowVisible(targetRow);
          }
        }
      }
    },
    [onEnterRow, onSpaceRow],
  );

  return { handleCellKeyDown, handleCellCopy };
}
