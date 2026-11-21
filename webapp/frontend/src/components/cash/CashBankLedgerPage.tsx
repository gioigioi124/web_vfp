import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, FileSpreadsheet, LayoutList, RefreshCw, Search, SlidersHorizontal, Table } from "lucide-react";
import { CashLedgerResponse } from "../../types/cashVoucher";
import { MobileSheet } from "../ui/MobileSheet";
import { useIsMobile } from "../../hooks/useViewport";
import { initCatalogCache, searchTaiKhoan } from "../../lib/catalogCache";
import { formatCurrency, formatDate, getTodayDate } from "../../lib/format";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { BaoCoImportModal } from "./BaoCoImportModal";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";

const ACCOUNT_PRESETS = [
  { tk: "1111", label: "1111 · Tiền mặt VND" },
  { tk: "11212", label: "11212 · Tiền gửi NH (Báo Có)" },
  { tk: "1121", label: "1121 · Tổng tiền gửi NH" },
];

const MA_CT_TO_ROUTE: Record<string, string> = {
  C1: "/cash/receipts",
  C2: "/cash/payments",
  C3: "/bank/credits",
  C4: "/bank/debits",
};

export const CashBankLedgerPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">("cards");
  const navigate = useNavigate();
  const today = getTodayDate();
  const [tk, setTk] = useState("11212");
  const [ngayBd, setNgayBd] = useState(`${today.slice(0, 7)}-01`);
  const [ngayKt, setNgayKt] = useState(today);
  const [loading, setLoading] = useState(false);
  const [ledger, setLedger] = useState<CashLedgerResponse | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<number>(0);
  const ledgerScrollRef = useRef<HTMLDivElement | null>(null);

  const ledgerGrid = useVirtualExcelGrid({
    totalRows: 1 + (ledger?.entries?.length ?? 0),
    scrollContainerRef: ledgerScrollRef,
    onSelectRow: setActiveRow,
    onEnterRow: (rowIdx) => {
      // Row 0 is opening balance; entries start at index 1
      const entry = ledger?.entries?.[rowIdx - 1];
      if (entry) {
        handleOpenVoucher(entry.ma_ct, entry.stt);
      }
    },
  });

  const fetchTkOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const loadLedger = useCallback(
    async (overrideTk?: string) => {
      const targetTk = (overrideTk ?? tk).trim() || "11212";
      setLoading(true);
      try {
        const q = new URLSearchParams({
          tk: targetTk,
          ngay_bd: ngayBd,
          ngay_kt: ngayKt,
        });
        const res = await fetch(`/api/cash-vouchers/ledger?${q.toString()}`);
        const body = await res.json();
        if (body?.success && body?.data) {
          setLedger(body.data as CashLedgerResponse);
        }
      } catch (err) {
        console.error("Failed loading cash ledger:", err);
      } finally {
        setLoading(false);
      }
    },
    [tk, ngayBd, ngayKt],
  );

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const handleOpenVoucher = (maCt: string, stt: string) => {
    const base = MA_CT_TO_ROUTE[maCt.trim().toUpperCase()];
    if (base && stt) {
      navigate(`${base}/${encodeURIComponent(stt)}`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 px-3 md:px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 md:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded bg-primary-700 text-white flex items-center justify-center shadow shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
              Sổ quỹ TM &amp; TG Ngân hàng
            </h1>
            <div className="hidden md:block text-[11px] text-neutral-400">
              Tra cứu tồn đầu, thu / báo có, chi / báo nợ và số dư lũy kế theo tài khoản (CdK + SoCai)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isMobile && (
            <>
              <button
                type="button"
                onClick={() =>
                  setMobileViewMode((m) => (m === "cards" ? "table" : "cards"))
                }
                className="h-9 px-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs inline-flex items-center gap-1 cursor-pointer"
                title={mobileViewMode === "cards" ? "Xem dạng bảng" : "Xem dạng thẻ"}
              >
                {mobileViewMode === "cards" ? (
                  <Table className="w-3.5 h-3.5" />
                ) : (
                  <LayoutList className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="h-9 px-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Lọc</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 md:h-auto px-2.5 py-1 rounded-lg md:rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold border border-sky-500/60 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import Báo Có Excel</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            type="button"
            onClick={() => void loadLedger()}
            disabled={loading}
            className="w-9 h-9 md:w-auto md:h-auto md:p-1.5 rounded-lg md:rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
            title="Làm mới sổ"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Mobile Compact Account Presets Strip */}
      {isMobile && (
        <div className="bg-white border-b border-neutral-200 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          {ACCOUNT_PRESETS.map((p) => (
            <button
              key={p.tk}
              type="button"
              onClick={() => {
                setTk(p.tk);
                void loadLedger(p.tk);
              }}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                tk === p.tk
                  ? "bg-primary-700 text-white border-primary-800"
                  : "bg-neutral-50 text-neutral-700 border-neutral-300"
              }`}
            >
              {p.tk}
            </button>
          ))}
          <span className="text-[11px] text-neutral-500 font-mono whitespace-nowrap ml-auto">
            {ngayBd} → {ngayKt}
          </span>
        </div>
      )}

      {/* Desktop Filter Toolbar */}
      <div className="hidden md:flex bg-white border-b border-neutral-200 px-3.5 py-2 flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="erp-label">Tài khoản:</span>
          <div className="w-28">
            <Autocomplete
              value={tk}
              fetcher={fetchTkOptions}
              openOnTypeOnly
              dropdownMinWidth={360}
              onChange={setTk}
              onSelect={(opt) => {
                setTk(opt.value);
                void loadLedger(opt.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.defaultPrevented) {
                  e.preventDefault();
                  void loadLedger();
                }
              }}
              className="erp-input w-full font-mono font-bold text-primary-800"
            />
          </div>

          <div className="flex items-center gap-1">
            {ACCOUNT_PRESETS.map((p) => (
              <button
                key={p.tk}
                type="button"
                onClick={() => {
                  setTk(p.tk);
                  void loadLedger(p.tk);
                }}
                className={`px-2 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                  tk === p.tk
                    ? "bg-primary-700 text-white border-primary-800"
                    : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="text-neutral-300">|</span>

          <div className="flex items-center gap-1.5">
            <label className="erp-label">Từ:</label>
            <input
              type="date"
              value={ngayBd}
              onChange={(e) => setNgayBd(e.target.value)}
              className="erp-input font-mono text-xs"
            />
            <label className="erp-label">Đến:</label>
            <input
              type="date"
              value={ngayKt}
              onChange={(e) => setNgayKt(e.target.value)}
              className="erp-input font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary-700 hover:bg-primary-800 text-white font-semibold cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Xem sổ</span>
            </button>
          </div>
        </div>

        {ledger?.ten_tk && (
          <div className="text-xs text-neutral-600 font-medium">
            TK: <b className="font-mono text-primary-800">{ledger.tk}</b> — {ledger.ten_tk}
          </div>
        )}
      </div>

      {/* Summary KPI Bar */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-3 md:px-3.5 py-2 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
        <div className="bg-white border border-neutral-200 rounded px-2.5 md:px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-neutral-500">
            Số dư đầu kỳ
          </div>
          <div className="font-mono font-bold text-xs md:text-sm text-neutral-900">
            {formatCurrency(ledger?.du_dau || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded px-2.5 md:px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-emerald-700">
            Tổng Thu / Báo Có
          </div>
          <div className="font-mono font-bold text-xs md:text-sm text-emerald-700">
            +{formatCurrency(ledger?.tong_thu || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded px-2.5 md:px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-rose-700">
            Tổng Chi / Báo Nợ
          </div>
          <div className="font-mono font-bold text-xs md:text-sm text-rose-700">
            -{formatCurrency(ledger?.tong_chi || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-primary-50 border border-primary-300 rounded px-2.5 md:px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-primary-800">
            Số dư cuối kỳ
          </div>
          <div className="font-mono font-bold text-xs md:text-sm text-primary-900">
            {formatCurrency(ledger?.du_cuoi || 0, "VND")} ₫
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <MobileSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Lọc Sổ Quỹ / Ngân hàng"
        variant="bottom"
        footer={
          <button
            type="button"
            onClick={() => {
              void loadLedger();
              setMobileFilterOpen(false);
            }}
            className="w-full h-11 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Xem sổ</span>
          </button>
        }
      >
        <div className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Tài khoản kế toán
            </label>
            <Autocomplete
              value={tk}
              fetcher={fetchTkOptions}
              openOnTypeOnly
              dropdownMinWidth={300}
              onChange={setTk}
              onSelect={(opt) => setTk(opt.value)}
              className="erp-input w-full font-mono font-bold text-primary-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={ngayBd}
                onChange={(e) => setNgayBd(e.target.value)}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={ngayKt}
                onChange={(e) => setNgayKt(e.target.value)}
                className="erp-input w-full font-mono"
              />
            </div>
          </div>
        </div>
      </MobileSheet>

      {/* Mobile Card List View */}
      {isMobile && mobileViewMode === "cards" ? (
        <main className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-slate-50 pb-safe">
          {!ledger || ledger.entries.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs bg-white rounded-xl border border-neutral-200">
              {loading
                ? "Đang truy vấn Sổ Cái..."
                : "Không có phát sinh trong khoảng thời gian đã chọn."}
            </div>
          ) : (
            ledger.entries.map((row, idx) => {
              const canOpen = Boolean(MA_CT_TO_ROUTE[row.ma_ct.toUpperCase()]);
              return (
                <div
                  key={`${row.stt}-${idx}`}
                  onClick={() => canOpen && handleOpenVoucher(row.ma_ct, row.stt)}
                  className={`bg-white rounded-xl border border-neutral-200 p-3 shadow-sm ${
                    canOpen ? "cursor-pointer active:bg-neutral-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-100 text-primary-800">
                        {row.ma_ct}
                      </span>
                      <span className="font-mono font-bold text-sm text-primary-800 truncate">
                        {row.so_ct}
                      </span>
                      {canOpen && (
                        <ChevronRight className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                      )}
                    </div>
                    <span className="font-mono text-xs text-neutral-500 shrink-0">
                      {formatDate(row.ngay_ct)}
                    </span>
                  </div>
                  {(row.ten_dt || row.ma_dt) && (
                    <div className="text-xs font-semibold text-neutral-900 truncate mt-1">
                      {row.ten_dt || row.ma_dt}
                    </div>
                  )}
                  {row.dien_giai && (
                    <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                      {row.dien_giai}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-neutral-100 text-xs font-mono">
                    <div>
                      {row.ps_thu > 0 && (
                        <span className="text-emerald-700 font-bold">
                          +{formatCurrency(row.ps_thu, "VND")}
                        </span>
                      )}
                      {row.ps_chi > 0 && (
                        <span className="text-rose-700 font-bold">
                          -{formatCurrency(row.ps_chi, "VND")}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-600">
                      Dư: <b className="text-primary-900">{formatCurrency(row.luy_ke, "VND")}</b>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
      ) : (
        /* Ledger Table */
        <main
          ref={ledgerScrollRef}
          className="flex-1 min-h-0 overflow-auto table-sticky-header mobile-table-sticky bg-white"
        >
          <table className="w-full dense-table border-collapse xl-grid text-xs">
          <thead>
            <tr>
              <th className="vfp-header w-10 text-center">#</th>
              <th className="vfp-header w-24 text-center">Ngày CT</th>
              <th className="vfp-header w-14 text-center">Loại</th>
              <th className="vfp-header w-24">Số CT</th>
              <th className="vfp-header min-w-[180px]">Đối tượng / Khách hàng</th>
              <th className="vfp-header min-w-[240px]">Diễn giải</th>
              <th className="vfp-header w-20 text-center">TK ĐƯ</th>
              <th className="vfp-header w-32 text-right">Thu / Báo Có</th>
              <th className="vfp-header w-32 text-right">Chi / Báo Nợ</th>
              <th className="vfp-header w-36 text-right">Số dư lũy kế</th>
            </tr>
          </thead>
          <tbody>
            {ledgerGrid.topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={10}
                  style={{ height: ledgerGrid.topSpacerHeight, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {ledgerGrid.startIndex === 0 && (
              <tr
                data-vrow={0}
                onClick={() => setActiveRow(0)}
                className={activeRow === 0 ? "xl-row-active" : "xl-row-marked"}
              >
                <td className="xl-rowhead font-mono">—</td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value="—"
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input text-center font-mono text-neutral-500 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value="—"
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input text-center font-mono text-neutral-500 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value="—"
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input font-mono text-neutral-500 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value={`SỐ DƯ ĐẦU KỲ (${formatDate(ngayBd)})`}
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input font-semibold text-amber-900 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value=""
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value=""
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value="—"
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input text-right font-mono text-neutral-500 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value="—"
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input text-right font-mono text-neutral-500 grid-cell-input"
                  />
                </td>
                <td className="xl-cell">
                  <ReadOnlyGridInput
                    value={formatCurrency(ledger?.du_dau || 0, "VND")}
                    rowIndex={0}
                    onSelectRow={setActiveRow}
                    onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, 0)}
                    onCopy={ledgerGrid.handleCellCopy}
                    className="xl-input text-right font-mono font-bold text-primary-900 grid-cell-input"
                  />
                </td>
              </tr>
            )}
            {!ledger || ledger.entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-neutral-400">
                  {loading
                    ? "Đang truy vấn Sổ Cái..."
                    : "Không có phát sinh trong khoảng thời gian đã chọn."}
                </td>
              </tr>
            ) : (
              ledger.entries
                .slice(
                  Math.max(0, ledgerGrid.startIndex - 1),
                  Math.max(0, ledgerGrid.endIndex - 1),
                )
                .map((row, sliceIdx) => {
                  const idx = Math.max(0, ledgerGrid.startIndex - 1) + sliceIdx;
                  const rowIndex = idx + 1;
                  const canOpen = Boolean(MA_CT_TO_ROUTE[row.ma_ct.toUpperCase()]);
                  const isRowActive = activeRow === rowIndex;
                  return (
                    <tr
                      key={`${row.stt}-${idx}`}
                      data-vrow={rowIndex}
                      onClick={() => setActiveRow(rowIndex)}
                      onDoubleClick={() => handleOpenVoucher(row.ma_ct, row.stt)}
                      className={`${isRowActive ? "xl-row-active" : ""} ${canOpen ? "cursor-pointer" : ""}`}
                      title={canOpen ? "Click đúp hoặc Enter để mở chứng từ gốc" : undefined}
                    >
                      <td className="xl-rowhead font-mono">{idx + 1}</td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={formatDate(row.ngay_ct)}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={row.ma_ct}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-center font-mono font-bold text-primary-800 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={row.so_ct}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input font-mono font-semibold text-primary-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell max-w-[220px]">
                        <ReadOnlyGridInput
                          value={row.ten_dt || row.ma_dt || ""}
                          title={row.ten_dt || row.ma_dt}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-neutral-900 truncate grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell max-w-[300px]">
                        <ReadOnlyGridInput
                          value={row.dien_giai || ""}
                          title={row.dien_giai}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-neutral-800 truncate grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={row.tk_doi_ung || ""}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={row.ps_thu > 0 ? formatCurrency(row.ps_thu, "VND") : ""}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-right font-mono font-semibold text-emerald-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={row.ps_chi > 0 ? formatCurrency(row.ps_chi, "VND") : ""}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-right font-mono font-semibold text-rose-700 grid-cell-input"
                        />
                      </td>
                      <td className="xl-cell">
                        <ReadOnlyGridInput
                          value={formatCurrency(row.luy_ke, "VND")}
                          rowIndex={rowIndex}
                          onSelectRow={setActiveRow}
                          onKeyDown={(e) => ledgerGrid.handleCellKeyDown(e, rowIndex)}
                          onCopy={ledgerGrid.handleCellCopy}
                          className="xl-input text-right font-mono font-bold text-neutral-900 grid-cell-input"
                        />
                      </td>
                    </tr>
                  );
                })
            )}
            {ledgerGrid.bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={10}
                  style={{ height: ledgerGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </main>
      )}

      <BaoCoImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={() => {
          void loadLedger();
        }}
      />
    </div>
  );
};
