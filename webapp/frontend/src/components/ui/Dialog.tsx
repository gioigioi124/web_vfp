import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { useModalLock } from "../../lib/modalLock";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = "max-w-4xl",
  footer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useModalLock(isOpen, containerRef);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-neutral-900/40 backdrop-blur-sm">
      <div
        ref={containerRef}
        className={cn(
          "w-full bg-white rounded-none md:rounded-lg shadow-xl border-0 md:border border-neutral-400 flex flex-col h-[100dvh] md:h-auto md:max-h-[90vh] overflow-hidden pt-safe md:pt-0",
          width,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100 border-b border-neutral-300 shrink-0">
          <h3 className="text-sm font-bold text-neutral-800 truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-neutral-500 hover:text-neutral-800 w-9 h-9 md:w-auto md:h-auto md:p-1 flex items-center justify-center rounded hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-3.5 md:p-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2.5 bg-neutral-50 border-t border-neutral-300 pb-safe shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
