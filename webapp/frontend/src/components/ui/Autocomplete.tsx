import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
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
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
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
    setDropdownRect({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, dropdownMinWidth),
    });
  };

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

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    if (e.key === "Enter") {
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
            setTimeout(() => setOpen(false), 150);
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
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
          }}
          className="z-[9999] max-h-56 overflow-y-auto bg-white border border-neutral-300 rounded shadow-xl text-xs divide-y divide-neutral-100"
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
                "px-2.5 py-1.5 cursor-pointer flex items-center justify-between gap-2",
                i === highlight
                  ? "bg-primary-50 text-primary-900 font-medium"
                  : "hover:bg-neutral-50",
              )}
            >
              <span className="font-mono font-bold text-primary-800 shrink-0 min-w-[76px]">
                {opt.label}
              </span>
              {opt.hint && (
                <span
                  className={cn(
                    "text-neutral-800 font-sans truncate",
                    opt.extra !== undefined
                      ? "text-left flex-1 min-w-[160px]"
                      : "text-right flex-1",
                  )}
                  title={opt.hint}
                >
                  {opt.hint}
                </span>
              )}
              {opt.extra !== undefined && (
                <span
                  className="text-neutral-500 font-sans truncate text-left flex-1 min-w-[140px] pl-2 border-l border-neutral-200 text-[11px]"
                  title={opt.extra}
                >
                  {opt.extra || "—"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
