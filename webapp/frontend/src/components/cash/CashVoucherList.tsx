import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CashVoucherDetail,
  CashVoucherHeader,
  CashVoucherSummaryTotals,
} from "../../types/cashVoucher";
import { VoucherPagination } from "../../types/voucher";
import { CashVoucherModuleConfig } from "../../config/accountingModules";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import { formatCurrency, formatDate } from "../../lib/format";
import { isModalOpen } from "../../lib/modalLock";
import { CashDetailGrid } from "./CashDetailGrid";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useExcelGridNav } from "../ui/useExcelGridNav";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Info,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

const SPLIT_STORAGE_KEY = "cashVoucherList.splitRatio";
const DEFAULT_SPLIT_RATIO = 0.56;

function loadSplitRatio(): number {
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    const parsed = raw ? parseFloat(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 0.8) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_SPLIT_RATIO;
}

interface CashVoucherListProps {
  config: CashVoucherModuleConfig;
  vouchers: CashVoucherHeader[];
  pagination: VoucherPagination;
  summary: CashVoucherSummaryTotals;
  loading: boolean;
  selectedStt: string | null;
  flashStt?: string | null;
  markedStts?: Set<string>;
  detailItems: CashVoucherDetail[];
  detailLoading?: boolean;
  onSelectStt: (stt: string) => void;
  onEditVoucher: (stt: string) => void;
  onDeleteVoucher?: (v: CashVoucherHeader) => void;
  onToggleMark: (stt: string) => void;
  onToggleSelectAll: (selectAll: boolean) => void;
  onChangePage: (page: number) => void;
}

export const CashVoucherList: React.FC<CashVoucherListProps> = React.memo(
  ({
    config,
    vouchers,
    pagination,
    summary,
    loading,
    selectedStt,
    flashStt,
    markedStts,
    detailItems,
    detailLoading = false,
    onSelectStt,
    onEditVoucher,
    onDeleteVoucher,
    onToggleMark,
    onToggleSelectAll,
    onChangePage,
  }) => {
    const isMobile = useIsMobile();
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const masterScrollRef = useRef<HTMLDivElement | null>(null);
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const [splitRatio, setSplitRatio] = useState<number>(loadSplitRatio);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);

    const activeVoucher =
      vouchers.find((v) => v.stt === selectedStt) || vouchers[vouchers.length - 1];

    const handleSplitterPointerDown = useCallback((e: React.PointerEvent) => {
      e.preventDefault();
      const root = rootRef.current;
      if (!root) return;
      setIsDraggingSplit(true);
      const rect = root.getBoundingClientRect();
      const totalH = Math.max(200, rect.height);
      const onMove = (ev: PointerEvent) => {
        setSplitRatio(Math.min(0.8, Math.max(0.25, (ev.clientY - rect.top) / totalH)));
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

    useLayoutEffect(() => {
      if (!selectedStt) return;
      const row = rowRefs.current[selectedStt];
      if (row) {
        row.scrollIntoView({ block: "nearest" });
      }
    }, [selectedStt, vouchers.length]);

    // Keyboard navigation ↑/↓/Home/End on voucher list
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (isModalOpen()) return;
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement
        ) {
          return;
        }
        if (!vouchers.length) return;
        const curIdx = vouchers.findIndex((v) => v.stt === selectedStt);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const nextIdx = curIdx < 0 ? 0 : Math.min(vouchers.length - 1, curIdx + 1);
          onSelectStt(vouchers[nextIdx].stt);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prevIdx = curIdx < 0 ? vouchers.length - 1 : Math.max(0, curIdx - 1);
          onSelectStt(vouchers[prevIdx].stt);
        } else if (e.key === "Home" && !e.ctrlKey) {
          e.preventDefault();
          onSelectStt(vouchers[0].stt);
        } else if (e.key === "End" && !e.ctrlKey) {
          e.preventDefault();
          onSelectStt(vouchers[vouchers.length - 1].stt);
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [vouchers, selectedStt, onSelectStt]);

    const allMarked =
      vouchers.length > 0 && vouchers.every((v) => markedStts?.has(v.stt));

    const masterGridNav = useExcelGridNav({
      onEnterRow: (idx) => {
        const v = vouchers[idx];
        if (v) onEditVoucher(v.stt);
      },
      onSpaceRow: (idx) => {
        const v = vouchers[idx];
        if (v) onToggleMark(v.stt);
      },
    });

    if (isMobile) {
      return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
          {/* Summary & Pagination Strip */}
          <div className="px-3 py-2 bg-white border-b border-neutral-200 flex items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {vouchers.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleSelectAll(!allMarked)}
                  className="text-primary-700 font-semibold whitespace-nowrap cursor-pointer"
                >
                  {allMarked ? "Bỏ chọn" : "Chọn tất"}
                </button>
              )}
              <span className="text-neutral-600 truncate">
                <b className="font-mono text-neutral-900">{pagination.total_records}</b> CT ·{" "}
                <b className="font-mono text-primary-800">
                  {formatCurrency(summary.total_ttien_nt0 || summary.total_ttien_nt || 0, "VND")} ₫
                </b>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-mono text-neutral-600">
                {pagination.page}/{pagination.total_pages}
              </span>
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => onChangePage(pagination.page - 1)}
                className="w-8 h-8 rounded-lg border border-neutral-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!pagination.has_next}
                onClick={() => onChangePage(pagination.page + 1)}
                className="w-8 h-8 rounded-lg border border-neutral-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {loading && vouchers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                Đang tải danh sách...
              </div>
            ) : vouchers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 italic text-xs bg-white rounded-xl border border-neutral-200">
                Không có chứng từ {config.title.toLowerCase()} nào trong kỳ.
              </div>
            ) : (
              vouchers.map((v) => {
                const isSelected = selectedStt === v.stt;
                const isMarked = markedStts?.has(v.stt) ?? false;
                const isFlashed = flashStt === v.stt;
                return (
                  <div
                    key={v.stt}
                    onClick={() => {
                      onSelectStt(v.stt);
                      setMobileDetailOpen(true);
                    }}
                    className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer transition-colors ${
                      isFlashed
                        ? "ring-2 ring-emerald-500 border-emerald-400"
                        : isSelected
                          ? "border-primary-500 ring-1 ring-primary-300"
                          : isMarked
                            ? "border-amber-400 bg-amber-50/40"
                            : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMark(v.stt);
                        }}
                        aria-label={`Chọn ${v.so_ct}`}
                        className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isMarked
                            ? "bg-primary-700 border-primary-700 text-white"
                            : "bg-white border-neutral-300"
                        }`}
                      >
                        {isMarked && <Check className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-100 text-primary-800">
                              {v.ma_ct}
                            </span>
                            <span className="font-mono font-bold text-sm text-primary-800 truncate">
                              {v.so_ct || "—"}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-neutral-500 shrink-0">
                            {formatDate(v.ngay_ct)}
                          </span>
                        </div>

                        <div className="text-[13px] font-semibold text-neutral-900 truncate mt-1">
                          {v.ten_dt0 || v.ong_ba || v.ma_dt0 || "—"}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[11px] font-mono text-neutral-500 truncate">
                            TK {v.tk_chinh || "—"} · ĐƯ {v.tk_doi_ung || "—"}
                          </span>
                          <span className="font-mono font-bold text-sm text-neutral-900 shrink-0">
                            {formatCurrency(v.ttien_nt0 ?? v.ttien_nt ?? 0, v.ma_tte || "VND")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <MobileSheet
            isOpen={mobileDetailOpen && Boolean(activeVoucher)}
            onClose={() => setMobileDetailOpen(false)}
            variant="bottom"
            title={
              activeVoucher
                ? `${activeVoucher.ma_ct} · ${activeVoucher.so_ct}`
                : undefined
            }
            subtitle={
              activeVoucher
                ? `${formatDate(activeVoucher.ngay_ct)} · ${
                    activeVoucher.ten_dt0 || activeVoucher.ong_ba || activeVoucher.ma_dt0 || ""
                  }`
                : undefined
            }
            footer={
              activeVoucher && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      onEditVoucher(activeVoucher.stt);
                    }}
                    className="flex-1 h-11 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Sửa chứng từ</span>
                  </button>
                  {onDeleteVoucher && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDetailOpen(false);
                        onDeleteVoucher(activeVoucher);
                      }}
                      className="h-11 px-4 rounded-lg border border-danger-300 bg-danger-50 text-danger-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              )
            }
          >
            {activeVoucher && (
              <div className="p-3.5 space-y-3 bg-slate-50">
                <div className="bg-white rounded-xl border border-neutral-200 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Diễn giải:</span>
                    <span className="font-medium text-neutral-900 text-right">
                      {activeVoucher.dien_giai0 || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Tổng phát sinh:</span>
                    <span className="font-mono font-bold text-sm text-primary-800">
                      {formatCurrency(
                        activeVoucher.ttien_nt0 ?? activeVoucher.ttien_nt ?? 0,
                        activeVoucher.ma_tte || "VND",
                      )}{" "}
                      ₫
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase text-neutral-500 px-1 mb-1.5">
                    Chi tiết hạch toán ({detailItems.length} dòng)
                  </div>
                  {detailLoading ? (
                    <div className="py-6 text-center text-xs text-neutral-500">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary-600" />
                      Đang tải...
                    </div>
                  ) : detailItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-400 bg-white rounded-xl border border-neutral-200">
                      Không có dòng hạch toán.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailItems.map((it, idx) => (
                        <div
                          key={`${it.stt0}-${idx}`}
                          className="bg-white rounded-xl border border-neutral-200 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-primary-800">
                              #{idx + 1} · Nợ {it.tk_no} / Có {it.tk_co}
                            </span>
                            <span className="font-mono font-bold text-neutral-900">
                              {formatCurrency(it.tien_nt, activeVoucher.ma_tte || "VND")}
                            </span>
                          </div>
                          {it.dien_giai && (
                            <div className="text-neutral-700">{it.dien_giai}</div>
                          )}
                          {(it.ma_dt || it.ten_dt) && (
                            <div className="text-[11px] text-neutral-500">
                              ĐT: {it.ma_dt} {it.ten_dt ? `— ${it.ten_dt}` : ""}
                            </div>
                          )}
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
        ref={rootRef}
        className={`h-full w-full flex flex-col overflow-hidden bg-surface ${
          isDraggingSplit ? "select-none cursor-row-resize" : ""
        }`}
      >
        {/* Top Master Grid */}
        <section
          style={{ height: `${splitRatio * 100}%` }}
          className="min-h-[140px] flex flex-col overflow-hidden bg-white"
        >
          <div ref={masterScrollRef} className="flex-1 overflow-auto">
            <table className="w-full border-collapse xl-grid table-sticky-header text-xs">
              <thead>
                <tr>
                  <th className="vfp-header w-8 text-center">
                    <input
                      type="checkbox"
                      checked={allMarked}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary-700 cursor-pointer"
                      title="Chọn / Bỏ chọn tất cả (Ctrl+A / Ctrl+U)"
                    />
                  </th>
                  <th className="vfp-header w-14 text-center">Loại</th>
                  <th className="vfp-header w-24">Ngày CT</th>
                  <th className="vfp-header w-24">Số CT</th>
                  <th className="vfp-header w-28">Mã ĐT</th>
                  <th className="vfp-header min-w-[180px]">Tên đối tượng / Đơn vị</th>
                  <th className="vfp-header min-w-[140px]">{config.personLabel}</th>
                  <th className="vfp-header min-w-[220px]">Diễn giải</th>
                  <th className="vfp-header w-20 text-center">TK chính</th>
                  <th className="vfp-header w-20 text-center">TK ĐƯ</th>
                  <th className="vfp-header w-32 text-right">Tổng tiền</th>
                  <th className="vfp-header w-16 text-center">TT</th>
                  <th className="vfp-header w-20 text-center">Người lập</th>
                </tr>
              </thead>
              <tbody>
                {loading && vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-neutral-500">
                      <RefreshCw className="w-4 h-4 animate-spin inline mr-2 text-primary-600" />
                      Đang tải danh sách chứng từ...
                    </td>
                  </tr>
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-neutral-400">
                      Không có chứng từ nào trong khoảng lọc hiện tại. Nhấn{" "}
                      <kbd>F2</kbd> để thêm mới hoặc <kbd>F9</kbd> để mở rộng kỳ lọc.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v, rowIdx) => {
                    const isSelected = v.stt === selectedStt;
                    const isMarked = markedStts?.has(v.stt) || false;
                    const isFlashing = v.stt === flashStt;
                    const selectRow = () => onSelectStt(v.stt);
                    return (
                      <tr
                        key={v.stt}
                        ref={(el) => {
                          rowRefs.current[v.stt] = el;
                        }}
                        onClick={selectRow}
                        onDoubleClick={() => onEditVoucher(v.stt)}
                        title="Nhấn đúp hoặc Enter để sửa · Space để đánh dấu"
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "xl-row-active"
                            : isMarked
                              ? "xl-row-marked"
                              : ""
                        } ${isFlashing ? "ring-2 ring-inset ring-emerald-500" : ""}`}
                      >
                        <td
                          className="xl-rowhead cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleMark(v.stt);
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
                          <ReadOnlyGridInput
                            value={v.ma_ct || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-center font-mono font-bold text-primary-800 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={formatDate(v.ngay_ct)}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-center font-mono text-neutral-800 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.so_ct || "—"}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input font-mono font-bold text-primary-800 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.ma_dt0 || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input font-mono text-neutral-700 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell max-w-[240px]">
                          <ReadOnlyGridInput
                            value={v.ten_dt0 || ""}
                            title={v.ten_dt0 || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-neutral-900 truncate grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell max-w-[180px]">
                          <ReadOnlyGridInput
                            value={v.ong_ba || ""}
                            title={v.ong_ba || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-neutral-800 truncate grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell max-w-[280px]">
                          <ReadOnlyGridInput
                            value={v.dien_giai0 || ""}
                            title={v.dien_giai0 || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-neutral-900 truncate grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.tk_chinh || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-center font-mono font-semibold text-emerald-800 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.tk_doi_ung || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={formatCurrency(v.ttien_nt0 ?? v.ttien_nt ?? 0, v.ma_tte || "VND")}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-right font-mono font-bold text-neutral-900 grid-cell-input"
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.posted ? "Ghi sổ" : "Chưa GS"}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className={`xl-input text-center font-semibold grid-cell-input ${
                              v.posted ? "text-emerald-700" : "text-amber-700"
                            }`}
                          />
                        </td>
                        <td className="xl-cell">
                          <ReadOnlyGridInput
                            value={v.user_name || ""}
                            rowIndex={rowIdx}
                            onSelectRow={selectRow}
                            onKeyDown={(e) => masterGridNav.handleCellKeyDown(e, rowIdx)}
                            onCopy={masterGridNav.handleCellCopy}
                            className="xl-input text-center font-mono text-neutral-600 grid-cell-input"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Summary & Pagination Bar */}
          <div className="bg-neutral-100 border-t border-neutral-300 px-3 py-1 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-neutral-600">
                Tổng cộng:{" "}
                <b className="font-mono text-neutral-900">
                  {pagination.total_records}
                </b>{" "}
                chứng từ
              </span>
              {markedStts && markedStts.size > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  Đang chọn: {markedStts.size}
                </span>
              )}
              <span className="text-neutral-400">|</span>
              <span className="text-neutral-700">
                Tổng phát sinh:{" "}
                <b className="font-mono text-primary-800 text-xs">
                  {formatCurrency(summary.total_ttien_nt0 || summary.total_ttien_nt || 0, "VND")} ₫
                </b>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => onChangePage(pagination.page - 1)}
                className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-neutral-700 px-1">
                Trang {pagination.page}/{pagination.total_pages}
              </span>
              <button
                type="button"
                disabled={!pagination.has_next}
                onClick={() => onChangePage(pagination.page + 1)}
                className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Draggable Splitter */}
        <div
          onPointerDown={handleSplitterPointerDown}
          className="h-5 bg-neutral-200 hover:bg-primary-100 border-y border-neutral-300 flex items-center justify-between px-3 cursor-row-resize touch-none shrink-0 text-[11px] text-neutral-600 select-none"
          title="Kéo để thay đổi tỷ lệ danh sách / chi tiết"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-primary-700 shrink-0" />
            <span className="truncate font-medium">
              Chi tiết hạch toán{" "}
              {activeVoucher ? (
                <>
                  · Số CT:{" "}
                  <b className="font-mono text-primary-800">{activeVoucher.so_ct}</b>{" "}
                  ({formatDate(activeVoucher.ngay_ct)})
                </>
              ) : (
                "(chưa chọn phiếu)"
              )}
            </span>
          </div>
          <GripHorizontal className="w-4 h-4 text-neutral-400 shrink-0" />
          <div className="text-[10px] text-neutral-500">
            Nhấn <kbd className="text-[9px] py-0">Enter</kbd> hoặc click đúp để sửa phiếu
          </div>
        </div>

        {/* Bottom Detail Grid */}
        <section className="flex-1 min-h-[100px] flex flex-col overflow-hidden bg-white relative">
          {detailLoading && (
            <div className="absolute top-1 right-2 z-20 text-[11px] text-primary-700 bg-white/90 px-2 py-0.5 rounded border border-primary-200 shadow-sm flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Đang tải...</span>
            </div>
          )}
          <CashDetailGrid
            items={detailItems}
            config={config}
            currency={activeVoucher?.ma_tte || "VND"}
            embedded
            variant="list"
            editable={false}
          />
        </section>
      </div>
    );
  },
);
CashVoucherList.displayName = "CashVoucherList";
