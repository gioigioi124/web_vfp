import React from "react";
import { Printer, RefreshCw, X } from "lucide-react";

export interface PrintToolbarProps {
  targetCount: number;
  isFetching: boolean;
  hasDocs: boolean;
  dbMode: "sales" | "warehouse";
  previewInNoCk: "C" | "K";
  previewInGia: "1" | "0";
  previewCopies: number;
  fitToWidth: boolean;
  onChangeInNoCk: (val: "C" | "K") => void;
  onChangeInGia: (val: "1" | "0") => void;
  onChangeCopies: (updater: (c: number) => number) => void;
  onToggleFitToWidth: () => void;
  onPrint: () => void;
  onClose: () => void;
}

export const PrintToolbar: React.FC<PrintToolbarProps> = ({
  targetCount,
  isFetching,
  hasDocs,
  dbMode,
  previewInNoCk,
  previewInGia,
  previewCopies,
  fitToWidth,
  onChangeInNoCk,
  onChangeInGia,
  onChangeCopies,
  onToggleFitToWidth,
  onPrint,
  onClose,
}) => (
  <div className="bg-primary-900 text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
    <div className="flex items-center gap-2">
      <Printer className="w-4 h-4 text-primary-200" />
      <span className="font-bold text-xs sm:text-sm tracking-wide">
        Xem Trước Khi In
      </span>
      {targetCount > 1 && (
        <span className="px-1.5 py-0.5 rounded bg-primary-700 text-[11px] font-semibold">
          {targetCount} phiếu
        </span>
      )}
      {isFetching && (
        <span className="inline-flex items-center gap-1 text-[11px] text-primary-200">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Đang tải...
        </span>
      )}
    </div>

    {/* Tùy chọn In nợ cũ, In giá bán, Số bản & Phóng to/Thu gọn */}
    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
      <label
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 cursor-pointer select-none text-xs font-semibold"
        title="Bấm Space hoặc click để bật/tắt In nợ cũ"
      >
        <input
          data-autofocus
          type="checkbox"
          checked={previewInNoCk === "C"}
          onChange={(e) => onChangeInNoCk(e.target.checked ? "C" : "K")}
          className="h-4 w-4 md:h-3.5 md:w-3.5 accent-amber-400 cursor-pointer"
        />
        <span>In nợ cũ</span>
      </label>

      {dbMode !== "warehouse" && (
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 cursor-pointer select-none text-xs font-medium">
          <input
            type="checkbox"
            checked={previewInGia === "1"}
            onChange={(e) => onChangeInGia(e.target.checked ? "1" : "0")}
            className="h-4 w-4 md:h-3.5 md:w-3.5 accent-primary-300 cursor-pointer"
          />
          <span>In giá bán</span>
        </label>
      )}

      {/* Copies stepper 1..4 */}
      <div
        className="inline-flex items-center gap-1 px-2 py-1 md:py-0.5 rounded bg-white/10 border border-white/25 text-xs"
        title="Số bản in cho mỗi phiếu (1–4 bản)"
      >
        <span className="text-primary-100 text-[11px]">Bản:</span>
        <button
          type="button"
          onClick={() => onChangeCopies((c) => Math.max(1, c - 1))}
          disabled={previewCopies <= 1}
          className="w-7 h-7 md:w-5 md:h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-40 font-bold leading-none cursor-pointer"
          aria-label="Giảm số bản"
        >
          −
        </button>
        <span className="w-4 text-center font-mono font-bold">
          {previewCopies}
        </span>
        <button
          type="button"
          onClick={() => onChangeCopies((c) => Math.min(4, c + 1))}
          disabled={previewCopies >= 4}
          className="w-7 h-7 md:w-5 md:h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-40 font-bold leading-none cursor-pointer"
          aria-label="Tăng số bản"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleFitToWidth}
        className={`px-2.5 py-1.5 md:px-2 md:py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
          fitToWidth
            ? "bg-white text-primary-900 border-white"
            : "bg-white/10 hover:bg-white/20 text-white border-white/25"
        }`}
        title="Chuyển đổi giữa kích thước A4 chuẩn (100%) và vừa khung màn hình"
      >
        {fitToWidth ? "100% A4" : "Vừa khung"}
      </button>

      <div className="hidden md:block h-4 w-px bg-white/25 mx-0.5" />

      <button
        type="button"
        onClick={onPrint}
        disabled={isFetching || !hasDocs}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 md:py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded text-xs font-semibold border border-primary-400 cursor-pointer shadow-sm"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>In phiếu</span>
        <kbd className="bg-primary-900/50 text-primary-100 border-primary-400 text-[10px] px-1">
          Enter
        </kbd>
      </button>

      <button
        type="button"
        data-preview-action="close"
        onClick={onClose}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 md:py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs font-medium border border-neutral-500 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
        <span>Đóng</span>
        <kbd className="bg-neutral-800 text-neutral-200 border-neutral-500 text-[10px] px-1">
          Esc
        </kbd>
      </button>
    </div>
  </div>
);
