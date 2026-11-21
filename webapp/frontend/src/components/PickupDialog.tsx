import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PickupSlip, PickupItem } from "../types/pickup";
import { formatDate, formatQuantity, getTodayDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import { useIsMobile } from "../hooks/useViewport";
import { cachedFetch, peek, prime, invalidate } from "../lib/apiCache";
import { arrowDir } from "./ui/excelCell";
import { X, Minimize2, Square, RefreshCw, Search, Check } from "lucide-react";
import { PickupMasterTable } from "./pickup/PickupMasterTable";
import { PickupDetailTable } from "./pickup/PickupDetailTable";
import { PickupFooter } from "./pickup/PickupFooter";

function getMonthBounds(dateStr?: string): {
  start: string;
  end: string;
  label: string;
} {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr.trim())
      ? dateStr.trim().slice(0, 10)
      : getTodayDate();
  const [yStr, mStr] = base.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${yStr}-${mStr}-01`,
    end: `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    label: `${mStr}/${yStr}`,
  };
}

interface PickupDialogProps {
  isOpen: boolean;
  isSuspended?: boolean;
  maCt?: "X1" | "N5";
  onClose: () => void;
  maDt?: string;
  ngayCt?: string;
  onAccept: (selectedSlips: PickupSlip[], items: any[], maXe?: string) => void;
  onCreateWarehouseSlip?: () => void;
  onEditWarehouseSlip?: (
    stt: string,
    preview?: { slip?: PickupSlip; items?: PickupItem[] },
  ) => void;
  onDeleteWarehouseSlip?: (slip: PickupSlip) => void;
  /** Danh sách STT đang bị xóa lạc quan (ẩn ngay 0ms, tự hiện lại nếu API lỗi) */
  hiddenStts?: Set<string>;
  /** Dữ liệu phiếu vừa lưu để cập nhật tức thì 0ms trước khi đồng bộ nền */
  optimisticSlip?: { slip: PickupSlip; items: PickupItem[]; version: number } | null;
  refreshTrigger?: number;
  focusStt?: string | null;
}

/**
 * Chọn Phiếu Xuất / Nhập Lại Kho (ctbhch — KH_2014).
 * Giao diện Master/Detail theo mẫu Pickup.html: header navy/amber gradient,
 * bảng phiếu kho (Grid1 - K_DsPx) + chi tiết vật tư (Grid2 - K_CtPx),
 * footer đếm "Số phiếu đã chọn [ n ] / [ total ]".
 * Hotkey khớp VFP (plan §7.2.3): Space, Ctrl+A, Ctrl+U, Ctrl+Home/End, Enter, Esc, F2, F3, F8.
 */
export const PickupDialog: React.FC<PickupDialogProps> = ({
  isOpen,
  isSuspended = false,
  maCt = "X1",
  onClose,
  maDt,
  ngayCt,
  onAccept,
  onCreateWarehouseSlip,
  onEditWarehouseSlip,
  onDeleteWarehouseSlip,
  hiddenStts,
  optimisticSlip = null,
  refreshTrigger = 0,
  focusStt = null,
}) => {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"slips" | "items">("slips");
  const effectiveMaCt: "X1" | "N5" = maCt === "N5" ? "N5" : "X1";
  const isReturn = effectiveMaCt === "N5";
  const [rawSlips, setRawSlips] = useState<PickupSlip[]>([]);
  const slips = useMemo(
    () =>
      hiddenStts && hiddenStts.size > 0
        ? rawSlips.filter((s) => !hiddenStts.has(s.stt))
        : rawSlips,
    [rawSlips, hiddenStts],
  );
  const [selectedStts, setSelectedStts] = useState<Set<string>>(new Set());
  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<PickupItem[]>([]);
  const [activeDetailRow, setActiveDetailRow] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Tăng mỗi lần nạp lại danh sách phiếu -> buộc nạp lại chi tiết kể cả khi
  // activeStt không đổi (dialog luôn mounted nên state cũ vẫn còn).
  const [detailVersion, setDetailVersion] = useState(0);
  const [listFetchSeq, setListFetchSeq] = useState(0);
  const listFetchSeqRef = useRef(0);
  const openAtSeqRef = useRef(0);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const masterScrollRef = useRef<HTMLDivElement | null>(null);
  const masterHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const masterRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const masterActiveColRef = useRef<number>(2); // mặc định cột Số phiếu
  const detailSectionRef = useRef<HTMLElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const detailHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const detailRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const pendingInitialFocusRef = useRef<boolean>(false);
  const prevIsOpenRef = useRef<boolean>(false);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Lưu phần tử đang focus trước khi mở dialog (VD: nút "Chọn phiếu xuất")
  // để khi Esc / đóng dialog thì trả focus lại đúng vị trí ban đầu.
  if (isOpen && !prevIsOpenRef.current) {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      active !== document.body &&
      !containerRef.current?.contains(active)
    ) {
      prevFocusRef.current = active;
    }
  }

  useEffect(() => {
    if (isOpen) {
      prevIsOpenRef.current = true;
      return;
    }
    if (prevIsOpenRef.current) {
      prevIsOpenRef.current = false;
      const target = prevFocusRef.current;
      prevFocusRef.current = null;
      if (target && target.isConnected) {
        const restore = () => target.focus({ preventScroll: true });
        restore();
        window.setTimeout(restore, 0);
      }
    }
  }, [isOpen]);

  // Khóa modal: giữ focus trong dialog + báo tầng ngoài (VoucherForm/App) khóa phím.
  // Khi mở overlay Thêm/Sửa phiếu kho đè lên PickupDialog (isSuspended=true), nhả lock để VoucherForm kho hoạt động.
  useModalLock(isOpen && !isSuspended, containerRef);

  const ensureRowVisible = useCallback(
    (
      container: HTMLDivElement | null,
      thead: HTMLTableSectionElement | null,
      row: HTMLTableRowElement | null,
    ) => {
      if (!container || !row) return;
      const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
      const cRect = container.getBoundingClientRect();
      const rRect = row.getBoundingClientRect();
      const visibleTop = cRect.top + headerHeight;
      const visibleBottom = cRect.top + container.clientHeight;
      if (rRect.top < visibleTop) {
        container.scrollTop -= visibleTop - rRect.top;
      } else if (rRect.bottom > visibleBottom) {
        container.scrollTop += rRect.bottom - visibleBottom;
      }
    },
    [],
  );

  const focusMasterCell = useCallback(
    (stt: string | null, colIdx?: number) => {
      if (!stt) return;
      const row = masterRowRefs.current[stt];
      if (!row) return;
      const targetCol = colIdx ?? masterActiveColRef.current;
      const td = row.children[targetCol] as HTMLElement | undefined;
      const input =
        td?.querySelector<HTMLInputElement>("input.grid-cell-input") ||
        row.querySelector<HTMLInputElement>("input.grid-cell-input");
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
      }
      ensureRowVisible(masterScrollRef.current, masterHeadRef.current, row);
    },
    [ensureRowVisible],
  );

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

  // Cập nhật lạc quan (0ms) khi vừa tạo/sửa phiếu xuất kho từ overlay
  const lastAppliedOptVerRef = useRef<number>(0);
  useEffect(() => {
    if (!optimisticSlip || optimisticSlip.version === lastAppliedOptVerRef.current) {
      return;
    }
    lastAppliedOptVerRef.current = optimisticSlip.version;
    const { slip, items } = optimisticSlip;
    prime(`pickup:detail:${slip.stt}`, { success: true, data: { items } });
    invalidate("pickup:list:");
    setRawSlips((prev) => {
      const idx = prev.findIndex((s) => s.stt === slip.stt);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = slip;
        return next;
      }
      return [slip, ...prev];
    });
    setActiveStt(slip.stt);
    setActiveItems(items);
  }, [optimisticSlip]);

  // Khi dòng đang chọn bị ẩn do xóa lạc quan -> tự động chuyển chọn sang dòng kế cận ở 0ms
  useEffect(() => {
    if (!activeStt || !hiddenStts || !hiddenStts.has(activeStt)) return;
    const nextStt = slips[0]?.stt ?? null;
    setActiveStt(nextStt);
    setSelectedStts((prev) => {
      if (!prev.has(activeStt)) return prev;
      const next = new Set(prev);
      next.delete(activeStt);
      return next;
    });
  }, [activeStt, hiddenStts, slips]);

  const monthBounds = useMemo(() => getMonthBounds(ngayCt), [ngayCt]);

  // Fetch slips (SWR: hiển thị tức thì từ cache RAM nếu có, đồng bộ ngầm với SQL)
  const loadSlips = useCallback(
    async (preferredStt?: string | null, opts?: { force?: boolean }) => {
      const q = new URLSearchParams();
      q.append("ma_ct", effectiveMaCt);
      if (isReturn) {
        q.append("ngay_ct1", monthBounds.start);
        q.append("ngay_ct2", monthBounds.end);
      } else {
        if (maDt) q.append("ma_dt", maDt);
        if (ngayCt) {
          q.append("ngay_ct1", ngayCt);
          q.append("ngay_ct2", ngayCt);
        }
      }
      const listCacheKey = isReturn
        ? `pickup:list:N5:${monthBounds.start}:${monthBounds.end}`
        : `pickup:list:X1:${maDt || ""}:${ngayCt || ""}`;
      const url = `/api/pickup/list?${q.toString()}`;
      const cached = peek<any>(listCacheKey);
      const hasCached = Boolean(cached?.success && Array.isArray(cached.data?.items));

      if (hasCached) {
        const cachedItems: PickupSlip[] = cached.data.items;
        setRawSlips(cachedItems);
        setActiveStt((prev) => {
          if (preferredStt && cachedItems.some((s) => s.stt === preferredStt)) {
            return preferredStt;
          }
          if (prev && cachedItems.some((s) => s.stt === prev)) {
            return prev;
          }
          return cachedItems.length > 0 ? cachedItems[0].stt : null;
        });
      } else {
        setLoading(true);
      }

      try {
        const data = await cachedFetch<any>(listCacheKey, url, {
          force: opts?.force ?? true,
          ttl: 5_000,
        });
        if (data?.success && data.data?.items) {
          setErrorMsg(null);
          const items: PickupSlip[] = data.data.items;
          setRawSlips(items);
          setActiveStt((prev) => {
            if (preferredStt && items.some((s) => s.stt === preferredStt)) {
              return preferredStt;
            }
            if (prev && items.some((s) => s.stt === prev)) {
              return prev;
            }
            return items.length > 0 ? items[0].stt : null;
          });
          // Bỏ các phiếu đã chọn không còn trong danh sách mới.
          setSelectedStts((prev) => {
            const valid = new Set(items.map((s) => s.stt));
            const next = new Set<string>();
            prev.forEach((s) => {
              if (valid.has(s)) next.add(s);
            });
            return next;
          });
        } else {
          if (!hasCached) {
            setErrorMsg(
              data?.detail?.message ||
                data?.message ||
                `Không tải được danh sách ${isReturn ? "phiếu nhập lại" : "phiếu xuất kho"}.`,
            );
            setRawSlips([]);
            setActiveStt(null);
            setSelectedStts(new Set());
          }
        }
      } catch (e: any) {
        console.error("Error fetching pickup slips", e);
        if (!hasCached) {
          setErrorMsg(
            e?.status
              ? `Không tải được danh sách ${isReturn ? "phiếu nhập lại" : "phiếu xuất kho"} (HTTP ${e.status}).`
              : `Lỗi kết nối khi tải danh sách ${isReturn ? "phiếu nhập lại" : "phiếu xuất kho"}.`,
          );
        }
      } finally {
        setLoading(false);
        setDetailVersion((v) => v + 1);
        listFetchSeqRef.current += 1;
        setListFetchSeq(listFetchSeqRef.current);
      }
    },
    [effectiveMaCt, isReturn, maDt, ngayCt, monthBounds.start, monthBounds.end],
  );

  useEffect(() => {
    setSelectedStts(new Set());
  }, [effectiveMaCt, isOpen]);

  useEffect(() => {
    if (isOpen) {
      openAtSeqRef.current = listFetchSeqRef.current;
      pendingInitialFocusRef.current = true;
      loadSlips(focusStt, { force: true });
    }
  }, [isOpen, refreshTrigger, loadSlips, focusStt]);

  // Khi đóng overlay phiếu kho (isSuspended từ true -> false), trả lại focus về dòng đang chọn trên bảng Master
  const prevSuspendedRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevSuspendedRef.current && !isSuspended && isOpen && !loading) {
      const targetStt = focusStt || activeStt || slips[0]?.stt;
      const timer = window.setTimeout(() => {
        if (targetStt) {
          focusMasterCell(targetStt, masterActiveColRef.current);
        } else {
          cancelBtnRef.current?.focus({ preventScroll: true });
        }
      }, 20);
      prevSuspendedRef.current = isSuspended;
      return () => window.clearTimeout(timer);
    }
    prevSuspendedRef.current = isSuspended;
  }, [isSuspended, isOpen, loading, focusStt, activeStt, slips, focusMasterCell]);

  // Tự động focus vào ô đầu tiên của grid phiếu (hoặc nút Hủy bỏ nếu không có phiếu nào)
  useEffect(() => {
    if (!isOpen || loading) return;
    if (listFetchSeq <= openAtSeqRef.current) return;
    if (slips.length === 0) {
      pendingInitialFocusRef.current = false;
      const timer = window.setTimeout(() => {
        cancelBtnRef.current?.focus({ preventScroll: true });
      }, 20);
      return () => window.clearTimeout(timer);
    }
    if (!pendingInitialFocusRef.current) return;
    pendingInitialFocusRef.current = false;
    const firstStt = activeStt || slips[0]?.stt;
    const timer = window.setTimeout(() => {
      if (firstStt) focusMasterCell(firstStt, masterActiveColRef.current);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [isOpen, loading, listFetchSeq, slips, activeStt, focusMasterCell]);

  // Cuộn dòng Master đang chọn vào vùng hiển thị (tránh che dưới header sticky)
  useEffect(() => {
    if (!activeStt) return;
    ensureRowVisible(
      masterScrollRef.current,
      masterHeadRef.current,
      masterRowRefs.current[activeStt] ?? null,
    );
  }, [activeStt, slips, ensureRowVisible]);

  // Fetch items when active slip changes (SWR: hiển thị 0ms từ cache RAM rồi đồng bộ ngầm).
  useEffect(() => {
    if (!isOpen || !activeStt) {
      setActiveItems([]);
      setActiveDetailRow(0);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const detailKey = `pickup:detail:${activeStt}`;
    const cached = peek<any>(detailKey);
    const hasCached = Boolean(cached?.success && Array.isArray(cached.data?.items));
    if (hasCached) {
      setActiveItems(cached.data.items);
      setActiveDetailRow(0);
    }

    const fetchDetail = async () => {
      if (!hasCached) setLoadingDetail(true);
      try {
        const data = await cachedFetch<any>(
          detailKey,
          `/api/pickup/detail/${encodeURIComponent(activeStt)}`,
          { ttl: 10_000, signal: controller.signal },
        );
        if (!cancelled && data?.success && data.data?.items) {
          setActiveItems(data.data.items);
          setActiveDetailRow(0);
        }
      } catch (e: any) {
        if (cancelled || e?.name === "AbortError") return;
        console.error("Error fetching pickup detail", e);
        if (!hasCached) {
          setErrorMsg(
            e?.status
              ? `Không tải được chi tiết phiếu kho (HTTP ${e.status}).`
              : "Lỗi kết nối khi tải chi tiết phiếu kho.",
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    void fetchDetail();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeStt, detailVersion, isOpen]);

  const toggleSelect = useCallback((stt: string) => {
    setSelectedStts((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) {
        next.delete(stt);
      } else {
        next.add(stt);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedStts(new Set(slips.map((s) => s.stt)));
  }, [slips]);

  const deselectAll = useCallback(() => {
    setSelectedStts(new Set());
  }, []);

  const handleAccept = useCallback(async () => {
    if (selectedStts.size === 0) return;
    setLoading(true);
    setErrorMsg(null);
    const selected = slips.filter((s) => selectedStts.has(s.stt));
    const primarySlip = selected.find((s) => s.stt === activeStt) || selected[0];
    const orderedSelected = primarySlip
      ? [primarySlip, ...selected.filter((s) => s.stt !== primarySlip.stt)]
      : selected;
    const acceptMaDt = isReturn
      ? (primarySlip?.ma_dt || maDt || "").trim()
      : maDt;
    const acceptNgayCt = isReturn
      ? primarySlip?.ngay_ct?.slice(0, 10) || ngayCt
      : ngayCt;
    try {
      const res = await fetch("/api/pickup/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stts: Array.from(selectedStts),
          ma_dt: acceptMaDt,
          ngay_ct: acceptNgayCt,
          ma_ct: effectiveMaCt,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const rows = json.data.rows || [];
        if (rows.length > 0) {
          // Chấp nhận xong thì không trả focus về nút mở dialog, để VoucherForm focus xuống dòng cuối grid.
          prevFocusRef.current = null;
        }
        onAccept(orderedSelected, rows, json.data.ma_xe || "");
        onClose();
      } else {
        setErrorMsg(
          json?.detail?.message ||
            json?.message ||
            `Không thể lấy dòng hàng từ ${isReturn ? "phiếu nhập lại" : "phiếu xuất kho"}.`,
        );
      }
    } catch (err) {
      console.error("Error accepting pickup slips:", err);
      setErrorMsg(
        `Lỗi kết nối khi lấy dữ liệu ${isReturn ? "phiếu nhập lại" : "phiếu xuất kho"}.`,
      );
    } finally {
      setLoading(false);
    }
  }, [selectedStts, slips, activeStt, maDt, ngayCt, effectiveMaCt, isReturn, onAccept, onClose]);

  // Điều hướng bàn phím trên Grid 1 (Danh sách phiếu xuất kho)
  const handleMasterCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowIdx: number,
      colIdx: number,
    ) => {
      const dir = arrowDir(e.key);
      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        if (slips.length === 0) return;
        const nextIdx =
          dir === "down"
            ? Math.min(rowIdx + 1, slips.length - 1)
            : Math.max(rowIdx - 1, 0);
        const nextStt = slips[nextIdx]?.stt;
        if (!nextStt) return;
        setActiveStt(nextStt);
        focusMasterCell(nextStt, colIdx);
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        const el = e.currentTarget;
        const tr = el.closest("tr");
        if (!tr) return;
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>("input.grid-cell-input"),
        );
        const idx = rowInputs.indexOf(el);
        if (idx < 0) return;
        const forward = dir === "right" || (e.key === "Tab" && !e.shiftKey);
        const targetIdx = forward ? idx + 1 : idx - 1;
        if (dir === "left" || dir === "right") {
          e.preventDefault();
          e.stopPropagation();
          if (targetIdx >= 0 && targetIdx < rowInputs.length) {
            rowInputs[targetIdx].focus({ preventScroll: true });
            rowInputs[targetIdx].select();
          }
          return;
        }
        // Tab / Shift+Tab: nhảy ô; hết dòng thì xuống/lên dòng kế trong grid
        if (targetIdx >= 0 && targetIdx < rowInputs.length) {
          e.preventDefault();
          e.stopPropagation();
          rowInputs[targetIdx].focus({ preventScroll: true });
          rowInputs[targetIdx].select();
        } else {
          const nextRowIdx = rowIdx + (forward ? 1 : -1);
          const nextStt = slips[nextRowIdx]?.stt;
          if (nextStt) {
            e.preventDefault();
            e.stopPropagation();
            setActiveStt(nextStt);
            focusMasterCell(nextStt, forward ? 1 : 5);
          }
        }
      }
    },
    [slips, focusMasterCell],
  );

  // Điều hướng bàn phím trên Grid 2 (Chi tiết vật tư)
  const handleDetailCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowIdx: number,
      colIdx: number,
    ) => {
      const dir = arrowDir(e.key);
      if (dir === "up" || dir === "down") {
        e.preventDefault();
        e.stopPropagation();
        if (activeItems.length === 0) return;
        const nextIdx =
          dir === "down"
            ? Math.min(rowIdx + 1, activeItems.length - 1)
            : Math.max(rowIdx - 1, 0);
        setActiveDetailRow(nextIdx);
        const targetRow = detailRowRefs.current[nextIdx];
        const td = targetRow?.children[colIdx] as HTMLElement | undefined;
        const targetInput =
          td?.querySelector<HTMLInputElement>("input.grid-cell-input");
        if (targetInput && targetRow) {
          targetInput.focus({ preventScroll: true });
          targetInput.select();
          ensureRowVisible(
            detailScrollRef.current,
            detailHeadRef.current,
            targetRow,
          );
        }
        return;
      }

      if (dir === "left" || dir === "right" || e.key === "Tab") {
        const el = e.currentTarget;
        const tr = el.closest("tr");
        if (!tr) return;
        const rowInputs = Array.from(
          tr.querySelectorAll<HTMLInputElement>("input.grid-cell-input"),
        );
        const idx = rowInputs.indexOf(el);
        if (idx < 0) return;
        const forward = dir === "right" || (e.key === "Tab" && !e.shiftKey);
        const targetIdx = forward ? idx + 1 : idx - 1;
        if (dir === "left" || dir === "right") {
          e.preventDefault();
          e.stopPropagation();
          if (targetIdx >= 0 && targetIdx < rowInputs.length) {
            rowInputs[targetIdx].focus({ preventScroll: true });
            rowInputs[targetIdx].select();
          }
          return;
        }
        if (targetIdx >= 0 && targetIdx < rowInputs.length) {
          e.preventDefault();
          e.stopPropagation();
          rowInputs[targetIdx].focus({ preventScroll: true });
          rowInputs[targetIdx].select();
        } else {
          const nextRowIdx = rowIdx + (forward ? 1 : -1);
          const nextRow = detailRowRefs.current[nextRowIdx];
          if (nextRow) {
            e.preventDefault();
            e.stopPropagation();
            setActiveDetailRow(nextRowIdx);
            const inputs = Array.from(
              nextRow.querySelectorAll<HTMLInputElement>("input.grid-cell-input"),
            );
            const wrapInput = forward ? inputs[0] : inputs[inputs.length - 1];
            if (wrapInput) {
              wrapInput.focus({ preventScroll: true });
              wrapInput.select();
              ensureRowVisible(
                detailScrollRef.current,
                detailHeadRef.current,
                nextRow,
              );
            }
          }
        }
      }
    },
    [activeItems.length, ensureRowVisible],
  );

  // ===== Hotkey chuẩn VFP ctbhch (plan §7.2.3) =====
  // Cho phép các phím grid (↑/↓, Space, Ctrl+A/U, Ctrl+Home/End, Enter, Esc)
  // hoạt động bình thường cả khi đang đứng trong các ô readOnly của grid.
  useEffect(() => {
    if (!isOpen || isSuspended) return;
    const isTypingTarget = (el: Element | null): boolean => {
      if (!el) return false;
      if (el instanceof HTMLInputElement) {
        if (el.readOnly) return false;
        const t = (el.getAttribute("type") || "text").toLowerCase();
        return t !== "checkbox" && t !== "radio" && t !== "button";
      }
      if (el instanceof HTMLTextAreaElement) return !el.readOnly;
      return el instanceof HTMLSelectElement;
    };
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const typing = isTypingTarget(activeEl);
      const inCheckbox =
        activeEl instanceof HTMLInputElement &&
        (activeEl.getAttribute("type") || "").toLowerCase() === "checkbox";
      const inButton = activeEl instanceof HTMLButtonElement;
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === "F2" && !ctrl && !e.altKey && !e.shiftKey) {
        if (onCreateWarehouseSlip) {
          e.preventDefault();
          e.stopPropagation();
          onCreateWarehouseSlip();
        }
        return;
      }

      if (e.key === "F3" && !ctrl && !e.altKey && !e.shiftKey) {
        if (onEditWarehouseSlip && activeStt) {
          e.preventDefault();
          e.stopPropagation();
          const activeSlip = slips.find((s) => s.stt === activeStt);
          onEditWarehouseSlip(activeStt, {
            slip: activeSlip,
            items: activeItems,
          });
        }
        return;
      }

      if (e.key === "F8" && !ctrl && !e.altKey && !e.shiftKey) {
        if (onDeleteWarehouseSlip && activeStt) {
          const activeSlip = slips.find((s) => s.stt === activeStt);
          if (activeSlip) {
            e.preventDefault();
            e.stopPropagation();
            onDeleteWarehouseSlip(activeSlip);
          }
        }
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (typing || ctrl || e.altKey || e.shiftKey) return;
        if (detailSectionRef.current?.contains(activeEl)) return;
        e.preventDefault();
        if (slips.length === 0) return;
        const idx = slips.findIndex((s) => s.stt === activeStt);
        const nextIdx =
          idx === -1
            ? 0
            : e.key === "ArrowDown"
              ? Math.min(idx + 1, slips.length - 1)
              : Math.max(idx - 1, 0);
        const nextStt = slips[nextIdx]?.stt;
        if (!nextStt) return;
        setActiveStt(nextStt);
        focusMasterCell(nextStt);
        return;
      }

      if (ctrl && e.key.toLowerCase() === "a") {
        if (typing) return;
        e.preventDefault();
        selectAll();
      } else if (ctrl && e.key.toLowerCase() === "u") {
        if (typing) return;
        e.preventDefault();
        deselectAll();
      } else if (ctrl && e.key === "Home") {
        e.preventDefault();
        if (slips.length > 0) {
          setActiveStt(slips[0].stt);
          focusMasterCell(slips[0].stt);
        }
      } else if (ctrl && e.key === "End") {
        e.preventDefault();
        if (slips.length > 0) {
          const lastStt = slips[slips.length - 1].stt;
          setActiveStt(lastStt);
          focusMasterCell(lastStt);
        }
      } else if (e.key === " ") {
        if (typing || inCheckbox || inButton) return;
        e.preventDefault();
        if (activeStt) toggleSelect(activeStt);
      } else if (e.key === "Enter") {
        if (typing || inButton) return;
        e.preventDefault();
        if (selectedStts.size > 0) handleAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isOpen,
    isSuspended,
    slips,
    activeStt,
    activeItems,
    selectedStts,
    selectAll,
    deselectAll,
    toggleSelect,
    focusMasterCell,
    handleAccept,
    onClose,
    onCreateWarehouseSlip,
    onEditWarehouseSlip,
    onDeleteWarehouseSlip,
  ]);

  const filteredSlips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return slips;
    return slips.filter((s) => {
      const hay = `${s.so_ct || ""} ${s.ma_dt || ""} ${s.ten_dt || ""} ${s.dia_chi || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [slips, searchQuery]);

  const activeSlipTotalSheets = useMemo(
    () => activeItems.reduce((sum, it) => sum + (Number(it.so_tam) || 0), 0),
    [activeItems],
  );

  if (!isOpen) return null;

  const allSelected =
    filteredSlips.length > 0 &&
    filteredSlips.every((s) => selectedStts.has(s.stt));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-neutral-900/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={
        isReturn ? "Chọn phiếu nhập lại kho" : "Chọn phiếu xuất kho"
      }
    >
      <div
        ref={containerRef}
        className={`flex flex-col w-full bg-white rounded-none md:rounded-xl shadow-2xl border-0 md:border border-neutral-300 overflow-hidden transition-all animate-in fade-in zoom-in-95 pt-safe md:pt-0 ${
          isMaximized
            ? "md:max-w-[98vw] h-[100dvh] md:h-[96vh]"
            : "md:max-w-6xl h-[100dvh] md:h-full md:max-h-[92vh]"
        }`}
      >
        {/* ===== Modal Header (navy / amber gradient) ===== */}
        <header
          className={`flex flex-wrap items-center justify-between gap-2 px-3.5 md:px-4 py-2 text-white border-b shrink-0 ${
            isReturn
              ? "bg-gradient-to-r from-amber-900 via-amber-800 to-neutral-900 border-amber-900"
              : "bg-gradient-to-r from-primary-900 via-primary-800 to-neutral-900 border-primary-900"
          }`}
        >
          <div className="flex items-center space-x-2 shrink-0 min-w-0">
            <div className="w-2 h-2 rounded-full bg-secondary-300 shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-white truncate">
              {isReturn
                ? "Chọn Phiếu Nhập Lại Kho (N5)"
                : "Chọn Phiếu Xuất Kho"}
            </h1>
            {isReturn && (
              <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-white/15 text-amber-100 border border-white/20">
                Tháng {monthBounds.label} · Tất cả KH
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto justify-end">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-neutral-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lọc số phiếu / KH..."
                aria-label={
                  isReturn
                    ? "Lọc nhanh phiếu nhập lại kho"
                    : "Lọc nhanh phiếu xuất kho"
                }
                className="h-9 md:h-6 w-full sm:w-56 pl-7 pr-6 rounded bg-white/15 text-white placeholder-neutral-300 border border-white/20 text-xs outline-none focus:bg-white/20 focus:border-white/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa lọc"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-neutral-300 font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10 hidden md:inline-block shrink-0">
              Esc: Đóng
            </span>
            <button
              onClick={() => loadSlips(activeStt)}
              disabled={loading}
              className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-9 h-9 md:w-6 md:h-6 flex items-center justify-center cursor-pointer shrink-0"
              title="Làm mới"
              type="button"
            >
              <RefreshCw
                className={`w-4 h-4 md:w-3.5 md:h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setIsMaximized((prev) => !prev)}
                className="hidden md:flex p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 items-center justify-center cursor-pointer"
                title={isMaximized ? "Thu gọn" : "Phóng to"}
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
                className="p-1 text-neutral-200 hover:text-white hover:bg-danger-600 rounded transition-colors w-9 h-9 md:w-6 md:h-6 flex items-center justify-center ml-0.5 cursor-pointer"
                title="Đóng (Esc)"
                type="button"
                aria-label="Đóng"
              >
                <X className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile 2-Tab Bar (< md) */}
        {isMobile && (
          <div className="grid grid-cols-2 border-b border-neutral-200 bg-neutral-50 shrink-0 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobileTab("slips")}
              className={`py-2.5 text-center border-b-2 transition-colors ${
                mobileTab === "slips"
                  ? "border-primary-700 text-primary-800 bg-white"
                  : "border-transparent text-neutral-500"
              }`}
            >
              Phiếu kho ({filteredSlips.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("items")}
              className={`py-2.5 text-center border-b-2 transition-colors ${
                mobileTab === "items"
                  ? "border-primary-700 text-primary-800 bg-white"
                  : "border-transparent text-neutral-500"
              }`}
            >
              Chi tiết hàng ({activeItems.length})
            </button>
          </div>
        )}

        {/* ===== Master / Detail Body ===== */}
        <main className="flex-1 flex flex-col overflow-hidden p-2.5 md:p-3 gap-2.5 md:gap-3 bg-neutral-100/70">
          {errorMsg && (
            <div
              role="alert"
              className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-danger-50 border border-danger-300 text-danger-800 text-xs"
            >
              <span className="font-medium truncate">{errorMsg}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    void loadSlips(activeStt);
                  }}
                  className="px-2 py-0.5 rounded bg-white hover:bg-danger-100 border border-danger-300 text-danger-700 font-semibold text-[11px] cursor-pointer"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="p-0.5 text-danger-600 hover:text-danger-800 cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {isMobile ? (
            mobileTab === "slips" ? (
              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredSlips.length > 0 && (
                  <div className="flex items-center justify-between px-1 text-xs">
                    <button
                      type="button"
                      onClick={() => (allSelected ? deselectAll() : selectAll())}
                      className="text-primary-700 font-semibold py-1"
                    >
                      {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                    <span className="text-neutral-500">
                      Chạm checkbox để chọn lấy · Chạm thẻ để xem hàng
                    </span>
                  </div>
                )}
                {loading && filteredSlips.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải danh sách phiếu kho...
                  </div>
                ) : filteredSlips.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500 bg-white rounded-lg border border-neutral-200">
                    Không có phiếu kho nào phù hợp.
                  </div>
                ) : (
                  filteredSlips.map((slip) => {
                    const checked = selectedStts.has(slip.stt);
                    const isActive = activeStt === slip.stt;
                    return (
                      <div
                        key={slip.stt}
                        onClick={() => {
                          setActiveStt(slip.stt);
                          setMobileTab("items");
                        }}
                        className={`bg-white rounded-xl border p-3 shadow-sm transition-colors ${
                          isActive
                            ? "border-primary-500 ring-1 ring-primary-400"
                            : checked
                              ? "border-emerald-400 bg-emerald-50/30"
                              : "border-neutral-200"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(slip.stt);
                              setActiveStt(slip.stt);
                            }}
                            aria-label={`Chọn phiếu ${slip.so_ct}`}
                            className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                              checked
                                ? "bg-primary-700 border-primary-700 text-white"
                                : "bg-white border-neutral-300"
                            }`}
                          >
                            {checked && <Check className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-primary-800 text-sm">
                                {slip.so_ct}
                              </span>
                              <span className="font-mono text-xs text-neutral-500">
                                {formatDate(slip.ngay_ct)}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-neutral-800 truncate mt-0.5">
                              {slip.ten_dt || slip.ma_dt || "—"}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-neutral-500">
                              <span className="truncate">
                                {slip.ma_xe ? `Xe: ${slip.ma_xe}` : slip.dia_chi || "—"}
                              </span>
                              <span className="font-mono font-semibold text-neutral-700 shrink-0">
                                {slip.total_items} dòng ·{" "}
                                {formatQuantity(slip.total_so_tam)} tấm
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2">
                {loadingDetail ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary-600" />
                    Đang tải chi tiết hàng hóa...
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500 bg-white rounded-lg border border-neutral-200">
                    Chưa có dòng hàng hóa cho phiếu đang chọn.
                  </div>
                ) : (
                  activeItems.map((it, idx) => (
                    <div
                      key={`${it.stt}-${it.stt0}-${idx}`}
                      className="bg-white rounded-xl border border-neutral-200 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-primary-800">
                          #{idx + 1} · {it.ma_vt}
                        </span>
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                          Kho: {it.ma_kho}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-neutral-900 mt-1">
                        {it.ten_vt}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-neutral-100 text-[11px]">
                        <div>
                          <div className="text-neutral-500">Số tấm</div>
                          <div className="font-mono font-bold text-amber-800">
                            {formatQuantity(it.so_tam)}
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-500">Hệ số</div>
                          <div className="font-mono font-semibold text-neutral-800">
                            {formatQuantity(it.he_so8)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-neutral-500">
                            SL ({it.dvt_ban || it.dvt})
                          </div>
                          <div className="font-mono font-bold text-primary-800">
                            {formatQuantity(it.so_luong9)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          ) : (
            <>
              {/* TẦNG 1: BẢNG MASTER — DANH SÁCH PHIẾU KHO */}
              <PickupMasterTable
                filteredSlips={filteredSlips}
                totalSlipsCount={slips.length}
                selectedStts={selectedStts}
                activeStt={activeStt}
                allSelected={allSelected}
                loading={loading}
                isReturn={isReturn}
                searchQuery={searchQuery}
                masterScrollRef={masterScrollRef}
                masterHeadRef={masterHeadRef}
                masterRowRefs={masterRowRefs}
                masterActiveColRef={masterActiveColRef}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onSetActiveStt={setActiveStt}
                onToggleSelect={toggleSelect}
                onCellKeyDown={handleMasterCellKeyDown}
                onCellCopy={handleCellCopy}
              />

              {/* TẦNG 2: BẢNG DETAIL — CHI TIẾT HÀNG HÓA VẬT TƯ */}
              <PickupDetailTable
                activeItems={activeItems}
                activeDetailRow={activeDetailRow}
                loadingDetail={loadingDetail}
                detailSectionRef={detailSectionRef}
                detailScrollRef={detailScrollRef}
                detailHeadRef={detailHeadRef}
                detailRowRefs={detailRowRefs}
                onSetActiveDetailRow={setActiveDetailRow}
                onCellKeyDown={handleDetailCellKeyDown}
                onCellCopy={handleCellCopy}
              />
            </>
          )}
        </main>

        {/* ===== Modal Footer ===== */}
        <PickupFooter
          selectedCount={selectedStts.size}
          filteredCount={filteredSlips.length}
          totalSlipsCount={slips.length}
          activeItemsCount={activeItems.length}
          activeSlipTotalSheets={activeSlipTotalSheets}
          activeStt={activeStt}
          slips={slips}
          activeItems={activeItems}
          isReturn={isReturn}
          cancelBtnRef={cancelBtnRef}
          onCreateWarehouseSlip={onCreateWarehouseSlip}
          onEditWarehouseSlip={onEditWarehouseSlip}
          onDeleteWarehouseSlip={onDeleteWarehouseSlip}
          onClose={onClose}
          onAccept={handleAccept}
        />
      </div>
    </div>
  );
};
