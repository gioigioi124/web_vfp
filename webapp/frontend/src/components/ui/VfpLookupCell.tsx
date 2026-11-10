import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import {
  arrowDir,
  caretToEndLater,
  handleExcelMouseDown,
  isPrintableKey,
  selectAllLater,
  useExcelCellMode,
} from "./excelCell";

export interface VfpOption {
  value: string;
  label: string;
  hint?: string;
}

export type VfpNavDir = "up" | "down" | "next" | "prev" | "left" | "right";

interface VfpLookupCellProps {
  value: string;
  /** Gọi mỗi khi người dùng gõ/sửa/xóa/dán (đồng bộ state cha + xóa tên/giá cũ). */
  onValueChange: (v: string) => void;
  /** Gọi khi chọn một gợi ý từ dropdown (điền tên, lấy giá...). */
  onPick: (opt: VfpOption) => void;
  /** Gọi khi rời ô / Enter để kiểm tra mã (như Valid của VFP). */
  onCommit: (rawValue: string) => void;
  /** Nguồn gợi ý (RAM). */
  fetcher: (q: string) => Promise<VfpOption[]>;
  /** Điều hướng ô: 'up' | 'down' | 'next' | 'prev' (kèm phần tử input hiện tại). */
  onNavigate?: (dir: VfpNavDir, el: HTMLInputElement) => void;
  onFocusRow?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
  maxResults?: number;
  dropdownMinWidth?: number;
  /** Tự động nhảy sang ô kế sau khi chọn gợi ý (mặc định true, giống VFP). */
  advanceOnPick?: boolean;
}

/**
 * Ô nhập mã có dropdown gợi ý, mô phỏng đúng hành vi grid VFP (xem input.md):
 * - Dropdown CHỈ mở từ sự kiện gõ/sửa/xóa/dán — KHÔNG mở khi click/focus/Tab/mũi tên.
 * - Kiểu Excel: click / mũi tên chỉ CHỌN ô (không hiện con trỏ, không mở dropdown);
 *   gõ phím -> nhập đè; F2 / double-click -> sửa (← → di chuyển con trỏ);
 *   Esc khi đang nhập -> khôi phục giá trị cũ; Delete khi đang chọn -> xóa trắng.
 * - ↑/↓: dropdown đóng -> nhảy dòng trên/dưới (cùng cột); dropdown mở -> di chuyển dòng sáng.
 * - Enter: dropdown đóng -> sang ô kế; dropdown mở -> chọn dòng sáng rồi sang ô kế.
 * - Esc: dropdown mở -> đóng, giữ nguyên chữ; dropdown đóng -> không làm gì.
 * - Rời ô: kiểm tra mã (onCommit) trừ khi vừa chọn từ dropdown (đánh dấu "ok").
 * - Sửa chữ: gọi onValueChange để cha xóa tên/giá cũ của mã trước đó.
 */
export const VfpLookupCell: React.FC<VfpLookupCellProps> = ({
  value,
  onValueChange,
  onPick,
  onCommit,
  fetcher,
  onNavigate,
  onFocusRow,
  inputRef: externalInputRef,
  placeholder,
  disabled,
  className,
  debounceMs = 30,
  maxResults = 30,
  dropdownMinWidth = 320,
  advanceOnPick = true,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<VfpOption[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ddRef = useRef<HTMLUListElement | null>(null);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | null>(null);
  // "seq" hủy ngầm: mọi lần vào ô / chọn xong / xóa hết chữ đều tăng seq
  // nên kết quả tìm kiếm trả về trễ sẽ bị bỏ, dropdown không bật lên sau khi đã rời đi.
  const reqSeqRef = useRef(0);
  // "data-ok": giá trị đã chọn từ dropdown -> rời ô không kiểm tra lại.
  const okRef = useRef<string>("");
  // Cờ hủy: khi Esc -> không kiểm tra/không enrich khi rời ô (giống Excel).
  const cancelRef = useRef(false);
  // Chế độ ô kiểu Excel (select / enter / edit).
  const { mode, modeRef, setMode } = useExcelCellMode();
  // Nội dung đã bị sửa trong lần chọn ô này chưa (chỉ kiểm tra mã khi có sửa).
  const dirtyRef = useRef(false);
  // Giá trị lúc bắt đầu chọn ô — để Esc khôi phục.
  const origRef = useRef<string>("");

  const setRefs = (el: HTMLInputElement | null) => {
    internalRef.current = el;
    if (typeof externalInputRef === "function") {
      externalInputRef(el);
    } else if (externalInputRef && typeof externalInputRef === "object") {
      (
        externalInputRef as React.MutableRefObject<HTMLInputElement | null>
      ).current = el;
    }
  };

  const position = useCallback(() => {
    const el = internalRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.bottom + 2,
      left: r.left,
      width: Math.max(r.width, dropdownMinWidth),
    });
  }, [dropdownMinWidth]);

  const close = useCallback(() => {
    reqSeqRef.current++;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
    setOptions([]);
  }, []);

  // Dọn timer khi unmount
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // Đóng dropdown khi cuộn / đổi kích thước (trừ khi cuộn bên trong chính dropdown)
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (
        t instanceof Node &&
        (wrapRef.current?.contains(t) || ddRef.current?.contains(t))
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || ddRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cuộn dòng đang sáng vào tầm nhìn
  useEffect(() => {
    if (!open) return;
    const el = ddRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const scheduleSearch = (raw: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const q = raw.trim();
    if (!q) {
      close();
      return;
    }
    const id = ++reqSeqRef.current;
    timerRef.current = window.setTimeout(async () => {
      try {
        const opts = await fetcher(q);
        if (id !== reqSeqRef.current) return;
        const list = opts.slice(0, maxResults);
        setOptions(list);
        setHighlight(0);
        if (list.length > 0) {
          position();
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch {
        if (id === reqSeqRef.current) {
          setOptions([]);
          setOpen(false);
        }
      }
    }, debounceMs);
  };

  const pick = (i: number) => {
    const opt = options[i];
    if (!opt) return;
    okRef.current = opt.value;
    // Đồng bộ DOM ngay để blur (nếu có) không thấy giá trị cũ.
    if (internalRef.current) internalRef.current.value = opt.value;
    onPick(opt);
    close();
    if (advanceOnPick) {
      const el = internalRef.current;
      window.setTimeout(() => {
        if (el) onNavigate?.("next", el);
      }, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    okRef.current = ""; // chữ đã bị sửa -> chưa còn hợp lệ
    dirtyRef.current = true;
    // Gõ / dán khi đang ở chế độ chọn -> chuyển sang chế độ nhập.
    if (modeRef.current === "select") setMode("enter");
    onValueChange(v);
    scheduleSearch(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isOpen = open && options.length > 0;
    const m = modeRef.current;
    const el = e.currentTarget;
    const dir = arrowDir(e.key);
    if (dir === "up" || dir === "down") {
      e.preventDefault();
      // Dropdown mở -> di chuyển dòng sáng; đóng -> sang dòng trên/dưới (cùng cột).
      if (isOpen) {
        setHighlight((h) =>
          dir === "down"
            ? (h + 1) % options.length
            : (h - 1 + options.length) % options.length,
        );
      } else {
        setMode("select");
        onNavigate?.(dir, el);
      }
      return;
    }
    if (dir === "left" || dir === "right") {
      // Chế độ sửa (F2 / double-click): ← → di chuyển con trỏ trong chữ.
      if (m === "edit") return;
      // Chế độ chọn / nhập: luôn nhảy ô (giống Excel).
      e.preventDefault();
      if (open) close();
      setMode("select");
      onNavigate?.(dir, el);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlight >= 0 && highlight < options.length) {
        pick(highlight);
      } else {
        close();
        setMode("select");
        onNavigate?.("next", el);
      }
      return;
    }
    if (e.key === "F2") {
      // F2: vào chế độ SỬA -> con trỏ ở cuối chữ (giống Excel).
      e.preventDefault();
      setMode("edit");
      caretToEndLater(el);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (open) {
        // Đang mở dropdown -> chỉ đóng dropdown, giữ nguyên chữ.
        close();
        return;
      }
      if (m !== "select") {
        // Đang nhập/sửa -> hủy, khôi phục giá trị ban đầu và ở lại ô (giống Excel).
        const orig = origRef.current;
        if (dirtyRef.current && el.value !== orig) {
          el.value = orig;
          onValueChange(orig);
          if (orig.trim()) onCommit(orig);
          okRef.current = orig;
        }
        dirtyRef.current = false;
        setMode("select");
        selectAllLater(el);
        return;
      }
      // Chế độ chọn -> thoát ô (bỏ chọn).
      cancelRef.current = true;
      el.blur();
      return;
    }
    if (m === "select" && e.key === "Delete") {
      // Delete ở chế độ chọn: xóa trắng ô.
      e.preventDefault();
      if (el.value) {
        okRef.current = "";
        dirtyRef.current = true;
        onValueChange("");
      }
      return;
    }
    if (m === "select" && isPrintableKey(e)) {
      // Gõ đè: nội dung đang bôi đen được thay bằng ký tự vừa gõ.
      setMode("enter");
      return;
    }
    if (e.key === "Tab") {
      // Tab / Shift+Tab: nhảy ô trong dòng; ở đầu/cuối dòng thì sang dòng kề.
      e.preventDefault();
      close();
      setMode("select");
      onNavigate?.(e.shiftKey ? "prev" : "next", el);
      return;
    }
  };

  const handleBlur = () => {
    reqSeqRef.current++; // hủy kết quả tìm kiếm đang chờ
    window.setTimeout(() => setOpen(false), 120);
    setMode("select");
    const wasDirty = dirtyRef.current;
    dirtyRef.current = false;
    // Esc -> hủy: không kiểm tra/không enrich khi rời ô.
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    // Kiểu Excel: chỉ chọn ô rồi rời đi (không sửa) -> không kiểm tra lại mã.
    if (!wasDirty) return;
    const v = (internalRef.current?.value ?? value).trim();
    if (!v) return;
    if (okRef.current && okRef.current.trim().toUpperCase() === v.toUpperCase())
      return;
    onCommit(v);
  };

  return (
    <div className="relative w-full" ref={wrapRef}>
      <input
        ref={setRefs}
        type="text"
        autoComplete="off"
        spellCheck={false}
        data-vfp-lookup="true"
        data-mode={mode}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleChange}
        onMouseDown={(e) => handleExcelMouseDown(e, modeRef.current)}
        onFocus={(e) => {
          onFocusRow?.();
          // Kiểu Excel: khi ô được CHỌN (focus) -> chế độ chọn, bôi đen toàn bộ (ẩn).
          // Nhờ vậy gõ phím sẽ THAY THẾ nội dung cũ, Delete xóa trắng ô.
          // (Double-click / F2 sẽ đặt con trỏ để sửa từng ký tự — xem onDoubleClick/onKeyDown.)
          setMode("select");
          dirtyRef.current = false;
          origRef.current = e.currentTarget.value;
          selectAllLater(e.currentTarget);
        }}
        onDoubleClick={(e) => {
          // Double-click: vào chế độ SỬA -> con trỏ ở cuối chữ (không bôi đen).
          setMode("edit");
          caretToEndLater(e.currentTarget);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn("w-full", className)}
      />
      {open && options.length > 0 && rect && (
        <ul
          ref={ddRef}
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
          }}
          className="z-[9999] max-h-56 overflow-y-auto bg-white border border-neutral-300 rounded shadow-xl text-xs divide-y divide-neutral-100"
        >
          {options.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              className={cn(
                "px-2.5 py-1.5 cursor-pointer flex items-center justify-between gap-3",
                i === highlight
                  ? "bg-primary-50 text-primary-900 font-medium"
                  : "hover:bg-neutral-50",
              )}
            >
              <span className="font-mono font-bold text-primary-800 shrink-0">
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-neutral-600 font-sans truncate text-right flex-1">
                  {opt.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
