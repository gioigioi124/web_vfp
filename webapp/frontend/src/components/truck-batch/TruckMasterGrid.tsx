import React, { useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  GitMerge,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { VfpLookupCell, VfpOption } from "../ui/VfpLookupCell";
import { formatCurrency, formatQuantity } from "../../lib/format";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../../lib/customerIndex";
import {
  CumulativeDebtStatus,
  TruckDraftVoucher,
} from "../../types/truckBatch";

interface TruckMasterGridProps {
  vouchers: TruckDraftVoucher[];
  activeDraftId: string | null;
  cumulativeDebts: Record<string, CumulativeDebtStatus>;
  onSelectActive: (draftId: string) => void;
  onToggleSelected: (draftId: string) => void;
  onToggleAllValid: (selectAll: boolean) => void;
  onUpdateDienGiai: (draftId: string, value: string) => void;
  onSwapCustomer: (
    draftId: string,
    customer: {
      ma_dt: string;
      ten_dt: string;
      dia_chi?: string;
      ong_ba?: string;
      ma_bp?: string;
      han_tt?: number;
    },
  ) => void;
  onRepriceForCustomer: (draftId: string) => void;
  onToggleBypassDebt: (draftId: string) => void;
  onMergeDrafts: (draftIds: string[]) => void;
}

export const TruckMasterGrid: React.FC<TruckMasterGridProps> = React.memo(
  ({
    vouchers,
    activeDraftId,
    cumulativeDebts,
    onSelectActive,
    onToggleSelected,
    onToggleAllValid,
    onUpdateDienGiai,
    onSwapCustomer,
    onRepriceForCustomer,
    onToggleBypassDebt,
    onMergeDrafts,
  }) => {
    // Đếm số phiếu theo từng khách hàng để hiển thị nút ghép nhanh cho khách có >= 2 phiếu
    const draftsByCustomer = useMemo(() => {
      const map: Record<string, TruckDraftVoucher[]> = {};
      for (const v of vouchers) {
        const key = (v.ma_dt || "").trim().toUpperCase();
        if (!map[key]) map[key] = [];
        map[key].push(v);
      }
      return map;
    }, [vouchers]);

    const activeVoucher = useMemo(
      () => vouchers.find((v) => v.draft_id === activeDraftId) || null,
      [vouchers, activeDraftId],
    );

    // Các phiếu có thể ghép với phiếu đang active (cùng Ma_Dt)
    const activeSameCustomerDrafts = useMemo(() => {
      if (!activeVoucher) return [];
      const key = activeVoucher.ma_dt.trim().toUpperCase();
      return draftsByCustomer[key] || [];
    }, [activeVoucher, draftsByCustomer]);

    const selectedCount = useMemo(
      () => vouchers.filter((v) => v.selected).length,
      [vouchers],
    );

    const overLimitUnbypassedCount = useMemo(
      () =>
        vouchers.filter((v) => {
          const st = cumulativeDebts[v.draft_id];
          return st?.isOverLimit && !v.skip_debt_check;
        }).length,
      [vouchers, cumulativeDebts],
    );

    const fetchCustomerOptions = useCallback(
      async (query: string): Promise<VfpOption[]> => {
        await initCustomerIndex();
        return searchCustomers(query, 25).map((opt) => ({
          value: opt.value,
          label: opt.label,
          hint: opt.hint || "",
        }));
      },
      [],
    );

    const handleCustomerCommit = useCallback(
      async (draftId: string, rawCode: string) => {
        const clean = rawCode.trim().toUpperCase();
        if (!clean) return;
        const current = vouchers.find((v) => v.draft_id === draftId);
        if (current && current.ma_dt.trim().toUpperCase() === clean) return;

        await initCustomerIndex();
        const hit = getCustomer(clean);
        if (hit) {
          onSwapCustomer(draftId, {
            ma_dt: hit.ma_dt,
            ten_dt: hit.ten_dt,
            dia_chi: hit.dia_chi,
            ong_ba: hit.ten_dt,
            ma_bp: hit.ma_bp,
            han_tt: hit.han_tt,
          });
        } else {
          // Cho phép gõ mã khách trực tiếp (VD khi dùng MockAdapter offline)
          onSwapCustomer(draftId, {
            ma_dt: clean,
            ten_dt: clean,
          });
        }
      },
      [vouchers, onSwapCustomer],
    );

    return (
      <section className="flex flex-col h-full min-h-0 bg-white border-b border-slate-300">
        {/* Toolbar Master Grid */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-100 border-b border-slate-300 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
              Danh sách phiếu bán dự kiến ({vouchers.length})
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[11px] font-semibold">
              Chọn xuất: {selectedCount}/{vouchers.length}
            </span>
            {overLimitUnbypassedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-300 text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3" />
                {overLimitUnbypassedCount} phiếu quá nợ (đổi KH hoặc Shift+Enter)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => onToggleAllValid(true)}
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
            >
              Chọn hợp lệ
            </button>
            <button
              type="button"
              onClick={() => onToggleAllValid(false)}
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
            >
              Bỏ chọn
            </button>
            {activeSameCustomerDrafts.length >= 2 && (
              <button
                type="button"
                onClick={() =>
                  onMergeDrafts(activeSameCustomerDrafts.map((d) => d.draft_id))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E3A8A] hover:bg-blue-900 text-white font-semibold cursor-pointer shadow-xs"
                title={`Ghép tất cả ${activeSameCustomerDrafts.length} phiếu của khách ${activeVoucher?.ma_dt} thành 1 phiếu (Ctrl+G)`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>
                  Ghép {activeSameCustomerDrafts.length} phiếu của{" "}
                  {activeVoucher?.ma_dt}
                </span>
                <kbd className="ml-1 px-1 py-0 text-[9px] bg-blue-950/60 border border-blue-400/40 rounded font-mono">
                  Ctrl+G
                </kbd>
              </button>
            )}
          </div>
        </div>

        {/* Master Data Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-8 px-2 py-1.5 border-r border-slate-200 text-center">
                  ✓
                </th>
                <th className="w-10 px-2 py-1.5 border-r border-slate-200 text-center">
                  #
                </th>
                <th className="w-36 px-2 py-1.5 border-r border-slate-200 text-left">
                  Mã KH (sửa được)
                </th>
                <th className="min-w-[180px] px-2 py-1.5 border-r border-slate-200 text-left">
                  Tên khách hàng
                </th>
                <th className="w-24 px-2 py-1.5 border-r border-slate-200 text-center">
                  Đơn kho
                </th>
                <th className="min-w-[220px] px-2 py-1.5 border-r border-slate-200 text-left">
                  Diễn giải chung cả đơn
                </th>
                <th className="w-20 px-2 py-1.5 border-r border-slate-200 text-right">
                  Tổng SL
                </th>
                <th className="w-32 px-2 py-1.5 border-r border-slate-200 text-right">
                  Tổng tiền
                </th>
                <th className="w-44 px-2 py-1.5 border-r border-slate-200 text-right">
                  Dư nợ / Giới hạn
                </th>
                <th className="w-44 px-2 py-1.5 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {vouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-10 text-center text-slate-500 text-xs"
                  >
                    Không còn đơn kho nào chưa xuất cho chuyến xe này.
                  </td>
                </tr>
              ) : (
                vouchers.map((v, idx) => {
                  const isActive = v.draft_id === activeDraftId;
                  const debt = cumulativeDebts[v.draft_id];
                  const isOverLimit = Boolean(debt?.isOverLimit);
                  const isBypassed = isOverLimit && v.skip_debt_check;
                  const isBlockedOverLimit = isOverLimit && !v.skip_debt_check;
                  const zeroPriceCount = v.items.filter(
                    (it) => Number(it.gia_nt9 || 0) === 0,
                  ).length;
                  const totalQty = v.items.reduce(
                    (acc, it) => acc + Number(it.so_luong9 || 0),
                    0,
                  );
                  const sameCustomerGroup =
                    draftsByCustomer[v.ma_dt.trim().toUpperCase()] || [];

                  let rowToneClass = isActive
                    ? "bg-blue-50/90 border-l-4 border-l-[#1E3A8A]"
                    : "bg-white hover:bg-slate-50 border-l-4 border-l-transparent";

                  if (isBlockedOverLimit) {
                    rowToneClass = isActive
                      ? "bg-red-100/90 border-l-4 border-l-red-600 ring-1 ring-inset ring-red-400"
                      : "bg-red-50/80 hover:bg-red-100/70 border-l-4 border-l-red-600";
                  } else if (isBypassed) {
                    rowToneClass = isActive
                      ? "bg-amber-100/90 border-l-4 border-l-amber-600 ring-1 ring-inset ring-amber-400"
                      : "bg-amber-50/75 hover:bg-amber-100/60 border-l-4 border-l-amber-500";
                  } else if (v.errorMsg) {
                    rowToneClass =
                      "bg-red-50/80 border-l-4 border-l-red-600";
                  }

                  return (
                    <tr
                      key={v.draft_id}
                      onClick={() => onSelectActive(v.draft_id)}
                      onKeyDown={(e) => {
                        if (e.shiftKey && e.key === "Enter" && isOverLimit) {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleBypassDebt(v.draft_id);
                        }
                      }}
                      className={`transition-colors cursor-pointer ${rowToneClass}`}
                    >
                      {/* Checkbox chọn xuất */}
                      <td
                        className="px-2 py-1 border-r border-slate-200 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleSelected(v.draft_id)}
                          className={`w-4 h-4 rounded-sm border inline-flex items-center justify-center transition cursor-pointer ${
                            v.selected
                              ? isBlockedOverLimit
                                ? "bg-red-600 border-red-700 text-white"
                                : "bg-[#1E3A8A] border-[#1E3A8A] text-white"
                              : "bg-white border-slate-400 hover:border-slate-600"
                          }`}
                          title={
                            isBlockedOverLimit
                              ? "Phiếu đang quá nợ — đổi khách hoặc bấm Shift+Enter để bypass"
                              : "Chọn/bỏ chọn phiếu xuất"
                          }
                        >
                          {v.selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      </td>

                      {/* STT */}
                      <td className="px-2 py-1 border-r border-slate-200 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Mã KH (cho phép đổi khách giữ nguyên giá) */}
                      <td
                        className="p-0 border-r border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-0.5 pr-1">
                          <VfpLookupCell
                            value={v.ma_dt}
                            onFocusRow={() => onSelectActive(v.draft_id)}
                            onValueChange={() => {
                              /* chờ onPick / onCommit để không làm mất ten_dt khi gõ nháp */
                            }}
                            onPick={(opt) => {
                              void handleCustomerCommit(v.draft_id, opt.value);
                            }}
                            onCommit={(raw) => {
                              void handleCustomerCommit(v.draft_id, raw);
                            }}
                            fetcher={fetchCustomerOptions}
                            advanceOnPick={false}
                            placeholder="Mã KH"
                            className={`h-7 px-1.5 font-mono font-semibold uppercase text-xs bg-transparent ${
                              isBlockedOverLimit
                                ? "text-red-800"
                                : "text-slate-900"
                            }`}
                          />
                          {v.customerSwapped && (
                            <button
                              type="button"
                              onClick={() => onRepriceForCustomer(v.draft_id)}
                              className="p-1 rounded hover:bg-blue-100 text-blue-700 flex-shrink-0 cursor-pointer"
                              title="Đã đổi khách (giữ nguyên giá cũ). Bấm nếu muốn nạp lại bảng giá của khách mới"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Tên KH */}
                      <td className="px-2 py-1 border-r border-slate-200">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="truncate font-medium text-slate-800"
                            title={v.ten_dt}
                          >
                            {v.ten_dt || "—"}
                          </span>
                          {v.customerSwapped && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-sky-100 text-sky-800 text-[10px] font-semibold flex-shrink-0"
                              title="Đã đổi sang khách khác — giữ nguyên giá"
                            >
                              <UserCheck className="w-2.5 h-2.5" />
                              Đổi KH
                            </span>
                          )}
                        </div>
                        {v.dia_chi && (
                          <div
                            className="text-[10px] text-slate-500 truncate"
                            title={v.dia_chi}
                          >
                            {v.dia_chi}
                          </div>
                        )}
                      </td>

                      {/* Số đơn kho + nút ghép nhanh nếu cùng KH có nhiều phiếu */}
                      <td className="px-2 py-1 border-r border-slate-200 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px] font-semibold text-slate-700">
                            {v.source_orders.length} đơn · {v.items.length}d
                          </span>
                          {sameCustomerGroup.length >= 2 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMergeDrafts(
                                  sameCustomerGroup.map((d) => d.draft_id),
                                );
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 hover:text-blue-900 hover:underline font-semibold cursor-pointer"
                              title={`Khách ${v.ma_dt} đang có ${sameCustomerGroup.length} phiếu — bấm để ghép lại thành 1`}
                            >
                              <GitMerge className="w-2.5 h-2.5" />
                              Ghép ({sameCustomerGroup.length})
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Diễn giải chung cả đơn (editable inline) */}
                      <td
                        className="p-0 border-r border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={v.dien_giai0}
                          maxLength={128}
                          onFocus={() => onSelectActive(v.draft_id)}
                          onChange={(e) =>
                            onUpdateDienGiai(v.draft_id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.shiftKey && e.key === "Enter" && isOverLimit) {
                              e.preventDefault();
                              onToggleBypassDebt(v.draft_id);
                            }
                          }}
                          placeholder="Diễn giải chung cho cả phiếu..."
                          className="w-full h-7 px-2 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                        />
                      </td>

                      {/* Tổng SL */}
                      <td className="px-2 py-1 border-r border-slate-200 text-right font-mono text-slate-700">
                        {formatQuantity(totalQty)}
                      </td>

                      {/* Tổng tiền */}
                      <td className="px-2 py-1 border-r border-slate-200 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(v.ttien0)}
                      </td>

                      {/* Dư nợ cộng dồn / Hạn mức */}
                      <td className="px-2 py-1 border-r border-slate-200 text-right font-mono text-[11px]">
                        {debt ? (
                          <div className="leading-tight">
                            <div
                              className={
                                isBlockedOverLimit
                                  ? "text-red-700 font-bold"
                                  : isBypassed
                                    ? "text-amber-800 font-bold"
                                    : debt.willExceedAfter
                                      ? "text-amber-700 font-semibold"
                                      : "text-slate-700"
                              }
                            >
                              {formatCurrency(debt.duCuoiBefore)}
                              {debt.addedBefore > 0 && (
                                <span
                                  className="text-[10px] text-blue-700 ml-1"
                                  title={`Đã cộng thêm ${formatCurrency(debt.addedBefore)} từ phiếu trước của cùng khách trên xe`}
                                >
                                  (+xe)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              GH:{" "}
                              {debt.gioiHan > 0
                                ? formatCurrency(debt.gioiHan)
                                : "Không GH"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Trạng thái & Bypass */}
                      <td className="px-2 py-1 text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          {isBlockedOverLimit ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBypassDebt(v.draft_id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 font-semibold w-fit cursor-pointer"
                              title="Không lưu khi quá nợ. Đổi Mã KH ở cột bên trái hoặc bấm Shift+Enter để bypass."
                            >
                              <ShieldAlert className="w-3 h-3" />
                              <span>Quá nợ · Shift+Enter</span>
                            </button>
                          ) : isBypassed ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBypassDebt(v.draft_id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 font-semibold w-fit cursor-pointer"
                              title="Đã bypass hạn mức nợ — bấm lại hoặc Shift+Enter để tắt bypass"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Đã bypass nợ</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold w-fit">
                              Sẵn sàng
                            </span>
                          )}

                          {zeroPriceCount > 0 && (
                            <span className="text-[10px] text-amber-700">
                              {zeroPriceCount} dòng giá = 0₫
                            </span>
                          )}
                          {v.errorMsg && (
                            <span
                              className="text-[10px] text-red-700 font-medium line-clamp-2"
                              title={v.errorMsg}
                            >
                              {v.errorMsg}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  },
);
