import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DocModuleConfig,
  DocModuleKey,
  ModuleVoucherDetailItem,
} from "../../types/moduleVoucher";
import { VatTuItem } from "../../types/lookup";
import {
  formatCompactNumber,
  formatNumber0,
  formatNumber2,
  parseNumberInput,
} from "../../lib/format";
import { getKho, getTaiKhoan } from "../../lib/catalogCache";
import { getProductByCode } from "../../lib/productIndex";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";

export interface MobileModuleUnitOption {
  dvt: string;
  he_so: number;
}

interface MobileModuleDecimalInputProps {
  value: number;
  noDecimals?: boolean;
  onFocus?: () => void;
  onCommit: (val: number) => void;
  className?: string;
}

const MobileModuleDecimalInput: React.FC<MobileModuleDecimalInputProps> = ({
  value,
  noDecimals = false,
  onFocus,
  onCommit,
  className = "",
}) => {
  const formatDisplay = (v: number): string => {
    if (!v) return "0";
    return noDecimals ? String(Math.round(v)) : formatCompactNumber(v);
  };

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string>(() => formatDisplay(value));

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, noDecimals]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(0);
      return;
    }
    const parsed = parseNumberInput(trimmed);
    onCommit(noDecimals ? Math.round(parsed) : parsed);
  };

  return (
    <input
      type="text"
      inputMode={noDecimals ? "numeric" : "decimal"}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(noDecimals ? Math.round(value) : value) : "");
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
      className={`erp-input h-9 text-right font-mono tabular-nums bg-white ${className}`}
    />
  );
};

export interface MobileModuleDetailListProps {
  items: ModuleVoucherDetailItem[];
  moduleKey: DocModuleKey;
  config: DocModuleConfig;
  mainTk: string;
  isVnd: boolean;
  activeRow: number;
  vatTuMeta: Record<string, VatTuItem>;
  getUnitOptions: (v?: VatTuItem | null) => MobileModuleUnitOption[];
  detailOffsetTkLabel: string;
  onSelectRow: (idx: number) => void;
  onUpdateItem: (
    idx: number,
    patch: Partial<ModuleVoucherDetailItem>,
    recalcFromQtyPrice?: boolean,
  ) => void;
  onEnrichProductMeta: (idx: number, maVt: string) => Promise<void>;
  onAddRow: () => void;
  onDeleteRow: (idx: number) => void;
  fetchProductOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchKhoOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchTkOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchCustomerOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchBpOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchKmOpts: (q: string) => Promise<AutocompleteOption[]>;
  fetchSpOpts: (q: string) => Promise<AutocompleteOption[]>;
}

export const MobileModuleDetailList: React.FC<MobileModuleDetailListProps> = ({
  items,
  config,
  mainTk,
  isVnd,
  activeRow,
  vatTuMeta,
  getUnitOptions,
  detailOffsetTkLabel,
  onSelectRow,
  onUpdateItem,
  onEnrichProductMeta,
  onAddRow,
  onDeleteRow,
  fetchProductOpts,
  fetchKhoOpts,
  fetchTkOpts,
  fetchCustomerOpts,
  fetchBpOpts,
  fetchKmOpts,
  fetchSpOpts,
}) => {
  return (
    <div className="space-y-2.5 pb-1">
      {items.map((item, idx) => {
        const isActive = idx === activeRow;
        const vtInfo = vatTuMeta[(item.ma_vt || "").trim().toUpperCase()];
        const unitOpts = getUnitOptions(vtInfo);

        return (
          <div
            key={item.stt0 || `mob-row-${idx}`}
            onClick={() => onSelectRow(idx)}
            className={`rounded-xl border bg-white p-3 shadow-xs space-y-2.5 ${
              isActive ? "border-sky-500 ring-1 ring-sky-200" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                Dòng #{idx + 1}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRow(idx);
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                title="Xóa dòng"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {config.detailKind !== "gl" ? (
              <>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Mã vật tư
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_vt || ""}
                      fetcher={fetchProductOpts}
                      placeholder="Mã VT..."
                      openOnTypeOnly
                      debounceMs={30}
                      maxResults={30}
                      onChange={(v) => onUpdateItem(idx, { ma_vt: v, ten_vt: "" })}
                      onSelect={async (opt) => {
                        onSelectRow(idx);
                        const p = await getProductByCode(opt.value);
                        onUpdateItem(idx, {
                          ma_vt: opt.value,
                          ten_vt: p?.ten || opt.hint || "",
                          dvt: p?.dvt || "",
                          tk: item.tk || mainTk || config.defaultMainTk,
                          tk_du: p?.tk_vt || item.tk_du || config.defaultOffsetTk,
                        });
                        void onEnrichProductMeta(idx, opt.value);
                      }}
                      onBlur={async () => {
                        const clean = (item.ma_vt || "").trim().toUpperCase();
                        if (!clean || item.ten_vt) return;
                        const p = await getProductByCode(clean);
                        onUpdateItem(idx, {
                          ma_vt: p ? p.ma : clean,
                          ten_vt: p?.ten || item.ten_vt || "",
                          dvt: p?.dvt || item.dvt || "",
                          tk: item.tk || mainTk || config.defaultMainTk,
                          tk_du: p?.tk_vt || item.tk_du || config.defaultOffsetTk,
                        });
                        void onEnrichProductMeta(idx, p ? p.ma : clean);
                      }}
                      className="h-9 font-mono font-bold text-sky-900 uppercase"
                    />
                  </div>

                  <div className="col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      ĐVT
                    </label>
                    {unitOpts.length > 1 ? (
                      <select
                        value={item.dvt || ""}
                        onFocus={() => onSelectRow(idx)}
                        onChange={(e) => {
                          const chosen = unitOpts.find((u) => u.dvt === e.target.value);
                          onUpdateItem(
                            idx,
                            {
                              dvt: e.target.value,
                              he_so9: chosen?.he_so || 1,
                            },
                            false,
                          );
                        }}
                        className="erp-input h-9 w-full text-center bg-white"
                      >
                        {unitOpts.map((u) => (
                          <option key={u.dvt} value={u.dvt}>
                            {u.dvt} (x{u.he_so})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.dvt || ""}
                        onFocus={() => onSelectRow(idx)}
                        onChange={(e) => onUpdateItem(idx, { dvt: e.target.value })}
                        className="erp-input h-9 w-full text-center bg-white"
                      />
                    )}
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-800 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                  {item.ten_vt || (
                    <span className="text-slate-400 italic">Chưa có tên vật tư</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      {config.detailKind === "transfer" ? "Kho xuất" : "Kho"}
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_kho || ""}
                      fetcher={fetchKhoOpts}
                      placeholder="Kho..."
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { ma_kho: v })}
                      onSelect={(opt) => onUpdateItem(idx, { ma_kho: opt.value })}
                      onBlur={() => {
                        const raw = (item.ma_kho || "").trim();
                        if (!raw) return;
                        const found = getKho(raw);
                        onUpdateItem(idx, {
                          ma_kho: found ? found.ma_kho : raw.toUpperCase(),
                        });
                      }}
                      className="h-9 font-mono uppercase"
                    />
                  </div>

                  {config.detailKind === "transfer" ? (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Kho nhận
                      </label>
                      <Autocomplete
                        selectOnFocus
                        value={item.ma_kho_n || ""}
                        fetcher={fetchKhoOpts}
                        placeholder="Kho nhận..."
                        debounceMs={25}
                        maxResults={20}
                        onChange={(v) => onUpdateItem(idx, { ma_kho_n: v })}
                        onSelect={(opt) => onUpdateItem(idx, { ma_kho_n: opt.value })}
                        onBlur={() => {
                          const raw = (item.ma_kho_n || "").trim();
                          if (!raw) return;
                          const found = getKho(raw);
                          onUpdateItem(idx, {
                            ma_kho_n: found ? found.ma_kho : raw.toUpperCase(),
                          });
                        }}
                        className="h-9 font-mono uppercase"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Hệ số
                      </label>
                      <MobileModuleDecimalInput
                        value={item.he_so9 || 1}
                        onFocus={() => onSelectRow(idx)}
                        onCommit={(v) =>
                          onUpdateItem(idx, { he_so9: v > 0 ? v : 1 }, false)
                        }
                        className="text-slate-700"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Số lượng
                    </label>
                    <MobileModuleDecimalInput
                      value={item.so_luong9 || 0}
                      onFocus={() => onSelectRow(idx)}
                      onCommit={(v) => onUpdateItem(idx, { so_luong9: v }, true)}
                      className="font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Đơn giá
                    </label>
                    <MobileModuleDecimalInput
                      value={item.gia_nt9 || 0}
                      noDecimals={isVnd}
                      onFocus={() => onSelectRow(idx)}
                      onCommit={(v) => onUpdateItem(idx, { gia_nt9: v }, true)}
                      className="font-semibold text-blue-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Thành tiền
                    </label>
                    <MobileModuleDecimalInput
                      value={item.tien_nt9 || 0}
                      noDecimals={isVnd}
                      onFocus={() => onSelectRow(idx)}
                      onCommit={(v) => onUpdateItem(idx, { tien_nt9: v }, false)}
                      className="font-bold text-slate-900"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      {detailOffsetTkLabel}
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.tk_du || ""}
                      fetcher={fetchTkOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { tk_du: v })}
                      onSelect={(opt) => onUpdateItem(idx, { tk_du: opt.value })}
                      onBlur={() => {
                        const raw = (item.tk_du || "").trim();
                        if (!raw) return;
                        const found = getTaiKhoan(raw);
                        onUpdateItem(idx, { tk_du: found ? found.tk : raw });
                      }}
                      className="h-9 font-mono text-center"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      TK ĐƯ
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.tk || ""}
                      fetcher={fetchTkOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { tk: v })}
                      onSelect={(opt) => onUpdateItem(idx, { tk: opt.value })}
                      onBlur={() => {
                        const raw = (item.tk || "").trim();
                        if (!raw) return;
                        const found = getTaiKhoan(raw);
                        onUpdateItem(idx, { tk: found ? found.tk : raw });
                      }}
                      className="h-9 font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    Mã sản phẩm (SP)
                  </label>
                  <Autocomplete
                    selectOnFocus
                    value={item.ma_sp || ""}
                    fetcher={fetchSpOpts}
                    openOnTypeOnly
                    debounceMs={25}
                    maxResults={20}
                    onChange={(v) => onUpdateItem(idx, { ma_sp: v })}
                    onSelect={(opt) => onUpdateItem(idx, { ma_sp: opt.value })}
                    className="h-9 font-mono uppercase"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Nhóm NV
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.stt_nv || 1}
                      onFocus={() => onSelectRow(idx)}
                      onChange={(e) =>
                        onUpdateItem(idx, {
                          stt_nv: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="erp-input h-9 w-full text-center font-mono bg-white"
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Bên Nợ / Có
                    </label>
                    <select
                      value={(item.no_co || "N").toUpperCase()}
                      onFocus={() => onSelectRow(idx)}
                      onChange={(e) => onUpdateItem(idx, { no_co: e.target.value })}
                      className={`erp-input h-9 w-full text-center font-mono font-bold bg-white ${
                        (item.no_co || "N").toUpperCase() === "N"
                          ? "text-sky-700"
                          : "text-rose-700"
                      }`}
                    >
                      <option value="N">Nợ</option>
                      <option value="C">Có</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Tài khoản
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.tk || ""}
                      fetcher={fetchTkOpts}
                      placeholder="TK..."
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={30}
                      onChange={(v) => onUpdateItem(idx, { tk: v })}
                      onSelect={(opt) => onUpdateItem(idx, { tk: opt.value })}
                      onBlur={() => {
                        const raw = (item.tk || "").trim();
                        if (!raw) return;
                        const found = getTaiKhoan(raw);
                        onUpdateItem(idx, {
                          tk: found ? found.tk : raw.toUpperCase(),
                        });
                      }}
                      className="h-9 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    Phát sinh
                  </label>
                  <MobileModuleDecimalInput
                    value={item.tien_nt || 0}
                    noDecimals={isVnd}
                    onFocus={() => onSelectRow(idx)}
                    onCommit={(v) => onUpdateItem(idx, { tien_nt: v }, false)}
                    className="font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Mã ĐT
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_dt || ""}
                      fetcher={fetchCustomerOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { ma_dt: v })}
                      onSelect={(opt) => onUpdateItem(idx, { ma_dt: opt.value })}
                      className="h-9 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Bộ phận
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_bp || ""}
                      fetcher={fetchBpOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { ma_bp: v })}
                      onSelect={(opt) => onUpdateItem(idx, { ma_bp: opt.value })}
                      className="h-9 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Khoản mục
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_km || ""}
                      fetcher={fetchKmOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { ma_km: v })}
                      onSelect={(opt) => onUpdateItem(idx, { ma_km: opt.value })}
                      className="h-9 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Sản phẩm
                    </label>
                    <Autocomplete
                      selectOnFocus
                      value={item.ma_sp || ""}
                      fetcher={fetchSpOpts}
                      openOnTypeOnly
                      debounceMs={25}
                      maxResults={20}
                      onChange={(v) => onUpdateItem(idx, { ma_sp: v })}
                      onSelect={(opt) => onUpdateItem(idx, { ma_sp: opt.value })}
                      className="h-9 font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    Diễn giải
                  </label>
                  <input
                    type="text"
                    value={item.dien_giai || ""}
                    onFocus={() => onSelectRow(idx)}
                    onChange={(e) => onUpdateItem(idx, { dien_giai: e.target.value })}
                    placeholder="Diễn giải..."
                    className="erp-input h-9 w-full bg-white"
                  />
                </div>
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddRow}
        className="w-full h-11 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-50 text-sky-800 font-semibold text-sm inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        <span>Thêm dòng chi tiết</span>
      </button>

      {config.detailKind === "gl" && items.length > 0 && (
        <div className="text-[11px] text-slate-500 text-right font-mono">
          {items.length} bút toán ({isVnd ? formatNumber0(items.reduce((s, r) => s + (r.tien_nt || 0), 0)) : formatNumber2(items.reduce((s, r) => s + (r.tien_nt || 0), 0))})
        </div>
      )}
    </div>
  );
};
