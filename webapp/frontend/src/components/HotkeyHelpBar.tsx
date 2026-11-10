import React from "react";
import { HotkeyItem } from "../lib/hotkeys";

interface HotkeyHelpBarProps {
  items: HotkeyItem[];
  /** Ẩn các hotkey bị khóa ở chế độ read-only (Giai đoạn 1). */
  readOnly?: boolean;
}

/**
 * Thanh gợi ý phím tắt giống `txtHelp` của VFP (plan §7.2.4 mục 9).
 * Hiển thị: F2-Thêm, F3-Sửa, F7-In, F8-Xóa, F9-Lọc, Ctrl+F7-Xem phiếu,
 * Space-Đánh dấu, Esc-Thoát...
 */
export const HotkeyHelpBar: React.FC<HotkeyHelpBarProps> = ({
  items,
  readOnly = false,
}) => {
  const visible = readOnly ? items.filter((i) => !i.disabledInReadOnly) : items;

  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-300 select-none">
      {visible.map((it) => (
        <span
          key={it.actionId + it.key}
          className="inline-flex items-center gap-1"
        >
          <kbd className="text-[9px] py-0 px-1">{it.key}</kbd>
          <span className="text-neutral-400">{it.description}</span>
        </span>
      ))}
    </div>
  );
};
