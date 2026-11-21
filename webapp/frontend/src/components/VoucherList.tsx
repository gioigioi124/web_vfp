import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherPagination,
  VoucherFilterParams,
  VoucherSummaryTotals,
  VoucherMode,
} from "../types/voucher";
import { Button } from "./ui/Button";
import { DetailGrid } from "./DetailGrid";
import { MobileSheet } from "./ui/MobileSheet";
import { useIsMobile } from "../hooks/useViewport";
import { formatCurrency, formatDate, formatQuantity } from "../lib/format";
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
  GripHorizontal,
  Check,
  Pencil,
  Printer,
  Eye,
  Trash2,
  CreditCard,
} from "lucide-react";

const SPLIT_STORAGE_KEY = "voucherList.splitRatio";
const DEFAULT_SPLIT_RATIO = 0.54;

function loadSplitRatio(): number {
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    const parsed = raw ? parseFloat(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 0.8) {
      return parsed;
    }
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_SPLIT_RATIO;
}

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
  flashStt?: string | null;
  markedStts?: Set<string>;
  detailItems: VoucherDetail[];
  detailLoading?: boolean;
  debtAmount?: number | null;
  voucherMode?: VoucherMode;
  onSelectStt: (stt: string) => void;
  onEditVoucher?: (stt: string) => void;
  onDeleteVoucher?: (v: VoucherHeader) => void;
  onToggleMark?: (stt: string) => void;
  onToggleSelectAll?: (selectAll: boolean) => void;
  onOpenFilter: () => void;
  onOpenPrint: (stt: string | string[]) => void;
  onOpenPreview?: (stt: string | string[]) => void;
  onOpenPickup?: () => void;
  onOpenDebt?: (maDt: string) => void;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
}

export const VoucherList: React.FC<VoucherListProps> = React.memo(({
  vouchers,
  pagination,
  summary,
  loading,
  selectedStt,
  flashStt,
  markedStts,
  detailItems,
  detailLoading = false,
  debtAmount,
  voucherMode = "sales",
  onSelectStt,
  onEditVoucher,
  onDeleteVoucher,
  onToggleMark,
  onToggleSelectAll,
  onOpenPrint,
  onOpenPreview,
  onOpenDebt,
  onChangePage,
}) => {
  const isMobile = useIsMobile();
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isWarehouse = voucherMode === "warehouse";
  const activeVoucher =
    vouchers.find((v) => v.stt === selectedStt) ||
    vouchers[vouchers.length - 1];
  const detailCurrency = activeVoucher?.ma_tte || "VND";

  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const [splitRatio, setSplitRatio] = useState<number>(loadSplitRatio);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const handleSplitterPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const root = rootContainerRef.current;
    if (!root) return;
    setIsDraggingSplit(true);
    const rect = root.getBoundingClientRect();
    const totalH = Math.max(200, rect.height);

    const onMove = (ev: PointerEvent) => {
      const next = Math.min(0.8, Math.max(0.25, (ev.clientY - rect.top) / totalH));
      setSplitRatio(next);
    };
    const onUp = (ev: PointerEvent) => {
      const finalRatio = Math.min(0.8, Math.max(0.25, (ev.clientY - rect.top) / totalH));
      setSplitRatio(finalRatio);
      setIsDraggingSplit(false);
      try {
        window.localStorage.setItem(SPLIT_STORAGE_KEY, finalRatio.toFixed(3));
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

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

  const allVisibleMarked =
    vouchers.length > 0 &&
    Boolean(markedStts && vouchers.every((v) => markedStts.has(v.stt)));

  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-50 min-h-0">
        {/* Top Summary & Select All Strip */}
        <div className="px-3 py-2 bg-white border-b border-neutral-200 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {onToggleSelectAll && vouchers.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleSelectAll(!allVisibleMarked)}
                className="text-primary-700 font-semibold whitespace-nowrap cursor-pointer"
              >
                {allVisibleMarked ? "Bỏ chọn" : "Chọn tất"}
              </button>
            )}
            <span className="text-neutral-600 truncate">
              <b className="font-mono text-neutral-900">{pagination.total_records}</b> CT
              {!isWarehouse && summary && pagination.total_records > 0 && (
                <>
                  {" · "}
                  <b className="font-mono text-primary-800">
                    {formatCurrency(summary.total_ttien0 || summary.total_ttien_nt0, "VND")} ₫
                  </b>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-mono text-neutral-600">
              {pagination.page}/{pagination.total_pages || 1}
            </span>
            <button
              type="button"
              onClick={() => onChangePage(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              aria-label="Trang trước"
              className="w-8 h-8 rounded-lg border border-neutral-300 bg-white disabled:opacity-40 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onChangePage(pagination.page + 1)}
              disabled={!pagination.has_next || loading}
              aria-label="Trang sau"
              className="w-8 h-8 rounded-lg border border-neutral-300 bg-white disabled:opacity-40 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Card List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {loading ? (
            <div className="py-14 text-center text-neutral-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
              Đang tải danh sách chứng từ...
            </div>
          ) : vouchers.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 italic text-xs bg-white rounded-xl border border-neutral-200">
              Không tìm thấy chứng từ nào phù hợp bộ lọc.
            </div>
          ) : (
            vouchers.map((v) => {
              const isSelected = selectedStt === v.stt;
              const isMarked = markedStts?.has(v.stt) ?? false;
              const isFlashed = flashStt === v.stt;
              const maCt = (v.ma_ct || "").trim().toUpperCase();
              return (
                <div
                  key={v.stt}
                  onClick={() => {
                    userSelectedSttRef.current = v.stt;
                    onSelectStt(v.stt);
                    setMobileDetailOpen(true);
                  }}
                  className={`bg-white rounded-xl border p-3 shadow-sm transition-colors cursor-pointer ${
                    isFlashed
                      ? "ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/40"
                      : isSelected
                        ? "border-primary-500 ring-1 ring-primary-300"
                        : isMarked
                          ? "border-amber-400 bg-amber-50/40"
                          : "border-neutral-200 active:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {onToggleMark && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMark(v.stt);
                        }}
                        aria-label={`Đánh dấu ${v.so_ct}`}
                        className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isMarked
                            ? "bg-tertiary-500 border-tertiary-600 text-white"
                            : "bg-white border-neutral-300"
                        }`}
                      >
                        {isMarked && <Check className="w-4 h-4" />}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              maCt === "N5"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-primary-100 text-primary-800"
                            }`}
                          >
                            {maCt || "CT"}
                          </span>
                          <span className="font-mono font-bold text-sm text-primary-800 truncate">
                            {v.so_ct || v.stt}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-neutral-500 shrink-0">
                          {formatDate(v.ngay_ct)}
                        </span>
                      </div>

                      <div className="text-[13px] font-semibold text-neutral-900 truncate mt-1">
                        {v.ten_dt || v.ma_dt || "—"}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs text-neutral-500 truncate">
                          {v.dien_giai0 || (v.user_name ? `Lập: ${v.user_name}` : "—")}
                        </span>
                        {!isWarehouse && (
                          <span className="font-mono font-bold text-sm text-neutral-900 shrink-0">
                            {formatCurrency(v.ttien_nt0, v.ma_tte)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile Voucher Detail Drawer */}
        <MobileSheet
          isOpen={mobileDetailOpen && Boolean(activeVoucher)}
          onClose={() => setMobileDetailOpen(false)}
          variant="bottom"
          title={
            activeVoucher ? (
              <span className="flex items-center gap-2">
                <span className="font-mono text-primary-800">
                  {activeVoucher.ma_ct} · {activeVoucher.so_ct}
                </span>
                <span className="text-xs font-normal text-neutral-500 font-mono">
                  {formatDate(activeVoucher.ngay_ct)}
                </span>
              </span>
            ) : undefined
          }
          subtitle={
            activeVoucher
              ? `${activeVoucher.ma_dt ? `[${activeVoucher.ma_dt}] ` : ""}${
                  activeVoucher.ten_dt || ""
                }`
              : undefined
          }
          footer={
            activeVoucher && (
              <div className="grid grid-cols-4 gap-1.5">
                {onEditVoucher && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      onEditVoucher(activeVoucher.stt);
                    }}
                    className="h-11 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailOpen(false);
                    onOpenPrint(activeVoucher.stt);
                  }}
                  className="h-11 rounded-lg bg-neutral-800 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In</span>
                </button>
                {onOpenPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      onOpenPreview(activeVoucher.stt);
                    }}
                    className="h-11 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem in</span>
                  </button>
                )}
                {onDeleteVoucher && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      onDeleteVoucher(activeVoucher);
                    }}
                    className="h-11 rounded-lg border border-danger-300 bg-danger-50 text-danger-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                )}
              </div>
            )
          }
        >
          {activeVoucher && (
            <div className="p-3.5 space-y-3 bg-slate-50">
              {/* Summary Strip */}
              <div className="bg-white rounded-xl border border-neutral-200 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">Diễn giải:</span>
                  <span className="font-medium text-neutral-900 text-right">
                    {activeVoucher.dien_giai0 || "—"}
                  </span>
                </div>
                {!isWarehouse && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">Tổng thanh toán:</span>
                      <span className="font-mono font-bold text-sm text-primary-800">
                        {formatCurrency(activeVoucher.ttien_nt0, detailCurrency)} ₫
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
                      <span className="text-neutral-500">Dư nợ KH:</span>
                      {activeVoucher.ma_dt && onOpenDebt ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileDetailOpen(false);
                            onOpenDebt(activeVoucher.ma_dt);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tertiary-100 border border-tertiary-200 text-tertiary-800 font-mono font-bold text-xs cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>
                            {debtAmount != null
                              ? `${formatCurrency(debtAmount, "VND")} ₫`
                              : "Xem sổ nợ"}
                          </span>
                        </button>
                      ) : (
                        <span className="font-mono font-bold text-tertiary-700">
                          {debtAmount != null
                            ? `${formatCurrency(debtAmount, "VND")} ₫`
                            : "—"}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Detail Line Items */}
              <div>
                <div className="text-[11px] font-bold uppercase text-neutral-500 px-1 mb-1.5">
                  Chi tiết vật tư ({detailItems.length} dòng)
                </div>
                {detailLoading ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary-600" />
                    Đang tải chi tiết...
                  </div>
                ) : detailItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
                    Không có dòng hàng hóa.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailItems.map((it, idx) => (
                      <div
                        key={`${it.stt0}-${idx}`}
                        className="bg-white rounded-xl border border-neutral-200 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-primary-800">
                            #{idx + 1} · {it.ma_vt}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-500">
                            Kho: {it.ma_kho}
                          </span>
                        </div>
                        <div className="font-semibold text-neutral-900 mt-0.5">
                          {it.ten_vt}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-neutral-100 text-[11px]">
                          <span className="text-neutral-600 font-mono">
                            {it.so_tam ? `${formatQuantity(it.so_tam)} tấm · ` : ""}
                            SL:{" "}
                            <b className="text-neutral-900">
                              {formatQuantity(it.so_luong9 || it.so_luong)}
                            </b>{" "}
                            {it.dvt_ban || it.dvt}
                          </span>
                          {!isWarehouse && (
                            <span className="font-mono font-bold text-primary-800">
                              {formatCurrency(
                                (it.tien_nt9 ?? it.tien_nt ?? 0) - (it.tien_nt4 ?? 0),
                                detailCurrency,
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </MobileSheet>
      </div>
    );
  }

  return (
    <div
      ref={rootContainerRef}
      className={`flex flex-col h-full w-full bg-surface min-h-0 ${isDraggingSplit ? "select-none cursor-row-resize" : ""}`}
    >
      {/* ===== KHU VỰC 1: MASTER — DANH SÁCH PHIẾU XUẤT BÁN ===== */}
      <section
        style={{ flexBasis: `${Math.round(splitRatio * 1000) / 10}%` }}
        className="shrink-0 grow-0 flex flex-col min-h-[120px] bg-white border-b border-neutral-300 overflow-hidden"
      >
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
                  title="Chọn / bỏ chọn tất cả (Ctrl+A / Ctrl+U)"
                >
                  {onToggleSelectAll ? (
                    <input
                      type="checkbox"
                      checked={allVisibleMarked}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                      aria-label="Chọn tất cả chứng từ trên trang"
                      className="w-3.5 h-3.5 accent-tertiary-600 cursor-pointer align-middle"
                    />
                  ) : (
                    "✓"
                  )}
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
                  className="min-w-[240px] border-r border-neutral-200"
                  scope="col"
                >
                  Diễn giải
                </th>
                <th
                  className="min-w-[200px] border-r border-neutral-200"
                  scope="col"
                >
                  Đối tượng
                </th>
                <th
                  className="w-20 text-center border-r border-neutral-200"
                  scope="col"
                  title="Người lập chứng từ"
                >
                  Người lập
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
                    colSpan={isWarehouse ? 7 : 8}
                    className="px-4 py-12 text-center text-neutral-400"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải danh sách chứng từ...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isWarehouse ? 7 : 8}
                    className="px-4 py-12 text-center text-neutral-400 italic"
                  >
                    Không tìm thấy chứng từ nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                vouchers.map((v, rowIdx) => {
                  const isSelected = selectedStt === v.stt;
                  const isMarked = markedStts?.has(v.stt) ?? false;
                  const isFlashed = flashStt === v.stt;
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
                      className={[
                        isSelected
                          ? "xl-row-active"
                          : isMarked
                            ? "xl-row-marked"
                            : "",
                        isFlashed
                          ? "ring-2 ring-inset ring-emerald-500/80 bg-emerald-50/70 transition-all duration-500"
                          : "transition-colors duration-300",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                      <td className="xl-cell min-w-[240px]">
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
                      <td className="xl-cell min-w-[200px]">
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
                      <td className="xl-cell">
                        <input
                          type="text"
                          readOnly
                          data-mode="select"
                          value={v.user_name || ""}
                          placeholder="—"
                          title={v.user_name || ""}
                          onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                          onFocus={(e) =>
                            handleMasterCellFocus(6, v.stt, e.currentTarget)
                          }
                          onKeyDown={(e) =>
                            handleMasterCellKeyDown(e, rowIdx, 6)
                          }
                          onCopy={handleMasterCellCopy}
                          className="xl-input text-center font-mono text-[11px] text-neutral-600 grid-cell-input"
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
                              handleMasterCellFocus(7, v.stt, e.currentTarget)
                            }
                            onKeyDown={(e) =>
                              handleMasterCellKeyDown(e, rowIdx, 7)
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

      {/* ===== THANH SPLITTER KÉO GIÃN & THÔNG TIN DƯ NỢ KHÁCH HÀNG ===== */}
      <div
        onPointerDown={handleSplitterPointerDown}
        onDoubleClick={() => {
          setSplitRatio(DEFAULT_SPLIT_RATIO);
          try {
            window.localStorage.setItem(
              SPLIT_STORAGE_KEY,
              DEFAULT_SPLIT_RATIO.toFixed(3),
            );
          } catch {
            /* ignore */
          }
        }}
        title="Kéo lên/xuống để thay đổi tỷ lệ bảng (nhấp đúp để đặt lại mặc định)"
        className="bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 hover:from-primary-100 hover:via-neutral-100 hover:to-primary-100 px-2.5 py-0.5 flex items-center justify-between gap-2 border-y border-neutral-300 flex-shrink-0 cursor-row-resize touch-none transition-colors"
      >
        <div
          className="flex items-center gap-1.5 min-w-0 cursor-default"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GripHorizontal className="w-3.5 h-3.5 text-neutral-400 shrink-0 cursor-row-resize" />
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
        <div
          className="flex items-center gap-2 shrink-0 cursor-default"
          onMouseDown={(e) => e.stopPropagation()}
        >
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
        className="flex-1 flex flex-col min-h-[120px] bg-white overflow-hidden relative"
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
            maCt={
              activeVoucher?.ma_ct ||
              (voucherMode === "return" ? "N5" : "X1")
            }
            embedded
          />
        </div>
      </section>
    </div>
  );
});

VoucherList.displayName = "VoucherList";
