import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { HighlightText } from "./HighlightText";
import { Loader2, Search } from "lucide-react";

export interface AutocompleteOption {
  value: string;
  label: string;
  hint?: string;
  extra?: string;
}

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Hàm tải danh mục theo từ khóa (đã debounce). Trả về tối đa ~20 dòng. */
  fetcher: (query: string) => Promise<AutocompleteOption[]>;
  onSelect?: (option: AutocompleteOption) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Số ký tự tối thiểu để bắt đầu gọi fetcher (mặc định 0 = gọi khi focus). */
  minChars?: number;
  /** Ẩn icon kính lúp bên phải (dùng cho ô nhỏ trong bảng chi tiết) */
  hideIcon?: boolean;
  /** Ref trỏ trực tiếp tới thẻ input bên trong để focus/select từ component cha */
  inputRef?: React.Ref<HTMLInputElement>;
  /** Tự động bôi đen toàn bộ nội dung khi focus vào ô input */
  selectOnFocus?: boolean;
  /** Tự động focus khi mount */
  autoFocus?: boolean;
  /**
   * Chỉ mở dropdown khi người dùng GÕ (giá trị thay đổi), KHÔNG mở khi click/focus.
   * Dùng cho ô Mã khách hàng / Mã hàng hóa theo quy tắc VFP.
   */
  openOnTypeOnly?: boolean;
  /** Thời gian debounce trước khi gọi fetcher (ms). Mặc định 250. */
  debounceMs?: number;
  /** Số kết quả tối đa hiển thị. Mặc định 20. */
  maxResults?: number;
  /** Chiều rộng tối thiểu của dropdown (px). Mặc định 320. */
  dropdownMinWidth?: number;
}

/**
 * Ô nhập có gợi ý (autocomplete) cho các trường mã danh mục (Ma_Dt, Ma_Kho, Ma_Vt, Ma_Xe...).
 * - Debounce 250ms để không spam truy vấn và không bao giờ tự ghi đè text khi người dùng đang gõ.
 * - Hỗ trợ điều hướng bằng ↑/↓/Enter/Esc.
 * - Dropdown dùng vị trí fixed theo toạ độ ô input để không bị che khuất bởi overflow của bảng.
 */
export const Autocomplete: React.FC<AutocompleteProps> = ({
  label,
  value,
  onChange,
  fetcher,
  onSelect,
  onBlur,
  onFocus,
  onKeyDown,
  placeholder,
  disabled,
  className,
  minChars = 0,
  hideIcon = false,
  inputRef: externalInputRef,
  selectOnFocus = false,
  autoFocus = false,
  openOnTypeOnly = false,
  debounceMs = 250,
  maxResults = 20,
  dropdownMinWidth = 320,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const reqIdRef = useRef(0);

  const setInputRefs = (el: HTMLInputElement | null) => {
    internalInputRef.current = el;
    if (typeof externalInputRef === "function") {
      externalInputRef(el);
    } else if (externalInputRef && typeof externalInputRef === "object") {
      (
        externalInputRef as React.MutableRefObject<HTMLInputElement | null>
      ).current = el;
    }
  };

  const updateDropdownPosition = () => {
    if (!internalInputRef.current) return;
    const rect = internalInputRef.current.getBoundingClientRect();
    const vv = window.visualViewport;
    const vpWidth = vv?.width ?? window.innerWidth;
    const vpHeight = vv?.height ?? window.innerHeight;
    const vpTop = vv?.offsetTop ?? 0;

    const width = Math.min(
      Math.max(rect.width, dropdownMinWidth),
      Math.max(200, vpWidth - 16),
    );
    const left = Math.max(8, Math.min(rect.left, vpWidth - width - 8));
    const spaceBelow = vpTop + vpHeight - rect.bottom - 8;
    const spaceAbove = rect.top - vpTop - 8;
    const dropdownEstHeight = 230;
    const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
    const availHeight = placeAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(240, availHeight));
    const top = placeAbove
      ? Math.max(vpTop + 8, rect.top - Math.min(dropdownEstHeight, maxHeight) - 2)
      : rect.bottom + 2;
    setDropdownRect({
      top,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const onVpChange = () => updateDropdownPosition();
    vv?.addEventListener("resize", onVpChange);
    vv?.addEventListener("scroll", onVpChange);
    window.addEventListener("resize", onVpChange);
    return () => {
      vv?.removeEventListener("resize", onVpChange);
      vv?.removeEventListener("scroll", onVpChange);
      window.removeEventListener("resize", onVpChange);
    };
  }, [open]);

  // Debounce tải danh mục khi `value`/`open` đổi.
  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const q = (value || "").trim();
    if (q.length < minChars) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const id = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const opts = await fetcher(q);
        if (id === reqIdRef.current) {
          setOptions(opts.slice(0, maxResults));
          // Mặc định highlight dòng đầu tiên khi có danh sách gợi ý nhưng KHÔNG tự điền vào input
          setHighlight(opts.length > 0 ? 0 : -1);
        }
      } catch {
        if (id === reqIdRef.current) setOptions([]);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, open, fetcher, minChars, debounceMs, maxResults]);

  // Đóng dropdown khi click/tap ra ngoài (chỉ gắn listener khi đang mở)
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  // Cuộn dòng đang sáng vào vùng nhìn thấy của dropdown khi nhấn phím lên/xuống
  useEffect(() => {
    if (!open || highlight < 0) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, options.length]);

  const choose = (opt: AutocompleteOption) => {
    onChange(opt.value);
    onSelect?.(opt);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (open && options.length > 0) {
        e.preventDefault();
        setHighlight((h) => (h + 1) % options.length);
        return;
      }
      if (!openOnTypeOnly && !open) {
        e.preventDefault();
        setOpen(true);
        updateDropdownPosition();
        return;
      }
    }
    if (e.key === "ArrowUp" && open && options.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
      return;
    }
    if (
      e.key === "Enter" &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      if (
        open &&
        options.length > 0 &&
        highlight >= 0 &&
        highlight < options.length
      ) {
        e.preventDefault();
        choose(options[highlight]);
      } else {
        setOpen(false);
      }
      onKeyDown?.(e);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
    }
    onKeyDown?.(e);
  };

  return (
    <div className="w-full relative" ref={wrapRef}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-600 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={setInputRefs}
          type="text"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            if (openOnTypeOnly) {
              // Chỉ mở khi có chữ do người dùng gõ/đổi; xóa hết ký tự thì đóng.
              setOpen(v.trim().length > 0);
            } else if (!open) {
              setOpen(true);
            }
            updateDropdownPosition();
          }}
          onFocus={(e) => {
            if (!openOnTypeOnly) {
              setOpen(true);
            }
            updateDropdownPosition();
            if (selectOnFocus) {
              const target = e.currentTarget;
              target.select();
              setTimeout(() => {
                if (document.activeElement === target) {
                  target.select();
                }
              }, 0);
            }
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setTimeout(() => setOpen(false), 220);
            onBlur?.(e);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "erp-input w-full text-xs py-0.5 pl-2 bg-white text-neutral-900 border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-500",
            hideIcon ? "pr-1.5" : "pr-6",
            className,
          )}
        />
        {!hideIcon && (
          <span className="absolute inset-y-0 right-1.5 flex items-center text-neutral-400 pointer-events-none">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </div>

      {open && options.length > 0 && dropdownRect && (
        <ul
          ref={listRef}
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: dropdownRect.maxHeight,
          }}
          className="z-[9999] overflow-y-auto overscroll-contain bg-white border border-neutral-300 rounded-md shadow-xl text-xs divide-y divide-neutral-100"
        >
          {options.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(opt);
              }}
              className={cn(
                "px-3 md:px-2.5 py-2.5 md:py-1.5 min-h-[44px] md:min-h-0 cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2",
                i === highlight
                  ? "bg-primary-50 text-primary-900 font-medium"
                  : "hover:bg-neutral-50 active:bg-primary-50",
              )}
            >
              <span className="font-mono font-bold text-primary-800 shrink-0 min-w-[76px] text-[13px] md:text-xs">
                <HighlightText
                  text={opt.label}
                  query={value}
                  className="text-red-600 font-bold"
                />
              </span>
              {opt.hint && (
                <span
                  className={cn(
                    "text-neutral-800 font-sans truncate text-[12px] md:text-xs",
                    opt.extra !== undefined
                      ? "text-left md:flex-1 md:min-w-[160px]"
                      : "md:text-right md:flex-1",
                  )}
                  title={opt.hint}
                >
                  <HighlightText text={opt.hint} query={value} />
                </span>
              )}
              {opt.extra !== undefined && (
                <span
                  className="text-neutral-500 font-sans truncate text-left md:flex-1 md:min-w-[140px] md:pl-2 md:border-l border-neutral-200 text-[11px]"
                  title={opt.extra}
                >
                  {opt.extra ? (
                    <HighlightText text={opt.extra} query={value} />
                  ) : (
                    "—"
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
