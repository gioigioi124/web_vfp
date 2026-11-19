import React from "react";
import { VoucherDetail } from "../../types/voucher";
import {
  formatCurrency,
  formatNumber0,
  formatQuantity,
} from "../../lib/format";
import { ReadOnlyGridInput } from "./ReadOnlyGridCell";

export interface DetailGridListViewProps {
  items: VoucherDetail[];
  currency: string;
  embedded: boolean;
  isWarehouse: boolean;
  currentActiveRow: number;
  tableRef: React.MutableRefObject<HTMLTableElement | null>;
  onSelectRow: (idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const DetailGridListView: React.FC<DetailGridListViewProps> = React.memo(
  ({
    items,
    currency,
    embedded,
    isWarehouse,
    currentActiveRow,
    tableRef,
    onSelectRow,
    onKeyDown,
    onCopy,
  }) => {
    const amber = "bg-amber-50 text-amber-900 border-amber-200";

    return (
      <div
        className={
          embedded
            ? "w-full h-full flex flex-col bg-white overflow-hidden"
            : "w-full border border-neutral-300 rounded overflow-hidden bg-white flex flex-col"
        }
      >
        <div
          className={
            embedded
              ? "overflow-auto flex-1 table-sticky-header"
              : "overflow-x-auto max-h-[360px] table-sticky-header"
          }
        >
          <table
            ref={tableRef}
            className="w-full text-left dense-table border-collapse text-[12.5px] xl-grid"
          >
            <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
              <tr>
                <th
                  className="w-10 text-center border-r border-neutral-200"
                  scope="col"
                >
                  #
                </th>
                <th
                  className="w-36 text-left border-r border-neutral-200 font-mono"
                  scope="col"
                >
                  Mã vật tư
                </th>
                <th
                  className="min-w-[320px] border-r border-neutral-200"
                  scope="col"
                >
                  Tên vật tư
                </th>
                <th
                  className="w-20 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Mã kho
                </th>
                <th
                  className="w-24 text-right border-r border-neutral-200 font-mono"
                  scope="col"
                >
                  SL xuất
                </th>
                <th
                  className={`w-20 text-right border-r border-neutral-200 font-mono ${amber}`}
                  scope="col"
                >
                  Số tấm
                </th>
                <th
                  className="w-20 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Đvt
                </th>
                <th
                  className={`w-24 text-right border-r border-neutral-200 font-mono ${amber}`}
                  scope="col"
                >
                  Hệ số
                </th>
                <th
                  className={`w-24 text-right border-r border-neutral-200 font-mono ${amber}`}
                  scope="col"
                >
                  SL bán
                </th>
                {!isWarehouse && (
                  <>
                    <th
                      className="w-32 text-right border-r border-neutral-200 font-mono"
                      scope="col"
                    >
                      Đơn giá
                    </th>
                    <th className="w-36 text-right pr-3 font-mono" scope="col">
                      Thành tiền
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={isWarehouse ? 9 : 11}
                    className="px-4 py-6 text-center text-neutral-400 italic text-xs"
                  >
                    Không có dòng mặt hàng nào
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const isActive = idx === currentActiveRow;
                  return (
                    <tr
                      key={it.stt0 || idx}
                      onClick={() => onSelectRow(idx)}
                      className={isActive ? "xl-row-active" : undefined}
                    >
                      <td className="xl-rowhead">{idx + 1}</td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={it.ma_vt || ""}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input font-mono text-primary-800 font-semibold grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell min-w-[320px]">
                        <ReadOnlyGridInput
                          value={it.ten_vt || ""}
                          placeholder="—"
                          title={it.ten_vt || ""}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input font-semibold text-neutral-900 truncate grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={it.ma_kho || ""}
                          placeholder="—"
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-center font-mono text-neutral-700 font-medium grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={formatQuantity(it.so_luong9)}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-right font-mono text-neutral-800 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell xl-amber">
                        <ReadOnlyGridInput
                          value={formatNumber0(it.so_tam)}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-right font-mono text-neutral-800 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={it.dvt || ""}
                          placeholder="—"
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-center text-neutral-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell xl-amber">
                        <ReadOnlyGridInput
                          value={formatQuantity(it.he_so8)}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-right font-mono text-neutral-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell xl-amber">
                        <ReadOnlyGridInput
                          value={formatQuantity(it.so_luong8)}
                          rowIndex={idx}
                          onSelectRow={onSelectRow}
                          onKeyDown={onKeyDown}
                          onCopy={onCopy}
                          className="xl-input text-right font-mono text-neutral-800 font-medium grid-cell-input"
                        />
                      </td>
                      {!isWarehouse && (
                        <>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={formatCurrency(it.gia_nt9, currency)}
                              rowIndex={idx}
                              onSelectRow={onSelectRow}
                              onKeyDown={onKeyDown}
                              onCopy={onCopy}
                              className="xl-input text-right font-mono text-neutral-800 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={formatCurrency(it.tien_nt9, currency)}
                              rowIndex={idx}
                              onSelectRow={onSelectRow}
                              onKeyDown={onKeyDown}
                              onCopy={onCopy}
                              className="xl-input text-right font-mono font-semibold text-neutral-900 pr-3 grid-cell-input"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

DetailGridListView.displayName = "DetailGridListView";
