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

/**
 * Khóa cache cho từng loại tài nguyên.
 * Nhờ khóa tách biệt, khi mở form (1 phiếu) chỉ cần làm mới đúng phiếu đó,
 * KHÔNG phải tải lại toàn bộ danh sách (list).
 */
const listKey = (f: VoucherFilterParams) =>
  `list:${f.ma_ct || ""}:${f.ngay_ct1 || ""}:${f.ngay_ct2 || ""}:${f.so_ct1 || ""}:${
    f.so_ct2 || ""
  }:${f.ma_dt || ""}:${f.ma_kho || ""}:${f.ma_vt || ""}:${f.ma_tte || ""}:${
    f.page || 1
  }:${f.page_size || 50}`;
const voucherKey = (stt: string) => `voucher:${stt}`;
const debtKey = (maDt: string) => `debt:${maDt}`;

export function useVouchers() {
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
  const [printStt, setPrintStt] = useState<string>("");
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
            ? items[0].stt
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
      const key = listKey(filters);
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
        q.append("page", String(filters.page || 1));
        q.append("page_size", String(filters.page_size || 50));

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
    [filters, applyListData],
  );

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Ref giữ fetchVouchers để effect chi tiết KHÔNG phụ thuộc nó (tránh chạy lại
  // khi filters đổi). Effect chỉ chạy khi selectedStt đổi (click grid).
  const fetchVouchersRef = useRef(fetchVouchers);
  fetchVouchersRef.current = fetchVouchers;

  // ===== Nạp chi tiết dòng hàng của dòng đang chọn cho pane dưới (ctbhh Grid2) =====
  // Chạy khi click vào grid (selectedStt đổi) hoặc khi quay về từ trang chi tiết.
  // Đồng thời làm mới NGẦM danh sách để phiếu mới (do người khác tạo) xuất hiện.
  useEffect(() => {
    if (!selectedStt) {
      setListDetail([]);
      setDebtAmount(null);
      return;
    }
    let cancelled = false;

    // Làm mới ngầm danh sách (không nháy spinner) để bắt phiếu mới/thay đổi.
    invalidate("list:");
    fetchVouchersRef.current({ force: true, silent: true });

    (async () => {
      setListDetailLoading(true);
      try {
        const data = await cachedFetch<any>(
          voucherKey(selectedStt),
          `/api/vouchers/${encodeURIComponent(selectedStt)}`,
          { force: true },
        );
        if (cancelled) return;
        if (data.success && data.data) {
          setListDetail(data.data.items || []);
          const maDt = data.data.ma_dt;
          if (maDt) {
            try {
              const ddata = await cachedFetch<any>(
                debtKey(maDt),
                `/api/debt/customer?ma_dt=${encodeURIComponent(maDt)}`,
                { force: true },
              );
              if (!cancelled && ddata.success && ddata.data) {
                setDebtAmount(ddata.data.du_cuoi ?? null);
              }
            } catch {
              if (!cancelled) setDebtAmount(null);
            }
          } else {
            setDebtAmount(null);
          }
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.status === 404) {
          // Phiếu không còn tồn tại (bị người khác xóa/sửa Stt) → nạp lại danh sách.
          console.warn(
            `Voucher ${selectedStt} không tồn tại, tải lại danh sách.`,
          );
          setListDetail([]);
          setDebtAmount(null);
          invalidate("list:");
          fetchVouchersRef.current({ force: true });
        } else {
          console.error(`Error fetching list detail for ${selectedStt}:`, err);
          setListDetail([]);
          setDebtAmount(null);
        }
      } finally {
        if (!cancelled) setListDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStt]);

  const fetchVoucherDetail = async (stt: string): Promise<boolean> => {
    setLoadingDetail(true);
    try {
      const data = await cachedFetch<any>(
        voucherKey(stt),
        `/api/vouchers/${encodeURIComponent(stt)}`,
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
    const cachedVoucher = peek<any>(voucherKey(stt));
    if (cachedVoucher?.success && cachedVoucher.data) {
      setActiveVoucher(cachedVoucher.data);
    }
    await fetchVoucherDetail(stt);
  };

  // Quay về từ trang chi tiết: đóng form và nạp lại danh sách + chi tiết dòng chọn.
  const handleCloseDetail = () => {
    setActiveVoucher(null);
    invalidate("list:");
    fetchVouchers({ force: true });
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

  // Làm mới có chủ đích (nút refresh / F5): xóa cache để lấy dữ liệu mới.
  const refresh = useCallback(() => {
    invalidate();
    fetchVouchers({ force: true });
  }, [fetchVouchers]);

  const handleOpenPrint = (stt: string) => {
    setPrintStt(stt);
    setIsPrintOpen(true);
  };

  const handleOpenDebt = (maDt: string) => {
    setDebtMaDt(maDt);
    setIsDebtOpen(true);
  };

  return {
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
    printStt,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  };
}
