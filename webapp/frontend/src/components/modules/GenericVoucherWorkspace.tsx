import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GripHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import {
  DOC_MODULE_CONFIGS,
  DocModuleKey,
  ModuleVoucherDetailItem,
  ModuleVoucherDetailResponse,
  ModuleVoucherHeader,
  ModuleVoucherPageResponse,
} from "../../types/moduleVoucher";
import { ChungTuItem } from "../../types/lookup";
import { getDocumentsByModule, initCatalogCache } from "../../lib/catalogCache";
import {
  formatDate,
  formatNumber0,
  formatNumber2,
  getTodayDate,
} from "../../lib/format";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
import { extractApiError, SqlErrorState } from "../ui/SqlErrorState";
import { GenericVoucherFormModal } from "./GenericVoucherFormModal";

interface GenericVoucherWorkspaceProps {
  moduleKey: DocModuleKey;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const GenericVoucherWorkspace: React.FC<GenericVoucherWorkspaceProps> = ({
  moduleKey,
}) => {
  const config = DOC_MODULE_CONFIGS[moduleKey];
  const today = getTodayDate();

  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [maCtFilter, setMaCtFilter] = useState("ALL");
  const [docList, setDocList] = useState<ChungTuItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [headers, setHeaders] = useState<ModuleVoucherHeader[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [sqlError, setSqlError] = useState<{ message: string; isSqlUnavailable: boolean } | null>(null);

  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ModuleVoucherDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [activeMasterRow, setActiveMasterRow] = useState(0);
  const [activeDetailRow, setActiveDetailRow] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const [topPct, setTopPct] = useState(54);
  const [draggingSplit, setDraggingSplit] = useState(false);

  const isMobile = useIsMobile();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [formState, setFormState] = useState<{
    open: boolean;
    stt: string | null;
  }>({ open: false, stt: null });

  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setPage(1);
    setMaCtFilter("ALL");
    setActiveStt(null);
    setActiveDetail(null);
    setSearchText("");
    setDebouncedSearch("");
    setBanner(null);
    setSqlError(null);
    void initCatalogCache().then(() => {
      setDocList(getDocumentsByModule(moduleKey));
    });
  }, [moduleKey]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setSqlError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (maCtFilter && maCtFilter !== "ALL") params.set("ma_ct", maCtFilter);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(
        `/api/modules/${moduleKey}/vouchers?${params.toString()}`,
      );
      if (!res.ok) {
        const err = await extractApiError(res);
        setSqlError(err);
        setHeaders([]);
        setTotalRecords(0);
        setTotalAmount(0);
        setActiveStt(null);
        setActiveDetail(null);
        return;
      }
      const data = (await res.json()) as ModuleVoucherPageResponse;
      setHeaders(data.items || []);
      setTotalRecords(data.total_records || 0);
      setTotalPages(Math.max(1, data.total_pages || 1));
      setTotalAmount(data.total_amount || 0);

      if (data.items && data.items.length > 0) {
        const keep = data.items.findIndex((it) => it.stt === activeStt);
        const nextIdx = keep >= 0 ? keep : 0;
        setActiveMasterRow(nextIdx);
        setActiveStt(data.items[nextIdx].stt);
      } else {
        setActiveStt(null);
        setActiveDetail(null);
      }
    } catch (err) {
      setSqlError({
        message: err instanceof Error ? err.message : "Không thể kết nối tới máy chủ backend.",
        isSqlUnavailable: true,
      });
    } finally {
      setLoadingList(false);
    }
  }, [moduleKey, page, pageSize, fromDate, toDate, maCtFilter, debouncedSearch, activeStt]);

  useEffect(() => {
    void loadList();
  }, [moduleKey, page, pageSize, fromDate, toDate, maCtFilter, debouncedSearch]);

  const loadDetail = useCallback(
    async (stt: string | null) => {
      if (!stt) {
        setActiveDetail(null);
        return;
      }
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `/api/modules/${moduleKey}/vouchers/${encodeURIComponent(stt)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ModuleVoucherDetailResponse;
        setActiveDetail(data);
        setActiveDetailRow(0);
      } catch {
        setActiveDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [moduleKey],
  );

  useEffect(() => {
    void loadDetail(activeStt);
  }, [activeStt, loadDetail]);

  const detailItems: ModuleVoucherDetailItem[] = useMemo(
    () => activeDetail?.items || [],
    [activeDetail],
  );

  const handleSelectMasterRow = useCallback(
    (idx: number) => {
      setActiveMasterRow(idx);
      const row = headers[idx];
      if (row && row.stt !== activeStt) {
        setActiveStt(row.stt);
      }
    },
    [headers, activeStt],
  );

  const handleEnterMasterRow = useCallback(
    (idx: number) => {
      const row = headers[idx];
      if (row) setFormState({ open: true, stt: row.stt });
    },
    [headers],
  );

  const masterGrid = useVirtualExcelGrid({
    totalRows: headers.length,
    scrollContainerRef: masterScrollRef,
    estimatedRowHeight: 31,
    overscan: 12,
    onSelectRow: handleSelectMasterRow,
    onEnterRow: handleEnterMasterRow,
  });

  const detailGrid = useVirtualExcelGrid({
    totalRows: detailItems.length,
    scrollContainerRef: detailScrollRef,
    estimatedRowHeight: 30,
    overscan: 15,
    onSelectRow: setActiveDetailRow,
  });

  const handleDeleteActive = useCallback(async () => {
    if (!activeStt) return;
    if (!window.confirm(`Xóa chứng từ ${activeDetail?.so_ct || activeStt}?`)) return;
    try {
      const res = await fetch(
        `/api/modules/${moduleKey}/vouchers/${encodeURIComponent(activeStt)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await extractApiError(res);
        throw new Error(err.message);
      }
      setBanner({ type: "success", text: `Đã xóa chứng từ ${activeDetail?.so_ct || activeStt}` });
      setActiveStt(null);
      await loadList();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Xóa chứng từ thất bại",
      });
    }
  }, [activeStt, activeDetail, moduleKey, loadList]);

  // VFP keyboard shortcuts on list view
  useEffect(() => {
    if (formState.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key !== "F2" && e.key !== "F3" && e.key !== "F5" && e.key !== "F8") {
          return;
        }
      }
      if (e.key === "F2") {
        e.preventDefault();
        setFormState({ open: true, stt: null });
      } else if (e.key === "F3" && activeStt) {
        e.preventDefault();
        setFormState({ open: true, stt: activeStt });
      } else if (e.key === "F8" && activeStt) {
        e.preventDefault();
        void handleDeleteActive();
      } else if (e.key === "F5") {
        e.preventDefault();
        void loadList();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [formState.open, activeStt, handleDeleteActive, loadList]);

  const handleSplitterPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setDraggingSplit(true);
    const rect = container.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientY - rect.top) / Math.max(240, rect.height)) * 100;
      setTopPct(Math.min(78, Math.max(25, pct)));
    };
    const onUp = () => {
      setDraggingSplit(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  const handleExportCsv = useCallback(() => {
    downloadCsv(
      `${config.shortCode}_${fromDate}_${toDate}.csv`,
      ["STT", "Mã CT", "Số CT", "Ngày CT", "Mã ĐT", "Tên đối tượng", "TK", "Diễn giải", "Số dòng", "Tổng tiền"],
      headers.map((h, i) => [
        i + 1,
        h.ma_ct,
        h.so_ct,
        h.ngay_ct,
        h.ma_dt,
        h.ten_dt,
        h.tk,
        h.dien_giai0,
        h.item_count,
        h.ttien_nt,
      ]),
    );
  }, [config.shortCode, fromDate, toDate, headers]);

  const masterColCount = 10;
  const detailColCount =
    config.detailKind === "gl" ? 8 : config.detailKind === "transfer" ? 13 : 12;

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Top Toolbar */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold shrink-0 ${config.accentClass}`}
            >
              {config.shortCode}
            </span>
            <h1 className="text-xs sm:text-[15px] font-semibold text-slate-900 truncate">
              {config.title}
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              {config.sqlTables}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFormState({ open: true, stt: null })}
              className="inline-flex items-center gap-1 h-9 md:h-auto px-3 md:px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Thêm (F2)</span>
              <span className="md:hidden">Thêm</span>
            </button>
            <button
              type="button"
              disabled={!activeStt}
              onClick={() => activeStt && setFormState({ open: true, stt: activeStt })}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium disabled:opacity-40 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Sửa (F3)
            </button>
            <button
              type="button"
              disabled={!activeStt}
              onClick={() => void handleDeleteActive()}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12px] font-medium disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa (F8)
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Quick Search Bar */}
        {isMobile ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm số CT, ĐT, diễn giải..."
                className="w-full h-9 pl-8 pr-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadList()}
              aria-label="Tải lại"
              className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
            </button>
          </div>
        ) : (
          /* Desktop Filters */
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Từ ngày</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-[12px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-[12px]"
              />
            </div>
            {docList.length > 0 && (
              <select
                value={maCtFilter}
                onChange={(e) => {
                  setMaCtFilter(e.target.value);
                  setPage(1);
                }}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-[12px]"
              >
                <option value="ALL">Tất cả loại CT</option>
                {docList.map((d) => (
                  <option key={d.ma_ct} value={d.ma_ct}>
                    {d.ma_ct} — {d.ten_ct}
                  </option>
                ))}
              </select>
            )}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm số CT, mã/tên đối tượng, diễn giải..."
                className="w-full h-7 pl-8 pr-2.5 border border-slate-300 rounded bg-white text-[12px] focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadList()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
              Tải lại (F5)
            </button>
            <div className="ml-auto text-[12px] text-slate-600">
              Tổng: <strong className="font-mono text-slate-900">{totalRecords}</strong> CT ·{" "}
              <strong className="font-mono text-sky-700">{formatNumber0(totalAmount)}</strong> đ
            </div>
          </div>
        )}

        {banner && (
          <div
            className={`flex items-center justify-between px-3 py-1 rounded border text-[12px] ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-[11px] underline ml-3"
            >
              Đóng
            </button>
          </div>
        )}
      </header>

      {sqlError && (
        <SqlErrorState
          message={sqlError.message}
          isSqlUnavailable={sqlError.isSqlUnavailable}
          onRetry={() => void loadList()}
        />
      )}

      {/* Mobile Filter Drawer */}
      <MobileSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title={`Lọc ${config.title}`}
        variant="bottom"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleExportCsv();
                setMobileFilterOpen(false);
              }}
              className="h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void loadList();
                setMobileFilterOpen(false);
              }}
              className="flex-1 h-11 rounded-lg bg-primary-700 text-white text-sm font-bold"
            >
              Áp dụng
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="erp-input w-full font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="erp-input w-full font-mono bg-white"
              />
            </div>
          </div>
          {docList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Loại chứng từ
              </label>
              <select
                value={maCtFilter}
                onChange={(e) => {
                  setMaCtFilter(e.target.value);
                  setPage(1);
                }}
                className="erp-input w-full bg-white"
              >
                <option value="ALL">Tất cả loại CT</option>
                {docList.map((d) => (
                  <option key={d.ma_ct} value={d.ma_ct}>
                    {d.ma_ct} — {d.ten_ct}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </MobileSheet>

      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
            <span className="text-slate-600">
              <strong className="font-mono text-slate-900">{totalRecords}</strong> CT ·{" "}
              <strong className="font-mono text-sky-700">{formatNumber0(totalAmount)}</strong> đ
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[11px] text-slate-600">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg border border-slate-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg border border-slate-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 pb-safe">
            {headers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                {loadingList ? "Đang tải danh sách..." : "Không có chứng từ nào trong kỳ."}
              </div>
            ) : (
              headers.map((row) => {
                const isVnd = (row.ma_tte || "VND").toUpperCase() === "VND";
                const isActive = row.stt === activeStt;
                return (
                  <div
                    key={row.stt}
                    onClick={() => {
                      setActiveStt(row.stt);
                      setMobileDetailOpen(true);
                    }}
                    className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer ${
                      isActive
                        ? "border-primary-500 ring-1 ring-primary-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {row.ma_ct}
                        </span>
                        <span className="font-mono font-bold text-sm text-sky-800 truncate">
                          {row.so_ct}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 shrink-0">
                        {formatDate(row.ngay_ct)}
                      </span>
                    </div>
                    {(row.ten_dt || row.ma_dt) && (
                      <div className="text-[13px] font-semibold text-slate-900 truncate mt-1">
                        {row.ten_dt || row.ma_dt}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-slate-500 truncate">
                        {row.dien_giai0 || `${row.item_count || 0} dòng`}
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-900 shrink-0">
                        {isVnd ? formatNumber0(row.ttien_nt) : formatNumber2(row.ttien_nt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <MobileSheet
            isOpen={mobileDetailOpen && Boolean(activeStt)}
            onClose={() => setMobileDetailOpen(false)}
            variant="bottom"
            title={
              activeDetail
                ? `${activeDetail.ma_ct} · ${activeDetail.so_ct}`
                : "Chi tiết chứng từ"
            }
            subtitle={
              activeDetail
                ? `${formatDate(activeDetail.ngay_ct)} · ${
                    activeDetail.ten_dt || activeDetail.ma_dt || ""
                  }`
                : undefined
            }
            footer={
              activeStt && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      setFormState({ open: true, stt: activeStt });
                    }}
                    className="flex-1 h-11 rounded-lg bg-primary-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Sửa chứng từ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDetailOpen(false);
                      void handleDeleteActive();
                    }}
                    className="h-11 px-4 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa</span>
                  </button>
                </div>
              )
            }
          >
            <div className="p-3.5 space-y-2.5 bg-slate-50">
              {loadingDetail ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary-600" />
                  Đang tải chi tiết...
                </div>
              ) : detailItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                  Không có dòng chi tiết.
                </div>
              ) : (
                detailItems.map((it, idx) => {
                  const isVnd = (activeDetail?.ma_tte || "VND").toUpperCase() === "VND";
                  return (
                    <div
                      key={it.stt0 || `md-${idx}`}
                      className="bg-white rounded-xl border border-slate-200 p-2.5 text-xs space-y-1"
                    >
                      {config.detailKind !== "gl" ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-sky-900">
                              #{idx + 1} · {it.ma_vt}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {config.detailKind === "transfer"
                                ? `${it.ma_kho} → ${it.ma_kho_n}`
                                : `Kho: ${it.ma_kho}`}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900">{it.ten_vt}</div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] font-mono">
                            <span className="text-slate-600">
                              SL: <b className="text-slate-900">{formatNumber2(it.so_luong9 || it.so_luong)}</b>{" "}
                              {it.dvt} × {isVnd ? formatNumber0(it.gia_nt9 || it.gia_nt) : formatNumber2(it.gia_nt9 || it.gia_nt)}
                            </span>
                            <span className="font-bold text-slate-900">
                              {isVnd ? formatNumber0(it.tien_nt9 || it.tien_nt) : formatNumber2(it.tien_nt9 || it.tien_nt)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-sky-900">
                              NV#{it.stt_nv || 1} · {(it.no_co || "N").toUpperCase() === "N" ? "Nợ" : "Có"} {it.tk}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {isVnd ? formatNumber0(it.tien_nt) : formatNumber2(it.tien_nt)}
                            </span>
                          </div>
                          {it.dien_giai && <div className="text-slate-700">{it.dien_giai}</div>}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </MobileSheet>
        </div>
      ) : (
        /* Split Pane */
        <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Top Master Grid */}
          <section
            style={{ height: `${topPct}%` }}
            className="min-h-[140px] flex flex-col bg-white overflow-hidden"
          >
            <div
              ref={masterScrollRef}
              className="flex-1 min-h-0 overflow-auto table-sticky-header"
            >
              <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-16 text-center border-r border-neutral-200">Loại</th>
                  <th className="w-28 border-r border-neutral-200">Số CT</th>
                  <th className="w-24 text-center border-r border-neutral-200">Ngày CT</th>
                  <th className="w-28 border-r border-neutral-200">Mã ĐT</th>
                  <th className="min-w-[200px] border-r border-neutral-200">{config.partnerLabel}</th>
                  <th className="w-20 text-center border-r border-neutral-200">TK</th>
                  <th className="min-w-[200px] border-r border-neutral-200">Diễn giải</th>
                  <th className="w-16 text-right border-r border-neutral-200">Dòng</th>
                  <th className="w-32 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {headers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={masterColCount}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      {loadingList
                        ? "Đang tải danh sách..."
                        : sqlError
                          ? "Không có dữ liệu do chưa kết nối được SQL Server."
                          : "Không có chứng từ nào trong kỳ."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {masterGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: masterGrid.topSpacerHeight }}>
                        <td colSpan={masterColCount} className="p-0 border-0" />
                      </tr>
                    )}
                    {headers
                      .slice(masterGrid.startIndex, masterGrid.endIndex)
                      .map((row, offset) => {
                        const idx = masterGrid.startIndex + offset;
                        const isSelected = row.stt === activeStt;
                        const isActive = idx === activeMasterRow;
                        const isVnd = (row.ma_tte || "VND").toUpperCase() === "VND";
                        return (
                          <tr
                            key={row.stt}
                            data-vrow={idx}
                            onClick={() => handleSelectMasterRow(idx)}
                            onDoubleClick={() => setFormState({ open: true, stt: row.stt })}
                            className={
                              isSelected || isActive
                                ? "xl-row-active bg-sky-50/70"
                                : "hover:bg-slate-50"
                            }
                          >
                            <td className="xl-rowhead font-mono">{idx + 1}</td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.ma_ct}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono font-bold text-slate-700 grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.so_ct}
                                rowIndex={idx}
                                className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatDate(row.ngay_ct)}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.ma_dt || ""}
                                rowIndex={idx}
                                className="xl-ro-input font-mono grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.ten_dt || ""}
                                rowIndex={idx}
                                className="xl-ro-input grid-cell-input"
                                title={row.ten_dt}
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.tk || ""}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={row.dien_giai0 || ""}
                                rowIndex={idx}
                                className="xl-ro-input grid-cell-input"
                                title={row.dien_giai0}
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={String(row.item_count || 0)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={
                                  isVnd
                                    ? formatNumber0(row.ttien_nt)
                                    : formatNumber2(row.ttien_nt)
                                }
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono font-bold text-slate-900 grid-cell-input"
                                onSelectRow={handleSelectMasterRow}
                                onKeyDown={(e) => masterGrid.handleCellKeyDown(e, idx)}
                                onCopy={masterGrid.handleCellCopy}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {masterGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: masterGrid.bottomSpacerHeight }}>
                        <td colSpan={masterColCount} className="p-0 border-0" />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <span>
              Trang <strong>{page}</strong> / {totalPages} ({totalRecords} chứng từ)
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-6 px-1 border border-slate-300 rounded bg-white text-[11px]"
              >
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value={200}>200 / trang</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Draggable Splitter */}
        <div
          onPointerDown={handleSplitterPointerDown}
          className={`h-2.5 bg-slate-200 hover:bg-sky-200 border-y border-slate-300 flex items-center justify-center cursor-row-resize touch-none shrink-0 ${
            draggingSplit ? "bg-sky-300" : ""
          }`}
        >
          <GripHorizontal className="w-4 h-3 text-slate-500" />
        </div>

        {/* Bottom Detail Grid */}
        <section className="flex-1 min-h-[140px] flex flex-col bg-white overflow-hidden">
          <div className="px-3 py-1 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[12px] shrink-0">
            <span className="font-semibold text-slate-700">
              Chi tiết chứng từ{" "}
              {activeDetail ? (
                <span className="font-mono text-sky-700 ml-1">
                  {activeDetail.so_ct} ({formatDate(activeDetail.ngay_ct)})
                </span>
              ) : null}
            </span>
            <span className="text-[11px] text-slate-500">
              {loadingDetail ? "Đang tải..." : `${detailItems.length} dòng chi tiết`}
            </span>
          </div>

          <div
            ref={detailScrollRef}
            className="flex-1 min-h-0 overflow-auto table-sticky-header"
          >
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  {config.detailKind !== "gl" ? (
                    <>
                      <th className="w-20 border-r border-neutral-200">
                        {config.detailKind === "transfer" ? "Kho xuất" : "Kho"}
                      </th>
                      {config.detailKind === "transfer" && (
                        <th className="w-20 border-r border-neutral-200">Kho nhận</th>
                      )}
                      <th className="w-28 border-r border-neutral-200">Mã VT</th>
                      <th className="min-w-[200px] border-r border-neutral-200">Tên vật tư</th>
                      <th className="w-16 text-center border-r border-neutral-200">ĐVT</th>
                      <th className="w-20 text-right border-r border-neutral-200">SL</th>
                      <th className="w-14 text-right border-r border-neutral-200">HS</th>
                      <th className="w-24 text-right border-r border-neutral-200">Đơn giá</th>
                      <th className="w-28 text-right border-r border-neutral-200">Thành tiền</th>
                      <th className="w-20 text-center border-r border-neutral-200">TK</th>
                      <th className="w-20 text-center border-r border-neutral-200">TK ĐƯ</th>
                      <th className="w-24 border-r border-neutral-200">Mã SP</th>
                    </>
                  ) : (
                    <>
                      <th className="w-14 text-center border-r border-neutral-200">NV</th>
                      <th className="w-14 text-center border-r border-neutral-200">N/C</th>
                      <th className="w-24 border-r border-neutral-200">Tài khoản</th>
                      <th className="w-32 text-right border-r border-neutral-200">Phát sinh</th>
                      <th className="w-28 border-r border-neutral-200">Mã ĐT</th>
                      <th className="w-24 border-r border-neutral-200">Bộ phận</th>
                      <th className="min-w-[180px]">Diễn giải</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {detailItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={detailColCount}
                      className="py-6 text-center text-slate-400 text-xs"
                    >
                      Chọn một chứng từ phía trên để xem chi tiết.
                    </td>
                  </tr>
                ) : (
                  <>
                    {detailGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: detailGrid.topSpacerHeight }}>
                        <td colSpan={detailColCount} className="p-0 border-0" />
                      </tr>
                    )}
                    {detailItems
                      .slice(detailGrid.startIndex, detailGrid.endIndex)
                      .map((it, offset) => {
                        const idx = detailGrid.startIndex + offset;
                        const isActive = idx === activeDetailRow;
                        const isVnd =
                          (activeDetail?.ma_tte || "VND").toUpperCase() === "VND";
                        return (
                          <tr
                            key={it.stt0 || `d-${idx}`}
                            data-vrow={idx}
                            onClick={() => setActiveDetailRow(idx)}
                            className={isActive ? "xl-row-active" : undefined}
                          >
                            <td className="xl-rowhead font-mono">{idx + 1}</td>
                            {config.detailKind !== "gl" ? (
                              <>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ma_kho || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                {config.detailKind === "transfer" && (
                                  <td className="xl-ro">
                                    <ReadOnlyGridInput
                                      value={it.ma_kho_n || ""}
                                      rowIndex={idx}
                                      className="xl-ro-input font-mono grid-cell-input"
                                      onSelectRow={setActiveDetailRow}
                                      onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                      onCopy={detailGrid.handleCellCopy}
                                    />
                                  </td>
                                )}
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ma_vt || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ten_vt || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.dvt || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input text-center grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={formatNumber2(it.so_luong9 || it.so_luong)}
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={formatNumber2(it.he_so9 || 1)}
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono text-slate-500 grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={
                                      isVnd
                                        ? formatNumber0(it.gia_nt9 || it.gia_nt)
                                        : formatNumber2(it.gia_nt9 || it.gia_nt)
                                    }
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={
                                      isVnd
                                        ? formatNumber0(it.tien_nt9 || it.tien_nt)
                                        : formatNumber2(it.tien_nt9 || it.tien_nt)
                                    }
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono font-bold grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.tk || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input text-center font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.tk_du || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input text-center font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ma_sp || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={String(it.stt_nv || 1)}
                                    rowIndex={idx}
                                    className="xl-ro-input text-center font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={(it.no_co || "N").toUpperCase() === "N" ? "Nợ" : "Có"}
                                    rowIndex={idx}
                                    className={`xl-ro-input text-center font-mono font-bold grid-cell-input ${
                                      (it.no_co || "N").toUpperCase() === "N"
                                        ? "text-sky-700"
                                        : "text-rose-700"
                                    }`}
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.tk || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono font-semibold grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={
                                      isVnd ? formatNumber0(it.tien_nt) : formatNumber2(it.tien_nt)
                                    }
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono font-bold grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ma_dt || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.ma_bp || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                                <td className="xl-ro">
                                  <ReadOnlyGridInput
                                    value={it.dien_giai || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    {detailGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: detailGrid.bottomSpacerHeight }}>
                        <td colSpan={detailColCount} className="p-0 border-0" />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}

      {/* Form Modal */}
      <GenericVoucherFormModal
        open={formState.open}
        moduleKey={moduleKey}
        stt={formState.stt}
        onClose={() => setFormState({ open: false, stt: null })}
        onSaved={async (saved) => {
          setFormState({ open: false, stt: null });
          setBanner({
            type: "success",
            text: `Đã lưu chứng từ ${saved.so_ct}`,
          });
          setActiveStt(saved.stt);
          await loadList();
          await loadDetail(saved.stt);
        }}
      />
    </div>
  );
};
