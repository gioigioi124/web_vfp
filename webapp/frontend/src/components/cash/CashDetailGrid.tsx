import React, { useCallback, useEffect, useRef, useState } from "react";
import { CashVoucherDetail } from "../../types/cashVoucher";
import { CashVoucherModuleConfig } from "../../config/accountingModules";
import {
  initCatalogCache,
  searchBoPhan,
  searchTaiKhoan,
  getTaiKhoan,
  getBoPhan,
} from "../../lib/catalogCache";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../../lib/customerIndex";
import { formatNumber0, formatNumber2 } from "../../lib/format";
import { AutocompleteOption } from "../ui/Autocomplete";
import { VfpLookupCell, VfpNavDir } from "../ui/VfpLookupCell";
import { NumCell } from "../detail-grid/NumCell";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { arrowDir } from "../ui/excelCell";
import { useIsMobile } from "../../hooks/useViewport";
import { MobileCashDetailList } from "./MobileCashDetailList";

export interface CashDetailGridHandle {
  focusFirstCell: (rowIndex: number) => void;
}

interface CashDetailGridProps {
  items: CashVoucherDetail[];
  config: CashVoucherModuleConfig;
  currency?: string;
  embedded?: boolean;
  variant?: "list" | "form";
  editable?: boolean;
  activeRowIndex?: number;
  onSelectRow?: (index: number) => void;
  onChangeItem?: (index: number, updated: CashVoucherDetail, fieldName?: string) => void;
  onDeleteItem?: (index: number) => void;
  onAddItem?: () => void;
  gridRef?: React.RefObject<CashDetailGridHandle | null>;
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const CashDetailGrid: React.FC<CashDetailGridProps> = React.memo(
  ({
    items,
    config,
    currency = "VND",
    embedded = false,
    variant = "list",
    editable = false,
    activeRowIndex = 0,
    onSelectRow,
    onChangeItem,
    onDeleteItem,
    onAddItem,
    gridRef,
    firstInputRef,
  }) => {
    const isMobile = useIsMobile();
    const isForm = variant === "form";
    const isVnd = (currency || "VND").toUpperCase() === "VND";
    const tableRef = useRef<HTMLTableElement | null>(null);
    const firstCellRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const [internalActiveRow, setInternalActiveRow] = useState(0);

    useEffect(() => {
      if (!onSelectRow) setInternalActiveRow(0);
    }, [items, onSelectRow]);

    const currentActiveRow = onSelectRow ? activeRowIndex : internalActiveRow;
    const handleSelectRow = useCallback(
      (idx: number) => {
        setInternalActiveRow(idx);
        onSelectRow?.(idx);
      },
      [onSelectRow],
    );

    const fetchTkOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchTaiKhoan(q);
    }, []);

    const fetchDtOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(q);
    }, []);

    const fetchBpOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchBoPhan(q);
    }, []);

    useEffect(() => {
      if (!gridRef) return;
      (gridRef as React.MutableRefObject<CashDetailGridHandle | null>).current = {
        focusFirstCell: (rowIdx: number) => {
          window.setTimeout(() => {
            const el = firstCellRefs.current[rowIdx];
            if (el) {
              el.focus();
              el.select();
            }
          }, 0);
        },
      };
    }, [gridRef]);

    const navigateCell = useCallback(
      (dir: VfpNavDir, currentEl: HTMLInputElement, rowIdx: number) => {
        const table = tableRef.current;
        if (!table) return;
        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const curTr = currentEl.closest("tr");
        if (!curTr) return;
        const getInputs = (tr: Element) =>
          Array.from(tr.querySelectorAll<HTMLInputElement>("input"))
            .filter((inp) => inp.dataset.readonly !== "true" && !inp.disabled);

        const rowInputs = getInputs(curTr);
        const colIdx = rowInputs.indexOf(currentEl);

        if (dir === "next" || dir === "right") {
          if (colIdx >= 0 && colIdx + 1 < rowInputs.length) {
            rowInputs[colIdx + 1].focus();
            rowInputs[colIdx + 1].select();
            return;
          }
          if (rowIdx + 1 < rows.length) {
            const nextInputs = getInputs(rows[rowIdx + 1]);
            if (nextInputs[0]) {
              nextInputs[0].focus();
              nextInputs[0].select();
              handleSelectRow(rowIdx + 1);
            }
          } else if (dir === "next" && editable && onAddItem) {
            onAddItem();
            window.setTimeout(() => {
              const updatedRows = Array.from(
                table.querySelectorAll("tbody tr"),
              );
              const target = updatedRows[rowIdx + 1];
              if (target) {
                const nextInputs = getInputs(target);
                nextInputs[0]?.focus();
                nextInputs[0]?.select();
              }
            }, 20);
          }
        } else if (dir === "prev" || dir === "left") {
          if (colIdx > 0) {
            rowInputs[colIdx - 1].focus();
            rowInputs[colIdx - 1].select();
            return;
          }
          if (rowIdx > 0) {
            const prevInputs = getInputs(rows[rowIdx - 1]);
            const last = prevInputs[prevInputs.length - 1];
            if (last) {
              last.focus();
              last.select();
              handleSelectRow(rowIdx - 1);
            }
          }
        } else if (dir === "down" && rowIdx + 1 < rows.length) {
          const nextInputs = getInputs(rows[rowIdx + 1]);
          const target = nextInputs[Math.min(Math.max(colIdx, 0), nextInputs.length - 1)];
          if (target) {
            target.focus();
            target.select();
            handleSelectRow(rowIdx + 1);
          }
        } else if (dir === "up" && rowIdx > 0) {
          const prevInputs = getInputs(rows[rowIdx - 1]);
          const target = prevInputs[Math.min(Math.max(colIdx, 0), prevInputs.length - 1)];
          if (target) {
            target.focus();
            target.select();
            handleSelectRow(rowIdx - 1);
          }
        }
      },
      [editable, handleSelectRow, onAddItem],
    );

    const handleReadOnlyCopy = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const el = e.currentTarget;
        if (el.selectionStart === el.selectionEnd && el.value) {
          e.clipboardData.setData("text/plain", el.value);
          e.preventDefault();
        }
      },
      [],
    );

    const handleReadOnlyNav = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number) => {
        const dir = arrowDir(e.key);
        if (dir) {
          e.preventDefault();
          navigateCell(dir, e.currentTarget, rowIdx);
        }
      },
      [navigateCell],
    );

    const isDebitMain = config.fixedSide === "debit";

    if (isMobile && isForm) {
      return (
        <MobileCashDetailList
          items={items}
          config={config}
          currency={currency}
          editable={editable}
          activeRowIndex={currentActiveRow}
          onSelectRow={handleSelectRow}
          onChangeItem={onChangeItem}
          onDeleteItem={onDeleteItem}
          onAddItem={onAddItem}
          firstInputRef={firstInputRef}
          fetchTkOptions={fetchTkOptions}
          fetchDtOptions={fetchDtOptions}
          fetchBpOptions={fetchBpOptions}
        />
      );
    }

    return (
      <div
        className={`w-full overflow-auto bg-white ${
          embedded ? "flex-1 min-h-0" : "border border-neutral-300 rounded shadow-sm"
        }`}
      >
        <table
          ref={tableRef}
          className={`w-full border-collapse xl-grid table-sticky-header text-xs ${
            isForm ? "xl-grid-no-hover" : ""
          }`}
        >
          <thead>
            <tr>
              <th className="vfp-header w-9 text-center">#</th>
              <th className="vfp-header w-24">TK Nợ</th>
              <th className="vfp-header w-24">TK Có</th>
              <th className="vfp-header w-36 text-right">
                Số tiền {isVnd ? "(VND)" : `(${currency})`}
              </th>
              <th className="vfp-header min-w-[220px]">Diễn giải chi tiết</th>
              <th className="vfp-header w-28">Mã ĐT</th>
              <th className="vfp-header min-w-[160px]">Tên đối tượng</th>
              <th className="vfp-header w-24">Bộ phận</th>
              {isForm && editable && (
                <th className="vfp-header w-10 text-center">Xóa</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={isForm && editable ? 9 : 8}
                  className="py-6 text-center text-neutral-400 text-xs"
                >
                  Chưa có dòng hạch toán chi tiết.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isActive = idx === currentActiveRow;
                const roClass = "xl-ro-input text-neutral-800";
                return (
                  <tr
                    key={item.stt0 || `row-${idx}`}
                    onClick={() => handleSelectRow(idx)}
                    className={isActive ? "xl-row-active" : undefined}
                  >
                    <td className="xl-rowhead font-mono">{idx + 1}</td>

                    {/* TK Nợ */}
                    <td className={isForm && editable ? "xl-cell" : "xl-ro"}>
                      {isForm && editable ? (
                        <VfpLookupCell
                          inputRef={(el) => {
                            if (!isDebitMain) return;
                            firstCellRefs.current[idx] = el;
                            if (idx === 0 && firstInputRef) {
                              (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                            }
                          }}
                          value={item.tk_no || ""}
                          placeholder="TK Nợ"
                          fetcher={fetchTkOptions}
                          dropdownMinWidth={360}
                          onFocusRow={() => handleSelectRow(idx)}
                          onValueChange={(v) =>
                            onChangeItem?.(idx, { ...item, tk_no: v }, "tk_no")
                          }
                          onPick={(opt) =>
                            onChangeItem?.(
                              idx,
                              { ...item, tk_no: opt.value, ten_tk_no: opt.hint || "" },
                              "tk_no",
                            )
                          }
                          onCommit={(raw) => {
                            const clean = raw.trim().toUpperCase();
                            const found = getTaiKhoan(clean);
                            onChangeItem?.(
                              idx,
                              {
                                ...item,
                                tk_no: found ? found.tk : clean,
                                ten_tk_no: found?.ten_tk || "",
                              },
                              "tk_no",
                            );
                          }}
                          onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                          className="xl-input font-mono font-bold text-primary-900"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={item.tk_no || ""}
                          rowIndex={idx}
                          className={`${roClass} font-mono font-semibold`}
                          title={item.ten_tk_no || item.tk_no}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {/* TK Có */}
                    <td className={isForm && editable ? "xl-cell" : "xl-ro"}>
                      {isForm && editable ? (
                        <VfpLookupCell
                          inputRef={(el) => {
                            if (isDebitMain) return;
                            firstCellRefs.current[idx] = el;
                            if (idx === 0 && firstInputRef) {
                              (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                            }
                          }}
                          value={item.tk_co || ""}
                          placeholder="TK Có"
                          fetcher={fetchTkOptions}
                          dropdownMinWidth={360}
                          onFocusRow={() => handleSelectRow(idx)}
                          onValueChange={(v) =>
                            onChangeItem?.(idx, { ...item, tk_co: v }, "tk_co")
                          }
                          onPick={(opt) =>
                            onChangeItem?.(
                              idx,
                              { ...item, tk_co: opt.value, ten_tk_co: opt.hint || "" },
                              "tk_co",
                            )
                          }
                          onCommit={(raw) => {
                            const clean = raw.trim().toUpperCase();
                            const found = getTaiKhoan(clean);
                            onChangeItem?.(
                              idx,
                              {
                                ...item,
                                tk_co: found ? found.tk : clean,
                                ten_tk_co: found?.ten_tk || "",
                              },
                              "tk_co",
                            );
                          }}
                          onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                          className="xl-input font-mono font-bold text-primary-900"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={item.tk_co || ""}
                          rowIndex={idx}
                          className={`${roClass} font-mono font-semibold`}
                          title={item.ten_tk_co || item.tk_co}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {/* Số tiền */}
                    <td className={isForm && editable ? "xl-cell xl-amber" : "xl-ro"}>
                      {isForm && editable ? (
                        <NumCell
                          value={item.tien_nt || 0}
                          noDecimals={isVnd}
                          onFocus={() => handleSelectRow(idx)}
                          onCommit={(val) =>
                            onChangeItem?.(
                              idx,
                              { ...item, tien_nt: val, tien: val },
                              "tien_nt",
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              navigateCell("next", e.currentTarget, idx);
                            }
                          }}
                          onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                          className="xl-input text-right font-mono font-bold text-neutral-900"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={
                            isVnd
                              ? formatNumber0(item.tien_nt || item.tien || 0)
                              : formatNumber2(item.tien_nt || 0)
                          }
                          rowIndex={idx}
                          className={`${roClass} text-right font-mono font-bold`}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {/* Diễn giải */}
                    <td className={isForm && editable ? "xl-cell" : "xl-ro"}>
                      {isForm && editable ? (
                        <input
                          type="text"
                          value={item.dien_giai || ""}
                          onFocus={() => handleSelectRow(idx)}
                          onChange={(e) =>
                            onChangeItem?.(
                              idx,
                              { ...item, dien_giai: e.target.value },
                              "dien_giai",
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              navigateCell("next", e.currentTarget, idx);
                              return;
                            }
                            const dir = arrowDir(e.key);
                            if (dir === "up" || dir === "down") {
                              e.preventDefault();
                              navigateCell(dir, e.currentTarget, idx);
                            }
                          }}
                          placeholder="Diễn giải dòng..."
                          className="xl-input text-neutral-900"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={item.dien_giai || ""}
                          rowIndex={idx}
                          className={roClass}
                          title={item.dien_giai}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {/* Mã đối tượng */}
                    <td className={isForm && editable ? "xl-cell" : "xl-ro"}>
                      {isForm && editable ? (
                        <VfpLookupCell
                          value={item.ma_dt || ""}
                          placeholder="Mã ĐT"
                          fetcher={fetchDtOptions}
                          dropdownMinWidth={480}
                          onFocusRow={() => handleSelectRow(idx)}
                          onValueChange={(v) =>
                            onChangeItem?.(idx, { ...item, ma_dt: v, ten_dt: "" }, "ma_dt")
                          }
                          onPick={(opt) =>
                            onChangeItem?.(
                              idx,
                              { ...item, ma_dt: opt.value, ten_dt: opt.hint || "" },
                              "ma_dt",
                            )
                          }
                          onCommit={(raw) => {
                            const clean = raw.trim().toUpperCase();
                            const found = getCustomer(clean);
                            onChangeItem?.(
                              idx,
                              {
                                ...item,
                                ma_dt: found ? found.ma_dt : clean,
                                ten_dt: found?.ten_dt || "",
                              },
                              "ma_dt",
                            );
                          }}
                          onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                          className="xl-input font-mono uppercase"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={item.ma_dt || ""}
                          rowIndex={idx}
                          className={`${roClass} font-mono`}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {/* Tên đối tượng (readonly) */}
                    <td className="xl-ro">
                      <ReadOnlyGridInput
                        value={item.ten_dt || ""}
                        rowIndex={idx}
                        isFormReadOnlyColumn={isForm}
                        className={`${roClass} text-neutral-600`}
                        title={item.ten_dt}
                        onSelectRow={handleSelectRow}
                        onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                        onCopy={handleReadOnlyCopy}
                      />
                    </td>

                    {/* Bộ phận */}
                    <td className={isForm && editable ? "xl-cell" : "xl-ro"}>
                      {isForm && editable ? (
                        <VfpLookupCell
                          value={item.ma_bp || ""}
                          placeholder="Mã BP"
                          fetcher={fetchBpOptions}
                          dropdownMinWidth={320}
                          onFocusRow={() => handleSelectRow(idx)}
                          onValueChange={(v) =>
                            onChangeItem?.(idx, { ...item, ma_bp: v }, "ma_bp")
                          }
                          onPick={(opt) =>
                            onChangeItem?.(
                              idx,
                              { ...item, ma_bp: opt.value, ten_bp: opt.hint || "" },
                              "ma_bp",
                            )
                          }
                          onCommit={(raw) => {
                            const clean = raw.trim().toUpperCase();
                            const found = getBoPhan(clean);
                            onChangeItem?.(
                              idx,
                              {
                                ...item,
                                ma_bp: found ? found.ma_bp : clean,
                                ten_bp: found?.ten_bp || "",
                              },
                              "ma_bp",
                            );
                          }}
                          onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                          className="xl-input font-mono uppercase"
                        />
                      ) : (
                        <ReadOnlyGridInput
                          value={item.ma_bp || ""}
                          rowIndex={idx}
                          className={`${roClass} font-mono`}
                          onSelectRow={handleSelectRow}
                          onKeyDown={(e) => handleReadOnlyNav(e, idx)}
                          onCopy={handleReadOnlyCopy}
                        />
                      )}
                    </td>

                    {isForm && editable && (
                      <td className="xl-ro text-center">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem?.(idx);
                          }}
                          title="Xóa dòng (F8)"
                          className="text-neutral-400 hover:text-danger-600 font-bold text-xs px-1.5 cursor-pointer"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  },
);
CashDetailGrid.displayName = "CashDetailGrid";
