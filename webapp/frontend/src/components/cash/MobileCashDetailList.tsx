import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CashVoucherDetail } from "../../types/cashVoucher";
import { CashVoucherModuleConfig } from "../../config/accountingModules";
import { getBoPhan, getTaiKhoan } from "../../lib/catalogCache";
import { getCustomer } from "../../lib/customerIndex";
import { formatCurrency, parseNumberInput } from "../../lib/format";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";

interface MobileAmountInputProps {
  value: number;
  isVnd: boolean;
  onFocus?: () => void;
  onCommit: (val: number) => void;
}

const MobileAmountInput: React.FC<MobileAmountInputProps> = ({
  value,
  isVnd,
  onFocus,
  onCommit,
}) => {
  const formatDisplay = (v: number) => {
    if (!v) return "";
    return isVnd
      ? Math.round(v).toLocaleString("en-US")
      : v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => formatDisplay(value));

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, isVnd]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(0);
      return;
    }
    const parsed = parseNumberInput(trimmed);
    onCommit(isVnd ? Math.round(parsed) : parsed);
  };

  return (
    <input
      type="text"
      inputMode={isVnd ? "numeric" : "decimal"}
      value={text}
      placeholder="0"
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(isVnd ? Math.round(value) : value) : "");
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
      className="erp-input h-9 text-right font-mono font-bold text-neutral-900 bg-white tabular-nums"
    />
  );
};

export interface MobileCashDetailListProps {
  items: CashVoucherDetail[];
  config: CashVoucherModuleConfig;
  currency?: string;
  editable?: boolean;
  activeRowIndex?: number;
  onSelectRow?: (index: number) => void;
  onChangeItem?: (
    index: number,
    updated: CashVoucherDetail,
    fieldName?: string,
  ) => void;
  onDeleteItem?: (index: number) => void;
  onAddItem?: () => void;
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
  fetchTkOptions: (query: string) => Promise<AutocompleteOption[]>;
  fetchDtOptions: (query: string) => Promise<AutocompleteOption[]>;
  fetchBpOptions: (query: string) => Promise<AutocompleteOption[]>;
}

export const MobileCashDetailList: React.FC<MobileCashDetailListProps> = ({
  items,
  config,
  currency = "VND",
  editable = false,
  activeRowIndex = 0,
  onSelectRow,
  onChangeItem,
  onDeleteItem,
  onAddItem,
  firstInputRef,
  fetchTkOptions,
  fetchDtOptions,
  fetchBpOptions,
}) => {
  const isVnd = (currency || "VND").toUpperCase() === "VND";
  const isDebitMain = config.fixedSide === "debit";

  return (
    <div className="p-2.5 space-y-2.5 bg-slate-50">
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-500 bg-white rounded-xl border border-dashed border-neutral-300">
          Chưa có dòng hạch toán.
        </div>
      ) : (
        items.map((item, idx) => {
          const isActive = idx === activeRowIndex;
          return (
            <div
              key={item.stt0 || idx}
              onClick={() => onSelectRow?.(idx)}
              className={`rounded-xl border bg-white p-3 shadow-xs space-y-2.5 transition-colors ${
                isActive
                  ? "border-primary-500 ring-1 ring-primary-200"
                  : "border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[11px] font-bold">
                  Dòng #{idx + 1}
                </span>
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

              {/* TK Nợ / TK Có */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    TK Nợ
                  </label>
                  {editable ? (
                    <Autocomplete
                      inputRef={
                        isDebitMain && idx === 0 && firstInputRef
                          ? (el) => {
                              (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                            }
                          : undefined
                      }
                      selectOnFocus
                      value={item.tk_no || ""}
                      fetcher={fetchTkOptions}
                      placeholder="TK Nợ"
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={30}
                      onChange={(v) =>
                        onChangeItem?.(idx, { ...item, tk_no: v }, "tk_no")
                      }
                      onSelect={(opt) => {
                        onSelectRow?.(idx);
                        onChangeItem?.(
                          idx,
                          { ...item, tk_no: opt.value, ten_tk_no: opt.hint || "" },
                          "tk_no",
                        );
                      }}
                      onBlur={() => {
                        const clean = (item.tk_no || "").trim().toUpperCase();
                        if (!clean) return;
                        const found = getTaiKhoan(clean);
                        onChangeItem?.(
                          idx,
                          {
                            ...item,
                            tk_no: found ? found.tk : clean,
                            ten_tk_no: found?.ten_tk || item.ten_tk_no || "",
                          },
                          "tk_no",
                        );
                      }}
                      className="h-9 font-mono font-bold text-primary-900"
                    />
                  ) : (
                    <div className="font-mono font-bold text-sm text-primary-900">
                      {item.tk_no || "—"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    TK Có
                  </label>
                  {editable ? (
                    <Autocomplete
                      inputRef={
                        !isDebitMain && idx === 0 && firstInputRef
                          ? (el) => {
                              (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                            }
                          : undefined
                      }
                      selectOnFocus
                      value={item.tk_co || ""}
                      fetcher={fetchTkOptions}
                      placeholder="TK Có"
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={30}
                      onChange={(v) =>
                        onChangeItem?.(idx, { ...item, tk_co: v }, "tk_co")
                      }
                      onSelect={(opt) => {
                        onSelectRow?.(idx);
                        onChangeItem?.(
                          idx,
                          { ...item, tk_co: opt.value, ten_tk_co: opt.hint || "" },
                          "tk_co",
                        );
                      }}
                      onBlur={() => {
                        const clean = (item.tk_co || "").trim().toUpperCase();
                        if (!clean) return;
                        const found = getTaiKhoan(clean);
                        onChangeItem?.(
                          idx,
                          {
                            ...item,
                            tk_co: found ? found.tk : clean,
                            ten_tk_co: found?.ten_tk || item.ten_tk_co || "",
                          },
                          "tk_co",
                        );
                      }}
                      className="h-9 font-mono font-bold text-primary-900"
                    />
                  ) : (
                    <div className="font-mono font-bold text-sm text-primary-900">
                      {item.tk_co || "—"}
                    </div>
                  )}
                </div>
              </div>

              {/* Số tiền */}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                  Số tiền ({isVnd ? "VND" : currency})
                </label>
                {editable ? (
                  <MobileAmountInput
                    value={item.tien_nt || 0}
                    isVnd={isVnd}
                    onFocus={() => onSelectRow?.(idx)}
                    onCommit={(val) =>
                      onChangeItem?.(
                        idx,
                        { ...item, tien_nt: val, tien: val },
                        "tien_nt",
                      )
                    }
                  />
                ) : (
                  <div className="font-mono font-bold text-base text-neutral-900 text-right">
                    {formatCurrency(item.tien_nt || item.tien || 0, currency)}
                  </div>
                )}
              </div>

              {/* Diễn giải */}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                  Diễn giải chi tiết
                </label>
                {editable ? (
                  <input
                    type="text"
                    value={item.dien_giai || ""}
                    onFocus={() => onSelectRow?.(idx)}
                    onChange={(e) =>
                      onChangeItem?.(
                        idx,
                        { ...item, dien_giai: e.target.value },
                        "dien_giai",
                      )
                    }
                    placeholder="Diễn giải dòng..."
                    className="erp-input h-9 w-full text-neutral-900"
                  />
                ) : (
                  <div className="text-xs text-neutral-700">
                    {item.dien_giai || "—"}
                  </div>
                )}
              </div>

              {/* Đối tượng & Bộ phận */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    Mã ĐT
                  </label>
                  {editable ? (
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_dt || ""}
                      placeholder="Mã ĐT"
                      fetcher={fetchDtOptions}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={30}
                      onChange={(v) =>
                        onChangeItem?.(idx, { ...item, ma_dt: v, ten_dt: "" }, "ma_dt")
                      }
                      onSelect={(opt) => {
                        onSelectRow?.(idx);
                        onChangeItem?.(
                          idx,
                          { ...item, ma_dt: opt.value, ten_dt: opt.hint || "" },
                          "ma_dt",
                        );
                      }}
                      onBlur={() => {
                        const clean = (item.ma_dt || "").trim().toUpperCase();
                        if (!clean) return;
                        const found = getCustomer(clean);
                        onChangeItem?.(
                          idx,
                          {
                            ...item,
                            ma_dt: found ? found.ma_dt : clean,
                            ten_dt: found?.ten_dt || item.ten_dt || "",
                          },
                          "ma_dt",
                        );
                      }}
                      className="h-9 font-mono uppercase"
                    />
                  ) : (
                    <div className="font-mono text-xs text-neutral-700">
                      {item.ma_dt || "—"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-0.5">
                    Bộ phận
                  </label>
                  {editable ? (
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_bp || ""}
                      placeholder="Mã BP"
                      fetcher={fetchBpOptions}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={30}
                      onChange={(v) =>
                        onChangeItem?.(idx, { ...item, ma_bp: v }, "ma_bp")
                      }
                      onSelect={(opt) => {
                        onSelectRow?.(idx);
                        onChangeItem?.(
                          idx,
                          { ...item, ma_bp: opt.value, ten_bp: opt.hint || "" },
                          "ma_bp",
                        );
                      }}
                      onBlur={() => {
                        const clean = (item.ma_bp || "").trim().toUpperCase();
                        if (!clean) return;
                        const found = getBoPhan(clean);
                        onChangeItem?.(
                          idx,
                          {
                            ...item,
                            ma_bp: found ? found.ma_bp : clean,
                            ten_bp: found?.ten_bp || item.ten_bp || "",
                          },
                          "ma_bp",
                        );
                      }}
                      className="h-9 font-mono uppercase"
                    />
                  ) : (
                    <div className="font-mono text-xs text-neutral-700">
                      {item.ma_bp || "—"}
                    </div>
                  )}
                </div>
              </div>
              {item.ten_dt && (
                <div className="text-[11px] text-neutral-500 truncate">
                  ĐT: <span className="text-neutral-700 font-medium">{item.ten_dt}</span>
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
          className="w-full h-11 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/60 hover:bg-primary-50 text-primary-800 font-semibold text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm dòng hạch toán</span>
        </button>
      )}
    </div>
  );
};
