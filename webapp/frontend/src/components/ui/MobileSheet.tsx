import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useModalLock } from "../../lib/modalLock";

export interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  variant?: "bottom" | "fullscreen";
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  zIndexClass?: string;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  variant = "bottom",
  headerRight,
  footer,
  children,
  bodyClassName = "",
  zIndexClass = "z-50",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFull = variant === "fullscreen";

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex ${
        isFull ? "items-stretch" : "items-end justify-center"
      } bg-neutral-950/50 backdrop-blur-[1px] animate-in fade-in`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isFull) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className={
          isFull
            ? "w-full h-[100dvh] bg-white flex flex-col overflow-hidden pt-safe"
            : "w-full max-h-[92dvh] bg-white rounded-t-2xl shadow-2xl border-t border-neutral-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom"
        }
      >
        {!isFull && (
          <div
            className="flex justify-center pt-2 pb-1 shrink-0 cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          >
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>
        )}

        {(title || headerRight) && (
          <header className="px-3.5 py-2.5 border-b border-neutral-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <div className="text-sm font-bold text-neutral-900 truncate">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-xs text-neutral-500 truncate mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="w-10 h-10 -mr-1.5 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <footer className="px-3.5 py-2.5 border-t border-neutral-200 bg-neutral-50 shrink-0 pb-safe">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
