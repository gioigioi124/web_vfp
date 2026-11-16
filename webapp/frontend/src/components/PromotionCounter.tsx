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
import { useModalLock } from "../lib/modalLock";
import {
  Gift,
  X,
  CheckCircle2,
  Clock,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

interface PromotionCounterProps {
  items: VoucherDetail[];
  ngayCt?: string;
  maTte?: string;
  isWarehouse?: boolean;
  /** Key thay đổi khi chuyển phiếu để reset lựa chọn phương án cục bộ. */
  voucherKey?: string;
  programs?: PromotionProgram[];
}

export const PromotionCounter: React.FC<PromotionCounterProps> = ({
  items,
  ngayCt,
  maTte = "VND",
  isWarehouse = false,
  voucherKey = "",
  programs = PROMOTION_PROGRAMS,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [programOverride, setProgramOverride] = useState<string>("AUTO");
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, number>
  >({});
  const [excludeNominalGiftRows, setExcludeNominalGiftRows] = useState<boolean>(
    !isWarehouse,
  );
  const [onlyMatchedInModal, setOnlyMatchedInModal] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalLock(isOpen, modalRef);

  // Reset các lựa chọn phương án cục bộ khi mở chứng từ khác hoặc đổi chế độ bán/kho.
  useEffect(() => {
    setSelectedOptions({});
    setExcludeNominalGiftRows(!isWarehouse);
  }, [voucherKey, isWarehouse]);

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
      selectedOptions,
    });
  }, [
    activeProgram,
    items,
    ngayCt,
    maTte,
    excludeNominalGiftRows,
    selectedOptions,
  ]);

  if (!evaluation) return null;

  const {
    program,
    isDateInRange,
    evaluatedRules,
    matchedRules,
    totalSets,
    giftSummary,
    ignoredGiftRowCount,
  } = evaluation;

  const outOfDateAuto = !isDateInRange && programOverride === "AUTO";
  const displayedRules = onlyMatchedInModal
    ? matchedRules
    : evaluatedRules;

  const summaryBadgeTone = outOfDateAuto
    ? "bg-neutral-200/80 text-neutral-600 border-neutral-300 hover:bg-neutral-200"
    : totalSets > 0
      ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
      : matchedRules.length > 0
        ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
        : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50";

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
        {/* Nút tổng hợp khuyến mại trên thanh Chi tiết hàng hóa */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs ${summaryBadgeTone}`}
          title={`Xem chi tiết bộ đếm khuyến mại (${program.name})`}
        >
          <Gift className="w-3 h-3 shrink-0" />
          <span>KM:</span>
          <span className="font-mono font-bold">
            {totalSets} bộ
          </span>
          {outOfDateAuto && (
            <span className="text-[10px] font-normal opacity-80">
              (Ngoài hạn)
            </span>
          )}
          <ChevronRight className="w-3 h-3 opacity-60 -mr-0.5" />
        </button>

        {/* Các badge đếm bộ theo từng nhóm hàng đang có trên phiếu */}
        {matchedRules.map((er) => {
          const { rule, matchedQty, activeResult } = er;
          const hasSet = activeResult.sets > 0;
          const isMultiOption = rule.options.length > 1;
          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => setIsOpen(true)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition-colors cursor-pointer ${
                hasSet
                  ? "bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100"
              }`}
              title={
                hasSet
                  ? `${rule.name}: SL ${formatQuantity(matchedQty)} ${rule.buyUnit} → ${activeResult.sets} bộ (${activeResult.giftQty} ${activeResult.option.giftName})`
                  : `${rule.name}: SL ${formatQuantity(matchedQty)}/${activeResult.option.buyQty} ${rule.buyUnit} (cần thêm ${formatQuantity(activeResult.neededForNextSet)} để đạt 1 bộ)`
              }
            >
              <span className="font-medium">{rule.shortName}:</span>
              {hasSet ? (
                <>
                  <span className="font-mono font-bold text-emerald-700">
                    {activeResult.sets} bộ
                  </span>
                  <span className="text-emerald-700/80 text-[10px]">
                    ({formatQuantity(activeResult.giftQty)}{" "}
                    {activeResult.option.giftShortName}
                    {isMultiOption ? " ⇄" : ""})
                  </span>
                </>
              ) : (
                <span className="font-mono text-amber-800">
                  {formatQuantity(matchedQty)}/{activeResult.option.buyQty}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal chi tiết bộ đếm khuyến mại */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-md shadow-2xl border border-neutral-300 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Modal Header */}
            <div className="bg-primary-800 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                    <span>Bộ Đếm Khuyến Mại</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium normal-case ${
                        isDateInRange
                          ? "bg-emerald-500/25 text-emerald-100 border border-emerald-400/40"
                          : "bg-amber-500/25 text-amber-100 border border-amber-400/40"
                      }`}
                    >
                      {isDateInRange ? "Đang trong thời hạn" : "Ngoài thời hạn ngày CT"}
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

            {/* Filter & Program Switcher Bar */}
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
                    Tự động theo ngày CT ({ngayCt ? formatDate(ngayCt) : "hôm nay"})
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

            {/* Summary Gift Entitlement */}
            <div className="px-4 py-2.5 bg-emerald-50/50 border-b border-neutral-200 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">
                    Tổng hợp quà tặng được hưởng:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-900 font-mono font-bold text-xs">
                    {totalSets} bộ KM
                  </span>
                </div>
                {giftSummary.length === 0 && (
                  <span className="text-xs text-neutral-500 italic">
                    Chưa có nhóm hàng nào đủ định mức nhận quà.
                  </span>
                )}
              </div>

              {giftSummary.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {giftSummary.map((g) => (
                    <div
                      key={g.key}
                      className="flex items-center gap-2 px-2.5 py-1 rounded bg-white border border-emerald-300 shadow-2xs text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-neutral-800">
                          {g.giftName}
                        </span>
                        {g.giftCode && (
                          <span className="ml-1.5 font-mono text-[10px] text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">
                            {g.giftCode}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {formatQuantity(g.totalGiftQty)} {g.giftUnit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rules Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-100 border-b border-neutral-300 text-[11px] uppercase text-neutral-600">
                  <tr className="divide-x divide-neutral-200">
                    <th className="px-2.5 py-2 w-10 text-center">STT</th>
                    <th className="px-3 py-2 min-w-[230px]">
                      Nhóm sản phẩm & Điều kiện
                    </th>
                    <th className="px-2.5 py-2 w-24 text-right">SL khớp</th>
                    <th className="px-2.5 py-2 w-24 text-right">Số bộ KM</th>
                    <th className="px-3 py-2 min-w-[220px]">
                      Quà tặng được hưởng
                    </th>
                    <th className="px-3 py-2 w-44">Tiến độ / Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {displayedRules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
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
                        selectedOptionIndex,
                        optionResults,
                        activeResult,
                        lowestUnitPriceItem,
                      } = er;
                      const hasQty = matchedQty > 0;
                      const hasSets = activeResult.sets > 0;
                      const rowBg = hasSets
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
                          <td className="px-2.5 py-2 text-right font-mono">
                            <span
                              className={`font-bold ${
                                hasQty ? "text-neutral-900" : "text-neutral-400"
                              }`}
                            >
                              {formatQuantity(matchedQty)}
                            </span>
                            <div className="text-[10px] text-neutral-500">
                              {rule.buyUnit}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded font-bold ${
                                hasSets
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "text-neutral-400"
                              }`}
                            >
                              {activeResult.sets} bộ
                            </span>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              ĐM: {activeResult.option.buyQty} {rule.buyUnit}/bộ
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {optionResults.length > 1 ? (
                              <div className="space-y-1">
                                {optionResults.map((optRes, optIdx) => {
                                  const isSelected =
                                    optIdx === selectedOptionIndex;
                                  return (
                                    <button
                                      key={optRes.option.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedOptions((prev) => ({
                                          ...prev,
                                          [rule.id]: optIdx,
                                        }))
                                      }
                                      className={`w-full text-left px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                        isSelected
                                          ? "bg-primary-50 border-primary-400 text-primary-900 font-semibold"
                                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                                      }`}
                                    >
                                      <span>{optRes.option.label}</span>
                                      <span className="font-mono font-bold shrink-0">
                                        {optRes.giftQty > 0
                                          ? `${formatQuantity(optRes.giftQty)} ${optRes.option.giftUnit}`
                                          : "0"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div>
                                <div className="text-neutral-800 font-medium">
                                  {activeResult.option.label}
                                </div>
                                {hasSets && (
                                  <div className="mt-0.5 font-mono font-bold text-emerald-700">
                                    → {formatQuantity(activeResult.giftQty)}{" "}
                                    {activeResult.option.giftUnit}{" "}
                                    {activeResult.option.giftName}
                                    {activeResult.option.giftCode
                                      ? ` (${activeResult.option.giftCode})`
                                      : ""}
                                  </div>
                                )}
                              </div>
                            )}

                            {activeResult.option.isLowestValueGift &&
                              lowestUnitPriceItem &&
                              hasQty && (
                                <div className="mt-1 text-[10px] text-neutral-600 bg-white/80 border border-neutral-200 rounded px-1.5 py-0.5">
                                  Giá thấp nhất nhóm:{" "}
                                  <span className="font-mono font-semibold">
                                    {lowestUnitPriceItem.ma_vt}
                                  </span>{" "}
                                  ({formatCurrency(lowestUnitPriceItem.gia_nt9, maTte)}₫)
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-2 text-[11px]">
                            {!hasQty ? (
                              <span className="text-neutral-400">Chưa có hàng</span>
                            ) : activeResult.remainder > 0 ? (
                              <div className="flex items-start gap-1 text-amber-700">
                                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                  Dư{" "}
                                  <b>{formatQuantity(activeResult.remainder)}</b>{" "}
                                  {rule.buyUnit} · thêm{" "}
                                  <b>
                                    {formatQuantity(
                                      activeResult.neededForNextSet,
                                    )}
                                  </b>{" "}
                                  để đạt bộ{" "}
                                  {activeResult.sets + 1}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Đủ tròn {activeResult.sets} bộ</span>
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
                Quy tắc ưu đãi có lựa chọn &ldquo;hoặc&rdquo; cho phép bấm để đổi phương án tính bộ.
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
};
