import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import {
  DOC_MODULE_CONFIGS,
  DocModuleConfig,
  DocModuleKey,
  ModuleVoucherDetailItem,
  ModuleVoucherDetailResponse,
  ModuleVoucherSavePayload,
} from "../../types/moduleVoucher";
import {
  formatNumber0,
  formatNumber2,
  getTodayDate,
} from "../../lib/format";
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
import {
  getKho,
  getTaiKhoan,
  initCatalogCache,
  searchBoPhan,
  searchKho,
  searchTaiKhoan,
} from "../../lib/catalogCache";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { VfpLookupCell, VfpNavDir } from "../ui/VfpLookupCell";
import { NumCell } from "../detail-grid/NumCell";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { arrowDir } from "../ui/excelCell";

interface GenericVoucherFormModalProps {
  open: boolean;
  moduleKey: DocModuleKey;
  stt: string | null;
  onClose: () => void;
  onSaved: (saved: ModuleVoucherDetailResponse) => void;
}

function makeEmptyDetailRow(config: DocModuleConfig): ModuleVoucherDetailItem {
  return {
    stt0: Math.random().toString(36).slice(2, 10),
    ma_kho: config.detailKind === "gl" ? "" : "KHO1",
    ma_kho_n: config.detailKind === "transfer" ? "KHO2" : "",
    ma_vt: "",
    ten_vt: "",
    dvt: "",
    so_luong: config.detailKind === "gl" ? 0 : 1,
    gia_nt: 0,
    tien_nt: 0,
    tien_nt3: 0,
    no_co: "N",
    tk: config.defaultOffsetTk,
    tk_du: config.defaultMainTk,
    dien_giai: "",
    ma_dt: "",
    ma_bp: "",
    ma_km: "",
    ma_sp: "",
    ma_hd: "",
  };
}

export const GenericVoucherFormModal: React.FC<GenericVoucherFormModalProps> = ({
  open,
  moduleKey,
  stt,
  onClose,
  onSaved,
}) => {
  const config = DOC_MODULE_CONFIGS[moduleKey];
  const modalRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  useModalLock(open, modalRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ngayCt, setNgayCt] = useState(getTodayDate());
  const [soCt, setSoCt] = useState("");
  const [maCt, setMaCt] = useState(config.defaultMaCt);
  const [maDt, setMaDt] = useState("");
  const [tenDt, setTenDt] = useState("");
  const [ongBa, setOngBa] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [tk, setTk] = useState(config.defaultMainTk);
  const [dienGiai0, setDienGiai0] = useState("");
  const [maTte, setMaTte] = useState("VND");
  const [tyGia, setTyGia] = useState(1);

  // Tax fields (purchase receipts)
  const [soSeri0, setSoSeri0] = useState("");
  const [soCt0, setSoCt0] = useState("");
  const [ngayCt0, setNgayCt0] = useState("");
  const [maThue, setMaThue] = useState("10");
  const [thueGtgt, setThueGtgt] = useState(0);

  const [items, setItems] = useState<ModuleVoucherDetailItem[]>(() => [
    makeEmptyDetailRow(config),
  ]);
  const [activeRow, setActiveRow] = useState(0);

  useEffect(() => {
    if (!open) return;
    void initCustomerIndex();
    void initProductIndex();
    void initCatalogCache();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!stt) {
      setNgayCt(getTodayDate());
      setSoCt(`${config.defaultMaCt}-${Date.now().toString().slice(-5)}`);
      setMaCt(config.defaultMaCt);
      setMaDt("");
      setTenDt("");
      setOngBa("");
      setDiaChi("");
      setTk(config.defaultMainTk);
      setDienGiai0("");
      setMaTte("VND");
      setTyGia(1);
      setSoSeri0("");
      setSoCt0("");
      setNgayCt0("");
      setMaThue("10");
      setThueGtgt(0);
      setItems([makeEmptyDetailRow(config)]);
      setActiveRow(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/modules/${moduleKey}/vouchers/${encodeURIComponent(stt)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ModuleVoucherDetailResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setNgayCt(data.ngay_ct || getTodayDate());
        setSoCt(data.so_ct || "");
        setMaCt(data.ma_ct || config.defaultMaCt);
        setMaDt(data.ma_dt || "");
        setTenDt(data.ten_dt || "");
        setOngBa(data.ong_ba || "");
        setDiaChi(data.dia_chi || "");
        setTk(data.tk || config.defaultMainTk);
        setDienGiai0(data.dien_giai0 || "");
        setMaTte(data.ma_tte || "VND");
        setTyGia(data.ty_gia || 1);
        setSoSeri0(data.so_seri0 || "");
        setSoCt0(data.so_ct0 || "");
        setNgayCt0(data.ngay_ct0 || "");
        setMaThue(data.ma_thue || "10");
        setThueGtgt(data.thue_gtgt || 0);
        setItems(
          data.items && data.items.length > 0
            ? data.items.map((it) => ({
                ...it,
                stt0: it.stt0 || Math.random().toString(36).slice(2, 10),
              }))
            : [makeEmptyDetailRow(config)],
        );
        setActiveRow(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được chứng từ");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, moduleKey, stt, config]);

  const fetchCustomerOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCustomerIndex();
    return searchCustomers(q, 20);
  }, []);

  const fetchProductOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initProductIndex();
    return searchProducts(q);
  }, []);

  const fetchKhoOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchKho(q);
  }, []);

  const fetchTkOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const fetchBpOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchBoPhan(q);
  }, []);

  const updateItem = useCallback(
    (idx: number, patch: Partial<ModuleVoucherDetailItem>, recalcAmount = false) => {
      setItems((prev) =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          const next = { ...row, ...patch };
          if (recalcAmount && config.detailKind !== "gl") {
            next.tien_nt = Math.round((next.so_luong || 0) * (next.gia_nt || 0));
          }
          return next;
        }),
      );
    },
    [config.detailKind],
  );

  const handleAddRow = useCallback(() => {
    setItems((prev) => [...prev, makeEmptyDetailRow(config)]);
  }, [config]);

  const handleDeleteRow = useCallback((idx: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return [makeEmptyDetailRow(config)];
      return prev.filter((_, i) => i !== idx);
    });
  }, [config]);

  const navigateCell = useCallback(
    (dir: VfpNavDir, currentEl: HTMLInputElement, rowIdx: number) => {
      const table = tableRef.current;
      if (!table) return;
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const curTr = currentEl.closest("tr");
      if (!curTr) return;
      const getInputs = (tr: Element) =>
        Array.from(tr.querySelectorAll<HTMLInputElement>("input")).filter(
          (inp) => inp.dataset.readonly !== "true" && !inp.disabled,
        );

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
            setActiveRow(rowIdx + 1);
          }
        } else if (dir === "next") {
          handleAddRow();
          window.setTimeout(() => {
            const updatedRows = Array.from(table.querySelectorAll("tbody tr"));
            const target = updatedRows[rowIdx + 1];
            if (target) {
              const nextInputs = getInputs(target);
              nextInputs[0]?.focus();
              nextInputs[0]?.select();
              setActiveRow(rowIdx + 1);
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
            setActiveRow(rowIdx - 1);
          }
        }
      } else if (dir === "down" && rowIdx + 1 < rows.length) {
        const nextInputs = getInputs(rows[rowIdx + 1]);
        const target = nextInputs[Math.min(colIdx, nextInputs.length - 1)];
        if (target) {
          target.focus();
          target.select();
          setActiveRow(rowIdx + 1);
        }
      } else if (dir === "up" && rowIdx > 0) {
        const prevInputs = getInputs(rows[rowIdx - 1]);
        const target = prevInputs[Math.min(colIdx, prevInputs.length - 1)];
        if (target) {
          target.focus();
          target.select();
          setActiveRow(rowIdx - 1);
        }
      }
    },
    [handleAddRow],
  );

  const subTotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.tien_nt) || 0), 0),
    [items],
  );
  const grandTotal = useMemo(
    () => subTotal + (config.showTaxFields ? Number(thueGtgt) || 0 : 0),
    [subTotal, thueGtgt, config.showTaxFields],
  );

  const handleSave = useCallback(async () => {
    if (!soCt.trim()) {
      setError("Vui lòng nhập Số chứng từ.");
      return;
    }
    if (!ngayCt) {
      setError("Vui lòng chọn Ngày chứng từ.");
      return;
    }
    const cleanItems = items
      .filter((it) =>
        config.detailKind === "gl"
          ? Boolean(it.tk?.trim() || it.tk_du?.trim() || it.tien_nt || it.dien_giai?.trim())
          : Boolean(it.ma_vt?.trim() || it.ten_vt?.trim() || it.tien_nt),
      )
      .map((it, idx) => ({
        ...it,
        stt0: String(idx + 1).padStart(4, "0"),
      }));

    if (cleanItems.length === 0) {
      setError("Cần ít nhất 1 dòng chi tiết hợp lệ.");
      return;
    }

    const payload: ModuleVoucherSavePayload = {
      ma_dvcs: "S1",
      ma_ct: maCt.trim() || config.defaultMaCt,
      nh_ct: "1",
      ngay_ct: ngayCt,
      so_ct: soCt.trim(),
      ma_dt: maDt.trim(),
      ten_dt: tenDt.trim(),
      ong_ba: ongBa.trim(),
      dia_chi: diaChi.trim(),
      dien_giai0: dienGiai0.trim(),
      tk: tk.trim(),
      ma_tte: maTte || "VND",
      ty_gia: Number(tyGia) || 1,
      posted: true,
      user_name: "ADMIN",
      so_seri0: config.showTaxFields ? soSeri0.trim() : "",
      so_ct0: config.showTaxFields ? soCt0.trim() : "",
      ngay_ct0: config.showTaxFields && ngayCt0 ? ngayCt0 : null,
      ma_thue: config.showTaxFields ? maThue.trim() : "",
      thue_gtgt: config.showTaxFields ? Number(thueGtgt) || 0 : 0,
      items: cleanItems,
    };

    setSaving(true);
    setError(null);
    try {
      const url = stt
        ? `/api/modules/${moduleKey}/vouchers/${encodeURIComponent(stt)}`
        : `/api/modules/${moduleKey}/vouchers`;
      const res = await fetch(url, {
        method: stt ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as ModuleVoucherDetailResponse;
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu chứng từ");
    } finally {
      setSaving(false);
    }
  }, [
    soCt,
    ngayCt,
    items,
    config,
    maCt,
    maDt,
    tenDt,
    ongBa,
    diaChi,
    dienGiai0,
    tk,
    maTte,
    tyGia,
    soSeri0,
    soCt0,
    ngayCt0,
    maThue,
    thueGtgt,
    stt,
    moduleKey,
    onSaved,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleAddRow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, handleSave, handleAddRow]);

  if (!open) return null;

  const isVnd = (maTte || "VND").toUpperCase() === "VND";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3">
      <div
        ref={modalRef}
        className="w-full max-w-[1220px] max-h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${config.accentClass}`}
            >
              {config.shortCode}
            </span>
            <h2 className="text-[14px] font-semibold text-slate-900">
              {stt ? `Sửa ${config.title}` : `Thêm ${config.title}`}
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              ({config.sqlTables})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 gap-2.5">
          {error && (
            <div className="px-3 py-1.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[12px]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
              Đang tải dữ liệu chứng từ...
            </div>
          ) : (
            <>
              {/* Master Header Fields */}
              <div className="grid grid-cols-12 gap-x-3 gap-y-2 bg-slate-50/70 border border-slate-200 rounded-lg p-2.5 text-[12px]">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Ngày CT
                  </label>
                  <input
                    type="date"
                    data-autofocus
                    value={ngayCt}
                    onChange={(e) => setNgayCt(e.target.value)}
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Số CT
                  </label>
                  <input
                    type="text"
                    value={soCt}
                    onChange={(e) => setSoCt(e.target.value)}
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] font-mono font-semibold bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    TK chính
                  </label>
                  <Autocomplete
                    value={tk}
                    onChange={setTk}
                    fetcher={fetchTkOpts}
                    onSelect={(opt) => setTk(opt.value)}
                    openOnTypeOnly
                    hideIcon
                    className="h-7 text-[12px] font-mono"
                    placeholder={config.defaultMainTk}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Tiền tệ / Tỷ giá
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={maTte}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaTte(v);
                        if (v === "VND") setTyGia(1);
                      }}
                      className="w-16 h-7 px-1 border border-slate-300 rounded text-[12px] bg-white"
                    >
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      value={tyGia}
                      onChange={(e) => setTyGia(Number(e.target.value) || 1)}
                      className="flex-1 min-w-0 h-7 px-1.5 border border-slate-300 rounded text-[12px] text-right font-mono bg-white"
                    />
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    {config.partnerLabel}
                  </label>
                  <div className="flex gap-1.5">
                    <div className="w-28 shrink-0">
                      <Autocomplete
                        value={maDt}
                        onChange={(v) => setMaDt(v)}
                        fetcher={fetchCustomerOpts}
                        onSelect={(opt) => {
                          setMaDt(opt.value);
                          const c = getCustomer(opt.value);
                          setTenDt(c?.ten_dt || opt.hint || "");
                          if (c?.dia_chi) setDiaChi(c.dia_chi);
                        }}
                        openOnTypeOnly
                        hideIcon
                        className="h-7 text-[12px] font-mono"
                        placeholder="Mã ĐT..."
                      />
                    </div>
                    <input
                      type="text"
                      value={tenDt}
                      onChange={(e) => setTenDt(e.target.value)}
                      placeholder="Tên đối tượng..."
                      className="flex-1 min-w-0 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Người giao dịch / Địa chỉ
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={ongBa}
                      onChange={(e) => setOngBa(e.target.value)}
                      placeholder="Ông/Bà..."
                      className="w-32 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white"
                    />
                    <input
                      type="text"
                      value={diaChi}
                      onChange={(e) => setDiaChi(e.target.value)}
                      placeholder="Địa chỉ..."
                      className="flex-1 min-w-0 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white"
                    />
                  </div>
                </div>

                <div className={config.showTaxFields ? "col-span-12 sm:col-span-4" : "col-span-12 sm:col-span-8"}>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Diễn giải chung
                  </label>
                  <input
                    type="text"
                    value={dienGiai0}
                    onChange={(e) => setDienGiai0(e.target.value)}
                    placeholder="Nội dung chứng từ..."
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                {config.showTaxFields && (
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Hóa đơn VAT (Seri / Số / Ngày / Thuế)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={soSeri0}
                        onChange={(e) => setSoSeri0(e.target.value)}
                        placeholder="Ký hiệu"
                        className="w-20 h-7 px-1.5 border border-slate-300 rounded text-[11px] bg-white font-mono"
                      />
                      <input
                        type="text"
                        value={soCt0}
                        onChange={(e) => setSoCt0(e.target.value)}
                        placeholder="Số HĐ"
                        className="w-20 h-7 px-1.5 border border-slate-300 rounded text-[11px] bg-white font-mono"
                      />
                      <input
                        type="date"
                        value={ngayCt0}
                        onChange={(e) => setNgayCt0(e.target.value)}
                        className="w-28 h-7 px-1 border border-slate-300 rounded text-[11px] bg-white"
                      />
                      <input
                        type="number"
                        value={thueGtgt}
                        onChange={(e) => setThueGtgt(Number(e.target.value) || 0)}
                        placeholder="VAT"
                        className="flex-1 min-w-0 h-7 px-1.5 border border-slate-300 rounded text-[11px] text-right font-mono bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Grid Toolbar */}
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-slate-700">
                  Chi tiết chứng từ ({items.length} dòng)
                </span>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-[11px] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm dòng (F8)
                </button>
              </div>

              {/* Excel-style Detail Grid */}
              <div className="flex-1 min-h-[220px] overflow-auto border border-slate-300 rounded-lg table-sticky-header bg-white">
                <table
                  ref={tableRef}
                  className="w-full text-left dense-table border-collapse text-[12px] xl-grid"
                >
                  <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                    <tr>
                      <th className="w-10 text-center border-r border-neutral-200">#</th>
                      {config.detailKind !== "gl" && (
                        <>
                          <th className="w-24 border-r border-neutral-200">
                            {config.detailKind === "transfer" ? "Kho xuất" : "Kho"}
                          </th>
                          {config.detailKind === "transfer" && (
                            <th className="w-24 border-r border-neutral-200">Kho nhận</th>
                          )}
                          <th className="w-28 border-r border-neutral-200">Mã VT</th>
                          <th className="min-w-[180px] border-r border-neutral-200">Tên vật tư</th>
                          <th className="w-16 text-center border-r border-neutral-200">ĐVT</th>
                          <th className="w-24 text-right border-r border-neutral-200">Số lượng</th>
                          <th className="w-28 text-right border-r border-neutral-200">Đơn giá</th>
                        </>
                      )}
                      {config.detailKind === "gl" && (
                        <>
                          <th className="w-24 border-r border-neutral-200">TK Nợ</th>
                          <th className="w-24 border-r border-neutral-200">TK Có</th>
                        </>
                      )}
                      <th className="w-32 text-right border-r border-neutral-200">Thành tiền</th>
                      {config.detailKind !== "gl" && (
                        <>
                          <th className="w-20 border-r border-neutral-200">TK</th>
                          <th className="w-20 border-r border-neutral-200">TK ĐƯ</th>
                        </>
                      )}
                      {config.detailKind === "gl" && (
                        <>
                          <th className="w-28 border-r border-neutral-200">Mã ĐT</th>
                          <th className="w-24 border-r border-neutral-200">Bộ phận</th>
                        </>
                      )}
                      <th className="min-w-[160px] border-r border-neutral-200">Diễn giải</th>
                      <th className="w-10 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isActive = idx === activeRow;
                      return (
                        <tr
                          key={item.stt0 || `row-${idx}`}
                          onClick={() => setActiveRow(idx)}
                          className={isActive ? "xl-row-active" : undefined}
                        >
                          <td className="xl-rowhead font-mono">{idx + 1}</td>

                          {config.detailKind !== "gl" && (
                            <>
                              {/* Kho / Kho xuất */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_kho || ""}
                                  fetcher={fetchKhoOpts}
                                  placeholder="Kho"
                                  dropdownMinWidth={260}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_kho: v })}
                                  onPick={(opt) => updateItem(idx, { ma_kho: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getKho(raw);
                                    updateItem(idx, {
                                      ma_kho: found ? found.ma_kho : raw.trim().toUpperCase(),
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono uppercase"
                                />
                              </td>

                              {config.detailKind === "transfer" && (
                                <td className="xl-cell">
                                  <VfpLookupCell
                                    value={item.ma_kho_n || ""}
                                    fetcher={fetchKhoOpts}
                                    placeholder="Kho nhận"
                                    dropdownMinWidth={260}
                                    onFocusRow={() => setActiveRow(idx)}
                                    onValueChange={(v) => updateItem(idx, { ma_kho_n: v })}
                                    onPick={(opt) => updateItem(idx, { ma_kho_n: opt.value })}
                                    onCommit={(raw) => {
                                      const found = getKho(raw);
                                      updateItem(idx, {
                                        ma_kho_n: found ? found.ma_kho : raw.trim().toUpperCase(),
                                      });
                                    }}
                                    onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                    className="xl-input font-mono uppercase"
                                  />
                                </td>
                              )}

                              {/* Mã VT */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_vt || ""}
                                  fetcher={fetchProductOpts}
                                  placeholder="Mã VT..."
                                  dropdownMinWidth={380}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) =>
                                    updateItem(idx, { ma_vt: v, ten_vt: "" })
                                  }
                                  onPick={async (opt) => {
                                    const p = await getProductByCode(opt.value);
                                    updateItem(idx, {
                                      ma_vt: opt.value,
                                      ten_vt: p?.ten || opt.hint || "",
                                      dvt: p?.dvt || "",
                                      tk: p?.tk_vt || item.tk || config.defaultOffsetTk,
                                    });
                                  }}
                                  onCommit={async (raw) => {
                                    const clean = raw.trim().toUpperCase();
                                    const p = await getProductByCode(clean);
                                    updateItem(idx, {
                                      ma_vt: p ? p.ma : clean,
                                      ten_vt: p?.ten || item.ten_vt || "",
                                      dvt: p?.dvt || item.dvt || "",
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono font-semibold text-sky-900"
                                />
                              </td>

                              {/* Tên vật tư (RO) */}
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={item.ten_vt || ""}
                                  rowIndex={idx}
                                  isFormReadOnlyColumn
                                  className="xl-ro-input text-slate-800"
                                  onSelectRow={setActiveRow}
                                  onKeyDown={() => {}}
                                  onCopy={() => {}}
                                />
                              </td>

                              {/* ĐVT */}
                              <td className="xl-cell">
                                <input
                                  type="text"
                                  value={item.dvt || ""}
                                  onFocus={() => setActiveRow(idx)}
                                  onChange={(e) => updateItem(idx, { dvt: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    } else {
                                      const dir = arrowDir(e.key);
                                      if (dir === "up" || dir === "down") {
                                        e.preventDefault();
                                        navigateCell(dir, e.currentTarget, idx);
                                      }
                                    }
                                  }}
                                  className="xl-input text-center"
                                />
                              </td>

                              {/* Số lượng */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.so_luong || 0}
                                  compactDecimals
                                  dataField="so_luong"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { so_luong: v }, true)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono"
                                />
                              </td>

                              {/* Đơn giá */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.gia_nt || 0}
                                  noDecimals={isVnd}
                                  dataField="gia_nt"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { gia_nt: v }, true)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono"
                                />
                              </td>
                            </>
                          )}

                          {config.detailKind === "gl" && (
                            <>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk || ""}
                                  fetcher={fetchTkOpts}
                                  placeholder="TK Nợ"
                                  dropdownMinWidth={320}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk: v })}
                                  onPick={(opt) => updateItem(idx, { tk: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getTaiKhoan(raw);
                                    updateItem(idx, {
                                      tk: found ? found.tk : raw.trim().toUpperCase(),
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono font-semibold"
                                />
                              </td>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk_du || ""}
                                  fetcher={fetchTkOpts}
                                  placeholder="TK Có"
                                  dropdownMinWidth={320}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk_du: v })}
                                  onPick={(opt) => updateItem(idx, { tk_du: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getTaiKhoan(raw);
                                    updateItem(idx, {
                                      tk_du: found ? found.tk : raw.trim().toUpperCase(),
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono font-semibold"
                                />
                              </td>
                            </>
                          )}

                          {/* Thành tiền */}
                          <td className="xl-cell">
                            <NumCell
                              value={item.tien_nt || 0}
                              noDecimals={isVnd}
                              dataField="tien_nt"
                              onFocus={() => setActiveRow(idx)}
                              onCommit={(v) => updateItem(idx, { tien_nt: v }, false)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  navigateCell("next", e.currentTarget, idx);
                                }
                              }}
                              onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                              className="xl-input text-right font-mono font-bold text-slate-900"
                            />
                          </td>

                          {config.detailKind !== "gl" && (
                            <>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk || ""}
                                  fetcher={fetchTkOpts}
                                  dropdownMinWidth={300}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk: v })}
                                  onPick={(opt) => updateItem(idx, { tk: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { tk: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk_du || ""}
                                  fetcher={fetchTkOpts}
                                  dropdownMinWidth={300}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk_du: v })}
                                  onPick={(opt) => updateItem(idx, { tk_du: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { tk_du: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>
                            </>
                          )}

                          {config.detailKind === "gl" && (
                            <>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_dt || ""}
                                  fetcher={fetchCustomerOpts}
                                  dropdownMinWidth={340}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_dt: v })}
                                  onPick={(opt) => updateItem(idx, { ma_dt: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_dt: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_bp || ""}
                                  fetcher={fetchBpOpts}
                                  dropdownMinWidth={260}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_bp: v })}
                                  onPick={(opt) => updateItem(idx, { ma_bp: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_bp: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>
                            </>
                          )}

                          {/* Diễn giải */}
                          <td className="xl-cell">
                            <input
                              type="text"
                              value={item.dien_giai || ""}
                              onFocus={() => setActiveRow(idx)}
                              onChange={(e) => updateItem(idx, { dien_giai: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  navigateCell("next", e.currentTarget, idx);
                                } else {
                                  const dir = arrowDir(e.key);
                                  if (dir === "up" || dir === "down") {
                                    e.preventDefault();
                                    navigateCell(dir, e.currentTarget, idx);
                                  }
                                }
                              }}
                              placeholder="Diễn giải..."
                              className="xl-input"
                            />
                          </td>

                          <td className="text-center border-l border-neutral-200">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Xóa dòng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[12px]">
            <span className="text-slate-600">
              Tiền hàng:{" "}
              <strong className="font-mono text-slate-900">
                {isVnd ? formatNumber0(subTotal) : formatNumber2(subTotal)} {maTte}
              </strong>
            </span>
            {config.showTaxFields && (
              <span className="text-slate-600">
                Thuế GTGT:{" "}
                <strong className="font-mono text-slate-900">
                  {isVnd ? formatNumber0(thueGtgt) : formatNumber2(thueGtgt)}
                </strong>
              </span>
            )}
            <span className="text-slate-700">
              Tổng cộng:{" "}
              <strong className="font-mono text-[13px] text-sky-700">
                {isVnd ? formatNumber0(grandTotal) : formatNumber2(grandTotal)} {maTte}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-medium"
            >
              Đóng (Esc)
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Đang lưu..." : "Lưu chứng từ (Ctrl+S)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
