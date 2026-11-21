import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useModalLock } from "../lib/modalLock";
import {
  fetchPrintPayload,
  isPrintPayloadFresh,
  peekPrintPayload,
  preloadPrintLogo,
} from "../lib/printCache";
import { PrintToolbar } from "./print/PrintToolbar";
import { PrintVoucherSheet } from "./print/PrintVoucherSheet";

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
  const [fitToWidth, setFitToWidth] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
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
      if (window.innerWidth < 768) {
        setFitToWidth(true);
      }
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

  const expandedDocs = printDocs.flatMap((doc, docIdx) =>
    Array.from({ length: safeCopies }, (_, copyIdx) => ({
      doc,
      keySuffix: `d${docIdx}-c${copyIdx}`,
    })),
  );

  if (isPreviewMode && !printingFromPreview) {
    return (
      <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-0 md:p-4 print-preview-root">
        <div
          ref={dialogRef}
          className="bg-neutral-200 rounded-none md:rounded shadow-2xl border-0 md:border border-neutral-400 w-full md:max-w-5xl h-[100dvh] md:h-[94vh] flex flex-col overflow-hidden print-preview-scroll animate-in fade-in zoom-in-95 pt-safe md:pt-0 pb-safe md:pb-0"
          role="dialog"
          aria-modal="true"
          aria-label="Xem trước khi in"
        >
          {/* Header Toolbar */}
          <PrintToolbar
            targetCount={targetStts.length}
            isFetching={isFetching}
            hasDocs={printDocs.length > 0}
            dbMode={dbMode}
            previewInNoCk={previewInNoCk}
            previewInGia={previewInGia}
            previewCopies={previewCopies}
            fitToWidth={fitToWidth}
            onChangeInNoCk={setPreviewInNoCk}
            onChangeInGia={setPreviewInGia}
            onChangeCopies={setPreviewCopies}
            onToggleFitToWidth={() => setFitToWidth((v) => !v)}
            onPrint={handleManualPrint}
            onClose={onClose}
          />

          {/* Paper Preview Body */}
          <div className="flex-1 overflow-auto p-2 md:p-4 bg-neutral-300/80 print-preview-scroll">
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
                className="print-area mx-auto bg-white text-black shadow-lg border border-neutral-400 p-2 md:p-[6mm] print-preview-sheet transition-all"
                style={{
                  width: fitToWidth ? "100%" : "210mm",
                  maxWidth: fitToWidth ? "100%" : undefined,
                  fontFamily: '"Times New Roman", Times, serif',
                  color: "#000",
                }}
              >
                {expandedDocs.map((entry, renderIdx) => (
                  <PrintVoucherSheet
                    key={`${entry.doc?.header?.stt || renderIdx}-${entry.keySuffix}`}
                    printData={entry.doc}
                    renderIdx={renderIdx}
                    effectiveInGia={effectiveInGia}
                    effectiveInNoCk={effectiveInNoCk}
                  />
                ))}
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
      {expandedDocs.map((entry, renderIdx) => (
        <PrintVoucherSheet
          key={`${entry.doc?.header?.stt || renderIdx}-${entry.keySuffix}`}
          printData={entry.doc}
          renderIdx={renderIdx}
          effectiveInGia={effectiveInGia}
          effectiveInNoCk={effectiveInNoCk}
        />
      ))}
    </div>
  );
};
