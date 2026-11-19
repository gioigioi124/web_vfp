import React, { useState, useEffect, useRef, useCallback } from "react";
import { Printer, X, RefreshCw } from "lucide-react";
import { formatDate } from "../lib/format";
import { useModalLock } from "../lib/modalLock";
import {
  fetchPrintPayload,
  isPrintPayloadFresh,
  peekPrintPayload,
  preloadPrintLogo,
} from "../lib/printCache";

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onPrintComplete?: () => void;
  onError?: (msg: string) => void;
  stt?: string;
  stts?: string[];
  /** "1" = In giá bán, "0" = Không in giá (lấy từ thanh đáy VoucherList hoặc phím tắt in nhanh) */
  inGia?: "1" | "0";
  /** Số bản copy cần in cho mỗi phiếu (mặc định 1; Alt/Ctrl + Numpad3/4 dùng 3 hoặc 4) */
  copies?: number;
  /** "direct": in thẳng bằng hộp thoại trình duyệt (F7); "preview": hiện dialog chọn In nợ cũ & xem trước (Ctrl+F7) */
  mode?: "direct" | "preview";
  /** Chế độ CSDL: 'sales' (VP_2014) hoặc 'warehouse' (KH_2014) */
  dbMode?: "sales" | "warehouse";
}

/**
 * Định dạng số tiền/giá theo mẫu HD2259 Template (dấu chấm phân tách hàng nghìn, 0 hiển thị trống).
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
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `,${decPart}` : ""}`;
}

/**
 * Định dạng số lượng / hệ số gọn theo mẫu HD2259 Template:
 * bỏ phần `.00` nếu là số nguyên, tối đa 2 chữ số thập phân gọn nếu có lẻ, phân nhóm nghìn bằng dấu chấm.
 */
function formatQtyNum(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  if (Math.abs(value) < 1e-9) return "";
  const neg = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    const groupedInt = Math.round(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${neg ? "-" : ""}${groupedInt}`;
  }
  const fixed = rounded.toFixed(2).replace(/\.?0+$/, "");
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `,${decPart}` : ""}`;
}

/**
 * Thành phần chuẩn bị bản in (RPT\ctpxg.frx / RPT\ctpng.frx):
 * - mode="direct" (F7): gọi thẳng hộp thoại in của trình duyệt (in_no_ck="K"), tự đóng khi afterprint.
 * - mode="preview" (Ctrl+F7): mở dialog xem trước có tùy chọn "In nợ cũ" (in_no_ck="C"/"K") trước khi bấm In.
 */
export const PrintPreview: React.FC<PrintPreviewProps> = ({
  isOpen,
  onClose,
  onPrintComplete,
  onError,
  stt,
  stts,
  inGia = "1",
  copies = 1,
  mode = "direct",
  dbMode = "sales",
}) => {
  const isPreviewMode = mode === "preview";
  const [printDocs, setPrintDocs] = useState<any[]>([]);
  const [loadedKey, setLoadedKey] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [previewInNoCk, setPreviewInNoCk] = useState<"C" | "K">("K");
  const [previewInGia, setPreviewInGia] = useState<"1" | "0">(inGia);
  const [previewCopies, setPreviewCopies] = useState<number>(
    Math.min(4, Math.max(1, Math.floor(copies || 1))),
  );
  const [fitToWidth, setFitToWidth] = useState<boolean>(false);
  const [printingFromPreview, setPrintingFromPreview] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const printedKeyRef = useRef<string>("");
  const wasOpenRef = useRef<boolean>(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onPrintCompleteRef = useRef(onPrintComplete);
  onPrintCompleteRef.current = onPrintComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useModalLock(isOpen && isPreviewMode && !printingFromPreview, dialogRef);

  // Khi mở dialog Ctrl+F7 mới, đồng bộ tùy chọn giá từ toolbar và reset In nợ cũ về mặc định ("K")
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setPreviewInNoCk("K");
      setPreviewInGia(inGia);
      setPreviewCopies(Math.min(4, Math.max(1, Math.floor(copies || 1))));
      setPrintingFromPreview(false);
    } else if (!isOpen) {
      setPrintingFromPreview(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, inGia, copies]);

  const effectiveInGia: "1" | "0" =
    dbMode === "warehouse" ? "0" : isPreviewMode ? previewInGia : inGia;
  const effectiveInNoCk: "C" | "K" = isPreviewMode ? previewInNoCk : "K";

  const targetStts =
    stts && stts.length > 0 ? stts : stt ? [stt] : [];
  const joinedStts = targetStts.join(",");
  const safeCopies = Math.min(
    4,
    Math.max(1, Math.floor((isPreviewMode ? previewCopies : copies) || 1)),
  );
  const requestKey =
    isOpen && joinedStts
      ? `${joinedStts}|${dbMode}|${effectiveInGia}|${effectiveInNoCk}|${safeCopies}`
      : "";

  useEffect(() => {
    preloadPrintLogo();
  }, []);

  useEffect(() => {
    if (!isOpen || targetStts.length === 0) {
      setPrintDocs([]);
      setLoadedKey("");
      setIsFetching(false);
      printedKeyRef.current = "";
      return;
    }

    let cancelled = false;
    const targetKey = `${joinedStts}|${dbMode}|${effectiveInGia}|${effectiveInNoCk}|${safeCopies}`;

    // Kiểm tra cache trước (khớp đúng cả effectiveInGia để không dính cache lệch giá):
    // - Nếu tất cả phiếu đều còn tươi -> nạp ngay lập tức (0ms chờ mạng).
    // - Nếu chế độ Preview có cache cũ -> hiển thị ngay cache cũ trong lúc làm mới ngầm.
    const cachedDocs = targetStts.map((s) =>
      peekPrintPayload(dbMode, s, effectiveInNoCk, effectiveInGia),
    );
    const allHaveCache = cachedDocs.every(Boolean);
    const allFresh = targetStts.every((s) =>
      isPrintPayloadFresh(dbMode, s, effectiveInNoCk, effectiveInGia),
    );

    if (allHaveCache && allFresh) {
      setPrintDocs(cachedDocs);
      setLoadedKey(targetKey);
      setIsFetching(false);
      return;
    }

    if (isPreviewMode && allHaveCache) {
      setPrintDocs(cachedDocs);
      setLoadedKey(targetKey);
    }

    const fetchPrintAll = async () => {
      setIsFetching(true);
      try {
        const payloads = await Promise.all(
          targetStts.map((s) =>
            fetchPrintPayload(
              dbMode,
              s,
              effectiveInNoCk,
              effectiveInGia,
              false,
            ),
          ),
        );
        const validDocs = payloads.filter(Boolean);
        if (!cancelled && validDocs.length > 0) {
          setPrintDocs(validDocs);
          setLoadedKey(targetKey);
        } else if (!cancelled && !isPreviewMode) {
          onErrorRef.current?.("Không tải được dữ liệu phiếu để in.");
          onCloseRef.current();
        }
      } catch (e) {
        console.error("Error fetching print payloads", e);
        if (!cancelled && !isPreviewMode) {
          onErrorRef.current?.("Lỗi kết nối khi chuẩn bị bản in.");
          onCloseRef.current();
        }
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
    dbMode,
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
    let rafId: number | null = null;

    const handleAfterPrint = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      if (!cancelled) {
        onPrintCompleteRef.current?.();
        onCloseRef.current();
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);

    const triggerPrint = () => {
      if (cancelled || printedKeyRef.current === requestKey) return;
      printedKeyRef.current = requestKey;
      rafId = window.requestAnimationFrame(() => {
        if (!cancelled) {
          window.print();
        }
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
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }

    triggerPrint();
    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPreviewMode, isOpen, requestKey, loadedKey, printDocs]);

  const handleManualPrint = useCallback(() => {
    if (isFetching || printDocs.length === 0 || printingFromPreview) return;
    setPrintingFromPreview(true);
    const handleAfterPrint = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      onPrintCompleteRef.current?.();
      onCloseRef.current();
    };
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [isFetching, printDocs.length, printingFromPreview]);

  // Phím tắt trong dialog Xem trước (Ctrl+F7): Esc để đóng, F7 hoặc Enter để In phiếu.
  useEffect(() => {
    if (!isOpen || !isPreviewMode || printingFromPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "F7") {
        e.preventDefault();
        e.stopPropagation();
        handleManualPrint();
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
        handleManualPrint();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, isPreviewMode, printingFromPreview, handleManualPrint]);

  if (!isOpen) {
    return null;
  }

  if (!isPreviewMode && (printDocs.length === 0 || loadedKey !== requestKey)) {
    if (isFetching) {
      return (
        <div
          className="no-print fixed bottom-10 right-4 z-[80] bg-neutral-900/95 text-white px-3 py-2 rounded shadow-xl border border-neutral-700 text-xs flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-300" />
          <span>Đang chuẩn bị bản in...</span>
        </div>
      );
    }
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
      <div
        key={`${header.stt || renderIdx}-${copySuffix}`}
        className={renderIdx > 0 ? "print-doc-page-break" : undefined}
      >
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
  };

  const expandedDocs = printDocs.flatMap((doc, docIdx) =>
    Array.from({ length: safeCopies }, (_, copyIdx) => ({
      doc,
      keySuffix: `d${docIdx}-c${copyIdx}`,
    })),
  );

  if (isPreviewMode && !printingFromPreview) {
    return (
      <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 print-preview-root">
        <div
          ref={dialogRef}
          className="bg-neutral-200 rounded shadow-2xl border border-neutral-400 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden print-preview-scroll animate-in fade-in zoom-in-95"
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

            {/* Tùy chọn In nợ cũ, In giá bán, Số bản & Phóng to/Thu gọn */}
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

              {dbMode !== "warehouse" && (
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
              )}

              {/* Copies stepper 1..4 */}
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 border border-white/25 text-xs"
                title="Số bản in cho mỗi phiếu (1–4 bản)"
              >
                <span className="text-primary-100 text-[11px]">Số bản:</span>
                <button
                  type="button"
                  onClick={() => setPreviewCopies((c) => Math.max(1, c - 1))}
                  disabled={previewCopies <= 1}
                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-40 font-bold leading-none cursor-pointer"
                  aria-label="Giảm số bản"
                >
                  −
                </button>
                <span className="w-4 text-center font-mono font-bold">
                  {previewCopies}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewCopies((c) => Math.min(4, c + 1))}
                  disabled={previewCopies >= 4}
                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 disabled:opacity-40 font-bold leading-none cursor-pointer"
                  aria-label="Tăng số bản"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFitToWidth((v) => !v)}
                className={`px-2 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                  fitToWidth
                    ? "bg-white text-primary-900 border-white"
                    : "bg-white/10 hover:bg-white/20 text-white border-white/25"
                }`}
                title="Chuyển đổi giữa kích thước A4 chuẩn (100%) và vừa khung màn hình"
              >
                {fitToWidth ? "100% A4" : "Vừa khung"}
              </button>

              <div className="h-4 w-px bg-white/25 mx-0.5" />

              <button
                type="button"
                onClick={handleManualPrint}
                disabled={isFetching || printDocs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded text-xs font-semibold border border-primary-400 cursor-pointer shadow-sm"
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
                className="print-area mx-auto bg-white text-black shadow-lg border border-neutral-400 p-[6mm] print-preview-sheet transition-all"
                style={{
                  width: fitToWidth ? "100%" : "210mm",
                  maxWidth: fitToWidth ? "100%" : undefined,
                  fontFamily: '"Times New Roman", Times, serif',
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
        fontFamily: '"Times New Roman", Times, serif',
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
