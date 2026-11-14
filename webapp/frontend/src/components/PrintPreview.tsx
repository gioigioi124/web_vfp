import React, { useState, useEffect, useRef } from "react";
import { Printer, X, RefreshCw } from "lucide-react";
import { formatDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  stt?: string;
  stts?: string[];
  /** "1" = In giá bán, "0" = Không in giá (lấy từ thanh đáy VoucherList hoặc phím tắt in nhanh) */
  inGia?: "1" | "0";
  /** Số bản copy cần in cho mỗi phiếu (mặc định 1; Alt/Ctrl + Numpad3/4 dùng 3 hoặc 4) */
  copies?: number;
  /** "direct": in thẳng bằng hộp thoại trình duyệt (F7); "preview": hiện dialog chọn In nợ cũ & xem trước (Ctrl+F7) */
  mode?: "direct" | "preview";
}

/**
 * Định dạng số theo chuẩn VFP `@Z` (giá trị 0 hiển thị trống, phân nhóm nghìn bằng dấu cách).
 */
function formatVfpNum(
  value?: number | null,
  decimals: number = 0,
): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  if (Math.abs(value) < 1e-9) return "";
  const neg = value < 0;
  const absVal = Math.abs(value);
  const fixed =
    decimals > 0
      ? absVal.toFixed(decimals)
      : Math.round(absVal).toString();
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `.${decPart}` : ""}`;
}

/** Định dạng tổng số thứ giống `alltrim(str(m.TSo_Loai)) + ' thứ'` của VFP. */
function formatTsoLoai(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return Math.round(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  const [intPart, decPart] = rounded.toString().split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}.${decPart}`;
}

/**
 * Thành phần chuẩn bị bản in (RPT\ctpxg.frx / RPT\ctpng.frx):
 * - mode="direct" (F7): gọi thẳng hộp thoại in của trình duyệt (in_no_ck="K"), tự đóng khi afterprint.
 * - mode="preview" (Ctrl+F7): mở dialog xem trước có tùy chọn "In nợ cũ" (in_no_ck="C"/"K") trước khi bấm In.
 */
export const PrintPreview: React.FC<PrintPreviewProps> = ({
  isOpen,
  onClose,
  stt,
  stts,
  inGia = "1",
  copies = 1,
  mode = "direct",
}) => {
  const isPreviewMode = mode === "preview";
  const [printDocs, setPrintDocs] = useState<any[]>([]);
  const [loadedKey, setLoadedKey] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [previewInNoCk, setPreviewInNoCk] = useState<"C" | "K">("K");
  const [previewInGia, setPreviewInGia] = useState<"1" | "0">(inGia);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const printedKeyRef = useRef<string>("");
  const wasOpenRef = useRef<boolean>(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useModalLock(isOpen && isPreviewMode, dialogRef);

  // Khi mở dialog Ctrl+F7 mới, đồng bộ tùy chọn giá từ toolbar và reset In nợ cũ về mặc định ("K")
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setPreviewInNoCk("K");
      setPreviewInGia(inGia);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, inGia]);

  const effectiveInGia: "1" | "0" = isPreviewMode ? previewInGia : inGia;
  const effectiveInNoCk: "C" | "K" = isPreviewMode ? previewInNoCk : "K";

  const targetStts =
    stts && stts.length > 0 ? stts : stt ? [stt] : [];
  const joinedStts = targetStts.join(",");
  const safeCopies = Math.max(1, Math.floor(copies || 1));
  const requestKey =
    isOpen && joinedStts
      ? `${joinedStts}|${effectiveInGia}|${effectiveInNoCk}|${safeCopies}`
      : "";

  useEffect(() => {
    if (!isOpen || targetStts.length === 0) {
      setPrintDocs([]);
      setLoadedKey("");
      setIsFetching(false);
      printedKeyRef.current = "";
      return;
    }

    let cancelled = false;
    const targetKey = `${joinedStts}|${effectiveInGia}|${effectiveInNoCk}|${safeCopies}`;

    const fetchPrintAll = async () => {
      setIsFetching(true);
      try {
        const payloads = await Promise.all(
          targetStts.map(async (s) => {
            const res = await fetch(
              `/api/print/${encodeURIComponent(s)}?loai=hd&in_gia=${effectiveInGia}&in_no_ck=${effectiveInNoCk}`,
            );
            const json = await res.json();
            return json?.success && json.data ? json.data : null;
          }),
        );
        const validDocs = payloads.filter(Boolean);
        if (!cancelled && validDocs.length > 0) {
          setPrintDocs(validDocs);
          setLoadedKey(targetKey);
        } else if (!cancelled && !isPreviewMode) {
          onCloseRef.current();
        }
      } catch (e) {
        console.error("Error fetching print payloads", e);
        if (!cancelled && !isPreviewMode) onCloseRef.current();
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    void fetchPrintAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    joinedStts,
    effectiveInGia,
    effectiveInNoCk,
    safeCopies,
    isPreviewMode,
  ]);

  // Chế độ in thẳng (F7): tự động gọi window.print() sau khi nạp xong dữ liệu + ảnh và đóng khi afterprint.
  useEffect(() => {
    if (
      isPreviewMode ||
      !isOpen ||
      !requestKey ||
      loadedKey !== requestKey ||
      printDocs.length === 0
    ) {
      return;
    }
    if (printedKeyRef.current === requestKey) return;

    let cancelled = false;
    let printTimer: number | null = null;
    let rafId: number | null = null;

    const handleAfterPrint = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      if (!cancelled) {
        onCloseRef.current();
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);

    const triggerPrint = () => {
      if (cancelled || printedKeyRef.current === requestKey) return;
      printedKeyRef.current = requestKey;
      rafId = window.requestAnimationFrame(() => {
        printTimer = window.setTimeout(() => {
          if (!cancelled) {
            window.print();
          }
        }, 30);
      });
    };

    const imgs = Array.from(
      printAreaRef.current?.querySelectorAll("img") ?? [],
    ).filter((img) => !img.complete);

    if (imgs.length > 0) {
      let settled = false;
      let remaining = imgs.length;
      const done = () => {
        if (settled) return;
        settled = true;
        triggerPrint();
      };
      const onOne = () => {
        remaining -= 1;
        if (remaining <= 0) done();
      };
      imgs.forEach((img) => {
        img.addEventListener("load", onOne, { once: true });
        img.addEventListener("error", onOne, { once: true });
      });
      const fallbackTimer = window.setTimeout(done, 500);
      return () => {
        cancelled = true;
        window.clearTimeout(fallbackTimer);
        imgs.forEach((img) => {
          img.removeEventListener("load", onOne);
          img.removeEventListener("error", onOne);
        });
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        if (printTimer !== null) window.clearTimeout(printTimer);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }

    triggerPrint();
    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (printTimer !== null) window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPreviewMode, isOpen, requestKey, loadedKey, printDocs]);

  const handleManualPrint = () => {
    if (isFetching || printDocs.length === 0) return;
    window.print();
  };

  // Phím tắt trong dialog Xem trước (Ctrl+F7): Esc để đóng, F7 hoặc Enter để In phiếu.
  useEffect(() => {
    if (!isOpen || !isPreviewMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "F7") {
        e.preventDefault();
        e.stopPropagation();
        if (!isFetching && printDocs.length > 0) {
          window.print();
        }
      } else if (e.key === "Enter" && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement;
        if (
          active instanceof HTMLButtonElement &&
          active.dataset.previewAction === "close"
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (!isFetching && printDocs.length > 0) {
          window.print();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, isPreviewMode, isFetching, printDocs.length]);

  if (!isOpen) {
    return null;
  }

  if (!isPreviewMode && (printDocs.length === 0 || loadedKey !== requestKey)) {
    return null;
  }

  const renderVoucherDoc = (
    printData: any,
    renderIdx: number,
    copySuffix: string,
  ) => {
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
          className="align-top break-inside-avoid"
          style={{
            borderBottom: "1px dotted #000",
          }}
        >
          <td
            className="py-1 px-0.5 text-center tabular-nums"
            style={{
              borderLeft: "2px solid #000",
              borderRight: "1px solid #000",
            }}
          >
            {it.line_no || idx + 1}
          </td>
          <td
            className="py-1 px-1 text-left font-bold break-words"
            style={{ borderRight: "1px solid #000" }}
          >
            {it.ten_vt || it.ma_vt || ""}
          </td>
          <td
            className="py-1 px-0.5 text-center"
            style={{
              borderRight: "1px solid #000",
              fontSize: "10.5pt",
            }}
          >
            {it.dvt || ""}
          </td>
          <td
            className="py-1 px-1 text-right tabular-nums"
            style={{ borderRight: "1px solid #000" }}
          >
            {isMut ? formatVfpNum(it.he_so_in, 2) : ""}
          </td>
          <td
            className="py-1 px-1 text-right tabular-nums"
            style={{ borderRight: "1px solid #000" }}
          >
            {formatVfpNum(
              it.so_luong_in ?? (isMut ? it.so_tam : it.so_luong9),
              isN5 ? 0 : 2,
            )}
          </td>
          <td
            className="py-1 px-1 text-right tabular-nums"
            style={{ borderRight: "1px solid #000" }}
          >
            {showPrice ? formatVfpNum(it.gia_nt9, 0) : ""}
          </td>
          <td
            className="py-1 px-1 text-right tabular-nums"
            style={{ borderRight: "1px solid #000" }}
          >
            {showPrice ? formatVfpNum(it.tien_nt9, 0) : ""}
          </td>
          <td
            className="py-1 px-0.5 text-left tabular-nums"
            style={{ borderRight: "1px solid #000" }}
          >
            {showPrice && ck > 0 ? `${Math.round(ck)}%` : ""}
          </td>
          <td
            className="py-1 px-1 text-right tabular-nums"
            style={{ borderRight: "2px solid #000" }}
          >
            {showPrice ? formatVfpNum(it.tien_nt2, 0) : ""}
          </td>
        </tr>
      );
    };

    return (
      <div
        key={`${header.stt || renderIdx}-${copySuffix}`}
        className={renderIdx > 0 ? "print-doc-page-break" : undefined}
      >
        {/* Dùng 1 bảng thống nhất có thead lặp lại Page Header + Tiêu đề 9 cột khi qua trang */}
        <table
          className="w-full border-collapse print-page-table"
          style={{
            tableLayout: "fixed",
            fontSize: "11.5pt",
          }}
        >
          <colgroup>
            <col style={{ width: "4.19%" }} />
            <col style={{ width: "30.54%" }} />
            <col style={{ width: "5.81%" }} />
            <col style={{ width: "7.43%" }} />
            <col style={{ width: "7.57%" }} />
            <col style={{ width: "12.30%" }} />
            <col style={{ width: "13.51%" }} />
            <col style={{ width: "4.32%" }} />
            <col style={{ width: "14.32%" }} />
          </colgroup>

          <thead>
            {/* Hàng đầu trang: Logo + Công ty + Tiêu đề + Hộp chứng từ + Khách hàng (tự lặp ở trang 2+) */}
            <tr>
              <th
                colSpan={9}
                className="p-0 pb-1.5 text-left font-normal align-top"
                style={{ border: "none" }}
              >
                {/* ===== PHẦN ĐẦU TRANG (Page Header theo RPT\ctpxg.frx) ===== */}
                <div className="flex items-start gap-2 mb-1">
                  {/* Logo công ty (41.5 x 22.5 mm) */}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: "41.5mm", height: "22.5mm" }}
                  >
                    <img
                      src="/logo.jpg"
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Tên công ty, ĐT/Fax, Tên bộ phận */}
                  <div className="flex-1 text-center leading-tight pt-0.5">
                    <div
                      className="font-bold uppercase tracking-tight"
                      style={{ fontSize: "15.5pt", lineHeight: 1.15 }}
                    >
                      {company.ten_dvcs || "Công ty chăn ga gối đệm Elan"}
                    </div>
                    <div
                      className="font-normal"
                      style={{ fontSize: "11.5pt", lineHeight: 1.25 }}
                    >
                      Điện thoại: {company.dien_thoai || "84-31.3.914.242"} -
                      Fax: {company.fax || "84-31.3.914.247"}
                    </div>
                    {header.ten_bp && (
                      <div
                        className="font-normal"
                        style={{ fontSize: "11.5pt", lineHeight: 1.25 }}
                      >
                        {header.ten_bp}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tiêu đề phiếu, Số xe & Hộp Ngày / Số phiếu / SQLTime góc phải */}
                <div className="flex items-start justify-between gap-2 mt-1 mb-1">
                  <div style={{ width: "41.5mm" }} className="shrink-0" />

                  <div className="flex-1 text-center leading-tight pt-1">
                    <div
                      className="font-bold uppercase"
                      style={{ fontSize: "19pt", lineHeight: 1.1 }}
                    >
                      {printData?.title || "Phiếu xuất bán"}
                    </div>
                    <div
                      className="font-bold mt-0.5"
                      style={{ fontSize: "11.5pt", lineHeight: 1.2 }}
                    >
                      Số xe: {header.ma_xe || ""}
                    </div>
                  </div>

                  {/* Khung hộp góc phải (viền 1px solid #000) */}
                  <div
                    className="shrink-0 px-1.5 py-0.5 leading-tight font-normal"
                    style={{
                      minWidth: "43mm",
                      border: "1px solid #000",
                      fontSize: "11.5pt",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>Ngày:</span>
                      <span>{formatDate(header.ngay_ct)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>Số phiếu:</span>
                      <span>{header.so_ct || ""}</span>
                    </div>
                    <div className="text-center italic font-normal mt-0.5">
                      {printData?.sql_time || ""}
                    </div>
                  </div>
                </div>

                {/* Thông tin khách hàng */}
                <div
                  className="leading-snug font-bold"
                  style={{ fontSize: "11.5pt" }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0" style={{ minWidth: "24mm" }}>
                      Khách hàng:
                    </span>
                    <span className="flex-1">
                      <span className="uppercase">
                        {header.ten_dt || header.ma_dt || ""}
                      </span>
                      {header.dien_giai0 ? ` (${header.dien_giai0})` : ""}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0" style={{ minWidth: "24mm" }}>
                      Địa chỉ:
                    </span>
                    <span className="flex-1">
                      {printData?.customer_address || ""}
                    </span>
                    <span className="shrink-0 ml-2">Điện thoại:</span>
                    <span className="shrink-0" style={{ minWidth: "32mm" }}>
                      {printData?.customer_phone || ""}
                    </span>
                  </div>
                </div>
              </th>
            </tr>

            {/* Hàng tiêu đề 1 của bảng 9 cột */}
            <tr
              style={{
                borderTop: "2px solid #000",
                borderBottom: "1px solid #000",
                fontSize: "10.5pt",
              }}
            >
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{
                  borderLeft: "2px solid #000",
                  borderRight: "1px solid #000",
                }}
              >
                STT
              </th>
              <th
                className="py-1 px-1 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                Loại hàng
              </th>
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                ĐVT
              </th>
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                Cm(Kg)
              </th>
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                S.Lượng
              </th>
              <th
                className="py-1 px-1 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                Đơn giá
              </th>
              <th
                className="py-1 px-1 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                Thành tiền
              </th>
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{ borderRight: "1px solid #000" }}
              >
                CK
              </th>
              <th
                className="py-1 px-0.5 text-center font-bold"
                style={{ borderRight: "2px solid #000" }}
              >
                Thanh toán
              </th>
            </tr>

            {/* Hàng tiêu đề 2 (A, B, C, 1..6) */}
            <tr
              style={{
                borderBottom: "2px solid #000",
                fontSize: "11pt",
              }}
            >
              <th
                className="py-0.5 px-0.5 text-center font-normal"
                style={{
                  borderLeft: "2px solid #000",
                  borderRight: "1px solid #000",
                }}
              >
                A
              </th>
              <th
                className="py-0.5 px-1 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                B
              </th>
              <th
                className="py-0.5 px-0.5 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                C
              </th>
              <th
                className="py-0.5 px-0.5 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                1
              </th>
              <th
                className="py-0.5 px-0.5 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                2
              </th>
              <th
                className="py-0.5 px-1 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                3
              </th>
              <th
                className="py-0.5 px-1 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                4=3x2x1
              </th>
              <th
                className="py-0.5 px-0.5 text-center font-normal"
                style={{ borderRight: "1px solid #000" }}
              >
                5
              </th>
              <th
                className="py-0.5 px-0.5 text-center font-normal"
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
                  className="flex items-baseline justify-between font-bold px-2 py-1"
                  style={{ fontSize: "11.5pt" }}
                >
                  <div className="flex items-baseline gap-3 pl-[10mm]">
                    <span>Tổng cộng</span>
                    <span style={{ fontSize: "13.5pt" }}>
                      {formatTsoLoai(printData?.tso_loai)} thứ
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span>Tổng tiền</span>
                    <span
                      className="text-right tabular-nums"
                      style={{ minWidth: "36mm", fontSize: "12pt" }}
                    >
                      {showPrice ? formatVfpNum(tongTien, 0) : ""}
                    </span>
                  </div>
                </div>
              </td>
            </tr>

            {/* Bằng chữ, khối Nợ cũ / Tổng nợ (khi In nợ cũ = 'C') & 4 cột chữ ký */}
            <tr>
              <td colSpan={9} className="p-0 pt-1" style={{ border: "none" }}>
                {showNoCu && (
                  <div
                    className="flex flex-col items-end font-bold pr-2 mt-0.5 leading-snug"
                    style={{ fontSize: "12pt" }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span>Nợ cũ:</span>
                      <span
                        className="text-right tabular-nums"
                        style={{ minWidth: "36mm" }}
                      >
                        {formatVfpNum(printData?.du_dau, 0)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span>Tổng nợ:</span>
                      <span
                        className="text-right tabular-nums"
                        style={{ minWidth: "36mm" }}
                      >
                        {formatVfpNum(printData?.tong_no, 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bằng chữ */}
                <div
                  className="flex items-baseline gap-2 mt-1.5"
                  style={{ fontSize: "13pt" }}
                >
                  <span className="shrink-0 pl-[3mm]">Bằng chữ :</span>
                  <span className="flex-1">
                    {showPrice ? printData?.tong_tien_chu || "" : ""}
                  </span>
                </div>

                {/* 4 cột chữ ký */}
                <div
                  className="grid grid-cols-4 text-center mt-4"
                  style={{ fontSize: "11pt" }}
                >
                  <div>
                    <div className="font-bold uppercase">CHỦ HÀNG</div>
                    <div className="italic" style={{ fontSize: "10.5pt" }}>
                      (Ký &amp; ghi rõ họ tên)
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">NGƯỜI LẬP</div>
                    <div className="italic" style={{ fontSize: "10.5pt" }}>
                      (Ký &amp; ghi rõ họ tên)
                    </div>
                    <div
                      className="mt-12 font-normal uppercase"
                      style={{ fontSize: "10pt" }}
                    >
                      {header.user_name || printData?.creator_name || ""}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">
                      {isN5 ? "KIỂM HÀNG" : "LÁI XE"}
                    </div>
                    <div className="italic" style={{ fontSize: "10.5pt" }}>
                      (Ký &amp; ghi rõ họ tên)
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">NGƯỜI GIAO HÀNG</div>
                    <div className="italic" style={{ fontSize: "10.5pt" }}>
                      (Ký &amp; ghi rõ họ tên)
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>

          {/* Đệm đáy lặp lại ở cuối mỗi trang in (tạo khoảng thoáng bottom mà không kích hoạt link URL của trình duyệt) */}
          <tfoot>
            <tr>
              <td
                colSpan={9}
                style={{ height: "10mm", border: "none", padding: 0 }}
              />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const expandedDocs = printDocs.flatMap((doc, docIdx) =>
    Array.from({ length: safeCopies }, (_, copyIdx) => ({
      doc,
      keySuffix: `d${docIdx}-c${copyIdx}`,
    })),
  );

  if (isPreviewMode) {
    return (
      <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print-preview-root">
        <div
          ref={dialogRef}
          className="bg-neutral-200 rounded shadow-2xl border border-neutral-400 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden print-preview-scroll"
          role="dialog"
          aria-modal="true"
          aria-label="Xem trước khi in"
        >
          {/* Header Toolbar */}
          <div className="bg-primary-900 text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary-200" />
              <span className="font-bold text-xs sm:text-sm tracking-wide">
                Xem Trước Khi In (Ctrl+F7)
              </span>
              {targetStts.length > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-primary-700 text-[11px] font-semibold">
                  {targetStts.length} phiếu
                </span>
              )}
              {isFetching && (
                <span className="inline-flex items-center gap-1 text-[11px] text-primary-200">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Đang tải...
                </span>
              )}
            </div>

            {/* Tùy chọn In nợ cũ & In giá bán */}
            <div className="flex items-center flex-wrap gap-2">
              <label
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 cursor-pointer select-none text-xs font-semibold"
                title="Bấm Space hoặc click để bật/tắt In nợ cũ"
              >
                <input
                  data-autofocus
                  type="checkbox"
                  checked={previewInNoCk === "C"}
                  onChange={(e) =>
                    setPreviewInNoCk(e.target.checked ? "C" : "K")
                  }
                  className="h-3.5 w-3.5 accent-amber-400 cursor-pointer"
                />
                <span>In nợ cũ</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 cursor-pointer select-none text-xs font-medium">
                <input
                  type="checkbox"
                  checked={previewInGia === "1"}
                  onChange={(e) =>
                    setPreviewInGia(e.target.checked ? "1" : "0")
                  }
                  className="h-3.5 w-3.5 accent-primary-300 cursor-pointer"
                />
                <span>In giá bán</span>
              </label>

              <div className="h-4 w-px bg-white/25 mx-0.5" />

              <button
                type="button"
                onClick={handleManualPrint}
                disabled={isFetching || printDocs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded text-xs font-semibold border border-primary-400 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In phiếu</span>
                <kbd className="bg-primary-900/50 text-primary-100 border-primary-400 text-[10px] px-1">
                  Enter
                </kbd>
              </button>

              <button
                type="button"
                data-preview-action="close"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs font-medium border border-neutral-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Đóng</span>
                <kbd className="bg-neutral-800 text-neutral-200 border-neutral-500 text-[10px] px-1">
                  Esc
                </kbd>
              </button>
            </div>
          </div>

          {/* Paper Preview Body */}
          <div className="flex-1 overflow-auto p-4 bg-neutral-300/80 print-preview-scroll">
            {isFetching && printDocs.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-600">
                Đang chuẩn bị bản xem trước...
              </div>
            ) : printDocs.length === 0 ? (
              <div className="py-16 text-center text-xs text-danger-700 font-medium">
                Không tải được dữ liệu phiếu để xem trước.
              </div>
            ) : (
              <div
                ref={printAreaRef}
                className="print-area mx-auto bg-white text-black shadow-lg border border-neutral-400 p-[6mm] print-preview-sheet"
                style={{
                  width: "210mm",
                  fontFamily: '"Arial Narrow", Arial, sans-serif',
                  color: "#000",
                }}
              >
                {expandedDocs.map((entry, renderIdx) =>
                  renderVoucherDoc(entry.doc, renderIdx, entry.keySuffix),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={printAreaRef}
      className="print-area fixed left-[-9999px] top-0 bg-white text-black opacity-0 pointer-events-none"
      style={{
        width: "198mm",
        fontFamily: '"Arial Narrow", Arial, sans-serif',
        color: "#000",
      }}
      aria-hidden="true"
    >
      {expandedDocs.map((entry, renderIdx) =>
        renderVoucherDoc(entry.doc, renderIdx, entry.keySuffix),
      )}
    </div>
  );
};
