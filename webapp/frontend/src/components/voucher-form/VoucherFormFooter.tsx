import React from "react";
import { Ban, Calculator, Check, RefreshCw } from "lucide-react";
import { formatCurrency } from "../../lib/format";

export interface VoucherFormFooterProps {
  isEditable: boolean;
  isWarehouse?: boolean;
  isDifferentCreator: boolean;
  voucherCreator: string;
  saving: boolean;
  maTte: string;
  totals: {
    ttien_nt: number;
    ttien_nt4?: number;
    ttien_nt0: number;
  };
  hidePriceCalc?: boolean;
  customTotalsNode?: React.ReactNode;
  onSave: (bypassChecks: boolean) => void;
  onRequestClose: () => void;
  onOpenPriceCalc?: () => void;
}

export const VoucherFormFooter: React.FC<VoucherFormFooterProps> = ({
  isEditable,
  isWarehouse = false,
  isDifferentCreator,
  voucherCreator,
  saving,
  maTte,
  totals,
  hidePriceCalc = false,
  customTotalsNode,
  onSave,
  onRequestClose,
  onOpenPriceCalc,
}) => (
  <footer
    className="bg-white border-t border-neutral-300 px-3 py-1 flex flex-wrap items-center justify-between gap-1.5 shrink-0 text-xs"
    data-purpose="footer-controls"
  >
    <div className="flex items-center gap-1.5">
      {isEditable ? (
        <button
          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded shadow-sm transition-all ${
            isDifferentCreator
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed opacity-70"
              : "bg-primary-700 hover:bg-primary-800 text-white disabled:opacity-50 cursor-pointer"
          }`}
          type="button"
          onClick={() => onSave(false)}
          disabled={saving || isDifferentCreator}
          title={
            isDifferentCreator
              ? `Phiếu do "${voucherCreator || "(trống)"}" lập — nút Lưu bị khóa (dùng Shift + Enter để lưu bỏ qua công nợ và người lập)`
              : "Chấp nhận lưu chứng từ (Ctrl + Enter; Shift + Enter để lưu và bỏ qua công nợ)"
          }
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5 mr-1.5" />
          )}
          {saving ? "Đang lưu..." : "Chấp nhận"}
          <kbd
            className={`ml-1.5 text-[10px] ${
              isDifferentCreator
                ? "bg-neutral-300 text-neutral-500 border-neutral-400"
                : "bg-primary-900/40 text-primary-100 border-primary-600"
            }`}
          >
            Ctrl + Enter
          </kbd>
        </button>
      ) : (
        <button
          className="inline-flex items-center px-2.5 py-1 bg-neutral-200 text-neutral-500 text-xs font-semibold rounded shadow-sm cursor-not-allowed"
          type="button"
          disabled
        >
          <Check className="w-3.5 h-3.5 mr-1.5" />
          Chấp nhận
        </button>
      )}

      <button
        className="inline-flex items-center px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium rounded border border-neutral-300 transition-all cursor-pointer"
        type="button"
        onClick={onRequestClose}
      >
        <Ban className="w-3.5 h-3.5 text-neutral-500 mr-1.5" />
        Hủy bỏ
        <kbd className="ml-1.5 text-[10px]">Esc</kbd>
      </button>

      {!isWarehouse && !hidePriceCalc && isEditable && onOpenPriceCalc && (
        <button
          className="inline-flex items-center px-2.5 py-1 bg-neutral-100 hover:bg-primary-50 text-neutral-700 hover:text-primary-800 text-xs font-medium rounded border border-neutral-300 hover:border-primary-300 transition-all cursor-pointer"
          type="button"
          onClick={onOpenPriceCalc}
          title="Mở máy tính tính đơn giá cho dòng đang chọn (F5)"
        >
          <Calculator className="w-3.5 h-3.5 text-primary-700 mr-1.5" />
          Tính giá
          <kbd className="ml-1.5 text-[10px]">F5</kbd>
        </button>
      )}
    </div>

    {customTotalsNode ? (
      customTotalsNode
    ) : (
      !isWarehouse && (
        <div className="flex items-center gap-2 text-neutral-600">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-neutral-600 uppercase tracking-tight">
                Tiền hàng:
              </span>
              <div className="flex items-center bg-white border border-neutral-200 rounded px-2 py-0.5 shadow-sm">
                <span className="font-mono font-bold text-neutral-900 text-xs">
                  {/* Tiền hàng trước chiết khấu = tổng thành tiền bán (Tien_Nt9) từ calcVoucherTotals */}
                  {formatCurrency(totals.ttien_nt, maTte)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-neutral-600 uppercase tracking-tight">
                Tiền CK:
              </span>
              <div className="flex items-center bg-white border border-primary-200 rounded px-2 py-0.5 shadow-sm">
                <span className="font-mono font-bold text-primary-900 text-xs">
                  {formatCurrency(totals.ttien_nt4 ?? 0, maTte)}
                </span>
              </div>
            </div>
            <div className="h-4 w-px bg-neutral-300"></div>
            <div className="flex items-center gap-1">
              <span className="text-xs uppercase font-bold text-neutral-600 tracking-tight">
                Tổng thanh toán:
              </span>
              <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded px-2 py-0.5 shadow-sm">
                <span className="font-mono font-bold text-primary-900 tracking-tight text-xs">
                  {formatCurrency(totals.ttien_nt0, maTte)}
                </span>
                <span className="text-xs font-bold text-primary-700">₫</span>
              </div>
            </div>
          </div>
        </div>
      )
    )}
  </footer>
);
