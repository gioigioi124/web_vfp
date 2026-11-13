import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, X } from "lucide-react";
import { round } from "../lib/calc";
import { useModalLock } from "../lib/modalLock";

type BinaryOp = "+" | "-" | "*" | "/";

const OP_SYMBOL: Record<BinaryOp, string> = {
  "+": "+",
  "-": "-",
  "*": "×",
  "/": "÷",
};

/** Định dạng số trong máy tính với dấu phẩy ngăn cách hàng nghìn/triệu, không thêm .00 dư thừa. */
function formatCalcNumber(n: number): string {
  const rounded = round(n, 2);
  const neg = rounded < 0;
  const raw = Math.abs(rounded).toString();
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `.${decPart}` : ""}`;
}

/** Định dạng chuỗi số đang nhập (hỗ trợ cả trạng thái dở dang như "1,000." hoặc "-"). */
function formatNumberInputText(raw: string): string {
  const cleaned = raw.replace(/,/g, "");
  if (!cleaned) return "0";
  const neg = cleaned.startsWith("-");
  const unsigned = neg ? cleaned.slice(1) : cleaned;
  const dotIdx = unsigned.indexOf(".");
  let intPart = dotIdx >= 0 ? unsigned.slice(0, dotIdx) : unsigned;
  const decPart = dotIdx >= 0 ? unsigned.slice(dotIdx) : "";
  // Bỏ số 0 thừa ở đầu (trừ "0" đơn lẻ)
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (!intPart && dotIdx >= 0) intPart = "0";
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${decPart}`;
}

function parseNumberText(text: string): number {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function computeBinary(
  left: number,
  op: BinaryOp,
  right: number,
): { ok: true; value: number } | { ok: false; error: string } {
  let raw = 0;
  switch (op) {
    case "+":
      raw = left + right;
      break;
    case "-":
      raw = left - right;
      break;
    case "*":
      raw = left * right;
      break;
    case "/":
      if (Math.abs(right) < 1e-12) {
        return { ok: false, error: "Không thể chia cho 0" };
      }
      raw = left / right;
      break;
  }
  if (!Number.isFinite(raw)) {
    return { ok: false, error: "Kết quả không hợp lệ" };
  }
  return { ok: true, value: round(raw, 6) };
}

function countRawCharsBefore(str: string, caret: number): number {
  let count = 0;
  const limit = Math.min(caret, str.length);
  for (let i = 0; i < limit; i++) {
    if (str[i] !== ",") count += 1;
  }
  return count;
}

function caretPosAfterRawCount(
  formatted: string,
  targetRawCount: number,
): number {
  if (targetRawCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ",") {
      seen += 1;
      if (seen === targetRawCount) return i + 1;
    }
  }
  return formatted.length;
}

interface PriceCalculatorModalProps {
  isOpen: boolean;
  rowNumber: number;
  itemCode?: string;
  itemName?: string;
  initialValue: number;
  onApply: (value: number) => void;
  onClose: () => void;
}

type KeypadBtn =
  | { label: string; action: "digit"; value: string }
  | { label: string; action: "dot" }
  | { label: string; action: "op"; value: BinaryOp }
  | { label: string; action: "percent" }
  | { label: string; action: "eq" }
  | { label: string; action: "clear" }
  | { label: string; action: "ce" }
  | { label: string; action: "backspace" };

const KEYPAD_BUTTONS: KeypadBtn[] = [
  { label: "C", action: "clear" },
  { label: "CE", action: "ce" },
  { label: "⌫", action: "backspace" },
  { label: "÷", action: "op", value: "/" },
  { label: "7", action: "digit", value: "7" },
  { label: "8", action: "digit", value: "8" },
  { label: "9", action: "digit", value: "9" },
  { label: "×", action: "op", value: "*" },
  { label: "4", action: "digit", value: "4" },
  { label: "5", action: "digit", value: "5" },
  { label: "6", action: "digit", value: "6" },
  { label: "-", action: "op", value: "-" },
  { label: "1", action: "digit", value: "1" },
  { label: "2", action: "digit", value: "2" },
  { label: "3", action: "digit", value: "3" },
  { label: "+", action: "op", value: "+" },
  { label: "%", action: "percent" },
  { label: "0", action: "digit", value: "0" },
  { label: ".", action: "dot" },
  { label: "=", action: "eq" },
];

/**
 * Máy tính đơn giá (F5 trên VoucherForm): tính tuần tự trái sang phải giống máy tính bỏ túi
 * (VD: 100 + 100 -> 200, chia 2 -> 100), nhấn Enter để điền kết quả vào ô Đơn giá (gia_nt9).
 */
export const PriceCalculatorModal: React.FC<PriceCalculatorModalProps> = ({
  isOpen,
  rowNumber,
  itemCode,
  itemName,
  initialValue,
  onApply,
  onClose,
}) => {
  const [inputText, setInputText] = useState<string>("0");
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<BinaryOp | null>(null);
  const [awaitingNext, setAwaitingNext] = useState<boolean>(false);
  const [historyLabel, setHistoryLabel] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useModalLock(isOpen, dialogRef);

  const latestInitialRef = useRef(initialValue);
  latestInitialRef.current = initialValue;

  const focusEnd = (len?: number) => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const targetLen = len ?? el.value.length;
      el.setSelectionRange(targetLen, targetLen);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const initVal = latestInitialRef.current;
    const initText = initVal > 0 ? formatCalcNumber(initVal) : "0";
    setInputText(initText);
    setPendingValue(null);
    setPendingOp(null);
    setAwaitingNext(false);
    setHistoryLabel("");
    setSubmitError(null);

    const placeCaretAtEnd = () => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    };
    const t1 = window.setTimeout(placeCaretAtEnd, 35);
    const t2 = window.setTimeout(placeCaretAtEnd, 60);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isOpen]);

  // Xem trước kết quả cuối cùng nếu nhấn Enter ngay lúc này
  const livePreview = useMemo<{ ok: true; value: number } | { ok: false; error: string }>(() => {
    const cur = parseNumberText(inputText);
    if (pendingOp !== null && pendingValue !== null) {
      if (awaitingNext) {
        return { ok: true, value: round(pendingValue, 2) };
      }
      const res = computeBinary(pendingValue, pendingOp, cur);
      if (!res.ok) return res;
      return { ok: true, value: round(res.value, 2) };
    }
    return { ok: true, value: round(cur, 2) };
  }, [inputText, pendingOp, pendingValue, awaitingNext]);

  const setFormattedInputWithCaret = (rawNext: string, rawCaretPos?: number) => {
    // Chỉ giữ chữ số, dấu chấm đầu tiên và dấu âm đầu chuỗi
    const noCommas = rawNext.replace(/,/g, "");
    const isNeg = noCommas.startsWith("-");
    let body = isNeg ? noCommas.slice(1) : noCommas;
    let seenDot = false;
    let cleanedBody = "";
    for (const ch of body) {
      if (ch >= "0" && ch <= "9") {
        cleanedBody += ch;
      } else if (ch === "." && !seenDot) {
        seenDot = true;
        cleanedBody += ch;
      }
    }
    const sanitizedRaw = (isNeg ? "-" : "") + cleanedBody;
    const formatted = formatNumberInputText(sanitizedRaw);
    setInputText(formatted);
    setAwaitingNext(false);
    setSubmitError(null);

    if (rawCaretPos !== undefined) {
      const targetRawCount = countRawCharsBefore(rawNext, rawCaretPos);
      const nextCaret = caretPosAfterRawCount(formatted, targetRawCount);
      window.requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    }
  };

  const handleDigit = (digit: string) => {
    setSubmitError(null);
    if (awaitingNext || inputText === "0") {
      const next = digit === "0" ? "0" : digit;
      setInputText(next);
      setAwaitingNext(false);
      focusEnd(next.length);
      return;
    }
    const el = inputRef.current;
    const start = el?.selectionStart ?? inputText.length;
    const end = el?.selectionEnd ?? inputText.length;
    const rawNext = inputText.slice(0, start) + digit + inputText.slice(end);
    setFormattedInputWithCaret(rawNext, start + 1);
  };

  const handleDot = () => {
    setSubmitError(null);
    if (awaitingNext) {
      setInputText("0.");
      setAwaitingNext(false);
      focusEnd(2);
      return;
    }
    if (inputText.includes(".")) {
      focusEnd();
      return;
    }
    const el = inputRef.current;
    const start = el?.selectionStart ?? inputText.length;
    const end = el?.selectionEnd ?? inputText.length;
    const rawNext = inputText.slice(0, start) + "." + inputText.slice(end);
    setFormattedInputWithCaret(rawNext, start + 1);
  };

  const handleOperator = (nextOp: BinaryOp) => {
    setSubmitError(null);
    const currentNum = parseNumberText(inputText);

    // Đã bấm phép toán trước đó mà chưa nhập số thứ 2 -> chỉ đổi phép toán
    if (pendingOp !== null && pendingValue !== null && awaitingNext) {
      setPendingOp(nextOp);
      setHistoryLabel(`${formatCalcNumber(pendingValue)} ${OP_SYMBOL[nextOp]}`);
      focusEnd();
      return;
    }

    // Có phép toán đang chờ + đã nhập xong số thứ 2 -> tính ngay ra kết quả trung gian rồi nối tiếp!
    if (pendingOp !== null && pendingValue !== null) {
      const res = computeBinary(pendingValue, pendingOp, currentNum);
      if (!res.ok) {
        setSubmitError(res.error);
        focusEnd();
        return;
      }
      const nextValText = formatCalcNumber(res.value);
      setPendingValue(res.value);
      setPendingOp(nextOp);
      setInputText(nextValText);
      setAwaitingNext(true);
      setHistoryLabel(`${nextValText} ${OP_SYMBOL[nextOp]}`);
      focusEnd(nextValText.length);
      return;
    }

    // Phép toán đầu tiên
    const valText = formatCalcNumber(currentNum);
    setPendingValue(currentNum);
    setPendingOp(nextOp);
    setInputText(valText);
    setAwaitingNext(true);
    setHistoryLabel(`${valText} ${OP_SYMBOL[nextOp]}`);
    focusEnd(valText.length);
  };

  const handlePercent = () => {
    setSubmitError(null);
    const cur = parseNumberText(inputText);
    const pctVal =
      pendingValue !== null && (pendingOp === "+" || pendingOp === "-")
        ? round((pendingValue * cur) / 100, 6)
        : round(cur / 100, 6);
    const pctText = formatCalcNumber(pctVal);
    setInputText(pctText);
    setAwaitingNext(false);
    focusEnd(pctText.length);
  };

  const handleEquals = () => {
    setSubmitError(null);
    if (pendingOp === null || pendingValue === null) {
      const cur = round(parseNumberText(inputText), 2);
      const formatted = formatCalcNumber(cur);
      setInputText(formatted);
      setAwaitingNext(true);
      setHistoryLabel("");
      focusEnd(formatted.length);
      return;
    }

    const rhs = awaitingNext ? pendingValue : parseNumberText(inputText);
    if (awaitingNext) {
      const formatted = formatCalcNumber(pendingValue);
      setInputText(formatted);
      setPendingValue(null);
      setPendingOp(null);
      setAwaitingNext(true);
      setHistoryLabel("");
      focusEnd(formatted.length);
      return;
    }

    const res = computeBinary(pendingValue, pendingOp, rhs);
    if (!res.ok) {
      setSubmitError(res.error);
      focusEnd();
      return;
    }
    const formatted = formatCalcNumber(res.value);
    setHistoryLabel(
      `${formatCalcNumber(pendingValue)} ${OP_SYMBOL[pendingOp]} ${formatCalcNumber(rhs)} =`,
    );
    setInputText(formatted);
    setPendingValue(null);
    setPendingOp(null);
    setAwaitingNext(true);
    focusEnd(formatted.length);
  };

  const handleClear = () => {
    setInputText("0");
    setPendingValue(null);
    setPendingOp(null);
    setAwaitingNext(false);
    setHistoryLabel("");
    setSubmitError(null);
    focusEnd(1);
  };

  const handleClearEntry = () => {
    setInputText("0");
    setAwaitingNext(false);
    setSubmitError(null);
    focusEnd(1);
  };

  const handleBackspace = () => {
    setSubmitError(null);
    if (awaitingNext) {
      focusEnd();
      return;
    }
    const el = inputRef.current;
    const start = el?.selectionStart ?? inputText.length;
    const end = el?.selectionEnd ?? inputText.length;
    if (start !== end) {
      setFormattedInputWithCaret(
        inputText.slice(0, start) + inputText.slice(end),
        start,
      );
      return;
    }
    if (start <= 0) return;
    if (inputText[start - 1] === "," && start >= 2) {
      setFormattedInputWithCaret(
        inputText.slice(0, start - 2) + inputText.slice(start),
        start - 2,
      );
    } else {
      setFormattedInputWithCaret(
        inputText.slice(0, start - 1) + inputText.slice(start),
        start - 1,
      );
    }
  };

  const handleApply = () => {
    if (!livePreview.ok) {
      setSubmitError(livePreview.error);
      focusEnd();
      return;
    }
    onApply(livePreview.value);
  };

  const handleKeypadClick = (btn: KeypadBtn) => {
    switch (btn.action) {
      case "digit":
        handleDigit(btn.value);
        break;
      case "dot":
        handleDot();
        break;
      case "op":
        handleOperator(btn.value);
        break;
      case "percent":
        handlePercent();
        break;
      case "eq":
        handleEquals();
        break;
      case "clear":
        handleClear();
        break;
      case "ce":
        handleClearEntry();
        break;
      case "backspace":
        handleBackspace();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-xs"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded shadow-2xl border border-neutral-300 w-[260px] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Máy tính đơn giá"
      >
        {/* Header */}
        <div className="bg-primary-800 text-white px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary-200" />
            <span className="font-bold text-[11px] uppercase tracking-wide">
              F5: Máy tính đơn giá
            </span>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="text-white/80 hover:text-white cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row info */}
        <div className="px-2.5 py-1 bg-neutral-50 border-b border-neutral-200 text-[10.5px] text-neutral-600">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-semibold text-neutral-800 truncate">
              Dòng #{rowNumber}
              {itemCode ? ` · ${itemCode}` : ""}
            </span>
            <span className="font-mono text-neutral-500 shrink-0">
              {formatCalcNumber(initialValue)}
            </span>
          </div>
          {itemName && (
            <div className="truncate text-[10px] text-neutral-500" title={itemName}>
              {itemName}
            </div>
          )}
        </div>

        {/* Display + input */}
        <div className="p-2 space-y-1.5">
          <div className="border border-neutral-300 rounded bg-neutral-50 focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-500 px-2 py-1">
            <div className="h-4 text-right font-mono text-[10.5px] text-neutral-500 truncate">
              {historyLabel}
            </div>
            <input
              ref={inputRef}
              data-autofocus
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                const caret = e.target.selectionStart ?? val.length;
                setFormattedInputWithCaret(val, caret);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleApply();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                } else if (
                  e.key === "+" ||
                  e.key === "-" ||
                  e.key === "*" ||
                  e.key === "/"
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOperator(e.key);
                } else if (e.key === "%") {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePercent();
                } else if (e.key === "=") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEquals();
                } else if (
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey &&
                  e.key >= "0" &&
                  e.key <= "9"
                ) {
                  if (awaitingNext || inputText === "0") {
                    e.preventDefault();
                    handleDigit(e.key);
                  }
                } else if (e.key === "." && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  handleDot();
                } else if (e.key === "Backspace") {
                  e.preventDefault();
                  handleBackspace();
                } else if (
                  e.key === "Delete" ||
                  (!e.ctrlKey &&
                    !e.metaKey &&
                    !e.altKey &&
                    e.key.toLowerCase() === "c")
                ) {
                  e.preventDefault();
                  handleClear();
                }
              }}
              className="w-full bg-transparent text-right font-mono text-base font-bold text-neutral-900 outline-none"
            />

            <div className="mt-0.5 pt-0.5 border-t border-neutral-200 flex items-center justify-between text-[11px]">
              <span className="text-[10px] text-neutral-500">KQ:</span>
              {submitError ? (
                <span className="text-danger-600 font-medium text-[10px]">
                  {submitError}
                </span>
              ) : livePreview.ok ? (
                <span className="font-mono font-bold text-primary-800 text-xs">
                  = {formatCalcNumber(livePreview.value)}
                </span>
              ) : (
                <span className="text-danger-600 font-medium text-[10px]">
                  {livePreview.error}
                </span>
              )}
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-1">
            {KEYPAD_BUTTONS.map((btn) => {
              const base =
                "h-7 rounded text-xs font-semibold border transition cursor-pointer select-none flex items-center justify-center";
              const style =
                btn.action === "eq"
                  ? "bg-primary-100 hover:bg-primary-200 text-primary-900 border-primary-300 font-mono"
                  : btn.action === "clear" || btn.action === "ce"
                    ? "bg-danger-50 hover:bg-danger-100 text-danger-700 border-danger-200"
                    : btn.action === "op" ||
                        btn.action === "percent" ||
                        btn.action === "backspace"
                      ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300 font-mono"
                      : "bg-white hover:bg-neutral-100 text-neutral-900 border-neutral-300 font-mono";
              return (
                <button
                  key={btn.label}
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeypadClick(btn)}
                  className={`${base} ${style}`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-neutral-100 px-2 py-1.5 border-t border-neutral-200 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded text-[11px] font-medium cursor-pointer"
          >
            Hủy <kbd className="ml-0.5 text-[9px]">Esc</kbd>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleApply}
            className="px-2.5 py-0.5 bg-primary-700 hover:bg-primary-800 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs"
          >
            Điền đơn giá{" "}
            <kbd className="ml-0.5 bg-primary-900/40 text-primary-100 border-primary-600 text-[9px]">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
