import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  GripHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DOC_MODULE_CONFIGS,
  DocModuleKey,
  ModuleVoucherDetailItem,
  ModuleVoucherDetailResponse,
  ModuleVoucherHeader,
  ModuleVoucherPageResponse,
} from "../../types/moduleVoucher";
import {
  formatDate,
  formatNumber0,
  formatNumber2,
  getTodayDate,
} from "../../lib/format";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";
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
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [headers, setHeaders] = useState<ModuleVoucherHeader[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isMock, setIsMock] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ModuleVoucherDetailResponse | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [activeMasterRow, setActiveMasterRow] = useState(0);
  const [activeDetailRow, setActiveDetailRow] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const [topPct, setTopPct] = useState(54);
  const [draggingSplit, setDraggingSplit] = useState(false);

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
    setActiveStt(null);
    setActiveDetail(null);
    setSearchText("");
    setDebouncedSearch("");
    setBanner(null);
  }, [moduleKey]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(
        `/api/modules/${moduleKey}/vouchers?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ModuleVoucherPageResponse;
      setHeaders(data.items || []);
      setTotalRecords(data.total_records || 0);
      setTotalPages(Math.max(1, data.total_pages || 1));
      setTotalAmount(data.total_amount || 0);
      setIsMock(Boolean(data.is_mock));

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
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được danh sách chứng từ",
      });
    } finally {
      setLoadingList(false);
    }
  }, [moduleKey, page, pageSize, fromDate, toDate, debouncedSearch, activeStt]);

  useEffect(() => {
    void loadList();
  }, [moduleKey, page, pageSize, fromDate, toDate, debouncedSearch]);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      `${config.shortCode}_${fromDate}_${toDate}.csv`,
      ["STT", "Số CT", "Ngày CT", "Mã ĐT", "Tên đối tượng", "TK", "Diễn giải", "Số dòng", "Tổng tiền"],
      headers.map((h, i) => [
        i + 1,
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

  const masterColCount = 9;
  const detailColCount =
    config.detailKind === "gl" ? 8 : config.detailKind === "transfer" ? 12 : 11;

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Top Toolbar */}
      <header className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${config.accentClass}`}
            >
              {config.shortCode}
            </span>
            <h1 className="text-[15px] font-semibold text-slate-900">
              {config.title}
            </h1>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">
              {config.sqlTables}
            </span>
            {isMock && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium"
                title="Đang chạy chế độ dữ liệu mẫu do chưa kết nối SQL Server"
              >
                <Database className="w-3 h-3" />
                Chế độ Offline Mock
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFormState({ open: true, stt: null })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm mới
            </button>
            <button
              type="button"
              disabled={!activeStt}
              onClick={() => activeStt && setFormState({ open: true, stt: activeStt })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium disabled:opacity-40"
            >
              <Pencil className="w-3.5 h-3.5" />
              Sửa
            </button>
            <button
              type="button"
              disabled={!activeStt}
              onClick={() => void handleDeleteActive()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12px] font-medium disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Filters */}
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
            Tải lại
          </button>
          <div className="ml-auto text-[12px] text-slate-600">
            Tổng: <strong className="font-mono text-slate-900">{totalRecords}</strong> CT ·{" "}
            <strong className="font-mono text-sky-700">{formatNumber0(totalAmount)}</strong> đ
          </div>
        </div>

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

      {/* Split Pane */}
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
                      {loadingList ? "Đang tải danh sách..." : "Không có chứng từ nào trong kỳ."}
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
          onMouseDown={handleSplitterMouseDown}
          className={`h-2.5 bg-slate-200 hover:bg-sky-200 border-y border-slate-300 flex items-center justify-center cursor-row-resize shrink-0 ${
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
                  {config.detailKind !== "gl" && (
                    <>
                      <th className="w-24 border-r border-neutral-200">
                        {config.detailKind === "transfer" ? "Kho xuất" : "Kho"}
                      </th>
                      {config.detailKind === "transfer" && (
                        <th className="w-24 border-r border-neutral-200">Kho nhận</th>
                      )}
                      <th className="w-28 border-r border-neutral-200">Mã VT</th>
                      <th className="min-w-[200px] border-r border-neutral-200">Tên vật tư</th>
                      <th className="w-16 text-center border-r border-neutral-200">ĐVT</th>
                      <th className="w-24 text-right border-r border-neutral-200">Số lượng</th>
                      <th className="w-28 text-right border-r border-neutral-200">Đơn giá</th>
                    </>
                  )}
                  {config.detailKind === "gl" && (
                    <>
                      <th className="w-24 border-r border-neutral-200">TK Nợ</th>
                      <th className="w-24 border-r border-neutral-200">TK Có</th>
                    </>
                  )}
                  <th className="w-32 text-right border-r border-neutral-200">Thành tiền</th>
                  {config.detailKind !== "gl" && (
                    <>
                      <th className="w-20 text-center border-r border-neutral-200">TK</th>
                      <th className="w-20 text-center border-r border-neutral-200">TK ĐƯ</th>
                    </>
                  )}
                  {config.detailKind === "gl" && (
                    <>
                      <th className="w-28 border-r border-neutral-200">Mã ĐT</th>
                      <th className="w-24 border-r border-neutral-200">Bộ phận</th>
                    </>
                  )}
                  <th className="min-w-[180px]">Diễn giải</th>
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
                            {config.detailKind !== "gl" && (
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
                                    value={formatNumber2(it.so_luong)}
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
                                      isVnd ? formatNumber0(it.gia_nt) : formatNumber2(it.gia_nt)
                                    }
                                    rowIndex={idx}
                                    className="xl-ro-input text-right font-mono grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                              </>
                            )}
                            {config.detailKind === "gl" && (
                              <>
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
                                    value={it.tk_du || ""}
                                    rowIndex={idx}
                                    className="xl-ro-input font-mono font-semibold grid-cell-input"
                                    onSelectRow={setActiveDetailRow}
                                    onKeyDown={(e) => detailGrid.handleCellKeyDown(e, idx)}
                                    onCopy={detailGrid.handleCellCopy}
                                  />
                                </td>
                              </>
                            )}
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
                            {config.detailKind !== "gl" && (
                              <>
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
                              </>
                            )}
                            {config.detailKind === "gl" && (
                              <>
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
                              </>
                            )}
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
