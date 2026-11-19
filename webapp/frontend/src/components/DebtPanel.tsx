import React, { useState, useEffect, useRef, useCallback } from "react";
import { DebtLedgerData, DebtLedgerEntry } from "../types/debt";
import { VoucherFullDetail } from "../types/voucher";
import { VoucherForm } from "./VoucherForm";
import { useModalLock } from "../lib/modalLock";
import { Button } from "./ui/Button";
import { AutocompleteOption } from "./ui/Autocomplete";
import { arrowDir } from "./ui/excelCell";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import {
  Square,
  Minimize2,
  X,
  FileSpreadsheet,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  SESSION_FROM_KEY,
  SESSION_TO_KEY,
  SESSION_MAX_KEY,
  getInitialDateBounds,
  formatSpaceNumber,
  exportDebtLedgerCsv,
} from "./debt/debtUtils";
import { DebtFilterToolbar } from "./debt/DebtFilterToolbar";
import { DebtLedgerTable } from "./debt/DebtLedgerTable";

interface DebtPanelProps {
  isOpen: boolean;
  onClose: () => void;
  maDt: string;
  onVoucherSaved?: (stt?: string, savedVoucher?: VoucherFullDetail) => void;
}

export const DebtPanel: React.FC<DebtPanelProps> = ({
  isOpen,
  onClose,
  maDt,
  onVoucherSaved,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const gridHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const maDtInputRef = useRef<HTMLInputElement | null>(null);
  const maDtLatestRef = useRef<string>("");

  const [fromDate, setFromDate] = useState<string>(
    () => getInitialDateBounds().start,
  );
  const [toDate, setToDate] = useState<string>(
    () => getInitialDateBounds().end,
  );
  const [inputMaDt, setInputMaDt] = useState<string>("");
  const [tenDt, setTenDt] = useState<string>("");
  const [gioiHan, setGioiHan] = useState<number | null>(null);
  const [ledger, setLedger] = useState<DebtLedgerData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(SESSION_MAX_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [viewVoucher, setViewVoucher] = useState<VoucherFullDetail | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_FROM_KEY, fromDate);
      window.sessionStorage.setItem(SESSION_TO_KEY, toDate);
    } catch {
      /* ignore */
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_MAX_KEY, isMaximized ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [isMaximized]);

  useModalLock(isOpen && !viewVoucher, panelRef);

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
        setGioiHan(null);
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
          let nextName = data.ten_dt || "";
          let nextLimit =
            typeof data.gioi_han === "number" ? data.gioi_han : null;
          if (!nextName || nextLimit === null) {
            await initCustomerIndex();
            const hit = getCustomer(code);
            if (!nextName) nextName = hit?.ten_dt || "";
            if (nextLimit === null) {
              nextLimit = typeof hit?.gioi_han === "number" ? hit.gioi_han : 0;
            }
          }
          setTenDt(nextName);
          setGioiHan(nextLimit);
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

  const applyLocalCustomerMeta = useCallback(
    (code: string, hintName?: string) => {
      const hit = getCustomer(code);
      setTenDt(hintName || hit?.ten_dt || "");
      setGioiHan(typeof hit?.gioi_han === "number" ? hit.gioi_han : null);
      return hit;
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const { start, end } = getInitialDateBounds();
    const initialCode = (maDt || "").trim().toUpperCase();
    setFromDate(start);
    setToDate(end);
    setInputMaDt(initialCode);
    maDtLatestRef.current = initialCode;
    setSelectedRowKey(null);
    setErrorMsg(null);
    setViewVoucher(null);
    setLoadingVoucher(false);

    if (initialCode) {
      void initCustomerIndex().then(() => {
        const hit = getCustomer(initialCode);
        if (hit && maDtLatestRef.current === initialCode) {
          setTenDt((prev) => prev || hit.ten_dt || "");
          setGioiHan((prev) =>
            prev !== null
              ? prev
              : typeof hit.gioi_han === "number"
                ? hit.gioi_han
                : null,
          );
        }
      });
      void fetchLedger(initialCode, start, end);
    } else {
      setTenDt("");
      setGioiHan(null);
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
      applyLocalCustomerMeta(clean, hintName);
      void fetchLedger(clean, fromDate, toDate);
    },
    [applyLocalCustomerMeta, fetchLedger, fromDate, toDate],
  );

  const handleMaDtChange = useCallback(
    (val: string) => {
      const clean = val.toUpperCase();
      setInputMaDt(clean);
      maDtLatestRef.current = clean;
      applyLocalCustomerMeta(clean.trim());
    },
    [applyLocalCustomerMeta],
  );

  const handleMaDtEnter = useCallback(() => {
    const clean = maDtLatestRef.current.trim().toUpperCase();
    const hit = applyLocalCustomerMeta(clean);
    if (hit) {
      setInputMaDt(hit.ma_dt);
      maDtLatestRef.current = hit.ma_dt;
      void fetchLedger(hit.ma_dt, fromDate, toDate);
    } else {
      void fetchLedger(clean, fromDate, toDate);
    }
  }, [applyLocalCustomerMeta, fetchLedger, fromDate, toDate]);

  const handleExportExcel = useCallback(() => {
    exportDebtLedgerCsv({
      ledger,
      fallbackCode: maDtLatestRef.current,
      tenDt,
      fromDate,
      toDate,
    });
  }, [fromDate, ledger, tenDt, toDate]);

  const entries = ledger?.entries || [];

  const selectedEntry: DebtLedgerEntry | null =
    selectedRowKey?.startsWith("entry-")
      ? entries[Number(selectedRowKey.slice(6))] ?? null
      : null;

  const handleOpenEntryVoucher = useCallback(
    async (entry?: DebtLedgerEntry | null) => {
      const target = entry ?? selectedEntry;
      if (!target?.stt || loadingVoucher) return;
      setLoadingVoucher(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/vouchers/${encodeURIComponent(target.stt)}?db_mode=sales`,
        );
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setViewVoucher(json.data as VoucherFullDetail);
        } else {
          setErrorMsg(
            json?.detail?.message ||
              json?.message ||
              `Chứng từ ${target.ma_ct || ""} (${target.so_ct || target.stt}) không phải hóa đơn bán hàng (CtBH) nên chưa hỗ trợ xem chi tiết.`,
          );
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Lỗi kết nối khi tải chi tiết hóa đơn.");
      } finally {
        setLoadingVoucher(false);
      }
    },
    [loadingVoucher, selectedEntry],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewVoucher) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "F3") {
        if (selectedEntry) {
          e.preventDefault();
          e.stopPropagation();
          void handleOpenEntryVoucher(selectedEntry);
        }
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
  }, [
    fetchLedger,
    handleExportExcel,
    handleOpenEntryVoucher,
    isOpen,
    onClose,
    selectedEntry,
    viewVoucher,
  ]);

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

  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      colIdx: number,
      entry?: DebtLedgerEntry,
    ) => {
      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.altKey &&
        entry
      ) {
        e.preventDefault();
        e.stopPropagation();
        void handleOpenEntryVoucher(entry);
        return;
      }
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
    [ensureRowElementVisible, focusRowCol, handleOpenEntryVoucher],
  );

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
        <DebtFilterToolbar
          fromDate={fromDate}
          toDate={toDate}
          inputMaDt={inputMaDt}
          tenDt={tenDt}
          loading={loading}
          errorMsg={errorMsg}
          maDtInputRef={maDtInputRef}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onMaDtChange={handleMaDtChange}
          onSelectCustomer={handleSelectCustomer}
          onMaDtEnter={handleMaDtEnter}
          onSearch={() => void fetchLedger()}
          fetchCustomers={fetchCustomersLocal}
        />

        {/* ===== Ledger Data Grid (Excel-style matching VoucherList.tsx) ===== */}
        <DebtLedgerTable
          ledger={ledger}
          entries={entries}
          loading={loading}
          inputMaDt={inputMaDt}
          selectedRowKey={selectedRowKey}
          gridScrollRef={gridScrollRef}
          gridHeadRef={gridHeadRef}
          tableRef={tableRef}
          onSelectRowKey={setSelectedRowKey}
          onOpenEntryVoucher={(entry) => void handleOpenEntryVoucher(entry)}
          onCellKeyDown={handleCellKeyDown}
          onCellCopy={handleCellCopy}
        />

        {/* ===== Compact Modal Footer matching PickupDialog/FilterDialog ===== */}
        <footer className="bg-neutral-100 px-3.5 py-2 flex items-center justify-between gap-3 border-t border-neutral-300 shrink-0 select-none text-xs">
          <div className="flex items-center gap-2 text-neutral-600 min-w-0 truncate">
            <span className="font-semibold text-neutral-800 shrink-0">
              {entries.length} chứng từ
            </span>
            {activeCode && (
              <>
                <span className="text-neutral-300">|</span>
                <span className="shrink-0">
                  Giới hạn nợ:{" "}
                  <b
                    className={`font-mono ${
                      gioiHan !== null &&
                      gioiHan > 0 &&
                      ledger &&
                      ledger.du_cuoi >= gioiHan
                        ? "text-danger-700"
                        : "text-primary-800"
                    }`}
                  >
                    {gioiHan !== null ? formatSpaceNumber(gioiHan) : "—"}
                  </b>
                </span>
              </>
            )}
            <span className="hidden md:inline-flex items-center gap-2 ml-2 text-[11px] text-neutral-500">
              <span className="text-neutral-300">|</span>
              <span>
                <kbd>Enter</kbd>/<kbd>F3</kbd> Xem phiếu
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
              className="border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-800 disabled:opacity-45"
              disabled={!selectedEntry || loadingVoucher}
              onClick={() => void handleOpenEntryVoucher(selectedEntry)}
              type="button"
              title="Xem chi tiết hóa đơn đang chọn (Enter trên dòng hoặc F3)"
            >
              {loadingVoucher ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-700" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-primary-700" />
              )}
              <span>Xem hóa đơn</span>
              <kbd className="text-[9px] py-0 px-1 ml-0.5 border-primary-300 bg-white text-primary-800">
                F3
              </kbd>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
              onClick={handleExportExcel}
              type="button"
              title="Xuất Excel UTF-8 CSV (Ctrl+E)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Xuất CSV</span>
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

      {/* Mở hóa đơn/chứng từ toàn màn hình bằng chế độ sửa của VoucherForm */}
      {viewVoucher && (
        <div className="fixed inset-0 z-[75] bg-white flex flex-col overflow-hidden">
          <VoucherForm
            key={`debt-edit:${viewVoucher.stt}`}
            stt={viewVoucher.stt}
            voucher={viewVoucher}
            mode="S"
            voucherMode="sales"
            onBack={() => setViewVoucher(null)}
            onSaveSuccess={(savedStt, savedVoucher) => {
              setViewVoucher(null);
              void fetchLedger();
              onVoucherSaved?.(savedStt, savedVoucher);
            }}
          />
        </div>
      )}
    </div>
  );
};
