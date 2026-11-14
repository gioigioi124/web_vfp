import React, { useState, useEffect, useRef, useCallback } from "react";
import { DebtLedgerData, DebtLedgerEntry } from "../types/debt";
import { formatDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import { Button } from "./ui/Button";
import { Autocomplete, AutocompleteOption } from "./ui/Autocomplete";
import {
  arrowDir,
  handleExcelMouseDown,
  selectAllLater,
} from "./ui/excelCell";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import {
  Square,
  Minimize2,
  X,
  Search,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";

interface DebtPanelProps {
  isOpen: boolean;
  onClose: () => void;
  maDt: string;
}

function getCurrentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatSpaceNumber(val: number | undefined | null): string {
  const num = Math.round(Number(val) || 0);
  const absStr = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return num < 0 ? `-${absStr}` : absStr;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const DebtPanel: React.FC<DebtPanelProps> = ({
  isOpen,
  onClose,
  maDt,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const gridHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const maDtInputRef = useRef<HTMLInputElement | null>(null);
  const maDtLatestRef = useRef<string>("");

  useModalLock(isOpen, panelRef);

  const [fromDate, setFromDate] = useState<string>(
    () => getCurrentMonthBounds().start,
  );
  const [toDate, setToDate] = useState<string>(
    () => getCurrentMonthBounds().end,
  );
  const [inputMaDt, setInputMaDt] = useState<string>("");
  const [tenDt, setTenDt] = useState<string>("");
  const [ledger, setLedger] = useState<DebtLedgerData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const fetchCustomersLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(query);
    },
    [],
  );

  const fetchLedger = useCallback(
    async (targetMaDt?: string, bd?: string, kt?: string) => {
      const code = (targetMaDt ?? maDtLatestRef.current).trim().toUpperCase();
      const start = (bd ?? fromDate).trim();
      const end = (kt ?? toDate).trim();

      if (!code) {
        setTenDt("");
        setLedger(null);
        setSelectedRowKey(null);
        setErrorMsg(null);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      setSelectedRowKey(null);
      try {
        const params = new URLSearchParams({
          ma_dt: code,
          ngay_bd: start,
          ngay_kt: end,
          tk: "131",
        });
        const res = await fetch(`/api/debt/ledger?${params.toString()}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const data = json.data as DebtLedgerData;
          setLedger(data);
          if (data.ten_dt) {
            setTenDt(data.ten_dt);
          } else {
            await initCustomerIndex();
            const hit = getCustomer(code);
            setTenDt(hit?.ten_dt || "");
          }
        } else {
          setErrorMsg(
            json?.detail?.message ||
              json?.message ||
              "Không thể tải sổ chi tiết công nợ.",
          );
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Lỗi kết nối máy chủ.");
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate],
  );

  useEffect(() => {
    if (!isOpen) return;
    const { start, end } = getCurrentMonthBounds();
    const initialCode = (maDt || "").trim().toUpperCase();
    setFromDate(start);
    setToDate(end);
    setInputMaDt(initialCode);
    maDtLatestRef.current = initialCode;
    setSelectedRowKey(null);
    setErrorMsg(null);
    setIsMaximized(false);

    if (initialCode) {
      void initCustomerIndex().then(() => {
        const hit = getCustomer(initialCode);
        setTenDt(hit?.ten_dt || "");
      });
      void fetchLedger(initialCode, start, end);
    } else {
      setTenDt("");
      setLedger(null);
      setTimeout(() => {
        maDtInputRef.current?.focus();
        maDtInputRef.current?.select();
      }, 45);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, maDt]);

  const handleSelectCustomer = useCallback(
    (code: string, hintName?: string) => {
      const clean = code.trim().toUpperCase();
      setInputMaDt(clean);
      maDtLatestRef.current = clean;
      if (hintName) {
        setTenDt(hintName);
      } else {
        const hit = getCustomer(clean);
        setTenDt(hit?.ten_dt || "");
      }
      void fetchLedger(clean, fromDate, toDate);
    },
    [fetchLedger, fromDate, toDate],
  );

  const handleExportExcel = useCallback(() => {
    const code = (ledger?.ma_dt || maDtLatestRef.current || "ALL").trim();
    const customerName = tenDt || ledger?.ten_dt || "";
    const entries: DebtLedgerEntry[] = ledger?.entries || [];

    const rowsHtml = [
      `<tr style="background:#1e3a8a;color:#ffffff;font-weight:bold;">
        <td></td><td></td><td></td>
        <td>Dư đầu kỳ</td>
        <td style="text-align:right;">${ledger && ledger.du_dau_tang > 0 ? Math.round(ledger.du_dau_tang) : ""}</td>
        <td style="text-align:right;">${ledger && ledger.du_dau_giam > 0 ? Math.round(ledger.du_dau_giam) : ""}</td>
      </tr>`,
      ...entries.map(
        (en) => `<tr>
          <td style="text-align:center;">${escapeHtml(en.ma_ct)}</td>
          <td style="text-align:center;">${escapeHtml(formatDate(en.ngay_ct))}</td>
          <td>${escapeHtml(en.so_ct)}</td>
          <td>${escapeHtml(en.dien_giai)}</td>
          <td style="text-align:right;">${en.ps_tang !== 0 ? Math.round(en.ps_tang) : ""}</td>
          <td style="text-align:right;">${en.ps_giam !== 0 ? Math.round(en.ps_giam) : ""}</td>
        </tr>`,
      ),
      `<tr style="background:#f1f5f9;font-weight:bold;">
        <td></td><td></td><td></td>
        <td>Phát sinh trong kỳ</td>
        <td style="text-align:right;">${Math.round(ledger?.tong_ps_tang || 0)}</td>
        <td style="text-align:right;">${Math.round(ledger?.tong_ps_giam || 0)}</td>
      </tr>`,
      `<tr style="background:#eff6ff;font-weight:bold;">
        <td></td><td></td><td></td>
        <td>Dư cuối kỳ</td>
        <td style="text-align:right;">${Math.round(ledger?.du_cuoi_tang || 0)}</td>
        <td style="text-align:right;">${Math.round(ledger?.du_cuoi_giam || 0)}</td>
      </tr>`,
    ].join("\n");

    const htmlDoc = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
  <h3 style="margin:0 0 4px 0;">SỔ CHI TIẾT CÔNG NỢ PHẢI THU (TK ${escapeHtml(ledger?.tk || "131")})</h3>
  <p style="margin:0 0 8px 0;">Đối tượng: <b>${escapeHtml(code)}</b>${customerName ? ` - ${escapeHtml(customerName)}` : ""} | Từ ngày: ${escapeHtml(formatDate(fromDate))} - Đến ngày: ${escapeHtml(formatDate(toDate))}</p>
  <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
    <thead>
      <tr style="background:#e2e8f0;font-weight:bold;">
        <th>Mã CT</th><th>Ngày</th><th>Số phiếu</th><th>Diễn giải</th><th>Ps tăng</th><th>Ps giảm</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const blob = new Blob(["\ufeff", htmlDoc], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SoChiTietCongNo_${code}_${fromDate}_${toDate}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fromDate, ledger, tenDt, toDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "e"
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleExportExcel();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        void fetchLedger();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        e.stopPropagation();
        maDtInputRef.current?.focus();
        maDtInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [fetchLedger, handleExportExcel, isOpen, onClose]);

  const ensureRowElementVisible = useCallback((row: HTMLTableRowElement) => {
    const container = gridScrollRef.current;
    if (!container) return;
    const headerHeight = gridHeadRef.current
      ? gridHeadRef.current.getBoundingClientRect().height
      : 0;
    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    const visibleTop = cRect.top + headerHeight;
    const visibleBottom = cRect.top + container.clientHeight;
    if (rRect.top < visibleTop) {
      container.scrollTop -= visibleTop - rRect.top;
    } else if (rRect.bottom > visibleBottom) {
      container.scrollTop += rRect.bottom - visibleBottom;
    }
  }, []);

  const focusRowCol = useCallback((row: HTMLTableRowElement, colIdx: number) => {
    const td = row.children[colIdx] as HTMLElement | undefined;
    const input =
      td?.querySelector<HTMLInputElement>("input") ||
      row.querySelector<HTMLInputElement>("input");
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
    }
  }, []);

  const handleCellCopy = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      if (el.selectionStart === el.selectionEnd && el.value) {
        e.clipboardData.setData("text/plain", el.value);
        e.preventDefault();
      }
    },
    [],
  );

  const entries = ledger?.entries || [];

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, colIdx: number) => {
      const dir = arrowDir(e.key);
      const tr = e.currentTarget.closest("tr") as HTMLTableRowElement | null;
      if (!tr) return;

      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        const allRows = Array.from(
          tableRef.current?.querySelectorAll<HTMLTableRowElement>(
            "tr[data-grid-row='true']",
          ) || [],
        );
        const curRowIdx = allRows.indexOf(tr);
        if (curRowIdx < 0) return;
        const nextIdx =
          dir === "down"
            ? Math.min(curRowIdx + 1, allRows.length - 1)
            : Math.max(curRowIdx - 1, 0);
        const nextTr = allRows[nextIdx];
        if (!nextTr) return;
        const nextKey = nextTr.getAttribute("data-row-key");
        if (nextKey) setSelectedRowKey(nextKey);
        focusRowCol(nextTr, colIdx);
        ensureRowElementVisible(nextTr);
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>("input:not([disabled])"),
        );
        const cur = rowInputs.indexOf(e.currentTarget);
        if (cur < 0) return;
        const forward = dir === "right" || (e.key === "Tab" && !e.shiftKey);
        const target = forward ? cur + 1 : cur - 1;
        if (target >= 0 && target < rowInputs.length) {
          rowInputs[target].focus({ preventScroll: true });
          rowInputs[target].select();
          return;
        }
        if (e.key === "Tab") {
          const allRows = Array.from(
            tableRef.current?.querySelectorAll<HTMLTableRowElement>(
              "tr[data-grid-row='true']",
            ) || [],
          );
          const curRowIdx = allRows.indexOf(tr);
          const nextRowIdx = curRowIdx + (forward ? 1 : -1);
          const nextTr = allRows[nextRowIdx];
          if (nextTr) {
            const nextKey = nextTr.getAttribute("data-row-key");
            if (nextKey) setSelectedRowKey(nextKey);
            focusRowCol(nextTr, forward ? 1 : 6);
            ensureRowElementVisible(nextTr);
          }
        }
      }
    },
    [ensureRowElementVisible, focusRowCol],
  );

  interface GridRowData {
    key: string;
    rowHead: string;
    maCt: string;
    ngay: string;
    soCt: string;
    dienGiai: string;
    psTang: string;
    psGiam: string;
    isMarked?: boolean;
    isSummary?: boolean;
    maCtClassName?: string;
    soCtClassName?: string;
    dienGiaiClassName?: string;
    psTangClassName?: string;
    psGiamClassName?: string;
  }

  const renderGridRow = (row: GridRowData) => {
    const isSelected = selectedRowKey === row.key;
    const boldSummary = row.isSummary ? "font-semibold text-neutral-900" : "";
    const cellFocusProps = (colIdx: number) => ({
      type: "text" as const,
      readOnly: true,
      "data-mode": "select" as const,
      onMouseDown: (e: React.MouseEvent<HTMLInputElement>) =>
        handleExcelMouseDown(e, "select"),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        setSelectedRowKey(row.key);
        e.currentTarget.select();
        selectAllLater(e.currentTarget);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
        handleCellKeyDown(e, colIdx),
      onCopy: handleCellCopy,
    });

    return (
      <tr
        key={row.key}
        data-grid-row="true"
        data-row-key={row.key}
        onClick={() => setSelectedRowKey(row.key)}
        className={
          isSelected
            ? "xl-row-active"
            : row.isMarked
              ? "xl-row-marked"
              : undefined
        }
      >
        <td className="xl-rowhead font-mono">{row.rowHead}</td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(1)}
            value={row.maCt}
            className={`xl-input text-center font-mono grid-cell-input ${
              row.maCtClassName || "font-medium text-neutral-600"
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(2)}
            value={row.ngay}
            className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(3)}
            value={row.soCt}
            className={`xl-input font-mono font-semibold grid-cell-input ${
              row.soCtClassName || "text-primary-700"
            }`}
          />
        </td>
        <td className="xl-cell min-w-[280px]">
          <input
            {...cellFocusProps(4)}
            value={row.dienGiai}
            title={row.dienGiai}
            className={`xl-input text-black truncate grid-cell-input ${
              row.dienGiaiClassName || boldSummary
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(5)}
            value={row.psTang}
            className={`xl-input text-right font-mono pr-3 grid-cell-input ${
              row.psTangClassName ||
              (row.isSummary
                ? "font-semibold text-neutral-900"
                : "font-medium text-neutral-900")
            }`}
          />
        </td>
        <td className="xl-cell">
          <input
            {...cellFocusProps(6)}
            value={row.psGiam}
            className={`xl-input text-right font-mono pr-3 grid-cell-input ${
              row.psGiamClassName || "text-neutral-700"
            }`}
          />
        </td>
      </tr>
    );
  };

  if (!isOpen) return null;

  const activeCode = (ledger?.ma_dt || inputMaDt || "").trim();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Sổ chi tiết công nợ phải thu"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`flex flex-col w-full bg-white rounded-xl shadow-2xl border border-neutral-300 overflow-hidden transition-all ${
          isMaximized
            ? "max-w-[98vw] h-[95vh]"
            : "max-w-6xl h-[86vh] max-h-[92vh]"
        }`}
        data-purpose="debt-inquiry-modal"
      >
        {/* ===== Modal Header (compact navy gradient matching PickupDialog/FilterDialog) ===== */}
        <header className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-primary-900 via-primary-800 to-neutral-900 text-white border-b border-primary-900 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-secondary-300 shrink-0" />
            <h1 className="text-sm font-bold tracking-wide uppercase text-white">
              Sổ Chi Tiết Công Nợ Phải Thu
            </h1>
            <span className="text-[11px] font-mono bg-white/10 text-neutral-100 px-1.5 py-0.5 rounded border border-white/15">
              TK {ledger?.tk || "131"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => void fetchLedger()}
              disabled={loading}
              className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="Làm mới [F5]"
              type="button"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center cursor-pointer"
              title={isMaximized ? "Thu nhỏ" : "Phóng to"}
              type="button"
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-neutral-200 hover:text-white hover:bg-danger-600 rounded transition-colors w-6 h-6 flex items-center justify-center ml-0.5 cursor-pointer"
              title="Đóng [Esc]"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ===== Compact Filter Toolbar ===== */}
        <section
          className="bg-neutral-50 border-b border-neutral-300 px-3 py-1.5 text-xs shrink-0"
          data-purpose="query-filter-bar"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <label
                className="erp-label"
                htmlFor="debt-ledger-from-date"
              >
                Từ ngày:
              </label>
              <input
                id="debt-ledger-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void fetchLedger();
                  }
                }}
                className="erp-input h-7 w-32 font-mono text-neutral-800 bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label
                className="erp-label"
                htmlFor="debt-ledger-to-date"
              >
                Đến ngày:
              </label>
              <input
                id="debt-ledger-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void fetchLedger();
                  }
                }}
                className="erp-input h-7 w-32 font-mono text-neutral-800 bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
              <label className="erp-label">Mã ĐT:</label>
              <div className="flex items-center">
                <div className="w-28">
                  <Autocomplete
                    inputRef={maDtInputRef}
                    data-autofocus
                    value={inputMaDt}
                    onChange={(val) => {
                      const clean = val.toUpperCase();
                      setInputMaDt(clean);
                      maDtLatestRef.current = clean;
                      const hit = getCustomer(clean.trim());
                      setTenDt(hit?.ten_dt || "");
                    }}
                    onSelect={(opt) => handleSelectCustomer(opt.value, opt.hint)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.ctrlKey &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.altKey
                      ) {
                        e.preventDefault();
                        const clean = maDtLatestRef.current.trim().toUpperCase();
                        const hit = getCustomer(clean);
                        if (hit) {
                          setInputMaDt(hit.ma_dt);
                          maDtLatestRef.current = hit.ma_dt;
                          setTenDt(hit.ten_dt || "");
                          void fetchLedger(hit.ma_dt, fromDate, toDate);
                        } else {
                          void fetchLedger(clean, fromDate, toDate);
                        }
                      }
                    }}
                    fetcher={fetchCustomersLocal}
                    openOnTypeOnly
                    hideIcon
                    debounceMs={30}
                    maxResults={30}
                    dropdownMinWidth={560}
                    placeholder="Mã KH..."
                    className="h-7 uppercase font-bold text-xs border-neutral-300 rounded-r-none text-primary-800"
                  />
                </div>
                <button
                  className="h-7 px-2 bg-neutral-200 hover:bg-neutral-300 border-y border-r border-neutral-300 text-neutral-600 rounded-r flex items-center justify-center cursor-pointer"
                  title="Tìm đối tượng [F4]"
                  type="button"
                  onClick={() => {
                    maDtInputRef.current?.focus();
                    maDtInputRef.current?.select();
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                className="erp-input h-7 flex-1 min-w-[160px] bg-neutral-100 text-neutral-700 font-medium truncate cursor-default"
                readOnly
                type="text"
                value={tenDt}
                placeholder="Tên đối tượng..."
                title={tenDt}
                tabIndex={-1}
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              className="h-7 px-3 shrink-0"
              disabled={loading}
              onClick={() => void fetchLedger()}
              type="button"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Tìm kiếm</span>
            </Button>
          </div>

          {errorMsg && (
            <div className="mt-1.5 px-2.5 py-1 bg-danger-50 border border-danger-200 text-danger-700 rounded text-xs">
              {errorMsg}
            </div>
          )}
        </section>

        {/* ===== Ledger Data Grid (Excel-style matching VoucherList.tsx) ===== */}
        <div
          ref={gridScrollRef}
          className="flex-1 overflow-auto table-sticky-header bg-white"
          data-purpose="ledger-grid-container"
        >
          <table
            ref={tableRef}
            className="w-full text-left dense-table border-collapse text-[12.5px] xl-grid"
          >
            <thead
              ref={gridHeadRef}
              className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300"
            >
              <tr>
                <th
                  className="w-9 text-center border-r border-neutral-200"
                  scope="col"
                >
                  #
                </th>
                <th
                  className="w-14 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ctừ
                </th>
                <th
                  className="w-24 text-center border-r border-neutral-200"
                  scope="col"
                >
                  Ngày
                </th>
                <th
                  className="w-28 text-left border-r border-neutral-200 font-mono"
                  scope="col"
                >
                  Số phiếu
                </th>
                <th
                  className="min-w-[280px] border-r border-neutral-200"
                  scope="col"
                >
                  Diễn giải
                </th>
                <th
                  className="w-36 text-right pr-3 border-r border-neutral-200"
                  scope="col"
                >
                  Ps tăng
                </th>
                <th className="w-36 text-right pr-3" scope="col">
                  Ps giảm
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-sans">
              {/* Dư đầu kỳ */}
              {renderGridRow({
                key: "opening",
                rowHead: "—",
                maCt: "",
                ngay: "",
                soCt: "",
                dienGiai: "Dư đầu kỳ",
                psTang:
                  ledger && ledger.du_dau_tang !== 0
                    ? formatSpaceNumber(ledger.du_dau_tang)
                    : "",
                psGiam:
                  ledger && ledger.du_dau_giam !== 0
                    ? formatSpaceNumber(ledger.du_dau_giam)
                    : "",
                isSummary: true,
                psGiamClassName:
                  ledger && ledger.du_dau_giam !== 0
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-neutral-900",
              })}

              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-neutral-400"
                  >
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-primary-600" />
                    Đang tải sổ chi tiết công nợ...
                  </td>
                </tr>
              ) : !inputMaDt.trim() && !ledger ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-neutral-400 italic"
                  >
                    Nhập Mã ĐT rồi nhấn Enter để tra cứu sổ chi tiết công nợ.
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-neutral-400 italic"
                  >
                    Không có phát sinh trong khoảng thời gian đã chọn.
                  </td>
                </tr>
              ) : (
                entries.map((entry, rowIdx) => {
                  const isCreditRow = entry.ps_giam > 0 && entry.ps_tang === 0;
                  return renderGridRow({
                    key: `entry-${entry.stt || rowIdx}-${entry.ma_ct}-${entry.so_ct}-${rowIdx}`,
                    rowHead: String(rowIdx + 1),
                    maCt: entry.ma_ct || "",
                    ngay: formatDate(entry.ngay_ct),
                    soCt: entry.so_ct || "",
                    dienGiai: entry.dien_giai || "",
                    psTang:
                      entry.ps_tang !== 0
                        ? formatSpaceNumber(entry.ps_tang)
                        : "",
                    psGiam:
                      entry.ps_giam !== 0
                        ? formatSpaceNumber(entry.ps_giam)
                        : "",
                    isMarked: isCreditRow,
                    maCtClassName: isCreditRow
                      ? "font-bold text-amber-700"
                      : "font-medium text-neutral-600",
                    soCtClassName: isCreditRow
                      ? "text-emerald-700"
                      : "text-primary-700",
                    psGiamClassName:
                      entry.ps_giam !== 0
                        ? "font-bold text-emerald-700"
                        : "text-neutral-700",
                  });
                })
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-white shadow-[0_-1px_0_#cbd5e1]">
              {/* Phát sinh trong kỳ */}
              {renderGridRow({
                key: "period",
                rowHead: "Σ",
                maCt: "",
                ngay: "",
                soCt: "",
                dienGiai: "Phát sinh trong kỳ",
                psTang: ledger ? formatSpaceNumber(ledger.tong_ps_tang) : "0",
                psGiam: ledger ? formatSpaceNumber(ledger.tong_ps_giam) : "0",
                isSummary: true,
                psGiamClassName:
                  ledger && ledger.tong_ps_giam !== 0
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-neutral-900",
              })}

              {/* Dư cuối kỳ */}
              {renderGridRow({
                key: "closing",
                rowHead: "≡",
                maCt: "",
                ngay: "",
                soCt: "",
                dienGiai: "Dư cuối kỳ",
                psTang: ledger ? formatSpaceNumber(ledger.du_cuoi_tang) : "0",
                psGiam: ledger ? formatSpaceNumber(ledger.du_cuoi_giam) : "0",
                isSummary: true,
                psGiamClassName:
                  ledger && ledger.du_cuoi_giam > 0
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-neutral-400",
              })}
            </tfoot>
          </table>
        </div>

        {/* ===== Compact Modal Footer matching PickupDialog/FilterDialog ===== */}
        <footer className="bg-neutral-100 px-3.5 py-2 flex items-center justify-between gap-3 border-t border-neutral-300 shrink-0 select-none text-xs">
          <div className="flex items-center gap-2 text-neutral-600 min-w-0 truncate">
            <span className="font-semibold text-neutral-800 shrink-0">
              {entries.length} chứng từ
            </span>
            {activeCode && (
              <>
                <span className="text-neutral-300">|</span>
                <span className="truncate">
                  KH: <b className="font-mono text-primary-800">{activeCode}</b>
                  {tenDt ? ` - ${tenDt}` : ""}
                </span>
              </>
            )}
            <span className="hidden md:inline-flex items-center gap-2 ml-2 text-[11px] text-neutral-500">
              <span className="text-neutral-300">|</span>
              <span>
                <kbd>Enter</kbd> Tìm
              </span>
              <span>
                <kbd>F4</kbd> Mã ĐT
              </span>
              <span>
                <kbd>F5</kbd> Làm mới
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
              onClick={handleExportExcel}
              type="button"
              title="Xuất Excel (Ctrl+E)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Xuất Excel</span>
              <kbd className="text-[9px] py-0 px-1 ml-0.5 border-emerald-300 bg-white text-emerald-800">
                Ctrl+E
              </kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              type="button"
              title="Đóng (Esc)"
            >
              <X className="w-3.5 h-3.5 text-neutral-500" />
              <span>Đóng</span>
              <kbd className="text-[9px] py-0 px-1 ml-0.5">Esc</kbd>
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
