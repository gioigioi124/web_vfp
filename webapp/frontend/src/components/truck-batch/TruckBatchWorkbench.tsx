import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GripHorizontal,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Truck,
} from "lucide-react";
import { TruckMasterGrid } from "./TruckMasterGrid";
import { TruckDetailGrid } from "./TruckDetailGrid";
import { CURRENT_USER } from "../voucher-form/types";
import { useIsMobile } from "../../hooks/useViewport";
import { invalidate } from "../../lib/apiCache";
import { formatCurrency, getTodayDate } from "../../lib/format";
import {
  computeCumulativeDebts,
  mergeDraftVouchers,
  recalculateDraftVoucher,
  splitOrdersFromVoucher,
  swapVoucherCustomerPreservePrices,
} from "../../lib/truckGrouping";
import { DebtSummary } from "../../types/debt";
import {
  TruckBatchCommitResult,
  TruckDraftItem,
  TruckDraftVoucher,
  TruckSourceAdapterName,
  TruckStagePayload,
  TruckTripSummary,
} from "../../types/truckBatch";

export const TruckBatchWorkbench: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"vouchers" | "detail">("vouchers");

  const [adapter, setAdapter] = useState<TruckSourceAdapterName>("mock");
  const [trips, setTrips] = useState<TruckTripSummary[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [batchNgayCt, setBatchNgayCt] = useState<string>(getTodayDate());

  const [stagePayload, setStagePayload] = useState<TruckStagePayload | null>(
    null,
  );
  const [vouchers, setVouchers] = useState<TruckDraftVoucher[]>([]);
  const [debtMap, setDebtMap] = useState<
    Record<string, DebtSummary & { du_cuoi_kiem_tra?: number }>
  >({});
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingStage, setLoadingStage] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: "error" | "warning" | "success" | "info";
    text: string;
  } | null>(null);

  // Split pane resize (Master top / Detail bottom)
  const [splitRatio, setSplitRatio] = useState<number>(0.46);
  const splitRootRef = useRef<HTMLDivElement | null>(null);

  const handleSplitterDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const root = splitRootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const totalH = Math.max(240, rect.height);
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(0.75, Math.max(0.25, (ev.clientY - rect.top) / totalH));
      setSplitRatio(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  // Tính công nợ cộng dồn realtime theo đúng thứ tự phiếu & khách hàng
  const cumulativeDebts = useMemo(
    () => computeCumulativeDebts(vouchers, debtMap),
    [vouchers, debtMap],
  );

  // Tải danh sách chuyến xe theo adapter
  const loadTrips = useCallback(
    async (targetAdapter: TruckSourceAdapterName) => {
      setLoadingTrips(true);
      setBanner(null);
      try {
        const res = await fetch(
          `/api/truck-batch/trips?adapter=${encodeURIComponent(targetAdapter)}`,
        );
        const json = await res.json();
        if (!res.ok) {
          const msg =
            json?.detail?.message ||
            json?.message ||
            "Không thể tải danh sách chuyến xe.";
          setTrips([]);
          setSelectedTripId("");
          setStagePayload(null);
          setVouchers([]);
          setBanner({ type: "warning", text: msg });
          return;
        }
        const list: TruckTripSummary[] = json?.data?.trips || [];
        setTrips(list);
        if (list.length > 0) {
          const preferred =
            list.find((t) => t.pending_orders > 0) || list[0];
          setSelectedTripId(preferred.trip_id);
        } else {
          setSelectedTripId("");
          setStagePayload(null);
          setVouchers([]);
          setBanner({
            type: "info",
            text: "Không có chuyến xe nào có đơn kho đã duyệt trong nguồn dữ liệu này.",
          });
        }
      } catch (err) {
        setTrips([]);
        setBanner({
          type: "error",
          text: `Lỗi kết nối khi tải danh sách xe: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setLoadingTrips(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTrips(adapter);
  }, [adapter, loadTrips]);

  // Nạp dữ liệu staging (auto-group + giá + công nợ) cho chuyến xe đã chọn
  const loadStage = useCallback(
    async (
      tripId: string,
      targetAdapter: TruckSourceAdapterName,
      ngayOverride?: string,
    ) => {
      if (!tripId) return;
      setLoadingStage(true);
      setBanner(null);
      try {
        const q = new URLSearchParams({ adapter: targetAdapter });
        if (ngayOverride) q.set("ngay_ct", ngayOverride);
        const res = await fetch(
          `/api/truck-batch/trips/${encodeURIComponent(tripId)}/stage?${q.toString()}`,
        );
        const json = await res.json();
        if (!res.ok) {
          setBanner({
            type: "error",
            text:
              json?.detail?.message ||
              "Không thể nạp dữ liệu chi tiết chuyến xe.",
          });
          setStagePayload(null);
          setVouchers([]);
          return;
        }
        const data: TruckStagePayload = json.data;
        setStagePayload(data);
        setBatchNgayCt(data.ngay_ct || getTodayDate());
        const nextDebtMap = data.customer_debts || {};
        setDebtMap(nextDebtMap);

        // Khởi tạo danh sách phiếu dự kiến: mặc định bỏ tick phiếu quá nợ để không lưu nhầm
        const draftInit: TruckDraftVoucher[] = (data.vouchers || []).map((v) => ({
          ...v,
          selected: true,
          errorMsg: null,
        }));
        const initialDebts = computeCumulativeDebts(draftInit, nextDebtMap);
        const withSafeSelection = draftInit.map((v) => ({
          ...v,
          selected: !initialDebts[v.draft_id]?.isOverLimit,
        }));

        setVouchers(withSafeSelection);
        setActiveDraftId(withSafeSelection[0]?.draft_id ?? null);
      } catch (err) {
        setBanner({
          type: "error",
          text: `Lỗi nạp chuyến xe: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setLoadingStage(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedTripId) {
      void loadStage(selectedTripId, adapter);
    }
  }, [selectedTripId, adapter, loadStage]);

  // Hành động trên Master Grid
  const handleToggleSelected = useCallback((draftId: string) => {
    setVouchers((prev) =>
      prev.map((v) =>
        v.draft_id === draftId ? { ...v, selected: !v.selected } : v,
      ),
    );
  }, []);

  const handleToggleAllValid = useCallback(
    (selectAll: boolean) => {
      setVouchers((prev) => {
        if (!selectAll) {
          return prev.map((v) => ({ ...v, selected: false }));
        }
        // Chỉ tick các phiếu không bị chặn nợ (hoặc đã bypass)
        const next = prev.map((v) => ({ ...v, selected: true }));
        const debts = computeCumulativeDebts(next, debtMap);
        return next.map((v) => ({
          ...v,
          selected: v.skip_debt_check || !debts[v.draft_id]?.isOverLimit,
        }));
      });
    },
    [debtMap],
  );

  const handleUpdateDienGiai = useCallback((draftId: string, value: string) => {
    setVouchers((prev) =>
      prev.map((v) =>
        v.draft_id === draftId ? { ...v, dien_giai0: value, errorMsg: null } : v,
      ),
    );
  }, []);

  const handleApplyBatchDate = useCallback((nextDate: string) => {
    setBatchNgayCt(nextDate);
    setVouchers((prev) => prev.map((v) => ({ ...v, ngay_ct: nextDate })));
  }, []);

  const handleToggleBypassDebt = useCallback((draftId: string) => {
    setVouchers((prev) =>
      prev.map((v) => {
        if (v.draft_id !== draftId) return v;
        const nextBypass = !v.skip_debt_check;
        return {
          ...v,
          skip_debt_check: nextBypass,
          selected: nextBypass ? true : v.selected,
          errorMsg: null,
        };
      }),
    );
  }, []);

  // Đổi khách hàng giữ nguyên 100% giá & CK, đồng thời kiểm tra lại công nợ khách mới
  const handleSwapCustomer = useCallback(
    async (
      draftId: string,
      nextCustomer: {
        ma_dt: string;
        ten_dt: string;
        dia_chi?: string;
        ong_ba?: string;
        ma_bp?: string;
        han_tt?: number;
      },
    ) => {
      const cleanCode = nextCustomer.ma_dt.trim().toUpperCase();
      setVouchers((prev) =>
        prev.map((v) =>
          v.draft_id === draftId
            ? swapVoucherCustomerPreservePrices(v, nextCustomer)
            : v,
        ),
      );

      // Tra công nợ của khách hàng mới nếu chưa có trong debtMap
      if (cleanCode && !debtMap[cleanCode]) {
        try {
          const res = await fetch(
            `/api/truck-batch/customer-debt?adapter=${encodeURIComponent(adapter)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ma_dt: cleanCode }),
            },
          );
          if (res.ok) {
            const json = await res.json();
            if (json?.data) {
              setDebtMap((prev) => ({ ...prev, [cleanCode]: json.data }));
            }
          }
        } catch {
          /* ignore network hiccup; backend still validates on commit */
        }
      }

      setBanner({
        type: "info",
        text: `Đã đổi phiếu ${draftId} sang khách ${cleanCode} — giữ nguyên toàn bộ đơn giá và chiết khấu.`,
      });
    },
    [adapter, debtMap],
  );

  // Nút phụ: chỉ áp lại bảng giá khi kế toán CHỦ ĐỘNG bấm sau khi đổi khách
  const handleRepriceForCustomer = useCallback(
    async (draftId: string) => {
      const target = vouchers.find((v) => v.draft_id === draftId);
      if (!target) return;
      const codes = Array.from(
        new Set(
          target.items
            .map((i) => (i.ma_vt || "").trim().toUpperCase())
            .filter(Boolean),
        ),
      );
      if (codes.length === 0) return;

      try {
        const res = await fetch("/api/truck-batch/reprice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ma_dt: target.ma_dt,
            ngay_ct: target.ngay_ct || batchNgayCt,
            ma_vt_list: codes,
          }),
        });
        const json = await res.json();
        const priceMap: Record<string, { gia?: number; chiet_khau?: number }> =
          json?.data?.prices || {};

        setVouchers((prev) =>
          prev.map((v) => {
            if (v.draft_id !== draftId) return v;
            const nextItems = v.items.map((it) => {
              const hit = priceMap[(it.ma_vt || "").trim().toUpperCase()];
              if (!hit) return it;
              return {
                ...it,
                gia_nt9: Number(hit.gia ?? it.gia_nt9 ?? 0),
                chiet_khau: Number(hit.chiet_khau ?? it.chiet_khau ?? 0),
              };
            });
            return recalculateDraftVoucher({ ...v, items: nextItems });
          }),
        );
        setBanner({
          type: "success",
          text: `Đã áp lại bảng giá mới cho khách ${target.ma_dt}.`,
        });
      } catch {
        setBanner({
          type: "error",
          text: "Không thể tra lại bảng giá cho khách hàng mới.",
        });
      }
    },
    [vouchers, batchNgayCt],
  );

  // Ghép phiếu cùng khách hàng (Ctrl+G)
  const handleMergeDrafts = useCallback((draftIds: string[]) => {
    setVouchers((prev) => {
      const res = mergeDraftVouchers(prev, draftIds);
      if (res.error) {
        setBanner({ type: "warning", text: res.error });
        return prev;
      }
      if (res.mergedDraftId) {
        setActiveDraftId(res.mergedDraftId);
      }
      setBanner({
        type: "success",
        text: `Đã ghép ${draftIds.length} phiếu thành 1 phiếu (${res.mergedDraftId}).`,
      });
      return res.vouchers;
    });
  }, []);

  // Tách đơn kho con thành phiếu mới (Ctrl+T) hoặc chuyển sang phiếu khác của cùng khách
  const handleSplitOrders = useCallback(
    (
      sourceDraftId: string,
      orderKeys: string[],
      targetDraftId?: string | null,
    ) => {
      setVouchers((prev) => {
        const res = splitOrdersFromVoucher(
          prev,
          sourceDraftId,
          orderKeys,
          targetDraftId,
        );
        if (res.error) {
          setBanner({ type: "warning", text: res.error });
          return prev;
        }
        if (res.focusDraftId) {
          setActiveDraftId(res.focusDraftId);
        }
        setBanner({
          type: "success",
          text: targetDraftId
            ? `Đã chuyển ${orderKeys.length} đơn kho sang phiếu ${targetDraftId}.`
            : `Đã tách ${orderKeys.length} đơn kho ra phiếu mới (${res.focusDraftId}).`,
        });
        return res.vouchers;
      });
    },
    [],
  );

  // Cập nhật chi tiết dòng hàng (sửa giá = 0, số lượng, thêm/xóa dòng)
  const handleUpdateItems = useCallback(
    (draftId: string, nextItems: TruckDraftItem[]) => {
      setVouchers((prev) =>
        prev.map((v) =>
          v.draft_id === draftId
            ? recalculateDraftVoucher({ ...v, items: nextItems, errorMsg: null })
            : v,
        ),
      );
    },
    [],
  );

  // Thống kê lô xuất hiện tại
  const selectedVouchers = useMemo(
    () => vouchers.filter((v) => v.selected),
    [vouchers],
  );

  const blockedSelectedVouchers = useMemo(
    () =>
      selectedVouchers.filter((v) => {
        const debt = cumulativeDebts[v.draft_id];
        return debt?.isOverLimit && !v.skip_debt_check;
      }),
    [selectedVouchers, cumulativeDebts],
  );

  const totalBatchAmount = useMemo(
    () =>
      selectedVouchers.reduce((sum, v) => sum + Number(v.ttien0 || 0), 0),
    [selectedVouchers],
  );

  // COMMIT 1 TRANSACTION DUY NHẤT (ALL-OR-NOTHING) -> QUAY VỀ VoucherList & ĐÁNH DẤU
  const handleCommitBatch = useCallback(async () => {
    if (committing) return;
    if (selectedVouchers.length === 0) {
      setBanner({
        type: "warning",
        text: "Chưa chọn phiếu nào để xuất. Vui lòng tick ít nhất 1 phiếu.",
      });
      return;
    }

    if (blockedSelectedVouchers.length > 0) {
      const firstBlocked = blockedSelectedVouchers[0];
      setActiveDraftId(firstBlocked.draft_id);
      setBanner({
        type: "error",
        text:
          `Có ${blockedSelectedVouchers.length} phiếu đang chọn bị QUÁ HẠN MỨC NỢ (VD: ${firstBlocked.ma_dt}). ` +
          "Hãy đổi sang khách hàng khác, bỏ tick, hoặc bấm Shift+Enter trên dòng đó để bypass nợ trước khi xuất.",
      });
      return;
    }

    const emptyItemVoucher = selectedVouchers.find((v) => v.items.length === 0);
    if (emptyItemVoucher) {
      setActiveDraftId(emptyItemVoucher.draft_id);
      setBanner({
        type: "error",
        text: `Phiếu ${emptyItemVoucher.draft_id} (${emptyItemVoucher.ma_dt}) không có dòng hàng hóa nào.`,
      });
      return;
    }

    setCommitting(true);
    setBanner(null);
    setVouchers((prev) => prev.map((v) => ({ ...v, errorMsg: null })));

    try {
      const payload = {
        trip_id: selectedTripId || stagePayload?.trip.trip_id || "TRUCK",
        user_name: CURRENT_USER,
        vouchers: selectedVouchers.map((v) => ({
          draft_id: v.draft_id,
          source_order_keys: v.source_orders.map((o) => o.source_order_key),
          ma_dvcs: "S1",
          ma_ct: v.ma_ct || "X1",
          nh_ct: v.ma_ct === "N5" ? "1" : "2",
          ma_tte: v.ma_tte || "VND",
          ty_gia: v.ty_gia || 1.0,
          ngay_ct: v.ngay_ct || batchNgayCt,
          ma_xe: v.ma_xe || "",
          ma_bp: v.ma_bp || "",
          ma_dt: v.ma_dt,
          ma_nx: v.ma_nx || "131",
          tk2: v.tk2 || "1311",
          ong_ba: v.ong_ba || v.ten_dt || "",
          dia_chi: v.dia_chi || "",
          dien_giai0: v.dien_giai0 || "Mua hàng",
          han_tt: v.han_tt || 0,
          confirmed: true,
          posted: true,
          user_name: CURRENT_USER,
          skip_debt_check: Boolean(v.skip_debt_check),
          items: v.items.map((it) => ({
            stt_px: it.stt_px || it.source_order_key || null,
            tk: it.tk || "6322",
            tk_du: it.tk_du || "155",
            tk_du2: it.tk_du2 || "5112",
            tk_du4: it.tk_du4 || "521",
            ma_kho: it.ma_kho || "",
            ma_vt: it.ma_vt || "",
            dvt: it.dvt || "",
            dvt_ban: it.dvt_ban || it.dvt || "",
            so_tam: Number(it.so_tam || 0),
            he_so8: Number(it.he_so8 || 1),
            so_luong8: Number(it.so_luong8 || 0),
            he_so9: Number(it.he_so9 || 1),
            so_luong9: Number(it.so_luong9 || 0),
            so_luong: Number(it.so_luong || 0),
            gia_nt9: Number(it.gia_nt9 || 0),
            gia9: Number(it.gia9 || 0),
            tien_nt9: Number(it.tien_nt9 || 0),
            tien9: Number(it.tien9 || 0),
            chiet_khau: Number(it.chiet_khau || 0),
            tien_nt4: Number(it.tien_nt4 || 0),
            tien4: Number(it.tien4 || 0),
            gia_nt2: Number(it.gia_nt2 || 0),
            gia2: Number(it.gia2 || 0),
            tien_nt2: Number(it.tien_nt2 || 0),
            tien2: Number(it.tien2 || 0),
            gia_tb_tt: it.gia_tb_tt || "C",
            loai_vt: it.loai_vt || "1",
          })),
        })),
      };

      const res = await fetch("/api/truck-batch/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        const detail = json?.detail || {};
        const msg =
          detail.message ||
          json?.message ||
          "Xuất lô chứng từ thất bại — toàn bộ giao dịch đã được hoàn tác.";
        if (detail.draft_id) {
          setActiveDraftId(detail.draft_id);
          setVouchers((prev) =>
            prev.map((v) =>
              v.draft_id === detail.draft_id ? { ...v, errorMsg: msg } : v,
            ),
          );
        }
        setBanner({ type: "error", text: msg });
        return;
      }

      const result: TruckBatchCommitResult = json.data;
      const createdStts = (result.created_vouchers || []).map((c) => c.stt);

      // Xóa cache danh sách phiếu & pickup để VoucherList hiển thị ngay dữ liệu mới nhất
      invalidate("vouchers:");
      invalidate("pickup:");

      // Quay về VoucherList.tsx và tự động đánh dấu (markedStts) các đơn vừa tạo
      navigate("/sales-invoices", {
        replace: true,
        state: {
          batchCreatedStts: createdStts,
          batchSummaryMessage:
            result.message ||
            `Đã xuất thành công ${createdStts.length} phiếu bán hàng.`,
        },
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: `Lỗi kết nối khi xuất cả xe (đã hoàn tác): ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setCommitting(false);
    }
  }, [
    committing,
    selectedVouchers,
    blockedSelectedVouchers,
    selectedTripId,
    stagePayload,
    batchNgayCt,
    navigate,
  ]);

  // Active voucher & các phiếu khác cùng khách hàng (dùng cho Ctrl+G & dropdown Chuyển đơn)
  const activeVoucher = useMemo(
    () => vouchers.find((v) => v.draft_id === activeDraftId) || null,
    [vouchers, activeDraftId],
  );

  const sameCustomerOtherVouchers = useMemo(() => {
    if (!activeVoucher) return [];
    const code = activeVoucher.ma_dt.trim().toUpperCase();
    return vouchers.filter(
      (v) =>
        v.draft_id !== activeVoucher.draft_id &&
        v.ma_dt.trim().toUpperCase() === code,
    );
  }, [vouchers, activeVoucher]);

  // Global keyboard shortcuts: Ctrl+S, Ctrl+G, Shift+Enter (bypass nợ), Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleCommitBatch();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        if (activeVoucher && sameCustomerOtherVouchers.length > 0) {
          e.preventDefault();
          const allIds = [
            activeVoucher.draft_id,
            ...sameCustomerOtherVouchers.map((v) => v.draft_id),
          ];
          handleMergeDrafts(allIds);
        }
        return;
      }
      if (e.shiftKey && e.key === "Enter" && activeVoucher) {
        const debt = cumulativeDebts[activeVoucher.draft_id];
        if (debt?.isOverLimit) {
          e.preventDefault();
          handleToggleBypassDebt(activeVoucher.draft_id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleCommitBatch,
    activeVoucher,
    sameCustomerOtherVouchers,
    handleMergeDrafts,
    cumulativeDebts,
    handleToggleBypassDebt,
  ]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header Toolbar */}
      <header className="bg-[#0F172A] text-white px-3 py-2 border-b border-slate-700 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/sales-invoices")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-medium cursor-pointer"
            title="Quay lại danh sách hóa đơn bán hàng"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Danh sách</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded bg-[#1E3A8A] border border-blue-400/40 flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-blue-200" />
            </span>
            <div className="leading-tight min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate">
                Xuất Nhanh Hàng Hóa Cả Xe (1 Transaction)
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                Tự gom theo Khách + Ghi chú · Tách/Ghép đơn kho con · Đổi khách giữ nguyên giá · Shift+Enter bypass nợ
              </p>
            </div>
          </div>
        </div>

        {/* Bộ chọn Nguồn, Chuyến xe, Ngày CT & Nút Xuất cả xe */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <span>Nguồn:</span>
            <select
              value={adapter}
              onChange={(e) =>
                setAdapter(e.target.value as TruckSourceAdapterName)
              }
              className="h-7 px-2 rounded bg-slate-800 border border-slate-600 text-xs text-white font-medium"
            >
              <option value="mock">Xe mẫu (Demo 6 đơn / 2 nơi)</option>
              <option value="kh2014">Phiếu kho KH_2014 (theo xe)</option>
              <option value="sql">DB Xe hàng (SQL thật)</option>
            </select>
          </label>

          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <span>Chuyến xe:</span>
            <select
              value={selectedTripId}
              disabled={loadingTrips || trips.length === 0}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="h-7 px-2 rounded bg-slate-800 border border-slate-600 text-xs text-white font-mono min-w-[240px]"
            >
              {trips.length === 0 ? (
                <option value="">— Không có chuyến xe —</option>
              ) : (
                trips.map((t) => (
                  <option key={t.trip_id} value={t.trip_id}>
                    {t.ma_xe} · {t.trip_date} · Còn {t.pending_orders}/
                    {t.total_approved_orders} đơn
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <span>Ngày HĐ:</span>
            <input
              type="date"
              value={batchNgayCt}
              onChange={(e) => handleApplyBatchDate(e.target.value)}
              className="h-7 px-2 rounded bg-slate-800 border border-slate-600 text-xs text-white font-mono"
            />
          </label>

          <button
            type="button"
            disabled={!selectedTripId || loadingStage}
            onClick={() => void loadStage(selectedTripId, adapter, batchNgayCt)}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-200 cursor-pointer disabled:opacity-50"
            title="Tải lại chuyến xe & khôi phục cách gom mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Gom mặc định</span>
          </button>

          <button
            type="button"
            disabled={loadingTrips}
            onClick={() => void loadTrips(adapter)}
            className="inline-flex items-center justify-center h-7 w-7 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer disabled:opacity-50"
            title="Làm mới danh sách chuyến xe"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingTrips ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            disabled={committing || selectedVouchers.length === 0}
            onClick={() => void handleCommitBatch()}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded text-xs font-bold shadow-sm transition ${
              committing || selectedVouchers.length === 0
                ? "bg-slate-600 text-slate-300 cursor-not-allowed"
                : blockedSelectedVouchers.length > 0
                  ? "bg-red-700 hover:bg-red-800 text-white cursor-pointer"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            }`}
            title="Lưu tất cả phiếu đã chọn trong 1 Transaction duy nhất (All-or-Nothing) rồi quay về danh sách đánh dấu các phiếu vừa tạo (Ctrl+S)"
          >
            {committing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>
              {committing
                ? "Đang xuất cả xe..."
                : `Xuất ${selectedVouchers.length} phiếu (${formatCurrency(totalBatchAmount)})`}
            </span>
            <kbd className="px-1 py-0 text-[9px] bg-black/25 rounded font-mono">
              Ctrl+S
            </kbd>
          </button>
        </div>
      </header>

      {/* Thông tin chuyến xe + Banner cảnh báo/lỗi */}
      {stagePayload && (
        <div className="px-3 py-1 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between gap-2 text-[11px] text-slate-700 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              Xe: <strong className="font-mono text-[#1E3A8A]">{stagePayload.trip.ma_xe}</strong>
              {stagePayload.trip.ten_xe ? ` (${stagePayload.trip.ten_xe})` : ""}
            </span>
            {stagePayload.trip.driver_name && (
              <span>
                Lái xe: <strong>{stagePayload.trip.driver_name}</strong>
              </span>
            )}
            <span>
              Đơn kho chưa xuất:{" "}
              <strong className="font-mono text-emerald-800">
                {stagePayload.total_pending_orders}
              </strong>
              {" / "}
              <strong className="font-mono">
                {stagePayload.trip.total_approved_orders}
              </strong>
              {stagePayload.total_exported_orders > 0 && (
                <span className="ml-1 text-slate-500">
                  (đã lọc bỏ {stagePayload.total_exported_orders} đơn đã xuất theo Stt_PX)
                </span>
              )}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Phím tắt: <kbd className="px-1 border border-slate-300 rounded bg-white font-mono text-[10px]">Ctrl+G</kbd> Ghép cùng KH ·{" "}
            <kbd className="px-1 border border-slate-300 rounded bg-white font-mono text-[10px]">Ctrl+T</kbd> Tách đơn kho ·{" "}
            <kbd className="px-1 border border-slate-300 rounded bg-white font-mono text-[10px]">Shift+Enter</kbd> Bypass nợ ·{" "}
            <kbd className="px-1 border border-slate-300 rounded bg-white font-mono text-[10px]">Ctrl+S</kbd> Xuất cả xe
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`px-3 py-1.5 border-b text-xs flex items-center justify-between gap-2 flex-shrink-0 ${
            banner.type === "error"
              ? "bg-red-50 border-red-300 text-red-800"
              : banner.type === "warning"
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : banner.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-sky-50 border-sky-200 text-sky-900"
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {banner.type === "error" || banner.type === "warning" ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher (< md) */}
      {isMobile && !loadingStage && (
        <div className="flex items-center bg-slate-100 border-b border-slate-300 px-2 py-1 gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("vouchers")}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-bold transition cursor-pointer ${
              mobileTab === "vouchers"
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-300"
            }`}
          >
            Phiếu dự kiến ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("detail")}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-bold transition cursor-pointer truncate ${
              mobileTab === "detail"
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-300"
            }`}
          >
            Chi tiết {activeVoucher ? `(${activeVoucher.ma_dt})` : ""}
          </button>
        </div>
      )}

      {/* Main Master-Detail Split Pane (Desktop) / Tabbed View (Mobile) */}
      <div
        ref={splitRootRef}
        className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
      >
        {loadingStage ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-[#1E3A8A]" />
            <span>Đang nạp đơn kho, áp bảng giá & tính công nợ chuyến xe...</span>
          </div>
        ) : isMobile ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === "vouchers" ? (
              <TruckMasterGrid
                vouchers={vouchers}
                activeDraftId={activeDraftId}
                cumulativeDebts={cumulativeDebts}
                onSelectActive={(id) => {
                  setActiveDraftId(id);
                }}
                onToggleSelected={handleToggleSelected}
                onToggleAllValid={handleToggleAllValid}
                onUpdateDienGiai={handleUpdateDienGiai}
                onSwapCustomer={handleSwapCustomer}
                onRepriceForCustomer={handleRepriceForCustomer}
                onToggleBypassDebt={handleToggleBypassDebt}
                onMergeDrafts={handleMergeDrafts}
              />
            ) : (
              <TruckDetailGrid
                voucher={activeVoucher}
                sameCustomerOtherVouchers={sameCustomerOtherVouchers}
                onUpdateItems={handleUpdateItems}
                onSplitOrders={handleSplitOrders}
              />
            )}
          </div>
        ) : (
          <>
            <div
              style={{ height: `${(splitRatio * 100).toFixed(2)}%` }}
              className="min-h-0 overflow-hidden"
            >
              <TruckMasterGrid
                vouchers={vouchers}
                activeDraftId={activeDraftId}
                cumulativeDebts={cumulativeDebts}
                onSelectActive={setActiveDraftId}
                onToggleSelected={handleToggleSelected}
                onToggleAllValid={handleToggleAllValid}
                onUpdateDienGiai={handleUpdateDienGiai}
                onSwapCustomer={handleSwapCustomer}
                onRepriceForCustomer={handleRepriceForCustomer}
                onToggleBypassDebt={handleToggleBypassDebt}
                onMergeDrafts={handleMergeDrafts}
              />
            </div>

            {/* Resizable Divider */}
            <div
              onPointerDown={handleSplitterDown}
              className="h-2 bg-slate-200 hover:bg-blue-300 border-y border-slate-300 flex items-center justify-center cursor-row-resize flex-shrink-0 transition-colors"
              title="Kéo để thay đổi tỷ lệ bảng trên / bảng dưới"
            >
              <GripHorizontal className="w-4 h-3 text-slate-500" />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <TruckDetailGrid
                voucher={activeVoucher}
                sameCustomerOtherVouchers={sameCustomerOtherVouchers}
                onUpdateItems={handleUpdateItems}
                onSplitOrders={handleSplitOrders}
              />
            </div>
          </>
        )}
      </div>

      {/* Mobile Sticky Bottom Export Bar */}
      {isMobile && (
        <footer className="bg-[#0F172A] text-white border-t border-slate-700 px-3 py-2 pb-safe flex items-center justify-between gap-2 flex-shrink-0">
          <div className="text-xs leading-tight min-w-0">
            <div className="text-slate-400 text-[10px]">
              Chọn {selectedVouchers.length}/{vouchers.length} phiếu
            </div>
            <div className="font-mono font-bold text-sm truncate">
              {formatCurrency(totalBatchAmount)}
            </div>
          </div>
          <button
            type="button"
            disabled={committing || selectedVouchers.length === 0}
            onClick={() => void handleCommitBatch()}
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-bold shadow-sm transition shrink-0 ${
              committing || selectedVouchers.length === 0
                ? "bg-slate-600 text-slate-300 cursor-not-allowed"
                : blockedSelectedVouchers.length > 0
                  ? "bg-red-700 text-white cursor-pointer"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            }`}
          >
            {committing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{committing ? "Đang xuất..." : "Xuất cả xe"}</span>
          </button>
        </footer>
      )}
    </div>
  );
};
