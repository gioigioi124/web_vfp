import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CashVoucherModuleConfig } from "../../config/accountingModules";
import {
  CashVoucherDetail,
  CashVoucherFullDetail,
} from "../../types/cashVoucher";
import { formatCurrency, getTodayDate } from "../../lib/format";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../../lib/customerIndex";
import {
  initCatalogCache,
  searchTaiKhoan,
  getTaiKhoan,
} from "../../lib/catalogCache";
import { isModalOpen } from "../../lib/modalLock";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { VoucherFormHeaderBar } from "../voucher-form/VoucherFormHeaderBar";
import { VoucherFormFooter } from "../voucher-form/VoucherFormFooter";
import { useVoucherHistory } from "../voucher-form/useVoucherHistory";
import { clampField, CURRENT_USER, DRAFT_MAX_AGE_MS } from "../voucher-form/types";
import { CashDetailGrid, CashDetailGridHandle } from "./CashDetailGrid";
import { CopyPlus, Plus, Redo2, Undo2 } from "lucide-react";

interface CashDraftPayload {
  savedAt: number;
  ngayCt: string;
  soCt: string;
  maDt0: string;
  tenDt0: string;
  ongBa: string;
  diaChi: string;
  dienGiai0: string;
  ctDiKem: string;
  mainTk: string;
  items: CashVoucherDetail[];
}

function emptyCashRow(
  config: CashVoucherModuleConfig,
  mainTk: string,
  maDt?: string,
  dienGiai?: string,
): CashVoucherDetail {
  const isDebitMain = config.fixedSide === "debit";
  return {
    stt0: Math.random().toString(36).substring(2, 9),
    tk_no: isDebitMain ? mainTk : config.defaultOffsetAccount,
    tk_co: isDebitMain ? config.defaultOffsetAccount : mainTk,
    tien_nt: 0,
    tien: 0,
    dien_giai: dienGiai || "",
    ma_dt: maDt || "",
    ten_dt: "",
    ma_bp: "",
  };
}

interface CashVoucherFormProps {
  config: CashVoucherModuleConfig;
  stt?: string;
  voucher?: CashVoucherFullDetail | null;
  mode?: "M" | "S";
  suggestedSoCt?: string;
  onBack: () => void;
  onSaveSuccess: (stt: string, saved?: CashVoucherFullDetail) => void;
}

export const CashVoucherForm: React.FC<CashVoucherFormProps> = ({
  config,
  stt: sttProp,
  voucher,
  mode = voucher?.stt || sttProp ? "S" : "M",
  suggestedSoCt,
  onBack,
  onSaveSuccess,
}) => {
  const isCreate = mode === "M";
  const isEdit = mode === "S";
  const voucherStt = voucher?.stt || sttProp || "";
  const voucherCreator = isCreate ? CURRENT_USER : (voucher?.user_name || "").trim();

  const initialMainTk = useMemo(() => {
    if (voucher?.items?.length) {
      return config.fixedSide === "debit"
        ? voucher.items[0].tk_no || config.defaultMainAccount
        : voucher.items[0].tk_co || config.defaultMainAccount;
    }
    return config.defaultMainAccount;
  }, [voucher, config]);

  const [ngayCt, setNgayCt] = useState<string>(voucher?.ngay_ct || getTodayDate());
  const [soCt, setSoCt] = useState<string>(
    isCreate ? suggestedSoCt || "" : voucher?.so_ct || "",
  );
  const [maTte, setMaTte] = useState<string>(voucher?.ma_tte || "VND");
  const [tyGia, setTyGia] = useState<number>(voucher?.ty_gia || 1);
  const [mainTk, setMainTk] = useState<string>(initialMainTk);
  const [mainTkName, setMainTkName] = useState<string>("");
  const [maDt0, setMaDt0] = useState<string>(voucher?.ma_dt0 || "");
  const [tenDt0, setTenDt0] = useState<string>(voucher?.ten_dt0 || "");
  const [ongBa, setOngBa] = useState<string>(clampField(voucher?.ong_ba, 64));
  const [diaChi, setDiaChi] = useState<string>(clampField(voucher?.dia_chi, 64));
  const [dienGiai0, setDienGiai0] = useState<string>(
    clampField(voucher?.dien_giai0 ?? config.defaultDienGiai, 128),
  );
  const [ctDiKem, setCtDiKem] = useState<string>(
    clampField(voucher?.ct_di_kem, 128),
  );

  const [items, setItems] = useState<CashVoucherDetail[]>(() =>
    voucher?.items?.length
      ? voucher.items
      : [emptyCashRow(config, initialMainTk, "", config.defaultDienGiai)],
  );
  const itemsLatestRef = useRef(items);
  itemsLatestRef.current = items;

  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CashDraftPayload | null>(null);

  const userEditedSoCtRef = useRef(false);
  const autoSuggestedRef = useRef(isCreate ? suggestedSoCt || "" : "");
  const ngayCtInputRef = useRef<HTMLInputElement | null>(null);
  const soCtInputRef = useRef<HTMLInputElement | null>(null);
  const maDtInputRef = useRef<HTMLInputElement | null>(null);
  const ongBaInputRef = useRef<HTMLInputElement | null>(null);
  const dienGiaiInputRef = useRef<HTMLInputElement | null>(null);
  const firstGridInputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<CashDetailGridHandle | null>(null);

  const { historyCounts, pushUndoSnapshot, resetHistory, handleUndo, handleRedo } =
    useVoucherHistory<CashVoucherDetail>({
      itemsLatestRef,
      setItems,
      setActiveRowIndex,
    });

  // Sync when voucher prop arrives asynchronously on direct edit URL
  const hydratedSttRef = useRef<string>("");
  useEffect(() => {
    if (!voucher || voucher.stt === hydratedSttRef.current) return;
    hydratedSttRef.current = voucher.stt;
    setNgayCt(voucher.ngay_ct || getTodayDate());
    setSoCt(voucher.so_ct || "");
    setMaTte(voucher.ma_tte || "VND");
    setTyGia(voucher.ty_gia || 1);
    const derivedTk = voucher.items?.length
      ? config.fixedSide === "debit"
        ? voucher.items[0].tk_no || config.defaultMainAccount
        : voucher.items[0].tk_co || config.defaultMainAccount
      : config.defaultMainAccount;
    setMainTk(derivedTk);
    setMaDt0(voucher.ma_dt0 || "");
    setTenDt0(voucher.ten_dt0 || "");
    setOngBa(clampField(voucher.ong_ba, 64));
    setDiaChi(clampField(voucher.dia_chi, 64));
    setDienGiai0(clampField(voucher.dien_giai0, 128));
    setCtDiKem(clampField(voucher.ct_di_kem, 128));
    setItems(
      voucher.items?.length
        ? voucher.items
        : [emptyCashRow(config, derivedTk)],
    );
    resetHistory();
  }, [voucher, config, resetHistory]);

  // Fetch authoritative next So_Ct on create when ngayCt changes
  useEffect(() => {
    if (!isCreate || userEditedSoCtRef.current) return;
    let cancelled = false;
    const params = new URLSearchParams({
      ma_dvcs: "S1",
      ma_ct: config.maCt,
      ngay_ct: ngayCt,
    });
    fetch(`/api/cash-vouchers/next-number?${params.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const nextNum = body?.data?.so_ct;
        if (nextNum && !userEditedSoCtRef.current) {
          autoSuggestedRef.current = nextNum;
          setSoCt(nextNum);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCreate, config.maCt, ngayCt]);

  // Resolve mainTk display name
  useEffect(() => {
    void initCatalogCache().then(() => {
      const info = getTaiKhoan(mainTk);
      setMainTkName(info?.ten_tk || "");
    });
  }, [mainTk]);

  // Focus initial field
  useEffect(() => {
    window.setTimeout(() => {
      ngayCtInputRef.current?.focus();
    }, 30);
  }, []);

  // Draft key & dirty detection
  const draftKey = `draft:cash:${config.maCt}:${isCreate ? "new" : voucherStt}`;
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        ngayCt,
        soCt: isCreate && !userEditedSoCtRef.current ? "" : soCt,
        maDt0,
        ongBa,
        diaChi,
        dienGiai0,
        ctDiKem,
        mainTk,
        items: items.map((r) => [r.tk_no, r.tk_co, r.tien_nt, r.dien_giai, r.ma_dt, r.ma_bp]),
      }),
    [ngayCt, soCt, isCreate, maDt0, ongBa, diaChi, dienGiai0, ctDiKem, mainTk, items],
  );
  const savedSnapshotRef = useRef(currentSnapshot);
  useEffect(() => {
    if (voucher && voucher.stt === hydratedSttRef.current) {
      savedSnapshotRef.current = currentSnapshot;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher?.stt]);

  const isDirty = currentSnapshot !== savedSnapshotRef.current;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CashDraftPayload;
      if (!parsed || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS || !Array.isArray(parsed.items)) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      setPendingDraft(parsed);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  useEffect(() => {
    if (!isDirty || saving) return;
    const t = window.setTimeout(() => {
      try {
        const payload: CashDraftPayload = {
          savedAt: Date.now(),
          ngayCt,
          soCt,
          maDt0,
          tenDt0,
          ongBa,
          diaChi,
          dienGiai0,
          ctDiKem,
          mainTk,
          items,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => window.clearTimeout(t);
  }, [isDirty, saving, draftKey, ngayCt, soCt, maDt0, tenDt0, ongBa, diaChi, dienGiai0, ctDiKem, mainTk, items]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    setNgayCt(pendingDraft.ngayCt || getTodayDate());
    if (pendingDraft.soCt) setSoCt(pendingDraft.soCt);
    setMaDt0(pendingDraft.maDt0 || "");
    setTenDt0(pendingDraft.tenDt0 || "");
    setOngBa(pendingDraft.ongBa || "");
    setDiaChi(pendingDraft.diaChi || "");
    setDienGiai0(pendingDraft.dienGiai0 || "");
    setCtDiKem(pendingDraft.ctDiKem || "");
    setMainTk(pendingDraft.mainTk || config.defaultMainAccount);
    setItems(pendingDraft.items.length ? pendingDraft.items : [emptyCashRow(config, config.defaultMainAccount)]);
    setPendingDraft(null);
    clearDraft();
  }, [pendingDraft, config, clearDraft]);

  const fetchDtOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCustomerIndex();
    return searchCustomers(q);
  }, []);

  const fetchTkOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const handlePickCustomer = useCallback(
    async (code: string) => {
      const clean = code.trim().toUpperCase();
      setMaDt0(clean);
      if (!clean) {
        setTenDt0("");
        return;
      }
      await initCustomerIndex();
      const found = getCustomer(clean);
      if (found) {
        setMaDt0(found.ma_dt);
        setTenDt0(found.ten_dt || "");
        setOngBa(clampField(found.ong_ba || found.ten_dt, 64));
        setDiaChi(clampField(found.dia_chi, 64));
        setItems((prev) =>
          prev.map((row) =>
            !row.ma_dt ? { ...row, ma_dt: found.ma_dt, ten_dt: found.ten_dt || "" } : row,
          ),
        );
      }
    },
    [],
  );

  // Sync header mainTk onto rows when user changes mainTk
  const handleChangeMainTk = useCallback(
    (nextTk: string) => {
      const clean = nextTk.trim().toUpperCase();
      setMainTk(clean);
      if (!clean) return;
      setItems((prev) =>
        prev.map((row) =>
          config.fixedSide === "debit"
            ? { ...row, tk_no: clean }
            : { ...row, tk_co: clean },
        ),
      );
    },
    [config.fixedSide],
  );

  const handleChangeItem = useCallback(
    (idx: number, updated: CashVoucherDetail) => {
      setItems((prev) => {
        pushUndoSnapshot(prev);
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    },
    [pushUndoSnapshot],
  );

  const handleAddItem = useCallback(() => {
    setItems((prev) => {
      pushUndoSnapshot(prev);
      return [
        ...prev,
        emptyCashRow(config, mainTk, maDt0, dienGiai0),
      ];
    });
    window.setTimeout(() => {
      const nextIdx = itemsLatestRef.current.length - 1;
      setActiveRowIndex(Math.max(0, nextIdx));
      gridRef.current?.focusFirstCell(Math.max(0, nextIdx));
    }, 10);
  }, [pushUndoSnapshot, config, mainTk, maDt0, dienGiai0]);

  const handleDeleteItem = useCallback(
    (idx: number) => {
      setItems((prev) => {
        pushUndoSnapshot(prev);
        if (prev.length <= 1) {
          return [emptyCashRow(config, mainTk, maDt0, dienGiai0)];
        }
        return prev.filter((_, i) => i !== idx);
      });
      setActiveRowIndex((prevIdx) => Math.max(0, Math.min(prevIdx, itemsLatestRef.current.length - 2)));
    },
    [pushUndoSnapshot, config, mainTk, maDt0, dienGiai0],
  );

  const handleDuplicateRow = useCallback(
    (idx: number) => {
      setItems((prev) => {
        const src = prev[idx];
        if (!src) return prev;
        pushUndoSnapshot(prev);
        const copy: CashVoucherDetail = {
          ...src,
          stt0: Math.random().toString(36).substring(2, 9),
        };
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      });
    },
    [pushUndoSnapshot],
  );

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + (Number(it.tien_nt) || 0), 0),
    [items],
  );

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      clearDraft();
      onBack();
    }
  }, [isDirty, clearDraft, onBack]);

  const handleSave = useCallback(async () => {
    setErrorMessage(null);
    const validItems = itemsLatestRef.current.filter(
      (it) => Number(it.tien_nt) > 0 || (it.tk_no && it.tk_co),
    );
    if (!ngayCt) {
      setErrorMessage("Vui lòng chọn ngày chứng từ.");
      ngayCtInputRef.current?.focus();
      return;
    }
    if (!validItems.length || validItems.some((it) => Number(it.tien_nt) <= 0)) {
      setErrorMessage("Mỗi dòng hạch toán phải có TK Nợ, TK Có và Số tiền > 0.");
      return;
    }
    if (validItems.some((it) => !it.tk_no?.trim() || !it.tk_co?.trim())) {
      setErrorMessage("Vui lòng nhập đầy đủ TK Nợ và TK Có trên tất cả các dòng.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ma_dvcs: "S1",
        ma_ct: config.maCt,
        kieu_ct: " ",
        nh_ct: config.nhCt,
        ngay_ct: ngayCt,
        so_ct: soCt.trim(),
        ma_tte: maTte,
        ty_gia: tyGia || 1,
        ma_dt0: maDt0.trim().toUpperCase(),
        ong_ba: ongBa.trim(),
        dia_chi: diaChi.trim(),
        dien_giai0: dienGiai0.trim(),
        ct_di_kem: ctDiKem.trim(),
        user_name: voucherCreator || CURRENT_USER,
        custom_so_ct: userEditedSoCtRef.current,
        items: validItems.map((it, i) => ({
          ...it,
          stt_nv: i + 1,
          tien: Math.round((Number(it.tien_nt) || 0) * (tyGia || 1)),
          dien_giai: it.dien_giai?.trim() || dienGiai0.trim(),
          ma_dt: (it.ma_dt || maDt0 || "").trim().toUpperCase(),
        })),
      };

      const url = isEdit
        ? `/api/cash-vouchers/${encodeURIComponent(voucherStt)}`
        : "/api/cash-vouchers";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        const msg =
          body?.detail?.message ||
          body?.detail ||
          body?.message ||
          "Không thể lưu chứng từ.";
        setErrorMessage(String(msg));
        return;
      }

      const savedStt: string = body.data?.stt || voucherStt;
      const savedSoCt: string = body.data?.so_ct || soCt;
      clearDraft();

      const savedHeader: CashVoucherFullDetail = {
        stt: savedStt,
        ma_dvcs: "S1",
        ma_ct: config.maCt,
        nh_ct: config.nhCt,
        ngay_ct: ngayCt,
        so_ct: savedSoCt,
        ma_tte: maTte,
        ty_gia: tyGia,
        ma_dt0: maDt0.trim().toUpperCase(),
        ten_dt0: tenDt0,
        ong_ba: ongBa.trim(),
        dia_chi: diaChi.trim(),
        dien_giai0: dienGiai0.trim(),
        ct_di_kem: ctDiKem.trim(),
        ttien_nt: totalAmount,
        ttien_nt0: totalAmount,
        ttien: Math.round(totalAmount * (tyGia || 1)),
        ttien0: Math.round(totalAmount * (tyGia || 1)),
        posted: true,
        confirmed: true,
        user_name: voucherCreator || CURRENT_USER,
        tk_chinh: mainTk,
        tk_doi_ung:
          config.fixedSide === "debit"
            ? validItems[0]?.tk_co || ""
            : validItems[0]?.tk_no || "",
        items: validItems,
      };
      onSaveSuccess(savedStt, savedHeader);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi kết nối khi lưu chứng từ.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    ngayCt,
    soCt,
    maTte,
    tyGia,
    maDt0,
    tenDt0,
    ongBa,
    diaChi,
    dienGiai0,
    ctDiKem,
    mainTk,
    totalAmount,
    config,
    isEdit,
    voucherStt,
    voucherCreator,
    clearDraft,
    onSaveSuccess,
  ]);

  // Global form shortcuts (Ctrl+Enter, Esc, F8, Ctrl+Z/Y, Ctrl+Shift+D, Ctrl+/-)
  const shortcutCtxRef = useRef({
    handleSave,
    requestClose,
    handleDeleteItem,
    handleAddItem,
    handleDuplicateRow,
    handleUndo,
    handleRedo,
    activeRowIndex,
    saving,
  });
  shortcutCtxRef.current = {
    handleSave,
    requestClose,
    handleDeleteItem,
    handleAddItem,
    handleDuplicateRow,
    handleUndo,
    handleRedo,
    activeRowIndex,
    saving,
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen()) return;
      const ctx = shortcutCtxRef.current;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "Enter" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (!ctx.saving) void ctx.handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        ctx.requestClose();
      } else if (e.key === "F8") {
        e.preventDefault();
        ctx.handleDeleteItem(ctx.activeRowIndex);
      } else if (ctrl && e.shiftKey && (e.key.toLowerCase() === "d" || e.code === "KeyD")) {
        e.preventDefault();
        ctx.handleDuplicateRow(ctx.activeRowIndex);
      } else if (
        ctrl &&
        ((!e.shiftKey && e.key.toLowerCase() === "y") ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        ctx.handleRedo();
      } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        const inText =
          document.activeElement instanceof HTMLInputElement &&
          Boolean(document.activeElement.closest('[data-purpose="master-form"]'));
        if (!inText) {
          e.preventDefault();
          ctx.handleUndo();
        }
      } else if (ctrl && (e.code === "NumpadAdd" || e.key === "+" || e.key === "=")) {
        e.preventDefault();
        ctx.handleAddItem();
      } else if (ctrl && (e.code === "NumpadSubtract" || e.key === "-")) {
        e.preventDefault();
        ctx.handleDeleteItem(ctx.activeRowIndex);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="h-[100dvh] lg:h-full w-full flex flex-col bg-surface overflow-hidden">
      <VoucherFormHeaderBar
        isWarehouse={false}
        isCreate={isCreate}
        isEdit={isEdit}
        isDirty={isDirty}
        isDifferentCreator={false}
        hasVoucher={Boolean(voucher)}
        voucherCreator={voucherCreator}
        voucherStt={voucherStt}
        maDt={maDt0}
        pendingDraft={pendingDraft}
        draftItemCount={pendingDraft?.items?.length}
        errorMessage={errorMessage}
        customTitle={
          isCreate
            ? config.formTitleCreate
            : isEdit
              ? config.formTitleEdit
              : config.formTitleView
        }
        customSubtitle={config.subtitle}
        headerClassName={config.headerGradient}
        onRequestClose={requestClose}
        onRestoreDraft={handleRestoreDraft}
        onDismissDraft={() => {
          setPendingDraft(null);
          clearDraft();
        }}
        onClearError={() => setErrorMessage(null)}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden">
      {/* Master Section */}
      <section
        className="bg-neutral-50/90 border-b border-neutral-200 px-3 py-2 shrink-0"
        data-purpose="master-form"
      >
        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-x-2 md:gap-x-3 gap-y-2 md:gap-y-1.5 text-xs">
          {/* Row 1 */}
          <div className="col-span-6 md:col-span-3 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-20 shrink-0">Ngày CT:</label>
            <input
              ref={ngayCtInputRef}
              type="date"
              value={ngayCt}
              onChange={(e) => setNgayCt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  soCtInputRef.current?.focus();
                  soCtInputRef.current?.select();
                }
              }}
              className="erp-input flex-1 h-9 md:h-auto font-mono font-semibold"
            />
          </div>

          <div className="col-span-6 md:col-span-3 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-16 shrink-0">Số CT:</label>
            <input
              ref={soCtInputRef}
              type="text"
              value={soCt}
              onChange={(e) => {
                setSoCt(e.target.value);
                const clean = e.target.value.trim().toUpperCase();
                userEditedSoCtRef.current =
                  Boolean(clean) && clean !== autoSuggestedRef.current;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  maDtInputRef.current?.focus();
                  maDtInputRef.current?.select();
                }
              }}
              placeholder="Tự động..."
              className="erp-input flex-1 h-9 md:h-auto font-mono font-bold text-primary-800 uppercase"
            />
          </div>

          <div className="col-span-8 md:col-span-4 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-28 shrink-0">
              {config.mainAccountLabel}:
            </label>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-20 md:w-24 shrink-0">
                <Autocomplete
                  selectOnFocus
                  openOnTypeOnly
                  debounceMs={20}
                  dropdownMinWidth={360}
                  value={mainTk}
                  fetcher={fetchTkOptions}
                  onChange={(v) => setMainTk(v)}
                  onSelect={(opt) => {
                    handleChangeMainTk(opt.value);
                    setMainTkName(opt.hint || "");
                  }}
                  className="erp-input w-full h-9 md:h-auto font-mono font-bold text-emerald-800"
                />
              </div>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={mainTkName}
                placeholder="Tên tài khoản quỹ/NH"
                className="erp-input flex-1 h-9 md:h-auto min-w-0 bg-neutral-100 text-neutral-600 border-neutral-200 truncate"
              />
            </div>
          </div>

          <div className="col-span-4 md:col-span-2 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label shrink-0">Tiền tệ:</label>
            <div className="flex items-center gap-1.5">
              <select
                value={maTte}
                onChange={(e) => {
                  const next = e.target.value;
                  setMaTte(next);
                  if (next === "VND") setTyGia(1);
                }}
                className="erp-input w-full md:w-16 h-9 md:h-auto font-mono font-semibold bg-white"
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
              {maTte !== "VND" && (
                <input
                  type="number"
                  inputMode="decimal"
                  value={tyGia}
                  onChange={(e) => setTyGia(Number(e.target.value) || 1)}
                  className="erp-input w-16 md:w-20 h-9 md:h-auto font-mono text-right"
                  title="Tỷ giá quy đổi"
                />
              )}
            </div>
          </div>

          {/* Row 2: Đối tượng */}
          <div className="col-span-12 md:col-span-6 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-20 shrink-0">Đối tượng:</label>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-28 md:w-32 shrink-0">
                <Autocomplete
                  inputRef={maDtInputRef}
                  selectOnFocus
                  openOnTypeOnly
                  debounceMs={25}
                  dropdownMinWidth={560}
                  value={maDt0}
                  fetcher={fetchDtOptions}
                  onChange={(v) => {
                    setMaDt0(v);
                    if (!v.trim()) setTenDt0("");
                  }}
                  onSelect={(opt) => {
                    void handlePickCustomer(opt.value).then(() => {
                      ongBaInputRef.current?.focus();
                      ongBaInputRef.current?.select();
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.defaultPrevented) {
                      e.preventDefault();
                      void handlePickCustomer(e.currentTarget.value).then(() => {
                        ongBaInputRef.current?.focus();
                        ongBaInputRef.current?.select();
                      });
                    }
                  }}
                  placeholder="Mã KH/NCC"
                  className="erp-input w-full h-9 md:h-auto font-mono font-bold uppercase"
                />
              </div>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={tenDt0}
                placeholder="Tên đối tượng (tự động từ DmDt)"
                className="erp-input flex-1 h-9 md:h-auto min-w-0 bg-neutral-100 text-neutral-700 border-neutral-200 truncate"
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-28 shrink-0">{config.personLabel}:</label>
            <div className="grid grid-cols-2 md:flex md:flex-1 gap-1.5 min-w-0">
              <input
                ref={ongBaInputRef}
                type="text"
                value={ongBa}
                onChange={(e) => setOngBa(clampField(e.target.value, 64))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    dienGiaiInputRef.current?.focus();
                    dienGiaiInputRef.current?.select();
                  }
                }}
                placeholder={config.personLabel}
                className="erp-input flex-1 h-9 md:h-auto min-w-0"
              />
              <input
                type="text"
                value={diaChi}
                onChange={(e) => setDiaChi(clampField(e.target.value, 64))}
                placeholder="Địa chỉ"
                className="erp-input flex-1 h-9 md:h-auto min-w-0"
              />
            </div>
          </div>

          {/* Row 3: Diễn giải & Chứng từ kèm theo */}
          <div className="col-span-12 md:col-span-8 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-20 shrink-0">Diễn giải:</label>
            <input
              ref={dienGiaiInputRef}
              type="text"
              value={dienGiai0}
              onChange={(e) => setDienGiai0(clampField(e.target.value, 128))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  firstGridInputRef.current?.focus();
                  firstGridInputRef.current?.select();
                }
              }}
              placeholder="Nội dung thu / chi..."
              className="erp-input flex-1 h-9 md:h-auto"
            />
          </div>

          <div className="col-span-12 md:col-span-4 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
            <label className="erp-label md:w-24 shrink-0">Kèm theo:</label>
            <input
              type="text"
              value={ctDiKem}
              onChange={(e) => setCtDiKem(clampField(e.target.value, 128))}
              placeholder="Số chứng từ gốc kèm theo..."
              className="erp-input flex-1 h-9 md:h-auto"
            />
          </div>
        </div>
      </section>

      {/* Detail Toolbar */}
      <div className="bg-neutral-100 border-b border-neutral-300 px-3 py-1.5 md:py-1 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1 px-2.5 md:px-2 py-1 md:py-0.5 rounded bg-white hover:bg-primary-50 border border-neutral-300 hover:border-primary-300 text-neutral-700 hover:text-primary-800 font-medium cursor-pointer"
            title="Thêm dòng hạch toán (Ctrl +)"
          >
            <Plus className="w-3.5 h-3.5 text-primary-700" />
            <span>Thêm dòng</span>
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateRow(activeRowIndex)}
            className="inline-flex items-center gap-1 px-2.5 md:px-2 py-1 md:py-0.5 rounded bg-white hover:bg-primary-50 border border-neutral-300 text-neutral-700 font-medium cursor-pointer"
            title="Nhân đôi dòng đang chọn (Ctrl+Shift+D)"
          >
            <CopyPlus className="w-3.5 h-3.5 text-neutral-600" />
            <span>Nhân đôi</span>
          </button>
          <span className="h-4 w-px bg-neutral-300 mx-0.5" />
          <button
            type="button"
            disabled={historyCounts.undo === 0}
            onClick={handleUndo}
            className="p-1.5 md:p-1 rounded bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={historyCounts.redo === 0}
            onClick={handleRedo}
            className="p-1.5 md:p-1 rounded bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="hidden md:block text-[11px] text-neutral-500">
          {config.mainAccountLabel}: <b className="font-mono text-emerald-800">{mainTk}</b> ·{" "}
          {config.offsetAccountLabel} · Phím tắt: <kbd className="text-[9px] py-0">F8</kbd> Xóa dòng
        </div>
      </div>

      {/* Detail Grid */}
      <main className="flex-1 md:min-h-0 flex flex-col md:overflow-hidden bg-white">
        <CashDetailGrid
          items={items}
          config={config}
          currency={maTte}
          embedded
          variant="form"
          editable
          activeRowIndex={activeRowIndex}
          onSelectRow={setActiveRowIndex}
          onChangeItem={handleChangeItem}
          onDeleteItem={handleDeleteItem}
          onAddItem={handleAddItem}
          gridRef={gridRef}
          firstInputRef={firstGridInputRef}
        />
      </main>
      </div>

      <VoucherFormFooter
        isEditable
        isDifferentCreator={false}
        voucherCreator={voucherCreator}
        saving={saving}
        maTte={maTte}
        totals={{ ttien_nt: totalAmount, ttien_nt0: totalAmount }}
        hidePriceCalc
        customTotalsNode={
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-600 uppercase">
              Tổng cộng:
            </span>
            <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded px-2.5 py-0.5 shadow-sm">
              <span className="font-mono font-bold text-primary-900">
                {formatCurrency(totalAmount, maTte)}
              </span>
              <span className="font-bold text-primary-700">
                {maTte === "VND" ? "₫" : maTte}
              </span>
            </div>
          </div>
        }
        onSave={() => void handleSave()}
        onRequestClose={requestClose}
      />

      {/* Unsaved confirmation modal */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[80] bg-neutral-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 pt-safe pb-safe">
          <div className="bg-white rounded-md shadow-2xl border border-neutral-300 max-w-sm w-full overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 font-bold text-xs text-amber-900">
              Xác nhận thoát biểu mẫu
            </div>
            <div className="p-4 text-xs text-neutral-700">
              Chứng từ đang có thay đổi chưa lưu. Bạn có chắc muốn hủy bỏ và quay về danh sách?
            </div>
            <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="px-3 py-1.5 md:py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer"
              >
                Tiếp tục nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  clearDraft();
                  onBack();
                }}
                className="px-3 py-1.5 md:py-1 rounded bg-danger-600 hover:bg-danger-700 text-white text-xs font-semibold cursor-pointer"
              >
                Bỏ thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
