import React from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import { DebtLedgerData, DebtLedgerEntry } from "../../types/debt";
import { formatDate } from "../../lib/format";
import { handleExcelMouseDown, selectAllLater } from "../ui/excelCell";
import { useIsMobile } from "../../hooks/useViewport";
import { formatSpaceNumber } from "./debtUtils";

interface GridRowData {
  key: string;
  rowHead: string;
  maCt: string;
  ngay: string;
  soCt: string;
  dienGiai: string;
  psTang: string;
  psGiam: string;
  luyKe: string;
  entry?: DebtLedgerEntry;
  isMarked?: boolean;
  isSummary?: boolean;
  maCtClassName?: string;
  soCtClassName?: string;
  dienGiaiClassName?: string;
  psTangClassName?: string;
  psGiamClassName?: string;
  luyKeClassName?: string;
}

export interface DebtLedgerTableProps {
  ledger: DebtLedgerData | null;
  entries: DebtLedgerEntry[];
  loading: boolean;
  inputMaDt: string;
  selectedRowKey: string | null;
  gridScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  gridHeadRef: React.MutableRefObject<HTMLTableSectionElement | null>;
  tableRef: React.MutableRefObject<HTMLTableElement | null>;
  onSelectRowKey: (key: string) => void;
  onOpenEntryVoucher: (entry: DebtLedgerEntry) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    colIdx: number,
    entry?: DebtLedgerEntry,
  ) => void;
  onCellCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const DebtLedgerTable: React.FC<DebtLedgerTableProps> = ({
  ledger,
  entries,
  loading,
  inputMaDt,
  selectedRowKey,
  gridScrollRef,
  gridHeadRef,
  tableRef,
  onSelectRowKey,
  onOpenEntryVoucher,
  onCellKeyDown,
  onCellCopy,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    let running = ledger?.du_dau ?? 0;
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
        {ledger && (
          <div className="p-2.5 grid grid-cols-2 gap-2 bg-white border-b border-neutral-200 shrink-0 text-xs">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
              <div className="text-[10px] font-bold uppercase text-neutral-500">
                Dư đầu kỳ
              </div>
              <div className="font-mono font-bold text-neutral-900">
                {formatSpaceNumber(ledger.du_dau)} ₫
              </div>
            </div>
            <div className="rounded-lg border border-primary-300 bg-primary-50 px-2.5 py-1.5">
              <div className="text-[10px] font-bold uppercase text-primary-800">
                Dư cuối kỳ
              </div>
              <div className="font-mono font-bold text-primary-900">
                {formatSpaceNumber(ledger.du_cuoi)} ₫
              </div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1">
              <div className="text-[10px] font-bold uppercase text-rose-700">
                PS Tăng (Mua)
              </div>
              <div className="font-mono font-bold text-rose-800">
                +{formatSpaceNumber(ledger.tong_ps_tang)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1">
              <div className="text-[10px] font-bold uppercase text-emerald-700">
                PS Giảm (Thu)
              </div>
              <div className="font-mono font-bold text-emerald-800">
                -{formatSpaceNumber(ledger.tong_ps_giam)}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-primary-600" />
              Đang tải sổ chi tiết công nợ...
            </div>
          ) : !inputMaDt.trim() && !ledger ? (
            <div className="py-12 text-center text-neutral-400 italic text-xs">
              Nhập Mã ĐT rồi bấm Tìm kiếm để tra cứu sổ chi tiết công nợ.
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-neutral-400 italic text-xs bg-white rounded-xl border border-neutral-200">
              Không có phát sinh trong khoảng thời gian đã chọn.
            </div>
          ) : (
            entries.map((entry, idx) => {
              const rowKey = `entry-${idx}`;
              const maCtUpper = (entry.ma_ct || "").trim().toUpperCase();
              const isDrillable = Boolean(
                entry.stt && (maCtUpper === "X1" || maCtUpper === "N5"),
              );
              running =
                entry.luy_ke !== undefined
                  ? Number(entry.luy_ke)
                  : running + (Number(entry.ps_tang) || 0) - (Number(entry.ps_giam) || 0);
              const isCreditRow = entry.ps_giam > 0 && entry.ps_tang === 0;
              return (
                <div
                  key={rowKey}
                  onClick={() => {
                    onSelectRowKey(rowKey);
                    if (isDrillable) onOpenEntryVoucher(entry);
                  }}
                  className={`bg-white rounded-xl border p-3 shadow-sm ${
                    selectedRowKey === rowKey
                      ? "border-primary-500 ring-1 ring-primary-300"
                      : isCreditRow
                        ? "border-emerald-200 bg-emerald-50/20"
                        : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          isDrillable
                            ? "bg-primary-100 text-primary-800"
                            : isCreditRow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {maCtUpper}
                      </span>
                      <span className="font-mono font-bold text-xs text-primary-800">
                        {entry.so_ct || "—"}
                      </span>
                      {isDrillable && (
                        <ChevronRight className="w-3.5 h-3.5 text-primary-600" />
                      )}
                    </div>
                    <span className="font-mono text-xs text-neutral-500 shrink-0">
                      {formatDate(entry.ngay_ct)}
                    </span>
                  </div>
                  {entry.dien_giai && (
                    <div className="text-xs text-neutral-700 mt-1 line-clamp-2">
                      {entry.dien_giai}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-neutral-100 text-xs font-mono">
                    <div>
                      {entry.ps_tang !== 0 && (
                        <span className="text-rose-700 font-bold">
                          +{formatSpaceNumber(entry.ps_tang)}
                        </span>
                      )}
                      {entry.ps_giam !== 0 && (
                        <span className="text-emerald-700 font-bold ml-1">
                          -{formatSpaceNumber(entry.ps_giam)}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-600">
                      LK:{" "}
                      <b className="text-primary-900">
                        {formatSpaceNumber(running)}
                      </b>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const renderGridRow = (row: GridRowData) => {
    const isSelected = selectedRowKey === row.key;
    const boldSummary = row.isSummary ? "font-semibold text-neutral-900" : "";
    const cellFocusProps = (colIdx: number) => ({
      type: "text" as const,
      readOnly: true,
      "data-mode": "select" as const,
      onMouseDown: (e: React.MouseEvent<HTMLInputElement>) =>
        handleExcelMouseDown(e, "select"),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        onSelectRowKey(row.key);
        e.currentTarget.select();
        selectAllLater(e.currentTarget);
      },
      onDoubleClick: () => {
        if (row.entry) onOpenEntryVoucher(row.entry);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
        onCellKeyDown(e, colIdx, row.entry),
      onCopy: onCellCopy,
    });

    return (
      <tr
        key={row.key}
        data-grid-row="true"
        data-row-key={row.key}
        onClick={() => onSelectRowKey(row.key)}
        onDoubleClick={() => {
          if (row.entry) onOpenEntryVoucher(row.entry);
        }}
        title={
          row.entry
            ? "Nhấp đúp hoặc nhấn Enter / F3 để xem hóa đơn"
            : undefined
        }
        className={
          isSelected
            ? "xl-row-active"
            : row.isMarked
              ? "xl-row-marked"
              : undefined
        }
      >
        <td className="xl-rowhead font-mono">{row.rowHead}</td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(1)}
            value={row.maCt}
            className={`xl-input text-center font-mono grid-cell-input ${
              row.maCtClassName || "font-medium text-neutral-600"
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(2)}
            value={row.ngay}
            className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(3)}
            value={row.soCt}
            className={`xl-input font-mono font-semibold grid-cell-input ${
              row.soCtClassName || "text-primary-700"
            }`}
          />
        </td>
        <td className="xl-cell min-w-[260px]">
          <input
            {...cellFocusProps(4)}
            value={row.dienGiai}
            title={row.dienGiai}
            className={`xl-input text-black truncate grid-cell-input ${
              row.dienGiaiClassName || boldSummary
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(5)}
            value={row.psTang}
            className={`xl-input text-right font-mono pr-3 grid-cell-input ${
              row.psTangClassName ||
              (row.isSummary
                ? "font-semibold text-neutral-900"
                : "font-medium text-neutral-900")
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(6)}
            value={row.psGiam}
            className={`xl-input text-right font-mono pr-3 grid-cell-input ${
              row.psGiamClassName || "text-neutral-700"
            }`}
          />
        </td>
        <td className="xl-cell bg-neutral-50/40">
          <input
            {...cellFocusProps(7)}
            value={row.luyKe}
            className={`xl-input text-right font-mono pr-3 grid-cell-input ${
              row.luyKeClassName || "font-semibold text-primary-900"
            }`}
          />
        </td>
      </tr>
    );
  };

  let runningBalance = ledger ? Number(ledger.du_dau || 0) : 0;

  return (
    <div
      ref={gridScrollRef}
      className="flex-1 overflow-auto table-sticky-header bg-white"
      data-purpose="ledger-grid-container"
    >
      <table
        ref={tableRef}
        className="w-full text-left dense-table border-collapse text-[12.5px] xl-grid"
      >
        <thead
          ref={gridHeadRef}
          className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300"
        >
          <tr>
            <th
              className="w-9 text-center border-r border-neutral-200"
              scope="col"
            >
              #
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
              Số phiếu
            </th>
            <th
              className="min-w-[260px] border-r border-neutral-200"
              scope="col"
            >
              Diễn giải
            </th>
            <th
              className="w-32 text-right pr-3 border-r border-neutral-200"
              scope="col"
            >
              Ps tăng
            </th>
            <th
              className="w-32 text-right pr-3 border-r border-neutral-200"
              scope="col"
            >
              Ps giảm
            </th>
            <th className="w-36 text-right pr-3" scope="col">
              Lũy kế
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 font-sans">
          {/* Dư đầu kỳ */}
          {renderGridRow({
            key: "opening",
            rowHead: "—",
            maCt: "",
            ngay: "",
            soCt: "",
            dienGiai: "Dư đầu kỳ",
            psTang:
              ledger && ledger.du_dau_tang !== 0
                ? formatSpaceNumber(ledger.du_dau_tang)
                : "",
            psGiam:
              ledger && ledger.du_dau_giam !== 0
                ? formatSpaceNumber(ledger.du_dau_giam)
                : "",
            luyKe: ledger ? formatSpaceNumber(ledger.du_dau) : "",
            isSummary: true,
            psGiamClassName:
              ledger && ledger.du_dau_giam !== 0
                ? "font-semibold text-emerald-700"
                : "font-semibold text-neutral-900",
            luyKeClassName:
              ledger && Math.round(ledger.du_dau) <= 0
                ? "font-semibold text-emerald-700"
                : "font-semibold text-primary-900",
          })}

          {loading ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-10 text-center text-neutral-400"
              >
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-primary-600" />
                Đang tải sổ chi tiết công nợ...
              </td>
            </tr>
          ) : !inputMaDt.trim() && !ledger ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-10 text-center text-neutral-400 italic"
              >
                Nhập Mã ĐT rồi nhấn Enter để tra cứu sổ chi tiết công nợ.
              </td>
            </tr>
          ) : entries.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-neutral-400 italic"
              >
                Không có phát sinh trong khoảng thời gian đã chọn.
              </td>
            </tr>
          ) : (
            entries.map((entry, rowIdx) => {
              const isCreditRow = entry.ps_giam > 0 && entry.ps_tang === 0;
              const maCtUpper = (entry.ma_ct || "").trim().toUpperCase();
              const isDrillable = Boolean(
                entry.stt && (maCtUpper === "X1" || maCtUpper === "N5"),
              );
              runningBalance =
                entry.luy_ke !== undefined
                  ? Number(entry.luy_ke)
                  : runningBalance +
                    (Number(entry.ps_tang) || 0) -
                    (Number(entry.ps_giam) || 0);
              const roundedRunning = Math.round(runningBalance);
              const isSettled = roundedRunning === 0;
              const isOverpaid = roundedRunning < 0;
              return renderGridRow({
                key: `entry-${rowIdx}`,
                entry,
                rowHead: String(rowIdx + 1),
                maCt: isDrillable ? `${maCtUpper} ↗` : entry.ma_ct || "",
                ngay: formatDate(entry.ngay_ct),
                soCt: entry.so_ct || "",
                dienGiai: entry.dien_giai || "",
                psTang:
                  entry.ps_tang !== 0 ? formatSpaceNumber(entry.ps_tang) : "",
                psGiam:
                  entry.ps_giam !== 0 ? formatSpaceNumber(entry.ps_giam) : "",
                luyKe: formatSpaceNumber(runningBalance),
                isMarked: isCreditRow,
                maCtClassName: isDrillable
                  ? "font-bold text-primary-700"
                  : isCreditRow
                    ? "font-bold text-amber-700"
                    : "font-medium text-neutral-600",
                soCtClassName: isDrillable
                  ? "text-primary-700 underline decoration-dotted cursor-pointer"
                  : isCreditRow
                    ? "text-emerald-700"
                    : "text-primary-700",
                psGiamClassName:
                  entry.ps_giam !== 0
                    ? "font-bold text-emerald-700"
                    : "text-neutral-700",
                luyKeClassName: isSettled
                  ? "font-bold text-emerald-700 bg-emerald-50/70"
                  : isOverpaid
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-primary-900",
              });
            })
          )}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-white shadow-[0_-1px_0_#cbd5e1]">
          {/* Phát sinh trong kỳ */}
          {renderGridRow({
            key: "period",
            rowHead: "Σ",
            maCt: "",
            ngay: "",
            soCt: "",
            dienGiai: "Phát sinh trong kỳ",
            psTang: ledger ? formatSpaceNumber(ledger.tong_ps_tang) : "0",
            psGiam: ledger ? formatSpaceNumber(ledger.tong_ps_giam) : "0",
            luyKe: "",
            isSummary: true,
            psGiamClassName:
              ledger && ledger.tong_ps_giam !== 0
                ? "font-semibold text-emerald-700"
                : "font-semibold text-neutral-900",
            luyKeClassName: "text-neutral-400",
          })}

          {/* Dư cuối kỳ */}
          {renderGridRow({
            key: "closing",
            rowHead: "≡",
            maCt: "",
            ngay: "",
            soCt: "",
            dienGiai: "Dư cuối kỳ",
            psTang: ledger ? formatSpaceNumber(ledger.du_cuoi_tang) : "0",
            psGiam: ledger ? formatSpaceNumber(ledger.du_cuoi_giam) : "0",
            luyKe: ledger ? formatSpaceNumber(ledger.du_cuoi) : "0",
            isSummary: true,
            psGiamClassName:
              ledger && ledger.du_cuoi_giam > 0
                ? "font-semibold text-emerald-700"
                : "font-semibold text-neutral-400",
            luyKeClassName:
              ledger && Math.round(ledger.du_cuoi) <= 0
                ? "font-bold text-emerald-700"
                : "font-bold text-primary-900",
          })}
        </tfoot>
      </table>
    </div>
  );
};
