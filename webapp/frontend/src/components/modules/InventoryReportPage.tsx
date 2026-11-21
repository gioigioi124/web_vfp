import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  LayoutList,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table,
} from "lucide-react";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import {
  InventorySummaryResponse,
  InventorySummaryRow,
  StockCardEntry,
  StockCardResponse,
} from "../../types/moduleVoucher";
import {
  formatDate,
  formatNumber0,
  formatNumber2,
  getTodayDate,
} from "../../lib/format";
import { initCatalogCache, searchKho } from "../../lib/catalogCache";
import { initProductIndex, searchProducts } from "../../lib/productIndex";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
import { extractApiError, SqlErrorState } from "../ui/SqlErrorState";

type InvReportTab = "summary" | "card";

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

export const InventoryReportPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">("cards");
  const today = getTodayDate();
  const [tab, setTab] = useState<InvReportTab>("summary");
  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [maKho, setMaKho] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeZero, setIncludeZero] = useState(false);

  const [sqlError, setSqlError] = useState<{ message: string; isSqlUnavailable: boolean } | null>(null);

  // Summary (vcd01) state
  const [summaryData, setSummaryData] = useState<InventorySummaryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeSummaryRow, setActiveSummaryRow] = useState(0);
  const summaryScrollRef = useRef<HTMLDivElement | null>(null);

  // Stock Card (vct01) state
  const [selectedMaVt, setSelectedMaVt] = useState("");
  const [cardData, setCardData] = useState<StockCardResponse | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [activeCardRow, setActiveCardRow] = useState(0);
  const cardScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void initCatalogCache();
    void initProductIndex();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSqlError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        include_zero: String(includeZero),
      });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (maKho.trim()) params.set("ma_kho", maKho.trim().toUpperCase());
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(`/api/inventory/reports/summary?${params.toString()}`);
      if (!res.ok) {
        const err = await extractApiError(res);
        setSqlError(err);
        setSummaryData(null);
        return;
      }
      const data = (await res.json()) as InventorySummaryResponse;
      setSummaryData(data);
      setActiveSummaryRow(0);
    } catch (err) {
      setSqlError({
        message: err instanceof Error ? err.message : "Không thể kết nối máy chủ backend.",
        isSqlUnavailable: true,
      });
    } finally {
      setLoadingSummary(false);
    }
  }, [page, pageSize, includeZero, fromDate, toDate, maKho, debouncedSearch]);

  const loadStockCard = useCallback(
    async (vtOverride?: string, khoOverride?: string) => {
      const vt = (vtOverride ?? selectedMaVt).trim().toUpperCase();
      const kho = (khoOverride ?? maKho).trim().toUpperCase();
      if (!vt) {
        setCardData(null);
        return;
      }
      setLoadingCard(true);
      setSqlError(null);
      try {
        const params = new URLSearchParams({ ma_vt: vt });
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        if (kho) params.set("ma_kho", kho);

        const res = await fetch(`/api/inventory/reports/card?${params.toString()}`);
        if (!res.ok) {
          const err = await extractApiError(res);
          setSqlError(err);
          setCardData(null);
          return;
        }
        const data = (await res.json()) as StockCardResponse;
        setCardData(data);
        setActiveCardRow(0);
      } catch (err) {
        setSqlError({
          message: err instanceof Error ? err.message : "Không thể kết nối máy chủ backend.",
          isSqlUnavailable: true,
        });
      } finally {
        setLoadingCard(false);
      }
    },
    [selectedMaVt, maKho, fromDate, toDate],
  );

  useEffect(() => {
    if (tab === "summary") {
      void loadSummary();
    } else if (selectedMaVt.trim()) {
      void loadStockCard();
    }
  }, [tab, loadSummary, loadStockCard, selectedMaVt]);

  const summaryRows: InventorySummaryRow[] = useMemo(
    () => summaryData?.items || [],
    [summaryData],
  );
  const cardRows: StockCardEntry[] = useMemo(
    () => cardData?.entries || [],
    [cardData],
  );

  const handleDrillToCard = useCallback(
    (idx: number) => {
      const row = summaryRows[idx];
      if (!row) return;
      setSelectedMaVt(row.ma_vt);
      if (row.ma_kho) setMaKho(row.ma_kho);
      setTab("card");
      void loadStockCard(row.ma_vt, row.ma_kho);
    },
    [summaryRows, loadStockCard],
  );

  const summaryGrid = useVirtualExcelGrid({
    totalRows: summaryRows.length,
    scrollContainerRef: summaryScrollRef,
    estimatedRowHeight: 31,
    overscan: 15,
    onSelectRow: setActiveSummaryRow,
    onEnterRow: handleDrillToCard,
  });

  const cardGrid = useVirtualExcelGrid({
    totalRows: cardRows.length,
    scrollContainerRef: cardScrollRef,
    estimatedRowHeight: 31,
    overscan: 15,
    onSelectRow: setActiveCardRow,
  });

  const fetchKhoOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchKho(q);
  }, []);

  const fetchVtOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initProductIndex();
    return searchProducts(q);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (tab === "summary") {
      downloadCsv(
        `NhapXuatTon_${fromDate}_${toDate}.csv`,
        [
          "STT", "Kho", "Mã VT", "Tên vật tư", "ĐVT",
          "Tồn đầu", "Tiền đầu", "SL Nhập", "Tiền Nhập",
          "SL Xuất", "Tiền Xuất", "Tồn cuối", "Tiền cuối",
        ],
        summaryRows.map((r, i) => [
          i + 1,
          r.ma_kho,
          r.ma_vt,
          r.ten_vt,
          r.dvt,
          r.ton_dau,
          r.tien_dau,
          r.sl_nhap,
          r.tien_nhap,
          r.sl_xuat,
          r.tien_xuat,
          r.ton_cuoi,
          r.tien_cuoi,
        ]),
      );
    } else {
      downloadCsv(
        `TheKho_${selectedMaVt}_${fromDate}_${toDate}.csv`,
        [
          "STT", "Ngày CT", "Mã CT", "Số CT", "Mã ĐT", "Diễn giải",
          "Kho", "Kho nhận", "SL Nhập", "Tiền Nhập", "SL Xuất", "Tiền Xuất", "Tồn LK", "Tiền LK",
        ],
        cardRows.map((r, i) => [
          i + 1,
          r.ngay_ct,
          r.ma_ct,
          r.so_ct,
          r.ma_dt,
          r.dien_giai,
          r.ma_kho,
          r.ma_kho_n,
          r.sl_nhap,
          r.tien_nhap,
          r.sl_xuat,
          r.tien_xuat,
          r.ton_luy_ke,
          r.tien_luy_ke,
        ]),
      );
    }
  }, [tab, fromDate, toDate, summaryRows, cardRows, selectedMaVt]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Header */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="px-2 py-0.5 rounded border text-[11px] font-mono font-bold bg-teal-50 text-teal-700 border-teal-200 shrink-0">
              NXT
            </span>
            <h1 className="text-xs sm:text-[15px] font-semibold text-slate-900 truncate">
              Báo cáo Kho (NXT &amp; Thẻ kho)
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              SoCaiVT + CdNTXT
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setTab("summary")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                  tab === "summary"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PackageSearch className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tổng hợp NXT (vcd01)</span>
                <span className="sm:hidden">NXT</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("card")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                  tab === "card"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thẻ kho chi tiết (vct01)</span>
                <span className="sm:hidden">Thẻ kho</span>
              </button>
            </div>

            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setMobileViewMode((m) => (m === "cards" ? "table" : "cards"))
                  }
                  className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 flex items-center justify-center cursor-pointer"
                  title={mobileViewMode === "cards" ? "Xem dạng bảng" : "Xem dạng thẻ"}
                >
                  {mobileViewMode === "cards" ? (
                    <Table className="w-4 h-4" />
                  ) : (
                    <LayoutList className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(true)}
                  className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Lọc</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất CSV
            </button>
          </div>
        </div>

        {/* Mobile Quick Search Bar */}
        {isMobile ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {tab === "summary" ? (
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm mã VT, tên vật tư..."
                    className="w-full h-9 pl-8 pr-2.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <Autocomplete
                    value={selectedMaVt}
                    onChange={setSelectedMaVt}
                    fetcher={fetchVtOpts}
                    onSelect={(opt) => {
                      setSelectedMaVt(opt.value);
                      void loadStockCard(opt.value, maKho);
                    }}
                    openOnTypeOnly
                    hideIcon
                    dropdownMinWidth={300}
                    className="h-9 font-mono font-semibold bg-white"
                    placeholder="Chọn mã/tên vật tư..."
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => (tab === "summary" ? void loadSummary() : void loadStockCard())}
                aria-label="Làm mới"
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingSummary || loadingCard ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {tab === "card" && cardData && (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-slate-500">Đầu kỳ: </span>
                  <strong className="font-mono text-slate-900">
                    {formatNumber2(cardData.ton_dau)}
                  </strong>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1">
                  <span className="text-sky-700">Cuối kỳ: </span>
                  <strong className="font-mono text-sky-900">
                    {formatNumber2(cardData.ton_cuoi)} {cardData.dvt}
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Desktop Filter Bar */
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
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Kho:</span>
              <div className="w-28">
                <Autocomplete
                  value={maKho}
                  onChange={(v) => {
                    setMaKho(v);
                    setPage(1);
                  }}
                  fetcher={fetchKhoOpts}
                  onSelect={(opt) => {
                    setMaKho(opt.value);
                    setPage(1);
                  }}
                  openOnTypeOnly={false}
                  hideIcon
                  className="h-7 text-[12px] font-mono uppercase"
                  placeholder="Tất cả"
                />
              </div>
            </div>

            {tab === "summary" ? (
              <>
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm mã VT, tên vật tư..."
                    className="w-full h-7 pl-8 pr-2.5 border border-slate-300 rounded bg-white text-[12px]"
                  />
                </div>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeZero}
                    onChange={(e) => {
                      setIncludeZero(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Hiện dòng bằng 0
                </label>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Vật tư:</span>
                <div className="w-60">
                  <Autocomplete
                    value={selectedMaVt}
                    onChange={setSelectedMaVt}
                    fetcher={fetchVtOpts}
                    onSelect={(opt) => {
                      setSelectedMaVt(opt.value);
                      void loadStockCard(opt.value, maKho);
                    }}
                    openOnTypeOnly
                    hideIcon
                    className="h-7 text-[12px] font-mono font-semibold"
                    placeholder="Chọn mã/tên vật tư..."
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => (tab === "summary" ? void loadSummary() : void loadStockCard())}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingSummary || loadingCard ? "animate-spin" : ""}`}
              />
              Xem lại
            </button>

            {tab === "summary" && summaryData && (
              <div className="ml-auto text-[11px] text-slate-600 hidden lg:block">
                (Nháy đúp / Enter vào dòng vật tư để mở Thẻ kho)
              </div>
            )}

            {tab === "card" && cardData && (
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span>
                  Tồn đầu:{" "}
                  <strong className="font-mono text-slate-900">
                    {formatNumber2(cardData.ton_dau)}
                  </strong>
                </span>
                <span>
                  Nhập:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatNumber2(cardData.sum_sl_nhap)}
                  </strong>
                </span>
                <span>
                  Xuất:{" "}
                  <strong className="font-mono text-rose-700">
                    {formatNumber2(cardData.sum_sl_xuat)}
                  </strong>
                </span>
                <span>
                  Tồn cuối:{" "}
                  <strong className="font-mono text-sky-700">
                    {formatNumber2(cardData.ton_cuoi)} {cardData.dvt}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {sqlError && (
        <SqlErrorState
          message={sqlError.message}
          isSqlUnavailable={sqlError.isSqlUnavailable}
          onRetry={() => (tab === "summary" ? void loadSummary() : void loadStockCard())}
        />
      )}

      {/* Mobile Filter Sheet */}
      <MobileSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Lọc Báo cáo Kho"
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
                if (tab === "summary") void loadSummary();
                else void loadStockCard();
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kho hàng
            </label>
            <Autocomplete
              value={maKho}
              onChange={(v) => {
                setMaKho(v);
                setPage(1);
              }}
              fetcher={fetchKhoOpts}
              onSelect={(opt) => {
                setMaKho(opt.value);
                setPage(1);
              }}
              openOnTypeOnly={false}
              dropdownMinWidth={300}
              className="erp-input w-full font-mono uppercase bg-white"
              placeholder="Tất cả kho"
            />
          </div>
          {tab === "summary" && (
            <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(e) => {
                  setIncludeZero(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 accent-primary-700"
              />
              <span>Hiển thị cả vật tư tồn bằng 0</span>
            </label>
          )}
        </div>
      </MobileSheet>

      {/* Content */}
      {isMobile && mobileViewMode === "cards" ? (
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
          {tab === "summary" ? (
            <>
              {summaryData && (
                <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                  <span className="text-slate-600">
                    <strong className="font-mono text-slate-900">
                      {summaryData.total_records}
                    </strong>{" "}
                    VT · Cuối:{" "}
                    <strong className="font-mono text-sky-700">
                      {formatNumber2(summaryData.sum_ton_cuoi)}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] text-slate-600">
                      {summaryData.page}/{summaryData.total_pages}
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
                      disabled={page >= (summaryData.total_pages || 1)}
                      onClick={() => setPage((p) => Math.min(summaryData.total_pages || 1, p + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-300 bg-white disabled:opacity-40 flex items-center justify-center"
                      aria-label="Trang sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 pb-safe">
                {summaryRows.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    {loadingSummary ? "Đang tổng hợp tồn kho..." : "Không có dữ liệu NXT."}
                  </div>
                ) : (
                  summaryRows.map((r, idx) => (
                    <div
                      key={`${r.ma_kho}-${r.ma_vt}-${idx}`}
                      onClick={() => handleDrillToCard(idx)}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm cursor-pointer active:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            {r.ma_kho}
                          </span>
                          <span className="font-mono font-bold text-xs text-sky-900 truncate">
                            {r.ma_vt}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {r.dvt} · Thẻ kho ↗
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold text-slate-900 mt-1 line-clamp-2">
                        {r.ten_vt}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Đầu</span>
                          <span>{formatNumber2(r.ton_dau)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 block">Nhập</span>
                          <span className="text-emerald-700">{formatNumber2(r.sl_nhap)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-600 block">Xuất</span>
                          <span className="text-rose-700">{formatNumber2(r.sl_xuat)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-sky-700 block">Tồn</span>
                          <b className="text-sky-900">{formatNumber2(r.ton_cuoi)}</b>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 pb-safe">
              {!selectedMaVt.trim() ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200 px-4">
                  Chọn mã vật tư phía trên hoặc chạm vào 1 mặt hàng bên tab NXT để xem thẻ kho.
                </div>
              ) : cardRows.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                  {loadingCard ? "Đang tải thẻ kho..." : "Không có phát sinh trong kỳ."}
                </div>
              ) : (
                cardRows.map((r, idx) => (
                  <div
                    key={`${r.stt0}-${idx}`}
                    className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sky-900">
                        {r.ma_ct} · {r.so_ct}
                      </span>
                      <span className="font-mono text-slate-500">
                        {formatDate(r.ngay_ct)}
                      </span>
                    </div>
                    {r.dien_giai && <div className="text-slate-700">{r.dien_giai}</div>}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 font-mono text-[11px]">
                      <div>
                        {r.sl_nhap > 0 && (
                          <span className="text-emerald-700 font-bold mr-2">
                            +{formatNumber2(r.sl_nhap)}
                          </span>
                        )}
                        {r.sl_xuat > 0 && (
                          <span className="text-rose-700 font-bold">
                            -{formatNumber2(r.sl_xuat)}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sky-900">
                        Tồn: {formatNumber2(r.ton_luy_ke)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
          {tab === "summary" ? (
            <>
              <div
                ref={summaryScrollRef}
                className="flex-1 min-h-0 overflow-auto table-sticky-header mobile-table-sticky"
              >
                <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
                <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                  <tr>
                    <th className="w-10 text-center border-r border-neutral-200">#</th>
                    <th className="w-20 border-r border-neutral-200">Kho</th>
                    <th className="w-28 border-r border-neutral-200">Mã VT</th>
                    <th className="min-w-[200px] border-r border-neutral-200">Tên vật tư</th>
                    <th className="w-16 text-center border-r border-neutral-200">ĐVT</th>
                    <th className="w-24 text-right border-r border-neutral-200">Tồn đầu</th>
                    <th className="w-28 text-right border-r border-neutral-200">Tiền đầu</th>
                    <th className="w-24 text-right border-r border-neutral-200">SL Nhập</th>
                    <th className="w-28 text-right border-r border-neutral-200">Tiền Nhập</th>
                    <th className="w-24 text-right border-r border-neutral-200">SL Xuất</th>
                    <th className="w-28 text-right border-r border-neutral-200">Tiền Xuất</th>
                    <th className="w-24 text-right border-r border-neutral-200">Tồn cuối</th>
                    <th className="w-28 text-right">Tiền cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-400 text-xs">
                        {loadingSummary
                          ? "Đang tổng hợp số liệu NXT..."
                          : sqlError
                            ? "Không có dữ liệu do chưa kết nối được SQL Server."
                            : "Không có phát sinh hoặc tồn kho vật tư trong kỳ."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {summaryGrid.topSpacerHeight > 0 && (
                        <tr aria-hidden="true" style={{ height: summaryGrid.topSpacerHeight }}>
                          <td colSpan={13} className="p-0 border-0" />
                        </tr>
                      )}
                      {summaryRows
                        .slice(summaryGrid.startIndex, summaryGrid.endIndex)
                        .map((r, offset) => {
                          const idx = summaryGrid.startIndex + offset;
                          const isActive = idx === activeSummaryRow;
                          return (
                            <tr
                              key={`${r.ma_kho}-${r.ma_vt}`}
                              data-vrow={idx}
                              onClick={() => setActiveSummaryRow(idx)}
                              onDoubleClick={() => handleDrillToCard(idx)}
                              className={isActive ? "xl-row-active bg-sky-50/70" : "hover:bg-slate-50"}
                            >
                              <td className="xl-rowhead font-mono">{idx + 1}</td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={r.ma_kho}
                                  rowIndex={idx}
                                  className="xl-ro-input font-mono grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={r.ma_vt}
                                  rowIndex={idx}
                                  className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={r.ten_vt}
                                  rowIndex={idx}
                                  className="xl-ro-input grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={r.dvt}
                                  rowIndex={idx}
                                  className="xl-ro-input text-center grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber2(r.ton_dau)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber0(r.tien_dau)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber2(r.sl_nhap)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono text-emerald-700 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber0(r.tien_nhap)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono text-emerald-700 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber2(r.sl_xuat)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono text-rose-700 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber0(r.tien_xuat)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono text-rose-700 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber2(r.ton_cuoi)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono font-bold text-sky-900 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={formatNumber0(r.tien_cuoi)}
                                  rowIndex={idx}
                                  className="xl-ro-input text-right font-mono font-bold text-slate-900 grid-cell-input"
                                  onSelectRow={setActiveSummaryRow}
                                  onKeyDown={(e) => summaryGrid.handleCellKeyDown(e, idx)}
                                  onCopy={summaryGrid.handleCellCopy}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      {summaryGrid.bottomSpacerHeight > 0 && (
                        <tr aria-hidden="true" style={{ height: summaryGrid.bottomSpacerHeight }}>
                          <td colSpan={13} className="p-0 border-0" />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
                {summaryData && summaryRows.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300 font-semibold text-[12px]">
                    <tr>
                      <td colSpan={5} className="px-2 py-1.5 text-right text-slate-700 border-r border-slate-200">
                        Tổng cộng:
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono border-r border-slate-200">
                        {formatNumber2(summaryData.sum_ton_dau)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono border-r border-slate-200">
                        {formatNumber0(summaryData.sum_tien_dau)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700 border-r border-slate-200">
                        {formatNumber2(summaryData.sum_sl_nhap)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700 border-r border-slate-200">
                        {formatNumber0(summaryData.sum_tien_nhap)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-rose-700 border-r border-slate-200">
                        {formatNumber2(summaryData.sum_sl_xuat)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-rose-700 border-r border-slate-200">
                        {formatNumber0(summaryData.sum_tien_xuat)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-sky-800 border-r border-slate-200">
                        {formatNumber2(summaryData.sum_ton_cuoi)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-900">
                        {formatNumber0(summaryData.sum_tien_cuoi)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {summaryData && (
              <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                <span>
                  Trang <strong>{summaryData.page}</strong> / {summaryData.total_pages} (
                  {summaryData.total_records} mặt hàng)
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
                    disabled={page >= (summaryData.total_pages || 1)}
                    onClick={() => setPage((p) => Math.min(summaryData.total_pages || 1, p + 1))}
                    className="p-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            ref={cardScrollRef}
            className="flex-1 min-h-0 overflow-auto table-sticky-header mobile-table-sticky"
          >
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-24 text-center border-r border-neutral-200">Ngày CT</th>
                  <th className="w-16 text-center border-r border-neutral-200">Loại</th>
                  <th className="w-28 border-r border-neutral-200">Số CT</th>
                  <th className="w-24 border-r border-neutral-200">Mã ĐT</th>
                  <th className="min-w-[180px] border-r border-neutral-200">Diễn giải</th>
                  <th className="w-20 border-r border-neutral-200">Kho</th>
                  <th className="w-20 border-r border-neutral-200">Kho nhận</th>
                  <th className="w-24 text-right border-r border-neutral-200">SL Nhập</th>
                  <th className="w-24 text-right border-r border-neutral-200">SL Xuất</th>
                  <th className="w-24 text-right border-r border-neutral-200">Tồn LK</th>
                  <th className="w-28 text-right">Giá trị LK</th>
                </tr>
              </thead>
              <tbody>
                {!selectedMaVt.trim() ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-400 text-xs">
                      Nhập hoặc chọn mã vật tư ở thanh lọc phía trên (hoặc nháy đúp vào một dòng bên tab Tổng hợp NXT) để xem Thẻ kho.
                    </td>
                  </tr>
                ) : cardRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                      {loadingCard
                        ? "Đang tải thẻ kho..."
                        : "Không có phát sinh nhập/xuất của vật tư này trong kỳ."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {cardGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: cardGrid.topSpacerHeight }}>
                        <td colSpan={12} className="p-0 border-0" />
                      </tr>
                    )}
                    {cardRows
                      .slice(cardGrid.startIndex, cardGrid.endIndex)
                      .map((r, offset) => {
                        const idx = cardGrid.startIndex + offset;
                        const isActive = idx === activeCardRow;
                        return (
                          <tr
                            key={`${r.stt0}-${idx}`}
                            data-vrow={idx}
                            onClick={() => setActiveCardRow(idx)}
                            className={isActive ? "xl-row-active bg-sky-50/70" : "hover:bg-slate-50"}
                          >
                            <td className="xl-rowhead font-mono">{idx + 1}</td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatDate(r.ngay_ct)}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ma_ct}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono font-bold grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.so_ct}
                                rowIndex={idx}
                                className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ma_dt}
                                rowIndex={idx}
                                className="xl-ro-input font-mono grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.dien_giai}
                                rowIndex={idx}
                                className="xl-ro-input grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ma_kho}
                                rowIndex={idx}
                                className="xl-ro-input font-mono grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ma_kho_n}
                                rowIndex={idx}
                                className="xl-ro-input font-mono grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.sl_nhap ? formatNumber2(r.sl_nhap) : ""}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono text-emerald-700 grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.sl_xuat ? formatNumber2(r.sl_xuat) : ""}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono text-rose-700 grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber2(r.ton_luy_ke)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono font-bold text-sky-900 grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.tien_luy_ke)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={setActiveCardRow}
                                onKeyDown={(e) => cardGrid.handleCellKeyDown(e, idx)}
                                onCopy={cardGrid.handleCellCopy}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {cardGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: cardGrid.bottomSpacerHeight }}>
                        <td colSpan={12} className="p-0 border-0" />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
