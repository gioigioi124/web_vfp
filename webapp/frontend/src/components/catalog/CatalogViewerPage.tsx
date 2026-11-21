import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  CATALOG_CONFIGS,
  CATALOG_CONFIG_MAP,
  CatalogColumnDef,
  CatalogConfig,
} from "../../config/catalogConfigs";
import { cachedFetch, invalidate, peek } from "../../lib/apiCache";
import { formatCurrency, formatNumber2 } from "../../lib/format";
import { normalizeSearchText, parseSearchQuery } from "../../lib/searchMatch";
import { useIsMobile } from "../../hooks/useViewport";
import { MobileSheet } from "../ui/MobileSheet";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";

type CatalogRow = Record<string, any>;

function formatCellValue(val: unknown, col: CatalogColumnDef): string {
  if (val === null || val === undefined || val === "") return "";
  if (col.type === "currency") {
    return formatCurrency(Number(val) || 0, "VND");
  }
  if (col.type === "number") {
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    return Number.isInteger(n) ? String(n) : formatNumber2(n);
  }
  return String(val);
}

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const CatalogViewerPage: React.FC = () => {
  const { catalogId } = useParams<{ catalogId?: string }>();
  const navigate = useNavigate();

  const activeConfig: CatalogConfig =
    (catalogId && CATALOG_CONFIG_MAP[catalogId]) || CATALOG_CONFIGS[0];

  const isMobile = useIsMobile();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>(activeConfig.defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(999999);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mobileInspectRow, setMobileInspectRow] = useState<CatalogRow | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // Reset local search/sort/page when switching catalog
  useEffect(() => {
    setQuery("");
    setSortKey(activeConfig.defaultSortKey);
    setSortDir("asc");
    setPage(1);
    setSelectedIndex(0);
    setMobileInspectRow(null);
    setError(null);
  }, [activeConfig.id, activeConfig.defaultSortKey]);

  const loadCatalog = useCallback(
    async (opts: { force?: boolean } = {}) => {
      const cacheKey = `catalog:${activeConfig.id}`;
      const cached = peek<any>(cacheKey);
      if (cached?.success && Array.isArray(cached.data)) {
        setRows(cached.data);
      }
      setLoading((prev) => (cached && !opts.force ? prev : true));
      setError(null);
      try {
        const body = await cachedFetch<any>(cacheKey, activeConfig.endpoint, {
          force: opts.force,
        });
        if (body?.success && Array.isArray(body.data)) {
          setRows(body.data);
        } else {
          setRows([]);
          setError("Không nhận được dữ liệu hợp lệ từ máy chủ.");
        }
      } catch (err) {
        if (!cached) setRows([]);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải danh mục từ SQL Server.",
        );
      } finally {
        setLoading(false);
      }
    },
    [activeConfig],
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Keyboard shortcuts: Ctrl+F focus search, F5 refresh
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "F5" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        invalidate(`catalog:${activeConfig.id}`);
        void loadCatalog({ force: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeConfig.id, loadCatalog]);

  const filteredAndSorted = useMemo(() => {
    const { words } = parseSearchQuery(query);
    let list = rows;
    if (words.length > 0) {
      list = rows.filter((row) => {
        const hay = normalizeSearchText(
          activeConfig.searchKeys.map((k) => row[k] ?? "").join(" "),
        );
        return words.every((w) => hay.includes(w));
      });
    }

    const sorted = [...list].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va ?? "").toLowerCase();
      const sb = String(vb ?? "").toLowerCase();
      const cmp = sa.localeCompare(sb, "vi");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, activeConfig.searchKeys, sortKey, sortDir]);

  const totalRecords = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
    setSelectedIndex(0);
  }, [query]);

  const selectedRow = pagedRows[selectedIndex] || null;
  const catalogGrid = useVirtualExcelGrid({
    totalRows: pagedRows.length,
    scrollContainerRef: tableScrollRef,
    onSelectRow: setSelectedIndex,
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExportCsv = () => {
    const headers = activeConfig.columns.map((c) => escapeCsvCell(c.label)).join(",");
    const lines = filteredAndSorted.map((row) =>
      activeConfig.columns.map((c) => escapeCsvCell(row[c.key])).join(","),
    );
    const bom = "\uFEFF";
    const blob = new Blob([bom + headers + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConfig.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden">
      {/* Dark Header Bar */}
      <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 px-3 md:px-3.5 py-2 md:py-1.5 flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-2 md:gap-3 shrink-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded text-white font-mono font-bold text-[11px] flex items-center justify-center shadow shrink-0 ${activeConfig.badgeColor}`}
            >
              {activeConfig.shortCode}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold text-white truncate">
                  {activeConfig.title}
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  <Database className="w-3 h-3 text-sky-400" />
                  {activeConfig.tableName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-200 border border-amber-700/60">
                  <Eye className="w-3 h-3" />
                  Chỉ xem (Read-only)
                </span>
              </div>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredAndSorted.length === 0}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium disabled:opacity-40"
              title="Xuất CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                invalidate(`catalog:${activeConfig.id}`);
                void loadCatalog({ force: true });
              }}
              disabled={loading}
              className="w-8 h-8 inline-flex items-center justify-center rounded bg-neutral-800 border border-neutral-700 text-neutral-300"
              title="Tải lại danh mục"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search + Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã, tên, địa chỉ... (Ctrl+F)"
              className="w-full bg-white text-neutral-900 placeholder-neutral-400 rounded pl-8 pr-7 py-1.5 md:py-1 text-sm md:text-xs font-medium outline-none border border-neutral-300 focus:border-primary-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredAndSorted.length === 0}
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium disabled:opacity-40 cursor-pointer"
            title="Xuất danh sách đang lọc ra file CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              invalidate(`catalog:${activeConfig.id}`);
              void loadCatalog({ force: true });
            }}
            disabled={loading}
            className="hidden md:inline-flex p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
            title="Tải lại danh mục (F5)"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Catalog Quick Switcher Pills */}
      <div className="bg-neutral-100 border-b border-neutral-300 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {CATALOG_CONFIGS.map((cfg) => {
          const active = cfg.id === activeConfig.id;
          return (
            <button
              key={cfg.id}
              type="button"
              onClick={() => navigate(`/catalogs/${cfg.id}`)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap border transition-colors cursor-pointer ${
                active
                  ? "bg-primary-700 text-white border-primary-800 shadow-sm font-semibold"
                  : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300"
              }`}
            >
              <span
                className={`font-mono text-[10px] font-bold px-1 rounded ${
                  active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {cfg.shortCode}
              </span>
              <span>{cfg.title}</span>
            </button>
          );
        })}
      </div>

      {/* Error banner if SQL unreachable */}
      {error && (
        <div className="bg-danger-50 border-b border-danger-200 px-4 py-2 text-xs text-danger-800 flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadCatalog({ force: true })}
            className="underline font-semibold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Dense Table / Mobile Cards */}
      <main ref={tableScrollRef} className="flex-1 min-h-0 overflow-auto bg-white">
        {isMobile ? (
          <div className="p-2.5 space-y-2 bg-slate-50 min-h-full">
            {loading && rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                Đang tải dữ liệu danh mục...
              </div>
            ) : pagedRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                {query
                  ? `Không tìm thấy dòng nào khớp "${query}"`
                  : "Danh mục chưa có dữ liệu."}
              </div>
            ) : (
              pagedRows.map((row, idx) => {
                const primaryCol = activeConfig.columns[0];
                const secondaryCol = activeConfig.columns[1];
                const extraCols = activeConfig.columns.slice(2, 5);
                const primaryVal = primaryCol ? formatCellValue(row[primaryCol.key], primaryCol) : "";
                const secondaryVal = secondaryCol
                  ? formatCellValue(row[secondaryCol.key], secondaryCol)
                  : "";
                return (
                  <button
                    key={String(row[activeConfig.columns[0]?.key] ?? idx) + "-" + idx}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(idx);
                      setMobileInspectRow(row);
                    }}
                    className={`w-full text-left rounded-xl border bg-white p-3 shadow-xs active:bg-slate-50 transition-colors ${
                      idx === selectedIndex ? "border-primary-500 ring-1 ring-primary-200" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {primaryCol && (
                          <div className="font-mono text-[13px] font-bold text-primary-700 truncate">
                            {primaryVal || "—"}
                          </div>
                        )}
                        {secondaryCol && (
                          <div className="text-[13px] font-medium text-neutral-900 line-clamp-2 mt-0.5">
                            {secondaryVal || "—"}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                        #{(safePage - 1) * pageSize + idx + 1}
                      </span>
                    </div>
                    {extraCols.some((c) => formatCellValue(row[c.key], c)) && (
                      <div className="mt-2 pt-2 border-t border-neutral-100 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {extraCols.map((col) => {
                          const v = formatCellValue(row[col.key], col);
                          if (!v) return null;
                          return (
                            <div key={col.key} className="truncate">
                              <span className="text-neutral-400">{col.label}: </span>
                              <span className="text-neutral-700 font-medium">{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
        <table className="w-full border-collapse xl-grid table-sticky-header mobile-table-sticky text-xs">
          <thead>
            <tr>
              <th className="vfp-header w-12 text-center">#</th>
              {activeConfig.columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`vfp-header cursor-pointer hover:bg-neutral-200/80 transition-colors ${
                      col.width || ""
                    } ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                    title={`Sắp xếp theo ${col.label}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>{col.label}</span>
                      {isSorted &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-primary-700" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-primary-700" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeConfig.columns.length + 1}
                  className="py-14 text-center text-neutral-500"
                >
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-2 text-primary-600" />
                  Đang tải danh mục {activeConfig.title}...
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeConfig.columns.length + 1}
                  className="py-14 text-center text-neutral-400"
                >
                  {query
                    ? `Không có bản ghi nào khớp với "${query}".`
                    : "Danh mục chưa có dữ liệu."}
                </td>
              </tr>
            ) : (
              <>
                {catalogGrid.topSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={activeConfig.columns.length + 1}
                      style={{ height: catalogGrid.topSpacerHeight, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
                {pagedRows
                  .slice(catalogGrid.startIndex, catalogGrid.endIndex)
                  .map((row, sliceIdx) => {
                    const idx = catalogGrid.startIndex + sliceIdx;
                    const rowNo = (safePage - 1) * pageSize + idx + 1;
                    const isActive = idx === selectedIndex;
                    return (
                      <tr
                        key={`${rowNo}-${String(row[activeConfig.defaultSortKey] ?? idx)}`}
                        data-vrow={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`cursor-pointer ${isActive ? "xl-row-active" : ""}`}
                      >
                        <td className="xl-rowhead font-mono">{rowNo}</td>
                        {activeConfig.columns.map((col) => {
                          const raw = row[col.key];
                          const formatted = formatCellValue(raw, col);
                          const alignClass =
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                                ? "text-center"
                                : "text-left";
                          const fontClass =
                            col.type === "mono" ||
                            col.type === "currency" ||
                            col.type === "number"
                              ? "font-mono"
                              : "";
                          return (
                            <td key={col.key} className="xl-cell max-w-[340px]">
                              <ReadOnlyGridInput
                                value={formatted}
                                title={formatted}
                                rowIndex={idx}
                                onSelectRow={setSelectedIndex}
                                onKeyDown={(e) => catalogGrid.handleCellKeyDown(e, idx)}
                                onCopy={catalogGrid.handleCellCopy}
                                className={`xl-input grid-cell-input ${alignClass} ${fontClass} ${
                                  col.key === activeConfig.defaultSortKey
                                    ? "font-bold text-primary-800"
                                    : "text-neutral-800"
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                {catalogGrid.bottomSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={activeConfig.columns.length + 1}
                      style={{ height: catalogGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
        )}
      </main>

      {/* Selected Row Inspector Strip + Pagination Footer */}
      <footer className="bg-neutral-100 border-t border-neutral-300 px-3 md:px-3.5 py-1.5 pb-safe flex flex-wrap items-center justify-between gap-2 md:gap-3 text-[11px] shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-neutral-700 shrink-0">
            Hiển thị{" "}
            <b className="font-mono text-neutral-900">{pagedRows.length}</b> /{" "}
            <b className="font-mono text-primary-800">{totalRecords}</b> dòng
            {rows.length !== totalRecords && (
              <span className="text-neutral-500"> (tổng {rows.length})</span>
            )}
          </span>
          {selectedRow && (
            <div className="hidden lg:flex items-center gap-2 min-w-0 truncate text-neutral-600 border-l border-neutral-300 pl-3">
              <span className="font-semibold text-neutral-700 shrink-0">
                Đang chọn:
              </span>
              {activeConfig.columns.slice(0, 4).map((col) => {
                const v = formatCellValue(selectedRow[col.key], col);
                if (!v) return null;
                return (
                  <span
                    key={col.key}
                    className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-neutral-200 max-w-[260px] truncate"
                    title={`${col.label}: ${v}`}
                  >
                    <span className="text-neutral-400">{col.label}:</span>
                    <b className="text-neutral-800 truncate">{v}</b>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-white border border-neutral-300 rounded px-1.5 py-1 md:py-0.5 font-mono text-[11px] text-neutral-700"
            title="Số dòng mỗi trang"
          >
            <option value={999999}>Tất cả (Ảo hóa)</option>
            <option value={100}>100 / trang</option>
            <option value={200}>200 / trang</option>
            <option value={500}>500 / trang</option>
          </select>

          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              setSelectedIndex(0);
            }}
            className="p-1.5 md:p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-neutral-700 px-1">
            {safePage}/{totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              setSelectedIndex(0);
            }}
            className="p-1.5 md:p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-40 cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Mobile Full Row Inspector Sheet */}
      <MobileSheet
        isOpen={Boolean(mobileInspectRow)}
        onClose={() => setMobileInspectRow(null)}
        title={activeConfig.title}
        subtitle={`${activeConfig.tableName} · Chi tiết bản ghi`}
        variant="bottom"
      >
        {mobileInspectRow && (
          <div className="p-3 space-y-2 pb-safe">
            {activeConfig.columns.map((col) => {
              const formatted = formatCellValue(mobileInspectRow[col.key], col);
              return (
                <div
                  key={col.key}
                  className="flex items-start justify-between gap-3 py-1.5 border-b border-neutral-100 last:border-0 text-xs"
                >
                  <span className="text-neutral-500 shrink-0">{col.label}</span>
                  <span
                    className={`text-right break-words font-medium text-neutral-900 ${
                      col.type === "mono" || col.type === "currency" || col.type === "number"
                        ? "font-mono"
                        : ""
                    }`}
                  >
                    {formatted || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </MobileSheet>
    </div>
  );
};
