import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GripHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import {
  PartnerBalancePageResponse,
  PartnerBalanceRow,
  PartnerLedgerResponse,
} from "../../types/moduleVoucher";
import { formatDate, formatNumber0, getTodayDate } from "../../lib/format";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
import { extractApiError, SqlErrorState } from "../ui/SqlErrorState";

interface PartnerDebtPageProps {
  tkPrefix: "131" | "331";
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

export const PartnerDebtPage: React.FC<PartnerDebtPageProps> = ({ tkPrefix }) => {
  const isReceivable = tkPrefix === "131";
  const title = isReceivable ? "Công nợ phải thu (131)" : "Công nợ phải trả (331)";
  const today = getTodayDate();

  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [rows, setRows] = useState<PartnerBalanceRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sums, setSums] = useState({
    duNoDau: 0,
    duCoDau: 0,
    psNo: 0,
    psCo: 0,
    duNoCuoi: 0,
    duCoCuoi: 0,
  });
  const [sqlError, setSqlError] = useState<{ message: string; isSqlUnavailable: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedMaDt, setSelectedMaDt] = useState<string | null>(null);
  const [activeBalanceRow, setActiveBalanceRow] = useState(0);
  const [ledger, setLedger] = useState<PartnerLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [activeLedgerRow, setActiveLedgerRow] = useState(0);

  const isMobile = useIsMobile();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileLedgerOpen, setMobileLedgerOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const [topPct, setTopPct] = useState(54);
  const [draggingSplit, setDraggingSplit] = useState(false);

  useEffect(() => {
    setPage(1);
    setSelectedMaDt(null);
    setLedger(null);
    setSearchText("");
    setDebouncedSearch("");
    setSqlError(null);
  }, [tkPrefix]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setSqlError(null);
    try {
      const params = new URLSearchParams({
        tk_prefix: tkPrefix,
        page: String(page),
        page_size: String(pageSize),
      });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(`/api/accounting/partner-balances?${params.toString()}`);
      if (!res.ok) {
        const err = await extractApiError(res);
        setSqlError(err);
        setRows([]);
        setTotalRecords(0);
        setSelectedMaDt(null);
        setLedger(null);
        return;
      }
      const data = (await res.json()) as PartnerBalancePageResponse;
      setRows(data.items || []);
      setTotalRecords(data.total_records || 0);
      setTotalPages(Math.max(1, data.total_pages || 1));
      setSums({
        duNoDau: data.sum_du_no_dau || 0,
        duCoDau: data.sum_du_co_dau || 0,
        psNo: data.sum_ps_no || 0,
        psCo: data.sum_ps_co || 0,
        duNoCuoi: data.sum_du_no_cuoi || 0,
        duCoCuoi: data.sum_du_co_cuoi || 0,
      });

      if (data.items && data.items.length > 0) {
        const keep = data.items.findIndex((r) => r.ma_dt === selectedMaDt);
        const idx = keep >= 0 ? keep : 0;
        setActiveBalanceRow(idx);
        setSelectedMaDt(data.items[idx].ma_dt);
      } else {
        setSelectedMaDt(null);
        setLedger(null);
      }
    } catch (err) {
      setSqlError({
        message: err instanceof Error ? err.message : "Không thể kết nối máy chủ backend.",
        isSqlUnavailable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [tkPrefix, page, pageSize, fromDate, toDate, debouncedSearch, selectedMaDt]);

  useEffect(() => {
    void loadBalances();
  }, [tkPrefix, page, pageSize, fromDate, toDate, debouncedSearch]);

  const loadLedger = useCallback(
    async (maDt: string | null) => {
      if (!maDt) {
        setLedger(null);
        return;
      }
      setLoadingLedger(true);
      try {
        const params = new URLSearchParams({
          tk_prefix: tkPrefix,
          ma_dt: maDt,
        });
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const res = await fetch(`/api/accounting/partner-ledger?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PartnerLedgerResponse;
        setLedger(data);
        setActiveLedgerRow(0);
      } catch {
        setLedger(null);
      } finally {
        setLoadingLedger(false);
      }
    },
    [tkPrefix, fromDate, toDate],
  );

  useEffect(() => {
    void loadLedger(selectedMaDt);
  }, [selectedMaDt, loadLedger]);

  const handleSelectBalanceRow = useCallback(
    (idx: number) => {
      setActiveBalanceRow(idx);
      const r = rows[idx];
      if (r && r.ma_dt !== selectedMaDt) {
        setSelectedMaDt(r.ma_dt);
      }
    },
    [rows, selectedMaDt],
  );

  const balanceGrid = useVirtualExcelGrid({
    totalRows: rows.length,
    scrollContainerRef: masterScrollRef,
    estimatedRowHeight: 31,
    overscan: 12,
    onSelectRow: handleSelectBalanceRow,
  });

  const ledgerEntries = useMemo(() => ledger?.entries || [], [ledger]);
  const ledgerGrid = useVirtualExcelGrid({
    totalRows: ledgerEntries.length,
    scrollContainerRef: detailScrollRef,
    estimatedRowHeight: 30,
    overscan: 15,
    onSelectRow: setActiveLedgerRow,
  });

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
      `CongNo_${tkPrefix}_${fromDate}_${toDate}.csv`,
      ["STT", "Mã ĐT", "Tên đối tượng", "Nợ ĐK", "Có ĐK", "PS Nợ", "PS Có", "Nợ CK", "Có CK"],
      rows.map((r, i) => [
        i + 1,
        r.ma_dt,
        r.ten_dt,
        r.du_no_dau,
        r.du_co_dau,
        r.ps_no,
        r.ps_co,
        r.du_no_cuoi,
        r.du_co_cuoi,
      ]),
    );
  }, [tkPrefix, fromDate, toDate, rows]);

  const activePartnerRow = rows.find((r) => r.ma_dt === selectedMaDt) || null;

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Header & KPI */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold shrink-0 ${
                isReceivable
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              TK {tkPrefix}
            </span>
            <h1 className="text-xs sm:text-[15px] font-semibold text-slate-900 truncate">
              {title}
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              SoCai + CdK
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Lọc ngày</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 h-9 md:h-auto px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>

        {isMobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm mã ĐT, tên đối tượng..."
                  className="w-full h-9 pl-8 pr-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadBalances()}
                aria-label="Tải lại"
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Nợ cuối kỳ
                </div>
                <div className="font-mono font-bold text-emerald-700 text-xs">
                  {formatNumber0(sums.duNoCuoi)} ₫
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Có cuối kỳ
                </div>
                <div className="font-mono font-bold text-rose-700 text-xs">
                  {formatNumber0(sums.duCoCuoi)} ₫
                </div>
              </div>
            </div>
          </div>
        ) : (
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
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm mã ĐT, tên đối tượng..."
                className="w-full h-7 pl-8 pr-2.5 border border-slate-300 rounded bg-white text-[12px] focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadBalances()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </button>

            {/* Compact Totals Summary */}
            <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span>
                PS Nợ: <strong className="font-mono text-slate-900">{formatNumber0(sums.psNo)}</strong>
              </span>
              <span>
                PS Có: <strong className="font-mono text-slate-900">{formatNumber0(sums.psCo)}</strong>
              </span>
              <span>
                Nợ CK:{" "}
                <strong className="font-mono text-emerald-700">
                  {formatNumber0(sums.duNoCuoi)}
                </strong>
              </span>
              <span>
                Có CK:{" "}
                <strong className="font-mono text-rose-700">
                  {formatNumber0(sums.duCoCuoi)}
                </strong>
              </span>
            </div>
          </div>
        )}
      </header>

      {sqlError && (
        <SqlErrorState
          message={sqlError.message}
          isSqlUnavailable={sqlError.isSqlUnavailable}
          onRetry={() => void loadBalances()}
        />
      )}

      {/* Mobile Date Filter Sheet */}
      <MobileSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title={`Kỳ đối chiếu ${title}`}
        variant="bottom"
        footer={
          <button
            type="button"
            onClick={() => {
              void loadBalances();
              setMobileFilterOpen(false);
            }}
            className="w-full h-11 rounded-lg bg-primary-700 text-white text-sm font-bold"
          >
            Áp dụng
          </button>
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
      </MobileSheet>

      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
            <span className="text-slate-600">
              <strong className="font-mono text-slate-900">{totalRecords}</strong> đối tượng
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
            {rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                {loading ? "Đang tải công nợ..." : "Không có dữ liệu công nợ."}
              </div>
            ) : (
              rows.map((r) => {
                const isSelected = r.ma_dt === selectedMaDt;
                return (
                  <div
                    key={r.ma_dt}
                    onClick={() => {
                      setSelectedMaDt(r.ma_dt);
                      setMobileLedgerOpen(true);
                    }}
                    className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer ${
                      isSelected
                        ? "border-primary-500 ring-1 ring-primary-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-sky-900">
                        {r.ma_dt}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {r.tx_count || 0} CT · Nhấn xem sổ ↗
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">
                      {r.ten_dt}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px]">PS Nợ</span>
                        <span className="text-slate-800">{formatNumber0(r.ps_no)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">PS Có</span>
                        <span className="text-slate-800">{formatNumber0(r.ps_co)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Cuối kỳ</span>
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
                );
              })
            )}
          </div>

          <MobileSheet
            isOpen={mobileLedgerOpen && Boolean(selectedMaDt)}
            onClose={() => setMobileLedgerOpen(false)}
            variant="fullscreen"
            title={ledger ? `${ledger.ma_dt} — ${ledger.ten_dt}` : activePartnerRow?.ten_dt || selectedMaDt || ""}
            subtitle={`Sổ chi tiết TK ${tkPrefix} (${fromDate} → ${toDate})`}
          >
            <div className="p-3 space-y-2.5 bg-slate-50 min-h-full">
              {ledger && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Dư đầu</div>
                    <div className="font-mono font-bold text-slate-900">
                      {formatNumber0(ledger.du_dau)} ₫
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase">Dư cuối</div>
                    <div className="font-mono font-bold text-sky-700">
                      {formatNumber0(ledger.du_cuoi)} ₫
                    </div>
                  </div>
                </div>
              )}

              {loadingLedger ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-primary-600" />
                  Đang tải sổ chi tiết...
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                  Không có phát sinh trong kỳ cho đối tượng này.
                </div>
              ) : (
                ledgerEntries.map((entry, idx) => (
                  <div
                    key={`${entry.stt}-${idx}`}
                    className="bg-white rounded-xl border border-slate-200 p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sky-900">
                        {entry.ma_ct} · {entry.so_ct}
                      </span>
                      <span className="font-mono text-slate-500">
                        {formatDate(entry.ngay_ct)}
                      </span>
                    </div>
                    {entry.dien_giai && (
                      <div className="text-slate-700">{entry.dien_giai}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 font-mono text-[11px]">
                      <div>
                        {entry.ps_no !== 0 && (
                          <span className="text-slate-800 mr-2">
                            Nợ: <b>{formatNumber0(entry.ps_no)}</b>
                          </span>
                        )}
                        {entry.ps_co !== 0 && (
                          <span className="text-emerald-700">
                            Có: <b>{formatNumber0(entry.ps_co)}</b>
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">
                        LK: {formatNumber0(entry.luy_ke)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MobileSheet>
        </div>
      ) : (
        /* Split Pane */
        <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Top Partner Balances Grid */}
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
                  <th className="w-28 border-r border-neutral-200">Mã ĐT</th>
                  <th className="min-w-[220px] border-r border-neutral-200">Tên đối tượng</th>
                  <th className="w-28 text-right border-r border-neutral-200">Nợ ĐK</th>
                  <th className="w-28 text-right border-r border-neutral-200">Có ĐK</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Nợ</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Có</th>
                  <th className="w-28 text-right border-r border-neutral-200">Nợ CK</th>
                  <th className="w-28 text-right border-r border-neutral-200">Có CK</th>
                  <th className="w-16 text-right">CT</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      {loading ? "Đang tải công nợ..." : "Không có dữ liệu công nợ."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {balanceGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: balanceGrid.topSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
                      </tr>
                    )}
                    {rows
                      .slice(balanceGrid.startIndex, balanceGrid.endIndex)
                      .map((r, offset) => {
                        const idx = balanceGrid.startIndex + offset;
                        const isSelected = r.ma_dt === selectedMaDt || idx === activeBalanceRow;
                        return (
                          <tr
                            key={r.ma_dt}
                            data-vrow={idx}
                            onClick={() => handleSelectBalanceRow(idx)}
                            className={isSelected ? "xl-row-active bg-sky-50/70" : "hover:bg-slate-50"}
                          >
                            <td className="xl-rowhead font-mono">{idx + 1}</td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ma_dt}
                                rowIndex={idx}
                                className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={r.ten_dt}
                                rowIndex={idx}
                                className="xl-ro-input grid-cell-input"
                                title={r.ten_dt}
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.du_no_dau)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.du_co_dau)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.ps_no)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.ps_co)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.du_no_cuoi)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono font-bold text-emerald-700 grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(r.du_co_cuoi)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono font-bold text-rose-700 grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={String(r.tx_count || 0)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={handleSelectBalanceRow}
                                onKeyDown={(e) => balanceGrid.handleCellKeyDown(e, idx)}
                                onCopy={balanceGrid.handleCellCopy}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {balanceGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: balanceGrid.bottomSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <span>
              Trang <strong>{page}</strong> / {totalPages} ({totalRecords} đối tượng)
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

        {/* Bottom Ledger Drilldown */}
        <section className="flex-1 min-h-[140px] flex flex-col bg-white overflow-hidden">
          <div className="px-3 py-1 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[12px] shrink-0">
            <span className="font-semibold text-slate-700">
              Sổ chi tiết công nợ:{" "}
              {ledger ? (
                <span className="text-sky-700 font-mono">
                  {ledger.ma_dt} — {ledger.ten_dt}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">Chọn một đối tượng phía trên</span>
              )}
            </span>
            {ledger && (
              <div className="flex items-center gap-4 text-[11px] text-slate-600">
                <span>
                  Dư đầu: <strong className="font-mono">{formatNumber0(ledger.du_dau)}</strong>
                </span>
                <span>
                  Dư cuối:{" "}
                  <strong className="font-mono text-sky-700">
                    {formatNumber0(ledger.du_cuoi)}
                  </strong>
                </span>
                <span>{loadingLedger ? "Đang tải..." : `${ledgerEntries.length} bút toán`}</span>
              </div>
            )}
          </div>

          <div
            ref={detailScrollRef}
            className="flex-1 min-h-0 overflow-auto table-sticky-header"
          >
            <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                <tr>
                  <th className="w-10 text-center border-r border-neutral-200">#</th>
                  <th className="w-24 text-center border-r border-neutral-200">Ngày CT</th>
                  <th className="w-16 text-center border-r border-neutral-200">Mã CT</th>
                  <th className="w-28 border-r border-neutral-200">Số CT</th>
                  <th className="w-20 text-center border-r border-neutral-200">TK</th>
                  <th className="w-20 text-center border-r border-neutral-200">TK ĐƯ</th>
                  <th className="min-w-[220px] border-r border-neutral-200">Diễn giải</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Nợ</th>
                  <th className="w-28 text-right border-r border-neutral-200">PS Có</th>
                  <th className="w-32 text-right">Lũy kế</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-400 text-xs">
                      {loadingLedger
                        ? "Đang tải sổ chi tiết..."
                        : "Không có phát sinh trong kỳ cho đối tượng này."}
                    </td>
                  </tr>
                ) : (
                  <>
                    {ledgerGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: ledgerGrid.topSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
                      </tr>
                    )}
                    {ledgerEntries
                      .slice(ledgerGrid.startIndex, ledgerGrid.endIndex)
                      .map((entry, offset) => {
                        const idx = ledgerGrid.startIndex + offset;
                        const isActive = idx === activeLedgerRow;
                        return (
                          <tr
                            key={`${entry.stt}-${idx}`}
                            data-vrow={idx}
                            onClick={() => setActiveLedgerRow(idx)}
                            className={isActive ? "xl-row-active" : undefined}
                          >
                            <td className="xl-rowhead font-mono">{idx + 1}</td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatDate(entry.ngay_ct)}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={entry.ma_ct}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={entry.so_ct}
                                rowIndex={idx}
                                className="xl-ro-input font-mono font-semibold text-sky-900 grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={entry.tk}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={entry.tk_du}
                                rowIndex={idx}
                                className="xl-ro-input text-center font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={entry.dien_giai}
                                rowIndex={idx}
                                className="xl-ro-input grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(entry.ps_no)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(entry.ps_co)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                            <td className="xl-ro">
                              <ReadOnlyGridInput
                                value={formatNumber0(entry.luy_ke)}
                                rowIndex={idx}
                                className="xl-ro-input text-right font-mono font-bold text-slate-900 grid-cell-input"
                                onSelectRow={setActiveLedgerRow}
                                onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, idx)}
                                onCopy={ledgerGrid.handleCellCopy}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {ledgerGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: ledgerGrid.bottomSpacerHeight }}>
                        <td colSpan={10} className="p-0 border-0" />
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
    </div>
  );
};
