import { useState, useEffect, useCallback, useRef } from "react";
import {
  VoucherHeader,
  VoucherDetail,
  VoucherFullDetail,
  VoucherFilterParams,
  VoucherPagination,
  VoucherSummaryTotals,
  VoucherMode,
} from "../types/voucher";
import { getTodayDate } from "../lib/format";
import {
  cachedFetch,
  peek,
  isFresh,
  invalidate,
  prime,
  removeKey,
} from "../lib/apiCache";
import {
  invalidatePrintCache,
  prefetchPrintPayload,
  preloadPrintLogo,
} from "../lib/printCache";
import {
  broadcastVoucherMutation,
  subscribeVoucherMutations,
} from "../lib/syncChannel";

const toDbMode = (mode: VoucherMode): "sales" | "warehouse" =>
  mode === "warehouse" ? "warehouse" : "sales";

/**
 * Khóa cache cho từng loại tài nguyên.
 * Nhờ khóa tách biệt, khi mở form (1 phiếu) chỉ cần làm mới đúng phiếu đó,
 * KHÔNG phải tải lại toàn bộ danh sách (list).
 */
const listKey = (mode: VoucherMode, f: VoucherFilterParams) =>
  `list:${mode}:${f.ma_ct || ""}:${f.ngay_ct1 || ""}:${f.ngay_ct2 || ""}:${f.so_ct1 || ""}:${
    f.so_ct2 || ""
  }:${f.ma_dt || ""}:${f.ma_kho || ""}:${f.ma_vt || ""}:${f.ma_tte || ""}:${
    f.dien_giai || ""
  }:${f.page || 1}:${f.page_size || 50}`;
const voucherKey = (mode: VoucherMode, stt: string) =>
  `voucher:${toDbMode(mode)}:${stt}`;
const debtKey = (maDt: string) => `debt:${maDt}`;

function toHeaderRow(v: VoucherFullDetail): VoucherHeader {
  const { items: _items, ...header } = v;
  return header;
}

function applySummaryDelta(
  prev: VoucherSummaryTotals,
  add?: Partial<VoucherHeader> | null,
  sub?: Partial<VoucherHeader> | null,
): VoucherSummaryTotals {
  const d = (
    key:
      | "ttien_nt"
      | "ttien_nt2"
      | "ttien_nt3"
      | "ttien_nt4"
      | "ttien_nt0"
      | "ttien"
      | "ttien2"
      | "ttien3"
      | "ttien4"
      | "ttien0",
  ) => Number(add?.[key] || 0) - Number(sub?.[key] || 0);
  return {
    total_ttien_nt: prev.total_ttien_nt + d("ttien_nt"),
    total_ttien_nt2: prev.total_ttien_nt2 + d("ttien_nt2"),
    total_ttien_nt3: prev.total_ttien_nt3 + d("ttien_nt3"),
    total_ttien_nt4: prev.total_ttien_nt4 + d("ttien_nt4"),
    total_ttien_nt0: prev.total_ttien_nt0 + d("ttien_nt0"),
    total_ttien: prev.total_ttien + d("ttien"),
    total_ttien2: prev.total_ttien2 + d("ttien2"),
    total_ttien3: prev.total_ttien3 + d("ttien3"),
    total_ttien4: prev.total_ttien4 + d("ttien4"),
    total_ttien0: prev.total_ttien0 + d("ttien0"),
  };
}

function matchesActiveFilters(
  v: VoucherHeader,
  f: VoucherFilterParams,
): boolean {
  if (f.ma_ct && (v.ma_ct || "").trim().toUpperCase() !== f.ma_ct.trim().toUpperCase()) {
    return false;
  }
  const d = (v.ngay_ct || "").slice(0, 10);
  if (f.ngay_ct1 && d && d < f.ngay_ct1) return false;
  if (f.ngay_ct2 && d && d > f.ngay_ct2) return false;
  if (
    f.ma_dt &&
    !(v.ma_dt || "").toUpperCase().includes(f.ma_dt.trim().toUpperCase())
  ) {
    return false;
  }
  if (
    f.dien_giai &&
    !(v.dien_giai0 || "").toLowerCase().includes(f.dien_giai.trim().toLowerCase())
  ) {
    return false;
  }
  return true;
}

export function useVouchers() {
  const [voucherMode, setVoucherModeState] = useState<VoucherMode>("sales");
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
      const dbMode = toDbMode(voucherMode);
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
        q.append("db_mode", dbMode);

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

  // Ref giữ state mới nhất cho optimistic mutations & effects (tránh stale closure).
  const fetchVouchersRef = useRef(fetchVouchers);
  fetchVouchersRef.current = fetchVouchers;
  const vouchersRef = useRef(vouchers);
  vouchersRef.current = vouchers;
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const selectedSttRef = useRef(selectedStt);
  selectedSttRef.current = selectedStt;
  const listDetailRef = useRef(listDetail);
  listDetailRef.current = listDetail;
  const debtAmountRef = useRef(debtAmount);
  debtAmountRef.current = debtAmount;
  const voucherModeRef = useRef(voucherMode);
  voucherModeRef.current = voucherMode;
  const lastHiddenAtRef = useRef<number>(0);

  // Highlight tạm thời dòng vừa tạo mới / cập nhật để người dùng thấy phản hồi tức thì
  const [flashStt, setFlashStt] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const triggerFlash = useCallback((stt: string) => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashStt(stt);
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashStt(null);
    }, 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  // Đồng bộ tức thì khi tab trình duyệt khác vừa thêm / sửa / xóa chứng từ
  useEffect(() => {
    return subscribeVoucherMutations((ev) => {
      invalidate("list:");
      removeKey(voucherKey(ev.mode, ev.stt));
      if (ev.ma_dt) invalidate(`debt:${ev.ma_dt.trim().toUpperCase()}`);
      invalidatePrintCache(ev.stt);
      if (ev.mode === voucherModeRef.current) {
        void fetchVouchersRef.current({ force: true, silent: true });
      }
    });
  }, []);

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
    const dbMode = toDbMode(voucherMode);
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
    if (maDtForCache && voucherMode !== "warehouse") {
      const cachedDebt = peek<any>(debtKey(maDtForCache));
      if (cachedDebt?.success && cachedDebt.data) {
        setDebtAmount(cachedDebt.data.du_cuoi ?? null);
      }
    } else if (voucherMode === "warehouse") {
      setDebtAmount(null);
    }

    // 3) Debounce 100ms khi lướt phím mũi tên nhanh qua nhiều dòng liên tiếp
    const debounceMs = hasCachedDetail ? 0 : 100;
    const fetchTimer = window.setTimeout(() => {
      if (cancelled) return;

      // Nạp ngầm bản in & logo sau khi người dùng dừng ở dòng này (dùng TTL 15s, không force)
      preloadPrintLogo();
      prefetchPrintPayload(dbMode, selectedStt, false);

      const loadDetail = async () => {
        if (!hasCachedDetail) setListDetailLoading(true);
        try {
          const detailPromise = cachedFetch<any>(
            vKey,
            `/api/vouchers/${encodeURIComponent(selectedStt)}?db_mode=${encodeURIComponent(dbMode)}`,
            { ttl: 10_000, signal: controller.signal },
          );

          const debtPromise =
            knownMaDt && voucherMode !== "warehouse"
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
            if (voucherMode === "warehouse" || !resolvedMaDt) {
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

  const fetchVoucherDetail = async (
    stt: string,
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    if (!opts?.silent) setLoadingDetail(true);
    try {
      const dbMode = toDbMode(voucherMode);
      const data = await cachedFetch<any>(
        voucherKey(voucherMode, stt),
        `/api/vouchers/${encodeURIComponent(stt)}?db_mode=${encodeURIComponent(dbMode)}`,
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
      if (!opts?.silent) setLoadingDetail(false);
    }
  };

  // Mở form chi tiết tức thì từ cache RAM (0ms), rồi chỉ revalidate ngầm (không hiện spinner chặn).
  const handleOpenDetail = async (stt: string) => {
    setSelectedStt(stt);
    const vKey = voucherKey(voucherMode, stt);
    const cachedVoucher = peek<any>(vKey);
    const hasCached = Boolean(cachedVoucher?.success && cachedVoucher.data);
    if (hasCached) {
      setActiveVoucher(cachedVoucher.data);
    }
    // Nếu cache vừa tải trong vòng 5s và đã đủ items → không cần chặn chờ mạng;
    // vẫn revalidate ngầm để phát hiện kịp nếu máy khác vừa sửa/xóa.
    const freshEnough = hasCached && isFresh(vKey, 5_000);
    await fetchVoucherDetail(stt, { silent: hasCached || freshEnough });
  };

  // Quay về từ trang chi tiết: đóng form và nạp ngầm danh sách (khi đã có dòng) để tránh nháy spinner.
  const handleCloseDetail = (opts?: { skipFetch?: boolean }) => {
    setActiveVoucher(null);
    if (!opts?.skipFetch) {
      invalidate("list:");
      invalidatePrintCache();
      fetchVouchers({ force: true, silent: vouchers.length > 0 });
    }
  };

  /**
   * Cập nhật tức thì (0ms) danh sách, dòng tổng, cache chi tiết & bảng chi tiết đáy ngay sau khi lưu
   * (Thêm mới hoặc Sửa) — rồi đồng bộ ngầm với SQL Server mà không nháy spinner.
   */
  const optimisticUpsertVoucher = useCallback(
    (saved: VoucherFullDetail, isCreate: boolean) => {
      const mode = voucherModeRef.current;
      const headerRow = toHeaderRow(saved);
      const currList = vouchersRef.current;
      const existingIdx = currList.findIndex((v) => v.stt === saved.stt);
      const prevRow = existingIdx >= 0 ? currList[existingIdx] : null;
      const matches = matchesActiveFilters(headerRow, filtersRef.current);

      // 1) Seed RAM cache ngay lập tức để bấm xem/sửa lại không cần chờ GET /api/vouchers/{stt}
      prime(voucherKey(mode, saved.stt), { success: true, data: saved });
      setActiveVoucher(null);
      setSelectedStt(saved.stt);
      setListDetail(saved.items || []);
      setListDetailLoading(false);

      // 2) Patch danh sách & tổng tiền tại chỗ (0ms)
      if (existingIdx >= 0) {
        if (matches) {
          const nextList = [...currList];
          nextList[existingIdx] = headerRow;
          setVouchers(nextList);
          setSummary((prev) => applySummaryDelta(prev, headerRow, prevRow));
        } else {
          // Ngày hoặc khách hàng bị đổi ra khỏi bộ lọc đang xem
          const nextList = currList.filter((v) => v.stt !== saved.stt);
          setVouchers(nextList);
          setSummary((prev) => applySummaryDelta(prev, null, prevRow));
          setPagination((prev) => ({
            ...prev,
            total_records: Math.max(0, prev.total_records - 1),
          }));
        }
      } else if (matches) {
        const nextList = [...currList, headerRow];
        setVouchers(nextList);
        setSummary((prev) => applySummaryDelta(prev, headerRow, null));
        setPagination((prev) => {
          const total = prev.total_records + 1;
          const totalPages = Math.max(1, Math.ceil(total / (prev.page_size || 50)));
          return {
            ...prev,
            total_records: total,
            total_pages: totalPages,
            has_next: prev.page < totalPages,
          };
        });
      }

      triggerFlash(saved.stt);

      // 3) Xóa chọn lọc cache list & công nợ khách liên quan (KHÔNG xóa cache phiếu khác)
      invalidate("list:");
      if (saved.ma_dt) invalidate(`debt:${saved.ma_dt.trim().toUpperCase()}`);
      if (prevRow?.ma_dt && prevRow.ma_dt !== saved.ma_dt) {
        invalidate(`debt:${prevRow.ma_dt.trim().toUpperCase()}`);
      }
      invalidatePrintCache(saved.stt);
      prefetchPrintPayload(toDbMode(mode), saved.stt, true);

      // 4) Thông báo tab khác & đồng bộ ngầm với SQL Server
      broadcastVoucherMutation({
        action: isCreate ? "create" : "update",
        mode,
        stt: saved.stt,
        ma_dt: saved.ma_dt,
      });
      void fetchVouchersRef.current({ force: true, silent: true });
    },
    [triggerFlash],
  );

  /**
   * Xóa lạc quan (0ms): gỡ chứng từ khỏi bảng + trừ tổng tiền + chuyển chọn sang dòng kế cận ngay lập tức.
   * Trả về `commit()` khi API DELETE thành công và `rollback()` để hoàn tác nguyên trạng nếu lỗi.
   */
  const optimisticDeleteVoucher = useCallback((stt: string) => {
    const mode = voucherModeRef.current;
    const prevList = vouchersRef.current;
    const prevPagination = paginationRef.current;
    const prevSummary = summaryRef.current;
    const prevSelected = selectedSttRef.current;
    const prevDetail = listDetailRef.current;
    const prevDebt = debtAmountRef.current;
    const prevCachedDetail = peek<any>(voucherKey(mode, stt));

    const idx = prevList.findIndex((v) => v.stt === stt);
    const deletedRow = idx >= 0 ? prevList[idx] : undefined;

    if (idx >= 0) {
      const nextList = [...prevList.slice(0, idx), ...prevList.slice(idx + 1)];
      setVouchers(nextList);
      setSummary((s) => applySummaryDelta(s, null, deletedRow));
      setPagination((p) => {
        const total = Math.max(0, p.total_records - 1);
        const totalPages = Math.max(1, Math.ceil(total / (p.page_size || 50)));
        return {
          ...p,
          total_records: total,
          total_pages: totalPages,
          has_next: p.page < totalPages,
        };
      });

      if (prevSelected === stt) {
        const nextRow =
          nextList[Math.min(idx, nextList.length - 1)] || null;
        const nextStt = nextRow ? nextRow.stt : null;
        setSelectedStt(nextStt);
        if (nextStt) {
          const nextCached = peek<any>(voucherKey(mode, nextStt));
          if (nextCached?.success && nextCached.data) {
            setListDetail(nextCached.data.items || []);
          }
        } else {
          setListDetail([]);
          setDebtAmount(null);
        }
      }
    }

    removeKey(voucherKey(mode, stt));
    invalidatePrintCache(stt);

    return {
      deletedRow,
      commit: () => {
        invalidate("list:");
        if (deletedRow?.ma_dt) {
          invalidate(`debt:${deletedRow.ma_dt.trim().toUpperCase()}`);
        }
        broadcastVoucherMutation({
          action: "delete",
          mode,
          stt,
          ma_dt: deletedRow?.ma_dt,
        });
        void fetchVouchersRef.current({ force: true, silent: true });
      },
      rollback: () => {
        setVouchers(prevList);
        setPagination(prevPagination);
        setSummary(prevSummary);
        setSelectedStt(prevSelected);
        setListDetail(prevDetail);
        setDebtAmount(prevDebt);
        if (prevCachedDetail) {
          prime(voucherKey(mode, stt), prevCachedDetail);
        }
      },
    };
  }, []);

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
    (mode: VoucherMode) => {
      if (mode === voucherMode) return;
      setActiveVoucher(null);
      setSelectedStt(null);
      setListDetail([]);
      setDebtAmount(null);
      setVoucherModeState(mode);
      setFilters((prev) => ({
        ...prev,
        ma_ct: mode === "return" ? "N5" : "X1",
        page: 1,
      }));
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
    flashStt,
    listDetail,
    listDetailLoading,
    debtAmount,
    activeVoucher,
    loadingDetail,
    handleOpenDetail,
    handleCloseDetail,
    optimisticUpsertVoucher,
    optimisticDeleteVoucher,
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
