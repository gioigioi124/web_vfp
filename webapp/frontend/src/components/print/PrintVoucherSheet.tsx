import React from "react";
import { formatDate } from "../../lib/format";
import { formatQtyNum, formatVfpNum } from "./printUtils";

export interface PrintVoucherSheetProps {
  printData: any;
  renderIdx: number;
  effectiveInGia: "1" | "0";
  effectiveInNoCk: "C" | "K";
}

export const PrintVoucherSheet: React.FC<PrintVoucherSheetProps> = React.memo(
  ({ printData, renderIdx, effectiveInGia, effectiveInNoCk }) => {
    const header = printData?.header || {};
    const company = printData?.company || {};
    const items = printData?.items || [];
    const maCt = (header.ma_ct || "X1").toString().trim().toUpperCase();
    const isN5 = maCt === "N5";
    const showPrice = effectiveInGia === "1";
    const showNoCu = (printData?.in_no_ck || effectiveInNoCk) === "C";
    const currency = (header.ma_tte || "VND").toUpperCase();
    const tongTien =
      currency === "VND"
        ? (header.ttien2 ?? header.ttien_nt2 ?? 0)
        : (header.ttien_nt2 ?? 0);

    // Tách dòng hàng cuối cùng ra nhóm riêng cùng khối Tổng cộng + Chữ ký:
    // nếu trang 1 không đủ chỗ cho cả hàng hóa + đuôi ký, dòng hàng cuối sẽ được kéo sang trang cuối cùng với đuôi ký.
    const leadingItems = items.length > 1 ? items.slice(0, -1) : [];
    const lastItem = items.length > 0 ? items[items.length - 1] : null;

    const renderItemRow = (it: any, idx: number) => {
      const loaiVt = (it.loai_vt || "").toString().trim();
      const isMut = loaiVt === "2" || loaiVt === "3";
      const ck = Number(it.chiet_khau || 0);
      return (
        <tr
          key={it.stt0 || idx}
          className="align-middle break-inside-avoid"
          style={{
            borderBottom: "1px dashed #000",
            fontSize: "12pt",
            lineHeight: 1.15,
          }}
        >
          <td
            className="text-center align-middle"
            style={{
              borderLeft: "2px solid #000",
              borderRight: "1px solid #000",
              padding: "4px 2px",
            }}
          >
            {it.line_no || idx + 1}
          </td>
          <td
            className="text-left align-middle font-bold break-words"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {it.ten_vt || it.ma_vt || ""}
          </td>
          <td
            className="text-center align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 2px",
            }}
          >
            {it.dvt || ""}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {formatQtyNum(it.he_so_in ?? it.he_so8)}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {formatQtyNum(
              it.so_luong_in ?? (isMut ? it.so_tam : it.so_luong9),
            )}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {showPrice ? formatVfpNum(it.gia_nt9, 0) : ""}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {showPrice ? formatVfpNum(it.tien_nt9, 0) : ""}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "1px solid #000",
              padding: "4px 4px",
            }}
          >
            {showPrice && ck > 0 ? `${Math.round(ck)}%` : ""}
          </td>
          <td
            className="text-right align-middle"
            style={{
              borderRight: "2px solid #000",
              padding: "4px 4px",
            }}
          >
            {showPrice ? formatVfpNum(it.tien_nt2, 0) : ""}
          </td>
        </tr>
      );
    };

    return (
      <div className={renderIdx > 0 ? "print-doc-page-break" : undefined}>
        {/* Dùng 1 bảng thống nhất có thead lặp lại Page Header + Tiêu đề 9 cột khi qua trang */}
        <table
          className="w-full border-collapse print-page-table"
          style={{
            tableLayout: "fixed",
            fontSize: "12pt",
          }}
        >
          <colgroup>
            <col style={{ width: "6.01%" }} />
            <col style={{ width: "28.84%" }} />
            <col style={{ width: "5.34%" }} />
            <col style={{ width: "8.28%" }} />
            <col style={{ width: "8.54%" }} />
            <col style={{ width: "12.28%" }} />
            <col style={{ width: "12.28%" }} />
            <col style={{ width: "5.87%" }} />
            <col style={{ width: "12.55%" }} />
          </colgroup>

          <thead>
            {/* Hàng đầu trang: Logo ngang + Thông tin công ty + Tiêu đề + Thông tin phiếu + Khách hàng */}
            <tr>
              <th
                colSpan={9}
                className="p-0 pb-1 text-left font-normal align-top"
                style={{ border: "none" }}
              >
                {/* ===== KHỐI ĐẦU TRANG CÔNG TY (theo HD2259 Template.pdf) ===== */}
                <div
                  className="flex items-center pb-2"
                  style={{ borderBottom: "1px solid #cccccc" }}
                >
                  <img
                    src="/logo-elan.png"
                    alt="ELAN"
                    className="shrink-0 block"
                    style={{
                      width: "284px",
                      height: "48px",
                      objectFit: "contain",
                    }}
                  />

                  <div
                    className="flex-1 text-left"
                    style={{ paddingLeft: "10px", color: "#111111" }}
                  >
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "13pt", lineHeight: 1.2 }}
                    >
                      {company.ten_dvcs ||
                        "CÔNG TY TNHH CHĂN GA GỐI ĐỆM ELAN"}
                    </div>
                    <div
                      className="font-normal"
                      style={{
                        fontSize: "10pt",
                        lineHeight: 1.25,
                        marginTop: "2px",
                      }}
                    >
                      Địa chỉ:{" "}
                      {company.dia_chi ||
                        "Số 227 - Quốc lộ 17B - Phường An Dương - Hải Phòng"}
                    </div>
                    <div
                      className="font-normal"
                      style={{ fontSize: "10pt", lineHeight: 1.25 }}
                    >
                      SĐT: {company.dien_thoai || "(+84) 2253 914 242"} | MST:{" "}
                      {company.mst || "0200727018"}
                    </div>
                    {header.ten_bp && (
                      <div
                        className="font-normal"
                        style={{ fontSize: "10pt", lineHeight: 1.25 }}
                      >
                        {header.ten_bp}
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== TIÊU ĐỀ PHIẾU & DÒNG SỐ PHIẾU / NGÀY / SỐ XE ===== */}
                <div className="text-center" style={{ marginTop: "5px" }}>
                  <div
                    className="font-bold uppercase"
                    style={{ fontSize: "17.5pt", lineHeight: 1.15 }}
                  >
                    {printData?.title || "PHIẾU XUẤT BÁN"}
                  </div>
                  <div
                    className="font-bold"
                    style={{
                      fontSize: "12.5pt",
                      lineHeight: 1.25,
                      marginTop: "3px",
                      marginBottom: "6px",
                    }}
                  >
                    Số phiếu: {header.so_ct || ""} | Ngày:{" "}
                    {formatDate(header.ngay_ct)} | Số xe:{" "}
                    {header.ma_xe || ""}
                  </div>
                </div>

                {/* ===== THÔNG TIN KHÁCH HÀNG (3 DÒNG TÁCH BIỆT, THOÁNG NHƯ MẪU NHƯNG VẪN ĐỦ GỌN ĐỂ LẶP SANG TRANG 2) ===== */}
                <div
                  className="font-bold"
                  style={{ fontSize: "12.5pt", lineHeight: "21px" }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex-1">
                      Khách hàng:{" "}
                      <span className="uppercase">
                        {header.ten_dt || header.ma_dt || ""}
                      </span>
                    </div>
                    <div className="shrink-0" style={{ minWidth: "85px" }}>
                      Điện thoại: {printData?.customer_phone || ""}
                    </div>
                  </div>
                  <div>
                    Địa chỉ:{" "}
                    {printData?.customer_address || header.dia_chi || ""}
                  </div>
                  <div>Diễn giải: {header.dien_giai0 || ""}</div>
                </div>
              </th>
            </tr>

            {/* Hàng tiêu đề 1 của bảng 9 cột */}
            <tr
              style={{
                height: "24px",
                borderTop: "2px solid #000",
                borderBottom: "1px solid #000",
                fontSize: "12pt",
              }}
            >
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{
                  borderLeft: "2px solid #000",
                  borderRight: "1px solid #000",
                }}
              >
                STT
              </th>
              <th
                className="px-1 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                Loại hàng
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                ĐVT
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                Cm(Kg)
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                S.Lượng
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                Đơn giá
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                Thành tiền
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "1px solid #000" }}
              >
                CK
              </th>
              <th
                className="px-0.5 text-center font-bold align-middle whitespace-nowrap"
                style={{ borderRight: "2px solid #000" }}
              >
                Thanh toán
              </th>
            </tr>

            {/* Hàng tiêu đề 2 (A, B, C, 1..6) */}
            <tr
              style={{
                height: "20px",
                borderBottom: "2px solid #000",
                fontSize: "11pt",
              }}
            >
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{
                  borderLeft: "2px solid #000",
                  borderRight: "1px solid #000",
                }}
              >
                A
              </th>
              <th
                className="px-1 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                B
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                C
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                1
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                2
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                3
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                4=3x2x1
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "1px solid #000" }}
              >
                5
              </th>
              <th
                className="px-0.5 text-center italic font-normal align-middle"
                style={{ borderRight: "2px solid #000" }}
              >
                {header.loai_ck === "2" || !header.loai_ck ? "6=4-(4x5)" : "6"}
              </th>
            </tr>
          </thead>

          {/* Các dòng hàng 1 .. N-1 (được phép ngắt trang tự nhiên giữa các dòng) */}
          {leadingItems.length > 0 && (
            <tbody>
              {leadingItems.map((it: any, idx: number) =>
                renderItemRow(it, idx),
              )}
            </tbody>
          )}

          {/* Nhóm bất khả tách (break-inside: avoid):
              Gắn liền dòng hàng cuối cùng (N) với khối Tổng cộng + Bằng chữ + 4 cột chữ ký */}
          <tbody className="print-keep-with-last">
            {lastItem && renderItemRow(lastItem, items.length - 1)}

            {/* Hộp Tổng cộng đóng khung liền đáy bảng */}
            <tr>
              <td
                colSpan={9}
                className="p-0"
                style={{
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  borderLeft: "2px solid #000",
                  borderRight: "2px solid #000",
                }}
              >
                <div
                  className="flex items-center justify-between font-bold"
                  style={{
                    height: "26px",
                    padding: "0 4px 0 6px",
                    fontSize: "12pt",
                  }}
                >
                  <div>
                    Tổng cộng {formatQtyNum(printData?.tso_loai) || "0"} thứ
                  </div>

                  <div className="flex items-center gap-6">
                    <span>Tổng tiền</span>
                    <span
                      className="text-right"
                      style={{ minWidth: "90px" }}
                    >
                      {showPrice ? formatVfpNum(tongTien, 0) : ""}
                    </span>
                  </div>
                </div>
              </td>
            </tr>

            {/* Bằng chữ, khối Nợ cũ / Tổng nợ (khi In nợ cũ = 'C') & 4 cột chữ ký */}
            <tr>
              <td colSpan={9} className="p-0" style={{ border: "none" }}>
                {showNoCu && (
                  <div
                    className="flex flex-col items-end font-bold pr-1 mt-2 leading-snug"
                    style={{ fontSize: "12pt" }}
                  >
                    <div className="flex items-baseline gap-6">
                      <span>Nợ cũ:</span>
                      <span
                        className="text-right"
                        style={{ minWidth: "90px" }}
                      >
                        {formatVfpNum(printData?.du_dau, 0)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-6">
                      <span>Tổng nợ:</span>
                      <span
                        className="text-right"
                        style={{ minWidth: "90px" }}
                      >
                        {formatVfpNum(printData?.tong_no, 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bằng chữ */}
                <div
                  style={{
                    marginTop: "12mm",
                    fontSize: "13pt",
                    lineHeight: 1.35,
                  }}
                >
                  <span className="font-bold">Bằng chữ:</span>{" "}
                  <span>
                    {showPrice ? printData?.tong_tien_chu || "" : ""}
                  </span>
                </div>

                {/* 4 cột chữ ký */}
                <div
                  className="grid grid-cols-4 text-center"
                  style={{ marginTop: "6mm" }}
                >
                  <div>
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "12pt", lineHeight: 1.3 }}
                    >
                      CHỦ HÀNG
                    </div>
                    <div
                      className="italic font-normal"
                      style={{ fontSize: "10pt", lineHeight: 1.3 }}
                    >
                      (Ký, họ tên)
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "12pt", lineHeight: 1.3 }}
                    >
                      NGƯỜI LẬP
                    </div>
                    <div
                      className="italic font-normal"
                      style={{ fontSize: "10pt", lineHeight: 1.3 }}
                    >
                      (Ký, họ tên)
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "12pt", lineHeight: 1.3 }}
                    >
                      {isN5 ? "KIỂM HÀNG" : "LÁI XE"}
                    </div>
                    <div
                      className="italic font-normal"
                      style={{ fontSize: "10pt", lineHeight: 1.3 }}
                    >
                      (Ký, họ tên)
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "12pt", lineHeight: 1.3 }}
                    >
                      NGƯỜI GIAO HÀNG
                    </div>
                    <div
                      className="italic font-normal"
                      style={{ fontSize: "10pt", lineHeight: 1.3 }}
                    >
                      (Ký, họ tên)
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>

          {/* Đệm đáy lặp lại ở cuối mỗi trang in (tạo khoảng thoáng bottom cho chân trang cố định) */}
          <tfoot>
            <tr>
              <td
                colSpan={9}
                style={{ height: "10mm", border: "none", padding: 0 }}
              />
            </tr>
          </tfoot>
        </table>

        {/* Chân trang góc dưới bên phải */}
        <div
          className={`print-page-footer text-right mt-8 ${renderIdx > 0 ? "print:hidden" : ""}`}
          style={{ fontSize: "11pt", fontWeight: 400 }}
        >
          Thời gian in:{" "}
          {printData?.print_time_str || printData?.sql_time || ""} | Trang: 1 /
          1
        </div>
      </div>
    );
  },
);

PrintVoucherSheet.displayName = "PrintVoucherSheet";
