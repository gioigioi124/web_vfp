import React from "react";
import { VoucherDetail } from "../../types/voucher";
import {
  formatCompactNumber,
  formatCurrency,
  formatNumber0,
  formatQuantity,
} from "../../lib/format";
import { AutocompleteOption } from "../ui/Autocomplete";
import { VfpLookupCell, VfpNavDir } from "../ui/VfpLookupCell";
import { handleExcelMouseDown, selectAllLater } from "../ui/excelCell";
import { NumCell } from "./NumCell";
import { ReadOnlyGridInput } from "./ReadOnlyGridCell";
import { renderHighlightedSpecs } from "./specHighlight";

export interface DetailGridFormRowProps {
  item: VoucherDetail;
  idx: number;
  isActive: boolean;
  editable: boolean;
  isWarehouse: boolean;
  isReturn?: boolean;
  currency: string;
  highlightSpecs: boolean;
  itemsRef: React.MutableRefObject<VoucherDetail[]>;
  maVtInputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  firstMaVtRef?: React.RefObject<HTMLInputElement | null>;
  fetchVatTuOptions: (query: string) => Promise<AutocompleteOption[]>;
  fetchKhoOptionsLocal: (query: string) => Promise<AutocompleteOption[]>;
  onSelectRow: (idx: number) => void;
  onApplyRow: (idx: number, row: VoucherDetail, fieldName?: string) => void;
  onEnrichVatTuRow: (
    idx: number,
    rawCode: string,
    hintTenVt?: string,
  ) => Promise<void>;
  onCellNavigate: (dir: VfpNavDir, el: HTMLInputElement, rowIdx: number) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    isTtCell?: boolean,
  ) => void;
  onReadOnlyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onReadOnlyCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const DetailGridFormRow: React.FC<DetailGridFormRowProps> = React.memo(
  ({
    item: it,
    idx,
    isActive,
    editable,
    isWarehouse,
    isReturn = false,
    currency,
    highlightSpecs,
    itemsRef,
    maVtInputRefs,
    firstMaVtRef,
    fetchVatTuOptions,
    fetchKhoOptionsLocal,
    onSelectRow,
    onApplyRow,
    onEnrichVatTuRow,
    onCellNavigate,
    onCellKeyDown,
    onReadOnlyKeyDown,
    onReadOnlyCopy,
  }) => {
    const fixedTt = isReturn ? "K" : "C";
    const isManualRow = !(it.stt_px && it.stt_px.trim());
    const rowClassName =
      [isActive ? "xl-row-active" : "", isManualRow ? "xl-row-manual" : ""]
        .filter(Boolean)
        .join(" ") || undefined;
    const rowTitle = isManualRow
      ? isReturn
        ? "Dòng nhập trực tiếp (không lấy từ Chọn phiếu nhập lại)"
        : "Dòng nhập trực tiếp (không lấy từ Chọn phiếu xuất)"
      : undefined;

    if (editable) {
      return (
        <tr
          onClick={() => onSelectRow(idx)}
          className={rowClassName}
          title={rowTitle}
        >
          {/* Số dòng (kiểu tiêu đề dòng Excel) */}
          <td className="xl-rowhead">{idx + 1}</td>
          {/* Mã vật tư */}
          <td className="xl-cell">
            <VfpLookupCell
              inputRef={(el) => {
                maVtInputRefs.current[idx] = el;
                if (idx === 0 && firstMaVtRef) {
                  (
                    firstMaVtRef as React.MutableRefObject<HTMLInputElement | null>
                  ).current = el;
                }
              }}
              value={it.ma_vt || ""}
              onValueChange={(val) => {
                // Sửa chữ -> xóa ngay Tên/Đơn giá/CK của mã cũ (như VFP)
                // để không còn tình trạng mã mới nhưng tên/giá cũ.
                const curr = itemsRef.current[idx] ?? it;
                onApplyRow(
                  idx,
                  {
                    ...curr,
                    ma_vt: val,
                    ten_vt: "",
                    gia_nt9: 0,
                    chiet_khau: 0,
                  },
                  "MA_VT",
                );
              }}
              onPick={(opt) => onEnrichVatTuRow(idx, opt.value, opt.hint)}
              onCommit={(v) => onEnrichVatTuRow(idx, v)}
              onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
              onFocusRow={() => onSelectRow(idx)}
              fetcher={fetchVatTuOptions}
              debounceMs={30}
              maxResults={30}
              dropdownMinWidth={640}
              className="xl-input font-mono font-semibold text-blue-900 uppercase grid-cell-input"
            />
          </td>
          {/* Tên vật tư (chỉ đọc — click chọn/copy được) */}
          <td className="xl-ro relative">
            <ReadOnlyGridInput
              isFormReadOnlyColumn
              value={it.ten_vt || ""}
              title={it.ten_vt || ""}
              rowIndex={idx}
              onSelectRow={onSelectRow}
              onKeyDown={onReadOnlyKeyDown}
              onCopy={onReadOnlyCopy}
              className={`xl-ro-input font-sans truncate ${
                highlightSpecs && it.ten_vt
                  ? "!text-transparent caret-transparent selection:bg-primary-200/40 selection:text-transparent"
                  : "font-medium text-neutral-800"
              }`}
            />
            {highlightSpecs && it.ten_vt && (
              <div
                aria-hidden="true"
                className="xl-ro-input pointer-events-none absolute inset-0 font-sans font-medium text-neutral-800 truncate select-none"
              >
                {renderHighlightedSpecs(it.ten_vt)}
              </div>
            )}
          </td>
          {/* Đvt (chỉ đọc — click chọn/copy được) */}
          <td className="xl-ro">
            <ReadOnlyGridInput
              isFormReadOnlyColumn
              value={it.dvt || ""}
              rowIndex={idx}
              onSelectRow={onSelectRow}
              onKeyDown={onReadOnlyKeyDown}
              onCopy={onReadOnlyCopy}
              className="xl-ro-input text-center font-sans font-semibold text-neutral-600"
            />
          </td>
          {/* Số lượng (chỉ đọc — click chọn/copy được) */}
          <td className="xl-ro">
            <ReadOnlyGridInput
              isFormReadOnlyColumn
              value={formatCompactNumber(it.so_luong9 ?? 0)}
              rowIndex={idx}
              onSelectRow={onSelectRow}
              onKeyDown={onReadOnlyKeyDown}
              onCopy={onReadOnlyCopy}
              className="xl-ro-input text-right font-mono font-bold text-primary-900 tabular-nums"
            />
          </td>
          {/* TK Có / TK Nợ (chỉ đọc — click chọn/copy được) */}
          {!isWarehouse && (
            <td className="xl-ro">
              <ReadOnlyGridInput
                isFormReadOnlyColumn
                value={it.tk_du2 || it.tk_du || (isReturn ? "5212" : "5111")}
                rowIndex={idx}
                onSelectRow={onSelectRow}
                onKeyDown={onReadOnlyKeyDown}
                onCopy={onReadOnlyCopy}
                className="xl-ro-input text-center font-mono font-normal text-neutral-600"
              />
            </td>
          )}
          {/* Kho (VfpLookupCell DmKho) */}
          <td className="xl-cell">
            <VfpLookupCell
              value={it.ma_kho || ""}
              onValueChange={(val) => {
                const curr = itemsRef.current[idx] ?? it;
                onApplyRow(
                  idx,
                  { ...curr, ma_kho: val.toUpperCase() },
                  "MA_KHO",
                );
              }}
              onPick={(opt) => {
                const curr = itemsRef.current[idx] ?? it;
                onApplyRow(
                  idx,
                  {
                    ...curr,
                    ma_kho: opt.value.trim().toUpperCase(),
                  },
                  "MA_KHO",
                );
              }}
              onCommit={(v) => {
                const curr = itemsRef.current[idx] ?? it;
                onApplyRow(
                  idx,
                  { ...curr, ma_kho: v.trim().toUpperCase() },
                  "MA_KHO",
                );
              }}
              onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
              onFocusRow={() => onSelectRow(idx)}
              fetcher={fetchKhoOptionsLocal}
              dropdownMinWidth={300}
              className="xl-input text-center font-mono font-normal text-neutral-600 uppercase grid-cell-input"
            />
          </td>
          {/* Số tấm */}
          <td className="xl-cell xl-amber">
            <NumCell
              value={Math.round(it.so_tam ?? 1)}
              integerOnly
              noDecimals
              onCommit={(v) => {
                const curr = itemsRef.current[idx] ?? it;
                const rounded = Math.round(v);
                // Ràng buộc Số tấm không thể <= 0: giữ lại giá trị hợp lệ trước đó (mặc định 1).
                const safeSoTam =
                  rounded > 0
                    ? rounded
                    : curr.so_tam && curr.so_tam > 0
                      ? Math.round(curr.so_tam)
                      : 1;
                const hs8 = Number(curr.he_so8 ?? 1) || 1;
                const nextSl8 = safeSoTam * hs8;
                onApplyRow(
                  idx,
                  {
                    ...curr,
                    so_tam: safeSoTam,
                    so_luong8: nextSl8,
                    so_luong9: nextSl8,
                    so_luong: nextSl8,
                  },
                  "SO_TAM",
                );
              }}
              onFocus={() => onSelectRow(idx)}
              onKeyDown={(e) => onCellKeyDown(e, idx, false)}
              onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
              className="xl-input text-right font-mono font-bold text-primary-900 tabular-nums grid-cell-input"
            />
          </td>
          {/* Hệ số (Loại 4: khóa, luôn = 1) */}
          <td
            className={`xl-cell xl-amber ${
              it.loai_vt === "4" ? "xl-locked" : ""
            }`}
          >
            <NumCell
              value={it.he_so8 ?? 1}
              compactDecimals
              disabled={it.loai_vt === "4"}
              title={
                it.loai_vt === "4"
                  ? "Loại vật tư 4: Hệ số cố định = 1"
                  : undefined
              }
              onCommit={(v) => {
                const curr = itemsRef.current[idx] ?? it;
                const st = Number(curr.so_tam ?? 1) || 1;
                const nextSl8 = st * v;
                onApplyRow(
                  idx,
                  {
                    ...curr,
                    he_so8: v,
                    so_luong8: nextSl8,
                    so_luong9: nextSl8,
                    so_luong: nextSl8,
                  },
                  "HE_SO8",
                );
              }}
              onFocus={() => onSelectRow(idx)}
              onKeyDown={(e) => onCellKeyDown(e, idx, false)}
              onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
              className={`xl-input text-right font-mono tabular-nums grid-cell-input ${
                it.loai_vt !== "4" ||
                Math.abs(Number(it.he_so8 ?? 1) - 1) > 1e-6
                  ? "font-bold text-amber-700"
                  : "font-normal text-neutral-600"
              }`}
            />
          </td>
          {/* SL bán (chỉ đọc — click chọn/copy được) */}
          <td className="xl-ro xl-amber">
            <ReadOnlyGridInput
              isFormReadOnlyColumn
              value={formatCompactNumber(it.so_luong8 ?? 0)}
              rowIndex={idx}
              onSelectRow={onSelectRow}
              onKeyDown={onReadOnlyKeyDown}
              onCopy={onReadOnlyCopy}
              className="xl-ro-input text-right font-mono font-semibold text-neutral-700 tabular-nums"
            />
          </td>
          {!isWarehouse && (
            <>
              {/* Đơn giá */}
              <td className="xl-cell">
                <NumCell
                  value={it.gia_nt9 ?? 0}
                  compactDecimals
                  dataField="gia_nt9"
                  onCommit={(v) => {
                    const curr = itemsRef.current[idx] ?? it;
                    onApplyRow(idx, { ...curr, gia_nt9: v }, "GIA_NT9");
                  }}
                  onFocus={() => onSelectRow(idx)}
                  onKeyDown={(e) => onCellKeyDown(e, idx, false)}
                  onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
                  className="xl-input text-right font-mono font-semibold text-blue-900 tabular-nums grid-cell-input"
                />
              </td>
              {/* Thành tiền */}
              <td className="xl-cell">
                <NumCell
                  value={it.tien_nt9 ?? 0}
                  noDecimals={currency.toUpperCase() === "VND"}
                  onCommit={(v) => {
                    const curr = itemsRef.current[idx] ?? it;
                    onApplyRow(
                      idx,
                      {
                        ...curr,
                        tien_nt9:
                          currency.toUpperCase() === "VND" ? Math.round(v) : v,
                      },
                      "TIEN_NT9",
                    );
                  }}
                  onFocus={() => onSelectRow(idx)}
                  onKeyDown={(e) => onCellKeyDown(e, idx, false)}
                  onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
                  className="xl-input text-right font-mono font-semibold text-blue-900 tabular-nums grid-cell-input"
                />
              </td>
              {/* CK % */}
              <td className="xl-cell">
                <NumCell
                  value={Math.round(it.chiet_khau ?? 0)}
                  blankWhenZero
                  integerOnly
                  onCommit={(v) => {
                    const curr = itemsRef.current[idx] ?? it;
                    onApplyRow(
                      idx,
                      { ...curr, chiet_khau: Math.round(v) },
                      "CHIET_KHAU",
                    );
                  }}
                  onFocus={() => onSelectRow(idx)}
                  onKeyDown={(e) => onCellKeyDown(e, idx, false)}
                  onNavigate={(dir, el) => onCellNavigate(dir, el, idx)}
                  className="xl-input text-center font-mono font-semibold text-blue-900 tabular-nums grid-cell-input"
                />
              </td>
            </>
          )}
          {/* TT: cố định là "C" (X1) hoặc "K" (N5) (ô chỉ-chọn), bấm Enter tại ô này sẽ kiểm tra dòng và tạo dòng mới */}
          <td className="xl-cell">
            <input
              type="text"
              value={fixedTt}
              readOnly
              data-mode="select"
              onMouseDown={(e) => handleExcelMouseDown(e, "select")}
              onFocus={(e) => {
                onSelectRow(idx);
                selectAllLater(e.currentTarget);
              }}
              onKeyDown={(e) => onCellKeyDown(e, idx, true)}
              onCopy={onReadOnlyCopy}
              title={`Cố định là ${fixedTt} — Bấm Enter để tạo dòng mới`}
              className="xl-input text-center font-semibold text-neutral-600 uppercase grid-cell-input"
            />
          </td>
        </tr>
      );
    }

    // Non-editable form row (View mode): cho phép click chọn/copy từng ô và di chuyển bằng mũi tên
    return (
      <tr
        onClick={() => onSelectRow(idx)}
        className={rowClassName}
        title={rowTitle}
      >
        <td className="xl-rowhead">{idx + 1}</td>
        <td className="xl-cell">
          <ReadOnlyGridInput
            value={it.ma_vt || ""}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input font-mono font-semibold text-neutral-900 grid-cell-input"
          />
        </td>
        <td className="xl-cell relative">
          <ReadOnlyGridInput
            value={it.ten_vt || ""}
            placeholder="—"
            title={it.ten_vt || ""}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className={`xl-input font-sans truncate grid-cell-input ${
              highlightSpecs && it.ten_vt
                ? "!text-transparent caret-transparent"
                : "font-medium text-neutral-800"
            }`}
          />
          {highlightSpecs && it.ten_vt && (
            <div
              aria-hidden="true"
              className="xl-input pointer-events-none absolute inset-0 font-sans font-medium text-neutral-800 truncate select-none"
            >
              {renderHighlightedSpecs(it.ten_vt)}
            </div>
          )}
        </td>
        <td className="xl-cell">
          <ReadOnlyGridInput
            value={it.dvt || ""}
            placeholder="—"
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-center font-sans font-semibold text-neutral-900 grid-cell-input"
          />
        </td>
        <td className="xl-cell">
          <ReadOnlyGridInput
            value={formatQuantity(it.so_luong9)}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-right font-semibold text-neutral-900 tabular-nums grid-cell-input"
          />
        </td>
        {!isWarehouse && (
          <td className="xl-cell">
            <ReadOnlyGridInput
              value={it.tk_du2 || it.tk_du || ""}
              placeholder="—"
              rowIndex={idx}
              onSelectRow={onSelectRow}
              onKeyDown={onReadOnlyKeyDown}
              onCopy={onReadOnlyCopy}
              className="xl-input text-center font-semibold text-neutral-900 grid-cell-input"
            />
          </td>
        )}
        <td className="xl-cell">
          <ReadOnlyGridInput
            value={it.ma_kho || ""}
            placeholder="—"
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-center font-semibold text-neutral-900 grid-cell-input"
          />
        </td>
        <td className="xl-cell xl-amber">
          <ReadOnlyGridInput
            value={formatNumber0(it.so_tam)}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-right font-bold text-neutral-900 tabular-nums grid-cell-input"
          />
        </td>
        <td className="xl-cell xl-amber">
          <ReadOnlyGridInput
            value={formatQuantity(it.he_so8)}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-right font-bold text-neutral-900 tabular-nums grid-cell-input"
          />
        </td>
        <td className="xl-cell xl-amber">
          <ReadOnlyGridInput
            value={formatQuantity(it.so_luong8)}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-right font-semibold text-neutral-900 tabular-nums grid-cell-input"
          />
        </td>
        {!isWarehouse && (
          <>
            <td className="xl-cell">
              <ReadOnlyGridInput
                value={formatCurrency(it.gia_nt9, currency)}
                rowIndex={idx}
                onSelectRow={onSelectRow}
                onKeyDown={onReadOnlyKeyDown}
                onCopy={onReadOnlyCopy}
                className="xl-input text-right font-semibold text-neutral-900 tabular-nums grid-cell-input"
              />
            </td>
            <td className="xl-cell">
              <ReadOnlyGridInput
                value={formatCurrency(it.tien_nt9, currency)}
                rowIndex={idx}
                onSelectRow={onSelectRow}
                onKeyDown={onReadOnlyKeyDown}
                onCopy={onReadOnlyCopy}
                className="xl-input text-right font-semibold text-neutral-900 tabular-nums grid-cell-input"
              />
            </td>
            <td className="xl-cell">
              <ReadOnlyGridInput
                value={
                  it.chiet_khau && Number(it.chiet_khau) !== 0
                    ? String(Math.round(Number(it.chiet_khau)))
                    : ""
                }
                rowIndex={idx}
                onSelectRow={onSelectRow}
                onKeyDown={onReadOnlyKeyDown}
                onCopy={onReadOnlyCopy}
                className="xl-input text-center font-sans font-semibold text-neutral-900 tabular-nums grid-cell-input"
              />
            </td>
          </>
        )}
        <td className="xl-cell">
          <ReadOnlyGridInput
            value={fixedTt}
            rowIndex={idx}
            onSelectRow={onSelectRow}
            onKeyDown={onReadOnlyKeyDown}
            onCopy={onReadOnlyCopy}
            className="xl-input text-center font-semibold text-neutral-900 font-sans grid-cell-input"
          />
        </td>
      </tr>
    );
  },
);

DetailGridFormRow.displayName = "DetailGridFormRow";
