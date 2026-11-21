import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import {
  PriceListDetailItem,
  PriceListFullDetail,
  PriceListSavePayload,
} from "../../types/priceList";
import { getTodayDate } from "../../lib/format";
import { useModalLock } from "../../lib/modalLock";
import {
  getCustomer,
  initCustomerIndex,
  searchCustomers,
} from "../../lib/customerIndex";
import {
  getProductByCode,
  initProductIndex,
  searchProducts,
} from "../../lib/productIndex";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { VfpLookupCell, VfpOption } from "../ui/VfpLookupCell";
import { NumCell } from "../detail-grid/NumCell";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";

interface PriceListFormModalProps {
  isOpen: boolean;
  editingStt: string | null;
  onClose: () => void;
  onSaved: (stt: string, message: string) => void;
}

interface EditableRow extends PriceListDetailItem {
  _key: string;
}

let rowKeySeq = 0;
function makeEmptyRow(): EditableRow {
  rowKeySeq += 1;
  return {
    _key: `bg0-${rowKeySeq}`,
    ma_vt: "",
    ten_vt: "",
    dvt: "",
    gia: 0,
    ck: 0,
  };
}

export const PriceListFormModal: React.FC<PriceListFormModalProps> = ({
  isOpen,
  editingStt,
  onClose,
  onSaved,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLTableSectionElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState(0);

  const [ngayCt, setNgayCt] = useState(getTodayDate());
  const [ngayCt1, setNgayCt1] = useState(getTodayDate());
  const [ngayCt2, setNgayCt2] = useState("");
  const [soCt, setSoCt] = useState("");
  const [maDt, setMaDt] = useState("");
  const [tenDt, setTenDt] = useState("");
  const [maVm, setMaVm] = useState("");
  const [userName, setUserName] = useState("ADMIN");
  const [closed, setClosed] = useState("0");
  const [rows, setRows] = useState<EditableRow[]>([makeEmptyRow()]);

  const formGrid = useVirtualExcelGrid({
    totalRows: rows.length,
    scrollContainerRef: gridScrollRef,
    onSelectRow: setActiveRow,
  });

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    void initCustomerIndex();
    void initProductIndex();
    setError(null);

    if (!editingStt) {
      const today = getTodayDate();
      setNgayCt(today);
      setNgayCt1(today);
      setNgayCt2("");
      setSoCt("");
      setMaDt("");
      setTenDt("");
      setMaVm("");
      setUserName("ADMIN");
      setClosed("0");
      setRows([makeEmptyRow()]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/price-lists/${encodeURIComponent(editingStt)}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (!body?.success || !body?.data) {
          throw new Error(body?.detail || "Không tải được chi tiết bảng giá.");
        }
        const d: PriceListFullDetail = body.data;
        setNgayCt((d.ngay_ct || getTodayDate()).slice(0, 10));
        setNgayCt1((d.ngay_ct1 || d.ngay_ct || getTodayDate()).slice(0, 10));
        setNgayCt2(d.ngay_ct2 ? d.ngay_ct2.slice(0, 10) : "");
        setSoCt(d.so_ct || "");
        setMaDt(d.ma_dt || "");
        setTenDt(d.ten_dt || "");
        setMaVm(d.ma_vm || "");
        setUserName(d.user_name || "ADMIN");
        setClosed(d.closed === "1" ? "1" : "0");
        const mapped: EditableRow[] = (d.items || []).map((it) => {
          rowKeySeq += 1;
          return {
            _key: `bg0-${rowKeySeq}`,
            stt0: it.stt0,
            stt: it.stt,
            ma_vt: it.ma_vt,
            ten_vt: it.ten_vt || "",
            dvt: it.dvt || "",
            gia: Number(it.gia || 0),
            ck: Number(it.ck || 0),
          };
        });
        setRows(mapped.length > 0 ? mapped : [makeEmptyRow()]);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, editingStt]);

  const fetchCustomerOptions = useCallback(
    async (q: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(q, 30);
    },
    [],
  );

  const fetchProductOptions = useCallback(async (q: string): Promise<VfpOption[]> => {
    await initProductIndex();
    return searchProducts(q);
  }, []);

  const updateRow = useCallback((idx: number, patch: Partial<EditableRow>) => {
    setRows((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const handleProductCommit = useCallback(
    async (idx: number, raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code) {
        updateRow(idx, { ma_vt: "", ten_vt: "", dvt: "" });
        return;
      }
      const p = await getProductByCode(code);
      if (p) {
        updateRow(idx, {
          ma_vt: p.ma,
          ten_vt: p.ten || "",
          dvt: p.dvt_ban || p.dvt || "",
        });
      } else {
        updateRow(idx, { ma_vt: code });
      }
    },
    [updateRow],
  );

  const handleNavigate = useCallback(
    (rowIdx: number, colName: "ma_vt" | "gia" | "ck", dir: string) => {
      const cols: Array<"ma_vt" | "gia" | "ck"> = ["ma_vt", "gia", "ck"];
      const colIdx = cols.indexOf(colName);
      let nextRow = rowIdx;
      let nextCol = colIdx;

      if (dir === "next" || dir === "right") {
        if (colIdx < cols.length - 1) {
          nextCol += 1;
        } else {
          nextRow += 1;
          nextCol = 0;
        }
      } else if (dir === "prev" || dir === "left") {
        if (colIdx > 0) {
          nextCol -= 1;
        } else if (rowIdx > 0) {
          nextRow -= 1;
          nextCol = cols.length - 1;
        }
      } else if (dir === "down") {
        nextRow += 1;
      } else if (dir === "up") {
        nextRow = Math.max(0, rowIdx - 1);
      }

      if (nextRow >= rows.length) {
        setRows((prev) => [...prev, makeEmptyRow()]);
      }

      setActiveRow(nextRow);
      formGrid.scrollToRow(nextRow);
      requestAnimationFrame(() => {
        const rowEl = gridRef.current?.querySelector<HTMLTableRowElement>(
          `tr[data-row-idx="${nextRow}"]`,
        );
        if (!rowEl) return;
        const targetCol = cols[nextCol];
        const target =
          rowEl.querySelector<HTMLInputElement>(`input[data-field="${targetCol}"]`) ||
          rowEl.querySelector<HTMLInputElement>(`[data-nav-col="${targetCol}"] input`);
        target?.focus();
      });
    },
    [rows.length, formGrid],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSoCt = soCt.trim();
    if (!cleanSoCt) {
      setError("Vui lòng nhập Số chứng từ (Số bảng giá).");
      return;
    }

    const cleanItems = rows
      .map((r) => ({
        ma_vt: (r.ma_vt || "").trim().toUpperCase(),
        gia: Number(r.gia || 0),
        ck: Number(r.ck || 0),
      }))
      .filter((r) => r.ma_vt !== "");

    if (cleanItems.length === 0) {
      setError("Vui lòng nhập ít nhất 1 mặt hàng trong bảng chi tiết (BG0).");
      return;
    }

    // Gộp trùng mã VT giữ dòng cuối giống tool Python
    const dedupMap = new Map<string, { ma_vt: string; gia: number; ck: number }>();
    for (const it of cleanItems) {
      dedupMap.set(it.ma_vt, it);
    }

    const payload: PriceListSavePayload = {
      ma_dvcs: "S1",
      ngay_ct: ngayCt,
      so_ct: cleanSoCt,
      ma_dt: maDt.trim().toUpperCase(),
      ma_vm: maDt.trim() ? "" : maVm.trim().toUpperCase(),
      ma_tte: "VND",
      ty_gia: 1,
      ngay_ct1: ngayCt1 || ngayCt,
      ngay_ct2: ngayCt2 || null,
      closed,
      user_name: userName.trim().toUpperCase() || "ADMIN",
      items: Array.from(dedupMap.values()),
    };

    setSaving(true);
    try {
      const url = editingStt
        ? `/api/price-lists/${encodeURIComponent(editingStt)}`
        : "/api/price-lists";
      const method = editingStt ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.detail || "Không thể lưu bảng giá.");
      }
      onSaved(
        body.data?.stt || editingStt || "",
        editingStt
          ? `Đã cập nhật bảng giá ${cleanSoCt} (${payload.items.length} mặt hàng).`
          : `Đã tạo bảng giá mới ${cleanSoCt} (${payload.items.length} mặt hàng).`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu bảng giá.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-0 sm:p-4">
      <div
        ref={containerRef}
        className="w-full h-[100dvh] sm:h-auto max-w-5xl sm:max-h-[92vh] bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden pt-safe sm:pt-0"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-slate-900 truncate">
              {editingStt ? `Sửa Bảng Giá (${editingStt})` : "Tạo Bảng Giá Mới (BG / BG0)"}
            </h2>
            <p className="hidden sm:block text-[11px] text-slate-500">
              Quy tắc BG: Nhập Mã Khách hàng (Mã ĐT) hoặc Mã Vùng (Khu vực). Nếu chọn Mã KH, Mã Vùng tự động xóa để tránh xung đột.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 flex flex-col min-h-0">
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-[12px] max-h-[38vh] sm:max-h-none overflow-y-auto shrink-0">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Số bảng giá (Số CT) *</span>
              <input
                type="text"
                value={soCt}
                onChange={(e) => setSoCt(e.target.value)}
                className="erp-input h-8"
                placeholder="VD: BG01/26"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Ngày chứng từ *</span>
              <input
                type="date"
                value={ngayCt}
                onChange={(e) => {
                  setNgayCt(e.target.value);
                  if (!editingStt) setNgayCt1(e.target.value);
                }}
                className="erp-input h-8"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Hiệu lực từ (Ngay_Ct1)</span>
              <input
                type="date"
                value={ngayCt1}
                onChange={(e) => setNgayCt1(e.target.value)}
                className="erp-input h-8"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Hết hạn ngày (Ngay_Ct2)</span>
              <input
                type="date"
                value={ngayCt2}
                onChange={(e) => setNgayCt2(e.target.value)}
                className="erp-input h-8"
              />
            </label>

            <div className="flex flex-col gap-1 lg:col-span-2">
              <span className="font-medium text-slate-700">Khách hàng (Mã ĐT)</span>
              <Autocomplete
                value={maDt}
                onChange={(v) => {
                  const upper = v.toUpperCase();
                  setMaDt(upper);
                  if (upper.trim()) setMaVm("");
                  const found = getCustomer(upper);
                  setTenDt(found?.ten_dt || "");
                }}
                onSelect={(opt) => {
                  setMaDt(opt.value);
                  setTenDt(opt.hint || "");
                  setMaVm("");
                }}
                fetcher={fetchCustomerOptions}
                placeholder="Gõ mã hoặc tên khách hàng (để trống nếu dùng Mã Vùng)..."
                openOnTypeOnly
              />
              {tenDt && (
                <span className="text-[11px] text-slate-500 truncate">{tenDt}</span>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">Khu vực (Mã Vùng)</span>
              <input
                type="text"
                value={maVm}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setMaVm(upper);
                  if (upper.trim()) {
                    setMaDt("");
                    setTenDt("");
                  }
                }}
                className="erp-input h-8 uppercase"
                placeholder="VD: KV1, MN, B"
              />
            </label>

            <div className="flex items-end gap-3">
              <label className="flex-1 flex flex-col gap-1">
                <span className="font-medium text-slate-700">User</span>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.toUpperCase())}
                  className="erp-input h-8 uppercase"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded border border-slate-300 bg-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={closed === "1"}
                  onChange={(e) => setClosed(e.target.checked ? "1" : "0")}
                />
                <span className="text-[11.5px] font-medium text-slate-700">Đóng (Closed)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-800">
              {error}
            </div>
          )}

          {/* BG0 Grid */}
          <div
            ref={gridScrollRef}
            className="flex-1 min-h-0 overflow-auto p-2.5 sm:p-4 table-sticky-header"
          >
            {loading ? (
              <div className="py-12 text-center text-slate-500 text-[12px]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Đang tải chi tiết mặt hàng...
              </div>
            ) : (
              <table className="xl-grid xl-grid-no-hover dense-table mobile-table-sticky w-full border-collapse text-[12px]">
                <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
                  <tr>
                    <th className="w-10 text-center border-r border-neutral-200">#</th>
                    <th className="w-40 border-r border-neutral-200 font-mono">Mã hàng (Ma_Vt)</th>
                    <th className="min-w-[240px] border-r border-neutral-200">Tên vật tư / hàng hóa</th>
                    <th className="w-20 text-center border-r border-neutral-200">ĐVT</th>
                    <th className="w-36 text-right border-r border-neutral-200 font-mono">Đơn giá (Gia)</th>
                    <th className="w-24 text-right border-r border-neutral-200 font-mono">% CK</th>
                    <th className="w-12 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody ref={gridRef} className="divide-y divide-neutral-200">
                  {formGrid.topSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={7}
                        style={{ height: formGrid.topSpacerHeight, padding: 0, border: 0 }}
                      />
                    </tr>
                  )}
                  {rows
                    .slice(formGrid.startIndex, formGrid.endIndex)
                    .map((r, sliceIdx) => {
                      const idx = formGrid.startIndex + sliceIdx;
                      return (
                        <tr
                          key={r._key}
                          data-row-idx={idx}
                          data-vrow={idx}
                          onClick={() => setActiveRow(idx)}
                          className={idx === activeRow ? "xl-row-active" : undefined}
                        >
                          <td className="xl-rowhead font-mono">{idx + 1}</td>
                          <td className="xl-cell" data-nav-col="ma_vt">
                            <VfpLookupCell
                              value={r.ma_vt}
                              onFocusRow={() => setActiveRow(idx)}
                              onValueChange={(v) =>
                                updateRow(idx, { ma_vt: v.toUpperCase(), ten_vt: "", dvt: "" })
                              }
                              onPick={(opt) => {
                                void handleProductCommit(idx, opt.value);
                              }}
                              onCommit={(raw) => {
                                void handleProductCommit(idx, raw);
                              }}
                              fetcher={fetchProductOptions}
                              onNavigate={(dir) => handleNavigate(idx, "ma_vt", dir)}
                              dropdownMinWidth={380}
                              placeholder="Mã VT..."
                              className="xl-input font-mono font-bold text-primary-800"
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.ten_vt || ""}
                              rowIndex={idx}
                              className="xl-input text-neutral-900 grid-cell-input"
                              placeholder="Tên vật tư..."
                              isFormReadOnlyColumn
                              onSelectRow={setActiveRow}
                              onKeyDown={(e) => formGrid.handleCellKeyDown(e, idx)}
                              onCopy={formGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.dvt || ""}
                              rowIndex={idx}
                              className="xl-input text-center text-neutral-600 grid-cell-input"
                              placeholder=""
                              isFormReadOnlyColumn
                              onSelectRow={setActiveRow}
                              onKeyDown={(e) => formGrid.handleCellKeyDown(e, idx)}
                              onCopy={formGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-cell xl-amber">
                            <NumCell
                              value={r.gia}
                              compactDecimals
                              dataField="gia"
                              onFocus={() => setActiveRow(idx)}
                              onCommit={(v) => updateRow(idx, { gia: v })}
                              onNavigate={(dir) => handleNavigate(idx, "gia", dir)}
                              className="xl-input text-right font-mono font-bold text-neutral-900"
                            />
                          </td>
                          <td className="xl-cell">
                            <NumCell
                              value={r.ck}
                              compactDecimals
                              dataField="ck"
                              onFocus={() => setActiveRow(idx)}
                              onCommit={(v) => updateRow(idx, { ck: v })}
                              onNavigate={(dir) => handleNavigate(idx, "ck", dir)}
                              className="xl-input text-right font-mono text-neutral-800"
                            />
                          </td>
                          <td className="xl-ro text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setRows((prev) =>
                                  prev.length > 1
                                    ? prev.filter((_, i) => i !== idx)
                                    : [makeEmptyRow()],
                                )
                              }
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Xóa dòng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {formGrid.bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={7}
                        style={{ height: formGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, makeEmptyRow()])}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-medium text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng hàng hóa</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3 pb-safe border-t border-slate-200 bg-slate-50 shrink-0">
            <span className="text-[11.5px] text-slate-500">
              Tổng số dòng đang có mã hàng:{" "}
              <strong className="text-slate-800">
                {rows.filter((r) => r.ma_vt.trim() !== "").length}
              </strong>
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? "Đang lưu..." : "Lưu Bảng Giá"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
