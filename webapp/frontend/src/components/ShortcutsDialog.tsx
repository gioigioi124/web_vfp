import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Search, X } from "lucide-react";
import { useModalLock } from "../lib/modalLock";

interface ShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  desc: string;
}

interface ShortcutSection {
  title: string;
  accent: string;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Danh sách chứng từ (Màn hình chính)",
    accent: "text-primary-800 border-primary-200 bg-primary-50/70",
    items: [
      { keys: ["F2"], desc: "Thêm mới chứng từ" },
      { keys: ["Ctrl", "M"], desc: "Thêm mới chứng từ (tương đương F2)" },
      { keys: ["Ctrl", "F2"], desc: "Sao chép chứng từ đang chọn để tạo mới" },
      { keys: ["F3"], desc: "Sửa chứng từ đang chọn" },
      { keys: ["F8"], desc: "Xóa chứng từ đang chọn" },
      { keys: ["F9"], desc: "Mở hộp thoại lọc / tìm kiếm chứng từ" },
      { keys: ["/"], desc: "Nhảy nhanh vào ô lọc khách hàng trên thanh công cụ" },
      {
        keys: ["Ctrl", "Shift", "E"],
        desc: "Mở Sổ chi tiết công nợ khách hàng (theo phiếu đang chọn)",
      },
      { keys: ["Space"], desc: "Đánh dấu / bỏ đánh dấu dòng để in hàng loạt" },
      { keys: ["Ctrl", "A"], desc: "Đánh dấu chọn tất cả chứng từ" },
      { keys: ["Ctrl", "U"], desc: "Bỏ đánh dấu tất cả chứng từ" },
      { keys: ["Ctrl", "Home"], desc: "Về dòng đầu danh sách" },
      { keys: ["Ctrl", "End"], desc: "Xuống dòng cuối danh sách" },
      { keys: ["↑ ↓ ← →"], desc: "Di chuyển giữa các dòng và ô trong bảng" },
      { keys: ["Ctrl", "C"], desc: "Sao chép nhanh giá trị ô đang chọn" },
    ],
  },
  {
    title: "In phiếu & Xem trước bản in",
    accent: "text-amber-900 border-amber-200 bg-amber-50/70",
    items: [
      {
        keys: ["F7"],
        desc: "In thẳng chứng từ (hoặc các phiếu đã đánh dấu Space) theo tùy chọn 1/0",
      },
      {
        keys: ["Ctrl", "F7"],
        desc: "Mở hộp thoại Xem trước khi in (tùy chọn In nợ cũ / In giá bán)",
      },
      { keys: ["Shift", "F7"], desc: "Mở hộp thoại Xem trước khi in (tương đương Ctrl+F7)" },
      { keys: ["Ctrl", "1 / 2 / 3 / 4"], desc: "In nhanh có giá — 1 / 2 / 3 / 4 bản (cả Numpad)" },
      { keys: ["Alt", "1 / 2 / 3 / 4"], desc: "In nhanh không giá — 1 / 2 / 3 / 4 bản (cả Numpad)" },
      {
        keys: ["Enter"],
        desc: "(Trong Xem trước Ctrl+F7) In phiếu & tự đóng về danh sách",
      },
      { keys: ["Esc"], desc: "Đóng hộp thoại Xem trước khi in" },
    ],
  },
  {
    title: "Lập / Sửa chứng từ (Phiếu xuất bán & Kho)",
    accent: "text-emerald-900 border-emerald-200 bg-emerald-50/70",
    items: [
      { keys: ["Ctrl", "Enter"], desc: "Lưu chứng từ (kiểm tra công nợ & người lập)" },
      {
        keys: ["Shift", "Enter"],
        desc: "Lưu chứng từ & bỏ qua cảnh báo công nợ / người lập khác",
      },
      {
        keys: ["Ctrl", "Shift", "E"],
        desc: "Mở Sổ chi tiết công nợ khách hàng hiện tại",
      },
      { keys: ["Alt", "K"], desc: "Mở / đóng bảng Đếm hàng khuyến mại" },
      { keys: ["Ctrl", "Q"], desc: "Nhảy nhanh và bôi đen ô Mã đối tượng" },
      {
        keys: ["Ctrl", "D"],
        desc: "(Tại ô Diễn giải) Cắt giữ lại 10 ký tự đầu của Diễn giải cũ",
      },
      { keys: ["F5"], desc: "Mở Máy tính tính đơn giá cho dòng đang chọn" },
      { keys: ["F4"], desc: "Chọn nhanh Tài khoản Có (TK doanh thu) dòng đang chọn" },
      { keys: ["Ctrl", "+"], desc: "Thêm dòng hàng hóa mới" },
      { keys: ["Ctrl", "Shift", "D"], desc: "Nhân đôi dòng hàng hóa đang chọn" },
      { keys: ["Ctrl", "Z"], desc: "Hoàn tác (Undo) thay đổi trên bảng chi tiết" },
      { keys: ["Ctrl", "Y"], desc: "Làm lại (Redo) thay đổi vừa hoàn tác" },
      { keys: ["Ctrl", "-"], desc: "Xóa dòng hàng hóa đang chọn" },
      { keys: ["F8"], desc: "Xóa dòng hàng hóa đang chọn" },
      {
        keys: ["Enter"],
        desc: "Sang ô tiếp theo; nhấn ở ô cuối dòng để tự thêm dòng mới",
      },
      { keys: ["Esc"], desc: "Thoát khỏi form chứng từ (có hỏi khi chưa lưu)" },
    ],
  },
  {
    title: "Sổ chi tiết công nợ, Lọc (F9) & Chọn phiếu kho",
    accent: "text-indigo-900 border-indigo-200 bg-indigo-50/70",
    items: [
      {
        keys: ["Enter"],
        desc: "(Sổ công nợ — ô lọc) Tìm kiếm; (trên dòng) Xem hóa đơn ở chế độ sửa",
      },
      { keys: ["F3"], desc: "(Sổ công nợ / Chọn phiếu kho) Mở hoặc sửa chứng từ đang chọn" },
      { keys: ["Ctrl", "E"], desc: "(Sổ công nợ) Xuất dữ liệu ra Excel (.csv UTF-8)" },
      { keys: ["F4"], desc: "(Sổ công nợ) Nhảy nhanh về ô Mã đối tượng" },
      { keys: ["F5"], desc: "(Sổ công nợ) Tải lại dữ liệu" },
      { keys: ["Space"], desc: "(Chọn phiếu kho) Đánh dấu / bỏ chọn phiếu xuất kho" },
      { keys: ["Ctrl", "A"], desc: "(Chọn phiếu kho) Chọn tất cả / Ctrl+U bỏ chọn tất cả" },
      { keys: ["Ctrl", "Enter"], desc: "(Hộp thoại Lọc F9) Áp dụng điều kiện lọc ngay" },
      { keys: ["Esc"], desc: "Đóng hộp thoại hiện tại" },
    ],
  },
];

export const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_SECTIONS;
    return SHORTCUT_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter(
        (it) =>
          it.desc.toLowerCase().includes(q) ||
          it.keys.join(" ").toLowerCase().includes(q),
      ),
    })).filter((sec) => sec.items.length > 0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-0 sm:p-4 bg-neutral-900/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách phím tắt ứng dụng"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="flex flex-col w-full h-[100dvh] sm:h-auto max-w-5xl bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-neutral-300 overflow-hidden sm:max-h-[90vh] pt-safe sm:pt-0"
      >
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-primary-900 via-primary-800 to-neutral-900 text-white border-b border-primary-900 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <Keyboard className="w-4 h-4 text-secondary-300 shrink-0" />
            <h2 className="text-sm font-bold tracking-wide uppercase truncate">
              Hướng Dẫn Phím Tắt Hệ Thống
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                data-autofocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm phím tắt..."
                className="h-8 sm:h-7 w-full sm:w-48 pl-7 pr-2 rounded bg-white/15 text-white placeholder-neutral-300 border border-white/20 text-sm sm:text-xs outline-none focus:bg-white/20 focus:border-white/50"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-1 text-neutral-200 hover:text-white hover:bg-danger-600 rounded transition-colors w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center cursor-pointer shrink-0"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto p-3 sm:p-3.5 bg-neutral-50">
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 italic">
              Không tìm thấy phím tắt phù hợp với "{query}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSections.map((section) => (
                <section
                  key={section.title}
                  className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden flex flex-col"
                >
                  <div
                    className={`px-3 py-1.5 border-b text-xs font-bold uppercase tracking-wide ${section.accent}`}
                  >
                    {section.title}
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {section.items.map((item, idx) => (
                      <div
                        key={`${item.keys.join("+")}-${idx}`}
                        className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs hover:bg-neutral-50"
                      >
                        <span className="text-neutral-700 leading-snug">
                          {item.desc}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0 font-mono">
                          {item.keys.map((k, kIdx) => (
                            <React.Fragment key={`${k}-${kIdx}`}>
                              {kIdx > 0 && (
                                <span className="text-neutral-400 text-[10px]">
                                  +
                                </span>
                              )}
                              <kbd className="text-[10.5px] py-0.5 px-1.5 whitespace-nowrap">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-neutral-100 px-3.5 py-2 pb-safe flex items-center justify-between gap-2 border-t border-neutral-300 shrink-0 select-none text-xs">
          <span className="hidden sm:inline text-neutral-500 text-[11px]">
            Mẹo: Gõ từ khóa ở góc trên để lọc nhanh phím tắt hoặc chức năng cần tìm.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3.5 py-1.5 sm:py-1 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-neutral-500" />
            <span>Đóng</span>
            <kbd className="text-[9px] py-0 px-1">Esc</kbd>
          </button>
        </footer>
      </div>
    </div>
  );
};
