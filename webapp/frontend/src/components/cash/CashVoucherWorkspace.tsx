import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CASH_VOUCHER_CONFIGS,
  CashVoucherModuleConfig,
} from "../../config/accountingModules";
import {
  CashMaCt,
  CashVoucherDetail,
  CashVoucherFilterParams,
  CashVoucherFullDetail,
  CashVoucherHeader,
  CashVoucherSummaryTotals,
} from "../../types/cashVoucher";
import { VoucherPagination } from "../../types/voucher";
import { cachedFetch, invalidate, peek } from "../../lib/apiCache";
import { formatDate, getTodayDate } from "../../lib/format";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useModalLock } from "../../lib/modalLock";
import { TopHeaderBar } from "../TopHeaderBar";
import { CashVoucherList } from "./CashVoucherList";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  Info,
  Keyboard,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

const CashVoucherForm = lazy(() =>
  import("./CashVoucherForm").then((m) => ({ default: m.CashVoucherForm })),
);
const FilterDialog = lazy(() =>
  import("../FilterDialog").then((m) => ({ default: m.FilterDialog })),
);
const ShortcutsDialog = lazy(() =>
  import("../ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })),
);
const BaoCoImportModal = lazy(() =>
  import("./BaoCoImportModal").then((m) => ({ default: m.BaoCoImportModal })),
);

const listKey = (maCt: CashMaCt, f: CashVoucherFilterParams) =>
  `cash:list:${maCt}:${f.ngay_ct1 || ""}:${f.ngay_ct2 || ""}:${f.so_ct1 || ""}:${
    f.so_ct2 || ""
  }:${f.ma_dt || ""}:${f.ma_tte || ""}:${f.tk || ""}:${f.dien_giai || ""}:${
    f.page || 1
  }:${f.page_size || 50}`;

const detailKey = (stt: string) => `cash:detail:${stt}`;

interface CashVoucherWorkspaceProps {
  maCt: CashMaCt;
}

export const CashVoucherWorkspace: React.FC<CashVoucherWorkspaceProps> = ({
  maCt,
}) => {
  const config: CashVoucherModuleConfig = CASH_VOUCHER_CONFIGS[maCt];
  const navigate = useNavigate();
  const { stt: sttParam } = useParams<{ stt?: string }>();
  const isNew = sttParam === "new";

  const today = getTodayDate();
  const defaultMonthStart = `${today.slice(0, 7)}-01`;

  const [filters, setFilters] = useState<CashVoucherFilterParams>({
    ma_ct: maCt,
    ngay_ct1: defaultMonthStart,
    ngay_ct2: today,
    page: 1,
    page_size: 50,
  });

  // Reset ma_ct in filters when switching between C1/C2/C3/C4
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      ma_ct: maCt,
      page: 1,
    }));
    setSelectedStt(null);
    setMarked(new Set());
  }, [maCt]);

  const [vouchers, setVouchers] = useState<CashVoucherHeader[]>([]);
  const [pagination, setPagination] = useState<VoucherPagination>({
    page: 1,
    page_size: 50,
    total_records: 0,
    total_pages: 1,
    has_next: false,
  });
  const [summary, setSummary] = useState<CashVoucherSummaryTotals>({
    total_ttien_nt: 0,
    total_ttien: 0,
    total_ttien_nt3: 0,
    total_ttien3: 0,
    total_ttien_nt0: 0,
    total_ttien0: 0,
  });
  const [loading, setLoading] = useState(false);
  const [selectedStt, setSelectedStt] = useState<string | null>(null);
  const [flashStt, setFlashStt] = useState<string | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const [listDetail, setListDetail] = useState<CashVoucherDetail[]>([]);
  const [listDetailLoading, setListDetailLoading] = useState(false);
  const [editingVoucher, setEditingVoucher] =
    useState<CashVoucherFullDetail | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashVoucherHeader | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  useModalLock(!!deleteTarget, deleteDialogRef);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning" | "info";
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "warning" | "info" = "info",
    ) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast({ message, type });
      toastTimerRef.current = window.setTimeout(
        () => setToast(null),
        type === "error" ? 5000 : 3500,
      );
    },
    [],
  );

  const fetchList = useCallback(
    async (opts: { force?: boolean; silent?: boolean } = {}) => {
      const key = listKey(maCt, filters);
      const cached = peek<any>(key);
      if (cached?.success && cached?.data) {
        const items: CashVoucherHeader[] = cached.data.items || [];
        setVouchers(items);
        setPagination(cached.data.pagination);
        setSummary(cached.data.summary);
      }
      if (!opts.silent) {
        setLoading((prev) => (cached && !opts.force ? prev : true));
      }
      try {
        const q = new URLSearchParams({ ma_ct: maCt });
        if (filters.ngay_ct1) q.append("ngay_ct1", filters.ngay_ct1);
        if (filters.ngay_ct2) q.append("ngay_ct2", filters.ngay_ct2);
        if (filters.so_ct1) q.append("so_ct1", filters.so_ct1);
        if (filters.so_ct2) q.append("so_ct2", filters.so_ct2);
        if (filters.ma_dt) q.append("ma_dt", filters.ma_dt);
        if (filters.ma_tte) q.append("ma_tte", filters.ma_tte);
        if (filters.tk) q.append("tk", filters.tk);
        if (filters.dien_giai) q.append("dien_giai", filters.dien_giai);
        q.append("page", String(filters.page || 1));
        q.append("page_size", String(filters.page_size || 50));

        const data = await cachedFetch<any>(
          key,
          `/api/cash-vouchers?${q.toString()}`,
          { force: opts.force },
        );
        if (data?.success && data?.data) {
          const items: CashVoucherHeader[] = data.data.items || [];
          setVouchers(items);
          setPagination(data.data.pagination);
          setSummary(data.data.summary);
          setSelectedStt((prev) =>
            items.some((it) => it.stt === prev)
              ? prev
              : items.length > 0
                ? items[items.length - 1].stt
                : null,
          );
        } else {
          setVouchers([]);
          setSelectedStt(null);
        }
      } catch (err) {
        console.error("Failed loading cash vouchers:", err);
      } finally {
        setLoading(false);
      }
    },
    [maCt, filters],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // Load detail rows for selectedStt (bottom split pane)
  useEffect(() => {
    if (!selectedStt || sttParam) {
      if (!selectedStt) setListDetail([]);
      return;
    }
    const key = detailKey(selectedStt);
    const cached = peek<any>(key);
    if (cached?.success && cached?.data) {
      setListDetail(cached.data.items || []);
    } else {
      setListDetailLoading(true);
    }
    let cancelled = false;
    void cachedFetch<any>(
      key,
      `/api/cash-vouchers/${encodeURIComponent(selectedStt)}`,
    )
      .then((body) => {
        if (cancelled) return;
        if (body?.success && body?.data) {
          setListDetail(body.data.items || []);
        }
      })
      .finally(() => {
        if (!cancelled) setListDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStt, sttParam]);

  // Load editingVoucher when navigating to /:stt
  useEffect(() => {
    if (!sttParam || isNew) {
      setEditingVoucher(null);
      return;
    }
    const key = detailKey(sttParam);
    const cached = peek<any>(key);
    if (cached?.success && cached?.data) {
      setEditingVoucher(cached.data);
    }
    let cancelled = false;
    void cachedFetch<any>(
      key,
      `/api/cash-vouchers/${encodeURIComponent(sttParam)}`,
      { force: true },
    ).then((body) => {
      if (!cancelled && body?.success && body?.data) {
        setEditingVoucher(body.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sttParam, isNew]);

  const navToList = useCallback(() => navigate(config.route), [navigate, config.route]);
  const navToNew = useCallback(() => navigate(`${config.route}/new`), [navigate, config.route]);
  const navToDetail = useCallback(
    (stt: string) => navigate(`${config.route}/${encodeURIComponent(stt)}`),
    [navigate, config.route],
  );

  const handleApplyFilter = useCallback((next: Partial<CashVoucherFilterParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...next,
      page: next.page ?? 1,
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    invalidate("cash:");
    void fetchList({ force: true });
  }, [fetchList]);

  const currentSelectedVoucher = useMemo(
    () => vouchers.find((v) => v.stt === selectedStt) || null,
    [vouchers, selectedStt],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(
        `/api/cash-vouchers/${encodeURIComponent(target.stt)}?user_name=KTCN3`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        showToast(
          body?.detail?.message || body?.message || "Không thể xóa chứng từ.",
          "error",
        );
        return;
      }
      invalidate("cash:");
      setVouchers((prev) => prev.filter((v) => v.stt !== target.stt));
      showToast(`Đã xóa chứng từ ${target.so_ct || target.stt}.`, "success");
      void fetchList({ force: true, silent: true });
    } catch {
      showToast("Lỗi kết nối khi xóa chứng từ.", "error");
    }
  }, [deleteTarget, showToast, fetchList]);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteTarget(null);
      } else if (e.key === "F8" || e.key === "Enter") {
        e.preventDefault();
        void handleConfirmDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, handleConfirmDelete]);

  const isListHotkeysEnabled =
    !sttParam &&
    !isFilterOpen &&
    !isShortcutsOpen &&
    !isImportOpen &&
    !deleteTarget;

  useHotkeys(
    {
      onF2: navToNew,
      onCtrlM: navToNew,
      onF3: () => {
        if (selectedStt) navToDetail(selectedStt);
      },
      onEnter: () => {
        if (selectedStt) navToDetail(selectedStt);
      },
      onF5: handleRefresh,
      onF8: () => {
        if (currentSelectedVoucher) setDeleteTarget(currentSelectedVoucher);
      },
      onF9: () => setIsFilterOpen(true),
      onSpace: () => {
        if (!selectedStt) return;
        setMarked((prev) => {
          const next = new Set(prev);
          if (next.has(selectedStt)) next.delete(selectedStt);
          else next.add(selectedStt);
          return next;
        });
      },
      onCtrlA: () => setMarked(new Set(vouchers.map((v) => v.stt))),
      onCtrlU: () => setMarked(new Set()),
      onCtrlHome: () => {
        if (vouchers.length) setSelectedStt(vouchers[0].stt);
      },
      onCtrlEnd: () => {
        if (vouchers.length) setSelectedStt(vouchers[vouchers.length - 1].stt);
      },
      onCtrlF: () => {
        customerSearchInputRef.current?.focus();
        customerSearchInputRef.current?.select();
      },
    },
    isListHotkeysEnabled,
  );

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (filters.ngay_ct1 || filters.ngay_ct2) {
      chips.push({
        key: "dates",
        label: `Ngày: ${filters.ngay_ct1 ? formatDate(filters.ngay_ct1) : "..."} → ${filters.ngay_ct2 ? formatDate(filters.ngay_ct2) : "..."}`,
        onClear: () => handleApplyFilter({ ngay_ct1: "", ngay_ct2: "" }),
      });
    }
    if (filters.ma_dt) {
      chips.push({
        key: "ma_dt",
        label: `Đối tượng: ${filters.ma_dt}`,
        onClear: () => handleApplyFilter({ ma_dt: "" }),
      });
    }
    if (filters.dien_giai) {
      chips.push({
        key: "dien_giai",
        label: `Diễn giải: "${filters.dien_giai}"`,
        onClear: () => handleApplyFilter({ dien_giai: "" }),
      });
    }
    if (filters.so_ct1 || filters.so_ct2) {
      chips.push({
        key: "so_ct",
        label: `Số CT: ${filters.so_ct1 || "..."} → ${filters.so_ct2 || "..."}`,
        onClear: () => handleApplyFilter({ so_ct1: "", so_ct2: "" }),
      });
    }
    return chips;
  }, [filters, handleApplyFilter]);

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-3 right-3 z-[80] px-3.5 py-2 rounded-md shadow-lg border text-xs font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : toast.type === "error"
                ? "bg-danger-50 border-danger-300 text-danger-900"
                : toast.type === "warning"
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-info-50 border-info-300 text-info-900"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-info-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Bar (reused) */}
      {!sttParam && (
        <>
          <TopHeaderBar
            hideModeSwitcher
            moduleBadge={config.shortCode}
            moduleTitle={config.title}
            moduleAccentClass={config.badgeColor}
            filters={filters}
            loading={loading}
            onApplyFilter={handleApplyFilter}
            onRefresh={handleRefresh}
            customerSearchInputRef={customerSearchInputRef}
            extraRightActions={
              config.supportsExcelImport ? (
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold border border-sky-500/60 shadow-sm cursor-pointer"
                  title="Import Giấy Báo Có (C3) hàng loạt từ file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel</span>
                </button>
              ) : undefined
            }
          />
          {activeFilterChips.length > 0 && (
            <div className="bg-primary-50/70 border-b border-primary-200/80 px-3.5 py-1 flex items-center flex-wrap gap-1.5 text-[11px] shrink-0">
              <span className="inline-flex items-center gap-1 text-primary-800 font-semibold mr-0.5">
                <Filter className="w-3 h-3" />
                Đang lọc:
              </span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 bg-white border border-primary-200 text-primary-900 px-2 py-0.5 rounded-full shadow-sm font-medium"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onClear}
                    className="text-primary-500 hover:text-danger-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden min-h-0">
        {sttParam ? (
          <Suspense
            fallback={
              <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                <span>Đang tải biểu mẫu {config.title}...</span>
              </div>
            }
          >
            <CashVoucherForm
              key={`${maCt}:${isNew ? "new" : sttParam}`}
              config={config}
              stt={isNew ? undefined : sttParam}
              mode={isNew ? "M" : "S"}
              voucher={isNew ? null : editingVoucher}
              onBack={navToList}
              onSaveSuccess={(savedStt, savedVoucher) => {
                invalidate("cash:");
                setSelectedStt(savedStt);
                setFlashStt(savedStt);
                window.setTimeout(() => setFlashStt(null), 2000);
                navToList();
                void fetchList({ force: true, silent: true });
                showToast(
                  isNew
                    ? `Đã tạo ${config.title} ${savedVoucher?.so_ct || ""} thành công.`
                    : `Đã cập nhật ${config.title} ${savedVoucher?.so_ct || ""} thành công.`,
                  "success",
                );
              }}
            />
          </Suspense>
        ) : (
          <CashVoucherList
            config={config}
            vouchers={vouchers}
            pagination={pagination}
            summary={summary}
            loading={loading}
            selectedStt={selectedStt}
            flashStt={flashStt}
            markedStts={marked}
            detailItems={listDetail}
            detailLoading={listDetailLoading}
            onSelectStt={setSelectedStt}
            onEditVoucher={navToDetail}
            onToggleMark={(stt) =>
              setMarked((prev) => {
                const next = new Set(prev);
                if (next.has(stt)) next.delete(stt);
                else next.add(stt);
                return next;
              })
            }
            onToggleSelectAll={(all) =>
              setMarked(all ? new Set(vouchers.map((v) => v.stt)) : new Set())
            }
            onChangePage={(page) => handleApplyFilter({ page })}
          />
        )}
      </main>

      {/* Bottom Hotkey Toolbar */}
      {!sttParam && (
        <footer className="bg-neutral-900 text-neutral-200 border-t border-neutral-800 px-3 py-1 shrink-0 z-20 text-[11px]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center flex-wrap gap-1">
              <button
                type="button"
                onClick={navToNew}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 rounded border border-neutral-700 flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F2</kbd>
                <span>Thêm</span>
              </button>
              <button
                type="button"
                onClick={() => selectedStt && navToDetail(selectedStt)}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 rounded border border-neutral-700 flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F3</kbd>
                <span>Sửa</span>
              </button>
              <button
                type="button"
                onClick={() => currentSelectedVoucher && setDeleteTarget(currentSelectedVoucher)}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-danger-700 text-neutral-100 rounded border border-neutral-700 flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F8</kbd>
                <span>Xóa</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F9</kbd>
                <span>Lọc dữ liệu</span>
              </button>
              {config.supportsExcelImport && (
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="px-2 py-0.5 bg-sky-800 hover:bg-sky-700 text-white rounded border border-sky-600 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>Import Excel</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(true)}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-200 rounded border border-neutral-700 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5 text-primary-300" />
                <span>Phím tắt</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] bg-neutral-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-md shadow-2xl border border-danger-300 max-w-md w-full overflow-hidden"
          >
            <div className="bg-danger-600 text-white px-4 py-2.5 flex items-center gap-2 text-xs font-bold uppercase">
              <Trash2 className="w-4 h-4" />
              <span>Xác nhận xóa chứng từ</span>
            </div>
            <div className="p-4 text-xs text-neutral-700 space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa <b>{config.title}</b> số{" "}
                <b className="font-mono text-danger-700">{deleteTarget.so_ct}</b> ngày{" "}
                <b className="font-mono">{formatDate(deleteTarget.ngay_ct)}</b>?
              </p>
              <p className="text-[11px] text-danger-700 font-medium">
                Thao tác sẽ xóa đồng thời dữ liệu trong CtT, CtT0 và Sổ Cái (không thể hoàn tác).
              </p>
            </div>
            <div className="bg-neutral-100 px-4 py-2 flex justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-neutral-700 font-medium text-xs cursor-pointer"
              >
                Hủy bỏ (Esc)
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-3.5 py-1 bg-danger-600 hover:bg-danger-700 text-white font-semibold rounded text-xs cursor-pointer"
              >
                Xóa chứng từ (F8)
              </button>
            </div>
          </div>
        </div>
      )}

      {isFilterOpen && (
        <Suspense fallback={null}>
          <FilterDialog
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onApply={(next) => handleApplyFilter(next)}
            hideItemFilters
            customTitle={`Lọc ${config.title} (${config.shortCode})`}
          />
        </Suspense>
      )}

      {isShortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsDialog
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        </Suspense>
      )}

      {isImportOpen && (
        <Suspense fallback={null}>
          <BaoCoImportModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImported={(_count, message) => {
              invalidate("cash:");
              void fetchList({ force: true });
              showToast(message, "success");
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
