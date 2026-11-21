import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  PriceListDetailItem,
  PriceListHeader,
  PriceListItemsPageResponse,
  PriceListPageResponse,
} from "../../types/priceList";
import { formatCurrency, formatDate, getTodayDate } from "../../lib/format";
import { useIsMobile } from "../../hooks/useViewport";
import { MobileSheet } from "../ui/MobileSheet";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
import {
  PriceListExcelModal,
  PriceListExcelModalMode,
} from "./PriceListExcelModals";
import { PriceListFormModal } from "./PriceListFormModal";

type SortKey = "so_ct" | "ngay_ct" | "ma_dt" | "ma_vm" | "user_name" | "item_count";

const DETAIL_CHUNK_SIZE = 500;

export const PriceListWorkspace: React.FC = () => {
  const isMobile = useIsMobile();
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const today = getTodayDate();
  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [filterSoCt, setFilterSoCt] = useState("");
  const [filterMaVm, setFilterMaVm] = useState("");
  const [filterMaDt, setFilterMaDt] = useState("");

  const [headers, setHeaders] = useState<PriceListHeader[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [checkedStts, setCheckedStts] = useState<Set<string>>(new Set());

  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<PriceListDetailItem[]>([]);
  const [detailTotalCount, setDetailTotalCount] = useState(0);
  const [detailFilteredCount, setDetailFilteredCount] = useState(0);
  const [detailHasMore, setDetailHasMore] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingMoreDetail, setLoadingMoreDetail] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [debouncedDetailSearch, setDebouncedDetailSearch] = useState("");
  const [activeDetailRow, setActiveDetailRow] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey>("so_ct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Draggable split height ratio (%) & virtualized scroll containers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const masterAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const [topPct, setTopPct] = useState(52);
  const [draggingSplit, setDraggingSplit] = useState(false);

  // Modals & toast feedback
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [excelModal, setExcelModal] = useState<{
    open: boolean;
    mode: PriceListExcelModalMode;
  }>({ open: false, mode: "import-new" });
  const [formModal, setFormModal] = useState<{
    open: boolean;
    stt: string | null;
  }>({ open: false, stt: null });

  // Bulk Date / Bulk Copy inline modal
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    type: "date" | "copy" | null;
    ngayCt: string;
    ngayCt1: string;
    ngayCt2: string;
    userName: string;
  }>({
    type: null,
    ngayCt: today,
    ngayCt1: today,
    ngayCt2: "",
    userName: "ADMIN",
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setBanner({ type, text });
  }, []);

  const loadHeaders = useCallback(
    async (preserveActiveStt?: string | null, overridePage?: number) => {
      masterAbortRef.current?.abort();
      const ctrl = new AbortController();
      masterAbortRef.current = ctrl;

      const targetPage = overridePage ?? page;
      setLoadingList(true);
      try {
        const q = new URLSearchParams({
          page: String(targetPage),
          page_size: String(pageSize),
        });
        if (fromDate) q.set("from_date", fromDate);
        if (toDate) q.set("to_date", toDate);
        if (filterSoCt.trim()) q.set("so_ct", filterSoCt.trim());
        if (filterMaVm.trim()) q.set("ma_vm", filterMaVm.trim());
        if (filterMaDt.trim()) q.set("ma_dt", filterMaDt.trim());

        const res = await fetch(`/api/price-lists?${q.toString()}`, {
          signal: ctrl.signal,
        });
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.detail || "Không tải được danh sách bảng giá.");
        }
        const paged = body.data as PriceListPageResponse | PriceListHeader[];
        const rows: PriceListHeader[] = Array.isArray(paged)
          ? paged
          : Array.isArray(paged?.items)
            ? paged.items
            : [];
        setHeaders(rows);
        if (!Array.isArray(paged) && paged) {
          setTotalRecords(paged.total_records ?? rows.length);
          setTotalPages(paged.total_pages ?? 1);
          setPage(paged.page ?? targetPage);
        } else {
          setTotalRecords(rows.length);
          setTotalPages(1);
        }

        setCheckedStts((prev) => {
          const valid = new Set(rows.map((r) => r.stt));
          const next = new Set<string>();
          prev.forEach((s) => {
            if (valid.has(s)) next.add(s);
          });
          return next;
        });

        setActiveStt((prevActive) => {
          if (preserveActiveStt !== undefined) {
            return preserveActiveStt;
          }
          if (prevActive && rows.some((r) => r.stt === prevActive)) {
            return prevActive;
          }
          return rows[0]?.stt || null;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(
          "error",
          err instanceof Error ? err.message : "Lỗi tải danh sách bảng giá.",
        );
      } finally {
        if (!ctrl.signal.aborted) {
          setLoadingList(false);
        }
      }
    },
    [
      fromDate,
      toDate,
      filterSoCt,
      filterMaVm,
      filterMaDt,
      page,
      pageSize,
      showToast,
    ],
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, filterSoCt, filterMaVm, filterMaDt, pageSize]);

  // Debounced server-side Master fetch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHeaders();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [loadHeaders]);

  // Debounce detail search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDetailSearch(detailSearch.trim());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [detailSearch]);

  const loadDetailChunk = useCallback(
    async (stt: string | null, qStr: string, offset: number, append: boolean) => {
      if (!stt) {
        setActiveItems([]);
        setDetailTotalCount(0);
        setDetailFilteredCount(0);
        setDetailHasMore(false);
        return;
      }

      if (!append) {
        detailAbortRef.current?.abort();
      }
      const ctrl = new AbortController();
      if (!append) {
        detailAbortRef.current = ctrl;
        setLoadingDetail(true);
      } else {
        setLoadingMoreDetail(true);
      }

      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(DETAIL_CHUNK_SIZE),
        });
        if (qStr) params.set("q", qStr);

        const res = await fetch(
          `/api/price-lists/${encodeURIComponent(stt)}/items?${params.toString()}`,
          { signal: ctrl.signal },
        );
        const body = await res.json();
        if (!res.ok || !body?.success || !body?.data) {
          throw new Error(body?.detail || "Không tải được chi tiết bảng giá.");
        }
        const d = body.data as PriceListItemsPageResponse;
        setDetailTotalCount(d.total_count ?? 0);
        setDetailFilteredCount(d.filtered_count ?? 0);
        setDetailHasMore(Boolean(d.has_more));
        setActiveItems((prev) => (append ? [...prev, ...(d.items || [])] : d.items || []));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!append) {
          setActiveItems([]);
          setDetailTotalCount(0);
          setDetailFilteredCount(0);
          setDetailHasMore(false);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoadingDetail(false);
          setLoadingMoreDetail(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadDetailChunk(activeStt, debouncedDetailSearch, 0, false);
  }, [activeStt, debouncedDetailSearch, loadDetailChunk]);

  const handleLoadMoreDetail = useCallback(() => {
    if (!activeStt || !detailHasMore || loadingDetail || loadingMoreDetail) return;
    void loadDetailChunk(activeStt, debouncedDetailSearch, activeItems.length, true);
  }, [
    activeStt,
    detailHasMore,
    loadingDetail,
    loadingMoreDetail,
    loadDetailChunk,
    debouncedDetailSearch,
    activeItems.length,
  ]);

  // Auto-load next detail chunk when scrolling near the bottom of detail grid
  useEffect(() => {
    const el = detailScrollRef.current;
    if (!el || !detailHasMore) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
        handleLoadMoreDetail();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [detailHasMore, handleLoadMoreDetail]);

  // Drag split handler
  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPct(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => setDraggingSplit(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggingSplit]);

  const filteredHeaders = useMemo(() => {
    const list = [...headers];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "item_count") {
        cmp = (a.item_count || 0) - (b.item_count || 0);
      } else {
        const va = String(a[sortKey] || "");
        const vb = String(b[sortKey] || "");
        cmp = va.localeCompare(vb, "vi");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [headers, sortKey, sortDir]);

  const selectedHeaders = useMemo(
    () => headers.filter((h) => checkedStts.has(h.stt)),
    [headers, checkedStts],
  );

  const activeHeader = useMemo(
    () => headers.find((h) => h.stt === activeStt) || null,
    [headers, activeStt],
  );

  const filteredDetailItems = activeItems;

  const allFilteredChecked =
    filteredHeaders.length > 0 &&
    filteredHeaders.every((h) => checkedStts.has(h.stt));

  const toggleAllFiltered = () => {
    setCheckedStts((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) {
        filteredHeaders.forEach((h) => next.delete(h.stt));
      } else {
        filteredHeaders.forEach((h) => next.add(h.stt));
      }
      return next;
    });
  };

  const toggleRowCheck = (stt: string) => {
    setCheckedStts((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) next.delete(stt);
      else next.add(stt);
      return next;
    });
  };

  useEffect(() => {
    setActiveDetailRow(0);
  }, [activeStt, detailSearch]);

  const masterGrid = useVirtualExcelGrid({
    totalRows: filteredHeaders.length,
    scrollContainerRef: masterScrollRef,
    onSelectRow: (idx) => {
      const h = filteredHeaders[idx];
      if (h) setActiveStt(h.stt);
    },
    onEnterRow: (idx) => {
      const h = filteredHeaders[idx];
      if (h) setFormModal({ open: true, stt: h.stt });
    },
    onSpaceRow: (idx) => {
      const h = filteredHeaders[idx];
      if (h) toggleRowCheck(h.stt);
    },
  });

  const detailGrid = useVirtualExcelGrid({
    totalRows: filteredDetailItems.length,
    scrollContainerRef: detailScrollRef,
    onSelectRow: setActiveDetailRow,
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-35" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const handleDeleteOne = async (h: PriceListHeader) => {
    if (!window.confirm(`Xóa bảng giá "${h.so_ct || h.stt}" (${h.stt}) khỏi SQL?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/price-lists/${encodeURIComponent(h.stt)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.detail || "Không thể xóa bảng giá.");
      }
      showToast("success", `Đã xóa bảng giá ${h.so_ct || h.stt}.`);
      await loadHeaders(activeStt === h.stt ? null : activeStt);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi xóa bảng giá.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedHeaders.length === 0) return;
    if (
      !window.confirm(
        `Bạn có chắc muốn XÓA VĨNH VIỄN ${selectedHeaders.length} bảng giá đã chọn khỏi SQL?`,
      )
    ) {
      return;
    }
    setBulkSubmitting(true);
    try {
      for (const h of selectedHeaders) {
        const res = await fetch(`/api/price-lists/${encodeURIComponent(h.stt)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || `Lỗi xóa ${h.so_ct || h.stt}`);
        }
      }
      showToast("success", `Đã xóa ${selectedHeaders.length} bảng giá đã chọn.`);
      setCheckedStts(new Set());
      await loadHeaders(null);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi xóa hàng loạt.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    const targetStts =
      selectedHeaders.length > 0
        ? selectedHeaders.map((h) => h.stt)
        : activeStt
          ? [activeStt]
          : filteredHeaders.map((h) => h.stt);
    if (targetStts.length === 0) {
      showToast("error", "Không có bảng giá nào để xuất CSV.");
      return;
    }
    try {
      const res = await fetch("/api/price-lists/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stt_list: targetStts }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "Không thể xuất dữ liệu bảng giá.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bang_gia_${getTodayDate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(
        "success",
        `Đã xuất CSV (Streaming) cho ${targetStts.length} bảng giá.`,
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi xuất CSV.");
    }
  };

  const handleBulkActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkActionDialog.type || selectedHeaders.length === 0) return;

    setBulkSubmitting(true);
    try {
      const stt_list = selectedHeaders.map((h) => h.stt);
      if (bulkActionDialog.type === "date") {
        const res = await fetch("/api/price-lists/bulk-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stt_list,
            ngay_ct: bulkActionDialog.ngayCt,
            ngay_ct1: bulkActionDialog.ngayCt1 || bulkActionDialog.ngayCt,
            ngay_ct2: bulkActionDialog.ngayCt2 || null,
          }),
        });
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.detail || "Không thể đổi ngày hàng loạt.");
        }
        showToast(
          "success",
          `Đã cập nhật ngày cho ${body.data?.updated_count || stt_list.length} bảng giá.`,
        );
      } else {
        const res = await fetch("/api/price-lists/bulk-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stt_list,
            ngay_ct: bulkActionDialog.ngayCt,
            user_name: bulkActionDialog.userName.trim().toUpperCase() || "ADMIN",
          }),
        });
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.detail || "Không thể nhân bản bảng giá.");
        }
        showToast(
          "success",
          `Đã nhân bản ${body.data?.copied_count || stt_list.length} bảng giá (${body.data?.copied_items || 0} dòng chi tiết) sang ngày ${formatDate(bulkActionDialog.ngayCt)}.`,
        );
        // Nếu ngày mới nằm ngoài range lọc hiện tại thì mở rộng range để user thấy ngay bảng giá mới
        if (bulkActionDialog.ngayCt > toDate) setToDate(bulkActionDialog.ngayCt);
        if (bulkActionDialog.ngayCt < fromDate) setFromDate(bulkActionDialog.ngayCt);
      }
      setBulkActionDialog((prev) => ({ ...prev, type: null }));
      await loadHeaders();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi xử lý hàng loạt.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const activeFilterCount =
    (filterSoCt.trim() ? 1 : 0) +
    (filterMaVm.trim() ? 1 : 0) +
    (filterMaDt.trim() ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Toolbar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-3 md:px-4 py-2 md:py-2.5 space-y-2">
        {isMobile ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[13px] font-bold text-slate-900 truncate">
                    Bảng giá (BG / BG0)
                  </h1>
                  <p className="text-[11px] text-slate-500 truncate">
                    {filteredHeaders.length}/{totalRecords} bảng · {formatDate(fromDate)} – {formatDate(toDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMobileFilter(true)}
                  className="relative inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Lọc</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void loadHeaders()}
                  disabled={loadingList}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-700"
                  title="Tải lại"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterMaDt}
                  onChange={(e) => setFilterMaDt(e.target.value)}
                  placeholder="Tìm mã / tên KH..."
                  className="erp-input h-9 pl-8 w-full text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setFormModal({ open: true, stt: null })}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-white text-[12px] font-semibold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo</span>
              </button>
              <button
                type="button"
                onClick={() => setExcelModal({ open: true, mode: "import-new" })}
                className="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold shrink-0"
                title="Import Tạo Mới Excel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-[14px] font-bold text-slate-900 leading-tight">
                    Quản Lý Bảng Giá Bán (BG / BG0)
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Import Excel tạo mới, cập nhật giá, xóa hàng hóa hàng loạt, đổi ngày & nhân bản bảng giá
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void loadHeaders()}
                  disabled={loadingList}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
                  <span>Tải lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormModal({ open: true, stt: null })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo bảng giá</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExcelModal({ open: true, mode: "import-new" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Tạo Mới Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportCsv()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>Xuất CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-slate-500">Từ:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="erp-input h-7 text-[12px]"
                />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span className="text-slate-500">Đến:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="erp-input h-7 text-[12px]"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadHeaders()}
                className="px-2.5 h-7 rounded border border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/15"
              >
                Lọc ngày
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterSoCt}
                  onChange={(e) => setFilterSoCt(e.target.value)}
                  placeholder="Lọc Số CT..."
                  className="erp-input h-7 pl-7 w-32 text-[12px]"
                />
              </div>
              <input
                type="text"
                value={filterMaVm}
                onChange={(e) => setFilterMaVm(e.target.value)}
                placeholder="Lọc Mã vùng..."
                className="erp-input h-7 w-28 text-[12px]"
              />
              <input
                type="text"
                value={filterMaDt}
                onChange={(e) => setFilterMaDt(e.target.value)}
                placeholder="Lọc Mã / Tên KH..."
                className="erp-input h-7 w-40 text-[12px]"
              />
              <span className="ml-auto text-[11px] text-slate-500">
                Trang <strong>{page}/{totalPages}</strong> · <strong>{filteredHeaders.length}</strong> / {totalRecords} bảng giá
              </span>
            </div>
          </>
        )}

        {/* Bulk Action Bar */}
        {selectedHeaders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px]">
            <span className="font-semibold text-sky-900">
              Đã tích chọn {selectedHeaders.length} bảng giá:
            </span>
            <button
              type="button"
              onClick={() =>
                setBulkActionDialog({
                  type: "date",
                  ngayCt: today,
                  ngayCt1: today,
                  ngayCt2: "",
                  userName: "ADMIN",
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 font-medium"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Đổi ngày</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setBulkActionDialog({
                  type: "copy",
                  ngayCt: today,
                  ngayCt1: today,
                  ngayCt2: "",
                  userName: "ADMIN",
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 font-medium"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Nhân bản sang ngày mới</span>
            </button>
            <button
              type="button"
              onClick={() => setExcelModal({ open: true, mode: "import-update" })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Cập nhật giá Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setExcelModal({ open: true, mode: "delete-items" })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa HH từ Excel</span>
            </button>
            <button
              type="button"
              disabled={bulkSubmitting}
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 font-medium disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa bảng giá</span>
            </button>
            <button
              type="button"
              onClick={() => setCheckedStts(new Set())}
              className="ml-auto text-[11px] text-slate-600 hover:text-slate-900 underline"
            >
              Bỏ chọn
            </button>
          </div>
        )}

        {banner && (
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-[12px] ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-[11px] underline opacity-75 hover:opacity-100 ml-3"
            >
              Đóng
            </button>
          </div>
        )}
      </header>

      {/* Split Pane Body (Desktop) / Card List (Mobile) */}
      {isMobile ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 pb-safe">
          {loadingList && headers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Đang tải dữ liệu bảng giá...
            </div>
          ) : filteredHeaders.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Không có bảng giá nào trong khoảng thời gian / điều kiện lọc này.
            </div>
          ) : (
            <>
              {filteredHeaders.map((h) => {
                const isActive = h.stt === activeStt;
                const isChecked = checkedStts.has(h.stt);
                const isClosed = h.closed === "1";
                const isExpired = Boolean(h.ngay_ct2 && h.ngay_ct2 < today);
                const statusLabel = isClosed
                  ? "Đã đóng"
                  : isExpired
                    ? "Hết hạn"
                    : "Đang áp dụng";
                return (
                  <div
                    key={h.stt}
                    onClick={() => {
                      setActiveStt(h.stt);
                      setShowMobileDetail(true);
                    }}
                    className={`rounded-xl border bg-white p-3 shadow-xs transition-colors active:bg-slate-50 ${
                      isActive ? "border-primary ring-1 ring-primary/30" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowCheck(h.stt);
                          }}
                          className="mt-0.5 w-6 h-6 rounded border border-slate-300 flex items-center justify-center shrink-0 bg-white"
                          aria-label="Chọn bảng giá"
                        >
                          {isChecked && (
                            <span className="w-3.5 h-3.5 rounded-sm bg-primary block" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[13px] font-bold text-primary-700">
                              {h.so_ct || "(Trống)"}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                isClosed
                                  ? "bg-slate-100 text-slate-600"
                                  : isExpired
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-[12px] text-slate-700 font-medium truncate mt-0.5">
                            {h.ma_dt
                              ? `${h.ma_dt}${h.ten_dt ? ` · ${h.ten_dt}` : ""}`
                              : h.ma_vm
                                ? `Vùng: ${h.ma_vm}`
                                : "Bảng giá chung"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatDate(h.ngay_ct)}
                        </div>
                        <div className="text-[11px] font-mono font-semibold text-slate-800 mt-0.5">
                          {h.item_count ?? 0} HH
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {h.ngay_ct2 ? `Hết hạn: ${formatDate(h.ngay_ct2)}` : "Vô thời hạn"}
                        {h.ma_vm ? ` · Vùng ${h.ma_vm}` : ""}
                      </span>
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setFormModal({ open: true, stt: h.stt })}
                          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOne(h)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                          title="Xóa bảng giá"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 py-2 px-1 text-[12px] text-slate-600">
                  <button
                    type="button"
                    disabled={page <= 1 || loadingList}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 h-9 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                  >
                    Trang trước
                  </button>
                  <span className="font-mono">
                    Trang {page}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || loadingList}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 h-9 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Top Pane: BG Headers */}
        <section
          style={{ height: `${topPct}%` }}
          className="min-h-[140px] flex flex-col overflow-hidden bg-white border-b border-slate-200"
        >
          <div
            ref={masterScrollRef}
            className="flex-1 min-h-0 overflow-auto table-sticky-header"
          >
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
            <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
              <tr>
                <th
                  className="w-9 text-center border-r border-neutral-200"
                  scope="col"
                  title="Chọn tất cả dòng đang lọc (Space để đánh dấu từng dòng)"
                >
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    onChange={toggleAllFiltered}
                    className="w-3.5 h-3.5 accent-tertiary-600 cursor-pointer align-middle"
                  />
                </th>
                <th
                  onClick={() => toggleSort("so_ct")}
                  className="border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    Số CT {renderSortIcon("so_ct")}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("ngay_ct")}
                  className="w-28 text-center border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    Ngày CT {renderSortIcon("ngay_ct")}
                  </span>
                </th>
                <th className="w-28 text-center border-r border-neutral-200">Hết hạn (CT2)</th>
                <th
                  onClick={() => toggleSort("ma_dt")}
                  className="min-w-[220px] border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    Khách hàng (Mã ĐT) {renderSortIcon("ma_dt")}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("ma_vm")}
                  className="w-28 text-center border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    Khu vực {renderSortIcon("ma_vm")}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("item_count")}
                  className="w-24 text-right border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    Số HH {renderSortIcon("item_count")}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("user_name")}
                  className="w-24 text-center border-r border-neutral-200 cursor-pointer select-none hover:bg-neutral-200/70"
                >
                  <span className="inline-flex items-center gap-1">
                    User {renderSortIcon("user_name")}
                  </span>
                </th>
                <th className="w-28 text-center border-r border-neutral-200">Trạng thái</th>
                <th className="text-center w-20">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {loadingList && headers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Đang tải dữ liệu bảng giá...
                  </td>
                </tr>
              ) : filteredHeaders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Không có bảng giá nào trong khoảng thời gian / điều kiện lọc này.
                  </td>
                </tr>
              ) : (
                <>
                  {masterGrid.topSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={10}
                        style={{ height: masterGrid.topSpacerHeight, padding: 0, border: 0 }}
                      />
                    </tr>
                  )}
                  {filteredHeaders
                    .slice(masterGrid.startIndex, masterGrid.endIndex)
                    .map((h, sliceIdx) => {
                      const rowIdx = masterGrid.startIndex + sliceIdx;
                      const isActive = h.stt === activeStt;
                      const isChecked = checkedStts.has(h.stt);
                      const isClosed = h.closed === "1";
                      const isExpired = Boolean(h.ngay_ct2 && h.ngay_ct2 < today);
                      const statusLabel = isClosed
                        ? "Đã đóng"
                        : isExpired
                          ? "Hết hạn"
                          : "Đang áp dụng";
                      const customerText = h.ma_dt
                        ? `${h.ma_dt}${h.ten_dt ? ` · ${h.ten_dt}` : ""}`
                        : "—";
                      const selectMasterRow = () => setActiveStt(h.stt);

                      return (
                        <tr
                          key={h.stt}
                          data-vrow={rowIdx}
                          onClick={selectMasterRow}
                          onDoubleClick={() => setFormModal({ open: true, stt: h.stt })}
                          title="Nhấn đúp hoặc Enter để sửa bảng giá · Space để đánh dấu"
                          className={
                            isActive
                              ? "xl-row-active"
                              : isChecked
                                ? "xl-row-marked"
                                : undefined
                          }
                        >
                          <td
                            className="xl-rowhead cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowCheck(h.stt);
                            }}
                            title="Nhấn để đánh dấu (Space)"
                          >
                            <span
                              className={`inline-block w-3 h-3 rounded border align-middle ${
                                isChecked
                                  ? "bg-tertiary-500 border-tertiary-600"
                                  : "border-neutral-400 bg-white"
                              }`}
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={h.so_ct || "(Trống)"}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input font-mono font-semibold text-primary-700 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={formatDate(h.ngay_ct)}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={h.ngay_ct2 ? formatDate(h.ngay_ct2) : "—"}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-center font-mono text-neutral-500 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell min-w-[220px]">
                            <ReadOnlyGridInput
                              value={customerText}
                              title={customerText}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-neutral-900 truncate grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={h.ma_vm || "—"}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-center font-mono font-semibold text-neutral-800 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={String(h.item_count ?? 0)}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-right font-mono font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={h.user_name || ""}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className="xl-input text-center font-mono text-neutral-600 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <ReadOnlyGridInput
                              value={statusLabel}
                              rowIndex={rowIdx}
                              onSelectRow={selectMasterRow}
                              onKeyDown={(e) => masterGrid.handleCellKeyDown(e, rowIdx)}
                              onCopy={masterGrid.handleCellCopy}
                              className={`xl-input text-center font-semibold grid-cell-input ${
                                isClosed
                                  ? "text-slate-600"
                                  : isExpired
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                              }`}
                            />
                          </td>
                          <td
                            className="xl-ro px-1.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFormModal({ open: true, stt: h.stt })}
                                className="p-1 rounded text-slate-500 hover:text-primary hover:bg-primary/10"
                                title="Sửa bảng giá"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteOne(h)}
                                className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                title="Xóa bảng giá"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {masterGrid.bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={10}
                        style={{ height: masterGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
            </table>
          </div>

          {/* Master Pagination Bar */}
          <div className="shrink-0 bg-neutral-100 border-t border-neutral-200 px-3 py-1 flex items-center justify-between text-[11px] text-neutral-600">
            <span>
              Tổng <b className="font-mono text-neutral-900">{totalRecords}</b> bảng giá · Đang hiển thị{" "}
              <b className="font-mono text-neutral-900">{filteredHeaders.length}</b> dòng trên trang
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-neutral-300 rounded px-1.5 py-0.5 font-mono text-[11px] text-neutral-700"
                title="Số bảng giá mỗi trang"
              >
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value={200}>200 / trang</option>
                <option value={500}>500 / trang</option>
              </select>
              <button
                type="button"
                disabled={page <= 1 || loadingList}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono px-1">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loadingList}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Draggable Splitter */}
        <div
          onPointerDown={() => setDraggingSplit(true)}
          className="h-1.5 shrink-0 bg-slate-200 hover:bg-primary/40 cursor-row-resize touch-none flex items-center justify-center transition-colors"
          title="Kéo để thay đổi kích thước bảng chi tiết"
        >
          <div className="w-10 h-0.5 rounded-full bg-slate-400" />
        </div>

        {/* Bottom Pane: BG0 Detail */}
        <div className="flex-1 min-h-[120px] flex flex-col bg-white overflow-hidden">
          <div className="shrink-0 px-4 py-2 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-800">
                Chi tiết hàng hóa (BG0):
              </span>
              {activeHeader ? (
                <span className="truncate text-slate-600">
                  <strong className="text-primary">{activeHeader.so_ct}</strong> ·{" "}
                  {formatDate(activeHeader.ngay_ct)} ·{" "}
                  {activeHeader.ma_dt
                    ? `KH: ${activeHeader.ma_dt}${activeHeader.ten_dt ? ` (${activeHeader.ten_dt})` : ""}`
                    : activeHeader.ma_vm
                      ? `Vùng: ${activeHeader.ma_vm}`
                      : "Chung"}{" "}
                  · Đã tải <strong>{activeItems.length}</strong> /{" "}
                  <strong>{detailFilteredCount}</strong>
                  {detailFilteredCount !== detailTotalCount
                    ? ` (tổng ${detailTotalCount})`
                    : ""}{" "}
                  mặt hàng
                </span>
              ) : (
                <span className="text-slate-400">Chọn một bảng giá phía trên để xem chi tiết</span>
              )}
              {detailHasMore && (
                <button
                  type="button"
                  disabled={loadingMoreDetail}
                  onClick={handleLoadMoreDetail}
                  className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                >
                  {loadingMoreDetail ? "Đang tải thêm..." : `+ Tải thêm (${DETAIL_CHUNK_SIZE})`}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="Tìm mã / tên hàng (SQL server)..."
                  className="erp-input h-7 pl-7 w-56 text-[12px]"
                />
              </div>
              {activeHeader && (
                <button
                  type="button"
                  onClick={() => setFormModal({ open: true, stt: activeHeader.stt })}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded border border-slate-300 bg-white text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="w-3 h-3 text-primary" />
                  <span>Sửa chi tiết</span>
                </button>
              )}
            </div>
          </div>

          <div ref={detailScrollRef} className="flex-1 overflow-auto table-sticky-header">
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-40 border-r border-neutral-200 font-mono">Mã vật tư</th>
                  <th className="min-w-[260px] border-r border-neutral-200">Tên hàng hóa</th>
                  <th className="w-20 text-center border-r border-neutral-200">ĐVT</th>
                  <th className="w-36 text-right border-r border-neutral-200 font-mono">Đơn giá</th>
                  <th className="w-28 text-right font-mono">% Chiết khấu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-sans">
                {loadingDetail ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Đang tải danh sách hàng hóa...
                    </td>
                  </tr>
                ) : !activeHeader ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa chọn bảng giá.
                    </td>
                  </tr>
                ) : filteredDetailItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Không có dòng hàng hóa phù hợp.
                    </td>
                  </tr>
                ) : (
                  <>
                    {detailGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={6}
                          style={{ height: detailGrid.topSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                    {filteredDetailItems
                      .slice(detailGrid.startIndex, detailGrid.endIndex)
                      .map((it, sliceIdx) => {
                        const idx = detailGrid.startIndex + sliceIdx;
                        const isRowActive = idx === activeDetailRow;
                        return (
                          <tr
                            key={`${it.ma_vt}-${idx}`}
                            data-vrow={idx}
                            onClick={() => setActiveDetailRow(idx)}
                            className={isRowActive ? "xl-row-active" : undefined}
                          >
                            <td className="xl-rowhead">{idx + 1}</td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={it.ma_vt || ""}
                                rowIndex={idx}
                                onSelectRow={setActiveDetailRow}
                                onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                onCopy={detailGrid.handleCellCopy}
                                className="xl-input font-mono font-semibold text-primary-800 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell min-w-[260px]">
                              <ReadOnlyGridInput
                                value={it.ten_vt || ""}
                                title={it.ten_vt || ""}
                                rowIndex={idx}
                                onSelectRow={setActiveDetailRow}
                                onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                onCopy={detailGrid.handleCellCopy}
                                className="xl-input text-neutral-900 truncate grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={it.dvt || ""}
                                rowIndex={idx}
                                onSelectRow={setActiveDetailRow}
                                onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                onCopy={detailGrid.handleCellCopy}
                                className="xl-input text-center text-neutral-600 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={formatCurrency(it.gia)}
                                rowIndex={idx}
                                onSelectRow={setActiveDetailRow}
                                onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                onCopy={detailGrid.handleCellCopy}
                                className="xl-input text-right font-mono font-semibold text-emerald-700 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={it.ck ? `${it.ck}%` : "0%"}
                                rowIndex={idx}
                                onSelectRow={setActiveDetailRow}
                                onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                onCopy={detailGrid.handleCellCopy}
                                className="xl-input text-right font-mono text-neutral-700 grid-cell-input"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {detailGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={6}
                          style={{ height: detailGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Mobile Filter Sheet */}
      <MobileSheet
        isOpen={showMobileFilter}
        onClose={() => setShowMobileFilter(false)}
        title="Lọc bảng giá (BG / BG0)"
        variant="bottom"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterSoCt("");
                setFilterMaVm("");
                setFilterMaDt("");
              }}
              className="flex-1 h-10 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700"
            >
              Xóa lọc chữ
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileFilter(false);
                void loadHeaders();
              }}
              className="flex-1 h-10 rounded-lg bg-primary text-white text-[13px] font-semibold"
            >
              Áp dụng & Tải lại
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Từ ngày</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="erp-input h-10"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Đến ngày</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="erp-input h-10"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Số chứng từ</span>
            <input
              type="text"
              value={filterSoCt}
              onChange={(e) => setFilterSoCt(e.target.value)}
              placeholder="VD: BG001..."
              className="erp-input h-10"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Mã vùng (Ma_Vm)</span>
            <input
              type="text"
              value={filterMaVm}
              onChange={(e) => setFilterMaVm(e.target.value)}
              placeholder="VD: KV1..."
              className="erp-input h-10"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Mã / Tên khách hàng</span>
            <input
              type="text"
              value={filterMaDt}
              onChange={(e) => setFilterMaDt(e.target.value)}
              placeholder="Tìm mã hoặc tên KH..."
              className="erp-input h-10"
            />
          </label>
          <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMobileFilter(false);
                void handleExportCsv();
              }}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>
      </MobileSheet>

      {/* Mobile Detail Sheet (BG0) */}
      <MobileSheet
        isOpen={isMobile && showMobileDetail && Boolean(activeHeader)}
        onClose={() => setShowMobileDetail(false)}
        title={activeHeader ? `Bảng giá ${activeHeader.so_ct || "(Trống)"}` : "Chi tiết bảng giá"}
        subtitle={
          activeHeader
            ? `${formatDate(activeHeader.ngay_ct)} · ${
                activeHeader.ma_dt
                  ? `${activeHeader.ma_dt}${activeHeader.ten_dt ? ` (${activeHeader.ten_dt})` : ""}`
                  : activeHeader.ma_vm
                    ? `Vùng: ${activeHeader.ma_vm}`
                    : "Chung"
              }`
            : undefined
        }
        variant="fullscreen"
        footer={
          activeHeader && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMobileDetail(false);
                  setFormModal({ open: true, stt: activeHeader.stt });
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-white text-[13px] font-semibold"
              >
                <Pencil className="w-4 h-4" />
                <span>Sửa bảng giá</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMobileDetail(false)}
                className="px-4 h-10 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700"
              >
                Đóng
              </button>
            </div>
          )
        }
      >
        <div className="flex flex-col h-full">
          <div className="shrink-0 p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="Tìm mã / tên hàng hóa (SQL server)..."
                className="erp-input h-10 pl-9 w-full"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Đã tải <strong>{activeItems.length}</strong> /{" "}
                <strong>{detailFilteredCount}</strong>
                {detailFilteredCount !== detailTotalCount ? ` (tổng ${detailTotalCount})` : ""} mặt hàng
              </span>
              {detailHasMore && (
                <button
                  type="button"
                  disabled={loadingMoreDetail}
                  onClick={handleLoadMoreDetail}
                  className="px-2.5 py-1 rounded bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-700 disabled:opacity-50"
                >
                  {loadingMoreDetail ? "Đang tải..." : `+ Tải thêm (${DETAIL_CHUNK_SIZE})`}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingDetail ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Đang tải danh sách hàng hóa...
              </div>
            ) : filteredDetailItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Không có dòng hàng hóa phù hợp.
              </div>
            ) : (
              filteredDetailItems.map((it, idx) => (
                <div
                  key={`${it.ma_vt}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-primary-800">
                        {it.ma_vt || "—"}
                      </div>
                      <div className="text-slate-900 font-medium line-clamp-2">
                        {it.ten_vt || "—"}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-[13px] shrink-0">
                      {formatCurrency(it.gia)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>ĐVT: {it.dvt || "—"}</span>
                    <span>CK: {it.ck ? `${it.ck}%` : "0%"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </MobileSheet>

      {/* Inline Bulk Date / Bulk Copy Dialog */}
      {bulkActionDialog.type && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 pt-safe pb-safe">
          <form
            onSubmit={(e) => void handleBulkActionSubmit(e)}
            className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-[14px] font-bold text-slate-900">
                {bulkActionDialog.type === "date"
                  ? `Đổi ngày cho ${selectedHeaders.length} bảng giá`
                  : `Nhân bản ${selectedHeaders.length} bảng giá sang ngày mới`}
              </h3>
            </div>
            <div className="p-5 space-y-3 text-[12px]">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-slate-700">Ngày chứng từ mới (Ngay_Ct) *</span>
                <input
                  type="date"
                  required
                  value={bulkActionDialog.ngayCt}
                  onChange={(e) =>
                    setBulkActionDialog((prev) => ({
                      ...prev,
                      ngayCt: e.target.value,
                      ngayCt1: e.target.value,
                    }))
                  }
                  className="erp-input h-8"
                />
              </label>

              {bulkActionDialog.type === "date" ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Ngày bắt đầu hiệu lực (Ngay_Ct1)</span>
                    <input
                      type="date"
                      value={bulkActionDialog.ngayCt1}
                      onChange={(e) =>
                        setBulkActionDialog((prev) => ({ ...prev, ngayCt1: e.target.value }))
                      }
                      className="erp-input h-8"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">
                      Ngày hết hạn mới (Ngay_Ct2 - bỏ trống nếu giữ vô thời hạn)
                    </span>
                    <input
                      type="date"
                      value={bulkActionDialog.ngayCt2}
                      onChange={(e) =>
                        setBulkActionDialog((prev) => ({ ...prev, ngayCt2: e.target.value }))
                      }
                      className="erp-input h-8"
                    />
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">User tạo bản sao</span>
                  <input
                    type="text"
                    value={bulkActionDialog.userName}
                    onChange={(e) =>
                      setBulkActionDialog((prev) => ({
                        ...prev,
                        userName: e.target.value.toUpperCase(),
                      }))
                    }
                    className="erp-input h-8 uppercase"
                  />
                </label>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setBulkActionDialog((prev) => ({ ...prev, type: null }))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={bulkSubmitting}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkSubmitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Excel Preview / Commit Modal */}
      <PriceListExcelModal
        isOpen={excelModal.open}
        mode={excelModal.mode}
        selectedHeaders={selectedHeaders}
        onClose={() => setExcelModal((prev) => ({ ...prev, open: false }))}
        onSuccess={(msg) => {
          showToast("success", msg);
          void loadHeaders();
          if (activeStt) {
            void loadDetailChunk(activeStt, debouncedDetailSearch, 0, false);
          }
        }}
      />

      {/* Manual Create / Edit Modal */}
      <PriceListFormModal
        isOpen={formModal.open}
        editingStt={formModal.stt}
        onClose={() => setFormModal({ open: false, stt: null })}
        onSaved={(stt, msg) => {
          showToast("success", msg);
          void loadHeaders(stt || activeStt);
          if (stt && stt === activeStt) {
            void loadDetailChunk(stt, debouncedDetailSearch, 0, false);
          }
        }}
      />
    </div>
  );
};
