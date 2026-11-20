import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVouchers } from "./hooks/useVouchers";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModalLock } from "./lib/modalLock";
import { peek, invalidate, removeKey } from "./lib/apiCache";
import { initCustomerIndex, getCustomer } from "./lib/customerIndex";
import { VoucherList } from "./components/VoucherList";
import { TopHeaderBar } from "./components/TopHeaderBar";
import { formatDate, getTodayDate } from "./lib/format";
import { invalidatePrintCache } from "./lib/printCache";
import {
  VoucherFullDetail,
  VoucherDetail,
  VoucherHeader,
  VoucherMode,
} from "./types/voucher";
import { PickupSlip, PickupItem } from "./types/pickup";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Trash2,
  X,
  Keyboard,
  Filter,
} from "lucide-react";

const loadVoucherForm = () =>
  import("./components/VoucherForm").then((m) => ({ default: m.VoucherForm }));
const VoucherForm = lazy(loadVoucherForm);
const FilterDialog = lazy(() =>
  import("./components/FilterDialog").then((m) => ({ default: m.FilterDialog })),
);
const PickupDialog = lazy(() =>
  import("./components/PickupDialog").then((m) => ({ default: m.PickupDialog })),
);
const DebtPanel = lazy(() =>
  import("./components/DebtPanel").then((m) => ({ default: m.DebtPanel })),
);
const PrintPreview = lazy(() =>
  import("./components/PrintPreview").then((m) => ({ default: m.PrintPreview })),
);
const ShortcutsDialog = lazy(() =>
  import("./components/ShortcutsDialog").then((m) => ({
    default: m.ShortcutsDialog,
  })),
);

/** Ước tính nhanh (0ms) số chứng từ tiếp theo (theo tháng cho X1, theo ngày cho N5) từ danh sách đang có. */
function computeOptimisticNextSoCt(
  vouchers: VoucherHeader[],
  mode: VoucherMode,
  targetDate: string,
): string {
  const cleanDate = (targetDate || "").slice(0, 10);
  if (mode === "return") {
    let maxNum = 0;
    let padLen = 3;
    for (const v of vouchers) {
      if (cleanDate && (v.ngay_ct || "").slice(0, 10) !== cleanDate) continue;
      if ((v.ma_ct || "").trim().toUpperCase() !== "N5") continue;
      const raw = (v.so_ct || "").trim().toUpperCase();
      if (!raw) continue;
      const m = /^(\d+)$/.exec(raw);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxNum) {
          maxNum = num;
          padLen = Math.max(3, m[1].length);
        }
      }
    }
    return String(maxNum + 1).padStart(padLen, "0");
  }

  const ym = cleanDate.slice(0, 7);
  let maxNum = 0;
  let bestPrefix = mode === "sales" ? "HD" : "";
  let padLen = 4;

  for (const v of vouchers) {
    if (ym && (v.ngay_ct || "").slice(0, 7) !== ym) continue;
    const raw = (v.so_ct || "").trim().toUpperCase();
    if (!raw) continue;
    if (mode === "sales") {
      const m = /^([A-Z]+)(\d+)$/.exec(raw);
      if (m) {
        const num = parseInt(m[2], 10);
        if (num > maxNum) {
          maxNum = num;
          bestPrefix = m[1];
          padLen = Math.max(4, m[2].length);
        }
      }
    } else {
      const m = /^(.*?)(\d+)$/.exec(raw);
      if (m) {
        const num = parseInt(m[2], 10);
        if (num > maxNum) {
          maxNum = num;
          bestPrefix = m[1];
          padLen = m[2].length;
        }
      }
    }
  }
  if (maxNum > 0 && bestPrefix) {
    return `${bestPrefix}${String(maxNum + 1).padStart(padLen, "0")}`;
  }
  return "";
}

export function App({
  initialVoucherMode,
}: {
  initialVoucherMode?: VoucherMode;
} = {}) {
  const {
    voucherMode,
    setVoucherMode,
    vouchers,
    pagination,
    summary,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    flashStt,
    listDetail,
    listDetailLoading,
    debtAmount,
    activeVoucher,
    handleOpenDetail,
    handleCloseDetail,
    optimisticUpsertVoucher,
    optimisticDeleteVoucher,
    isFilterOpen,
    setIsFilterOpen,
    handleApplyFilter,
    handleChangePage,
    refresh,
    isPrintOpen,
    setIsPrintOpen,
    printStts,
    printInGia,
    printCopies,
    printMode,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  } = useVouchers();

  useEffect(() => {
    if (initialVoucherMode && initialVoucherMode !== voucherMode) {
      setVoucherMode(initialVoucherMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVoucherMode]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning" | "info";
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  // Tùy chọn in từ thanh đáy danh sách: "1" = In giá bán, "0" = Không in giá.
  const [printPrice, setPrintPrice] = useState<"1" | "0">("1");
  // Đánh dấu dòng (Mark) giống ctbhh — Space / Ctrl+A / Ctrl+U tác động.
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const pendingClearMarkedRef = useRef<boolean>(false);

  // Idle-prefetch VoucherForm chunk để bấm F2/F3 mở tức thì
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => {
        void loadVoucherForm();
      }, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => {
      void loadVoucherForm();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<
    (Pick<VoucherHeader, "stt" | "so_ct" | "ma_dt" | "ten_dt" | "ngay_ct"> & {
      dbMode: "sales" | "warehouse";
      fromPickup?: boolean;
    }) | null
  >(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  useModalLock(!!deleteTarget, deleteDialogRef);

  // Inherited data for new voucher (F2 / Ctrl+F2 / Pickup)
  const [inheritedData, setInheritedData] =
    useState<Partial<VoucherFullDetail> | null>(null);
  const [pickupPayload, setPickupPayload] = useState<{
    items: VoucherDetail[];
    ma_xe?: string;
    ma_dt?: string;
    ngay_ct?: string;
  } | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "warning" | "info" = "info",
    ) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ message, type });
      toastTimerRef.current = window.setTimeout(
        () => {
          toastTimerRef.current = null;
          setToast(null);
        },
        type === "error" ? 5000 : 3500,
      );
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const toggleMark = useCallback((stt: string | null) => {
    if (!stt) return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) next.delete(stt);
      else next.add(stt);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (selectAll: boolean) => {
      setMarked(selectAll ? new Set(vouchers.map((v) => v.stt)) : new Set());
    },
    [vouchers],
  );

  // ==== Đồng bộ URL route (/sales-invoices, /sales-invoices/new, /sales-invoices/:stt) ====
  const { stt: sttParam } = useParams();
  const navigate = useNavigate();

  const isNew = sttParam === "new";
  const isEditing = Boolean(sttParam && !isNew);

  const routeBase =
    initialVoucherMode === "return"
      ? "/sales-returns"
      : initialVoucherMode === "warehouse"
        ? "/warehouse-slips"
        : "/sales-invoices";

  const navToDetail = useCallback(
    (stt: string) => {
      navigate(`${routeBase}/${encodeURIComponent(stt)}`);
    },
    [navigate, routeBase],
  );
  const navToNew = useCallback(() => navigate(`${routeBase}/new`), [navigate, routeBase]);
  const navToList = useCallback(() => navigate(routeBase), [navigate, routeBase]);
  const openFilterModal = useCallback(() => setIsFilterOpen(true), [setIsFilterOpen]);

  const apiDbMode: "sales" | "warehouse" =
    voucherMode === "warehouse" ? "warehouse" : "sales";

  // Lấy dữ liệu phiếu tức thì (từ state activeVoucher, cache RAM, hoặc ghép từ dòng đang chọn)
  // để mở form Sửa (mode="S") không bị trống ở render đầu tiên trước khi useEffect chạy.
  const editingVoucher = useMemo<VoucherFullDetail | null>(() => {
    if (!sttParam || isNew) return null;
    if (activeVoucher?.stt === sttParam) return activeVoucher;
    const cached = peek<any>(`voucher:${apiDbMode}:${sttParam}`);
    if (cached?.success && cached.data?.stt === sttParam) {
      return cached.data as VoucherFullDetail;
    }
    const header = vouchers.find((v) => v.stt === sttParam);
    if (header) {
      return {
        ...header,
        items: selectedStt === sttParam ? listDetail : [],
      };
    }
    return null;
  }, [sttParam, isNew, activeVoucher, apiDbMode, vouchers, selectedStt, listDetail]);

  const activeMaCt: "X1" | "N5" =
    voucherMode === "return" ||
    (!isNew &&
      (editingVoucher?.ma_ct || "").trim().toUpperCase() === "N5")
      ? "N5"
      : "X1";

  useEffect(() => {
    if (sttParam && !isNew) {
      if (activeVoucher?.stt !== sttParam) {
        handleOpenDetail(sttParam);
      }
    } else if (!sttParam) {
      if (activeVoucher) {
        handleCloseDetail();
      }
      setInheritedData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttParam]);

  // Selected voucher header
  const currentSelectedVoucher =
    vouchers.find((v) => v.stt === selectedStt) ||
    (vouchers.length > 0 ? vouchers[0] : null);

  const [pickupParams, setPickupParams] = useState<{
    maDt?: string;
    ngayCt?: string;
  }>({});

  // Overlay Thêm mới (F2) / Sửa (F3) phiếu kho trực tiếp từ PickupDialog
  const [warehouseOverlay, setWarehouseOverlay] = useState<{
    mode: "M" | "S";
    stt?: string;
    maCt?: "X1" | "N5";
    voucher?: VoucherFullDetail | null;
    initialInherited?: Partial<VoucherFullDetail>;
  } | null>(null);
  const [pickupRefreshTrigger, setPickupRefreshTrigger] = useState<number>(0);
  const [pickupFocusStt, setPickupFocusStt] = useState<string | null>(null);
  const [pickupHiddenStts, setPickupHiddenStts] = useState<Set<string>>(
    () => new Set(),
  );
  const [pickupOptimisticSlip, setPickupOptimisticSlip] = useState<{
    slip: PickupSlip;
    items: PickupItem[];
    version: number;
  } | null>(null);

  // Gợi ý số chứng từ tức thì (0ms) khi mở form Thêm mới (F2)
  const optimisticNextSoCt = useMemo(
    () =>
      computeOptimisticNextSoCt(
        vouchers,
        voucherMode,
        inheritedData?.ngay_ct || getTodayDate(),
      ),
    [vouchers, voucherMode, inheritedData?.ngay_ct],
  );

  const handleOpenPickup = (maDt?: string, ngayCt?: string) => {
    setPickupParams({
      maDt: maDt || activeVoucher?.ma_dt || currentSelectedVoucher?.ma_dt || "",
      ngayCt:
        ngayCt ||
        activeVoucher?.ngay_ct ||
        currentSelectedVoucher?.ngay_ct ||
        undefined,
    });
    setIsPickupOpen(true);
  };

  const handleCreateWarehouseSlipFromPickup = async () => {
    const dtCode = (
      pickupParams.maDt ||
      activeVoucher?.ma_dt ||
      currentSelectedVoucher?.ma_dt ||
      ""
    ).trim();
    const ngayCtVal =
      pickupParams.ngayCt ||
      activeVoucher?.ngay_ct ||
      currentSelectedVoucher?.ngay_ct ||
      undefined;

    let custInfo: Partial<VoucherFullDetail> = {};
    if (dtCode) {
      await initCustomerIndex();
      const hit = getCustomer(dtCode);
      if (hit) {
        custInfo = {
          ma_dt: hit.ma_dt,
          ten_dt: hit.ten_dt,
          dia_chi: hit.dia_chi,
          ong_ba: hit.ong_ba,
          ma_bp: hit.ma_bp,
          ten_bp: hit.ten_bp,
        };
      } else {
        custInfo = { ma_dt: dtCode };
      }
    }

    const targetMaCt: "X1" | "N5" = activeMaCt;
    const isReturnSlip = targetMaCt === "N5";
    setWarehouseOverlay({
      mode: "M",
      maCt: targetMaCt,
      voucher: null,
      initialInherited: {
        ...custInfo,
        ngay_ct: ngayCtVal,
        dien_giai0: isReturnSlip ? "nhập lại" : "xuất bán",
        ma_ct: targetMaCt,
        nh_ct: isReturnSlip ? "1" : "2",
      },
    });
  };

  const handleEditWarehouseSlipFromPickup = async (
    stt: string,
    preview?: { slip?: PickupSlip; items?: PickupItem[] },
  ) => {
    // Mở overlay tức thì (0ms) từ cache RAM hoặc dữ liệu slip/items đã nạp sẵn trong PickupDialog,
    // sau đó đồng bộ ngầm bản đầy đủ từ SQL mà không chặn màn hình.
    const slipMaCt: "X1" | "N5" =
      (preview?.slip?.ma_ct || activeMaCt).trim().toUpperCase() === "N5"
        ? "N5"
        : "X1";
    const isReturnSlip = slipMaCt === "N5";
    const cached = peek<any>(`voucher:warehouse:${stt}`);
    let previewVoucher: VoucherFullDetail | null = null;
    if (cached?.success && cached.data?.stt === stt) {
      previewVoucher = cached.data as VoucherFullDetail;
    } else if (preview?.slip) {
      const s = preview.slip;
      previewVoucher = {
        stt: s.stt,
        ma_dvcs: "S1",
        ma_ct: slipMaCt,
        nh_ct: isReturnSlip ? "1" : "2",
        ma_tte: "VND",
        ty_gia: 1,
        ngay_ct: s.ngay_ct,
        ngay_ps: s.ngay_ct,
        so_ct: s.so_ct || "",
        ma_dt: s.ma_dt,
        ten_dt: s.ten_dt || "",
        ong_ba: s.ten_dt || "",
        dia_chi: s.dia_chi || "",
        dien_giai0: isReturnSlip ? "nhập lại" : "xuất bán",
        ma_xe: s.ma_xe || "",
        ten_xe: "",
        ttien_nt: 0,
        ttien_nt0: 0,
        ttien_nt2: 0,
        ttien_nt3: 0,
        ttien_nt4: 0,
        ttien: 0,
        ttien0: 0,
        ttien2: 0,
        ttien3: 0,
        ttien4: 0,
        confirmed: true,
        posted: false,
        printed: false,
        items: (preview.items || []).map((it) => ({
          stt: s.stt,
          stt0: it.stt0,
          ma_kho: it.ma_kho || "K0101",
          ma_vt: it.ma_vt,
          ten_vt: it.ten_vt || "",
          dvt: it.dvt || "",
          dvt_ban: it.dvt_ban || "",
          loai_vt: it.loai_vt || "1",
          so_tam: it.so_tam ?? 0,
          he_so8: it.he_so8 ?? 1,
          so_luong8: it.so_luong8 ?? it.so_luong9 ?? 0,
          he_so9: 1,
          so_luong9: it.so_luong9 ?? 0,
          so_luong: it.so_luong9 ?? it.so_luong8 ?? 0,
          gia_tb_tt: isReturnSlip ? "K" : "C",
        })),
      };
    }

    if (previewVoucher) {
      setWarehouseOverlay({
        mode: "S",
        stt,
        maCt:
          (previewVoucher.ma_ct || slipMaCt).trim().toUpperCase() === "N5"
            ? "N5"
            : "X1",
        voucher: previewVoucher,
      });
    }

    try {
      const res = await fetch(
        `/api/vouchers/${encodeURIComponent(stt)}?db_mode=warehouse`,
      );
      const data = await res.json();
      if (res.ok && data?.success && data?.data) {
        const fetched = data.data as VoucherFullDetail;
        const fetchedMaCt: "X1" | "N5" =
          (fetched.ma_ct || slipMaCt).trim().toUpperCase() === "N5"
            ? "N5"
            : "X1";
        setWarehouseOverlay((prev) => {
          // Nếu người dùng đã đóng overlay trong lúc tải ngầm thì không mở lại
          if (previewVoucher && (!prev || prev.stt !== stt)) return prev;
          return {
            mode: "S",
            stt,
            maCt: fetchedMaCt,
            voucher: fetched,
          };
        });
      } else if (!previewVoucher) {
        showToast(
          `Không thể tải phiếu kho ${stt}: ${data?.message || "Lỗi không xác định"}`,
          "error",
        );
      }
    } catch (err: any) {
      if (!previewVoucher) {
        showToast(`Lỗi tải phiếu kho: ${err.message}`, "error");
      }
    }
  };

  // Handler for F2 (New Voucher)
  const handleActionNew = () => {
    const defaultMaCt = voucherMode === "return" ? "N5" : "X1";
    if (currentSelectedVoucher) {
      setInheritedData({
        ma_dt: currentSelectedVoucher.ma_dt,
        ten_dt: currentSelectedVoucher.ten_dt,
        dia_chi: currentSelectedVoucher.dia_chi,
        ong_ba: currentSelectedVoucher.ong_ba,
        dien_giai0: currentSelectedVoucher.dien_giai0,
        ma_xe: currentSelectedVoucher.ma_xe,
        ten_xe: currentSelectedVoucher.ten_xe,
        ma_bp: currentSelectedVoucher.ma_bp,
        ten_bp: currentSelectedVoucher.ten_bp,
        ma_ct:
          voucherMode === "return"
            ? "N5"
            : currentSelectedVoucher.ma_ct || defaultMaCt,
      });
    } else {
      setInheritedData(null);
    }
    navToNew();
  };

  // Handler for Ctrl+F2 (Copy Voucher)
  const handleActionCopy = () => {
    if (activeVoucher) {
      setInheritedData({
        ...activeVoucher,
        stt: undefined,
        so_ct: undefined,
        items: activeVoucher.items.map((it) => ({
          ...it,
          stt: undefined,
          stt0: undefined,
        })),
      });
      navToNew();
      showToast(
        `Đã sao chép nội dung chứng từ số ${activeVoucher.so_ct || activeVoucher.stt}.`,
        "success",
      );
    } else if (currentSelectedVoucher) {
      setInheritedData({
        ...currentSelectedVoucher,
        stt: undefined,
        so_ct: undefined,
        items: listDetail.map((it) => ({
          ...it,
          stt: undefined,
          stt0: undefined,
        })),
      });
      navToNew();
      showToast(
        `Đã sao chép nội dung chứng từ số ${currentSelectedVoucher.so_ct || currentSelectedVoucher.stt}.`,
        "success",
      );
    } else {
      showToast("Chưa chọn chứng từ để sao chép.", "warning");
    }
  };

  // Handler for F3 (Edit Voucher)
  const handleActionEdit = () => {
    if (selectedStt) {
      navToDetail(selectedStt);
    } else {
      showToast("Chưa chọn chứng từ để sửa.", "warning");
    }
  };

  // Handler for F8 (Delete Voucher)
  const handleActionDelete = () => {
    if (currentSelectedVoucher) {
      setDeleteTarget({
        stt: currentSelectedVoucher.stt,
        so_ct: currentSelectedVoucher.so_ct,
        ma_dt: currentSelectedVoucher.ma_dt,
        ten_dt: currentSelectedVoucher.ten_dt,
        ngay_ct: currentSelectedVoucher.ngay_ct,
        dbMode: apiDbMode,
        fromPickup: false,
      });
    } else {
      showToast("Chưa chọn chứng từ để xóa.", "warning");
    }
  };

  // Handler for F7 / Ctrl+F7 / quick print (Print marked vouchers or active voucher)
  const handleActionPrint = (options?: {
    inGia?: "1" | "0";
    copies?: number;
    mode?: "direct" | "preview";
  }) => {
    const usedMarked = !sttParam && marked.size > 0;
    const targets = usedMarked
      ? [
          ...vouchers.filter((v) => marked.has(v.stt)).map((v) => v.stt),
          ...Array.from(marked).filter(
            (s) => !vouchers.some((v) => v.stt === s),
          ),
        ]
      : activeVoucher
        ? [activeVoucher.stt]
        : selectedStt
          ? [selectedStt]
          : [];
    if (targets.length > 0) {
      pendingClearMarkedRef.current = usedMarked;
      handleOpenPrint(targets, options);
    } else {
      showToast("Chưa chọn chứng từ để in.", "warning");
    }
  };

  // Xóa lạc quan (0ms): đóng hộp thoại + gỡ dòng khỏi giao diện ngay lập tức,
  // tự động hoàn tác nguyên trạng kèm thông báo lỗi nếu SQL từ chối (khóa sổ / mất mạng).
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    if (target.fromPickup) {
      // 0ms: ẩn phiếu khỏi PickupDialog ngay
      setPickupHiddenStts((prev) => {
        const next = new Set(prev);
        next.add(target.stt);
        return next;
      });
      setPickupFocusStt(null);
      showToast(
        `Đã xóa phiếu xuất kho số ${target.so_ct || target.stt}.`,
        "success",
      );

      try {
        const res = await fetch(
          `/api/vouchers/${encodeURIComponent(target.stt)}?user_name=KTCN3&db_mode=${encodeURIComponent(target.dbMode)}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Rollback: hiện lại phiếu vừa ẩn
          setPickupHiddenStts((prev) => {
            const next = new Set(prev);
            next.delete(target.stt);
            return next;
          });
          showToast(
            `Không thể xóa phiếu kho ${target.so_ct || target.stt}: ${data?.detail?.message || data?.message || "Lỗi máy chủ."}`,
            "error",
          );
          return;
        }
        invalidate("pickup:list:");
        removeKey(`pickup:detail:${target.stt}`);
        removeKey(`voucher:warehouse:${target.stt}`);
        setPickupRefreshTrigger((prev) => prev + 1);
        setPickupHiddenStts((prev) => {
          if (!prev.has(target.stt)) return prev;
          const next = new Set(prev);
          next.delete(target.stt);
          return next;
        });
      } catch (err: any) {
        setPickupHiddenStts((prev) => {
          const next = new Set(prev);
          next.delete(target.stt);
          return next;
        });
        showToast(
          `Lỗi kết nối khi xóa phiếu kho ${target.so_ct || target.stt}: ${err.message}`,
          "error",
        );
      }
      return;
    }

    // 0ms: gỡ dòng khỏi VoucherList, trừ tổng, chuyển focus sang dòng kế cận
    const wasMarked = marked.has(target.stt);
    if (wasMarked) {
      setMarked((prev) => {
        const next = new Set(prev);
        next.delete(target.stt);
        return next;
      });
    }
    const tx = optimisticDeleteVoucher(target.stt);
    if (sttParam) {
      navToList();
    }
    showToast(
      `Đã xóa chứng từ số ${target.so_ct || target.stt}.`,
      "success",
    );

    try {
      const res = await fetch(
        `/api/vouchers/${encodeURIComponent(target.stt)}?user_name=KTCN3&db_mode=${encodeURIComponent(target.dbMode)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        tx.rollback();
        if (wasMarked) {
          setMarked((prev) => {
            const next = new Set(prev);
            next.add(target.stt);
            return next;
          });
        }
        showToast(
          `Không thể xóa chứng từ ${target.so_ct || target.stt}: ${data?.detail?.message || data?.message || "Lỗi máy chủ."}`,
          "error",
        );
        return;
      }
      tx.commit();
    } catch (err: any) {
      tx.rollback();
      if (wasMarked) {
        setMarked((prev) => {
          const next = new Set(prev);
          next.add(target.stt);
          return next;
        });
      }
      showToast(
        `Lỗi kết nối khi xóa chứng từ ${target.so_ct || target.stt}: ${err.message}`,
        "error",
      );
    }
  };

  const handleConfirmDeleteRef = useRef(handleConfirmDelete);
  handleConfirmDeleteRef.current = handleConfirmDelete;

  // Phím tắt riêng cho modal xác nhận xóa (Esc hủy, F8 xác nhận) kể cả khi mở từ PickupDialog
  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget(null);
      } else if (e.key === "F8" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleConfirmDeleteRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deleteTarget]);

  // VFP Keyboard Shortcuts Handler (khớp ctbhh / ctbhd / ctbhch)
  useHotkeys(
    {
      // F2 / Ctrl+M = Thêm mới (ctbhh Command1)
      onF2: () => {
        if (!sttParam) handleActionNew();
      },
      onCtrlM: () => {
        if (!sttParam) handleActionNew();
      },
      // Ctrl+F2 = Sao chép tạo mới
      onCtrlF2: () => {
        if (!sttParam) handleActionCopy();
      },
      // F3 / Enter = Sửa (ctbhh Command2)
      onF3: () => {
        if (!sttParam) handleActionEdit();
      },
      onEnter: () => {
        if (!sttParam) handleActionEdit();
      },
      // F5 trên danh sách = Làm mới dữ liệu từ SQL
      onF5: !sttParam ? () => refresh() : undefined,
      onCtrlF3: () => showToast("Ctrl+F3 - Sửa mẫu in."),
      onF6: () => showToast("F6 - Nhập số IMEI."),
      // F7 = In chứng từ trực tiếp (chỉ trên danh sách; trong VoucherForm do VoucherForm xử lý)
      onF7: !sttParam ? () => handleActionPrint() : undefined,
      // Alt+1..4 = In không giá (1..4 bản), Ctrl+1..4 = In có giá (1..4 bản) trên VoucherList
      onQuickPrint: (inGia, copies) => {
        if (!sttParam) handleActionPrint({ inGia, copies });
      },
      // Ctrl+F7 / Shift+F7 = Mở dialog PrintPreview (có tùy chọn In nợ cũ) trên VoucherList
      onPreview: () => {
        if (!sttParam) handleActionPrint({ mode: "preview" });
      },
      // F8 = Xóa (ctbhh Command3)
      onF8: () => {
        if (!sttParam) handleActionDelete();
      },
      // F9 = Lọc chứng từ (chỉ trên danh sách; trong VoucherForm không mở FilterDialog)
      onF9: !sttParam ? () => setIsFilterOpen(true) : undefined,
      // Space = đánh dấu / bỏ đánh dấu dòng (ctbhh KeyPress 32)
      onSpace: () => {
        if (!sttParam) toggleMark(selectedStt);
      },
      // Ctrl+A = chọn tất cả dòng (Mark = .T.)
      onCtrlA: () => {
        if (!sttParam) {
          setMarked(new Set(vouchers.map((v) => v.stt)));
          showToast(`Đã chọn tất cả ${vouchers.length} chứng từ.`);
        }
      },
      // Ctrl+U = bỏ chọn tất cả dòng (Mark = .F.)
      onCtrlU: () => {
        if (!sttParam) {
          setMarked(new Set());
          showToast("Đã bỏ chọn tất cả chứng từ.");
        }
      },
      onCtrlShiftE: () => {
        if (!sttParam) {
          handleOpenDebt(
            (currentSelectedVoucher?.ma_dt || "").trim().toUpperCase(),
          );
        }
      },
      onEscape: () => {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (isPrintOpen) {
          setIsPrintOpen(false);
        } else if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
        } else if (isDebtOpen) {
          setIsDebtOpen(false);
        } else if (isPickupOpen) {
          setIsPickupOpen(false);
        } else if (isFilterOpen) {
          setIsFilterOpen(false);
        }
      },
      onCtrlHome: () => {
        if (!sttParam && vouchers.length > 0) setSelectedStt(vouchers[0].stt);
      },
      onCtrlEnd: () => {
        if (!sttParam && vouchers.length > 0)
          setSelectedStt(vouchers[vouchers.length - 1].stt);
      },
      // Tắt hotkey danh sách khi có dialog đang mở (tránh Space/Ctrl+A/Enter
      // ảnh hưởng tới VoucherList trong lúc thao tác trên PickupDialog/Filter...).
    },
    !(
      !!warehouseOverlay ||
      isPickupOpen ||
      isFilterOpen ||
      isDebtOpen ||
      isShortcutsOpen ||
      isPrintOpen ||
      !!deleteTarget
    ),
  );

  const handleHotkeyBarAction = (actionId: string) => {
    switch (actionId) {
      case "NEW":
        handleActionNew();
        break;
      case "EDIT":
        handleActionEdit();
        break;
      case "IMEI":
        showToast("F6 - Nhập số IMEI.");
        break;
      case "DELETE":
        handleActionDelete();
        break;
      case "FILTER":
        setIsFilterOpen(true);
        break;
      case "PRINT":
        handleActionPrint();
        break;
      case "PREVIEW":
        handleActionPrint({ mode: "preview" });
        break;
      case "TOGGLE_MARK":
        toggleMark(selectedStt);
        break;
      case "SELECT_ALL":
        setMarked(new Set(vouchers.map((v) => v.stt)));
        break;
      case "DESELECT_ALL":
        setMarked(new Set());
        break;
      case "ESCAPE":
        if (deleteTarget) setDeleteTarget(null);
        else if (isPrintOpen) setIsPrintOpen(false);
        else if (isDebtOpen) setIsDebtOpen(false);
        else if (isPickupOpen) setIsPickupOpen(false);
        else if (isFilterOpen) setIsFilterOpen(false);
        else if (sttParam) navToList();
        break;
      default:
        break;
    }
  };

  // Phím `/` trên danh sách: nhảy nhanh vào ô tìm kiếm khách hàng
  const hasAnyModalOpen =
    !!warehouseOverlay ||
    isPickupOpen ||
    isFilterOpen ||
    isDebtOpen ||
    isShortcutsOpen ||
    isPrintOpen ||
    !!deleteTarget;

  useEffect(() => {
    if (sttParam || hasAnyModalOpen) return;
    const onSlashKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        !active.readOnly &&
        ["text", "search", "email", "password", "tel", "url", "number", "date"].includes(
          (active.type || "text").toLowerCase(),
        )
      ) {
        return;
      }
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      customerSearchInputRef.current?.focus();
      customerSearchInputRef.current?.select();
    };
    window.addEventListener("keydown", onSlashKey);
    return () => window.removeEventListener("keydown", onSlashKey);
  }, [sttParam, hasAnyModalOpen]);

  // Danh sách bộ lọc đang kích hoạt (Active Filter Chips) để người dùng nhìn thấy & xóa nhanh từng tiêu chí
  const activeFilterChips = useMemo(() => {
    const today = getTodayDate();
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const d1 = filters.ngay_ct1 || "";
    const d2 = filters.ngay_ct2 || "";
    if (d1 !== today || d2 !== today) {
      const dateLabel =
        !d1 && !d2
          ? "Ngày: Tất cả"
          : d1 && d2 && d1 === d2
            ? `Ngày: ${formatDate(d1)}`
            : `Ngày: ${d1 ? formatDate(d1) : "…"} → ${d2 ? formatDate(d2) : "…"}`;
      chips.push({
        key: "date",
        label: dateLabel,
        onClear: () => handleApplyFilter({ ngay_ct1: today, ngay_ct2: today }),
      });
    }
    if (filters.ma_dt?.trim()) {
      chips.push({
        key: "ma_dt",
        label: `KH: ${filters.ma_dt.trim().toUpperCase()}`,
        onClear: () => handleApplyFilter({ ma_dt: "" }),
      });
    }
    if (filters.dien_giai?.trim()) {
      chips.push({
        key: "dien_giai",
        label: `Diễn giải: ${filters.dien_giai.trim()}`,
        onClear: () => handleApplyFilter({ dien_giai: "" }),
      });
    }
    if (filters.so_ct1?.trim() || filters.so_ct2?.trim()) {
      chips.push({
        key: "so_ct",
        label: `Số phiếu: ${filters.so_ct1?.trim() || "…"} → ${filters.so_ct2?.trim() || "…"}`,
        onClear: () => handleApplyFilter({ so_ct1: "", so_ct2: "" }),
      });
    }
    if (filters.ma_kho?.trim()) {
      chips.push({
        key: "ma_kho",
        label: `Kho: ${filters.ma_kho.trim().toUpperCase()}`,
        onClear: () => handleApplyFilter({ ma_kho: "" }),
      });
    }
    if (filters.ma_vt?.trim()) {
      chips.push({
        key: "ma_vt",
        label: `Vật tư: ${filters.ma_vt.trim().toUpperCase()}`,
        onClear: () => handleApplyFilter({ ma_vt: "" }),
      });
    }
    if (filters.ma_tte?.trim()) {
      chips.push({
        key: "ma_tte",
        label: `Tiền tệ: ${filters.ma_tte.trim().toUpperCase()}`,
        onClear: () => handleApplyFilter({ ma_tte: "" }),
      });
    }
    return chips;
  }, [filters, handleApplyFilter]);

  const handleClearAllFilters = useCallback(() => {
    const today = getTodayDate();
    handleApplyFilter({
      ngay_ct1: today,
      ngay_ct2: today,
      ma_dt: "",
      dien_giai: "",
      so_ct1: "",
      so_ct2: "",
      ma_kho: "",
      ma_vt: "",
      ma_tte: "",
    });
  }, [handleApplyFilter]);

  return (
    <>
      <div className="flex flex-col h-full w-full overflow-hidden bg-surface print:hidden">
        {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-[80] max-w-md px-3.5 py-2 rounded shadow-lg text-xs flex items-center gap-2 border animate-in fade-in slide-in-from-top-2 ${
            toast.type === "success"
              ? "bg-emerald-900 text-emerald-50 border-emerald-700"
              : toast.type === "error"
                ? "bg-danger-800 text-white border-danger-600"
                : toast.type === "warning"
                  ? "bg-amber-800 text-amber-50 border-amber-600"
                  : "bg-neutral-900 text-white border-neutral-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : toast.type === "error" || toast.type === "warning" ? (
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                toast.type === "error" ? "text-rose-200" : "text-amber-200"
              }`}
            />
          ) : (
            <Info className="w-4 h-4 text-primary-300 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={dismissToast}
            className="ml-1 text-white/70 hover:text-white cursor-pointer shrink-0"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận xóa chứng từ"
            className="bg-white rounded shadow-2xl border border-neutral-300 w-[440px] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-danger-700 text-white px-4 py-2.5 flex items-center justify-between shadow">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span className="font-bold text-sm">
                  {deleteTarget.dbMode === "warehouse"
                    ? "Xác nhận xóa phiếu xuất kho"
                    : "Xác nhận xóa chứng từ"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-neutral-800 space-y-2.5">
              <p className="text-sm">
                Bạn có chắc chắn muốn xóa{" "}
                {deleteTarget.dbMode === "warehouse"
                  ? "phiếu xuất kho"
                  : "chứng từ"}{" "}
                số:{" "}
                <b className="font-mono text-primary-800 text-base">
                  {deleteTarget.so_ct || deleteTarget.stt}
                </b>
                ?
              </p>
              <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200 text-neutral-600 space-y-1">
                <div>
                  Khách hàng: <b>{deleteTarget.ten_dt || deleteTarget.ma_dt}</b>
                </div>
                <div>
                  Ngày lập: <b>{formatDate(deleteTarget.ngay_ct)}</b>
                </div>
              </div>
              <p className="text-danger-700 font-medium text-[11px]">
                {deleteTarget.dbMode === "warehouse"
                  ? "Lưu ý: Thao tác sẽ xóa phiếu xuất kho và hoàn nhập tồn kho tương ứng (không thể hoàn tác)."
                  : "Lưu ý: Thao tác sẽ hoàn nhập tồn kho và xóa các bút toán công nợ liên quan (không thể hoàn tác)."}
              </p>
            </div>
            <div className="bg-neutral-100 px-4 py-2 flex justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-neutral-700 font-medium text-xs cursor-pointer"
              >
                Hủy bỏ (Esc)
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1 bg-danger-600 hover:bg-danger-700 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer"
              >
                Xóa chứng từ (F8)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Top Global Header (ẩn khi đang mở form Thêm mới / Sửa chứng từ) ===== */}
      {!sttParam && (
        <>
          <TopHeaderBar
            voucherMode={voucherMode}
            onChangeVoucherMode={(nextMode) => {
              setVoucherMode(nextMode);
              const nextPath =
                nextMode === "return"
                  ? "/sales-returns"
                  : nextMode === "warehouse"
                    ? "/warehouse-slips"
                    : "/sales-invoices";
              navigate(nextPath);
            }}
            filters={filters}
            loading={loading}
            onApplyFilter={handleApplyFilter}
            onRefresh={refresh}
            customerSearchInputRef={customerSearchInputRef}
          />
          {activeFilterChips.length > 0 && (
            <div className="bg-primary-50/70 border-b border-primary-200/80 px-3.5 py-1 flex items-center flex-wrap gap-1.5 text-[11px] flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-primary-800 font-semibold mr-0.5">
                <Filter className="w-3 h-3" />
                Đang lọc:
              </span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 bg-white border border-primary-200 text-primary-900 px-2 py-0.5 rounded-full shadow-sm font-medium"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onClear}
                    className="text-primary-500 hover:text-danger-600 cursor-pointer"
                    title={`Bỏ lọc ${chip.label}`}
                    aria-label={`Bỏ lọc ${chip.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {activeFilterChips.length >= 2 && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="ml-1 text-primary-700 hover:text-danger-700 underline font-medium cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative min-h-0">
        {sttParam ? (
          <Suspense
            fallback={
              <div className="h-full w-full flex items-center justify-center bg-surface text-xs text-neutral-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                <span>Đang tải biểu mẫu chứng từ...</span>
              </div>
            }
          >
            <VoucherForm
              key={`${voucherMode}:${activeMaCt}:${isNew ? "new" : sttParam}`}
              stt={isNew ? undefined : sttParam}
              mode={isNew ? "M" : "S"}
              voucherMode={voucherMode}
              maCt={activeMaCt}
              isSuspended={!!warehouseOverlay || isDebtOpen}
              voucher={isNew ? null : editingVoucher}
              initialInherited={inheritedData || undefined}
              suggestedSoCt={isNew ? optimisticNextSoCt : undefined}
              pickupPayload={pickupPayload}
              onClearPickupPayload={() => setPickupPayload(null)}
              onBack={navToList}
              onPrint={() => {
                const targetStt = editingVoucher?.stt || sttParam;
                if (targetStt && !isNew) {
                  invalidatePrintCache(targetStt);
                  handleOpenPrint(targetStt);
                }
              }}
              onViewDebt={(dt) => handleOpenDebt(dt)}
              onOpenPickup={handleOpenPickup}
              onSaveSuccess={(newStt, savedVoucher) => {
                if (savedVoucher) {
                  // 0ms: cập nhật danh sách, dòng tổng, cache chi tiết & bảng chi tiết đáy tức thì
                  optimisticUpsertVoucher(savedVoucher, isNew);
                } else {
                  invalidatePrintCache(newStt);
                  setSelectedStt(newStt);
                  handleCloseDetail({ skipFetch: true });
                  refresh({ silent: vouchers.length > 0 });
                }
                navToList();
                showToast(
                  isNew
                    ? `Đã tạo mới chứng từ ${savedVoucher?.so_ct || ""} thành công.`
                    : `Đã lưu thay đổi chứng từ ${savedVoucher?.so_ct || ""} thành công.`,
                  "success",
                );
              }}
            />
          </Suspense>
        ) : (
          <VoucherList
            vouchers={vouchers}
            pagination={pagination}
            summary={summary}
            filters={filters}
            loading={loading}
            selectedStt={selectedStt}
            flashStt={flashStt}
            markedStts={marked}
            detailItems={listDetail}
            detailLoading={listDetailLoading}
            debtAmount={debtAmount}
            voucherMode={voucherMode}
            onSelectStt={setSelectedStt}
            onEditVoucher={navToDetail}
            onToggleMark={toggleMark}
            onToggleSelectAll={handleToggleSelectAll}
            onOpenFilter={openFilterModal}
            onOpenPrint={handleOpenPrint}
            onOpenPickup={handleOpenPickup}
            onOpenDebt={handleOpenDebt}
            onRefresh={refresh}
            onChangePage={handleChangePage}
          />
        )}
      </main>

      {/* ===== Bottom Shortcut Action Toolbar (ẩn khi đang mở form Thêm mới / Sửa) ===== */}
      {!sttParam && (
        <footer className="bg-neutral-900 text-neutral-200 border-t border-neutral-800 px-3 py-1 flex-shrink-0 z-20 text-[11px]">
          <div className="flex items-center justify-between flex-wrap gap-y-1 gap-x-2">
            {/* Tùy chọn in */}
            <div className="flex items-center gap-2.5 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700 text-[11px]">
              <span className="font-medium text-neutral-300">Tùy chọn in:</span>
              <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-white">
                <input
                  checked={printPrice === "1"}
                  onChange={() => setPrintPrice("1")}
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="1"
                />
                <span>
                  <span className="font-mono font-bold text-primary-300">
                    1
                  </span>{" "}
                  - In giá bán
                </span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer text-neutral-300 hover:text-white">
                <input
                  checked={printPrice === "0"}
                  onChange={() => setPrintPrice("0")}
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="0"
                />
                <span>
                  <span className="font-mono text-neutral-400">0</span> - Không
                  in giá
                </span>
              </label>
            </div>

            {/* Nhóm phím thêm/sửa/xóa/in/lọc */}
            <div className="flex items-center flex-wrap gap-1 text-[11px]">
              <button
                onClick={() => handleHotkeyBarAction("NEW")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Thêm mới chứng từ (F2)"
              >
                <kbd className="text-[9px] py-0 px-1">F2</kbd>
                <span>Thêm</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("EDIT")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Sửa chứng từ đang chọn (F3)"
              >
                <kbd className="text-[9px] py-0 px-1">F3</kbd>
                <span>Sửa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("DELETE")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-danger-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Xóa chứng từ đang chọn (F8)"
              >
                <kbd className="text-[9px] py-0 px-1">F8</kbd>
                <span>Xóa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PRINT")}
                className="px-2 py-0.5 bg-primary-700 hover:bg-primary-800 text-white rounded border border-primary-600 transition flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="bg-primary-800 text-white border-primary-600 text-[9px] py-0 px-1">
                  F7
                </kbd>
                <span>In phiếu</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PREVIEW")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Mở hộp thoại xem trước khi in & tùy chọn In nợ cũ (Ctrl+F7)"
              >
                <kbd className="text-[9px] py-0 px-1">Ctrl+F7</kbd>
                <span>Xem trước</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("FILTER")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition flex items-center gap-1 cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F9</kbd>
                <span>Lọc dữ liệu</span>
              </button>
            </div>

            {/* Nhóm tiện ích và thoát */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-200 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Xem hướng dẫn tất cả phím tắt của ứng dụng"
              >
                <Keyboard className="w-3.5 h-3.5 text-primary-300" />
                <span>Phím tắt</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("ESCAPE")}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">Esc</kbd>
                <span>Quay ra</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Modals (lazy-loaded & conditionally mounted only when open) */}
      {isFilterOpen && (
        <Suspense fallback={null}>
          <FilterDialog
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onApply={handleApplyFilter}
          />
        </Suspense>
      )}

      {isPickupOpen && (
        <Suspense fallback={null}>
          <PickupDialog
            isOpen={isPickupOpen}
            isSuspended={!!warehouseOverlay || !!deleteTarget}
            maCt={activeMaCt}
            onClose={() => setIsPickupOpen(false)}
            maDt={
              pickupParams.maDt ||
              activeVoucher?.ma_dt ||
              currentSelectedVoucher?.ma_dt ||
              ""
            }
            ngayCt={
              pickupParams.ngayCt ||
              activeVoucher?.ngay_ct ||
              currentSelectedVoucher?.ngay_ct ||
              undefined
            }
            hiddenStts={pickupHiddenStts}
            optimisticSlip={pickupOptimisticSlip}
            refreshTrigger={pickupRefreshTrigger}
            focusStt={pickupFocusStt}
            onCreateWarehouseSlip={() => {
              void handleCreateWarehouseSlipFromPickup();
            }}
            onEditWarehouseSlip={(stt, preview) => {
              void handleEditWarehouseSlipFromPickup(stt, preview);
            }}
            onDeleteWarehouseSlip={(slip) => {
              setDeleteTarget({
                stt: slip.stt,
                so_ct: slip.so_ct,
                ma_dt: slip.ma_dt,
                ten_dt: slip.ten_dt,
                ngay_ct: slip.ngay_ct,
                dbMode: "warehouse",
                fromPickup: true,
              });
            }}
            onAccept={(selectedSlips, items, maXe) => {
              const primarySlip = selectedSlips[0];
              setPickupPayload({
                items,
                ma_xe: maXe,
                ma_dt: primarySlip?.ma_dt?.trim() || undefined,
                ngay_ct: primarySlip?.ngay_ct
                  ? primarySlip.ngay_ct.slice(0, 10)
                  : undefined,
              });
              if (!sttParam) {
                // If currently on list view, open new voucher form with pickup items
                navToNew();
              }
              showToast(`Đã lấy ${items.length} dòng hàng từ kho.`, "success");
            }}
          />
        </Suspense>
      )}

      {/* Overlay Thêm / Sửa Phiếu Kho (KH_2014: X1 hoặc N5) mở trực tiếp từ PickupDialog */}
      {warehouseOverlay && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col overflow-hidden shadow-2xl">
          <Suspense
            fallback={
              <div className="h-full w-full flex items-center justify-center bg-surface text-xs text-neutral-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                <span>Đang tải phiếu kho...</span>
              </div>
            }
          >
            {(() => {
              const overlayMaCt: "X1" | "N5" =
                (
                  warehouseOverlay.voucher?.ma_ct ||
                  warehouseOverlay.maCt ||
                  activeMaCt
                )
                  .trim()
                  .toUpperCase() === "N5"
                  ? "N5"
                  : "X1";
              return (
                <VoucherForm
                  key={`wh-overlay:${overlayMaCt}:${warehouseOverlay.mode}:${warehouseOverlay.stt || "new"}`}
                  stt={warehouseOverlay.stt}
                  mode={warehouseOverlay.mode}
                  voucherMode="warehouse"
                  maCt={overlayMaCt}
                  voucher={warehouseOverlay.voucher || null}
                  initialInherited={warehouseOverlay.initialInherited}
                  onBack={() => {
                    setWarehouseOverlay(null);
                  }}
                  onPrint={() => {}}
                  onViewDebt={(dt) => handleOpenDebt(dt)}
                  onOpenPickup={() => {}}
                  onSaveSuccess={(savedStt, savedVoucher) => {
                    const wasCreate = warehouseOverlay.mode === "M";
                    setWarehouseOverlay(null);
                    setPickupFocusStt(savedStt);
                    if (savedVoucher) {
                      // 0ms: cập nhật phiếu kho ngay trên bảng PickupDialog trước khi đồng bộ nền
                      const optSlip: PickupSlip = {
                        stt: savedStt,
                        ma_ct: savedVoucher.ma_ct || overlayMaCt,
                        so_ct: savedVoucher.so_ct,
                        ngay_ct: savedVoucher.ngay_ct,
                        ma_dt: savedVoucher.ma_dt,
                        ten_dt: savedVoucher.ten_dt || "",
                        dia_chi: savedVoucher.dia_chi || "",
                        ma_xe: savedVoucher.ma_xe || "",
                        total_items: savedVoucher.items.length,
                        total_so_tam: savedVoucher.items.reduce(
                          (s, it) => s + (Number(it.so_tam) || 0),
                          0,
                        ),
                        total_so_luong9: savedVoucher.items.reduce(
                          (s, it) => s + (Number(it.so_luong9) || 0),
                          0,
                        ),
                      };
                      const optItems: PickupItem[] = savedVoucher.items.map(
                        (it, i) => ({
                          stt: savedStt,
                          stt0: it.stt0 || String(i),
                          ma_kho: it.ma_kho || "K0101",
                          ma_vt: (it.ma_vt || "").trim(),
                          ten_vt: it.ten_vt || "",
                          dvt: it.dvt || "",
                          dvt_ban: it.dvt_ban || "",
                          loai_vt: it.loai_vt || "1",
                          so_tam: Number(it.so_tam) || 0,
                          he_so8: Number(it.he_so8) || 1,
                          so_luong8: Number(it.so_luong8) || 0,
                          so_luong9: Number(it.so_luong9) || 0,
                        }),
                      );
                      setPickupOptimisticSlip({
                        slip: optSlip,
                        items: optItems,
                        version: Date.now(),
                      });
                    }
                    setPickupRefreshTrigger((prev) => prev + 1);
                    const slipLabel =
                      overlayMaCt === "N5"
                        ? "phiếu nhập lại kho"
                        : "phiếu xuất kho";
                    showToast(
                      wasCreate
                        ? `Đã tạo mới ${slipLabel} ${savedVoucher?.so_ct || ""} thành công.`
                        : `Đã cập nhật ${slipLabel} ${savedVoucher?.so_ct || ""} thành công.`,
                      "success",
                    );
                  }}
                />
              );
            })()}
          </Suspense>
        </div>
      )}

      {isDebtOpen && (
        <Suspense fallback={null}>
          <DebtPanel
            isOpen={isDebtOpen}
            onClose={() => setIsDebtOpen(false)}
            maDt={debtMaDt}
            onVoucherSaved={(savedStt, savedVoucher) => {
              if (savedVoucher && voucherMode !== "warehouse") {
                optimisticUpsertVoucher(savedVoucher, false);
              } else {
                if (savedStt) invalidatePrintCache(savedStt);
                refresh({ silent: vouchers.length > 0 });
              }
              showToast("Đã cập nhật chứng từ từ sổ công nợ.", "success");
            }}
          />
        </Suspense>
      )}

      {isShortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsDialog
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        </Suspense>
      )}
      </div>

      {isPrintOpen && (
        <Suspense fallback={null}>
          <PrintPreview
            isOpen={isPrintOpen}
            onClose={() => {
              setIsPrintOpen(false);
              pendingClearMarkedRef.current = false;
            }}
            onPrintComplete={() => {
              if (pendingClearMarkedRef.current) {
                pendingClearMarkedRef.current = false;
                setMarked(new Set());
              }
            }}
            onError={(msg) => showToast(msg, "error")}
            stts={printStts}
            inGia={printInGia ?? printPrice}
            copies={printCopies}
            mode={printMode}
            dbMode={apiDbMode}
          />
        </Suspense>
      )}
    </>
  );
}

export default App;
