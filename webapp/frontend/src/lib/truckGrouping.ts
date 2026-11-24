import { calcLoai2Item, calcVoucherTotals, round } from "./calc";
import { DebtSummary } from "../types/debt";
import {
  CumulativeDebtStatus,
  TruckDraftItem,
  TruckDraftVoucher,
  TruckSourceOrderRef,
} from "../types/truckBatch";

export function normalizeGroupNote(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}

function clampField(value: string | undefined | null, maxLen: number): string {
  return (value || "").trim().slice(0, maxLen);
}

/** Tính lại toàn bộ dòng hàng & tổng tiền header của 1 phiếu dự kiến. */
export function recalculateDraftVoucher(
  voucher: TruckDraftVoucher,
): TruckDraftVoucher {
  const safeTyGia = voucher.ty_gia > 0 ? voucher.ty_gia : 1.0;
  const maTte = voucher.ma_tte || "VND";
  const fixedTt: "C" | "K" = voucher.ma_ct === "N5" ? "K" : "C";

  const nextItems: TruckDraftItem[] = voucher.items.map((it) => {
    const calced = calcLoai2Item(it, safeTyGia, "", maTte, fixedTt);
    return {
      ...it,
      ...calced,
      source_order_key: it.source_order_key,
      source_order_code: it.source_order_code,
      source_group_note: it.source_group_note,
      is_gift: it.is_gift,
    };
  });

  const totals = calcVoucherTotals(nextItems, safeTyGia, 0, "2");
  // Đồng bộ lại số dòng & tổng SL cho từng đơn kho con (phòng trường hợp thêm/xóa/sửa SL)
  const qtyByOrder = new Map<string, { count: number; qty: number }>();
  for (const row of nextItems) {
    const key = (row.source_order_key || row.stt_px || "").trim();
    if (!key) continue;
    const prev = qtyByOrder.get(key) || { count: 0, qty: 0 };
    prev.count += 1;
    prev.qty = round(prev.qty + Number(row.so_luong9 || 0), 2);
    qtyByOrder.set(key, prev);
  }

  const nextSources: TruckSourceOrderRef[] = voucher.source_orders
    .map((ref) => {
      const stat = qtyByOrder.get(ref.source_order_key);
      return {
        ...ref,
        item_count: stat ? stat.count : 0,
        total_qty: stat ? stat.qty : 0,
      };
    })
    .filter((ref) => ref.item_count > 0);

  return {
    ...voucher,
    items: nextItems,
    source_orders: nextSources,
    ttien_nt9: totals.ttien_nt,
    ttien_nt4: totals.ttien_nt4,
    ttien_nt2: totals.ttien_nt2,
    ttien_nt0: totals.ttien_nt0,
    ttien0: totals.ttien0,
  };
}

/**
 * Đổi Mã khách hàng trên 1 phiếu quá nợ sang khách hàng khác:
 * - Cập nhật Ma_Dt, Ten_Dt, Ong_Ba, Ma_Bp, Han_Tt (và Dia_Chi nếu chưa sửa tay).
 * - GIỮ NGUYÊN 100% đơn giá (`gia_nt9`) và chiết khấu (`chiet_khau`) của toàn bộ dòng hàng!
 * - Reset `skip_debt_check = false` để kiểm tra lại theo hạn mức của khách mới.
 */
export function swapVoucherCustomerPreservePrices(
  voucher: TruckDraftVoucher,
  nextCustomer: {
    ma_dt: string;
    ten_dt: string;
    dia_chi?: string;
    ong_ba?: string;
    ma_bp?: string;
    han_tt?: number;
  },
): TruckDraftVoucher {
  const cleanMaDt = nextCustomer.ma_dt.trim().toUpperCase();
  return {
    ...voucher,
    ma_dt: cleanMaDt,
    ten_dt: nextCustomer.ten_dt || "",
    ong_ba: clampField(nextCustomer.ong_ba || nextCustomer.ten_dt, 64),
    dia_chi: voucher.userEditedDiaChi
      ? voucher.dia_chi
      : clampField(nextCustomer.dia_chi || voucher.dia_chi, 64),
    ma_bp: nextCustomer.ma_bp ?? voucher.ma_bp,
    han_tt: nextCustomer.han_tt ?? voucher.han_tt,
    skip_debt_check: false,
    customerSwapped: true,
    errorMsg: null,
  };
}

/**
 * Ghép 2+ phiếu dự kiến của CÙNG 1 khách hàng thành 1 phiếu duy nhất (`Ctrl+G`).
 * Giữ lại diễn giải của phiếu đầu tiên trong danh sách được chọn.
 */
export function mergeDraftVouchers(
  vouchers: TruckDraftVoucher[],
  draftIdsToMerge: string[],
): { vouchers: TruckDraftVoucher[]; mergedDraftId: string | null; error?: string } {
  const targetSet = new Set(draftIdsToMerge);
  const targets = vouchers.filter((v) => targetSet.has(v.draft_id));
  if (targets.length < 2) {
    return {
      vouchers,
      mergedDraftId: null,
      error: "Cần chọn ít nhất 2 phiếu của cùng một khách hàng để ghép.",
    };
  }

  const primaryMaDt = targets[0].ma_dt.trim().toUpperCase();
  const sameCustomer = targets.every(
    (v) => v.ma_dt.trim().toUpperCase() === primaryMaDt,
  );
  if (!sameCustomer) {
    return {
      vouchers,
      mergedDraftId: null,
      error: "Chỉ có thể ghép các phiếu thuộc cùng một khách hàng (Ma_Dt).",
    };
  }

  const primary = targets[0];
  const mergedSources: TruckSourceOrderRef[] = [];
  const seenKeys = new Set<string>();
  const mergedItems: TruckDraftItem[] = [];

  for (const v of targets) {
    for (const ref of v.source_orders) {
      if (!seenKeys.has(ref.source_order_key)) {
        seenKeys.add(ref.source_order_key);
        mergedSources.push(ref);
      }
    }
    mergedItems.push(...v.items);
  }

  const mergedVoucher = recalculateDraftVoucher({
    ...primary,
    source_orders: mergedSources,
    items: mergedItems,
    selected: targets.some((v) => v.selected),
    skip_debt_check: primary.skip_debt_check && targets.every((v) => v.skip_debt_check),
    errorMsg: null,
  });

  const nextList: TruckDraftVoucher[] = [];
  let inserted = false;
  for (const v of vouchers) {
    if (targetSet.has(v.draft_id)) {
      if (!inserted) {
        nextList.push(mergedVoucher);
        inserted = true;
      }
    } else {
      nextList.push(v);
    }
  }

  return { vouchers: nextList, mergedDraftId: mergedVoucher.draft_id };
}

/**
 * Tách 1 hoặc nhiều ĐƠN KHO CON từ phiếu hiện tại:
 * - Nếu không truyền `targetDraftId`: tạo 1 phiếu bán mới ngay bên dưới phiếu gốc (`Ctrl+T`).
 * - Nếu truyền `targetDraftId`: chuyển thẳng các đơn kho con đó sang phiếu đích (phải cùng `ma_dt`).
 */
export function splitOrdersFromVoucher(
  vouchers: TruckDraftVoucher[],
  sourceDraftId: string,
  orderKeysToMove: string[],
  targetDraftId?: string | null,
): {
  vouchers: TruckDraftVoucher[];
  focusDraftId: string | null;
  error?: string;
} {
  const moveSet = new Set(orderKeysToMove.map((k) => k.trim()).filter(Boolean));
  if (moveSet.size === 0) {
    return {
      vouchers,
      focusDraftId: null,
      error: "Vui lòng chọn ít nhất 1 đơn kho con để tách hoặc chuyển.",
    };
  }

  const sourceIdx = vouchers.findIndex((v) => v.draft_id === sourceDraftId);
  if (sourceIdx < 0) {
    return { vouchers, focusDraftId: null, error: "Không tìm thấy phiếu nguồn." };
  }
  const source = vouchers[sourceIdx];

  const remainingSources = source.source_orders.filter(
    (o) => !moveSet.has(o.source_order_key),
  );
  const movingSources = source.source_orders.filter((o) =>
    moveSet.has(o.source_order_key),
  );

  if (movingSources.length === 0) {
    return { vouchers, focusDraftId: null, error: "Không tìm thấy đơn kho cần tách." };
  }
  if (!targetDraftId && remainingSources.length === 0) {
    return {
      vouchers,
      focusDraftId: null,
      error: "Không thể tách toàn bộ đơn kho của phiếu — hãy để lại ít nhất 1 đơn kho ở phiếu gốc.",
    };
  }

  const movingItems: TruckDraftItem[] = [];
  const remainingItems: TruckDraftItem[] = [];
  for (const it of source.items) {
    const key = (it.source_order_key || it.stt_px || "").trim();
    if (key && moveSet.has(key)) {
      movingItems.push(it);
    } else {
      remainingItems.push(it);
    }
  }

  if (movingItems.length === 0) {
    return { vouchers, focusDraftId: null, error: "Đơn kho được chọn không có dòng hàng." };
  }

  // Case A: Chuyển sang 1 phiếu đích đã có của cùng khách hàng
  if (targetDraftId) {
    const targetIdx = vouchers.findIndex((v) => v.draft_id === targetDraftId);
    if (targetIdx < 0 || targetIdx === sourceIdx) {
      return { vouchers, focusDraftId: null, error: "Phiếu đích không hợp lệ." };
    }
    const target = vouchers[targetIdx];
    if (target.ma_dt.trim().toUpperCase() !== source.ma_dt.trim().toUpperCase()) {
      return {
        vouchers,
        focusDraftId: null,
        error: "Chỉ được chuyển đơn kho sang phiếu khác của cùng khách hàng.",
      };
    }

    const updatedTarget = recalculateDraftVoucher({
      ...target,
      source_orders: [...target.source_orders, ...movingSources],
      items: [...target.items, ...movingItems],
      errorMsg: null,
    });

    const nextList: TruckDraftVoucher[] = [];
    for (let i = 0; i < vouchers.length; i++) {
      if (i === targetIdx) {
        nextList.push(updatedTarget);
      } else if (i === sourceIdx) {
        if (remainingItems.length > 0) {
          nextList.push(
            recalculateDraftVoucher({
              ...source,
              source_orders: remainingSources,
              items: remainingItems,
              errorMsg: null,
            }),
          );
        }
      } else {
        nextList.push(vouchers[i]);
      }
    }
    return { vouchers: nextList, focusDraftId: updatedTarget.draft_id };
  }

  // Case B: Tách thành 1 phiếu mới ngay bên dưới phiếu gốc
  const existingIds = new Set(vouchers.map((v) => v.draft_id));
  let seq = vouchers.length + 1;
  let newDraftId = `DRAFT-S${seq}`;
  while (existingIds.has(newDraftId)) {
    seq += 1;
    newDraftId = `DRAFT-S${seq}`;
  }

  const firstMovingNote = (movingSources[0]?.group_note || "").trim();
  const newVoucher = recalculateDraftVoucher({
    ...source,
    draft_id: newDraftId,
    dien_giai0: clampField(firstMovingNote || source.dien_giai0 || "Mua hàng", 128),
    normalized_group_note: normalizeGroupNote(firstMovingNote || source.dien_giai0),
    source_orders: movingSources,
    items: movingItems,
    selected: source.selected,
    skip_debt_check: false,
    errorMsg: null,
  });

  const updatedSource = recalculateDraftVoucher({
    ...source,
    source_orders: remainingSources,
    items: remainingItems,
    errorMsg: null,
  });

  const nextList = [...vouchers];
  nextList.splice(sourceIdx, 1, updatedSource, newVoucher);
  return { vouchers: nextList, focusDraftId: newVoucher.draft_id };
}

/**
 * Tính toán công nợ cộng dồn realtime cho từng phiếu trên xe (khớp chính xác CHỐT 3 Backend & VFP):
 * - Chỉ các phiếu đang được chọn (`selected`) và là xuất bán (`X1`) mới cộng dồn vào dư nợ khách.
 * - Với phiếu chưa được chọn, vẫn hiển thị dư nợ hiện tại + phần cộng dồn từ các phiếu đã chọn của khách đó
 *   để kế toán biết ngay nếu tick vào có bị quá nợ hay không.
 */
export function computeCumulativeDebts(
  vouchers: TruckDraftVoucher[],
  debtMap: Record<string, DebtSummary & { du_cuoi_kiem_tra?: number }>,
): Record<string, CumulativeDebtStatus> {
  const result: Record<string, CumulativeDebtStatus> = {};
  const runningAdded: Record<string, number> = {};

  for (const v of vouchers) {
    const maDt = (v.ma_dt || "").trim().toUpperCase();
    const info = debtMap[maDt];
    const baseDebt = Number(
      info?.du_cuoi_kiem_tra ?? info?.du_cuoi ?? 0,
    );
    const gioiHan = Number(info?.gioi_han ?? 0);
    const toiHan = Number(info?.toi_han ?? 0);
    const addedBefore = runningAdded[maDt] || 0;
    const duCuoiBefore = baseDebt + addedBefore;
    const voucherAmount = v.ma_ct === "N5" ? 0 : Number(v.ttien0 || 0);
    const duCuoiAfter = duCuoiBefore + voucherAmount;

    const isOverLimit = gioiHan > 0 && duCuoiBefore >= gioiHan;
    const isNearLimit =
      toiHan > 0 && duCuoiBefore >= toiHan && !isOverLimit;
    const willExceedAfter =
      gioiHan > 0 && !isOverLimit && duCuoiAfter >= gioiHan;

    result[v.draft_id] = {
      maDt,
      baseDebt,
      addedBefore,
      duCuoiBefore,
      voucherAmount,
      duCuoiAfter,
      gioiHan,
      toiHan,
      isOverLimit,
      isNearLimit,
      willExceedAfter,
    };

    if (v.selected && v.ma_ct !== "N5") {
      runningAdded[maDt] = addedBefore + voucherAmount;
    }
  }

  return result;
}
