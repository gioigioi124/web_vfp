import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CashVoucherDetail,
  CashVoucherHeader,
  CashVoucherSummaryTotals,
} from "../../types/cashVoucher";
import { VoucherPagination } from "../../types/voucher";
import { CashVoucherModuleConfig } from "../../config/accountingModules";
import { formatCurrency, formatDate } from "../../lib/format";
import { isModalOpen } from "../../lib/modalLock";
import { CashDetailGrid } from "./CashDetailGrid";
import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Info,
  RefreshCw,
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
    onToggleMark,
    onToggleSelectAll,
    onChangePage,
  }) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const masterScrollRef = useRef<HTMLDivElement | null>(null);
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const [splitRatio, setSplitRatio] = useState<number>(loadSplitRatio);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);

    const activeVoucher =
      vouchers.find((v) => v.stt === selectedStt) || vouchers[vouchers.length - 1];

    const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      const root = rootRef.current;
      if (!root) return;
      setIsDraggingSplit(true);
      const rect = root.getBoundingClientRect();
      const totalH = Math.max(200, rect.height);
      const onMove = (ev: MouseEvent) => {
        setSplitRatio(Math.min(0.8, Math.max(0.25, (ev.clientY - rect.top) / totalH)));
      };
      const onUp = (ev: MouseEvent) => {
        const finalRatio = Math.min(0.8, Math.max(0.25, (ev.clientY - rect.top) / totalH));
        setSplitRatio(finalRatio);
        setIsDraggingSplit(false);
        try {
          window.localStorage.setItem(SPLIT_STORAGE_KEY, finalRatio.toFixed(3));
        } catch {
          /* ignore */
        }
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
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
                  vouchers.map((v) => {
                    const isSelected = v.stt === selectedStt;
                    const isMarked = markedStts?.has(v.stt) || false;
                    const isFlashing = v.stt === flashStt;
                    return (
                      <tr
                        key={v.stt}
                        ref={(el) => {
                          rowRefs.current[v.stt] = el;
                        }}
                        onClick={() => onSelectStt(v.stt)}
                        onDoubleClick={() => onEditVoucher(v.stt)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "xl-row-active"
                            : isMarked
                              ? "xl-row-marked"
                              : ""
                        } ${isFlashing ? "ring-2 ring-inset ring-emerald-500" : ""}`}
                      >
                        <td
                          className="xl-ro text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleMark(v.stt);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isMarked}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 accent-primary-700 cursor-pointer"
                          />
                        </td>
                        <td className="xl-ro px-1.5 text-center font-mono font-bold text-primary-800">
                          {v.ma_ct}
                        </td>
                        <td className="xl-ro px-1.5 font-mono text-neutral-800">
                          {formatDate(v.ngay_ct)}
                        </td>
                        <td className="xl-ro px-1.5 font-mono font-bold text-primary-800">
                          {v.so_ct || "—"}
                        </td>
                        <td className="xl-ro px-1.5 font-mono text-neutral-700">
                          {v.ma_dt0 || ""}
                        </td>
                        <td className="xl-ro px-1.5 truncate max-w-[240px]" title={v.ten_dt0}>
                          {v.ten_dt0 || ""}
                        </td>
                        <td className="xl-ro px-1.5 truncate max-w-[180px]" title={v.ong_ba}>
                          {v.ong_ba || ""}
                        </td>
                        <td className="xl-ro px-1.5 truncate max-w-[280px]" title={v.dien_giai0}>
                          {v.dien_giai0 || ""}
                        </td>
                        <td className="xl-ro px-1.5 text-center font-mono font-semibold text-emerald-800">
                          {v.tk_chinh || ""}
                        </td>
                        <td className="xl-ro px-1.5 text-center font-mono text-neutral-700">
                          {v.tk_doi_ung || ""}
                        </td>
                        <td className="xl-ro px-1.5 text-right font-mono font-bold text-neutral-900">
                          {formatCurrency(v.ttien_nt0 ?? v.ttien_nt ?? 0, v.ma_tte || "VND")}
                        </td>
                        <td className="xl-ro px-1.5 text-center">
                          <span
                            className={`inline-block px-1.5 py-0 rounded text-[10px] font-semibold ${
                              v.posted
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {v.posted ? "Ghi sổ" : "Chưa GS"}
                          </span>
                        </td>
                        <td className="xl-ro px-1.5 text-center font-mono text-neutral-600">
                          {v.user_name || ""}
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
          onMouseDown={handleSplitterMouseDown}
          className="h-5 bg-neutral-200 hover:bg-primary-100 border-y border-neutral-300 flex items-center justify-between px-3 cursor-row-resize shrink-0 text-[11px] text-neutral-600 select-none"
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
