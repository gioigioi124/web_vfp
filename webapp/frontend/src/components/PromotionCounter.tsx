import React, { useEffect, useMemo, useRef, useState } from "react";
import { VoucherDetail } from "../types/voucher";
import {
  evaluatePromotionProgram,
  PromotionProgram,
} from "../lib/promotions";
import {
  PROMOTION_PROGRAMS,
  resolvePromotionProgram,
} from "../lib/promotionPrograms";
import { formatCurrency, formatDate, formatQuantity } from "../lib/format";
import { isModalOpen, useModalLock } from "../lib/modalLock";
import {
  Gift,
  X,
  SlidersHorizontal,
} from "lucide-react";

interface PromotionCounterProps {
  items: VoucherDetail[];
  ngayCt?: string;
  maTte?: string;
  isWarehouse?: boolean;
  /** Key thay đổi khi chuyển phiếu để reset trạng thái bộ lọc cục bộ. */
  voucherKey?: string;
  programs?: PromotionProgram[];
}

export const PromotionCounter: React.FC<PromotionCounterProps> = React.memo(({
  items,
  ngayCt,
  maTte = "VND",
  isWarehouse = false,
  voucherKey = "",
  programs = PROMOTION_PROGRAMS,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [programOverride, setProgramOverride] = useState<string>("AUTO");
  const [excludeNominalGiftRows, setExcludeNominalGiftRows] = useState<boolean>(
    !isWarehouse,
  );
  const [onlyMatchedInModal, setOnlyMatchedInModal] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalLock(isOpen, modalRef);

  useEffect(() => {
    setExcludeNominalGiftRows(!isWarehouse);
  }, [voucherKey, isWarehouse]);

  // Phím tắt Alt+K mở/đóng nhanh bảng Đếm Hàng Khuyến Mại
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "k") {
        if (!isOpen && isModalOpen()) return;
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", onGlobalKeyDown, true);
  }, [isOpen]);

  // Đóng dialog bằng Escape ở pha capture để không thoát VoucherForm.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen]);

  const activeProgram = useMemo(
    () => resolvePromotionProgram(ngayCt, programOverride, programs),
    [ngayCt, programOverride, programs],
  );

  const evaluation = useMemo(() => {
    if (!activeProgram) return null;
    return evaluatePromotionProgram(activeProgram, items, {
      ngayCt,
      maTte,
      excludeNominalGiftRows,
    });
  }, [activeProgram, items, ngayCt, maTte, excludeNominalGiftRows]);

  if (!evaluation) return null;

  const {
    program,
    isDateInRange,
    evaluatedRules,
    matchedRules,
    ignoredGiftRowCount,
    nominalGiftRows,
    nominalGiftItems,
    nominalGiftGroups,
  } = evaluation;

  const isVnd = (maTte || "VND").trim().toUpperCase() === "VND";
  const showNominalGifts = !isWarehouse && isVnd;

  const displayedRules = onlyMatchedInModal
    ? matchedRules
    : evaluatedRules;

  const formatRangeText = (p: PromotionProgram) => {
    if (p.startDate && p.endDate) {
      return `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`;
    }
    if (p.startDate) return `Từ ${formatDate(p.startDate)}`;
    if (p.endDate) return `Đến ${formatDate(p.endDate)}`;
    return "Không giới hạn";
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Đếm số lượng / định mức cho từng nhóm hàng có trên phiếu (VD: Fly, See 10/2) */}
        {matchedRules.map((er) => {
          const { rule, matchedQty, activeResult } = er;
          const threshold = activeResult.option.buyQty;
          const reached = matchedQty >= threshold;
          const rulesTooltip = rule.options.map((o) => o.label).join(" | ");
          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => setIsOpen(true)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition-colors cursor-pointer ${
                reached
                  ? "bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100"
              }`}
              title={`${rule.name}: ${formatQuantity(matchedQty)}/${threshold} ${rule.buyUnit} — ${rulesTooltip}`}
            >
              <span className="font-medium">{rule.shortName}</span>
              <span
                className={`font-mono font-bold ${
                  reached ? "text-emerald-700" : "text-amber-800"
                }`}
              >
                {formatQuantity(matchedQty)}/{threshold}
              </span>
            </button>
          );
        })}

        {/* Đếm từng loại hàng mang ra khuyến mại (đơn giá 1–10 đồng VND) */}
        {showNominalGifts && (
          <div className="inline-flex flex-wrap items-center gap-1">
            {nominalGiftGroups.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer"
                title="Đếm hàng mang ra khuyến mại có đơn giá từ 1–10₫ (phân tách theo từng loại)"
              >
                <span className="font-medium">Quà (1–10₫):</span>
                <span className="font-mono font-bold text-neutral-600">0</span>
              </button>
            ) : (
              <>
                <span className="text-[11px] font-semibold text-sky-800 ml-0.5">
                  Quà (1–10₫):
                </span>
                {nominalGiftGroups.map((grp) => (
                  <button
                    key={grp.categoryId}
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100 transition-colors cursor-pointer"
                    title={`${grp.label} (giá 1–10₫):\n${grp.items
                      .map(
                        (g) =>
                          `• ${g.ma_vt}${g.ten_vt ? ` - ${g.ten_vt}` : ""}: ${formatQuantity(g.totalQty)} ${g.dvt}`.trim(),
                      )
                      .join("\n")}`}
                  >
                    <span className="font-medium">{grp.label}:</span>
                    <span className="font-mono font-bold text-sky-700">
                      {formatQuantity(grp.totalQty)}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal chi tiết các nhóm khuyến mại */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Đếm hàng khuyến mại"
            className="bg-white rounded-md shadow-2xl border border-neutral-300 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Modal Header */}
            <div className="bg-primary-800 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                    <span>Đếm Hàng Khuyến Mại</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium normal-case ${
                        isDateInRange
                          ? "bg-emerald-500/25 text-emerald-100 border border-emerald-400/40"
                          : "bg-amber-500/25 text-amber-100 border border-amber-400/40"
                      }`}
                    >
                      {isDateInRange
                        ? "Đang trong thời hạn"
                        : "Ngoài thời hạn ngày CT"}
                    </span>
                  </div>
                  <div className="text-[11px] text-primary-200 truncate">
                    {program.name} ({formatRangeText(program)})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Program Switcher & Filter Bar */}
            <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-neutral-600 font-semibold flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
                  Chương trình:
                </label>
                <select
                  value={programOverride}
                  onChange={(e) => setProgramOverride(e.target.value)}
                  className="erp-input text-xs py-1 pr-6 bg-white border-neutral-300 font-medium text-neutral-800"
                >
                  <option value="AUTO">
                    Tự động theo ngày CT (
                    {ngayCt ? formatDate(ngayCt) : "hôm nay"})
                  </option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {!isWarehouse && (
                  <label className="inline-flex items-center gap-1.5 text-neutral-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={excludeNominalGiftRows}
                      onChange={(e) =>
                        setExcludeNominalGiftRows(e.target.checked)
                      }
                      className="rounded border-neutral-300 text-primary-600"
                    />
                    <span>Bỏ qua dòng quà tặng (1–10₫)</span>
                    {ignoredGiftRowCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono text-[10px]">
                        Đã bỏ {ignoredGiftRowCount} dòng
                      </span>
                    )}
                  </label>
                )}

                <label className="inline-flex items-center gap-1.5 text-neutral-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyMatchedInModal}
                    onChange={(e) => setOnlyMatchedInModal(e.target.checked)}
                    className="rounded border-neutral-300 text-primary-600"
                  />
                  <span>Chỉ hiện nhóm có hàng ({matchedRules.length})</span>
                </label>
              </div>
            </div>

            {/* Hàng mang ra khuyến mại (giá 1–10₫) phân tách rõ từng loại */}
            {showNominalGifts && (
              <div className="px-4 py-2 bg-sky-50/60 border-b border-neutral-200 shrink-0 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-sky-900">
                      Hàng mang ra khuyến mại (đơn giá 1–10₫):
                    </span>
                    {nominalGiftGroups.map((grp) => (
                      <span
                        key={grp.categoryId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-900 text-[11px] font-semibold border border-sky-200"
                      >
                        <span>{grp.label}:</span>
                        <span className="font-mono font-bold">
                          {formatQuantity(grp.totalQty)}
                        </span>
                      </span>
                    ))}
                    {nominalGiftRows.length > 0 && (
                      <span className="text-[11px] text-sky-800">
                        ({nominalGiftRows.length} dòng · {nominalGiftItems.length} mã)
                      </span>
                    )}
                  </div>
                  {nominalGiftItems.length === 0 && (
                    <span className="text-[11px] text-neutral-500 italic">
                      Chưa có dòng hàng giá 1–10₫ trên phiếu.
                    </span>
                  )}
                </div>

                {nominalGiftItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {nominalGiftItems.map((g) => (
                      <div
                        key={g.ma_vt}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-sky-200 text-[11px]"
                        title={g.ten_vt}
                      >
                        <span className="text-[10px] font-semibold text-sky-800 bg-sky-50 px-1 rounded">
                          {g.categoryLabel}
                        </span>
                        <span className="font-mono font-semibold text-primary-800">
                          {g.ma_vt}
                        </span>
                        {g.ten_vt && (
                          <span className="text-neutral-600 max-w-[220px] truncate">
                            {g.ten_vt}
                          </span>
                        )}
                        <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 rounded border border-sky-200">
                          {formatQuantity(g.totalQty)}
                          {g.dvt ? ` ${g.dvt}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rules Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-100 border-b border-neutral-300 text-[11px] uppercase text-neutral-600">
                  <tr className="divide-x divide-neutral-200">
                    <th className="px-2.5 py-2 w-10 text-center">STT</th>
                    <th className="px-3 py-2 min-w-[260px]">
                      Nhóm sản phẩm & Điều kiện
                    </th>
                    <th className="px-3 py-2 w-32 text-right">SL / Định mức</th>
                    <th className="px-3 py-2 min-w-[240px]">
                      Quy định khuyến mại
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {displayedRules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-neutral-400 italic"
                      >
                        Không có mặt hàng nào thuộc các nhóm khuyến mại.
                      </td>
                    </tr>
                  ) : (
                    displayedRules.map((er) => {
                      const {
                        rule,
                        matchedRows,
                        matchedQty,
                        activeResult,
                        lowestUnitPriceItem,
                      } = er;
                      const threshold = activeResult.option.buyQty;
                      const hasQty = matchedQty > 0;
                      const reached = matchedQty >= threshold;
                      const rowBg = reached
                        ? "bg-emerald-50/40"
                        : hasQty
                          ? "bg-amber-50/40"
                          : "bg-white";

                      return (
                        <tr
                          key={rule.id}
                          className={`${rowBg} divide-x divide-neutral-200 align-top`}
                        >
                          <td className="px-2.5 py-2 text-center font-mono font-bold text-neutral-700">
                            {rule.order}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-neutral-900">
                              {rule.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              {rule.conditionSummary}
                            </div>
                            {matchedRows.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {matchedRows.map((mr) => (
                                  <span
                                    key={`${mr.rowIndex}-${mr.ma_vt}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-[10px] font-mono text-neutral-700"
                                    title={mr.ten_vt}
                                  >
                                    <span className="text-neutral-400">
                                      #{mr.rowIndex + 1}
                                    </span>
                                    <span className="font-semibold text-primary-800">
                                      {mr.ma_vt}
                                    </span>
                                    <span>×{formatQuantity(mr.qty)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded font-bold text-xs ${
                                reached
                                  ? "bg-emerald-100 text-emerald-800"
                                  : hasQty
                                    ? "bg-amber-100 text-amber-800"
                                    : "text-neutral-400"
                              }`}
                            >
                              {formatQuantity(matchedQty)}/{threshold}
                            </span>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {rule.buyUnit}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <ul className="space-y-0.5 text-neutral-700">
                              {rule.options.map((opt) => (
                                <li key={opt.id}>{opt.label}</li>
                              ))}
                            </ul>
                            {rule.options.some((o) => o.isLowestValueGift) &&
                              lowestUnitPriceItem &&
                              hasQty && (
                                <div className="mt-1.5 text-[10px] text-neutral-600 bg-white/80 border border-neutral-200 rounded px-1.5 py-0.5">
                                  Giá thấp nhất nhóm:{" "}
                                  <span className="font-mono font-semibold">
                                    {lowestUnitPriceItem.ma_vt}
                                  </span>{" "}
                                  (
                                  {formatCurrency(
                                    lowestUnitPriceItem.gia_nt9,
                                    maTte,
                                  )}
                                  ₫)
                                </div>
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-100 px-4 py-2 border-t border-neutral-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] text-neutral-500">
                Hiển thị tỷ lệ SL thực tế / định mức để đối chiếu và cân đối khuyến mại.
              </span>
              <button
                type="button"
                data-autofocus
                onClick={() => setIsOpen(false)}
                className="px-4 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Đóng (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

PromotionCounter.displayName = "PromotionCounter";
