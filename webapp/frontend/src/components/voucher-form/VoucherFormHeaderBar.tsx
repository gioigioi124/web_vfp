import React from "react";
import {
  AlertTriangle,
  CreditCard,
  FileText,
  History,
  Printer,
  X,
} from "lucide-react";
import { CURRENT_USER, VoucherDraftPayload } from "./types";

export interface VoucherFormHeaderBarProps {
  isWarehouse: boolean;
  isCreate: boolean;
  isEdit: boolean;
  isDirty: boolean;
  isDifferentCreator: boolean;
  hasVoucher: boolean;
  voucherCreator: string;
  voucherStt?: string;
  maDt: string;
  pendingDraft: VoucherDraftPayload | null;
  errorMessage: string | null;
  onPrint?: () => void;
  onViewDebt?: (maDt: string) => void;
  onRequestClose: () => void;
  onRestoreDraft: () => void;
  onDismissDraft: () => void;
  onClearError: () => void;
}

export const VoucherFormHeaderBar: React.FC<VoucherFormHeaderBarProps> = ({
  isWarehouse,
  isCreate,
  isEdit,
  isDirty,
  isDifferentCreator,
  hasVoucher,
  voucherCreator,
  voucherStt,
  maDt,
  pendingDraft,
  errorMessage,
  onPrint,
  onViewDebt,
  onRequestClose,
  onRestoreDraft,
  onDismissDraft,
  onClearError,
}) => (
  <>
    {/* ===== Window Header (navy / emerald for warehouse) ===== */}
    <header
      className={`${
        isWarehouse
          ? "bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 border-emerald-950"
          : "bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 border-primary-900"
      } text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0 border-b`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-white/15 text-primary-100 border border-white/20">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide uppercase text-white">
            {isWarehouse
              ? isCreate
                ? "Thêm Mới Phiếu Xuất Kho"
                : isEdit
                  ? "Sửa Phiếu Xuất Kho"
                  : "Xem Phiếu Xuất Kho"
              : isCreate
                ? "Thêm Mới Chứng Từ"
                : isEdit
                  ? "Sửa Chứng Từ"
                  : "Xem Chứng Từ"}
          </span>
          <span className="text-primary-200 text-xs font-normal">
            {isWarehouse ? "/ Phiếu xuất kho" : "/ Bán hàng công nợ"}
          </span>
          <span
            className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              isCreate
                ? "bg-success-600/30 text-success-200 border-success-400/40"
                : isEdit
                  ? "bg-amber-500/30 text-amber-200 border-amber-400/40"
                  : "bg-white/10 text-white border-white/20"
            }`}
          >
            {isCreate
              ? "MODE: THÊM MỚI (M)"
              : isEdit
                ? "MODE: SỬA (S)"
                : "MODE: XEM"}
          </span>
          {isDirty && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-300/40"
              title="Có thay đổi chưa lưu — bản nháp được tự động lưu tạm sau 2 giây"
            >
              ● Chưa lưu
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-primary-200">Người lập:</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded border ${
              isDifferentCreator && hasVoucher
                ? "text-amber-200 bg-amber-950/60 border-amber-400/50"
                : "text-white bg-black/25 border-white/20"
            }`}
            title={
              isDifferentCreator && hasVoucher
                ? `Phiếu do ${voucherCreator || "(trống)"} lập — nút Lưu bị khóa (dùng Shift+Enter để lưu bỏ qua kiểm tra)`
                : undefined
            }
          >
            {isCreate
              ? CURRENT_USER
              : hasVoucher
                ? voucherCreator || "—"
                : "..."}
          </span>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-white/20">
          {!isWarehouse && voucherStt && onPrint && (
            <button
              className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="In phiếu (F7)"
              onClick={onPrint}
              type="button"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
          {!isWarehouse && maDt && onViewDebt && (
            <button
              className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Chi tiết công nợ"
              onClick={() => onViewDebt(maDt)}
              type="button"
            >
              <CreditCard className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            className="p-1 px-2 text-rose-200 hover:text-white hover:bg-danger-600 rounded transition-colors ml-1 cursor-pointer"
            title="Đóng (Esc)"
            onClick={onRequestClose}
            type="button"
            aria-label="Đóng biểu mẫu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

    {/* ===== Draft Recovery Banner ===== */}
    {pendingDraft && (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">
            Tìm thấy bản nháp chưa lưu lúc{" "}
            <b className="font-mono">
              {new Date(pendingDraft.savedAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>{" "}
            (
            {pendingDraft.items.filter((it) => Boolean(it.ma_vt?.trim())).length}{" "}
            dòng hàng).
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRestoreDraft}
            className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold text-[11px] cursor-pointer transition-colors"
          >
            Khôi phục bản nháp
          </button>
          <button
            type="button"
            onClick={onDismissDraft}
            className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-medium text-[11px] cursor-pointer transition-colors"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    )}

    {/* ===== Toast Notifications / Alerts ===== */}
    {errorMessage && (
      <div className="bg-danger-50 border-b border-danger-200 px-4 py-2 flex items-center justify-between text-xs text-danger-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
        <button
          type="button"
          onClick={onClearError}
          className="text-danger-500 hover:text-danger-800 cursor-pointer"
          aria-label="Đóng thông báo lỗi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )}
  </>
);
