import React, { useState, useEffect, useRef, useCallback } from "react";
import { Autocomplete, AutocompleteOption } from "./ui/Autocomplete";
import { VoucherFilterParams } from "../types/voucher";
import { Filter, X, Search } from "lucide-react";
import { getTodayDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import { initCatalogCache, searchKho, getKho } from "../lib/catalogCache";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import {
  initProductIndex,
  searchProducts,
  getProductByCode,
} from "../lib/productIndex";

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filters: VoucherFilterParams;
  onApply: (newFilters: VoucherFilterParams) => void;
}

/**
 * Dialog tìm kiếm / lọc chứng từ (mở bằng phím F9).
 * - Khi mở tự động focus vào ô "Từ ngày".
 * - Kho hàng & Mã hàng hóa mặc định disable (chỉ bật khi tick chọn).
 * - Enter: chạy qua các ô đang bật rồi xuống thẳng nút Đồng ý (mặc định: Từ ngày -> Đến ngày -> Đối tượng -> Đồng ý).
 * - Phím mũi tên (↑/↓/←/→): di chuyển giữa các ô đang bật và nút Đồng ý.
 * - Ctrl+Enter: thực hiện tìm kiếm ngay lập tức từ bất kỳ ô nào.
 * - Esc: đóng dropdown gợi ý nếu đang mở, hoặc hủy và đóng dialog.
 */
export const FilterDialog: React.FC<FilterDialogProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
}) => {
  const [form, setForm] = useState<VoucherFilterParams>({ ...filters });
  const formRef = useRef<VoucherFilterParams>({ ...filters });
  const [enableKho, setEnableKho] = useState<boolean>(false);
  const [enableVt, setEnableVt] = useState<boolean>(false);
  const enableKhoRef = useRef<boolean>(false);
  const enableVtRef = useRef<boolean>(false);

  const [tenDt, setTenDt] = useState<string>("");
  const [tenKho, setTenKho] = useState<string>("");
  const [tenVt, setTenVt] = useState<string>("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ngayCt1Ref = useRef<HTMLInputElement | null>(null);
  const ngayCt2Ref = useRef<HTMLInputElement | null>(null);
  const maDtRef = useRef<HTMLInputElement | null>(null);
  const maKhoRef = useRef<HTMLInputElement | null>(null);
  const maVtRef = useRef<HTMLInputElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);

  useModalLock(isOpen, containerRef);

  const updateForm = useCallback(
    (
      updater:
        | Partial<VoucherFilterParams>
        | ((prev: VoucherFilterParams) => VoucherFilterParams),
    ) => {
      setForm((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
        formRef.current = next;
        return next;
      });
    },
    [],
  );

  // Đồng bộ dữ liệu form và nạp cache RAM khi mở dialog
  useEffect(() => {
    if (!isOpen) return;
    const initial = { ...filters };
    formRef.current = initial;
    setForm(initial);

    const hasKho = Boolean((initial.ma_kho || "").trim());
    const hasVt = Boolean((initial.ma_vt || "").trim());
    enableKhoRef.current = hasKho;
    enableVtRef.current = hasVt;
    setEnableKho(hasKho);
    setEnableVt(hasVt);

    let cancelled = false;

    void initCustomerIndex().then(() => {
      if (cancelled) return;
      const code = (initial.ma_dt || "").trim();
      setTenDt(code ? (getCustomer(code)?.ten_dt ?? "") : "");
    });

    void initCatalogCache().then(() => {
      if (cancelled) return;
      const code = (initial.ma_kho || "").trim();
      setTenKho(code ? (getKho(code)?.ten_kho ?? "") : "");
    });

    void initProductIndex().then(async () => {
      if (cancelled) return;
      const code = (initial.ma_vt || "").trim();
      if (!code) {
        setTenVt("");
        return;
      }
      const p = await getProductByCode(code);
      if (!cancelled) setTenVt(p?.ten ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, filters]);

  const fetchKhachHangOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(query);
    },
    [],
  );

  const fetchKhoOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchKho(query);
    },
    [],
  );

  const fetchVatTuOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initProductIndex();
      return searchProducts(query);
    },
    [],
  );

  const resolveCustomerValue = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return { code: "", name: "" };
    await initCustomerIndex();
    const exact = getCustomer(clean);
    if (exact) return { code: exact.ma_dt, name: exact.ten_dt || "" };
    const top = searchCustomers(clean, 1)[0];
    if (top) return { code: top.value, name: top.hint || "" };
    return { code: clean.toUpperCase(), name: "" };
  }, []);

  const resolveKhoValue = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return { code: "", name: "" };
    await initCatalogCache();
    const exact = getKho(clean);
    if (exact) return { code: exact.ma_kho, name: exact.ten_kho || "" };
    const top = searchKho(clean)[0];
    if (top) return { code: top.value, name: top.hint || "" };
    return { code: clean.toUpperCase(), name: "" };
  }, []);

  const resolveProductValue = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return { code: "", name: "" };
    await initProductIndex();
    const exact = await getProductByCode(clean);
    if (exact) return { code: exact.ma, name: exact.ten || "" };
    const top = (await searchProducts(clean))[0];
    if (top) return { code: top.value, name: top.hint || "" };
    return { code: clean.toUpperCase(), name: "" };
  }, []);

  const handleChange = (field: keyof VoucherFilterParams, value: string) => {
    updateForm((prev) => ({ ...prev, [field]: value }));
  };

  const setDateShortcut = (type: "today" | "all") => {
    if (type === "today") {
      const today = getTodayDate();
      updateForm({ ngay_ct1: today, ngay_ct2: today });
    } else {
      updateForm({ ngay_ct1: "", ngay_ct2: "" });
    }
  };

  const handleSubmit = useCallback(async () => {
    const current = { ...formRef.current };
    if (current.ma_dt?.trim()) {
      const resolved = await resolveCustomerValue(current.ma_dt);
      current.ma_dt = resolved.code;
    } else {
      current.ma_dt = "";
    }
    if (enableKhoRef.current && current.ma_kho?.trim()) {
      const resolved = await resolveKhoValue(current.ma_kho);
      current.ma_kho = resolved.code;
    } else {
      current.ma_kho = "";
    }
    if (enableVtRef.current && current.ma_vt?.trim()) {
      const resolved = await resolveProductValue(current.ma_vt);
      current.ma_vt = resolved.code;
    } else {
      current.ma_vt = "";
    }
    onApply(current);
    onClose();
  }, [
    onApply,
    onClose,
    resolveCustomerValue,
    resolveKhoValue,
    resolveProductValue,
  ]);

  // Phím tắt toàn dialog: Ctrl+Enter -> tìm ngay; Esc -> đóng dialog
  useEffect(() => {
    if (!isOpen) return;

    const onCaptureKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void handleSubmit();
      }
    };

    const onBubbleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onCaptureKeyDown, true);
    window.addEventListener("keydown", onBubbleKeyDown);
    return () => {
      window.removeEventListener("keydown", onCaptureKeyDown, true);
      window.removeEventListener("keydown", onBubbleKeyDown);
    };
  }, [isOpen, handleSubmit, onClose]);

  if (!isOpen) return null;

  const focusControl = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== "date") {
      window.setTimeout(() => {
        if (document.activeElement === el) el.select();
      }, 0);
    }
  };

  // Trả về danh sách các control đang bật theo đúng thứ tự trên form
  const getActiveControls = (): (HTMLElement | null)[] => {
    const list: (HTMLElement | null)[] = [
      ngayCt1Ref.current,
      ngayCt2Ref.current,
      maDtRef.current,
    ];
    if (enableKhoRef.current) list.push(maKhoRef.current);
    if (enableVtRef.current) list.push(maVtRef.current);
    list.push(submitBtnRef.current);
    return list;
  };

  const focusRelative = (currentEl: HTMLElement, delta: 1 | -1) => {
    const controls = getActiveControls();
    const pos = controls.indexOf(currentEl);
    if (pos === -1) return;
    const targetIdx = Math.max(0, Math.min(controls.length - 1, pos + delta));
    focusControl(controls[targetIdx]);
  };

  // Điều hướng bằng phím mũi tên ↑/↓/←/→ giữa các ô đang bật và nút Đồng ý
  const handleFieldArrowNav = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>,
  ) => {
    if (e.defaultPrevented) return;
    const el = e.currentTarget;
    const controls = getActiveControls();
    const pos = controls.indexOf(el);
    if (pos === -1) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      // Từ ngày (0) và Đến ngày (1) nằm cùng hàng -> xuống thẳng Đối tượng (2)
      const nextPos = pos <= 1 ? 2 : Math.min(pos + 1, controls.length - 1);
      focusControl(controls[nextPos]);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevPos = pos === 2 ? 0 : Math.max(pos - 1, 0);
      focusControl(controls[prevPos]);
      return;
    }

    if (e.key === "ArrowLeft") {
      const atStart =
        !(el instanceof HTMLInputElement) ||
        el.type === "date" ||
        (el.selectionStart === 0 && el.selectionEnd === 0) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atStart && pos > 0) {
        e.preventDefault();
        focusControl(controls[pos - 1]);
      }
    } else if (e.key === "ArrowRight") {
      const atEnd =
        !(el instanceof HTMLInputElement) ||
        el.type === "date" ||
        (el.selectionStart === el.value.length &&
          el.selectionEnd === el.value.length) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atEnd && pos < controls.length - 1) {
        e.preventDefault();
        focusControl(controls[pos + 1]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-neutral-900/45 backdrop-blur-[1px]">
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-white rounded-md shadow-2xl border border-neutral-400 flex flex-col overflow-hidden"
      >
        {/* Header đồng bộ font & phong cách ERP */}
        <header className="h-10 bg-primary-800 px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-white">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wide uppercase">
              Tìm kiếm đơn hàng (F9)
            </span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Đóng cửa sổ"
            onClick={onClose}
            className="text-neutral-200 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Form Fields */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="p-4 flex flex-col gap-3 bg-white"
        >
          {/* Row 1: Từ ngày - Đến ngày */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="filter-ngay-ct1"
                  className="erp-label text-neutral-700"
                >
                  Từ ngày:
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setDateShortcut("today")}
                  className="text-[11px] font-medium text-primary-700 hover:underline cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>
              <input
                ref={ngayCt1Ref}
                data-autofocus="true"
                id="filter-ngay-ct1"
                type="date"
                value={form.ngay_ct1 || ""}
                onChange={(e) => handleChange("ngay_ct1", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    focusControl(ngayCt2Ref.current);
                    return;
                  }
                  handleFieldArrowNav(e);
                }}
                className="erp-input w-full h-8 bg-white text-neutral-900 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="filter-ngay-ct2"
                  className="erp-label text-neutral-700"
                >
                  Đến ngày:
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setDateShortcut("all")}
                  className="text-[11px] font-medium text-neutral-600 hover:underline cursor-pointer"
                >
                  Tất cả ngày
                </button>
              </div>
              <input
                ref={ngayCt2Ref}
                id="filter-ngay-ct2"
                type="date"
                value={form.ngay_ct2 || ""}
                onChange={(e) => handleChange("ngay_ct2", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    focusControl(maDtRef.current);
                    return;
                  }
                  handleFieldArrowNav(e);
                }}
                className="erp-input w-full h-8 bg-white text-neutral-900 font-mono text-xs"
              />
            </div>
          </div>

          {/* Row 2: Mã đối tượng + Tên đối tượng (readonly) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="erp-label text-neutral-700">
                Mã đối tượng:
              </label>
              <span className="text-[11px] text-neutral-400">
                Gõ mã hoặc tên để chọn
              </span>
            </div>
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-5">
                <Autocomplete
                  inputRef={maDtRef}
                  selectOnFocus
                  openOnTypeOnly
                  debounceMs={30}
                  maxResults={30}
                  dropdownMinWidth={640}
                  placeholder="Nhập mã / tên KH..."
                  value={form.ma_dt || ""}
                  fetcher={fetchKhachHangOptionsLocal}
                  className="h-8 font-mono font-bold text-primary-800 uppercase"
                  onChange={(v) => {
                    handleChange("ma_dt", v);
                    if (!v.trim()) setTenDt("");
                  }}
                  onSelect={(opt) => {
                    handleChange("ma_dt", opt.value);
                    setTenDt(opt.hint || "");
                    window.setTimeout(() => {
                      if (maDtRef.current) focusRelative(maDtRef.current, 1);
                    }, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                      if (e.defaultPrevented) return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const raw = el.value;
                      void resolveCustomerValue(raw).then((res) => {
                        handleChange("ma_dt", res.code);
                        setTenDt(res.name);
                        focusRelative(el, 1);
                      });
                      return;
                    }
                    handleFieldArrowNav(e);
                  }}
                />
              </div>
              <div className="col-span-7">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={tenDt}
                  title={tenDt}
                  placeholder="Tên đối tượng"
                  className="erp-input w-full h-8 bg-neutral-100 text-neutral-700 border-neutral-200 cursor-text select-text truncate"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Kho hàng (mặc định disable, tick mới bật) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="erp-label text-neutral-700 inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  tabIndex={-1}
                  checked={enableKho}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    enableKhoRef.current = checked;
                    setEnableKho(checked);
                    if (checked) {
                      window.setTimeout(
                        () => focusControl(maKhoRef.current),
                        0,
                      );
                    } else {
                      handleChange("ma_kho", "");
                      setTenKho("");
                    }
                  }}
                  className="w-3.5 h-3.5 accent-primary-700 cursor-pointer"
                />
                <span>Lọc theo kho hàng:</span>
              </label>
              <span className="text-[11px] text-neutral-400">
                {enableKho ? "Gõ mã hoặc tên kho" : "Tích để lọc theo kho"}
              </span>
            </div>
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-5">
                <Autocomplete
                  inputRef={maKhoRef}
                  disabled={!enableKho}
                  selectOnFocus
                  openOnTypeOnly
                  debounceMs={30}
                  maxResults={30}
                  dropdownMinWidth={420}
                  placeholder="Nhập mã / tên kho..."
                  value={form.ma_kho || ""}
                  fetcher={fetchKhoOptionsLocal}
                  className={`h-8 font-mono font-bold uppercase ${
                    enableKho
                      ? "text-primary-800"
                      : "cursor-not-allowed opacity-75"
                  }`}
                  onChange={(v) => {
                    handleChange("ma_kho", v);
                    if (!v.trim()) setTenKho("");
                  }}
                  onSelect={(opt) => {
                    handleChange("ma_kho", opt.value);
                    setTenKho(opt.hint || "");
                    window.setTimeout(() => {
                      if (maKhoRef.current) focusRelative(maKhoRef.current, 1);
                    }, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                      if (e.defaultPrevented) return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const raw = el.value;
                      void resolveKhoValue(raw).then((res) => {
                        handleChange("ma_kho", res.code);
                        setTenKho(res.name);
                        focusRelative(el, 1);
                      });
                      return;
                    }
                    handleFieldArrowNav(e);
                  }}
                />
              </div>
              <div className="col-span-7">
                <input
                  type="text"
                  readOnly
                  disabled={!enableKho}
                  tabIndex={-1}
                  value={tenKho}
                  title={tenKho}
                  placeholder="Tên kho hàng"
                  className={`erp-input w-full h-8 bg-neutral-100 text-neutral-700 border-neutral-200 truncate ${
                    enableKho ? "cursor-text select-text" : "cursor-not-allowed opacity-75"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Mã hàng hóa (mặc định disable, tick mới bật) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="erp-label text-neutral-700 inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  tabIndex={-1}
                  checked={enableVt}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    enableVtRef.current = checked;
                    setEnableVt(checked);
                    if (checked) {
                      window.setTimeout(
                        () => focusControl(maVtRef.current),
                        0,
                      );
                    } else {
                      handleChange("ma_vt", "");
                      setTenVt("");
                    }
                  }}
                  className="w-3.5 h-3.5 accent-primary-700 cursor-pointer"
                />
                <span>Lọc theo mã hàng hóa:</span>
              </label>
              <span className="text-[11px] text-neutral-400">
                {enableVt
                  ? "Gõ mã hoặc tên để chọn"
                  : "Tích để lọc theo hàng hóa"}
              </span>
            </div>
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-5">
                <Autocomplete
                  inputRef={maVtRef}
                  disabled={!enableVt}
                  selectOnFocus
                  openOnTypeOnly
                  debounceMs={30}
                  maxResults={30}
                  dropdownMinWidth={560}
                  placeholder="Nhập mã / tên hàng..."
                  value={form.ma_vt || ""}
                  fetcher={fetchVatTuOptionsLocal}
                  className={`h-8 font-mono font-bold uppercase ${
                    enableVt
                      ? "text-primary-800"
                      : "cursor-not-allowed opacity-75"
                  }`}
                  onChange={(v) => {
                    handleChange("ma_vt", v);
                    if (!v.trim()) setTenVt("");
                  }}
                  onSelect={(opt) => {
                    handleChange("ma_vt", opt.value);
                    setTenVt(opt.hint || "");
                    window.setTimeout(
                      () => focusControl(submitBtnRef.current),
                      0,
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                      if (e.defaultPrevented) return;
                      e.preventDefault();
                      const raw = e.currentTarget.value;
                      void resolveProductValue(raw).then((res) => {
                        handleChange("ma_vt", res.code);
                        setTenVt(res.name);
                        focusControl(submitBtnRef.current);
                      });
                      return;
                    }
                    handleFieldArrowNav(e);
                  }}
                />
              </div>
              <div className="col-span-7">
                <input
                  type="text"
                  readOnly
                  disabled={!enableVt}
                  tabIndex={-1}
                  value={tenVt}
                  title={tenVt}
                  placeholder="Tên hàng hóa"
                  className={`erp-input w-full h-8 bg-neutral-100 text-neutral-700 border-neutral-200 truncate ${
                    enableVt ? "cursor-text select-text" : "cursor-not-allowed opacity-75"
                  }`}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <footer className="bg-neutral-50 px-4 py-2.5 flex items-center justify-end gap-2 border-t border-neutral-200 select-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="h-8 px-3 rounded bg-white text-neutral-700 hover:bg-neutral-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm border border-neutral-300 cursor-pointer"
          >
            <kbd className="text-[10px] py-0 px-1">Esc</kbd>
            <span>Hủy bỏ</span>
          </button>

          <button
            ref={submitBtnRef}
            type="button"
            onClick={() => void handleSubmit()}
            onKeyDown={(e) => handleFieldArrowNav(e)}
            className="h-8 px-4 rounded bg-primary-800 text-white hover:bg-primary-900 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-600 transition-colors flex items-center gap-2 text-xs font-semibold shadow-sm cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Đồng ý</span>
            <kbd className="bg-primary-900 border-primary-700 text-white text-[10px] py-0 px-1.5">
              Ctrl+Enter
            </kbd>
          </button>
        </footer>
      </div>
    </div>
  );
};
