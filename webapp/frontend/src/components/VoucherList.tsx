import React, { useCallback, useEffect, useRef } from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherPagination,
  VoucherFilterParams,
} from "../types/voucher";
import { Button } from "./ui/Button";
import { DetailGrid } from "./DetailGrid";
import { formatCurrency, formatDate } from "../lib/format";
import { isModalOpen } from "../lib/modalLock";
import {
  arrowDir,
  handleExcelMouseDown,
  selectAllLater,
} from "./ui/excelCell";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    if (el.readOnly) return false;
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
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly;
  }
  if (el instanceof HTMLSelectElement) {
    return true;
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

interface VoucherListProps {
  vouchers: VoucherHeader[];
  pagination: VoucherPagination;
  filters?: VoucherFilterParams;
  loading: boolean;
  selectedStt: string | null;
  markedStts?: Set<string>;
  detailItems: VoucherDetail[];
  detailLoading: boolean;
  debtAmount?: number | null;
  onSelectStt: (stt: string) => void;
  onToggleMark?: (stt: string) => void;
  onOpenFilter: () => void;
  onOpenPrint: (stt: string) => void;
  onOpenPickup: () => void;
  onOpenDebt: (maDt: string) => void;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
}

export const VoucherList: React.FC<VoucherListProps> = ({
  vouchers,
  pagination,
  filters,
  loading,
  selectedStt,
  markedStts,
  detailItems,
  detailLoading,
  debtAmount,
  onSelectStt,
  onToggleMark,
  onOpenFilter,
  onOpenPrint,
  onOpenPickup,
  onOpenDebt,
  onRefresh,
  onChangePage,
}) => {
  const activeVoucher =
    vouchers.find((v) => v.stt === selectedStt) || vouchers[0];
  const detailCurrency = activeVoucher?.ma_tte || "VND";

  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const masterHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const detailSectionRef = useRef<HTMLElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const activeColRef = useRef<number>(3);

  const ensureRowVisible = useCallback((stt: string | null) => {
    if (!stt) return;
    const container = masterScrollRef.current;
    const row = rowRefs.current[stt];
    if (!container || !row) return;

    const headerHeight = masterHeadRef.current
      ? masterHeadRef.current.getBoundingClientRect().height
      : 0;
    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    const visibleTop = cRect.top + headerHeight;
    const visibleBottom = cRect.top + container.clientHeight;

    if (rRect.top < visibleTop) {
      container.scrollTop -= visibleTop - rRect.top;
    } else if (rRect.bottom > visibleBottom) {
      container.scrollTop += rRect.bottom - visibleBottom;
    }
  }, []);

  const focusMasterCell = useCallback((stt: string, colIdx?: number) => {
    const row = rowRefs.current[stt];
    if (!row) return;
    const targetCol = colIdx ?? activeColRef.current;
    const td = row.children[targetCol] as HTMLElement | undefined;
    const input =
      td?.querySelector<HTMLInputElement>("input") ||
      row.querySelector<HTMLInputElement>("input");
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
    }
  }, []);

  const handleMasterCellCopy = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      if (el.selectionStart === el.selectionEnd && el.value) {
        e.clipboardData.setData("text/plain", el.value);
        e.preventDefault();
      }
    },
    [],
  );

  // Giữ tham chiếu mới nhất để listener keydown không phải gắn lại mỗi lần đổi dòng.
  const navStateRef = useRef({
    vouchers,
    selectedStt,
    onSelectStt,
  });
  navStateRef.current = { vouchers, selectedStt, onSelectStt };

  const handleMasterCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowIdx: number,
      colIdx: number,
    ) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.blur();
        return;
      }

      const dir = arrowDir(e.key);
      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        const {
          vouchers: list,
          selectedStt: currentStt,
          onSelectStt: selectStt,
        } = navStateRef.current;
        if (list.length === 0) return;
        const nextIdx =
          dir === "down"
            ? Math.min(rowIdx + 1, list.length - 1)
            : Math.max(rowIdx - 1, 0);
        const nextStt = list[nextIdx]?.stt;
        if (!nextStt) return;
        if (nextStt !== currentStt) {
          selectStt(nextStt);
        }
        focusMasterCell(nextStt, colIdx);
        ensureRowVisible(nextStt);
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        const tr = el.closest("tr");
        if (!tr) return;
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>("input:not([disabled])"),
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
          const {
            vouchers: list,
            selectedStt: currentStt,
            onSelectStt: selectStt,
          } = navStateRef.current;
          const nextRowIdx = rowIdx + (forward ? 1 : -1);
          const nextStt = list[nextRowIdx]?.stt;
          if (!nextStt) return;
          if (nextStt !== currentStt) {
            selectStt(nextStt);
          }
          focusMasterCell(nextStt, forward ? 1 : 6);
          ensureRowVisible(nextStt);
        }
      }
    },
    [ensureRowVisible, focusMasterCell],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isModalOpen()) return;
      if (isEditableTarget(document.activeElement)) return;
      if (detailSectionRef.current?.contains(document.activeElement)) return;

      const {
        vouchers: list,
        selectedStt: currentStt,
        onSelectStt: selectStt,
      } = navStateRef.current;

      // Chặn hành vi cuộn mặc định của trình duyệt khi nhấn ↑/↓ trên grid.
      e.preventDefault();
      if (list.length === 0) return;

      const idx = list.findIndex((v) => v.stt === currentStt);
      let nextIdx: number;
      if (idx === -1) {
        nextIdx = 0;
      } else if (e.key === "ArrowDown") {
        nextIdx = Math.min(idx + 1, list.length - 1);
      } else {
        nextIdx = Math.max(idx - 1, 0);
      }

      const nextStt = list[nextIdx]?.stt;
      if (!nextStt) return;
      if (nextStt !== currentStt) {
        selectStt(nextStt);
      }
      focusMasterCell(nextStt);
      ensureRowVisible(nextStt);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ensureRowVisible, focusMasterCell]);

  // Cuộn dòng đang chọn vào vùng hiển thị (tránh bị che dưới header sticky).
  useEffect(() => {
    ensureRowVisible(selectedStt);
  }, [selectedStt, vouchers, ensureRowVisible]);

  return (
    <div className="flex flex-col h-full w-full bg-surface min-h-0">
      {/* ===== KHU VỰC 1: MASTER — DANH SÁCH PHIẾU XUẤT BÁN ===== */}
      <section className="flex-[1.2] flex flex-col min-h-0 bg-white border-b border-neutral-300">
        {/* Data Grid Table: Phiếu Xuất Master */}
        <div
          ref={masterScrollRef}
          className="flex-1 overflow-auto table-sticky-header"
        >
          <table className="w-full text-left dense-table border-collapse text-[12.5px] xl-grid">
            <thead
              ref={masterHeadRef}
              className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300"
            >
              <tr>
                <th
                  className="w-8 text-center border-r border-neutral-200"
                  scope="col"
                  title="Đánh dấu (Space)"
                >
                  ✓
                </th>
                <th
                  className="w-14 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ctừ
                </th>
                <th
                  className="w-24 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ngày
                </th>
                <th
                  className="w-28 text-left border-r border-neutral-200 font-mono"
                  scope="col"
                >
                  Số
                </th>
                <th
                  className="min-w-[280px] border-r border-neutral-200"
                  scope="col"
                >
                  Diễn giải
                </th>
                <th
                  className="min-w-[220px] border-r border-neutral-200"
                  scope="col"
                >
                  Đối tượng
                </th>
                <th className="w-36 text-right pr-3" scope="col">
                  Tổng tiền
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-neutral-400"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải danh sách chứng từ...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-neutral-400 italic"
                  >
                    Không tìm thấy chứng từ nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                vouchers.map((v, rowIdx) => {
                  const isSelected = selectedStt === v.stt;
                  const isMarked = markedStts?.has(v.stt) ?? false;
                  return (
                    <tr
                      key={v.stt}
                      ref={(el) => {
                        if (el) rowRefs.current[v.stt] = el;
                        else delete rowRefs.current[v.stt];
                      }}
                      onClick={() => onSelectStt(v.stt)}
                      className={
                        isSelected
                          ? "xl-row-active"
                          : isMarked
                            ? "xl-row-marked"
                            : undefined
                      }
                    >
                      <td
                        className="xl-rowhead cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMark?.(v.stt);
                        }}
                        title="Nhấn để đánh dấu (Space)"
                      >
                        <span
                          className={`inline-block w-3 h-3 rounded border align-middle ${
                            isMarked
                              ? "bg-tertiary-500 border-tertiary-600"
                              : "border-neutral-400 bg-white"
                          }`}
                        />
                      </td>
                      <td className="xl-cell">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={v.ma_ct || ""}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 1;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 1)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-center font-mono font-medium text-neutral-600 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={formatDate(v.ngay_ct)}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 2;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 2)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={v.so_ct || v.stt}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 3;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 3)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input font-mono font-semibold text-primary-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell min-w-[280px]">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={v.dien_giai0 || ""}
                          placeholder="—"
                          title={v.dien_giai0 || ""}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 4;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 4)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-neutral-800 truncate grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell min-w-[220px]">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={v.ten_dt || v.ma_dt || ""}
                          placeholder="—"
                          title={v.ten_dt || v.ma_dt || ""}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 5;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 5)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-neutral-700 truncate grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={formatCurrency(v.ttien_nt0, v.ma_tte)}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) => {
                            activeColRef.current = 6;
                            if (selectedStt !== v.stt) onSelectStt(v.stt);
                            e.currentTarget.select();
                            selectAllLater(e.currentTarget);
                          }}
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 6)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-right font-mono font-medium text-neutral-900 pr-3 grid-cell-input"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== THANH SPLITTER & THÔNG TIN DƯ NỢ KHÁCH HÀNG ===== */}
      <div className="bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 px-3.5 py-1.5 flex items-center justify-between border-y border-neutral-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-info-100 text-primary-700">
            <Info className="w-3 h-3" />
          </div>
          <span className="font-semibold text-xs text-neutral-800">
            Khách hàng:{" "}
            <span className="text-primary-700 font-mono">
              {activeVoucher?.ma_dt || "—"}
            </span>
            {activeVoucher?.ten_dt ? ` - ${activeVoucher.ten_dt}` : ""}
          </span>
          <span className="text-neutral-400">||</span>
          <span className="text-xs text-neutral-600">Dư nợ tài khoản:</span>
          <span className="px-2 py-0.5 rounded bg-tertiary-100 border border-tertiary-200 text-tertiary-600 font-mono font-bold text-xs">
            {debtAmount != null
              ? `${formatCurrency(debtAmount, "VND")} ₫`
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-[11px] font-mono">
            Trang {pagination.page} / {pagination.total_pages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangePage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangePage(pagination.page + 1)}
            disabled={!pagination.has_next || loading}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <span className="w-px h-4 bg-neutral-300 mx-0.5" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeVoucher && onOpenDebt(activeVoucher.ma_dt)}
            disabled={!activeVoucher}
          >
            Chi tiết công nợ
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenPickup}>
            Chọn phiếu xuất
          </Button>
        </div>
      </div>

      {/* ===== KHU VỰC 2: DETAIL — CHI TIẾT VẬT TƯ / HÀNG HÓA ===== */}
      <section
        ref={detailSectionRef}
        className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden"
      >
        {detailLoading && (
          <div className="shrink-0 bg-neutral-50 border-b border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Đang tải chi tiết...
          </div>
        )}
        <div className="flex-1 overflow-auto table-sticky-header">
          <DetailGrid items={detailItems} currency={detailCurrency} embedded />
        </div>
      </section>
    </div>
  );
};
