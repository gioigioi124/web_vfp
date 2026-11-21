import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { VoucherDetail } from "../../types/voucher";
import {
  formatCompactNumber,
  formatCurrency,
  parseNumberInput,
} from "../../lib/format";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";

interface MobileDecimalInputProps {
  value: number;
  integerOnly?: boolean;
  blankWhenZero?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onCommit: (num: number) => void;
  onFocus?: () => void;
  className?: string;
}

const MobileDecimalInput: React.FC<MobileDecimalInputProps> = ({
  value,
  integerOnly = false,
  blankWhenZero = false,
  disabled = false,
  placeholder,
  onCommit,
  onFocus,
  className = "",
}) => {
  const formatDisplay = (v: number): string => {
    if (blankWhenZero && Math.abs(v) < 1e-9) return "";
    return integerOnly ? String(Math.round(v)) : formatCompactNumber(v);
  };

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string>(() => formatDisplay(value));

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, integerOnly, blankWhenZero]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(0);
      return;
    }
    const parsed = parseNumberInput(trimmed);
    onCommit(integerOnly ? Math.round(parsed) : parsed);
  };

  return (
    <input
      type="text"
      inputMode={integerOnly ? "numeric" : "decimal"}
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        const raw =
          blankWhenZero && Math.abs(value) < 1e-9
            ? ""
            : integerOnly
              ? String(Math.round(value))
              : String(value);
        setText(raw);
        onFocus?.();
        const target = e.currentTarget;
        setTimeout(() => {
          if (document.activeElement === target) target.select();
        }, 0);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(text);
          e.currentTarget.blur();
        }
      }}
      className={`erp-input h-9 text-right font-mono tabular-nums ${
        disabled ? "bg-neutral-100 text-neutral-500" : "bg-white"
      } ${className}`}
    />
  );
};

export interface MobileDetailItemListProps {
  items: VoucherDetail[];
  editable: boolean;
  isWarehouse: boolean;
  isReturn?: boolean;
  currency: string;
  activeRowIndex: number;
  itemsRef: React.MutableRefObject<VoucherDetail[]>;
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
  onAddItem?: () => void;
  onDeleteItem?: (idx: number) => void;
}

export const MobileDetailItemList: React.FC<MobileDetailItemListProps> = ({
  items,
  editable,
  isWarehouse,
  isReturn = false,
  currency,
  activeRowIndex,
  itemsRef,
  firstMaVtRef,
  fetchVatTuOptions,
  fetchKhoOptionsLocal,
  onSelectRow,
  onApplyRow,
  onEnrichVatTuRow,
  onAddItem,
  onDeleteItem,
}) => {
  const fixedTt = isReturn ? "K" : "C";

  return (
    <div className="p-2.5 space-y-2.5 bg-slate-50">
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-500 bg-white rounded-xl border border-dashed border-neutral-300">
          Không có dòng mặt hàng nào.
        </div>
      ) : (
        items.map((it, idx) => {
          const isActive = idx === activeRowIndex;
          const isManualRow = !(it.stt_px && it.stt_px.trim());
          return (
            <div
              key={it.stt0 || idx}
              onClick={() => onSelectRow(idx)}
              className={`rounded-xl border bg-white p-3 shadow-xs space-y-2.5 transition-colors ${
                isActive
                  ? "border-primary-500 ring-1 ring-primary-200"
                  : isManualRow
                    ? "border-amber-200"
                    : "border-neutral-200"
              }`}
            >
              {/* Card Header: Row # + Badges + Delete */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[11px] font-bold">
                    #{idx + 1}
                  </span>
                  {it.dvt && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                      ĐVT: {it.dvt}
                    </span>
                  )}
                  {!isWarehouse && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                      TK: {it.tk_du2 || it.tk_du || (isReturn ? "5212" : "5111")} · {fixedTt}
                    </span>
                  )}
                </div>
                {editable && onDeleteItem && items.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(idx);
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                    title="Xóa dòng"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mã vật tư + Tên vật tư */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                      Mã vật tư
                    </label>
                    {editable ? (
                      <Autocomplete
                        inputRef={
                          idx === 0 && firstMaVtRef
                            ? (el) => {
                                (firstMaVtRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                              }
                            : undefined
                        }
                        selectOnFocus
                        value={it.ma_vt || ""}
                        onChange={(val) => {
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
                        onSelect={(opt) => {
                          onSelectRow(idx);
                          void onEnrichVatTuRow(idx, opt.value, opt.hint);
                        }}
                        onBlur={() => {
                          const latest = itemsRef.current[idx] ?? it;
                          if (latest.ma_vt?.trim() && !latest.ten_vt) {
                            void onEnrichVatTuRow(idx, latest.ma_vt);
                          }
                        }}
                        fetcher={fetchVatTuOptions}
                        placeholder="Mã hàng..."
                        openOnTypeOnly
                        debounceMs={30}
                        maxResults={30}
                        className="h-9 font-mono font-bold text-primary-900 uppercase"
                      />
                    ) : (
                      <div className="font-mono font-bold text-sm text-primary-900">
                        {it.ma_vt || "—"}
                      </div>
                    )}
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                      Kho
                    </label>
                    {editable ? (
                      <Autocomplete
                        selectOnFocus
                        value={it.ma_kho || ""}
                        onChange={(val) => {
                          const curr = itemsRef.current[idx] ?? it;
                          onApplyRow(
                            idx,
                            { ...curr, ma_kho: val.toUpperCase() },
                            "MA_KHO",
                          );
                        }}
                        onSelect={(opt) => {
                          const curr = itemsRef.current[idx] ?? it;
                          onApplyRow(
                            idx,
                            { ...curr, ma_kho: opt.value.trim().toUpperCase() },
                            "MA_KHO",
                          );
                        }}
                        fetcher={fetchKhoOptionsLocal}
                        placeholder="Kho..."
                        debounceMs={30}
                        maxResults={20}
                        className="h-9 font-mono font-semibold text-center uppercase"
                      />
                    ) : (
                      <div className="font-mono text-xs text-neutral-700">
                        {it.ma_kho || "—"}
                      </div>
                    )}
                  </div>

                  <div className="col-span-3 text-right">
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                      {isReturn ? "SL nhập" : "SL bán"}
                    </label>
                    <div className="h-9 flex items-center justify-end font-mono font-bold text-sm text-primary-900">
                      {formatCompactNumber(it.so_luong8 ?? it.so_luong9 ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-medium text-neutral-800 bg-neutral-50 rounded-lg px-2.5 py-1.5 border border-neutral-100 min-h-[28px]">
                  {it.ten_vt || (
                    <span className="text-neutral-400 italic">
                      Chưa chọn tên vật tư
                    </span>
                  )}
                </div>
              </div>

              {/* Numeric Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    Số tấm
                  </label>
                  {editable ? (
                    <MobileDecimalInput
                      value={Math.round(it.so_tam ?? 1)}
                      integerOnly
                      onFocus={() => onSelectRow(idx)}
                      onCommit={(v) => {
                        const curr = itemsRef.current[idx] ?? it;
                        const rounded = Math.round(v);
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
                      className="font-bold text-primary-900"
                    />
                  ) : (
                    <div className="font-mono font-semibold text-sm text-neutral-800">
                      {formatCompactNumber(it.so_tam ?? 0)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    Hệ số {it.loai_vt === "4" ? "(cố định)" : ""}
                  </label>
                  {editable ? (
                    <MobileDecimalInput
                      value={it.he_so8 ?? 1}
                      disabled={it.loai_vt === "4"}
                      onFocus={() => onSelectRow(idx)}
                      onCommit={(v) => {
                        const curr = itemsRef.current[idx] ?? it;
                        const st = Number(curr.so_tam ?? 1) || 1;
                        const safeHeSo = v > 0 ? v : Number(curr.he_so8 ?? 1) || 1;
                        const nextSl8 = st * safeHeSo;
                        onApplyRow(
                          idx,
                          {
                            ...curr,
                            he_so8: safeHeSo,
                            so_luong8: nextSl8,
                            so_luong9: nextSl8,
                            so_luong: nextSl8,
                          },
                          "HE_SO8",
                        );
                      }}
                      className="font-bold text-amber-800"
                    />
                  ) : (
                    <div className="font-mono font-semibold text-sm text-neutral-800">
                      {formatCompactNumber(it.he_so8 ?? 1)}
                    </div>
                  )}
                </div>

                {!isWarehouse && (
                  <>
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                        Đơn giá
                      </label>
                      {editable ? (
                        <MobileDecimalInput
                          value={it.gia_nt9 ?? 0}
                          onFocus={() => onSelectRow(idx)}
                          onCommit={(v) => {
                            const curr = itemsRef.current[idx] ?? it;
                            onApplyRow(idx, { ...curr, gia_nt9: v }, "GIA_NT9");
                          }}
                          className="font-bold text-blue-900"
                        />
                      ) : (
                        <div className="font-mono font-semibold text-sm text-blue-900">
                          {formatCurrency(it.gia_nt9 ?? 0, currency)}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                        CK %
                      </label>
                      {editable ? (
                        <MobileDecimalInput
                          value={Math.round(it.chiet_khau ?? 0)}
                          integerOnly
                          blankWhenZero
                          placeholder="0"
                          onFocus={() => onSelectRow(idx)}
                          onCommit={(v) => {
                            const curr = itemsRef.current[idx] ?? it;
                            onApplyRow(
                              idx,
                              { ...curr, chiet_khau: Math.round(v) },
                              "CHIET_KHAU",
                            );
                          }}
                          className="font-bold text-neutral-800"
                        />
                      ) : (
                        <div className="font-mono font-semibold text-sm text-neutral-800">
                          {it.chiet_khau ? `${it.chiet_khau}%` : "0%"}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Line Totals */}
              {!isWarehouse && (
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
                  <div className="text-neutral-500">
                    Thành tiền:{" "}
                    <span className="font-mono font-bold text-neutral-800">
                      {formatCurrency(it.tien_nt9 ?? 0, currency)}
                    </span>
                    {(it.tien_nt4 ?? 0) > 0 && (
                      <span className="text-amber-700 ml-1.5">
                        (-{formatCurrency(it.tien_nt4 ?? 0, currency)})
                      </span>
                    )}
                  </div>
                  <div className="font-mono font-bold text-primary-900 text-sm">
                    {formatCurrency(
                      (it.tien_nt9 ?? it.tien_nt ?? 0) - (it.tien_nt4 ?? 0),
                      currency,
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {editable && onAddItem && (
        <button
          type="button"
          onClick={onAddItem}
          className="w-full h-11 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/60 hover:bg-primary-50 text-primary-800 font-semibold text-sm inline-flex items-center justify-center gap-1.5 active:bg-primary-100"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm dòng hàng</span>
        </button>
      )}
    </div>
  );
};
