import React from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherPagination,
  VoucherFilterParams,
} from "../types/voucher";
import { Button } from "./ui/Button";
import { DetailGrid } from "./DetailGrid";
import { formatCurrency, formatDate } from "../lib/format";
import {
  FileText,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

interface VoucherListProps {
  vouchers: VoucherHeader[];
  pagination: VoucherPagination;
  filters?: VoucherFilterParams;
  loading: boolean;
  selectedStt: string | null;
  markedStts?: Set<string>;
  detailItems: VoucherDetail[];
  detailLoading: boolean;
  debtAmount?: number | null;
  onSelectStt: (stt: string) => void;
  onToggleMark?: (stt: string) => void;
  onOpenDetail: (stt: string) => void;
  onOpenFilter: () => void;
  onOpenPrint: (stt: string) => void;
  onOpenPickup: () => void;
  onOpenDebt: (maDt: string) => void;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
}

export const VoucherList: React.FC<VoucherListProps> = ({
  vouchers,
  pagination,
  filters,
  loading,
  selectedStt,
  markedStts,
  detailItems,
  detailLoading,
  debtAmount,
  onSelectStt,
  onToggleMark,
  onOpenDetail,
  onOpenFilter,
  onOpenPrint,
  onOpenPickup,
  onOpenDebt,
  onRefresh,
  onChangePage,
}) => {
  const activeVoucher =
    vouchers.find((v) => v.stt === selectedStt) || vouchers[0];
  const detailCurrency = activeVoucher?.ma_tte || "VND";

  return (
    <div className="flex flex-col h-full w-full bg-surface min-h-0">
      {/* ===== KHU VỰC 1: MASTER — DANH SÁCH PHIẾU XUẤT BÁN ===== */}
      <section className="flex-[1.2] flex flex-col min-h-0 bg-white border-b border-neutral-300">
        {/* Tiêu đề & thanh công cụ bảng Master */}
        <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800 text-xs flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-700" />
              DANH SÁCH PHIẾU
            </span>
            <span className="text-xs bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded font-mono font-medium">
              {pagination.total_records} chứng từ
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="font-mono text-[11px]">
              {filters?.ngay_ct1 ? formatDate(filters.ngay_ct1) : "Tất cả"}
              {filters?.ngay_ct2 && filters.ngay_ct2 !== filters.ngay_ct1
                ? ` → ${formatDate(filters.ngay_ct2)}`
                : ""}
              {" · "}
              {filters?.ma_ct || "X1"}
            </span>
            <button
              onClick={onOpenFilter}
              className="text-secondary-600 hover:text-secondary-800 text-xs font-medium hover:underline flex items-center gap-1"
            >
              <Filter className="w-3 h-3" />
              Bộ lọc
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 transition"
              title="Làm mới (F5)"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Data Grid Table: Phiếu Xuất Master */}
        <div className="flex-1 overflow-auto table-sticky-header">
          <table className="w-full text-left dense-table border-collapse text-[12.5px]">
            <thead className="bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
              <tr>
                <th
                  className="w-8 text-center border-r border-neutral-200"
                  scope="col"
                  title="Đánh dấu (Space)"
                >
                  ✓
                </th>
                <th
                  className="w-14 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ctừ
                </th>
                <th
                  className="w-24 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ngày
                </th>
                <th
                  className="w-28 text-left border-r border-neutral-200 font-mono"
                  scope="col"
                >
                  Số
                </th>
                <th
                  className="min-w-[280px] border-r border-neutral-200"
                  scope="col"
                >
                  Diễn giải
                </th>
                <th
                  className="min-w-[220px] border-r border-neutral-200"
                  scope="col"
                >
                  Đối tượng
                </th>
                <th className="w-36 text-right pr-3" scope="col">
                  Tổng tiền
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-neutral-400"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải danh sách chứng từ...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-neutral-400 italic"
                  >
                    Không tìm thấy chứng từ nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const isSelected = selectedStt === v.stt;
                  const isMarked = markedStts?.has(v.stt) ?? false;
                  return (
                    <tr
                      key={v.stt}
                      onClick={() => onSelectStt(v.stt)}
                      onDoubleClick={() => onOpenDetail(v.stt)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "selected-row bg-secondary-100 font-medium text-neutral-900 border-y border-secondary-300"
                          : isMarked
                            ? "bg-tertiary-50"
                            : "hover:bg-neutral-50"
                      }`}
                    >
                      <td
                        className="text-center border-r border-neutral-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMark?.(v.stt);
                        }}
                        title="Nhấn để đánh dấu (Space)"
                      >
                        <span
                          className={`inline-block w-3 h-3 rounded border ${
                            isMarked
                              ? "bg-tertiary-500 border-tertiary-600"
                              : "border-neutral-400 bg-white"
                          }`}
                        />
                      </td>
                      <td className="text-center font-mono font-medium text-neutral-600 border-r border-neutral-200">
                        {v.ma_ct}
                      </td>
                      <td className="text-center font-mono text-neutral-700 border-r border-neutral-200">
                        {formatDate(v.ngay_ct)}
                      </td>
                      <td className="font-mono font-semibold text-primary-700 border-r border-neutral-200">
                        {isSelected ? (
                          <span className="bg-primary-700 text-white px-1.5 py-0.5 rounded text-xs">
                            {v.so_ct || v.stt}
                          </span>
                        ) : (
                          v.so_ct || v.stt
                        )}
                      </td>
                      <td className="text-neutral-800 border-r border-neutral-200">
                        {v.dien_giai0 || "—"}
                      </td>
                      <td className="text-neutral-700 border-r border-neutral-200">
                        {v.ten_dt || v.ma_dt}
                      </td>
                      <td className="text-right font-mono font-medium text-neutral-900 pr-3">
                        {formatCurrency(v.ttien_nt0, v.ma_tte)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== THANH SPLITTER & THÔNG TIN DƯ NỢ KHÁCH HÀNG ===== */}
      <div className="bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 px-3.5 py-1.5 flex items-center justify-between border-y border-neutral-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-info-100 text-primary-700">
            <Info className="w-3 h-3" />
          </div>
          <span className="font-semibold text-xs text-neutral-800">
            Khách hàng:{" "}
            <span className="text-primary-700 font-mono">
              {activeVoucher?.ma_dt || "—"}
            </span>
            {activeVoucher?.ten_dt ? ` - ${activeVoucher.ten_dt}` : ""}
          </span>
          <span className="text-neutral-400">||</span>
          <span className="text-xs text-neutral-600">Dư nợ tài khoản:</span>
          <span className="px-2 py-0.5 rounded bg-tertiary-100 border border-tertiary-200 text-tertiary-600 font-mono font-bold text-xs">
            {debtAmount != null
              ? `${formatCurrency(debtAmount, "VND")} ₫`
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-[11px] font-mono">
            Trang {pagination.page} / {pagination.total_pages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangePage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChangePage(pagination.page + 1)}
            disabled={!pagination.has_next || loading}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <span className="w-px h-4 bg-neutral-300 mx-0.5" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeVoucher && onOpenDebt(activeVoucher.ma_dt)}
            disabled={!activeVoucher}
          >
            Chi tiết công nợ
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenPickup}>
            Chọn phiếu xuất
          </Button>
        </div>
      </div>

      {/* ===== KHU VỰC 2: DETAIL — CHI TIẾT VẬT TƯ / HÀNG HÓA ===== */}
      <section className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
        {detailLoading && (
          <div className="shrink-0 bg-neutral-50 border-b border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Đang tải chi tiết...
          </div>
        )}
        <div className="flex-1 overflow-auto table-sticky-header">
          <DetailGrid items={detailItems} currency={detailCurrency} embedded />
        </div>
      </section>
    </div>
  );
};
