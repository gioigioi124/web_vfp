import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { CashLedgerResponse } from "../../types/cashVoucher";
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
      <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary-700 text-white flex items-center justify-center shadow">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Sổ quỹ Tiền mặt & Sổ Tiền gửi Ngân hàng
            </h1>
            <div className="text-[11px] text-neutral-400">
              Tra cứu tồn đầu, thu / báo có, chi / báo nợ và số dư lũy kế theo tài khoản (CdK + SoCai)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold border border-sky-500/60 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Báo Có Excel</span>
          </button>
          <button
            type="button"
            onClick={() => void loadLedger()}
            disabled={loading}
            className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
            title="Làm mới sổ"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white border-b border-neutral-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
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
      <div className="bg-neutral-50 border-b border-neutral-200 px-3.5 py-2 grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
        <div className="bg-white border border-neutral-200 rounded px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-neutral-500">
            Số dư đầu kỳ
          </div>
          <div className="font-mono font-bold text-sm text-neutral-900">
            {formatCurrency(ledger?.du_dau || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-emerald-700">
            Tổng Thu / Báo Có
          </div>
          <div className="font-mono font-bold text-sm text-emerald-700">
            +{formatCurrency(ledger?.tong_thu || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-rose-700">
            Tổng Chi / Báo Nợ
          </div>
          <div className="font-mono font-bold text-sm text-rose-700">
            -{formatCurrency(ledger?.tong_chi || 0, "VND")} ₫
          </div>
        </div>
        <div className="bg-primary-50 border border-primary-300 rounded px-3 py-1.5 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-primary-800">
            Số dư cuối kỳ
          </div>
          <div className="font-mono font-bold text-sm text-primary-900">
            {formatCurrency(ledger?.du_cuoi || 0, "VND")} ₫
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <main
        ref={ledgerScrollRef}
        className="flex-1 min-h-0 overflow-auto table-sticky-header bg-white"
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
