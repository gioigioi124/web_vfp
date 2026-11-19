import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherPagination,
  VoucherFilterParams,
  VoucherSummaryTotals,
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
  summary?: VoucherSummaryTotals;
  filters?: VoucherFilterParams;
  loading: boolean;
  selectedStt: string | null;
  markedStts?: Set<string>;
  detailItems: VoucherDetail[];
  detailLoading?: boolean;
  debtAmount?: number | null;
  voucherMode?: "sales" | "warehouse";
  onSelectStt: (stt: string) => void;
  onEditVoucher?: (stt: string) => void;
  onToggleMark?: (stt: string) => void;
  onOpenFilter: () => void;
  onOpenPrint: (stt: string | string[]) => void;
  onOpenPickup?: () => void;
  onOpenDebt?: (maDt: string) => void;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
}

export const VoucherList: React.FC<VoucherListProps> = React.memo(({
  vouchers,
  pagination,
  summary,
  filters,
  loading,
  selectedStt,
  markedStts,
  detailItems,
  detailLoading = false,
  debtAmount,
  voucherMode = "sales",
  onSelectStt,
  onEditVoucher,
  onToggleMark,
  onOpenFilter,
  onOpenPrint,
  onOpenDebt,
  onRefresh,
  onChangePage,
}) => {
  const isWarehouse = voucherMode === "warehouse";
  const activeVoucher =
    vouchers.find((v) => v.stt === selectedStt) ||
    vouchers[vouchers.length - 1];
  const detailCurrency = activeVoucher?.ma_tte || "VND";

  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const masterHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const detailSectionRef = useRef<HTMLElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const activeColRef = useRef<number>(3);
  const scrollTimerRef = useRef<number | null>(null);
  const hasAlignedRef = useRef<boolean>(false);
  const prevAlignedSttRef = useRef<string | null>(null);
  const userSelectedSttRef = useRef<string | null>(null);

  const clearScheduledScroll = useCallback(() => {
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearScheduledScroll();
  }, [clearScheduledScroll]);

  const measureRowPosition = useCallback(
    (container: HTMLDivElement, row: HTMLTableRowElement) => {
      const headerHeight = masterHeadRef.current
        ? masterHeadRef.current.getBoundingClientRect().height
        : 0;
      const cRect = container.getBoundingClientRect();
      const rRect = row.getBoundingClientRect();
      const visibleTop = cRect.top + headerHeight;
      const bodyHeight = Math.max(0, container.clientHeight - headerHeight);
      const targetRowBottom = visibleTop + (bodyHeight * 2) / 3;
      const delta = rRect.bottom - targetRowBottom;
      return {
        rRect,
        visibleTop,
        visibleBottom: visibleTop + bodyHeight,
        delta,
        alignedTop: Math.max(0, container.scrollTop + delta),
      };
    },
    [],
  );

  // Định vị tức thì dòng đang chọn ở 2/3 phía dưới grid (khi mở list hoặc quay ra từ form).
  const alignRowInstant = useCallback(
    (stt: string | null): boolean => {
      if (!stt) return false;
      const container = masterScrollRef.current;
      const row = rowRefs.current[stt];
      if (!container || !row) return false;

      const { delta, alignedTop } = measureRowPosition(container, row);
      if (Math.abs(delta) > 2) {
        container.scrollTop = alignedTop;
      }
      return true;
    },
    [measureRowPosition],
  );

  const ensureRowVisible = useCallback(
    (stt: string | null, immediateClamp: boolean = false) => {
      clearScheduledScroll();
      if (!stt) return;

      const container = masterScrollRef.current;
      const row = rowRefs.current[stt];
      if (!container || !row) return;

      if (immediateClamp) {
        const { rRect, visibleTop, visibleBottom } = measureRowPosition(
          container,
          row,
        );
        if (rRect.top < visibleTop) {
          container.scrollTop -= visibleTop - rRect.top;
        } else if (rRect.bottom > visibleBottom) {
          container.scrollTop += rRect.bottom - visibleBottom;
        }
      }

      // Trì hoãn nhẹ rồi cuộn mượt để tránh nhảy dòng ngay lúc người dùng đang click.
      scrollTimerRef.current = window.setTimeout(() => {
        scrollTimerRef.current = null;
        const activeContainer = masterScrollRef.current;
        const activeRow = rowRefs.current[stt];
        if (!activeContainer || !activeRow) return;

        const { delta, alignedTop } = measureRowPosition(
          activeContainer,
          activeRow,
        );
        if (Math.abs(delta) > 2) {
          activeContainer.scrollTo({
            top: alignedTop,
            behavior: "smooth",
          });
        }
      }, 260);
    },
    [clearScheduledScroll, measureRowPosition],
  );

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
          userSelectedSttRef.current = nextStt;
          selectStt(nextStt);
        }
        focusMasterCell(nextStt, colIdx);
        ensureRowVisible(nextStt, true);
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
            userSelectedSttRef.current = nextStt;
            selectStt(nextStt);
          }
          focusMasterCell(nextStt, forward ? 1 : 6);
          ensureRowVisible(nextStt, true);
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
        userSelectedSttRef.current = nextStt;
        selectStt(nextStt);
      }
      focusMasterCell(nextStt);
      ensureRowVisible(nextStt, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ensureRowVisible, focusMasterCell]);

  const handleMasterCellFocus = useCallback(
    (colIdx: number, stt: string, input: HTMLInputElement) => {
      activeColRef.current = colIdx;
      if (selectedStt !== stt) {
        userSelectedSttRef.current = stt;
        onSelectStt(stt);
        ensureRowVisible(stt, false);
      }
      input.select();
      selectAllLater(input);
    },
    [selectedStt, onSelectStt, ensureRowVisible],
  );

  // Khi mở grid hoặc thoát từ form thêm/sửa về, đặt sẵn vị trí cuộn trước khi vẽ để tránh trượt từ đầu bảng xuống.
  useLayoutEffect(() => {
    if (loading || vouchers.length === 0) {
      hasAlignedRef.current = false;
      return;
    }
    if (!selectedStt) return;

    if (userSelectedSttRef.current === selectedStt) {
      userSelectedSttRef.current = null;
      hasAlignedRef.current = true;
      prevAlignedSttRef.current = selectedStt;
      return;
    }

    if (!hasAlignedRef.current || prevAlignedSttRef.current !== selectedStt) {
      clearScheduledScroll();
      if (alignRowInstant(selectedStt)) {
        hasAlignedRef.current = true;
        prevAlignedSttRef.current = selectedStt;
      } else if (!hasAlignedRef.current) {
        // Phiếu mới tạo đang đợi nạp ngầm về cuối danh sách: neo tạm dòng cuối để không nháy về đầu bảng.
        alignRowInstant(vouchers[vouchers.length - 1]?.stt || null);
      }
    }
  }, [
    selectedStt,
    vouchers,
    loading,
    alignRowInstant,
    clearScheduledScroll,
  ]);

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
                {!isWarehouse && (
                  <th className="w-36 text-right pr-3" scope="col">
                    Tổng tiền
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {loading ? (
                <tr>
                  <td
                    colSpan={isWarehouse ? 6 : 7}
                    className="px-4 py-12 text-center text-neutral-400"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải danh sách chứng từ...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isWarehouse ? 6 : 7}
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
                      onClick={() => {
                        if (selectedStt !== v.stt) {
                          userSelectedSttRef.current = v.stt;
                          onSelectStt(v.stt);
                        }
                        ensureRowVisible(v.stt, false);
                      }}
                      onDoubleClick={() => {
                        onEditVoucher?.(v.stt);
                      }}
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
                          onFocus={(e) =>
                            handleMasterCellFocus(1, v.stt, e.currentTarget)
                          }
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
                          onFocus={(e) =>
                            handleMasterCellFocus(2, v.stt, e.currentTarget)
                          }
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
                          onFocus={(e) =>
                            handleMasterCellFocus(3, v.stt, e.currentTarget)
                          }
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
                          onFocus={(e) =>
                            handleMasterCellFocus(4, v.stt, e.currentTarget)
                          }
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 4)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-black truncate grid-cell-input"
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
                          onFocus={(e) =>
                            handleMasterCellFocus(5, v.stt, e.currentTarget)
                          }
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 5)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-black truncate grid-cell-input"
                        />
                      </td>
                      {!isWarehouse && (
                        <td className="xl-cell">
                          <input
                            type="text"
                            readOnly
                            data-mode="select"
                            value={formatCurrency(v.ttien_nt0, v.ma_tte)}
                            onMouseDown={(e) =>
                              handleExcelMouseDown(e, "select")
                            }
                            onFocus={(e) =>
                              handleMasterCellFocus(6, v.stt, e.currentTarget)
                            }
                            onKeyDown={(e) =>
                              handleMasterCellKeyDown(e, rowIdx, 6)
                            }
                            onCopy={handleMasterCellCopy}
                            className="xl-input text-right font-mono font-medium text-neutral-900 pr-3 grid-cell-input"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {!loading && vouchers.length > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none select-none"
              style={{ height: "calc((100% - 26px) / 3)", minHeight: "48px" }}
            />
          )}
        </div>
      </section>

      {/* ===== THANH SPLITTER & THÔNG TIN DƯ NỢ KHÁCH HÀNG ===== */}
      <div className="bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 px-2.5 py-0.5 flex items-center justify-between gap-2 border-y border-neutral-300 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-info-100 text-primary-700 shrink-0">
            <Info className="w-2.5 h-2.5" />
          </div>
          <span className="font-semibold text-xs text-neutral-800 truncate">
            {activeVoucher?.so_ct ? (
              <span className="font-mono text-neutral-600 mr-1.5">
                [{activeVoucher.so_ct}]
              </span>
            ) : null}
            Khách hàng:{" "}
            <span className="text-primary-700 font-mono">
              {activeVoucher?.ma_dt || "—"}
            </span>
            {activeVoucher?.ten_dt ? ` - ${activeVoucher.ten_dt}` : ""}
          </span>
          {!isWarehouse && (
            <>
              <span className="text-neutral-400">||</span>
              <span className="text-xs text-neutral-600 shrink-0">
                Dư nợ tài khoản:
              </span>
              {activeVoucher?.ma_dt && onOpenDebt ? (
                <button
                  type="button"
                  onClick={() => onOpenDebt(activeVoucher.ma_dt)}
                  title="Xem sổ chi tiết công nợ khách hàng (Ctrl+Shift+E)"
                  className="px-1.5 py-0 rounded bg-tertiary-100 hover:bg-tertiary-200 border border-tertiary-200 text-tertiary-700 font-mono font-bold text-xs tabular-nums shrink-0 cursor-pointer transition-colors"
                >
                  {debtAmount != null
                    ? `${formatCurrency(debtAmount, "VND")} ₫`
                    : "—"}
                </button>
              ) : (
                <span className="px-1.5 py-0 rounded bg-tertiary-100 border border-tertiary-200 text-tertiary-600 font-mono font-bold text-xs tabular-nums shrink-0">
                  {debtAmount != null
                    ? `${formatCurrency(debtAmount, "VND")} ₫`
                    : "—"}
                </span>
              )}
            </>
          )}
          {markedStts && markedStts.size > 0 && (
            <span className="px-1.5 py-0 rounded bg-amber-100 border border-amber-300 text-amber-800 font-semibold text-[11px] shrink-0">
              Đã chọn: {markedStts.size}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isWarehouse && summary && pagination.total_records > 0 && (
            <span
              className="hidden lg:inline-flex items-center gap-1 text-[11px] text-neutral-700 bg-white/80 px-2 py-0 rounded border border-neutral-300"
              title="Tổng cộng thanh toán theo bộ lọc hiện tại"
            >
              <span className="text-neutral-500">Tổng lọc:</span>
              <span className="font-mono font-bold text-primary-800 tabular-nums">
                {formatCurrency(summary.total_ttien0 || summary.total_ttien_nt0, "VND")} ₫
              </span>
            </span>
          )}
          <div className="flex items-center gap-1">
            <span className="text-neutral-600 text-[11px] font-mono tabular-nums mr-0.5">
              Trang {pagination.page} / {pagination.total_pages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5"
              onClick={() => onChangePage(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5"
              onClick={() => onChangePage(pagination.page + 1)}
              disabled={!pagination.has_next || loading}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* ===== KHU VỰC 2: DETAIL — CHI TIẾT VẬT TƯ / HÀNG HÓA ===== */}
      <section
        ref={detailSectionRef}
        className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden relative"
      >
        {detailLoading && (
          <div
            className="absolute top-0 inset-x-0 z-20 h-0.5 bg-primary-200 overflow-hidden pointer-events-none"
            aria-label="Đang tải chi tiết chứng từ"
          >
            <div className="h-full w-1/3 bg-primary-600 animate-pulse" />
          </div>
        )}
        <div
          className={`flex-1 overflow-auto table-sticky-header transition-opacity duration-100 ${
            detailLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          <DetailGrid
            items={detailItems}
            currency={detailCurrency}
            voucherMode={voucherMode}
            embedded
          />
        </div>
      </section>
    </div>
  );
});

VoucherList.displayName = "VoucherList";
