import React from "react";
import { Check, Edit3, Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { PickupItem, PickupSlip } from "../../types/pickup";
import { formatQuantity } from "../../lib/format";

export interface PickupFooterProps {
  selectedCount: number;
  filteredCount: number;
  totalSlipsCount: number;
  activeItemsCount: number;
  activeSlipTotalSheets: number;
  activeStt: string | null;
  slips: PickupSlip[];
  activeItems: PickupItem[];
  isReturn?: boolean;
  cancelBtnRef: React.MutableRefObject<HTMLButtonElement | null>;
  onCreateWarehouseSlip?: () => void;
  onEditWarehouseSlip?: (
    stt: string,
    preview?: { slip?: PickupSlip; items?: PickupItem[] },
  ) => void;
  onDeleteWarehouseSlip?: (slip: PickupSlip) => void;
  onClose: () => void;
  onAccept: () => void;
}

export const PickupFooter: React.FC<PickupFooterProps> = ({
  selectedCount,
  filteredCount,
  totalSlipsCount,
  activeItemsCount,
  activeSlipTotalSheets,
  activeStt,
  slips,
  activeItems,
  isReturn = false,
  cancelBtnRef,
  onCreateWarehouseSlip,
  onEditWarehouseSlip,
  onDeleteWarehouseSlip,
  onClose,
  onAccept,
}) => (
  <footer className="px-3 py-2 bg-neutral-100 border-t border-neutral-300 flex flex-wrap items-center justify-between gap-2 shrink-0 pb-safe">
    {/* Bộ đếm phiếu đã chọn + tóm tắt phiếu đang xem */}
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center bg-white px-2.5 py-1 rounded border border-neutral-300 shadow-sm shrink-0">
        <label className="text-xs font-semibold text-neutral-700 mr-2 whitespace-nowrap">
          Đã chọn
        </label>
        <div className="flex items-center font-mono font-bold text-xs">
          <input
            readOnly
            value={selectedCount}
            className="w-8 h-5 text-center font-bold text-primary-900 bg-primary-50 border border-primary-400 rounded p-0 text-xs focus:outline-none select-all"
          />
          <span className="mx-1.5 text-neutral-400">/</span>
          <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-neutral-200 text-neutral-700 rounded text-xs">
            {filteredCount}
          </span>
        </div>
      </div>
      {activeItemsCount > 0 && (
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-neutral-600 bg-white/80 px-2 py-1 rounded border border-neutral-200 truncate">
          <span>
            Phiếu đang xem:{" "}
            <b className="font-mono text-neutral-800">{activeItemsCount}</b> dòng
          </span>
          {activeSlipTotalSheets > 0 && (
            <>
              <span className="text-neutral-300">·</span>
              <span>
                Tổng tấm:{" "}
                <b className="font-mono text-amber-800">
                  {formatQuantity(activeSlipTotalSheets)}
                </b>
              </span>
            </>
          )}
        </div>
      )}
    </div>

    {/* Nhóm nút thao tác nhỏ gọn */}
    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
      {onCreateWarehouseSlip && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateWarehouseSlip}
          type="button"
          className="h-9 md:h-auto border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900"
          title={
            isReturn
              ? "Thêm mới phiếu nhập lại kho (N5) (F2)"
              : "Thêm mới phiếu xuất kho (F2)"
          }
        >
          <Plus className="w-3.5 h-3.5 text-emerald-700" />
          <span className="hidden sm:inline">
            {isReturn ? "Thêm phiếu nhập lại" : "Thêm phiếu kho"}
          </span>
          <span className="sm:hidden">Thêm kho</span>
        </Button>
      )}

      {onEditWarehouseSlip && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!activeStt) return;
            const activeSlip = slips.find((s) => s.stt === activeStt);
            onEditWarehouseSlip(activeStt, {
              slip: activeSlip,
              items: activeItems,
            });
          }}
          disabled={!activeStt}
          type="button"
          className="h-9 md:h-auto border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 disabled:opacity-50"
          title={
            isReturn
              ? "Sửa phiếu nhập lại kho đang chọn (F3)"
              : "Sửa phiếu xuất kho đang chọn (F3)"
          }
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-700" />
          <span className="hidden sm:inline">
            {isReturn ? "Sửa phiếu nhập lại" : "Sửa phiếu kho"}
          </span>
          <span className="sm:hidden">Sửa</span>
        </Button>
      )}

      {onDeleteWarehouseSlip && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const activeSlip = slips.find((s) => s.stt === activeStt);
            if (activeSlip) onDeleteWarehouseSlip(activeSlip);
          }}
          disabled={!activeStt}
          type="button"
          className="h-9 md:h-auto border-danger-300 bg-danger-50 hover:bg-danger-100 text-danger-800 disabled:opacity-50"
          title={
            isReturn
              ? "Xóa phiếu nhập lại kho đang chọn (F8)"
              : "Xóa phiếu xuất kho đang chọn (F8)"
          }
        >
          <Trash2 className="w-3.5 h-3.5 text-danger-600" />
          <span className="hidden sm:inline">
            {isReturn ? "Xóa phiếu nhập lại" : "Xóa phiếu kho"}
          </span>
          <span className="sm:hidden">Xóa</span>
        </Button>
      )}

      {(onCreateWarehouseSlip ||
        onEditWarehouseSlip ||
        onDeleteWarehouseSlip) && (
        <div className="hidden md:block h-4 w-px bg-neutral-300 mx-0.5" />
      )}

      <Button
        ref={cancelBtnRef}
        data-autofocus={totalSlipsCount === 0 ? true : undefined}
        variant="outline"
        size="sm"
        className="h-9 md:h-auto"
        onClick={onClose}
        type="button"
      >
        <X className="w-3.5 h-3.5 text-neutral-500" />
        Hủy bỏ
      </Button>
      <Button
        variant="primary"
        size="sm"
        className="h-9 md:h-auto"
        onClick={onAccept}
        disabled={selectedCount === 0}
        type="button"
      >
        <Check className="w-3.5 h-3.5 text-success-300" />
        Chấp nhận
      </Button>
    </div>
  </footer>
);
