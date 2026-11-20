import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { VoucherFullDetail, VoucherDetail } from "../types/voucher";
import { DetailGrid, DetailGridHandle } from "./DetailGrid";
import {
  formatCurrency,
  formatCompactNumber,
  parseNumberInput,
  getTodayDate,
} from "../lib/format";
import { AutocompleteOption } from "./ui/Autocomplete";
import { fetchPrice } from "../lib/lookups";
import { cachedFetch, peek } from "../lib/apiCache";
import {
  initCustomerIndex,
  isCustomerIndexReady,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import { initProductIndex } from "../lib/productIndex";
import {
  initCatalogCache,
  searchXe,
  searchTaiKhoan,
  getXe,
  getBoPhan,
} from "../lib/catalogCache";
import { calcLoai2Item, calcVoucherTotals } from "../lib/calc";
import { isModalOpen, useModalLock } from "../lib/modalLock";
import { PromotionCounter } from "./PromotionCounter";
import { CopyPlus, Redo2, Table, Undo2 } from "lucide-react";
import {
  buildVoucherSnapshot,
  clampField,
  CURRENT_USER,
  DebtDialogState,
  DebtInfoSummary,
  emptyDetailRow,
  InvalidVoucherField,
  VoucherFormProps,
} from "./voucher-form/types";
import { useVoucherHistory } from "./voucher-form/useVoucherHistory";
import { useVoucherDraft } from "./voucher-form/useVoucherDraft";
import { useVoucherShortcuts } from "./voucher-form/useVoucherShortcuts";
import { VoucherFormHeaderBar } from "./voucher-form/VoucherFormHeaderBar";
import { VoucherMasterSection } from "./voucher-form/VoucherMasterSection";
import { VoucherFormFooter } from "./voucher-form/VoucherFormFooter";
import { VoucherFormModals } from "./voucher-form/VoucherFormModals";

export const VoucherForm: React.FC<VoucherFormProps> = ({
  stt: sttProp,
  voucher,
  mode = voucher?.stt || sttProp ? "S" : "M",
  voucherMode = "sales",
  maCt: maCtProp,
  isSuspended = false,
  initialInherited,
  suggestedSoCt,
  onBack,
  onPrint,
  onViewDebt,
  onOpenPickup,
  onSaveSuccess,
  pickupPayload,
  onClearPickupPayload,
}) => {
  const isWarehouse = voucherMode === "warehouse";
  const apiDbMode: "sales" | "warehouse" = isWarehouse ? "warehouse" : "sales";
  const resolvedInitialMaCt: "X1" | "N5" =
    (
      maCtProp ||
      voucher?.ma_ct ||
      initialInherited?.ma_ct ||
      (voucherMode === "return" ? "N5" : "X1")
    )
      .trim()
      .toUpperCase() === "N5"
      ? "N5"
      : "X1";
  const isCreate = mode === "M";
  const isEdit = mode === "S";
  const isEditable = isCreate || isEdit;
  const voucherStt = voucher?.stt || sttProp || "";
  const voucherCreator = isCreate
    ? CURRENT_USER
    : (voucher?.user_name || "").trim();
  const isDifferentCreator =
    isEditable &&
    !isCreate &&
    Boolean(voucher) &&
    voucherCreator.toUpperCase() !== CURRENT_USER;

  // Refs for sequential focus & Enter navigation:
  // Ngày -> Số phiếu -> Mã đối tượng -> Diễn giải -> Mã xe -> Chọn phiếu xuất
  const ngayCtInputRef = useRef<HTMLInputElement | null>(null);
  const soCtInputRef = useRef<HTMLInputElement | null>(null);
  const maDtInputRef = useRef<HTMLInputElement | null>(null);
  const tenDtInputRef = useRef<HTMLInputElement | null>(null);
  const dienGiaiInputRef = useRef<HTMLInputElement | null>(null);
  const maXeInputRef = useRef<HTMLInputElement | null>(null);
  const pickupBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstMaVtRef = useRef<HTMLInputElement | null>(null);
  const detailGridRef = useRef<DetailGridHandle | null>(null);
  const initialSuggested = isCreate
    ? (suggestedSoCt || "").trim().toUpperCase()
    : "";
  const autoSuggestedSoCtRef = useRef<string>(initialSuggested);
  const userEditedSoCtRef = useRef<boolean>(false);
  const forceRefreshSoCtRef = useRef<boolean>(false);
  const [pickupSoCtTrigger, setPickupSoCtTrigger] = useState<number>(0);

  // Header State
  const [ngayCt, setNgayCt] = useState<string>(
    voucher?.ngay_ct || initialInherited?.ngay_ct || getTodayDate(),
  );
  const [soCt, setSoCt] = useState<string>(
    isCreate
      ? initialSuggested
      : voucher?.so_ct || initialInherited?.so_ct || "",
  );
  const [maDt, setMaDt] = useState<string>(
    voucher?.ma_dt || initialInherited?.ma_dt || "",
  );
  const [tenDt, setTenDt] = useState<string>(
    voucher?.ten_dt || initialInherited?.ten_dt || "",
  );
  const [ongBa, setOngBa] = useState<string>(
    clampField(
      voucher?.ong_ba ||
        initialInherited?.ong_ba ||
        voucher?.ten_dt ||
        initialInherited?.ten_dt,
      64,
    ),
  );
  const [diaChi, setDiaChi] = useState<string>(
    clampField(voucher?.dia_chi || initialInherited?.dia_chi, 64),
  );
  const [dienGiai0, setDienGiai0] = useState<string>(
    clampField(
      voucher?.dien_giai0 ??
        initialInherited?.dien_giai0 ??
        (isWarehouse
          ? resolvedInitialMaCt === "N5"
            ? "nhập lại"
            : "xuất bán"
          : resolvedInitialMaCt === "N5"
            ? "Hàng bán bị trả lại"
            : "Mua hàng"),
      128,
    ),
  );
  const [maBp, setMaBp] = useState<string>(
    voucher?.ma_bp || initialInherited?.ma_bp || "",
  );
  const [tenBp, setTenBp] = useState<string>(
    voucher?.ten_bp || initialInherited?.ten_bp || "",
  );
  const [maXe, setMaXe] = useState<string>(
    voucher?.ma_xe || initialInherited?.ma_xe || "",
  );
  const [tenXe, setTenXe] = useState<string>(
    voucher?.ten_xe || initialInherited?.ten_xe || "",
  );
  const [hanTt, setHanTt] = useState<number>(
    voucher?.han_tt ?? initialInherited?.han_tt ?? 30,
  );
  const [tyGia, setTyGia] = useState<number>(
    voucher?.ty_gia ?? initialInherited?.ty_gia ?? 1.0,
  );
  const [maTte, setMaTte] = useState<string>(
    voucher?.ma_tte || initialInherited?.ma_tte || "VND",
  );
  const [maNx, setMaNx] = useState<string>(
    voucher?.ma_nx || initialInherited?.ma_nx || "131",
  );
  const [tk2, setTk2] = useState<string>(
    voucher?.tk2 || initialInherited?.tk2 || "1311",
  );
  const [tk3, setTk3] = useState<string>(
    voucher?.tk3 || initialInherited?.tk3 || "33311",
  );
  const [thueGtgt, setThueGtgt] = useState<number>(
    voucher?.thue_gtgt ?? initialInherited?.thue_gtgt ?? 0,
  );
  const [loaiCk, setLoaiCk] = useState<string>(
    voucher?.loai_ck || initialInherited?.loai_ck || "2",
  );
  const [maCt, setMaCt] = useState<string>(resolvedInitialMaCt);
  const effectiveMaCt: "X1" | "N5" =
    (maCt || resolvedInitialMaCt).trim().toUpperCase() === "N5" ? "N5" : "X1";
  const isReturn = effectiveMaCt === "N5";
  const fixedTt: "C" | "K" = isReturn ? "K" : "C";
  const [maDtGtGt, setMaDtGtGt] = useState<string>(
    voucher?.ma_dtgtgt || initialInherited?.ma_dtgtgt || "",
  );
  // Mã vùng/khu vực của khách hàng (DmDt.Ma_Vm) — hiển thị trên header.
  const [maVm, setMaVm] = useState<string>("");
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [accountQuery, setAccountQuery] = useState<string>("");

  // Detail Items State
  const [items, setItems] = useState<VoucherDetail[]>(() => {
    const initialTt: "C" | "K" = resolvedInitialMaCt === "N5" ? "K" : "C";
    if (voucher?.items && voucher.items.length > 0) {
      return voucher.items.map((it) =>
        calcLoai2Item(
          { ...it, gia_tb_tt: initialTt },
          voucher.ty_gia || 1.0,
          "",
          voucher.ma_tte || "VND",
          initialTt,
        ),
      );
    }
    if (initialInherited?.items && initialInherited.items.length > 0) {
      return initialInherited.items.map((it) =>
        calcLoai2Item(
          { ...it, gia_tb_tt: initialTt },
          initialInherited.ty_gia || 1.0,
          "",
          initialInherited.ma_tte || "VND",
          initialTt,
        ),
      );
    }
    return [emptyDetailRow(initialTt === "K")];
  });

  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [highlightSpecs, setHighlightSpecs] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vfp_highlight_spec_ten_vt") !== "0";
    } catch {
      return true;
    }
  });
  const toggleHighlightSpecs = useCallback(() => {
    setHighlightSpecs((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vfp_highlight_spec_ten_vt", next ? "1" : "0");
      } catch {
        // Ignore storage errors (private mode / quota)
      }
      return next;
    });
  }, []);

  // Status & Validation States
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<InvalidVoucherField>(null);

  // Ref giữ danh sách `items` mới nhất đồng bộ
  const itemsLatestRef = useRef<VoucherDetail[]>(items);
  itemsLatestRef.current = items;
  const activeRowIndexRef = useRef<number>(activeRowIndex);
  activeRowIndexRef.current = activeRowIndex;

  // Undo/Redo history stacks (tối đa 20 bước)
  const {
    historyCounts,
    pushUndoSnapshot,
    resetHistory,
    handleUndo,
    handleRedo,
  } = useVoucherHistory({
    itemsLatestRef,
    setItems,
    setActiveRowIndex,
  });

  // Bảo vệ mất dữ liệu (Dirty tracking + bản nháp localStorage + xác nhận khi thoát)
  const tenDtEditedRef = useRef<boolean>(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState<boolean>(false);
  const discardDialogRef = useRef<HTMLDivElement | null>(null);

  const {
    pendingDraft,
    setPendingDraft,
    clearDraft,
    currentSnapshot,
    savedSnapshotRef,
    isDirty,
    isDirtyRef,
  } = useVoucherDraft({
    voucherMode,
    maCt: effectiveMaCt,
    isCreate,
    isEditable,
    voucherStt,
    saving,
    ngayCt,
    soCt,
    maDt,
    tenDt,
    dienGiai0,
    maXe,
    items,
    userEditedSoCtRef,
    tenDtEditedRef,
  });

  // Debt Info State (khớp CustomerDebtSummary từ /api/debt/customer)
  const [debtInfo, setDebtInfo] = useState<DebtInfoSummary | null>(null);
  const [debtDialog, setDebtDialog] = useState<DebtDialogState | null>(null);
  const debtDialogRef = useRef<HTMLDivElement | null>(null);
  const accountPickerRef = useRef<HTMLDivElement | null>(null);
  const accountInputRef = useRef<HTMLInputElement | null>(null);
  const [showPriceCalc, setShowPriceCalc] = useState<boolean>(false);
  const [calcInitialPrice, setCalcInitialPrice] = useState<number>(0);
  const beforeCalcFocusRef = useRef<HTMLElement | null>(null);
  useModalLock(!!debtDialog, debtDialogRef);
  useModalLock(showAccountPicker, accountPickerRef);
  useModalLock(showDiscardDialog, discardDialogRef);

  const requestClose = useCallback(() => {
    if (isEditable && isDirty && !saving) {
      setShowDiscardDialog(true);
      return;
    }
    onBack();
  }, [isEditable, isDirty, saving, onBack]);

  // Phím tắt Esc trong modal xác nhận bỏ thay đổi
  useEffect(() => {
    if (!showDiscardDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowDiscardDialog(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showDiscardDialog]);

  useEffect(() => {
    if (!showAccountPicker) return;
    setAccountQuery("");
    const timer = window.setTimeout(() => {
      accountInputRef.current?.focus();
    }, 30);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowAccountPicker(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [showAccountPicker]);

  // Đóng dialog cảnh báo và trả focus về trường phù hợp (Tên KH hoặc Mã KH).
  const closeDebtDialog = useCallback(() => {
    const target = debtDialog?.focusTarget ?? "tenDt";
    setDebtDialog(null);
    if (target === "none") return;
    const focusField = () => {
      const el =
        target === "maDt" ? maDtInputRef.current : tenDtInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    };
    setTimeout(focusField, 0);
    setTimeout(focusField, 35);
  }, [debtDialog]);

  useEffect(() => {
    if (!debtDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDebtDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [debtDialog, closeDebtDialog]);

  // 0a. Nạp danh mục khách hàng (RAM) + index vật tư (Web Worker) + danh mục nhỏ một lần khi mở form.
  useEffect(() => {
    initCustomerIndex();
    initProductIndex();
    initCatalogCache();
  }, []);

  const maDtRef = useRef<string>(maDt);
  maDtRef.current = maDt;
  const maDtValueRef = useRef<string>(maDt);
  const committedMaDtRef = useRef<string>(
    isCreate ? "" : (voucher?.ma_dt || "").trim().toUpperCase(),
  );
  useEffect(() => {
    maDtValueRef.current = maDt;
  }, [maDt]);

  const [maDtError, setMaDtError] = useState<string | null>(null);
  const lastWarnedMaDtRef = useRef<string>("");

  // Đồng bộ toàn bộ dữ liệu phiếu khi mở chế độ Sửa (mode="S") và prop `voucher` tải xong từ API/cache.
  const syncedVoucherKeyRef = useRef<string>(
    voucher?.stt ? `${voucher.stt}:${voucher.items?.length ?? 0}` : "",
  );
  useEffect(() => {
    if (isCreate || !voucher?.stt) return;
    const nextKey = `${voucher.stt}:${voucher.items?.length ?? 0}`;
    if (syncedVoucherKeyRef.current === nextKey) return;
    if (
      isDirtyRef.current &&
      syncedVoucherKeyRef.current.startsWith(`${voucher.stt}:`)
    ) {
      return;
    }
    syncedVoucherKeyRef.current = nextKey;

    const cleanDt = (voucher.ma_dt || "").trim().toUpperCase();
    const nextNgayCt = voucher.ngay_ct || getTodayDate();
    const nextSoCt = voucher.so_ct || "";
    const nextDienGiai0 = clampField(voucher.dien_giai0, 128);
    const nextMaXe = voucher.ma_xe || "";
    setNgayCt(nextNgayCt);
    setSoCt(nextSoCt);
    setMaDt(cleanDt);
    maDtValueRef.current = cleanDt;
    committedMaDtRef.current = cleanDt;
    lastWarnedMaDtRef.current = "";
    tenDtEditedRef.current = false;
    setMaDtError(null);
    setTenDt(voucher.ten_dt || "");
    setOngBa(clampField(voucher.ong_ba || voucher.ten_dt, 64));
    setDiaChi(clampField(voucher.dia_chi, 64));
    setDienGiai0(nextDienGiai0);
    setMaBp(voucher.ma_bp || "");
    setTenBp(voucher.ten_bp || "");
    setMaXe(nextMaXe);
    setTenXe(voucher.ten_xe || "");
    setHanTt(voucher.han_tt ?? 30);
    setTyGia(voucher.ty_gia ?? 1.0);
    setMaTte(voucher.ma_tte || "VND");
    setMaNx(voucher.ma_nx || "131");
    setTk2(voucher.tk2 || "1311");
    setTk3(voucher.tk3 || "33311");
    setThueGtgt(voucher.thue_gtgt ?? 0);
    setLoaiCk(voucher.loai_ck || "2");
    const syncedMaCt =
      (voucher.ma_ct || (voucherMode === "return" ? "N5" : "X1"))
        .trim()
        .toUpperCase() === "N5"
        ? "N5"
        : "X1";
    const rowTt: "C" | "K" = syncedMaCt === "N5" ? "K" : "C";
    setMaCt(syncedMaCt);
    setMaDtGtGt(voucher.ma_dtgtgt || "");

    const syncedItems =
      voucher.items && voucher.items.length > 0
        ? voucher.items.map((it) =>
            calcLoai2Item(
              { ...it, gia_tb_tt: rowTt },
              voucher.ty_gia || 1.0,
              "",
              voucher.ma_tte || "VND",
              rowTt,
            ),
          )
        : [emptyDetailRow(rowTt === "K")];
    if (voucher.items && voucher.items.length > 0) {
      setItems(syncedItems);
      setActiveRowIndex(0);
    }

    savedSnapshotRef.current = buildVoucherSnapshot({
      ngayCt: nextNgayCt,
      effectiveSoCt: nextSoCt,
      maDt: cleanDt,
      tenDt: voucher.ten_dt || "",
      includeTenDt: false,
      dienGiai0: nextDienGiai0,
      maXe: nextMaXe,
      items: syncedItems,
    });
    resetHistory();

    if (document.activeElement === maDtInputRef.current) {
      requestAnimationFrame(() => {
        if (document.activeElement === maDtInputRef.current) {
          maDtInputRef.current?.select();
        }
      });
    }
  }, [isCreate, voucher, voucherMode, isDirtyRef, savedSnapshotRef, resetHistory]);

  const initialFocusedKeyRef = useRef<string>("");
  const pendingFocusLastRowAfterPickupRef = useRef<boolean>(false);

  const applyPickupItems = useCallback(
    (
      calculatedItems: VoucherDetail[],
      pickupMaXe: string | undefined,
      strategy: "replace" | "append",
    ) => {
      setItems((prev) => {
        pushUndoSnapshot(prev);
        const nextItems =
          strategy === "append"
            ? [
                ...prev.filter((it) => Boolean(it.ma_vt?.trim())),
                ...calculatedItems,
              ]
            : calculatedItems;
        const safeNext =
          nextItems.length > 0 ? nextItems : [emptyDetailRow(isReturn)];
        setActiveRowIndex(safeNext.length - 1);
        return safeNext;
      });
      pendingFocusLastRowAfterPickupRef.current = true;
      initialFocusedKeyRef.current = isCreate ? "NEW" : voucherStt || "EDIT";
      if (pickupMaXe && (isReturn || !maXe.trim())) {
        setMaXe(pickupMaXe);
        setTenXe("");
      }
    },
    [pushUndoSnapshot, isCreate, isReturn, voucherStt, maXe],
  );

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    pushUndoSnapshot(items);
    if (pendingDraft.ngayCt) setNgayCt(pendingDraft.ngayCt);
    if (pendingDraft.soCt) {
      setSoCt(pendingDraft.soCt);
      if (isCreate) userEditedSoCtRef.current = true;
    }
    if (pendingDraft.maDt !== undefined) {
      const clean = pendingDraft.maDt.trim().toUpperCase();
      setMaDt(clean);
      maDtValueRef.current = clean;
      committedMaDtRef.current = clean;
    }
    if (pendingDraft.tenDt !== undefined) {
      tenDtEditedRef.current = true;
      setTenDt(pendingDraft.tenDt);
    }
    if (pendingDraft.dienGiai0 !== undefined) {
      setDienGiai0(clampField(pendingDraft.dienGiai0, 128));
    }
    if (pendingDraft.maXe !== undefined) {
      setMaXe(pendingDraft.maXe);
      setTenXe("");
    }
    if (Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0) {
      setItems(
        pendingDraft.items.map((it) =>
          calcLoai2Item(
            { ...it, gia_tb_tt: fixedTt },
            tyGia,
            "",
            maTte,
            fixedTt,
          ),
        ),
      );
      setActiveRowIndex(0);
    }
    setPendingDraft(null);
  }, [
    pendingDraft,
    pushUndoSnapshot,
    items,
    isCreate,
    fixedTt,
    tyGia,
    maTte,
    setPendingDraft,
  ]);

  // 0. Khi mở form Thêm mới (F2), Sao chép (Ctrl+F2) hoặc Sửa (F3 / Enter), tự động focus vào ô Mã đối tượng
  useEffect(() => {
    if (!isEditable || isSuspended) return;
    if (
      pendingFocusLastRowAfterPickupRef.current ||
      (pickupPayload && pickupPayload.items.length > 0)
    ) {
      return;
    }
    const focusKey = isCreate ? "NEW" : voucherStt;
    if (!focusKey || initialFocusedKeyRef.current === focusKey) return;
    const rafId = window.requestAnimationFrame(() => {
      if (
        isSuspended ||
        isModalOpen() ||
        pendingFocusLastRowAfterPickupRef.current
      )
        return;
      if (maDtInputRef.current) {
        initialFocusedKeyRef.current = focusKey;
        maDtInputRef.current.focus();
        maDtInputRef.current.select();
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isEditable, isSuspended, isCreate, voucherStt, pickupPayload]);

  // 1a. Reset cờ userEditedSoCtRef khi mở phiên tạo mới / đổi loại chứng từ
  useEffect(() => {
    userEditedSoCtRef.current = false;
    if (!isCreate) {
      autoSuggestedSoCtRef.current = "";
    }
  }, [isCreate, effectiveMaCt, apiDbMode]);

  // 1b. Tự động lấy số phiếu tiếp theo (X1: HD1001 theo tháng; N5: 001 theo ngày)
  useEffect(() => {
    if (!isCreate) return;
    let cancelled = false;
    const shouldForceRefresh = forceRefreshSoCtRef.current;
    forceRefreshSoCtRef.current = false;
    const fetchNextSoCt = async () => {
      try {
        const res = await fetch(
          `/api/vouchers/next-number?ma_ct=${encodeURIComponent(effectiveMaCt)}&ngay_ct=${encodeURIComponent(ngayCt)}&db_mode=${encodeURIComponent(apiDbMode)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const suggested = data?.data?.so_ct;
          if (!cancelled && suggested) {
            const cleanSuggested = String(suggested).trim().toUpperCase();
            const prevAuto = autoSuggestedSoCtRef.current;
            autoSuggestedSoCtRef.current = cleanSuggested;
            setSoCt((prev) => {
              const p = prev.trim().toUpperCase();
              if (
                shouldForceRefresh ||
                (!userEditedSoCtRef.current && (!p || p === prevAuto))
              ) {
                return suggested;
              }
              return prev;
            });
          }
        }
      } catch {
        // Fallback giữ nguyên nếu offline
      }
    };
    fetchNextSoCt();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, effectiveMaCt, apiDbMode, ngayCt, pickupSoCtTrigger]);

  // 2. Watch for pickup payload from PickupDialog:
  // - Mode thêm mới (isCreate): ghi đè toàn bộ các dòng hiện tại trên grid.
  // - Mode sửa (!isCreate): nối thêm các dòng mới chọn vào cuối grid.
  // - Với N5 (Nhập lại): đồng bộ ngược lại Mã đối tượng, Ngày chứng từ và tự chọn lại Số phiếu phù hợp.
  useEffect(() => {
    if (pickupPayload && pickupPayload.items.length > 0) {
      if (isReturn) {
        const pickedNgay = (pickupPayload.ngay_ct || "").trim().slice(0, 10);
        if (pickedNgay && /^\d{4}-\d{2}-\d{2}$/.test(pickedNgay)) {
          if (isCreate) {
            userEditedSoCtRef.current = false;
            forceRefreshSoCtRef.current = true;
            setPickupSoCtTrigger((v) => v + 1);
          }
          setNgayCt(pickedNgay);
        } else if (isCreate) {
          userEditedSoCtRef.current = false;
          forceRefreshSoCtRef.current = true;
          setPickupSoCtTrigger((v) => v + 1);
        }
        const pickedDt = (pickupPayload.ma_dt || "").trim().toUpperCase();
        if (pickedDt) {
          maDtValueRef.current = pickedDt;
          setMaDt(pickedDt);
          committedMaDtRef.current = "";
          void handleSelectCustomer(pickedDt).then(() => {
            if (pickupPayload.ma_xe) {
              setMaXe(pickupPayload.ma_xe);
              setTenXe("");
            }
          });
        }
      }
      const calculatedItems = pickupPayload.items.map((it) =>
        calcLoai2Item(
          { ...it, gia_tb_tt: fixedTt },
          tyGia,
          "",
          maTte,
          fixedTt,
        ),
      );
      applyPickupItems(
        calculatedItems,
        pickupPayload.ma_xe,
        isCreate ? "replace" : "append",
      );
      onClearPickupPayload?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupPayload, isCreate, isReturn, fixedTt, tyGia, maTte, applyPickupItems, onClearPickupPayload]);

  // Sau khi nạp các dòng từ PickupDialog vào grid, focus xuống dòng cuối cùng của grid hàng hóa.
  useEffect(() => {
    if (!pendingFocusLastRowAfterPickupRef.current || items.length === 0) return;
    const lastIdx = items.length - 1;
    const timer = window.setTimeout(() => {
      if (isModalOpen()) return;
      pendingFocusLastRowAfterPickupRef.current = false;
      setActiveRowIndex(lastIdx);
      detailGridRef.current?.focusMaVt(lastIdx);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [items]);

  // 3. Tự động lookup thông tin Ông/Bà, Địa chỉ, Bộ phận, Ma_Vm từ DmDt khi có maDt ban đầu.
  useEffect(() => {
    const cleanDt = (voucher?.ma_dt || maDt || "").trim().toUpperCase();
    if (!cleanDt) {
      setMaVm("");
      return;
    }
    let cancelled = false;
    const enrichFromMaDt = async () => {
      await initCustomerIndex();
      const cust = getCustomer(cleanDt);
      if (cancelled || !cust) return;
      if ((maDtRef.current || "").trim().toUpperCase() !== cleanDt) return;
      setMaVm(cust.ma_vm || "");
      if (isCreate) {
        if (cust.ten_dt) setTenDt(cust.ten_dt);
        const resolvedOngBa = cust.ong_ba || cust.doi_tac || cust.ten_dt || "";
        if (resolvedOngBa) setOngBa(clampField(resolvedOngBa, 64));
        if (cust.dia_chi !== undefined && !diaChi)
          setDiaChi(clampField(cust.dia_chi, 64));
        if (cust.ma_bp) setMaBp(cust.ma_bp);
        if (cust.ten_bp) setTenBp(cust.ten_bp);
        if (cust.ms_thue) setMaDtGtGt(cust.ms_thue);
      } else {
        if (cust.ten_dt) setTenDt((prev) => prev || cust.ten_dt || "");
        const resolvedOngBa = cust.ong_ba || cust.doi_tac || cust.ten_dt || "";
        if (resolvedOngBa)
          setOngBa((prev) => prev || clampField(resolvedOngBa, 64));
        if (cust.dia_chi)
          setDiaChi((prev) => prev || clampField(cust.dia_chi, 64));
        if (cust.ma_bp) setMaBp((prev) => prev || cust.ma_bp || "");
        if (cust.ten_bp) setTenBp((prev) => prev || cust.ten_bp || "");
        if (cust.ms_thue) setMaDtGtGt((prev) => prev || cust.ms_thue || "");
      }
    };
    enrichFromMaDt();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher?.stt]);

  // 4. Nếu đã có maBp nhưng tenBp đang trống -> tự động lookup tên bộ phận từ DmBp
  useEffect(() => {
    if (!maBp || !maBp.trim()) {
      setTenBp("");
      return;
    }
    if (tenBp && tenBp.trim()) return;
    let cancelled = false;
    initCatalogCache().then(() => {
      if (cancelled) return;
      const bp = getBoPhan(maBp);
      if (bp && bp.ten_bp) setTenBp(bp.ten_bp);
    });
    return () => {
      cancelled = true;
    };
  }, [maBp, tenBp]);

  // 5. Nếu đã có maXe nhưng tenXe đang trống -> tự động lookup biển số / tên xe từ DmXe
  useEffect(() => {
    if (!maXe || !maXe.trim()) {
      setTenXe("");
      return;
    }
    if (tenXe && tenXe.trim()) return;
    let cancelled = false;
    initCatalogCache().then(() => {
      if (cancelled) return;
      const xe = getXe(maXe);
      if (xe && xe.ten_xe) setTenXe(xe.ten_xe);
    });
    return () => {
      cancelled = true;
    };
  }, [maXe, tenXe]);

  // Nạp thông tin công nợ của khách hàng với SWR (0ms nếu đã có cache).
  const loadDebtInfo = useCallback(
    async (dt: string, showWarningDialog: boolean = false) => {
      if (isWarehouse) {
        setDebtInfo(null);
        return;
      }
      const cleanDt = dt.trim().toUpperCase();
      if (!cleanDt) {
        setDebtInfo(null);
        return;
      }
      const excludeStt = !isCreate && voucherStt ? voucherStt.trim() : "";
      const cacheKey = excludeStt
        ? `debt:${cleanDt}:${excludeStt}`
        : `debt:${cleanDt}`;

      const parseDebt = (d: any): DebtInfoSummary => ({
        du_no: d.du_no ?? 0,
        du_co: d.du_co ?? 0,
        du_cuoi: d.du_cuoi ?? 0,
        du_cuoi_kiem_tra: d.du_cuoi_kiem_tra ?? d.du_cuoi ?? 0,
        gioi_han: d.gioi_han ?? 0,
        toi_han: d.toi_han ?? 0,
        is_over_limit: !!d.is_over_limit,
        is_near_limit: !!d.is_near_limit,
        status_message: d.status_message ?? "",
      });

      const cached = peek<any>(cacheKey) || peek<any>(`debt:${cleanDt}`);
      if (cached?.success && cached.data) {
        setDebtInfo(parseDebt(cached.data));
      }

      try {
        const sttQuery = excludeStt
          ? `&stt=${encodeURIComponent(excludeStt)}`
          : "";
        const data = await cachedFetch<any>(
          cacheKey,
          `/api/debt/customer?ma_dt=${encodeURIComponent(cleanDt)}${sttQuery}`,
          { ttl: 15_000 },
        );
        if (data?.success && data.data) {
          if (maDtValueRef.current.trim().toUpperCase() !== cleanDt) return;
          const nextDebt = parseDebt(data.data);
          setDebtInfo(nextDebt);

          if (showWarningDialog) {
            const fmt = (n: number) => formatCurrency(n, "VND");
            const extraCheckLine =
              excludeStt &&
              nextDebt.du_cuoi_kiem_tra !== undefined &&
              nextDebt.du_cuoi_kiem_tra !== nextDebt.du_cuoi
                ? `Dư nợ kiểm tra (trừ đơn đang mở): ${fmt(nextDebt.du_cuoi_kiem_tra)}\n`
                : "";
            if (nextDebt.is_over_limit) {
              setDebtDialog({
                title: "Vượt quá hạn mức nợ",
                tone: "danger",
                message:
                  `Khách hàng ${cleanDt} vượt quá hạn mức nợ cho phép!\n\n` +
                  `Dư nợ hiện tại: ${fmt(nextDebt.du_cuoi)}\n` +
                  extraCheckLine +
                  `Giới hạn nợ: ${fmt(nextDebt.gioi_han)}\n\n` +
                  `Vui lòng kiểm tra lại trước khi lưu chứng từ.`,
              });
            } else if (nextDebt.is_near_limit) {
              setDebtDialog({
                title: "Đến hạn mức thanh toán",
                tone: "warning",
                message:
                  `Khách hàng ${cleanDt} đã chạm ngưỡng cảnh báo thanh toán.\n\n` +
                  `Dư nợ hiện tại: ${fmt(nextDebt.du_cuoi)}\n` +
                  extraCheckLine +
                  `Ngưỡng cảnh báo: ${fmt(nextDebt.toi_han)}`,
              });
            }
          }
        }
      } catch {
        if (!cached?.success) setDebtInfo(null);
      }
    },
    [isWarehouse, isCreate, voucherStt],
  );

  // Nạp số liệu hạn mức / dư nợ ban đầu khi mở form
  useEffect(() => {
    const cleanDt = (voucher?.ma_dt || maDt || "").trim();
    if (cleanDt) {
      loadDebtInfo(cleanDt, false);
    } else {
      setDebtInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher?.stt, voucherStt, isCreate, isWarehouse]);

  const handleSelectCustomer = async (selectedCode: string) => {
    const raw = selectedCode.trim().toUpperCase();
    if (!raw) {
      setMaDtError(null);
      setDebtInfo(null);
      committedMaDtRef.current = "";
      lastWarnedMaDtRef.current = "";
      return;
    }
    if (committedMaDtRef.current === raw) {
      return;
    }
    committedMaDtRef.current = raw;

    await initCustomerIndex();
    const cust = getCustomer(raw);
    if (maDtValueRef.current.trim().toUpperCase() !== raw) return;
    if (cust && cust.ma_dt) {
      const realCode = cust.ma_dt.trim().toUpperCase();
      committedMaDtRef.current = realCode;
      lastWarnedMaDtRef.current = "";
      maDtValueRef.current = realCode;
      setMaDt(realCode);
      setMaDtError(null);
      setTenDt(cust.ten_dt || "");
      setOngBa(clampField(cust.ong_ba || cust.doi_tac || cust.ten_dt, 64));
      setDiaChi(clampField(cust.dia_chi, 64));
      setMaBp(cust.ma_bp || "");
      setTenBp(cust.ten_bp || "");
      if (cust.han_tt !== undefined) setHanTt(cust.han_tt);
      if (cust.ma_xe && !maXe) {
        setMaXe(cust.ma_xe);
        setTenXe("");
      }
      setMaDtGtGt(cust.ms_thue || "");
      setMaVm(cust.ma_vm || "");
      loadDebtInfo(realCode, !isReturn);
    } else {
      committedMaDtRef.current = "";
      setMaDt(raw);
      setDebtInfo(null);
      const errMsg = `Mã khách hàng "${raw}" không tồn tại trong danh mục. Vui lòng chọn từ danh sách.`;
      setMaDtError(errMsg);
      if (lastWarnedMaDtRef.current !== raw) {
        lastWarnedMaDtRef.current = raw;
        setDebtDialog({
          title: "Không tìm thấy mã khách hàng",
          tone: "danger",
          message: errMsg,
          focusTarget: "maDt",
        });
      }
    }
  };

  const handleSelectXe = async (selectedMaXe: string, hintTenXe?: string) => {
    const cleanXe = (selectedMaXe || "").trim().toUpperCase();
    if (!cleanXe) {
      setMaXe("");
      setTenXe("");
      return;
    }
    if (hintTenXe) {
      setMaXe(cleanXe);
      setTenXe(hintTenXe);
      return;
    }
    await initCatalogCache();
    const cached = getXe(cleanXe);
    if (cached) {
      setMaXe(cached.ma_xe);
      setTenXe(cached.ten_xe || "");
      return;
    }
    const first = searchXe(cleanXe)[0];
    if (first) {
      setMaXe(first.value);
      setTenXe(first.hint || "");
      return;
    }
    setMaXe("");
    setTenXe("");
  };

  const fetchXeOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchXe(query);
    },
    [],
  );

  const fetchTaiKhoanOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchTaiKhoan(query);
    },
    [],
  );

  const fetchKhachHangOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(query);
    },
    [],
  );

  const handleLookupPrice = useCallback(
    async (maVt: string) => {
      const price = await fetchPrice(maVt, maDt, ngayCt);
      if (!price) return null;
      return {
        gia_nt9: price.gia,
        chiet_khau: price.chiet_khau,
        expired: price.expired,
      };
    },
    [maDt, ngayCt],
  );

  const handleItemChange = useCallback(
    (idx: number, updatedItem: VoucherDetail, fieldName?: string) => {
      const curr = itemsLatestRef.current;
      pushUndoSnapshot(curr);
      const calculated = calcLoai2Item(
        { ...updatedItem, gia_tb_tt: fixedTt },
        tyGia,
        fieldName || "",
        maTte,
        fixedTt,
      );
      const next = [...curr];
      next[idx] = calculated;
      itemsLatestRef.current = next;
      setItems(next);
      setInvalidField((prev) => (prev === "items" ? null : prev));
    },
    [fixedTt, tyGia, maTte, pushUndoSnapshot],
  );

  const handleDeleteItem = useCallback(
    (idx: number) => {
      const curr = itemsLatestRef.current;
      if (curr.length <= 1) return;
      pushUndoSnapshot(curr);
      const next = curr.filter((_, i) => i !== idx);
      const nextActive = Math.min(idx, next.length - 1);
      const colIdx = detailGridRef.current?.getFocusedColumnIndex();
      detailGridRef.current?.scheduleFocusCell(nextActive, colIdx);
      itemsLatestRef.current = next;
      setItems(next);
      setActiveRowIndex(nextActive);
    },
    [pushUndoSnapshot],
  );

  const handleAddItem = useCallback(() => {
    setErrorMessage(null);
    const curr = itemsLatestRef.current;
    const currActive = activeRowIndexRef.current;

    let emptyIdx = -1;
    if (
      currActive >= 0 &&
      currActive < curr.length &&
      (!curr[currActive]?.ma_vt || !curr[currActive].ma_vt.trim())
    ) {
      emptyIdx = currActive;
    } else {
      emptyIdx = curr.findIndex((it) => !it.ma_vt || !it.ma_vt.trim());
    }

    if (emptyIdx >= 0) {
      setActiveRowIndex(emptyIdx);
      detailGridRef.current?.focusMaVt(emptyIdx);
      return;
    }

    pushUndoSnapshot(curr);
    const next = [...curr, emptyDetailRow(isReturn)];
    itemsLatestRef.current = next;
    setItems(next);
    setActiveRowIndex(next.length - 1);
  }, [isReturn, pushUndoSnapshot]);

  const handleDuplicateRow = useCallback(
    (idx?: number) => {
      const curr = itemsLatestRef.current;
      if (curr.length === 0) return;
      const targetIdx = Math.max(
        0,
        Math.min(idx ?? activeRowIndexRef.current, curr.length - 1),
      );
      const source = curr[targetIdx];
      if (!source || !source.ma_vt?.trim()) return;
      pushUndoSnapshot(curr);
      const cloned: VoucherDetail = {
        ...source,
        stt: undefined,
        stt_px: undefined,
        stt0: Math.random().toString(36).substring(2, 9),
      };
      const insertAt = targetIdx + 1;
      const next = [
        ...curr.slice(0, insertAt),
        cloned,
        ...curr.slice(insertAt),
      ];
      itemsLatestRef.current = next;
      setItems(next);
      setActiveRowIndex(insertAt);
      const colIdx = detailGridRef.current?.getFocusedColumnIndex();
      detailGridRef.current?.scheduleFocusCell(insertAt, colIdx);
    },
    [pushUndoSnapshot],
  );

  const totals = useMemo(
    () => calcVoucherTotals(items, tyGia, thueGtgt, loaiCk),
    [items, tyGia, thueGtgt, loaiCk],
  );
  const totalQty = totals.totalQty;

  // Save handler (POST / PUT)
  const handleSave = async (bypassChecks: boolean = false) => {
    if (saving) return;
    if (isDifferentCreator && !bypassChecks) {
      setDebtDialog({
        title: "Không thể lưu phiếu của người khác",
        tone: "danger",
        focusTarget: "none",
        message: voucher
          ? `Phiếu này do "${voucherCreator || "(không rõ)"}" lập, không phải phiếu của ${CURRENT_USER}.\n\n` +
            `Không thể lưu bằng chế độ thường. Vui lòng nhấn Shift + Enter nếu muốn lưu (bỏ qua kiểm tra người lập và công nợ).`
          : "Đang tải thông tin người lập phiếu, vui lòng thử lại sau giây lát.",
      });
      return;
    }
    setErrorMessage(null);
    setInvalidField(null);

    if (!maDt.trim()) {
      setInvalidField("maDt");
      setErrorMessage("Vui lòng chọn Mã khách hàng / Đối tượng.");
      maDtInputRef.current?.focus();
      maDtInputRef.current?.select();
      return;
    }
    const cleanMaDt = maDt.trim().toUpperCase();
    await initCustomerIndex();
    if (maDtError || (isCustomerIndexReady() && !getCustomer(cleanMaDt))) {
      const errMsg =
        maDtError ||
        `Mã khách hàng "${cleanMaDt}" không tồn tại trong danh mục. Vui lòng chọn từ danh sách.`;
      setInvalidField("maDt");
      setMaDtError(errMsg);
      lastWarnedMaDtRef.current = cleanMaDt;
      setDebtDialog({
        title: "Không tìm thấy mã khách hàng",
        tone: "danger",
        message: errMsg,
        focusTarget: "maDt",
      });
      return;
    }
    if (!ngayCt.trim()) {
      setInvalidField("ngayCt");
      setErrorMessage("Vui lòng nhập Ngày hạch toán.");
      ngayCtInputRef.current?.focus();
      return;
    }
    if (!maNx.trim()) {
      setInvalidField("maNx");
      setErrorMessage("Vui lòng nhập Mã nhập xuất.");
      return;
    }

    const latestItems = itemsLatestRef.current;
    const validItems = latestItems.filter((it) => Boolean(it.ma_vt?.trim()));
    if (validItems.length === 0) {
      setInvalidField("items");
      setErrorMessage(
        "Chứng từ phải có ít nhất 1 dòng mặt hàng với Mã vật tư hợp lệ.",
      );
      setActiveRowIndex(0);
      detailGridRef.current?.focusMaVt(0);
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const origIdx = latestItems.indexOf(it);
      const focusIdx = origIdx >= 0 ? origIdx : i;
      if (!it.ma_kho?.trim()) {
        setInvalidField("items");
        setErrorMessage(`Dòng ${i + 1}: Chưa nhập Mã kho.`);
        setActiveRowIndex(focusIdx);
        detailGridRef.current?.focusMaVt(focusIdx);
        return;
      }
      if (Number(it.so_tam ?? 0) <= 0) {
        setInvalidField("items");
        setErrorMessage(`Dòng ${i + 1}: Số tấm phải lớn hơn 0.`);
        setActiveRowIndex(focusIdx);
        detailGridRef.current?.focusMaVt(focusIdx);
        return;
      }
      if (Number(it.so_luong9 ?? 0) <= 0) {
        setInvalidField("items");
        setErrorMessage(`Dòng ${i + 1}: Số lượng phải lớn hơn 0.`);
        setActiveRowIndex(focusIdx);
        detailGridRef.current?.focusMaVt(focusIdx);
        return;
      }
    }

    const saveTotals = calcVoucherTotals(validItems, tyGia, thueGtgt, loaiCk);

    setSaving(true);
    try {
      const currentSoCt = soCt.trim().toUpperCase();
      const origSoCt = (voucher?.so_ct || "").trim().toUpperCase();
      const isCustomSoCt =
        Boolean(currentSoCt) &&
        (isCreate
          ? userEditedSoCtRef.current ||
            (Boolean(autoSuggestedSoCtRef.current) &&
              currentSoCt !== autoSuggestedSoCtRef.current)
          : currentSoCt !== origSoCt);

      const normalizedItems: VoucherDetail[] = validItems.map((it) => ({
        ...it,
        ma_vt: (it.ma_vt || "").trim().toUpperCase(),
        ma_kho: (it.ma_kho || "K0101").trim().toUpperCase(),
        tk: it.tk || (isReturn ? (isWarehouse ? "155" : "1561") : isWarehouse ? "6322" : "632"),
        tk_du: it.tk_du || (isReturn ? (isWarehouse ? "6322" : "632") : isWarehouse ? "155" : "1561"),
        tk_du2: it.tk_du2 || (isReturn ? "5212" : isWarehouse ? "5112" : "5111"),
        tk_du4: it.tk_du4 || "521",
        gia_tb_tt: fixedTt,
      }));

      const payload = {
        ma_dvcs: "S1",
        ma_ct: effectiveMaCt,
        nh_ct: isReturn ? "1" : "2",
        ma_tte: maTte,
        ty_gia: tyGia,
        ngay_ct: ngayCt,
        so_ct: currentSoCt,
        ma_dt: maDt.trim().toUpperCase(),
        ten_dt: tenDt,
        ong_ba: ongBa,
        dia_chi: diaChi,
        dien_giai0: dienGiai0,
        ma_bp: maBp,
        ma_xe: maXe.trim().toUpperCase(),
        han_tt: hanTt,
        ma_nx: maNx,
        tk2: tk2,
        tk3: tk3,
        thue_gtgt: thueGtgt,
        loai_ck: loaiCk,
        ma_dtgtgt: maDtGtGt,
        ttien_nt: saveTotals.ttien_nt,
        ttien_nt4: saveTotals.ttien_nt4,
        ttien_nt2: saveTotals.ttien_nt2,
        ttien_nt3: saveTotals.ttien_nt3,
        ttien_nt0: saveTotals.ttien_nt0,
        ttien: saveTotals.ttien,
        ttien4: saveTotals.ttien4,
        ttien2: saveTotals.ttien2,
        ttien3: saveTotals.ttien3,
        ttien0: saveTotals.ttien0,
        user_name: isCreate ? CURRENT_USER : (voucher?.user_name ?? ""),
        skip_debt_check: bypassChecks || isReturn,
        custom_so_ct: isCustomSoCt,
        items: normalizedItems,
      };

      const url = isCreate
        ? `/api/vouchers?db_mode=${encodeURIComponent(apiDbMode)}`
        : `/api/vouchers/${encodeURIComponent(voucherStt)}?db_mode=${encodeURIComponent(apiDbMode)}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg =
          data?.detail?.message || data?.message || "Lỗi khi lưu chứng từ.";
        if (/hạn mức nợ|gioi han no|vượt quá hạn mức/i.test(msg)) {
          setDebtDialog({
            title: "Vượt quá hạn mức nợ",
            tone: "danger",
            message: msg,
          });
        } else {
          setErrorMessage(msg);
        }
        return;
      }

      const savedStt: string = data.data?.stt || voucherStt;
      const savedSoCt: string = data.data?.so_ct || currentSoCt;
      if (savedSoCt) {
        setSoCt(savedSoCt);
      }
      clearDraft();
      savedSnapshotRef.current = currentSnapshot;

      if (onSaveSuccess && savedStt) {
        const savedVoucher: VoucherFullDetail = {
          stt: savedStt,
          ma_dvcs: "S1",
          ma_ct: payload.ma_ct,
          nh_ct: payload.nh_ct,
          ma_tte: payload.ma_tte,
          ty_gia: payload.ty_gia,
          ngay_ct: payload.ngay_ct,
          ngay_ps: payload.ngay_ct,
          so_ct: savedSoCt,
          ma_dt: payload.ma_dt,
          ten_dt: payload.ten_dt,
          ong_ba: payload.ong_ba,
          dia_chi: payload.dia_chi,
          dien_giai0: payload.dien_giai0,
          ma_bp: payload.ma_bp,
          ten_bp: tenBp,
          ma_xe: payload.ma_xe,
          ten_xe: tenXe,
          han_tt: payload.han_tt,
          ma_nx: payload.ma_nx,
          tk2: payload.tk2,
          tk3: payload.tk3,
          thue_gtgt: payload.thue_gtgt,
          loai_ck: payload.loai_ck,
          ma_dtgtgt: payload.ma_dtgtgt,
          ttien_nt: isWarehouse ? 0 : payload.ttien_nt,
          ttien_nt4: isWarehouse ? 0 : payload.ttien_nt4,
          ttien_nt2: isWarehouse ? 0 : payload.ttien_nt2,
          ttien_nt3: isWarehouse ? 0 : payload.ttien_nt3,
          ttien_nt0: isWarehouse ? 0 : payload.ttien_nt0,
          ttien: isWarehouse ? 0 : payload.ttien,
          ttien4: isWarehouse ? 0 : payload.ttien4,
          ttien2: isWarehouse ? 0 : payload.ttien2,
          ttien3: isWarehouse ? 0 : payload.ttien3,
          ttien0: isWarehouse ? 0 : payload.ttien0,
          confirmed: true,
          posted: false,
          printed: voucher?.printed ?? false,
          user_name: payload.user_name || CURRENT_USER,
          items: normalizedItems.map((it) => ({ ...it, stt: savedStt })),
        };
        onSaveSuccess(savedStt, savedVoucher);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi mạng hoặc máy chủ không phản hồi.");
    } finally {
      setSaving(false);
    }
  };

  const openDebtLedger = useCallback(() => {
    if (!onViewDebt) return;
    const candidate = (maDtValueRef.current || maDt || "")
      .trim()
      .toUpperCase();
    if (!candidate || maDtError) {
      onViewDebt("");
      return;
    }
    void (async () => {
      await initCustomerIndex();
      const valid = isCustomerIndexReady()
        ? Boolean(getCustomer(candidate))
        : Boolean(tenDt.trim());
      onViewDebt(valid ? candidate : "");
    })();
  }, [maDt, maDtError, onViewDebt, tenDt]);

  const handleOpenPriceCalc = useCallback(() => {
    if (isWarehouse || isSuspended || !isEditable || items.length === 0) return;
    if (showPriceCalc || isModalOpen()) return;
    const activeEl = document.activeElement as HTMLElement | null;
    beforeCalcFocusRef.current = activeEl;

    const latestItems = itemsLatestRef.current;
    const safeIdx = Math.max(
      0,
      Math.min(activeRowIndex, latestItems.length - 1),
    );
    let nextInit = Number(latestItems[safeIdx]?.gia_nt9 ?? 0);

    if (
      activeEl instanceof HTMLInputElement &&
      activeEl.closest('[data-purpose="ledger-table-container"]')
    ) {
      if (activeEl.dataset.field === "gia_nt9") {
        nextInit = parseNumberInput(activeEl.value);
      }
      activeEl.blur();
    }

    setCalcInitialPrice(nextInit);
    setShowPriceCalc(true);
  }, [
    isWarehouse,
    isSuspended,
    isEditable,
    items.length,
    activeRowIndex,
    showPriceCalc,
  ]);

  useVoucherShortcuts({
    isEditable,
    isSuspended,
    isWarehouse,
    saving,
    activeRowIndex,
    onViewDebt,
    openDebtLedger,
    requestClose,
    handleSave,
    handleDeleteItem,
    handleAddItem,
    handleDuplicateRow,
    handleUndo,
    handleRedo,
    handleOpenPriceCalc,
    onOpenAccountPicker: () => setShowAccountPicker(true),
    maDtInputRef,
  });

  const handleClosePriceCalc = useCallback(() => {
    setShowPriceCalc(false);
    const prevEl = beforeCalcFocusRef.current;
    beforeCalcFocusRef.current = null;
    if (prevEl && document.contains(prevEl)) {
      window.setTimeout(() => prevEl.focus(), 0);
    }
  }, []);

  const handleApplyCalculatedPrice = (calculatedPrice: number) => {
    const safeIdx = Math.max(0, Math.min(activeRowIndex, items.length - 1));
    const targetRow = itemsLatestRef.current[safeIdx] ?? items[safeIdx];
    beforeCalcFocusRef.current = null;
    setShowPriceCalc(false);
    if (targetRow) {
      // Cột 10 trong DetailGrid (variant="form") là ô Đơn giá (gia_nt9)
      detailGridRef.current?.scheduleFocusCell(safeIdx, 10);
      handleItemChange(
        safeIdx,
        { ...targetRow, gia_nt9: calculatedPrice },
        "GIA_NT9",
      );
    }
  };

  // Điều hướng các ô trên Header bằng phím mũi tên ↑ / ↓ / ← / → (tương tự Excel / VFP)
  const headerOrderedRefs = [
    ngayCtInputRef,
    soCtInputRef,
    maDtInputRef,
    tenDtInputRef,
    dienGiaiInputRef,
    maXeInputRef,
  ];
  const focusHeaderControl = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== "date") {
      setTimeout(() => {
        if (document.activeElement === el) el.select();
      }, 0);
    }
  };
  const handleHeaderArrowNav = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) => {
    const el = e.currentTarget;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < headerOrderedRefs.length - 1) {
        focusHeaderControl(headerOrderedRefs[idx + 1].current);
      } else {
        focusHeaderControl(firstMaVtRef.current);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        focusHeaderControl(headerOrderedRefs[idx - 1].current);
      }
    } else if (e.key === "ArrowLeft") {
      const atStart =
        el.type === "date" ||
        (el.selectionStart === 0 && el.selectionEnd === 0) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atStart && idx > 0) {
        e.preventDefault();
        focusHeaderControl(headerOrderedRefs[idx - 1].current);
      }
    } else if (e.key === "ArrowRight") {
      const atEnd =
        el.type === "date" ||
        (el.selectionStart === el.value.length &&
          el.selectionEnd === el.value.length) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atEnd) {
        e.preventDefault();
        if (idx < headerOrderedRefs.length - 1) {
          focusHeaderControl(headerOrderedRefs[idx + 1].current);
        } else {
          focusHeaderControl(firstMaVtRef.current);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      <VoucherFormHeaderBar
        isWarehouse={isWarehouse}
        isReturn={isReturn}
        isCreate={isCreate}
        isEdit={isEdit}
        isDirty={isDirty}
        isDifferentCreator={isDifferentCreator}
        hasVoucher={Boolean(voucher)}
        voucherCreator={voucherCreator}
        voucherStt={voucher?.stt}
        maDt={maDt}
        pendingDraft={pendingDraft}
        errorMessage={errorMessage}
        onPrint={onPrint}
        onViewDebt={onViewDebt}
        onRequestClose={requestClose}
        onRestoreDraft={handleRestoreDraft}
        onDismissDraft={() => {
          clearDraft();
          setPendingDraft(null);
        }}
        onClearError={() => {
          setErrorMessage(null);
          setInvalidField(null);
        }}
      />

      <VoucherMasterSection
        isWarehouse={isWarehouse}
        isReturn={isReturn}
        isEditable={isEditable}
        invalidField={invalidField}
        setInvalidField={setInvalidField}
        ngayCt={ngayCt}
        setNgayCt={setNgayCt}
        soCt={soCt}
        setSoCt={setSoCt}
        maVm={maVm}
        debtInfo={debtInfo}
        isOverDebtLimit={!!debtInfo?.is_over_limit}
        maDt={maDt}
        setMaDt={setMaDt}
        maDtError={maDtError}
        setMaDtError={setMaDtError}
        tenDt={tenDt}
        setTenDt={setTenDt}
        diaChi={diaChi}
        ongBa={ongBa}
        maBp={maBp}
        tenBp={tenBp}
        dienGiai0={dienGiai0}
        setDienGiai0={setDienGiai0}
        fallbackDienGiai={
          voucher?.dien_giai0 || initialInherited?.dien_giai0 || ""
        }
        maXe={maXe}
        setMaXe={setMaXe}
        tenXe={tenXe}
        maNx={maNx}
        tk2={tk2}
        ngayCtInputRef={ngayCtInputRef}
        soCtInputRef={soCtInputRef}
        maDtInputRef={maDtInputRef}
        tenDtInputRef={tenDtInputRef}
        dienGiaiInputRef={dienGiaiInputRef}
        maXeInputRef={maXeInputRef}
        pickupBtnRef={pickupBtnRef}
        firstMaVtRef={firstMaVtRef}
        autoSuggestedSoCtRef={autoSuggestedSoCtRef}
        userEditedSoCtRef={userEditedSoCtRef}
        maDtValueRef={maDtValueRef}
        committedMaDtRef={committedMaDtRef}
        lastWarnedMaDtRef={lastWarnedMaDtRef}
        tenDtEditedRef={tenDtEditedRef}
        onViewDebt={onViewDebt}
        openDebtLedger={openDebtLedger}
        onOpenPickup={onOpenPickup}
        handleSelectCustomer={handleSelectCustomer}
        handleSelectXe={handleSelectXe}
        fetchKhachHangOptionsLocal={fetchKhachHangOptionsLocal}
        fetchXeOptionsLocal={fetchXeOptionsLocal}
        focusHeaderControl={focusHeaderControl}
        handleHeaderArrowNav={handleHeaderArrowNav}
      />

      {/* ===== Grid Toolbar ===== */}
      <div
        className="bg-neutral-100 px-3 py-1 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 shrink-0"
        data-purpose="grid-actions"
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs uppercase tracking-wide text-neutral-700 flex items-center gap-1 shrink-0">
            <Table className="w-3.5 h-3.5 text-primary-600" /> Chi tiết hàng hóa
          </span>
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-500 text-[11px] whitespace-nowrap">
            Đang ghi nhận:{" "}
            <b className="text-neutral-800">{items.length} dòng</b>
          </span>
          <span className="text-neutral-400">|</span>
          <PromotionCounter
            items={items}
            ngayCt={ngayCt}
            maTte={maTte}
            isWarehouse={isWarehouse}
            voucherKey={voucherStt || (isCreate ? "NEW" : "VIEW")}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isEditable && (
            <div className="inline-flex items-center bg-white border border-neutral-300 rounded shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyCounts.undo === 0}
                title={`Hoàn tác bước trước (Ctrl+Z)${historyCounts.undo > 0 ? ` — còn ${historyCounts.undo} bước` : ""}`}
                className="px-1.5 py-0.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-r border-neutral-200 transition-colors"
                aria-label="Hoàn tác"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyCounts.redo === 0}
                title={`Làm lại (Ctrl+Y)${historyCounts.redo > 0 ? ` — còn ${historyCounts.redo} bước` : ""}`}
                className="px-1.5 py-0.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-r border-neutral-200 transition-colors"
                aria-label="Làm lại"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateRow(activeRowIndex)}
                disabled={!items[activeRowIndex]?.ma_vt?.trim()}
                title="Nhân đôi dòng đang chọn (Ctrl+Shift+D)"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-primary-50 hover:text-primary-800 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Nhân đôi</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleHighlightSpecs}
            aria-pressed={highlightSpecs}
            title="Bật/tắt tô màu phân loại và tô đậm kích thước trong Tên vật tư"
            className={`px-2 py-0.5 rounded border shadow-sm text-[11px] transition-colors cursor-pointer ${
              highlightSpecs
                ? "bg-primary-50 border-primary-300 text-primary-800 font-semibold hover:bg-primary-100"
                : "bg-white border-neutral-300 text-neutral-500 font-medium hover:bg-neutral-50"
            }`}
          >
            Phân loại
          </button>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-neutral-300 shadow-sm text-xs">
            <span className="text-[11px] text-neutral-500 font-medium">
              Tổng SL:
            </span>
            <span className="font-mono font-bold text-neutral-800">
              {formatCompactNumber(totalQty)}
            </span>
          </div>
        </div>
      </div>

      {/* ===== Main Data Grid ===== */}
      <div
        className="flex-1 overflow-hidden bg-white relative"
        data-purpose="ledger-table-container"
      >
        <DetailGrid
          gridRef={detailGridRef}
          items={items}
          currency={maTte}
          variant="form"
          voucherMode={voucherMode}
          maCt={effectiveMaCt}
          editable={isEditable}
          highlightSpecs={highlightSpecs}
          activeRowIndex={activeRowIndex}
          onSelectRow={setActiveRowIndex}
          onChangeItem={handleItemChange}
          onDeleteItem={handleDeleteItem}
          onAddItem={handleAddItem}
          onValidationError={(msg) => setErrorMessage(msg)}
          firstMaVtRef={firstMaVtRef}
          onLookupPrice={handleLookupPrice}
        />
      </div>

      <VoucherFormFooter
        isEditable={isEditable}
        isWarehouse={isWarehouse}
        isDifferentCreator={isDifferentCreator}
        voucherCreator={voucherCreator}
        saving={saving}
        maTte={maTte}
        totals={totals}
        onSave={handleSave}
        onRequestClose={requestClose}
        onOpenPriceCalc={handleOpenPriceCalc}
      />

      <VoucherFormModals
        items={items}
        activeRowIndex={activeRowIndex}
        saving={saving}
        isDifferentCreator={isDifferentCreator}
        showDiscardDialog={showDiscardDialog}
        discardDialogRef={discardDialogRef}
        onCancelDiscard={() => setShowDiscardDialog(false)}
        onConfirmDiscard={() => {
          clearDraft();
          setShowDiscardDialog(false);
          onBack();
        }}
        onSaveAndClose={() => {
          setShowDiscardDialog(false);
          void handleSave(false);
        }}
        debtDialog={debtDialog}
        debtDialogRef={debtDialogRef}
        onCloseDebtDialog={closeDebtDialog}
        showAccountPicker={showAccountPicker}
        accountPickerRef={accountPickerRef}
        accountInputRef={accountInputRef}
        accountQuery={accountQuery}
        setAccountQuery={setAccountQuery}
        fetchTaiKhoanOptionsLocal={fetchTaiKhoanOptionsLocal}
        onSelectAccount={(code) => {
          if (activeRowIndex >= 0 && activeRowIndex < items.length) {
            const row = items[activeRowIndex];
            handleItemChange(
              activeRowIndex,
              { ...row, tk_du2: code },
              "TK_DU2",
            );
          }
          setShowAccountPicker(false);
        }}
        onCloseAccountPicker={() => setShowAccountPicker(false)}
        showPriceCalc={showPriceCalc}
        calcInitialPrice={calcInitialPrice}
        onApplyCalculatedPrice={handleApplyCalculatedPrice}
        onClosePriceCalc={handleClosePriceCalc}
      />
    </div>
  );
};
