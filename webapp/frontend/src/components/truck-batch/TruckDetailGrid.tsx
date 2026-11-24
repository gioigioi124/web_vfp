import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  PackagePlus,
  Scissors,
  Trash2,
  Warehouse,
} from "lucide-react";
import { PromotionCounter } from "../PromotionCounter";
import { VfpLookupCell, VfpOption } from "../ui/VfpLookupCell";
import { calcLoai2Item } from "../../lib/calc";
import { formatCurrency, formatQuantity, parseNumberInput } from "../../lib/format";
import {
  initProductIndex,
  searchProducts,
  getProductByCode,
} from "../../lib/productIndex";
import {
  TruckDraftItem,
  TruckDraftVoucher,
} from "../../types/truckBatch";

interface TruckDetailGridProps {
  voucher: TruckDraftVoucher | null;
  sameCustomerOtherVouchers: TruckDraftVoucher[];
  onUpdateItems: (draftId: string, nextItems: TruckDraftItem[]) => void;
  onSplitOrders: (
    draftId: string,
    orderKeys: string[],
    targetDraftId?: string | null,
  ) => void;
}

export const TruckDetailGrid: React.FC<TruckDetailGridProps> = React.memo(
  ({
    voucher,
    sameCustomerOtherVouchers,
    onUpdateItems,
    onSplitOrders,
  }) => {
    const [tickedOrders, setTickedOrders] = useState<Set<string>>(new Set());
    const [moveTargetId, setMoveTargetId] = useState<string>("");

    // Reset tick đơn kho con khi chuyển sang phiếu khác
    useEffect(() => {
      setTickedOrders(new Set());
      setMoveTargetId("");
    }, [voucher?.draft_id]);

    const toggleOrderTick = useCallback((orderKey: string) => {
      setTickedOrders((prev) => {
        const next = new Set(prev);
        if (next.has(orderKey)) next.delete(orderKey);
        else next.add(orderKey);
        return next;
      });
    }, []);

    // Phím tắt Ctrl+T: tách các đơn kho đang tick ra thành phiếu mới
    useEffect(() => {
      if (!voucher) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
          if (tickedOrders.size === 0) return;
          e.preventDefault();
          e.stopPropagation();
          onSplitOrders(voucher.draft_id, Array.from(tickedOrders), null);
          setTickedOrders(new Set());
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [voucher, tickedOrders, onSplitOrders]);

    const fetchProductOptions = useCallback(
      async (query: string): Promise<VfpOption[]> => {
        await initProductIndex();
        const opts = await searchProducts(query);
        return opts.map((opt) => ({
          value: opt.value,
          label: opt.label,
          hint: opt.hint || "",
        }));
      },
      [],
    );

    const handleFieldChange = useCallback(
      (
        rowIndex: number,
        field: keyof TruckDraftItem,
        rawValue: string | number,
        varRead: string = "",
      ) => {
        if (!voucher) return;
        const nextItems = [...voucher.items];
        const current = { ...nextItems[rowIndex] };
        (current as Record<string, unknown>)[field] = rawValue;
        const fixedTt: "C" | "K" = voucher.ma_ct === "N5" ? "K" : "C";
        const calced = calcLoai2Item(
          current,
          voucher.ty_gia || 1,
          varRead,
          voucher.ma_tte || "VND",
          fixedTt,
        );
        nextItems[rowIndex] = {
          ...current,
          ...calced,
          source_order_key: current.source_order_key,
          source_order_code: current.source_order_code,
          source_group_note: current.source_group_note,
          is_gift: current.is_gift,
        };
        onUpdateItems(voucher.draft_id, nextItems);
      },
      [voucher, onUpdateItems],
    );

    const handlePickProduct = useCallback(
      async (rowIndex: number, rawCode: string) => {
        if (!voucher) return;
        const clean = rawCode.trim().toUpperCase();
        if (!clean) return;
        await initProductIndex();
        const prod = await getProductByCode(clean);
        const nextItems = [...voucher.items];
        const current = { ...nextItems[rowIndex], ma_vt: clean };
        if (prod) {
          current.ten_vt = prod.ten || current.ten_vt;
          current.dvt = prod.dvt || current.dvt;
          current.dvt_ban = prod.dvt_ban || prod.dvt || current.dvt_ban;
          current.loai_vt = prod.loai_vt || "1";
          current.tk = prod.tk_gv || current.tk || "632";
          current.tk_du = prod.tk_vt || current.tk_du || "1561";
          current.tk_du2 = prod.tk_dt || current.tk_du2 || "5111";
          current.tk_du4 = prod.tk_ck || current.tk_du4 || "521";
          if (!current.ma_kho && prod.ma_kho) {
            current.ma_kho = prod.ma_kho;
          }
        }
        nextItems[rowIndex] = current;
        onUpdateItems(voucher.draft_id, nextItems);
      },
      [voucher, onUpdateItems],
    );

    const handleAddManualRow = useCallback(() => {
      if (!voucher) return;
      const fallbackOrder = voucher.source_orders[0];
      const newRow: TruckDraftItem = {
        stt_px: fallbackOrder?.source_order_key || undefined,
        source_order_key: fallbackOrder?.source_order_key || "",
        source_order_code: fallbackOrder?.order_code || "Bổ sung tay",
        source_group_note: fallbackOrder?.group_note || "",
        ma_kho: fallbackOrder?.ma_kho || voucher.items[0]?.ma_kho || "K01",
        ma_vt: "",
        ten_vt: "",
        dvt: "Cái",
        dvt_ban: "Cái",
        loai_vt: "1",
        so_tam: 1,
        he_so8: 1,
        so_luong8: 1,
        he_so9: 1,
        so_luong9: 1,
        so_luong: 1,
        gia_nt9: 0,
        gia9: 0,
        tien_nt9: 0,
        tien9: 0,
        gia_nt: 0,
        gia: 0,
        tien_nt: 0,
        tien: 0,
        gia_nt2: 0,
        gia2: 0,
        tien_nt2: 0,
        tien2: 0,
        chiet_khau: 0,
        tien_nt4: 0,
        tien4: 0,
        tk: "6322",
        tk_du: "155",
        tk_du2: "5112",
        tk_du4: "521",
        gia_tb_tt: voucher.ma_ct === "N5" ? "K" : "C",
      };
      onUpdateItems(voucher.draft_id, [...voucher.items, newRow]);
    }, [voucher, onUpdateItems]);

    const handleDeleteRow = useCallback(
      (rowIndex: number) => {
        if (!voucher) return;
        const nextItems = voucher.items.filter((_, i) => i !== rowIndex);
        onUpdateItems(voucher.draft_id, nextItems);
      },
      [voucher, onUpdateItems],
    );

    // Nhóm các dòng hàng theo đơn kho nguồn (source_order_key) để hiện thanh tiêu đề từng đơn kho con
    const groupedSections = useMemo(() => {
      if (!voucher) return [];
      const orderMetaMap = new Map(
        voucher.source_orders.map((o) => [o.source_order_key, o]),
      );
      const sectionOrder: string[] = [];
      const map = new Map<
        string,
        {
          orderKey: string;
          orderCode: string;
          maKho: string;
          groupNote: string;
          rows: { item: TruckDraftItem; flatIndex: number }[];
        }
      >();

      voucher.items.forEach((item, flatIndex) => {
        const key = (item.source_order_key || item.stt_px || "__MANUAL__").trim();
        let sec = map.get(key);
        if (!sec) {
          const meta = orderMetaMap.get(key);
          sec = {
            orderKey: key,
            orderCode: meta?.order_code || item.source_order_code || (key === "__MANUAL__" ? "Dòng thêm tay" : key),
            maKho: meta?.ma_kho || item.ma_kho || "",
            groupNote: meta?.group_note || item.source_group_note || "",
            rows: [],
          };
          map.set(key, sec);
          sectionOrder.push(key);
        }
        sec.rows.push({ item, flatIndex });
      });

      return sectionOrder.map((k) => map.get(k)!);
    }, [voucher]);

    if (!voucher) {
      return (
        <section className="flex items-center justify-center h-full bg-slate-50 text-slate-500 text-xs">
          Chọn một phiếu dự kiến ở bảng trên để xem và chỉnh sửa chi tiết hàng hóa.
        </section>
      );
    }

    const canSplitToNew =
      tickedOrders.size > 0 && tickedOrders.size < voucher.source_orders.length;
    const canMoveToOther =
      tickedOrders.size > 0 && sameCustomerOtherVouchers.length > 0 && Boolean(moveTargetId);

    return (
      <section className="flex flex-col h-full min-h-0 bg-white">
        {/* Header Bar của Detail Grid: Thông tin phiếu + PromotionCounter + Tách/Chuyển đơn kho */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-100 border-b border-slate-300 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-bold text-[#1E3A8A] font-mono text-xs">
              {voucher.ma_dt}
            </span>
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[240px]">
              {voucher.ten_dt}
            </span>
            <span className="text-[11px] text-slate-500 truncate max-w-[260px]">
              · {voucher.dien_giai0 || "Mua hàng"}
            </span>
            {/* Đếm hàng khuyến mại tích hợp ngay trên phiếu đang chọn */}
            <PromotionCounter
              items={voucher.items}
              ngayCt={voucher.ngay_ct}
              maTte={voucher.ma_tte || "VND"}
              voucherKey={voucher.draft_id}
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            {voucher.source_orders.length >= 2 && (
              <>
                <button
                  type="button"
                  disabled={!canSplitToNew}
                  onClick={() => {
                    onSplitOrders(
                      voucher.draft_id,
                      Array.from(tickedOrders),
                      null,
                    );
                    setTickedOrders(new Set());
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border font-semibold transition ${
                    canSplitToNew
                      ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-700 cursor-pointer"
                      : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                  }`}
                  title="Tick đơn kho con ở bảng dưới rồi bấm để tách thành phiếu bán mới (Ctrl+T)"
                >
                  <Scissors className="w-3 h-3" />
                  <span>Tách thành phiếu mới ({tickedOrders.size})</span>
                  <kbd className="px-1 py-0 text-[9px] bg-black/15 rounded font-mono">
                    Ctrl+T
                  </kbd>
                </button>
              </>
            )}

            {sameCustomerOtherVouchers.length > 0 && (
              <div className="inline-flex items-center gap-1">
                <select
                  value={moveTargetId}
                  onChange={(e) => setMoveTargetId(e.target.value)}
                  className="h-7 px-1.5 rounded border border-slate-300 bg-white text-[11px] text-slate-700"
                  title="Chọn phiếu đích cùng khách hàng để chuyển các đơn kho đã tick"
                >
                  <option value="">Chuyển đơn sang phiếu...</option>
                  {sameCustomerOtherVouchers.map((other) => (
                    <option key={other.draft_id} value={other.draft_id}>
                      {other.draft_id} · {other.dien_giai0 || "Mua hàng"} ({other.source_orders.length} đơn)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!canMoveToOther}
                  onClick={() => {
                    if (!moveTargetId) return;
                    onSplitOrders(
                      voucher.draft_id,
                      Array.from(tickedOrders),
                      moveTargetId,
                    );
                    setTickedOrders(new Set());
                    setMoveTargetId("");
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border font-semibold ${
                    canMoveToOther
                      ? "bg-sky-700 hover:bg-sky-800 text-white border-sky-800 cursor-pointer"
                      : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                  }`}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Chuyển</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddManualRow}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
              title="Thêm dòng hàng hóa / quà tặng thủ công vào phiếu này"
            >
              <PackagePlus className="w-3.5 h-3.5 text-emerald-700" />
              <span>Thêm dòng</span>
            </button>
          </div>
        </div>

        {/* Bảng chi tiết dòng hàng gom theo Đơn kho con */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-9 px-2 py-1.5 border-r border-slate-200 text-center">
                  STT
                </th>
                <th className="w-36 px-2 py-1.5 border-r border-slate-200 text-left">
                  Mã vật tư
                </th>
                <th className="min-w-[200px] px-2 py-1.5 border-r border-slate-200 text-left">
                  Tên hàng hóa
                </th>
                <th className="w-20 px-2 py-1.5 border-r border-slate-200 text-center">
                  Kho
                </th>
                <th className="w-16 px-2 py-1.5 border-r border-slate-200 text-center">
                  ĐVT
                </th>
                <th className="w-20 px-2 py-1.5 border-r border-slate-200 text-right">
                  Số tấm
                </th>
                <th className="w-16 px-2 py-1.5 border-r border-slate-200 text-right">
                  Hệ số
                </th>
                <th className="w-20 px-2 py-1.5 border-r border-slate-200 text-right">
                  SL bán
                </th>
                <th className="w-28 px-2 py-1.5 border-r border-slate-200 text-right">
                  Đơn giá (≥ 0)
                </th>
                <th className="w-16 px-2 py-1.5 border-r border-slate-200 text-right">
                  CK %
                </th>
                <th className="w-32 px-2 py-1.5 border-r border-slate-200 text-right">
                  Thành tiền
                </th>
                <th className="w-16 px-2 py-1.5 border-r border-slate-200 text-center">
                  TK DT
                </th>
                <th className="w-9 px-1 py-1.5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedSections.map((sec) => {
                const isRealOrder = sec.orderKey !== "__MANUAL__";
                const isTicked = tickedOrders.has(sec.orderKey);
                const showOrderCheckbox =
                  isRealOrder &&
                  (voucher.source_orders.length >= 2 ||
                    sameCustomerOtherVouchers.length > 0);

                return (
                  <React.Fragment key={sec.orderKey}>
                    {/* Thanh tiêu đề từng Đơn kho con để dễ nhìn nguồn gốc & tick Tách/Chuyển */}
                    <tr className="bg-slate-50/95 border-y border-slate-200">
                      <td colSpan={13} className="px-2 py-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            {showOrderCheckbox && (
                              <button
                                type="button"
                                onClick={() => toggleOrderTick(sec.orderKey)}
                                className={`w-4 h-4 rounded-sm border inline-flex items-center justify-center cursor-pointer ${
                                  isTicked
                                    ? "bg-amber-600 border-amber-700 text-white"
                                    : "bg-white border-slate-400 hover:border-amber-600"
                                }`}
                                title="Tick đơn kho con này để Tách thành phiếu mới hoặc Chuyển sang phiếu khác"
                              >
                                {isTicked && (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                )}
                              </button>
                            )}
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700">
                              <Warehouse className="w-3 h-3 text-emerald-700" />
                              Đơn kho: {sec.orderCode}
                            </span>
                            {sec.maKho && (
                              <span className="px-1.5 py-0 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px]">
                                Kho {sec.maKho}
                              </span>
                            )}
                            {sec.groupNote && (
                              <span className="text-slate-600 truncate max-w-[360px]">
                                Ghi chú gốc: <strong>"{sec.groupNote}"</strong>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                            Stt_PX: {isRealOrder ? sec.orderKey : "—"} ·{" "}
                            {sec.rows.length} dòng
                          </span>
                        </div>
                      </td>
                    </tr>

                    {sec.rows.map(({ item, flatIndex }) => {
                      const isZeroPrice = Number(item.gia_nt9 || 0) === 0;
                      const isLoai2 =
                        item.loai_vt === "2" || item.loai_vt === "4";
                      return (
                        <tr
                          key={`${sec.orderKey}-${flatIndex}`}
                          className="hover:bg-blue-50/40"
                        >
                          <td className="px-2 py-1 border-r border-slate-200 text-center font-mono text-slate-500">
                            {flatIndex + 1}
                          </td>

                          {/* Mã vật tư */}
                          <td className="p-0 border-r border-slate-200">
                            <VfpLookupCell
                              value={item.ma_vt || ""}
                              onValueChange={(val) =>
                                handleFieldChange(flatIndex, "ma_vt", val)
                              }
                              onPick={(opt) => {
                                void handlePickProduct(flatIndex, opt.value);
                              }}
                              onCommit={(raw) => {
                                void handlePickProduct(flatIndex, raw);
                              }}
                              fetcher={fetchProductOptions}
                              advanceOnPick={false}
                              placeholder="Mã VT"
                              className="h-7 px-1.5 font-mono text-xs uppercase bg-transparent"
                            />
                          </td>

                          {/* Tên vật tư */}
                          <td className="px-2 py-1 border-r border-slate-200">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="truncate text-slate-800"
                                title={item.ten_vt}
                              >
                                {item.ten_vt || "—"}
                              </span>
                              {item.is_gift && (
                                <span className="px-1 py-0 rounded bg-purple-100 text-purple-800 text-[10px] font-semibold flex-shrink-0">
                                  KM
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Kho */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={item.ma_kho || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "ma_kho",
                                  e.target.value.toUpperCase(),
                                )
                              }
                              className="w-full h-7 px-1.5 text-center font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                            />
                          </td>

                          {/* ĐVT */}
                          <td className="px-1.5 py-1 border-r border-slate-200 text-center text-slate-600">
                            {item.dvt_ban || item.dvt || ""}
                          </td>

                          {/* Số tấm */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={String(item.so_tam ?? 0)}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "so_tam",
                                  parseNumberInput(e.target.value),
                                  "SO_TAM",
                                )
                              }
                              className="w-full h-7 px-1.5 text-right font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                            />
                          </td>

                          {/* Hệ số */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={String(item.he_so8 ?? 1)}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "he_so8",
                                  parseNumberInput(e.target.value) || 1,
                                  "HE_SO8",
                                )
                              }
                              className="w-full h-7 px-1.5 text-right font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                            />
                          </td>

                          {/* SL bán */}
                          <td
                            className={`px-1.5 py-1 border-r border-slate-200 text-right font-mono font-semibold ${
                              isLoai2 ? "text-blue-800 bg-blue-50/40" : "text-slate-800"
                            }`}
                            title={
                              isLoai2
                                ? "Hàng Mút (Loai_Vt=2): SL bán = Số tấm × Hệ số"
                                : "Số lượng bán"
                            }
                          >
                            {formatQuantity(item.so_luong9 || 0)}
                          </td>

                          {/* Đơn giá (chấp nhận 0, sửa trực tiếp trong grid) */}
                          <td
                            className={`p-0 border-r border-slate-200 ${
                              isZeroPrice ? "bg-amber-50/80" : ""
                            }`}
                          >
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.gia_nt9 ?? 0}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "gia_nt9",
                                  Math.max(0, Number(e.target.value) || 0),
                                  "GIA_NT9",
                                )
                              }
                              className={`w-full h-7 px-1.5 text-right font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A] ${
                                isZeroPrice
                                  ? "text-amber-800 font-semibold"
                                  : "text-slate-900"
                              }`}
                            />
                          </td>

                          {/* Chiết khấu % */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="1"
                              value={item.chiet_khau ?? 0}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "chiet_khau",
                                  Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value) || 0),
                                  ),
                                  "CHIET_KHAU",
                                )
                              }
                              className="w-full h-7 px-1.5 text-right font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                            />
                          </td>

                          {/* Thành tiền sau CK */}
                          <td className="px-2 py-1 border-r border-slate-200 text-right font-mono font-semibold text-slate-900">
                            {formatCurrency(item.tien_nt2 || 0)}
                          </td>

                          {/* TK DT */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={item.tk_du2 || "5112"}
                              onChange={(e) =>
                                handleFieldChange(
                                  flatIndex,
                                  "tk_du2",
                                  e.target.value.trim(),
                                )
                              }
                              className="w-full h-7 px-1 text-center font-mono text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1E3A8A]"
                            />
                          </td>

                          {/* Xóa dòng */}
                          <td className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(flatIndex)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="Xóa dòng hàng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer tổng hợp của phiếu đang chọn */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-xs flex-shrink-0">
          <div className="text-[11px] text-slate-600">
            Tiền hàng:{" "}
            <strong className="font-mono text-slate-800">
              {formatCurrency(voucher.ttien_nt9)}
            </strong>
            {voucher.ttien_nt4 > 0 && (
              <>
                {" · "}Chiết khấu:{" "}
                <strong className="font-mono text-amber-800">
                  -{formatCurrency(voucher.ttien_nt4)}
                </strong>
              </>
            )}
          </div>
          <div className="text-xs font-bold text-[#1E3A8A]">
            Tổng thanh toán phiếu:{" "}
            <span className="font-mono text-sm">
              {formatCurrency(voucher.ttien0)}
            </span>
          </div>
        </div>
      </section>
    );
  },
);
