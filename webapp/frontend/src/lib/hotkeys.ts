/**
 * Bảng phím tắt chuẩn VFP cho 3 form ctbhh / ctbhd / ctbhch.
 * Tham chiếu plan.md §7.2 — hotkey PHẢI giống hệt Visual FoxPro.
 */

export interface HotkeyItem {
  key: string;
  label: string;
  description: string;
  actionId: string;
  disabledInReadOnly?: boolean;
}

/**
 * Hotkey form DANH SÁCH (ctbhh, kế thừa DocItemH).
 *  F2 (-1) Thêm mới · F3 (-2) Sửa · F6 (-5) Nhập IMEI
 *  F7 (-6) In · Shift+F7 / Ctrl+F7 Xem trước · F8 (-7) Xóa · F9 (-8) Lọc
 *  Ctrl+F2 (95) SaveAs · Ctrl+F3 (96) Sửa mẫu in
 *  Ctrl+Home (29) / Ctrl+End (23) · Ctrl+F (102) Đánh số CT
 *  Space (32) Đánh dấu · Ctrl+A (1) / Ctrl+U (21) · Esc Đóng
 */
export const VFP_HOTKEYS_LIST: HotkeyItem[] = [
  {
    key: "F2",
    label: "F2",
    description: "Thêm mới (Khóa ở GĐ1)",
    actionId: "NEW",
    disabledInReadOnly: true,
  },
  {
    key: "F3",
    label: "F3",
    description: "Sửa (Khóa ở GĐ1)",
    actionId: "EDIT",
    disabledInReadOnly: true,
  },
  {
    key: "F6",
    label: "F6",
    description: "Nhập số IMEI (Khóa ở GĐ1)",
    actionId: "IMEI",
    disabledInReadOnly: true,
  },
  { key: "F7", label: "F7", description: "In chứng từ", actionId: "PRINT" },
  {
    key: "Shift+F7",
    label: "Shift+F7",
    description: "Xem trước (Ctrl+F7)",
    actionId: "PREVIEW",
  },
  {
    key: "F8",
    label: "F8",
    description: "Xóa (Khóa ở GĐ1)",
    actionId: "DELETE",
    disabledInReadOnly: true,
  },
  { key: "F9", label: "F9", description: "Lọc chứng từ", actionId: "FILTER" },
  {
    key: "Space",
    label: "Space",
    description: "Đánh dấu dòng",
    actionId: "TOGGLE_MARK",
  },
  {
    key: "Ctrl+A",
    label: "Ctrl+A",
    description: "Chọn tất cả",
    actionId: "SELECT_ALL",
  },
  {
    key: "Ctrl+U",
    label: "Ctrl+U",
    description: "Bỏ chọn tất cả",
    actionId: "DESELECT_ALL",
  },
  { key: "Esc", label: "Esc", description: "Thoát", actionId: "ESCAPE" },
];

/**
 * Hotkey form CHỌN PHIẾU XUẤT (ctbhch).
 *  Ctrl+Home/End · Space Đánh dấu · Ctrl+A / Ctrl+U · Enter Chấp nhận · Esc Hủy
 */
export const VFP_HOTKEYS_PICKUP: HotkeyItem[] = [
  {
    key: "Space",
    label: "Space",
    description: "Đánh dấu phiếu",
    actionId: "TOGGLE_MARK",
  },
  {
    key: "Ctrl+A",
    label: "Ctrl+A",
    description: "Chọn tất cả",
    actionId: "SELECT_ALL",
  },
  {
    key: "Ctrl+U",
    label: "Ctrl+U",
    description: "Bỏ chọn tất cả",
    actionId: "DESELECT_ALL",
  },
  {
    key: "Ctrl+Home",
    label: "Ctrl+Home",
    description: "Về phiếu đầu",
    actionId: "GOTO_FIRST",
  },
  {
    key: "Ctrl+End",
    label: "Ctrl+End",
    description: "Về phiếu cuối",
    actionId: "GOTO_LAST",
  },
  {
    key: "Enter",
    label: "Enter",
    description: "Chấp nhận",
    actionId: "ACCEPT",
  },
  { key: "Esc", label: "Esc", description: "Hủy bỏ", actionId: "ESCAPE" },
];

/**
 * Hotkey form NHẬP LIỆU (ctbhd).
 *  F8 (-7) Xóa dòng · F4 (-3) Chọn tài khoản (trong Grid2)
 *  Ctrl+F7 Alias -> Shift+F7 · Enter Lưu (DefaultButton) · Esc Hủy (Cancel)
 */
export const VFP_HOTKEYS_ENTRY: HotkeyItem[] = [
  {
    key: "F4",
    label: "F4",
    description: "Chọn tài khoản",
    actionId: "PICK_ACCOUNT",
  },
  {
    key: "F8",
    label: "F8",
    description: "Xóa dòng hàng",
    actionId: "DELETE_ROW",
  },
  {
    key: "Ctrl+F7",
    label: "Ctrl+F7",
    description: "Xem trước",
    actionId: "PREVIEW",
  },
  {
    key: "Enter",
    label: "Enter",
    description: "Lưu / Chấp nhận",
    actionId: "ACCEPT",
  },
  { key: "Esc", label: "Esc", description: "Hủy bỏ", actionId: "ESCAPE" },
];

/** Giữ alias cũ để không phá vỡ import hiện có. */
export const VFP_HOTKEYS = VFP_HOTKEYS_LIST;

/** Các phím cần chặn hành vi mặc định của trình duyệt. */
export const BROWSER_PREVENT_KEYS = ["F3", "F4", "F6", "F7", "F8", "F9", "F5"];
