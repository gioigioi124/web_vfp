import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/Button";
import { PickupSlip, PickupItem } from "../types/pickup";
import { formatQuantity, formatDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import {
  arrowDir,
  handleExcelMouseDown,
  selectAllLater,
} from "./ui/excelCell";
import { Check, X, Minus, Square, RefreshCw, Plus, Edit3, Trash2 } from "lucide-react";

interface PickupDialogProps {
  isOpen: boolean;
  isSuspended?: boolean;
  onClose: () => void;
  maDt?: string;
  ngayCt?: string;
  onAccept: (selectedSlips: PickupSlip[], items: any[], maXe?: string) => void;
  onCreateWarehouseSlip?: () => void;
  onEditWarehouseSlip?: (stt: string) => void;
  onDeleteWarehouseSlip?: (slip: PickupSlip) => void;
  refreshTrigger?: number;
  focusStt?: string | null;
}

/**
 * Chọn Phiếu Xuất Kho (ctbhch — KH_2014).
 * Giao diện Master/Detail theo mẫu Pickup.html: header navy gradient,
 * bảng phiếu xuất (Grid1 - K_DsPx) + chi tiết vật tư (Grid2 - K_CtPx),
 * footer đếm "Số phiếu đã chọn [ n ] / [ total ]".
 * Hotkey khớp VFP (plan §7.2.3): Space, Ctrl+A, Ctrl+U, Ctrl+Home/End, Enter, Esc, F2, F3, F8.
 */
export const PickupDialog: React.FC<PickupDialogProps> = ({
  isOpen,
  isSuspended = false,
  onClose,
  maDt,
  ngayCt,
  onAccept,
  onCreateWarehouseSlip,
  onEditWarehouseSlip,
  onDeleteWarehouseSlip,
  refreshTrigger = 0,
  focusStt = null,
}) => {
  const [slips, setSlips] = useState<PickupSlip[]>([]);
  const [selectedStts, setSelectedStts] = useState<Set<string>>(new Set());
  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<PickupItem[]>([]);
  const [activeDetailRow, setActiveDetailRow] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
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

  // Fetch slips
  const loadSlips = useCallback(
    async (preferredStt?: string | null) => {
      setLoading(true);
      // Xóa chi tiết cũ ngay để không hiển thị dữ liệu cũ trong lúc chờ.
      setActiveItems([]);
      try {
        const q = new URLSearchParams();
        if (maDt) q.append("ma_dt", maDt);
        if (ngayCt) {
          q.append("ngay_ct1", ngayCt);
          q.append("ngay_ct2", ngayCt);
        }
        const url = `/api/pickup/list?${q.toString()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.data?.items) {
          const items: PickupSlip[] = data.data.items;
          setSlips(items);
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
          setSlips([]);
          setActiveStt(null);
          setSelectedStts(new Set());
        }
      } catch (e) {
        console.error("Error fetching pickup slips", e);
      } finally {
        setLoading(false);
        // Luôn tăng để effect chi tiết & focus sau tải chạy lại (kể cả activeStt giữ nguyên).
        setDetailVersion((v) => v + 1);
        listFetchSeqRef.current += 1;
        setListFetchSeq(listFetchSeqRef.current);
      }
    },
    [maDt, ngayCt],
  );

  useEffect(() => {
    if (isOpen) {
      openAtSeqRef.current = listFetchSeqRef.current;
      pendingInitialFocusRef.current = true;
      loadSlips(focusStt);
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
      }, 40);
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
      }, 35);
      return () => window.clearTimeout(timer);
    }
    if (!pendingInitialFocusRef.current) return;
    pendingInitialFocusRef.current = false;
    const firstStt = activeStt || slips[0]?.stt;
    const timer = window.setTimeout(() => {
      if (firstStt) focusMasterCell(firstStt, masterActiveColRef.current);
    }, 35);
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

  // Fetch items when active slip changes (hoặc khi danh sách phiếu vừa nạp lại).
  useEffect(() => {
    if (!isOpen || !activeStt) {
      setActiveItems([]);
      setActiveDetailRow(0);
      return;
    }
    let cancelled = false;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `/api/pickup/detail/${encodeURIComponent(activeStt)}`,
        );
        const data = await res.json();
        if (!cancelled && data.success && data.data?.items) {
          setActiveItems(data.data.items);
          setActiveDetailRow(0);
        }
      } catch (e) {
        console.error("Error fetching pickup detail", e);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => {
      cancelled = true;
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
    try {
      const res = await fetch("/api/pickup/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stts: Array.from(selectedStts),
          ma_dt: maDt,
          ngay_ct: ngayCt,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const selected = slips.filter((s) => selectedStts.has(s.stt));
        const rows = json.data.rows || [];
        if (rows.length > 0) {
          // Chấp nhận xong thì không trả focus về nút mở dialog, để VoucherForm focus xuống dòng cuối grid.
          prevFocusRef.current = null;
        }
        onAccept(selected, rows, json.data.ma_xe || "");
        onClose();
      }
    } catch (err) {
      console.error("Error accepting pickup slips:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStts, slips, maDt, ngayCt, onAccept, onClose]);

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
          onEditWarehouseSlip(activeStt);
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

  if (!isOpen) return null;

  const allSelected = slips.length > 0 && selectedStts.size === slips.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-[2px]">
      <div
        ref={containerRef}
        className="flex flex-col w-full max-w-6xl bg-white rounded-xl shadow-2xl border border-neutral-300 overflow-hidden h-full max-h-[92vh]"
      >
        {/* ===== Modal Header (navy gradient) ===== */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary-900 via-primary-800 to-neutral-900 text-white border-b border-primary-900 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-2 h-2 rounded-full bg-secondary-300" />
            <h1 className="text-sm font-bold tracking-wide uppercase text-white">
              Chọn Phiếu Xuất Kho
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-neutral-300 font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10 hidden sm:inline-block">
              Esc: Đóng
            </span>
            <button
              onClick={() => loadSlips(activeStt)}
              disabled={loading}
              className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center"
              title="Làm mới"
              type="button"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <div className="flex items-center space-x-1">
              <button
                className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center"
                title="Thu nhỏ"
                type="button"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center"
                title="Phóng to"
                type="button"
              >
                <Square className="w-3 h-3" />
              </button>
              <button
                onClick={onClose}
                className="p-1 text-neutral-200 hover:text-white hover:bg-danger-600 rounded transition-colors w-6 h-6 flex items-center justify-center ml-1"
                title="Đóng (Esc)"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ===== Master / Detail Body ===== */}
        <main className="flex-1 flex flex-col overflow-hidden p-3 gap-3 bg-neutral-100/70">
          {/* TẦNG 1: BẢNG MASTER — DANH SÁCH PHIẾU XUẤT KHO */}
          <section className="shrink-0 max-h-[210px] flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden">
            <div
              ref={masterScrollRef}
              className="flex-1 overflow-auto table-sticky-header"
            >
              <table className="w-full min-w-[960px] table-fixed text-left dense-table border-collapse text-[12px] xl-grid">
                <thead
                  ref={masterHeadRef}
                  className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-700 uppercase text-[11px] font-semibold tracking-wide select-none border-b border-neutral-300"
                >
                  <tr>
                    <th className="w-10 text-center" scope="col">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) =>
                          e.target.checked ? selectAll() : deselectAll()
                        }
                        className="rounded border-neutral-300 text-primary-800 focus:ring-primary-700 w-3.5 h-3.5 cursor-pointer align-middle"
                        title="Chọn tất cả (Ctrl+A)"
                      />
                    </th>
                    <th className="w-[115px] text-center" scope="col">
                      Ngày
                    </th>
                    <th className="w-[130px]" scope="col">
                      Số phiếu
                    </th>
                    <th className="w-[150px]" scope="col">
                      Mã KH
                    </th>
                    <th className="w-[290px]" scope="col">
                      Tên KH
                    </th>
                    <th scope="col">Địa chỉ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-sans text-neutral-900 font-semibold">
                  {slips.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-neutral-400 italic font-normal"
                      >
                        {loading
                          ? "Đang tải dữ liệu từ CSDL Kho..."
                          : "Không có phiếu xuất nào sẵn sàng"}
                      </td>
                    </tr>
                  ) : (
                    slips.map((s, rowIdx) => {
                      const isChecked = selectedStts.has(s.stt);
                      const isActive = activeStt === s.stt;
                      return (
                        <tr
                          key={s.stt}
                          ref={(el) => {
                            if (el) masterRowRefs.current[s.stt] = el;
                            else delete masterRowRefs.current[s.stt];
                          }}
                          onClick={() => setActiveStt(s.stt)}
                          className={
                            isActive
                              ? "xl-row-active"
                              : isChecked
                                ? "xl-row-marked"
                                : undefined
                          }
                        >
                          <td
                            className="xl-cell text-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStt(s.stt);
                              toggleSelect(s.stt);
                            }}
                            title="Nhấn để đánh dấu (Space)"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              tabIndex={-1}
                              className="rounded border-neutral-400 text-primary-800 focus:ring-0 w-3.5 h-3.5 cursor-pointer align-middle pointer-events-none"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={formatDate(s.ngay_ct)}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                masterActiveColRef.current = 1;
                                setActiveStt(s.stt);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleMasterCellKeyDown(e, rowIdx, 1)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-center font-mono font-semibold text-neutral-900 tabular-nums grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={s.so_ct || s.stt}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                masterActiveColRef.current = 2;
                                setActiveStt(s.stt);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleMasterCellKeyDown(e, rowIdx, 2)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input font-mono font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={s.ma_dt || ""}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                masterActiveColRef.current = 3;
                                setActiveStt(s.stt);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleMasterCellKeyDown(e, rowIdx, 3)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input font-mono font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={s.ten_dt || ""}
                              placeholder="—"
                              title={s.ten_dt || ""}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                masterActiveColRef.current = 4;
                                setActiveStt(s.stt);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleMasterCellKeyDown(e, rowIdx, 4)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={s.dia_chi || ""}
                              placeholder="—"
                              title={s.dia_chi || ""}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                masterActiveColRef.current = 5;
                                setActiveStt(s.stt);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleMasterCellKeyDown(e, rowIdx, 5)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Dòng trống bổ sung — giữ chiều cao bảng như mẫu Pickup.html */}
                  {Array.from({
                    length: Math.max(0, 6 - slips.length),
                  }).map((_, i) => (
                    <tr key={`filler-${i}`} className="h-[24px] bg-white">
                      <td colSpan={6} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* TẦNG 2: BẢNG DETAIL — CHI TIẾT HÀNG HÓA VẬT TƯ */}
          <section
            ref={detailSectionRef}
            className="flex-1 flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden h-full"
          >
            <div
              ref={detailScrollRef}
              className="flex-1 overflow-auto table-sticky-header"
            >
              <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
                <thead
                  ref={detailHeadRef}
                  className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-700 uppercase text-[11px] font-semibold tracking-wide select-none border-b border-neutral-300"
                >
                  <tr>
                    <th className="w-40 text-center" scope="col">
                      Vật tư (Mã VT)
                    </th>
                    <th className="min-w-[240px] text-left" scope="col">
                      Tên vật tư hàng hóa
                    </th>
                    <th className="w-24 text-center" scope="col">
                      Mã kho
                    </th>
                    <th className="w-20 text-center" scope="col">
                      ĐVT
                    </th>
                    <th className="w-24 text-right" scope="col">
                      Số tấm
                    </th>
                    <th className="w-24 text-right" scope="col">
                      Hệ số
                    </th>
                    <th className="w-24 text-right" scope="col">
                      SL bán
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-sans text-neutral-900 font-semibold">
                  {activeItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-neutral-400 italic font-normal"
                      >
                        {loadingDetail
                          ? "Đang nạp chi tiết..."
                          : "Chọn một phiếu ở trên để xem chi tiết"}
                      </td>
                    </tr>
                  ) : (
                    activeItems.map((item, idx) => {
                      const isActive = idx === activeDetailRow;
                      return (
                        <tr
                          key={item.stt0 || idx}
                          ref={(el) => {
                            if (el) detailRowRefs.current[idx] = el;
                            else delete detailRowRefs.current[idx];
                          }}
                          onClick={() => setActiveDetailRow(idx)}
                          className={isActive ? "xl-row-active" : undefined}
                        >
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={item.ma_vt || ""}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 0)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-center font-mono font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell min-w-[240px]">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={item.ten_vt || ""}
                              placeholder="—"
                              title={item.ten_vt || ""}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 1)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input font-sans font-semibold text-neutral-900 truncate grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={item.ma_kho || ""}
                              placeholder="—"
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 2)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-center font-mono font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={item.dvt || ""}
                              placeholder="—"
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 3)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-center font-sans font-semibold text-neutral-900 grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell xl-amber">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={formatQuantity(item.so_tam)}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 4)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-right font-mono font-bold text-neutral-900 tabular-nums grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell xl-amber">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={formatQuantity(item.he_so8)}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 5)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-right font-mono font-bold text-neutral-900 tabular-nums grid-cell-input"
                            />
                          </td>
                          <td className="xl-cell xl-amber">
                            <input
                              type="text"
                              readOnly
                              data-mode="select"
                              value={formatQuantity(item.so_luong9)}
                              onMouseDown={(e) =>
                                handleExcelMouseDown(e, "select")
                              }
                              onFocus={(e) => {
                                setActiveDetailRow(idx);
                                e.currentTarget.select();
                                selectAllLater(e.currentTarget);
                              }}
                              onKeyDown={(e) =>
                                handleDetailCellKeyDown(e, idx, 6)
                              }
                              onCopy={handleCellCopy}
                              className="xl-input text-right font-mono font-semibold text-neutral-900 tabular-nums grid-cell-input"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Dòng trống bổ sung — giữ chiều cao bảng như mẫu Pickup.html */}
                  {Array.from({
                    length: Math.max(0, 8 - activeItems.length),
                  }).map((_, i) => (
                    <tr
                      key={`detail-filler-${i}`}
                      className="h-[24px] bg-white"
                    >
                      <td colSpan={7} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* ===== Modal Footer ===== */}
        <footer className="px-3 py-2 bg-neutral-100 border-t border-neutral-300 flex items-center justify-between gap-2 shrink-0">
          {/* Bộ đếm phiếu đã chọn */}
          <div className="flex items-center bg-white px-2.5 py-1 rounded border border-neutral-300 shadow-xs shrink-0">
            <label className="text-xs font-semibold text-neutral-700 mr-2 whitespace-nowrap">
              Số phiếu đã chọn
            </label>
            <div className="flex items-center font-mono font-bold text-xs">
              <input
                readOnly
                value={selectedStts.size}
                className="w-8 h-5 text-center font-bold text-primary-900 bg-primary-50 border border-primary-400 rounded p-0 text-xs focus:outline-none select-all"
              />
              <span className="mx-1.5 text-neutral-400">/</span>
              <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-neutral-200 text-neutral-700 rounded text-xs">
                {slips.length}
              </span>
            </div>
          </div>

          {/* Nhóm nút thao tác nhỏ gọn */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {onCreateWarehouseSlip && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateWarehouseSlip}
                type="button"
                className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900"
                title="Thêm mới phiếu xuất kho (F2)"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                Thêm phiếu kho
              </Button>
            )}

            {onEditWarehouseSlip && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeStt && onEditWarehouseSlip(activeStt)}
                disabled={!activeStt}
                type="button"
                className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 disabled:opacity-50"
                title="Sửa phiếu xuất kho đang chọn (F3)"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                Sửa phiếu kho
              </Button>
            )}

            {onDeleteWarehouseSlip && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const activeSlip = slips.find((s) => s.stt === activeStt);
                  if (activeSlip) onDeleteWarehouseSlip(activeSlip);
                }}
                disabled={!activeStt}
                type="button"
                className="border-danger-300 bg-danger-50 hover:bg-danger-100 text-danger-800 disabled:opacity-50"
                title="Xóa phiếu xuất kho đang chọn (F8)"
              >
                <Trash2 className="w-3.5 h-3.5 text-danger-600" />
                Xóa phiếu kho
              </Button>
            )}

            {(onCreateWarehouseSlip ||
              onEditWarehouseSlip ||
              onDeleteWarehouseSlip) && (
              <div className="h-4 w-px bg-neutral-300 mx-0.5" />
            )}

            <Button
              ref={cancelBtnRef}
              data-autofocus={slips.length === 0 ? true : undefined}
              variant="outline"
              size="sm"
              onClick={onClose}
              type="button"
            >
              <X className="w-3.5 h-3.5 text-neutral-500" />
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAccept}
              disabled={selectedStts.size === 0}
              type="button"
            >
              <Check className="w-3.5 h-3.5 text-success-300" />
              Chấp nhận
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
