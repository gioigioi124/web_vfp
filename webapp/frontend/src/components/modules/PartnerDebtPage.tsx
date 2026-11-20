import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  GripHorizontal,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  PartnerBalancePageResponse,
  PartnerBalanceRow,
  PartnerLedgerResponse,
} from "../../types/moduleVoucher";
import { formatDate, formatNumber0, getTodayDate } from "../../lib/format";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";

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
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedMaDt, setSelectedMaDt] = useState<string | null>(null);
  const [activeBalanceRow, setActiveBalanceRow] = useState(0);
  const [ledger, setLedger] = useState<PartnerLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [activeLedgerRow, setActiveLedgerRow] = useState(0);

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
  }, [tkPrefix]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadBalances = useCallback(async () => {
    setLoading(true);
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      setIsMock(Boolean(data.is_mock));

      if (data.items && data.items.length > 0) {
        const keep = data.items.findIndex((r) => r.ma_dt === selectedMaDt);
        const idx = keep >= 0 ? keep : 0;
        setActiveBalanceRow(idx);
        setSelectedMaDt(data.items[idx].ma_dt);
      } else {
        setSelectedMaDt(null);
        setLedger(null);
      }
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

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setDraggingSplit(true);
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientY - rect.top) / Math.max(240, rect.height)) * 100;
      setTopPct(Math.min(78, Math.max(25, pct)));
    };
    const onUp = () => {
      setDraggingSplit(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Header & KPI */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${
                isReceivable
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              TK {tkPrefix}
            </span>
            <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              SoCai + CdK
            </span>
            {isMock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                <Database className="w-3 h-3" />
                Chế độ Offline Mock
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất CSV
            </button>
          </div>
        </div>

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
      </header>

      {/* Split Pane */}
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
          onMouseDown={handleSplitterMouseDown}
          className={`h-2.5 bg-slate-200 hover:bg-sky-200 border-y border-slate-300 flex items-center justify-center cursor-row-resize shrink-0 ${
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
    </div>
  );
};
