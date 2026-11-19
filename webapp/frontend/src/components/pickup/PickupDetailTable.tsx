import React from "react";
import { PickupItem } from "../../types/pickup";
import { formatQuantity } from "../../lib/format";
import { handleExcelMouseDown, selectAllLater } from "../ui/excelCell";

export interface PickupDetailTableProps {
  activeItems: PickupItem[];
  activeDetailRow: number;
  loadingDetail: boolean;
  detailSectionRef: React.MutableRefObject<HTMLElement | null>;
  detailScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  detailHeadRef: React.MutableRefObject<HTMLTableSectionElement | null>;
  detailRowRefs: React.MutableRefObject<
    Record<number, HTMLTableRowElement | null>
  >;
  onSetActiveDetailRow: (idx: number) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => void;
  onCellCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const PickupDetailTable: React.FC<PickupDetailTableProps> = ({
  activeItems,
  activeDetailRow,
  loadingDetail,
  detailSectionRef,
  detailScrollRef,
  detailHeadRef,
  detailRowRefs,
  onSetActiveDetailRow,
  onCellKeyDown,
  onCellCopy,
}) => (
  <section
    ref={detailSectionRef}
    className="flex-1 flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden h-full"
  >
    <div
      ref={detailScrollRef}
      className="flex-1 overflow-auto table-sticky-header"
    >
      <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
        <thead
          ref={detailHeadRef}
          className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-700 uppercase text-[11px] font-semibold tracking-wide select-none border-b border-neutral-300"
        >
          <tr>
            <th className="w-40 text-center" scope="col">
              Vật tư (Mã VT)
            </th>
            <th className="min-w-[240px] text-left" scope="col">
              Tên vật tư hàng hóa
            </th>
            <th className="w-24 text-center" scope="col">
              Mã kho
            </th>
            <th className="w-20 text-center" scope="col">
              ĐVT
            </th>
            <th className="w-24 text-right" scope="col">
              Số tấm
            </th>
            <th className="w-24 text-right" scope="col">
              Hệ số
            </th>
            <th className="w-24 text-right" scope="col">
              SL bán
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 font-sans text-neutral-900 font-semibold">
          {activeItems.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-6 text-center text-neutral-400 italic font-normal"
              >
                {loadingDetail
                  ? "Đang nạp chi tiết..."
                  : "Chọn một phiếu ở trên để xem chi tiết"}
              </td>
            </tr>
          ) : (
            activeItems.map((item, idx) => {
              const isActive = idx === activeDetailRow;
              const cols: {
                col: number;
                tdCls: string;
                val: string;
                cls: string;
                placeholder?: string;
                title?: string;
              }[] = [
                {
                  col: 0,
                  tdCls: "xl-cell",
                  val: item.ma_vt || "",
                  cls: "xl-input text-center font-mono font-semibold text-neutral-900 grid-cell-input",
                },
                {
                  col: 1,
                  tdCls: "xl-cell min-w-[240px]",
                  val: item.ten_vt || "",
                  placeholder: "—",
                  title: item.ten_vt || "",
                  cls: "xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input",
                },
                {
                  col: 2,
                  tdCls: "xl-cell",
                  val: item.ma_kho || "",
                  placeholder: "—",
                  cls: "xl-input text-center font-mono font-semibold text-neutral-900 grid-cell-input",
                },
                {
                  col: 3,
                  tdCls: "xl-cell",
                  val: item.dvt || "",
                  placeholder: "—",
                  cls: "xl-input text-center font-sans font-semibold text-neutral-900 grid-cell-input",
                },
                {
                  col: 4,
                  tdCls: "xl-cell xl-amber",
                  val: formatQuantity(item.so_tam),
                  cls: "xl-input text-right font-mono font-bold text-neutral-900 tabular-nums grid-cell-input",
                },
                {
                  col: 5,
                  tdCls: "xl-cell xl-amber",
                  val: formatQuantity(item.he_so8),
                  cls: "xl-input text-right font-mono font-bold text-neutral-900 tabular-nums grid-cell-input",
                },
                {
                  col: 6,
                  tdCls: "xl-cell xl-amber",
                  val: formatQuantity(item.so_luong9),
                  cls: "xl-input text-right font-mono font-semibold text-neutral-900 tabular-nums grid-cell-input",
                },
              ];

              return (
                <tr
                  key={item.stt0 || idx}
                  ref={(el) => {
                    if (el) detailRowRefs.current[idx] = el;
                    else delete detailRowRefs.current[idx];
                  }}
                  onClick={() => onSetActiveDetailRow(idx)}
                  className={isActive ? "xl-row-active" : undefined}
                >
                  {cols.map((c) => (
                    <td key={c.col} className={c.tdCls}>
                      <input
                        type="text"
                        readOnly
                        data-mode="select"
                        value={c.val}
                        placeholder={c.placeholder}
                        title={c.title}
                        onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                        onFocus={(e) => {
                          onSetActiveDetailRow(idx);
                          e.currentTarget.select();
                          selectAllLater(e.currentTarget);
                        }}
                        onKeyDown={(e) => onCellKeyDown(e, idx, c.col)}
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
            length: Math.max(0, 8 - activeItems.length),
          }).map((_, i) => (
            <tr key={`detail-filler-${i}`} className="h-[24px] bg-white">
              <td colSpan={7} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
