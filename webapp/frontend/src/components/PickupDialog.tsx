import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/Button";
import { PickupSlip, PickupItem } from "../types/pickup";
import { formatQuantity, formatDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import { Check, X, Minus, Square, RefreshCw } from "lucide-react";

interface PickupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  maDt?: string;
  ngayCt?: string;
  onAccept: (selectedSlips: PickupSlip[], items: any[], maXe?: string) => void;
}

/**
 * Chọn Phiếu Xuất Kho (ctbhch — KH_2014).
 * Giao diện Master/Detail theo mẫu Pickup.html: header navy gradient,
 * bảng phiếu xuất (Grid1 - K_DsPx) + chi tiết vật tư (Grid2 - K_CtPx),
 * footer đếm "Số phiếu đã chọn [ n ] / [ total ]".
 * Hotkey khớp VFP (plan §7.2.3): Space, Ctrl+A, Ctrl+U, Ctrl+Home/End, Enter, Esc.
 */
export const PickupDialog: React.FC<PickupDialogProps> = ({
  isOpen,
  onClose,
  maDt,
  ngayCt,
  onAccept,
}) => {
  const [slips, setSlips] = useState<PickupSlip[]>([]);
  const [selectedStts, setSelectedStts] = useState<Set<string>>(new Set());
  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<PickupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Tăng mỗi lần nạp lại danh sách phiếu -> buộc nạp lại chi tiết kể cả khi
  // activeStt không đổi (dialog luôn mounted nên state cũ vẫn còn).
  const [detailVersion, setDetailVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Khóa modal: giữ focus trong dialog + báo tầng ngoài (VoucherForm/App) khóa phím.
  useModalLock(isOpen, containerRef);

  // Fetch slips
  const loadSlips = useCallback(async () => {
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
        // Không còn phiếu -> bỏ chọn dòng đang xem (tránh chi tiết cũ còn sót).
        setActiveStt(items.length > 0 ? items[0].stt : null);
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
      // Luôn tăng để effect chi tiết chạy lại (kể cả activeStt giữ nguyên).
      setDetailVersion((v) => v + 1);
    }
  }, [maDt, ngayCt]);

  useEffect(() => {
    if (isOpen) {
      loadSlips();
    }
  }, [isOpen, loadSlips]);

  // Fetch items when active slip changes (hoặc khi danh sách phiếu vừa nạp lại).
  useEffect(() => {
    if (!isOpen || !activeStt) {
      setActiveItems([]);
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
        onAccept(selected, json.data.rows || [], json.data.ma_xe || "");
        onClose();
      }
    } catch (err) {
      console.error("Error accepting pickup slips:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStts, slips, maDt, ngayCt, onAccept, onClose]);

  // ===== Hotkey chuẩn VFP ctbhch (plan §7.2.3) =====
  // Chỉ xử lý khi dialog đang mở VÀ focus không nằm trong ô nhập liệu
  // (tránh Space/Enter/Ctrl+A ảnh hưởng tới VoucherList hoặc ô text khác).
  useEffect(() => {
    if (!isOpen) return;
    const isTypingTarget = (el: Element | null): boolean => {
      if (!el) return false;
      if (el instanceof HTMLInputElement) {
        const t = (el.getAttribute("type") || "text").toLowerCase();
        return t !== "checkbox" && t !== "radio" && t !== "button";
      }
      return (
        el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(document.activeElement);
      const ctrl = e.ctrlKey || e.metaKey;
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
        if (slips.length > 0) setActiveStt(slips[0].stt);
      } else if (ctrl && e.key === "End") {
        e.preventDefault();
        if (slips.length > 0) setActiveStt(slips[slips.length - 1].stt);
      } else if (e.key === " ") {
        if (typing) return;
        e.preventDefault();
        if (activeStt) toggleSelect(activeStt);
      } else if (e.key === "Enter") {
        if (typing) return;
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
    slips,
    activeStt,
    selectedStts,
    selectAll,
    deselectAll,
    toggleSelect,
    handleAccept,
    onClose,
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
              onClick={loadSlips}
              disabled={loading}
              className="p-1 text-neutral-300 hover:text-white hover:bg-white/10 rounded transition-colors w-6 h-6 flex items-center justify-center"
              title="Làm mới (F5)"
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
          <section className="shrink-0 max-h-[200px] flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-neutral-100/95 backdrop-blur z-10 text-neutral-700 uppercase text-[11px] font-semibold border-b border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr className="divide-x divide-neutral-200">
                    <th className="w-10 px-2 py-2 text-center" scope="col">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) =>
                          e.target.checked ? selectAll() : deselectAll()
                        }
                        className="rounded border-neutral-300 text-primary-800 focus:ring-primary-700 w-3.5 h-3.5 cursor-pointer"
                        title="Chọn tất cả (Ctrl+A)"
                      />
                    </th>
                    <th className="w-32 px-2.5 py-2 text-center" scope="col">
                      Ngày
                    </th>
                    <th className="w-36 px-3 py-2" scope="col">
                      Số phiếu
                    </th>
                    <th className="w-36 px-3 py-2" scope="col">
                      Mã KH
                    </th>
                    <th className="w-1/3 min-w-[240px] px-3 py-2" scope="col">
                      Tên KH
                    </th>
                    <th className="w-1/2 min-w-[280px] px-3 py-2" scope="col">
                      Địa chỉ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700 text-[12px]">
                  {slips.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-neutral-400 italic"
                      >
                        {loading
                          ? "Đang tải dữ liệu từ CSDL Kho..."
                          : "Không có phiếu xuất nào sẵn sàng"}
                      </td>
                    </tr>
                  ) : (
                    slips.map((s) => {
                      const isChecked = selectedStts.has(s.stt);
                      const isActive = activeStt === s.stt;
                      return (
                        <tr
                          key={s.stt}
                          onClick={() => setActiveStt(s.stt)}
                          className={`cursor-pointer transition-colors divide-x divide-neutral-200/80 ${
                            isActive
                              ? "bg-primary-50/70 border-l-4 border-l-primary-800 hover:bg-primary-100/60 font-medium"
                              : "hover:bg-primary-50/40"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {isActive && (
                                <span className="text-primary-900 text-[10px] font-black">
                                  ►
                                </span>
                              )}
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelect(s.stt)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-primary-400 text-primary-800 focus:ring-primary-800 w-3.5 h-3.5 cursor-pointer"
                              />
                            </div>
                          </td>
                          <td className="px-2.5 py-1.5 text-center font-mono tabular-nums text-primary-900">
                            {formatDate(s.ngay_ct)}
                          </td>
                          <td className="px-3 py-1.5 font-bold text-primary-900">
                            {s.so_ct || s.stt}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-neutral-800">
                            {s.ma_dt}
                          </td>
                          <td className="px-3 py-1.5 text-neutral-900 font-semibold">
                            {s.ten_dt || "—"}
                          </td>
                          <td
                            className="px-3 py-1.5 text-neutral-600 truncate"
                            title={s.dia_chi || ""}
                          >
                            {s.dia_chi || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Dòng trống bổ sung — giữ chiều cao bảng như mẫu Pickup.html */}
                  {Array.from({
                    length: Math.max(0, 6 - slips.length),
                  }).map((_, i) => (
                    <tr
                      key={`filler-${i}`}
                      className={`h-7 divide-x divide-neutral-100 ${
                        i % 2 === 1 ? "bg-neutral-50/20" : "bg-white"
                      }`}
                    >
                      <td colSpan={6} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* TẦNG 2: BẢNG DETAIL — CHI TIẾT HÀNG HÓA VẬT TƯ */}
          <section className="flex-1 flex flex-col bg-white rounded border border-neutral-300 shadow-sm overflow-hidden h-full">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-neutral-100/95 backdrop-blur z-10 text-neutral-700 uppercase text-[11px] font-semibold border-b border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr className="divide-x divide-neutral-200">
                    <th className="w-40 px-3 py-2 text-center" scope="col">
                      Vật tư (Mã VT)
                    </th>
                    <th
                      className="min-w-[240px] px-3 py-2 text-left"
                      scope="col"
                    >
                      Tên vật tư hàng hóa
                    </th>
                    <th className="w-24 px-2.5 py-2 text-center" scope="col">
                      Mã kho
                    </th>
                    <th className="w-20 px-2 py-2 text-center" scope="col">
                      ĐVT
                    </th>
                    <th className="w-24 px-3 py-2 text-right" scope="col">
                      Số tấm
                    </th>
                    <th className="w-24 px-3 py-2 text-right" scope="col">
                      Hệ số
                    </th>
                    <th className="w-24 px-3 py-2 text-right" scope="col">
                      SL bán
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700 text-[12px]">
                  {activeItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-neutral-400 italic"
                      >
                        {loadingDetail
                          ? "Đang nạp chi tiết..."
                          : "Chọn một phiếu ở trên để xem chi tiết"}
                      </td>
                    </tr>
                  ) : (
                    activeItems.map((item, idx) => (
                      <tr
                        key={item.stt0 || idx}
                        className={`hover:bg-secondary-50/40 transition-colors divide-x divide-neutral-200 font-medium ${
                          idx % 2 === 1 ? "bg-neutral-50/20" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-primary-900 font-bold bg-neutral-50/50 text-center">
                          {item.ma_vt}
                        </td>
                        <td className="px-3 py-2 text-neutral-900">
                          <div className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary-600 mr-2 shrink-0" />
                            <span className="font-medium">
                              {item.ten_vt || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-center font-semibold text-neutral-800 bg-neutral-50/30">
                          {item.ma_kho || "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-neutral-600">
                          {item.dvt || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700">
                          {formatQuantity(item.so_tam)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-500">
                          {formatQuantity(item.he_so8)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-primary-900 font-bold">
                          {formatQuantity(item.so_luong9)}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Dòng trống bổ sung — giữ chiều cao bảng như mẫu Pickup.html */}
                  {Array.from({
                    length: Math.max(0, 8 - activeItems.length),
                  }).map((_, i) => (
                    <tr
                      key={`detail-filler-${i}`}
                      className={`h-7 divide-x divide-neutral-100 ${
                        i % 2 === 1 ? "bg-neutral-50/20" : "bg-white"
                      }`}
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
        <footer className="px-4 py-3 bg-neutral-100 border-t border-neutral-300 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Bộ đếm phiếu đã chọn */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="flex items-center bg-white px-3 py-1.5 rounded border border-neutral-300 shadow-sm">
              <label className="text-xs sm:text-sm font-bold text-neutral-700 mr-2 whitespace-nowrap">
                Số phiếu đã chọn
              </label>
              <div className="flex items-center font-mono font-bold text-sm">
                <input
                  readOnly
                  value={selectedStts.size}
                  className="w-10 h-7 text-center font-bold text-primary-900 bg-primary-50 border border-primary-400 rounded p-0 text-sm focus:outline-none select-all"
                />
                <span className="mx-2 text-neutral-400 text-base">/</span>
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-neutral-200 text-neutral-700 rounded text-sm">
                  {slips.length}
                </span>
              </div>
            </div>
          </div>

          {/* Hướng dẫn phím tắt & nút thao tác */}
          <div className="flex items-center justify-end space-x-2.5 w-full sm:w-auto">
            <div className="hidden lg:flex items-center space-x-2 text-[11px] text-neutral-500 mr-2">
              <kbd>Space</kbd>
              <span>Đánh dấu</span>
              <kbd>Ctrl+A</kbd>
              <span>Chọn tất cả</span>
              <kbd>Enter</kbd>
              <span>Chấp nhận</span>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              type="button"
              className="min-w-[90px]"
            >
              <X className="w-3.5 h-3.5 mr-1.5 text-neutral-500" />
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleAccept}
              disabled={selectedStts.size === 0}
              type="button"
              className="min-w-[110px]"
            >
              <Check className="w-3.5 h-3.5 mr-1.5 text-success-300" />
              Chấp nhận
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
