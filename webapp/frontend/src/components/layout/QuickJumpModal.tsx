import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { ALL_NAV_ITEMS, NavModuleItem } from "../../config/accountingModules";
import { normalizeSearchText, parseSearchQuery } from "../../lib/searchMatch";
import { useModalLock } from "../../lib/modalLock";
import { ModuleIcon } from "./ModuleIcon";

interface QuickJumpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickJumpModal: React.FC<QuickJumpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const matches = useMemo(() => {
    const { words } = parseSearchQuery(query);
    if (!words.length) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter((item) => {
      const hay = normalizeSearchText(
        `${item.label} ${item.shortCode} ${item.id} ${item.keywords || ""}`,
      );
      return words.every((w) => hay.includes(w));
    });
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const selectItem = (item: NavModuleItem) => {
    onClose();
    navigate(item.route);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] p-4 bg-neutral-900/50 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nhảy nhanh phần hành kế toán"
        className="w-full max-w-lg bg-white rounded-lg shadow-2xl border border-neutral-300 overflow-hidden animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-neutral-200 bg-neutral-50">
          <Search className="w-4 h-4 text-primary-700 shrink-0" />
          <input
            ref={inputRef}
            data-autofocus="true"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) =>
                  matches.length ? (i + 1) % matches.length : 0,
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) =>
                  matches.length ? (i - 1 + matches.length) % matches.length : 0,
                );
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (matches[activeIndex]) selectItem(matches[activeIndex]);
              }
            }}
            placeholder="Gõ tên hoặc mã phần hành (VD: thu, chi, báo có, C3, X1, sổ quỹ)..."
            className="flex-1 bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-500">
              Không tìm thấy phần hành phù hợp với "{query}"
            </div>
          ) : (
            matches.map((item, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectItem(item)}
                  className={`w-full px-3.5 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    active ? "bg-primary-50 text-primary-900" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ModuleIcon
                      name={item.iconName}
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-primary-700" : "text-neutral-500"
                      }`}
                    />
                    <span className="text-xs font-semibold truncate">
                      {item.label}
                    </span>
                    {!item.implemented && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                        Sắp có
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                    {item.shortCode}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3.5 py-1.5 bg-neutral-50 border-t border-neutral-200 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>↑/↓ để chọn · Enter để mở</span>
          <span>Esc để đóng</span>
        </div>
      </div>
    </div>
  );
};
