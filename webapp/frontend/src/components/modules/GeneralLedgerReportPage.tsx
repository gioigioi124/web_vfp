import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Download,
  LayoutList,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table,
} from "lucide-react";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import {
  GlLedgerResponse,
  GlLedgerRow,
  TrialBalanceResponse,
  TrialBalanceRow,
} from "../../types/moduleVoucher";
import { formatDate, formatNumber0, getTodayDate } from "../../lib/format";
import { initCatalogCache, searchTaiKhoan } from "../../lib/catalogCache";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
import { extractApiError, SqlErrorState } from "../ui/SqlErrorState";

type ReportTab = "trial-balance" | "gl-ledger";

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

export const GeneralLedgerReportPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">("cards");
  const today = getTodayDate();
  const [tab, setTab] = useState<ReportTab>("trial-balance");
  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Trial Balance state
  const [tbData, setTbData] = useState<TrialBalanceResponse | null>(null);
  const [loadingTb, setLoadingTb] = useState(false);
  const [activeTbRow, setActiveTbRow] = useState(0);
  const tbScrollRef = useRef<HTMLDivElement | null>(null);

  // GL Ledger state
  const [selectedTk, setSelectedTk] = useState("1111");
  const [glData, setGlData] = useState<GlLedgerResponse | null>(null);
  const [loadingGl, setLoadingGl] = useState(false);
  const [activeGlRow, setActiveGlRow] = useState(0);
  const [sqlError, setSqlError] = useState<{ message: string; isSqlUnavailable: boolean } | null>(null);
  const glScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void initCatalogCache();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadTrialBalance = useCallback(async () => {
    setLoadingTb(true);
    setSqlError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/accounting/trial-balance?${params.toString()}`);
      if (!res.ok) {
        const err = await extractApiError(res);
        setSqlError(err);
        setTbData(null);
        return;
      }
      const data = (await res.json()) as TrialBalanceResponse;
      setTbData(data);
      setActiveTbRow(0);
    } catch (err) {
      setSqlError({
        message: err instanceof Error ? err.message : "Không thể kết nối máy chủ backend.",
        isSqlUnavailable: true,
      });
    } finally {
      setLoadingTb(false);
    }
  }, [fromDate, toDate, debouncedSearch]);

  const loadGlLedger = useCallback(
    async (tkOverride?: string) => {
      const tk = (tkOverride ?? selectedTk).trim() || "1111";
      setLoadingGl(true);
      setSqlError(null);
      try {
        const params = new URLSearchParams({ tk });
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        if (debouncedSearch) params.set("q", debouncedSearch);
        const res = await fetch(`/api/accounting/gl-ledger?${params.toString()}`);
        if (!res.ok) {
          const err = await extractApiError(res);
          setSqlError(err);
          setGlData(null);
          return;
        }
        const data = (await res.json()) as GlLedgerResponse;
        setGlData(data);
        setActiveGlRow(0);
      } catch (err) {
        setSqlError({
          message: err instanceof Error ? err.message : "Không thể kết nối máy chủ backend.",
          isSqlUnavailable: true,
        });
      } finally {
        setLoadingGl(false);
      }
    },
    [selectedTk, fromDate, toDate, debouncedSearch],
  );

  useEffect(() => {
    if (tab === "trial-balance") {
      void loadTrialBalance();
    } else {
      void loadGlLedger();
    }
  }, [tab, loadTrialBalance, loadGlLedger]);

  const tbRows: TrialBalanceRow[] = useMemo(() => tbData?.items || [], [tbData]);
  const glRows: GlLedgerRow[] = useMemo(() => glData?.entries || [], [glData]);

  const handleDrillToLedger = useCallback((idx: number) => {
    const row = tbRows[idx];
    if (!row) return;
    setSelectedTk(row.tk);
    setTab("gl-ledger");
  }, [tbRows]);

  const tbGrid = useVirtualExcelGrid({
    totalRows: tbRows.length,
    scrollContainerRef: tbScrollRef,
    estimatedRowHeight: 31,
    overscan: 15,
    onSelectRow: setActiveTbRow,
    onEnterRow: handleDrillToLedger,
  });

  const glGrid = useVirtualExcelGrid({
    totalRows: glRows.length,
    scrollContainerRef: glScrollRef,
    estimatedRowHeight: 31,
    overscan: 15,
    onSelectRow: setActiveGlRow,
  });

  const fetchTkOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (tab === "trial-balance") {
      downloadCsv(
        `CanDoiPhatSinh_${fromDate}_${toDate}.csv`,
        ["STT", "TK", "Tên tài khoản", "Bậc", "Nợ ĐK", "Có ĐK", "PS Nợ", "PS Có", "Nợ CK", "Có CK"],
        tbRows.map((r, i) => [
          i + 1,
          r.tk,
          r.ten_tk,
          r.bac_tk,
          r.du_no_dau,
          r.du_co_dau,
          r.ps_no,
          r.ps_co,
          r.du_no_cuoi,
          r.du_co_cuoi,
        ]),
      );
    } else {
      downloadCsv(
        `SoCai_${selectedTk}_${fromDate}_${toDate}.csv`,
        ["STT", "Ngày CT", "Mã CT", "Số CT", "Mã ĐT", "Tên ĐT", "Diễn giải", "TK Nợ", "TK Có", "PS Nợ", "PS Có", "Lũy kế"],
        glRows.map((r, i) => [
          i + 1,
          r.ngay_ct,
          r.ma_ct,
          r.so_ct,
          r.ma_dt,
          r.ten_dt,
          r.dien_giai,
          r.tk_no,
          r.tk_co,
          r.ps_no,
          r.ps_co,
          r.luy_ke,
        ]),
      );
    }
  }, [tab, fromDate, toDate, tbRows, glRows, selectedTk]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Header */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="px-2 py-0.5 rounded border text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0">
              BC
            </span>
            <h1 className="text-xs sm:text-[15px] font-semibold text-slate-900 truncate">
              Sổ cái &amp; CĐPS
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              SoCai + CdK
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setTab("trial-balance")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                  tab === "trial-balance"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cân đối phát sinh</span>
                <span className="sm:hidden">CĐPS</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("gl-ledger")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                  tab === "gl-ledger"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sổ cái tài khoản</span>
                <span className="sm:hidden">Sổ cái</span>
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

        {/* Mobile Quick Search & KPI */}
        {isMobile ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {tab === "gl-ledger" && (
                <div className="w-24 shrink-0">
                  <Autocomplete
                    value={selectedTk}
                    onChange={setSelectedTk}
                    fetcher={fetchTkOpts}
                    onSelect={(opt) => {
                      setSelectedTk(opt.value);
                      void loadGlLedger(opt.value);
                    }}
                    openOnTypeOnly
                    hideIcon
                    dropdownMinWidth={280}
                    className="h-9 font-mono font-bold bg-white"
                    placeholder="TK..."
                  />
                </div>
              )}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={tab === "trial-balance" ? "Lọc số hiệu / tên TK..." : "Tìm CT, đối tượng..."}
                  className="w-full h-9 pl-8 pr-2.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  tab === "trial-balance" ? void loadTrialBalance() : void loadGlLedger()
                }
                aria-label="Làm mới"
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingTb || loadingGl ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {tab === "trial-balance" && tbData && (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-slate-500">Tổng PS Nợ: </span>
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(tbData.sum_ps_no)}
                  </strong>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-slate-500">Tổng PS Có: </span>
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(tbData.sum_ps_co)}
                  </strong>
                </div>
              </div>
            )}

            {tab === "gl-ledger" && glData && (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <span className="text-slate-500">Dư đầu: </span>
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(glData.du_dau)}
                  </strong>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1">
                  <span className="text-sky-700">Dư cuối: </span>
                  <strong className="font-mono text-sky-900">
                    {formatNumber0(glData.du_cuoi)}
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Desktop Filters */
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Từ ngày</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-[12px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-[12px]"
              />
            </div>

            {tab === "gl-ledger" && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Tài khoản:</span>
                <div className="w-32">
                  <Autocomplete
                    value={selectedTk}
                    onChange={setSelectedTk}
                    fetcher={fetchTkOpts}
                    onSelect={(opt) => {
                      setSelectedTk(opt.value);
                      void loadGlLedger(opt.value);
                    }}
                    openOnTypeOnly
                    hideIcon
                    className="h-7 text-[12px] font-mono font-semibold"
                    placeholder="1111"
                  />
                </div>
                {glData?.ten_tk && (
                  <span className="text-[11px] text-slate-600 truncate max-w-[200px]">
                    ({glData.ten_tk})
                  </span>
                )}
              </div>
            )}

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={
                  tab === "trial-balance"
                    ? "Lọc số hiệu / tên tài khoản..."
                    : "Tìm số CT, đối tượng, diễn giải..."
                }
                className="w-full h-7 pl-8 pr-2.5 border border-slate-300 rounded bg-white text-[12px] focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                tab === "trial-balance" ? void loadTrialBalance() : void loadGlLedger()
              }
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingTb || loadingGl ? "animate-spin" : ""
                }`}
              />
              Xem lại
            </button>

            {tab === "trial-balance" && tbData && (
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span>
                  PS Nợ:{" "}
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(tbData.sum_ps_no)}
                  </strong>
                </span>
                <span>
                  PS Có:{" "}
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(tbData.sum_ps_co)}
                  </strong>
                </span>
                <span className="text-slate-400 hidden sm:inline">
                  (Nháy đúp / Enter vào TK để mở Sổ cái)
                </span>
              </div>
            )}

            {tab === "gl-ledger" && glData && (
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span>
                  Dư đầu:{" "}
                  <strong className="font-mono text-slate-900">
                    {formatNumber0(glData.du_dau)}
                  </strong>
                </span>
                <span>
                  Dư cuối:{" "}
                  <strong className="font-mono text-sky-700">
                    {formatNumber0(glData.du_cuoi)}
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
          onRetry={() =>
            tab === "trial-balance" ? void loadTrialBalance() : void loadGlLedger()
          }
        />
      )}

      {/* Mobile Filter Sheet */}
      <MobileSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Kỳ báo cáo & Xuất CSV"
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
                if (tab === "trial-balance") void loadTrialBalance();
                else void loadGlLedger();
                setMobileFilterOpen(false);
              }}
              className="flex-1 h-11 rounded-lg bg-primary-700 text-white text-sm font-bold"
            >
              Áp dụng
            </button>
          </div>
        }
      >
        <div className="p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
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
              onChange={(e) => setToDate(e.target.value)}
              className="erp-input w-full font-mono bg-white"
            />
          </div>
        </div>
      </MobileSheet>

      {/* Main Content */}
      {isMobile && mobileViewMode === "cards" ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-slate-50 pb-safe">
          {tab === "trial-balance" ? (
            tbRows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                {loadingTb ? "Đang tổng hợp cân đối phát sinh..." : "Không có dữ liệu."}
              </div>
            ) : (
              tbRows.map((r, idx) => (
                <div
                  key={r.tk}
                  onClick={() => handleDrillToLedger(idx)}
                  className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer active:bg-slate-50 ${
                    r.bac_tk <= 1 ? "border-indigo-200 bg-indigo-50/20" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-sky-900">
                      {r.tk}
                    </span>
                    <span className="text-[11px] text-slate-500">Sổ cái ↗</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-0.5">
                    {r.ten_tk}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-2 pt-1.5 border-t border-slate-100 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">PS Nợ</span>
                      <span>{formatNumber0(r.ps_no)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">PS Có</span>
                      <span>{formatNumber0(r.ps_co)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Cuối kỳ</span>
                      <b
                        className={
                          r.du_no_cuoi > 0
                            ? "text-emerald-700"
                            : r.du_co_cuoi > 0
                              ? "text-rose-700"
                              : "text-slate-700"
                        }
                      >
                        {r.du_no_cuoi > 0
                          ? formatNumber0(r.du_no_cuoi)
                          : r.du_co_cuoi > 0
                            ? `-${formatNumber0(r.du_co_cuoi)}`
                            : "0"}
                      </b>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : glRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              {loadingGl ? "Đang tải sổ cái..." : `Không có phát sinh cho TK ${selectedTk}.`}
            </div>
          ) : (
            glRows.map((r, idx) => (
              <div
                key={`${r.stt}-${idx}`}
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
                {(r.ten_dt || r.ma_dt) && (
                  <div className="font-semibold text-slate-900 truncate">
                    {r.ten_dt || r.ma_dt}
                  </div>
                )}
                {r.dien_giai && <div className="text-slate-600">{r.dien_giai}</div>}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 font-mono text-[11px]">
                  <div>
                    {r.ps_no !== 0 && (
                      <span className="text-slate-900 font-bold mr-2">
                        Nợ: {formatNumber0(r.ps_no)}
                      </span>
                    )}
                    {r.ps_co !== 0 && (
                      <span className="text-emerald-700 font-bold">
                        Có: {formatNumber0(r.ps_co)}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-sky-900">
                    LK: {formatNumber0(r.luy_ke)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
          {tab === "trial-balance" ? (
            <div
              ref={tbScrollRef}
              className="flex-1 min-h-0 overflow-auto table-sticky-header mobile-table-sticky"
            >
              <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-24 border-r border-neutral-200">Số hiệu TK</th>
                  <th className="min-w-[220px] border-r border-neutral-200">Tên tài khoản</th>
                  <th className="w-14 text-center border-r border-neutral-200">Bậc</th>
                  <th className="w-28 text-right border-r border-neutral-200">Nợ ĐK</th>
                  <th className="w-28 text-right border-r border-neutral-200">Có ĐK</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Nợ</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Có</th>
                  <th className="w-28 text-right border-r border-neutral-200">Nợ CK</th>
                  <th className="w-28 text-right">Có CK</th>
                </tr>
              </thead>
              <tbody>
                {tbRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      {loadingTb ? "Đang tổng hợp cân đối phát sinh..." : "Không có dữ liệu."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {tbGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: tbGrid.topSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
                      </tr>
                    )}
                    {tbRows.slice(tbGrid.startIndex, tbGrid.endIndex).map((r, offset) => {
                      const idx = tbGrid.startIndex + offset;
                      const isActive = idx === activeTbRow;
                      const isParent = r.bac_tk <= 1;
                      return (
                        <tr
                          key={r.tk}
                          data-vrow={idx}
                          onClick={() => setActiveTbRow(idx)}
                          onDoubleClick={() => handleDrillToLedger(idx)}
                          className={`${isActive ? "xl-row-active bg-sky-50/70" : "hover:bg-slate-50"} ${
                            isParent ? "font-semibold" : ""
                          }`}
                        >
                          <td className="xl-rowhead font-mono">{idx + 1}</td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.tk}
                              rowIndex={idx}
                              className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.ten_tk}
                              rowIndex={idx}
                              className="xl-ro-input grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={String(r.bac_tk)}
                              rowIndex={idx}
                              className="xl-ro-input text-center font-mono grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.du_no_dau)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.du_co_dau)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.ps_no)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.ps_co)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.du_no_cuoi)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono font-bold text-emerald-700 grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.du_co_cuoi)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono font-bold text-rose-700 grid-cell-input"
                              onSelectRow={setActiveTbRow}
                              onKeyDown={(e) => tbGrid.handleCellKeyDown(e, idx)}
                              onCopy={tbGrid.handleCellCopy}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {tbGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: tbGrid.bottomSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
              {tbData && tbRows.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-semibold text-[12px] border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="px-3 py-1.5 text-right text-slate-700">
                      TỔNG CỘNG:
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatNumber0(tbData.sum_du_no_dau)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatNumber0(tbData.sum_du_co_dau)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatNumber0(tbData.sum_ps_no)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatNumber0(tbData.sum_ps_co)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                      {formatNumber0(tbData.sum_du_no_cuoi)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-rose-700">
                      {formatNumber0(tbData.sum_du_co_cuoi)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div
            ref={glScrollRef}
            className="flex-1 min-h-0 overflow-auto table-sticky-header"
          >
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-24 text-center border-r border-neutral-200">Ngày CT</th>
                  <th className="w-16 text-center border-r border-neutral-200">Mã CT</th>
                  <th className="w-28 border-r border-neutral-200">Số CT</th>
                  <th className="w-24 border-r border-neutral-200">Mã ĐT</th>
                  <th className="min-w-[160px] border-r border-neutral-200">Đối tượng</th>
                  <th className="min-w-[200px] border-r border-neutral-200">Diễn giải</th>
                  <th className="w-20 text-center border-r border-neutral-200">TK Nợ</th>
                  <th className="w-20 text-center border-r border-neutral-200">TK Có</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Nợ</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Có</th>
                  <th className="w-32 text-right">Lũy kế</th>
                </tr>
              </thead>
              <tbody>
                {glRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                      {loadingGl
                        ? "Đang tải sổ cái tài khoản..."
                        : `Không có phát sinh trong kỳ cho TK ${selectedTk}.`}
                    </td>
                  </tr>
                ) : (
                  <>
                    {glGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: glGrid.topSpacerHeight }}>
                        <td colSpan={12} className="p-0 border-0" />
                      </tr>
                    )}
                    {glRows.slice(glGrid.startIndex, glGrid.endIndex).map((r, offset) => {
                      const idx = glGrid.startIndex + offset;
                      const isActive = idx === activeGlRow;
                      return (
                        <tr
                          key={`${r.stt}-${idx}`}
                          data-vrow={idx}
                          onClick={() => setActiveGlRow(idx)}
                          className={isActive ? "xl-row-active bg-sky-50/70" : "hover:bg-slate-50"}
                        >
                          <td className="xl-rowhead font-mono">{idx + 1}</td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatDate(r.ngay_ct)}
                              rowIndex={idx}
                              className="xl-ro-input text-center font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.ma_ct}
                              rowIndex={idx}
                              className="xl-ro-input text-center font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.so_ct}
                              rowIndex={idx}
                              className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.ma_dt}
                              rowIndex={idx}
                              className="xl-ro-input font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.ten_dt}
                              rowIndex={idx}
                              className="xl-ro-input grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.dien_giai}
                              rowIndex={idx}
                              className="xl-ro-input grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.tk_no}
                              rowIndex={idx}
                              className="xl-ro-input text-center font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={r.tk_co}
                              rowIndex={idx}
                              className="xl-ro-input text-center font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.ps_no)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.ps_co)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                          <td className="xl-ro">
                            <ReadOnlyGridInput
                              value={formatNumber0(r.luy_ke)}
                              rowIndex={idx}
                              className="xl-ro-input text-right font-mono font-bold text-slate-900 grid-cell-input"
                              onSelectRow={setActiveGlRow}
                              onKeyDown={(e) => glGrid.handleCellKeyDown(e, idx)}
                              onCopy={glGrid.handleCellCopy}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {glGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: glGrid.bottomSpacerHeight }}>
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
