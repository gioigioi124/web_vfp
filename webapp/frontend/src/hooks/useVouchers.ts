import { useState, useEffect, useCallback, useRef } from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherFullDetail,
  VoucherFilterParams,
  VoucherPagination,
  VoucherSummaryTotals,
} from "../types/voucher";
import { getTodayDate } from "../lib/format";
import { cachedFetch, peek, invalidate } from "../lib/apiCache";
import {
  invalidatePrintCache,
  prefetchPrintPayload,
  preloadPrintLogo,
} from "../lib/printCache";

/**
 * Khóa cache cho từng loại tài nguyên.
 * Nhờ khóa tách biệt, khi mở form (1 phiếu) chỉ cần làm mới đúng phiếu đó,
 * KHÔNG phải tải lại toàn bộ danh sách (list).
 */
const listKey = (mode: "sales" | "warehouse", f: VoucherFilterParams) =>
  `list:${mode}:${f.ma_ct || ""}:${f.ngay_ct1 || ""}:${f.ngay_ct2 || ""}:${f.so_ct1 || ""}:${
    f.so_ct2 || ""
  }:${f.ma_dt || ""}:${f.ma_kho || ""}:${f.ma_vt || ""}:${f.ma_tte || ""}:${
    f.dien_giai || ""
  }:${f.page || 1}:${f.page_size || 50}`;
const voucherKey = (mode: "sales" | "warehouse", stt: string) =>
  `voucher:${mode}:${stt}`;
const debtKey = (maDt: string) => `debt:${maDt}`;

export function useVouchers() {
  const [voucherMode, setVoucherModeState] = useState<"sales" | "warehouse">(
    "sales",
  );
  const [vouchers, setVouchers] = useState<VoucherHeader[]>([]);
  const [pagination, setPagination] = useState<VoucherPagination>({
    page: 1,
    page_size: 50,
    total_records: 0,
    total_pages: 1,
    has_next: false,
  });
  const [summary, setSummary] = useState<VoucherSummaryTotals>({
    total_ttien_nt: 0,
    total_ttien_nt2: 0,
    total_ttien_nt3: 0,
    total_ttien_nt4: 0,
    total_ttien_nt0: 0,
    total_ttien: 0,
    total_ttien2: 0,
    total_ttien3: 0,
    total_ttien4: 0,
    total_ttien0: 0,
  });
  const today = getTodayDate();
  const [filters, setFilters] = useState<VoucherFilterParams>({
    ma_ct: "X1",
    ngay_ct1: today,
    ngay_ct2: today,
    page: 1,
    page_size: 50,
  });
  const [selectedStt, setSelectedStt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Chi tiết của dòng đang chọn cho pane dưới (ctbhh Grid2 / K_CtTemp)
  const [listDetail, setListDetail] = useState<VoucherDetail[]>([]);
  const [listDetailLoading, setListDetailLoading] = useState<boolean>(false);
  // Dư nợ khách hàng của chứng từ đang chọn (hiển thị trên thanh splitter)
  const [debtAmount, setDebtAmount] = useState<number | null>(null);

  // Active detailed voucher
  const [activeVoucher, setActiveVoucher] = useState<VoucherFullDetail | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modal dialog states
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isPickupOpen, setIsPickupOpen] = useState<boolean>(false);
  const [isDebtOpen, setIsDebtOpen] = useState<boolean>(false);
  const [printStts, setPrintStts] = useState<string[]>([]);
  const [printInGia, setPrintInGia] = useState<"1" | "0" | undefined>(undefined);
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [printMode, setPrintMode] = useState<"direct" | "preview">("direct");
  const [debtMaDt, setDebtMaDt] = useState<string>("");

  const applyListData = useCallback((data: any) => {
    if (data.success && data.data) {
      const items: VoucherHeader[] = data.data.items || [];
      setVouchers(items);
      setPagination(data.data.pagination);
      setSummary(data.data.summary);
      setSelectedStt((prev) =>
        items.some((it) => it.stt === prev)
          ? prev
          : items.length > 0
            ? items[items.length - 1].stt
            : null,
      );
    } else {
      setVouchers([]);
      setPagination({
        page: 1,
        page_size: 50,
        total_records: 0,
        total_pages: 1,
        has_next: false,
      });
      setSelectedStt(null);
    }
  }, []);

  const fetchVouchers = useCallback(
    async (opts: { force?: boolean; silent?: boolean } = {}) => {
      const key = listKey(voucherMode, filters);
      const cached = peek<any>(key);
      // SWR: có cache → hiển thị ngay.
      if (cached) {
        applyListData(cached);
      }
      // silent: làm mới ngầm, KHÔNG hiện spinner (dùng khi click grid).
      if (!opts.silent) {
        setLoading((prev) => (cached && !opts.force ? prev : true));
      }
      try {
        const q = new URLSearchParams();
        if (filters.ma_ct) q.append("ma_ct", filters.ma_ct);
        if (filters.ngay_ct1) q.append("ngay_ct1", filters.ngay_ct1);
        if (filters.ngay_ct2) q.append("ngay_ct2", filters.ngay_ct2);
        if (filters.so_ct1) q.append("so_ct1", filters.so_ct1);
        if (filters.so_ct2) q.append("so_ct2", filters.so_ct2);
        if (filters.ma_dt) q.append("ma_dt", filters.ma_dt);
        if (filters.ma_kho) q.append("ma_kho", filters.ma_kho);
        if (filters.ma_vt) q.append("ma_vt", filters.ma_vt);
        if (filters.ma_tte) q.append("ma_tte", filters.ma_tte);
        if (filters.dien_giai) q.append("dien_giai", filters.dien_giai);
        q.append("page", String(filters.page || 1));
        q.append("page_size", String(filters.page_size || 50));
        q.append("db_mode", voucherMode);

        const data = await cachedFetch<any>(
          key,
          `/api/vouchers?${q.toString()}`,
          {
            force: opts.force,
          },
        );
        applyListData(data);
      } catch (err) {
        console.error("Error fetching vouchers list:", err);
        if (!cached) {
          setVouchers([]);
          setSelectedStt(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [voucherMode, filters, applyListData],
  );

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Ref giữ fetchVouchers và vouchers để effect chi tiết KHÔNG phụ thuộc chúng.
  const fetchVouchersRef = useRef(fetchVouchers);
  fetchVouchersRef.current = fetchVouchers;
  const vouchersRef = useRef(vouchers);
  vouchersRef.current = vouchers;
  const lastHiddenAtRef = useRef<number>(0);

  // Tự động làm mới ngầm danh sách khi người dùng quay lại tab sau >= 30s
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now();
      } else if (
        document.visibilityState === "visible" &&
        lastHiddenAtRef.current > 0 &&
        Date.now() - lastHiddenAtRef.current >= 30_000
      ) {
        lastHiddenAtRef.current = 0;
        invalidate("list:");
        void fetchVouchersRef.current({ force: true, silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // ===== Nạp chi tiết dòng hàng + dư nợ của dòng đang chọn (SWR + song song + debounce 100ms) =====
  useEffect(() => {
    if (!selectedStt) {
      setListDetail([]);
      setDebtAmount(null);
      setListDetailLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const vKey = voucherKey(voucherMode, selectedStt);

    // 1) Đọc ma_dt tức thì từ danh sách header hiện có để gọi detail + debt SONG SONG
    const headerRow = vouchersRef.current.find((v) => v.stt === selectedStt);
    const knownMaDt = (headerRow?.ma_dt || "").trim();

    // 2) SWR: nếu đã có cache RAM, hiển thị tức thì (0ms) không chờ debounce/mạng
    const cachedDetail = peek<any>(vKey);
    const hasCachedDetail = Boolean(cachedDetail?.success && cachedDetail.data);
    if (hasCachedDetail) {
      setListDetail(cachedDetail.data.items || []);
    }
    const maDtForCache = knownMaDt || (cachedDetail?.data?.ma_dt || "").trim();
    if (maDtForCache && voucherMode === "sales") {
      const cachedDebt = peek<any>(debtKey(maDtForCache));
      if (cachedDebt?.success && cachedDebt.data) {
        setDebtAmount(cachedDebt.data.du_cuoi ?? null);
      }
    } else if (voucherMode !== "sales") {
      setDebtAmount(null);
    }

    // 3) Debounce 100ms khi lướt phím mũi tên nhanh qua nhiều dòng liên tiếp
    const debounceMs = hasCachedDetail ? 0 : 100;
    const fetchTimer = window.setTimeout(() => {
      if (cancelled) return;

      // Nạp ngầm bản in & logo sau khi người dùng dừng ở dòng này (dùng TTL 15s, không force)
      preloadPrintLogo();
      prefetchPrintPayload(voucherMode, selectedStt, false);

      const loadDetail = async () => {
        if (!hasCachedDetail) setListDetailLoading(true);
        try {
          const detailPromise = cachedFetch<any>(
            vKey,
            `/api/vouchers/${encodeURIComponent(selectedStt)}?db_mode=${encodeURIComponent(voucherMode)}`,
            { ttl: 10_000, signal: controller.signal },
          );

          const debtPromise =
            knownMaDt && voucherMode === "sales"
              ? cachedFetch<any>(
                  debtKey(knownMaDt),
                  `/api/debt/customer?ma_dt=${encodeURIComponent(knownMaDt)}`,
                  { ttl: 15_000, signal: controller.signal },
                ).catch(() => null)
              : Promise.resolve(null);

          const [detailData, debtData] = await Promise.all([
            detailPromise,
            debtPromise,
          ]);
          if (cancelled) return;

          if (detailData?.success && detailData.data) {
            setListDetail(detailData.data.items || []);
            const resolvedMaDt = (detailData.data.ma_dt || "").trim();
            if (voucherMode !== "sales" || !resolvedMaDt) {
              setDebtAmount(null);
            } else if (debtData?.success && debtData.data) {
              setDebtAmount(debtData.data.du_cuoi ?? null);
            } else if (!knownMaDt && resolvedMaDt) {
              // Fallback hiếm khi header chưa có ma_dt
              try {
                const ddata = await cachedFetch<any>(
                  debtKey(resolvedMaDt),
                  `/api/debt/customer?ma_dt=${encodeURIComponent(resolvedMaDt)}`,
                  { ttl: 15_000, signal: controller.signal },
                );
                if (!cancelled && ddata?.success && ddata.data) {
                  setDebtAmount(ddata.data.du_cuoi ?? null);
                }
              } catch {
                if (!cancelled) setDebtAmount(null);
              }
            }
          }
        } catch (err: any) {
          if (cancelled || err?.name === "AbortError") return;
          if (err?.status === 404) {
            console.warn(
              `Voucher ${selectedStt} không tồn tại, tải lại danh sách.`,
            );
            setListDetail([]);
            setDebtAmount(null);
            invalidate("list:");
            void fetchVouchersRef.current({ force: true });
          } else {
            console.error(`Error fetching list detail for ${selectedStt}:`, err);
            if (!hasCachedDetail) {
              setListDetail([]);
              setDebtAmount(null);
            }
          }
        } finally {
          if (!cancelled) setListDetailLoading(false);
        }
      };

      void loadDetail();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(fetchTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStt, voucherMode]);

  const fetchVoucherDetail = async (stt: string): Promise<boolean> => {
    setLoadingDetail(true);
    try {
      const data = await cachedFetch<any>(
        voucherKey(voucherMode, stt),
        `/api/vouchers/${encodeURIComponent(stt)}?db_mode=${encodeURIComponent(voucherMode)}`,
        { force: true },
      );
      if (data.success && data.data) {
        setActiveVoucher(data.data);
        return true;
      }
      return false;
    } catch (err: any) {
      if (err?.status === 404) {
        // Phiếu đã bị người khác xóa → tải lại danh sách và đóng form.
        console.warn(
          `Voucher ${stt} không tồn tại, đóng form và tải lại danh sách.`,
        );
        setActiveVoucher(null);
        invalidate("list:");
        fetchVouchers({ force: true });
      } else {
        console.error(`Error fetching voucher detail for ${stt}:`, err);
      }
      return false;
    } finally {
      setLoadingDetail(false);
    }
  };

  // Mở form chi tiết. Luôn fetch mới phiếu đang mở (để lấy dữ liệu mới nhất);
  // nếu phiếu đã bị xóa (404) → đóng form + tải lại danh sách.
  const handleOpenDetail = async (stt: string) => {
    setSelectedStt(stt);
    // Hiển thị tức thì từ cache (nếu có) để không nháy trắng, rồi fetch mới.
    const cachedVoucher = peek<any>(voucherKey(voucherMode, stt));
    if (cachedVoucher?.success && cachedVoucher.data) {
      setActiveVoucher(cachedVoucher.data);
    }
    await fetchVoucherDetail(stt);
  };

  // Quay về từ trang chi tiết: đóng form và nạp ngầm danh sách (khi đã có dòng) để tránh nháy spinner.
  const handleCloseDetail = (opts?: { skipFetch?: boolean }) => {
    setActiveVoucher(null);
    invalidate("list:");
    invalidatePrintCache();
    if (!opts?.skipFetch) {
      fetchVouchers({ force: true, silent: vouchers.length > 0 });
    }
  };

  const handleApplyFilter = (newFilters: VoucherFilterParams) => {
    // Bộ lọc đổi → dữ liệu danh sách cũ không còn hợp lệ, xóa cache list.
    invalidate("list:");
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1,
    }));
  };

  const handleChangePage = (page: number) => {
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  // Làm mới có chủ đích (nút refresh / F5 hoặc sau khi lưu): xóa cache để lấy dữ liệu mới.
  const refresh = useCallback(
    (opts?: { silent?: boolean }) => {
      invalidate();
      fetchVouchers({ force: true, silent: opts?.silent });
    },
    [fetchVouchers],
  );

  const handleOpenPrint = (
    target: string | string[],
    options?: {
      inGia?: "1" | "0";
      copies?: number;
      mode?: "direct" | "preview";
    },
  ) => {
    const list = (Array.isArray(target) ? target : [target])
      .map((s) => (s || "").trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setPrintStts(list);
    setPrintInGia(options?.inGia);
    setPrintCopies(
      options?.copies && options.copies > 1 ? Math.floor(options.copies) : 1,
    );
    setPrintMode(options?.mode === "preview" ? "preview" : "direct");
    setIsPrintOpen(true);
  };

  const handleOpenDebt = (maDt: string) => {
    setDebtMaDt(maDt);
    setIsDebtOpen(true);
  };

  const setVoucherMode = useCallback(
    (mode: "sales" | "warehouse") => {
      if (mode === voucherMode) return;
      setActiveVoucher(null);
      setSelectedStt(null);
      setListDetail([]);
      setDebtAmount(null);
      setVoucherModeState(mode);
    },
    [voucherMode],
  );

  return {
    voucherMode,
    setVoucherMode,
    vouchers,
    pagination,
    summary,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    listDetail,
    listDetailLoading,
    debtAmount,
    activeVoucher,
    loadingDetail,
    handleOpenDetail,
    handleCloseDetail,
    isFilterOpen,
    setIsFilterOpen,
    handleApplyFilter,
    handleChangePage,
    fetchVouchers,
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
  };
}
