import React, { lazy, Suspense } from "react";
import {
  AlertTriangle,
  CreditCard,
  Save,
  X,
} from "lucide-react";
import { VoucherDetail } from "../../types/voucher";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { DebtDialogState } from "./types";

const PriceCalculatorModal = lazy(() =>
  import("../PriceCalculatorModal").then((m) => ({
    default: m.PriceCalculatorModal,
  })),
);

export interface VoucherFormModalsProps {
  items: VoucherDetail[];
  activeRowIndex: number;
  saving: boolean;
  isDifferentCreator: boolean;
  // Discard dialog
  showDiscardDialog: boolean;
  discardDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
  onSaveAndClose: () => void;
  // Debt / warning dialog
  debtDialog: DebtDialogState | null;
  debtDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  onCloseDebtDialog: () => void;
  // Account picker (F4)
  showAccountPicker: boolean;
  accountPickerRef: React.MutableRefObject<HTMLDivElement | null>;
  accountInputRef: React.MutableRefObject<HTMLInputElement | null>;
  accountQuery: string;
  setAccountQuery: (q: string) => void;
  fetchTaiKhoanOptionsLocal: (query: string) => Promise<AutocompleteOption[]>;
  onSelectAccount: (accountCode: string) => void;
  onCloseAccountPicker: () => void;
  // Price calculator (F5)
  showPriceCalc: boolean;
  calcInitialPrice: number;
  onApplyCalculatedPrice: (price: number) => void;
  onClosePriceCalc: () => void;
}

export const VoucherFormModals: React.FC<VoucherFormModalsProps> = ({
  items,
  activeRowIndex,
  saving,
  isDifferentCreator,
  showDiscardDialog,
  discardDialogRef,
  onCancelDiscard,
  onConfirmDiscard,
  onSaveAndClose,
  debtDialog,
  debtDialogRef,
  onCloseDebtDialog,
  showAccountPicker,
  accountPickerRef,
  accountInputRef,
  accountQuery,
  setAccountQuery,
  fetchTaiKhoanOptionsLocal,
  onSelectAccount,
  onCloseAccountPicker,
  showPriceCalc,
  calcInitialPrice,
  onApplyCalculatedPrice,
  onClosePriceCalc,
}) => {
  const safeCalcIdx = Math.max(
    0,
    Math.min(activeRowIndex, Math.max(0, items.length - 1)),
  );

  return (
    <>
      {/* Discard Unsaved Changes Confirmation Modal */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            ref={discardDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận thoát khi chưa lưu"
            className="bg-white rounded shadow-2xl border border-neutral-300 w-[440px] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Có thay đổi chưa lưu
              </span>
              <button
                type="button"
                onClick={onCancelDiscard}
                className="text-white/80 hover:text-white cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-neutral-700 space-y-2 leading-relaxed">
              <p>
                Chứng từ đang có thay đổi chưa được lưu. Bạn muốn lưu lại trước
                khi thoát hay bỏ các thay đổi này?
              </p>
            </div>
            <div className="bg-neutral-100 px-3.5 py-2 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                data-autofocus
                onClick={onCancelDiscard}
                className="px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-neutral-700 font-medium text-xs cursor-pointer"
              >
                Tiếp tục sửa (Esc)
              </button>
              <button
                type="button"
                onClick={onConfirmDiscard}
                className="px-3 py-1 bg-danger-50 hover:bg-danger-100 border border-danger-300 text-danger-700 font-semibold rounded text-xs cursor-pointer"
              >
                Bỏ thay đổi
              </button>
              <button
                type="button"
                disabled={saving || isDifferentCreator}
                onClick={onSaveAndClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded text-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu (Ctrl+Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Warning Dialog */}
      {debtDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            ref={debtDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={debtDialog.title}
            className="bg-white rounded shadow-2xl border border-neutral-300 w-[420px] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div
              className={`px-3.5 py-2 flex items-center justify-between text-white ${
                debtDialog.tone === "danger" ? "bg-danger-700" : "bg-amber-600"
              }`}
            >
              <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                {debtDialog.tone === "danger" ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {debtDialog.title}
              </span>
              <button
                type="button"
                onClick={onCloseDebtDialog}
                className="text-white/80 hover:text-white cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
              {debtDialog.message}
            </div>
            <div className="bg-neutral-100 px-3 py-2 flex justify-end border-t border-neutral-200">
              <button
                type="button"
                data-autofocus
                onClick={onCloseDebtDialog}
                className="px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Picker Modal (F4) */}
      {showAccountPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            ref={accountPickerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Chọn tài khoản"
            className="bg-white rounded shadow-2xl border border-neutral-300 w-96 overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-primary-800 text-white px-3.5 py-2 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide">
                F4: Chọn tài khoản
              </span>
              <button
                type="button"
                onClick={onCloseAccountPicker}
                className="text-white/80 hover:text-white cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <label className="text-xs text-neutral-600 font-medium block">
                Tìm số hiệu hoặc tên tài khoản:
              </label>
              <Autocomplete
                value={accountQuery}
                onChange={setAccountQuery}
                inputRef={accountInputRef}
                autoFocus
                onSelect={(opt) => onSelectAccount(opt.value)}
                fetcher={fetchTaiKhoanOptionsLocal}
                placeholder="Ví dụ: 5111, 131, 33311..."
                className="w-full text-xs"
              />
              <p className="text-[11px] text-neutral-500 italic">
                Tài khoản chọn sẽ được áp dụng cho dòng {activeRowIndex + 1}{" "}
                đang đứng.
              </p>
            </div>
            <div className="bg-neutral-100 px-3 py-1.5 flex justify-end border-t border-neutral-200">
              <button
                type="button"
                onClick={onCloseAccountPicker}
                className="px-3 py-1 bg-white border border-neutral-300 rounded text-xs font-medium hover:bg-neutral-50 cursor-pointer"
              >
                Đóng (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Calculator Modal (F5) */}
      {showPriceCalc && (
        <Suspense fallback={null}>
          <PriceCalculatorModal
            isOpen={showPriceCalc}
            rowNumber={safeCalcIdx + 1}
            itemCode={items[safeCalcIdx]?.ma_vt}
            itemName={items[safeCalcIdx]?.ten_vt}
            initialValue={calcInitialPrice}
            onApply={onApplyCalculatedPrice}
            onClose={onClosePriceCalc}
          />
        </Suspense>
      )}
    </>
  );
};
