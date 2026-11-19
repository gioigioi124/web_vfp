import React from "react";
import { PickupSlip } from "../../types/pickup";
import { formatDate } from "../../lib/format";
import { handleExcelMouseDown, selectAllLater } from "../ui/excelCell";

export interface PickupMasterTableProps {
  filteredSlips: PickupSlip[];
  totalSlipsCount: number;
  selectedStts: Set<string>;
  activeStt: string | null;
  allSelected: boolean;
  loading: boolean;
  searchQuery: string;
  masterScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  masterHeadRef: React.MutableRefObject<HTMLTableSectionElement | null>;
  masterRowRefs: React.MutableRefObject<
    Record<string, HTMLTableRowElement | null>
  >;
  masterActiveColRef: React.MutableRefObject<number>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSetActiveStt: (stt: string) => void;
  onToggleSelect: (stt: string) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => void;
  onCellCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const PickupMasterTable: React.FC<PickupMasterTableProps> = ({
  filteredSlips,
  totalSlipsCount,
  selectedStts,
  activeStt,
  allSelected,
  loading,
  searchQuery,
  masterScrollRef,
  masterHeadRef,
  masterRowRefs,
  masterActiveColRef,
  onSelectAll,
  onDeselectAll,
  onSetActiveStt,
  onToggleSelect,
  onCellKeyDown,
  onCellCopy,
}) => (
  <section className="shrink-0 max-h-[210px] flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden">
    <div
      ref={masterScrollRef}
      className="flex-1 overflow-auto table-sticky-header"
    >
      <table className="w-full min-w-[960px] table-fixed text-left dense-table border-collapse text-[12px] xl-grid">
        <thead
          ref={masterHeadRef}
          className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-700 uppercase text-[11px] font-semibold tracking-wide select-none border-b border-neutral-300"
        >
          <tr>
            <th className="w-10 text-center" scope="col">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) =>
                  e.target.checked ? onSelectAll() : onDeselectAll()
                }
                className="rounded border-neutral-300 text-primary-800 focus:ring-primary-700 w-3.5 h-3.5 cursor-pointer align-middle"
                title="Chọn tất cả (Ctrl+A)"
              />
            </th>
            <th className="w-[115px] text-center" scope="col">
              Ngày
            </th>
            <th className="w-[130px]" scope="col">
              Số phiếu
            </th>
            <th className="w-[150px]" scope="col">
              Mã KH
            </th>
            <th className="w-[290px]" scope="col">
              Tên KH
            </th>
            <th scope="col">Địa chỉ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 font-sans text-neutral-900 font-semibold">
          {filteredSlips.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-6 text-center text-neutral-400 italic font-normal"
              >
                {loading
                  ? "Đang tải dữ liệu từ CSDL Kho..."
                  : searchQuery.trim()
                    ? `Không tìm thấy phiếu xuất phù hợp "${searchQuery.trim()}"`
                    : "Không có phiếu xuất nào sẵn sàng"}
              </td>
            </tr>
          ) : (
            filteredSlips.map((s, rowIdx) => {
              const isChecked = selectedStts.has(s.stt);
              const isActive = activeStt === s.stt;
              const cols: {
                col: number;
                val: string;
                cls: string;
                placeholder?: string;
                title?: string;
              }[] = [
                {
                  col: 1,
                  val: formatDate(s.ngay_ct),
                  cls: "xl-input text-center font-mono font-semibold text-neutral-900 tabular-nums grid-cell-input",
                },
                {
                  col: 2,
                  val: s.so_ct || s.stt,
                  cls: "xl-input font-mono font-semibold text-neutral-900 grid-cell-input",
                },
                {
                  col: 3,
                  val: s.ma_dt || "",
                  cls: "xl-input font-mono font-semibold text-neutral-900 grid-cell-input",
                },
                {
                  col: 4,
                  val: s.ten_dt || "",
                  placeholder: "—",
                  title: s.ten_dt || "",
                  cls: "xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input",
                },
                {
                  col: 5,
                  val: s.dia_chi || "",
                  placeholder: "—",
                  title: s.dia_chi || "",
                  cls: "xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input",
                },
              ];

              return (
                <tr
                  key={s.stt}
                  ref={(el) => {
                    if (el) masterRowRefs.current[s.stt] = el;
                    else delete masterRowRefs.current[s.stt];
                  }}
                  onClick={() => onSetActiveStt(s.stt)}
                  className={
                    isActive
                      ? "xl-row-active"
                      : isChecked
                        ? "xl-row-marked"
                        : undefined
                  }
                >
                  <td
                    className="xl-cell text-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetActiveStt(s.stt);
                      onToggleSelect(s.stt);
                    }}
                    title="Nhấn để đánh dấu (Space)"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      tabIndex={-1}
                      className="rounded border-neutral-400 text-primary-800 focus:ring-0 w-3.5 h-3.5 cursor-pointer align-middle pointer-events-none"
                    />
                  </td>
                  {cols.map((c) => (
                    <td key={c.col} className="xl-cell">
                      <input
                        type="text"
                        readOnly
                        data-mode="select"
                        value={c.val}
                        placeholder={c.placeholder}
                        title={c.title}
                        onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                        onFocus={(e) => {
                          masterActiveColRef.current = c.col;
                          onSetActiveStt(s.stt);
                          e.currentTarget.select();
                          selectAllLater(e.currentTarget);
                        }}
                        onKeyDown={(e) => onCellKeyDown(e, rowIdx, c.col)}
                        onCopy={onCellCopy}
                        className={c.cls}
                      />
                    </td>
                  ))}
                </tr>
              );
            })
          )}
          {/* Dòng trống bổ sung — giữ chiều cao bảng như mẫu Pickup.html */}
          {Array.from({
            length: Math.max(0, 6 - totalSlipsCount),
          }).map((_, i) => (
            <tr key={`filler-${i}`} className="h-[24px] bg-white">
              <td colSpan={6} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
