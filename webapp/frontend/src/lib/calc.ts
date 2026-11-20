import { VoucherDetail } from "../types/voucher";

export interface CalculatedTotals {
  ttien_nt: number;
  ttien_nt4: number;
  ttien_nt2: number;
  ttien_nt3: number;
  ttien_nt0: number;
  ttien: number;
  ttien4: number;
  ttien2: number;
  ttien3: number;
  ttien0: number;
  totalQty: number;
}

export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calcLoai2Item(
  item: VoucherDetail,
  tyGia: number = 1.0,
  varRead: string = "",
  maTte: string = "VND",
  defaultGiaTbTt?: "C" | "K",
): VoucherDetail {
  const safeTyGia = tyGia > 0 ? tyGia : 1.0;
  const isVnd = maTte.toUpperCase() === "VND";
  const loaiVt = (item.loai_vt || "1").trim();
  let soTam = Number(item.so_tam || 0);
  let heSo8 = Number(item.he_so8 && item.he_so8 > 0 ? item.he_so8 : 1.0);
  const heSo9 = Number(item.he_so9 && item.he_so9 > 0 ? item.he_so9 : 1.0);
  let soLuong9 = Number(item.so_luong9 || 0);
  let giaNt9 = Number(item.gia_nt9 || 0);
  let tienNt9 = Number(item.tien_nt9 || 0);
  let chietKhau = Math.round(Number(item.chiet_khau || 0));

  // Fix #17: Promotional item 1 to 10 VND -> discount is 0
  if (maTte.toUpperCase() === "VND" && giaNt9 >= 1 && giaNt9 <= 10) {
    chietKhau = 0;
  }

  let soLuongBan = 0;
  let soLuong8 = 0;
  let soLuong = 0;

  // Khi nạp dòng hàng từ phiếu đã lưu (varRead === ""), nếu So_Tam trong DB = 0
  // nhưng So_Luong9 > 0 (dữ liệu VFP cũ) thì khôi phục So_Tam để không bị tính về 0.
  if (varRead === "" && soTam <= 0 && soLuong9 > 0) {
    soTam = heSo8 > 0 ? round(soLuong9 / heSo8, 2) : soLuong9;
  }

  if (
    loaiVt === "2" ||
    loaiVt === "4" ||
    varRead === "SO_TAM" ||
    varRead === "HE_SO8"
  ) {
    // Tính Số lượng & SL bán từ Số tấm * Hệ số (do cột Số lượng và SL bán trên Grid đều đã disable)
    soLuongBan = round(soTam * heSo8, 2);
    soLuong8 = soLuongBan;
    soLuong9 = soLuongBan;
    soLuong = loaiVt === "1" ? round(soLuong9 * heSo9, 2) : soLuongBan;
  } else {
    if (soTam <= 0 && soLuong9 > 0) {
      soTam = soLuong9;
    }
    soLuongBan = soTam > 0 ? round(soTam * heSo8, 2) : soLuong9;
    soLuong8 = soLuongBan;
    soLuong9 = soLuongBan;
    soLuong = loaiVt === "1" ? round(soLuong9 * heSo9, 2) : soLuongBan;
  }

  // Price & amount forward / reverse (VND làm tròn Thành tiền về số nguyên)
  if (varRead === "TIEN_NT9") {
    tienNt9 = isVnd ? Math.round(tienNt9) : round(tienNt9, 2);
    giaNt9 = soLuongBan > 0 ? round(tienNt9 / soLuongBan, 2) : 0;
  } else {
    tienNt9 = isVnd
      ? Math.round(soLuongBan * giaNt9)
      : round(soLuongBan * giaNt9, 2);
  }

  const gia9 = Math.round(giaNt9 * safeTyGia);
  const tien9 = Math.round(tienNt9 * safeTyGia);

  let tienNt4 = 0;
  let tien4 = 0;
  let tienNt2 = tienNt9;
  let tien2 = tien9;
  let giaNt2 = giaNt9;
  let gia2 = gia9;

  if (chietKhau > 0) {
    tienNt4 = isVnd
      ? Math.round((tienNt9 * chietKhau) / 100.0)
      : round((tienNt9 * chietKhau) / 100.0, 2);
    tien4 = Math.round((tien9 * chietKhau) / 100.0);
    tienNt2 = isVnd
      ? Math.round(tienNt9 - tienNt4)
      : round(tienNt9 - tienNt4, 2);
    tien2 = Math.round(tien9 - tien4);
    giaNt2 = round((giaNt9 * (100.0 - chietKhau)) / 100.0, 2);
    gia2 = Math.round((gia9 * (100.0 - chietKhau)) / 100.0);
  } else {
    tienNt4 = 0;
    tien4 = 0;
    tienNt2 = tienNt9;
    tien2 = tien9;
    giaNt2 = giaNt9;
    gia2 = gia9;
  }

  // Return new object with calculated values (Fix #21: Preserve existing COGS if present)
  return {
    ...item,
    so_tam: soTam,
    he_so8: heSo8,
    so_luong8: soLuong8,
    he_so9: heSo9,
    so_luong9: soLuong9,
    so_luong: soLuong,
    gia_nt9: giaNt9,
    gia9: gia9,
    tien_nt9: tienNt9,
    tien9: tien9,
    chiet_khau: chietKhau,
    tien_nt4: tienNt4,
    tien4: tien4,
    tien_nt2: tienNt2,
    tien2: tien2,
    gia_nt2: giaNt2,
    gia2: gia2,
    gia_tb_tt: defaultGiaTbTt ?? (item.gia_tb_tt === "K" ? "K" : "C"),
  };
}

export function calcVoucherTotals(
  items: VoucherDetail[],
  tyGia: number = 1.0,
  thueGtgt: number = 0,
  loaiCk: string = "2",
): CalculatedTotals {
  const safeTyGia = tyGia > 0 ? tyGia : 1.0;

  let rawNt = 0;
  let rawNt4 = 0;
  let rawNt2 = 0;
  let ttien = 0;
  let ttien4 = 0;
  let ttien2 = 0;
  let totalQty = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    rawNt += it.tien_nt9 || 0;
    rawNt4 += it.tien_nt4 || 0;
    rawNt2 += it.tien_nt2 || 0;
    ttien += Math.round(it.tien9 || 0);
    ttien4 += Math.round(it.tien4 || 0);
    ttien2 += Math.round(it.tien2 || 0);
    totalQty += Number(it.so_luong9 || 0);
  }

  const ttien_nt = round(rawNt, 2);
  const ttien_nt4 = round(rawNt4, 2);
  const ttien_nt2 = round(rawNt2, 2);

  // VAT Calculation
  let ttien_nt3 = 0;
  if (loaiCk === "1") {
    // Discount before tax
    ttien_nt3 = round((ttien_nt2 * thueGtgt) / 100.0, 2);
  } else {
    // Discount after tax
    ttien_nt3 = round((ttien_nt * thueGtgt) / 100.0, 2);
  }
  const ttien3 = Math.round(ttien_nt3 * safeTyGia);

  // ULTIMATE INVARIANT: TTien_Nt0 = TTien_Nt2 + TTien_Nt3
  const ttien_nt0 = round(ttien_nt2 + ttien_nt3, 2);
  const ttien0 = ttien2 + ttien3;

  return {
    ttien_nt,
    ttien_nt4,
    ttien_nt2,
    ttien_nt3,
    ttien_nt0,
    ttien,
    ttien4,
    ttien2,
    ttien3,
    ttien0,
    totalQty: round(totalQty, 2),
  };
}
