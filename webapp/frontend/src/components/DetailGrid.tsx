import React, { useCallback, useEffect, useRef, useState } from "react";
import { VoucherDetail } from "../types/voucher";
import {
  formatCurrency,
  formatQuantity,
  formatNumber2,
  parseNumberInput,
} from "../lib/format";
import {
  searchProducts,
  getProductByCode,
  initProductIndex,
} from "../lib/productIndex";
import { initCatalogCache, searchKho } from "../lib/catalogCache";
import { AutocompleteOption } from "./ui/Autocomplete";
import { VfpLookupCell, VfpNavDir } from "./ui/VfpLookupCell";
import { Trash2 } from "lucide-react";
import {
  arrowDir,
  caretToEndLater,
  handleExcelMouseDown,
  isPrintableKey,
  selectAllLater,
  useExcelCellMode,
} from "./ui/excelCell";

/** Kết quả tra giá trả về cho DetailGrid (đơn giá ngoại tệ + % chiết khấu). */
export interface PriceLookupResult {
  gia_nt9: number;
  chiet_khau: number;
  expired?: boolean;
}

interface NumCellProps {
  value: number;
  disabled?: boolean;
  /** Khi true: nếu value === 0 (hoặc không có giá trị) thì hiển thị trống (blank) thay vì "0.00". */
  blankWhenZero?: boolean;
  /** Định dạng số nguyên (không có phần thập phân .00). */
  integerOnly?: boolean;
  className?: string;
  title?: string;
  onCommit: (v: number) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Phím không thuộc điều hướng mũi tên (Enter / Tab / F8 ...). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Điều hướng bằng mũi tên (kiểu Excel). */
  onNavigate?: (dir: VfpNavDir, el: HTMLInputElement) => void;
}

/**
 * Ô nhập số có định dạng 2 chữ số thập phân (xxx xxx xxx.00), hành vi kiểu Excel:
 * - Click / mũi tên: chỉ CHỌN ô (không hiện con trỏ). Mũi tên luôn di chuyển ô.
 * - Gõ phím: nhập đè toàn bộ nội dung (chế độ "enter": mũi tên = xác nhận + di chuyển).
 * - F2 / double-click: sửa nội dung, con trỏ ở cuối chữ (← → di chuyển con trỏ).
 * - Delete: xóa trắng ô (= 0). Esc: hủy nội dung đang sửa, quay về chế độ chọn.
 * - Rời ô / Enter: parse và commit giá trị số.
 */
const NumCell: React.FC<NumCellProps> = ({
  value,
  disabled,
  blankWhenZero = false,
  integerOnly = false,
  className,
  title,
  onCommit,
  onFocus,
  onKeyDown,
  onNavigate,
}) => {
  const [text, setTextState] = useState<string | null>(null);
  // Bản đồng bộ của `text` để commit() không chạy 2 lần (mũi tên commit + blur).
  const textRef = useRef<string | null>(null);
  const setText = (t: string | null) => {
    textRef.current = t;
    setTextState(t);
  };
  const { mode, modeRef, setMode } = useExcelCellMode();
  // Cờ hủy: khi Esc -> không commit giá trị đang sửa (khôi phục giá trị cũ).
  const cancelRef = useRef(false);
  const formatVal = (v?: number | null) => {
    if (blankWhenZero && (!v || Number(v) === 0)) return "";
    if (integerOnly) {
      if (v === null || v === undefined || isNaN(v)) return "0";
      return Math.round(Number(v)).toString();
    }
    return formatNumber2(v);
  };
  const formatted = formatVal(value);
  const display = text !== null ? text : formatted;
  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setText(null);
      return;
    }
    if (textRef.current !== null) {
      const t = textRef.current;
      setText(null);
      const parsed = parseNumberInput(t);
      onCommit(integerOnly ? Math.round(parsed) : parsed);
    }
  };
  // Vào chế độ SỬA: con trỏ ở cuối chữ (không bôi đen) — dùng cho double-click / F2.
  const enterEdit = (el: HTMLInputElement) => {
    setMode("edit");
    setText(formatted);
    caretToEndLater(el);
  };
  return (
    <input
      type="text"
      inputMode={integerOnly ? "numeric" : "decimal"}
      autoComplete="off"
      spellCheck={false}
      value={display}
      disabled={false}
      readOnly={disabled}
      tabIndex={disabled ? -1 : undefined}
      data-readonly={disabled ? "true" : undefined}
      data-optional={blankWhenZero ? "true" : undefined}
      title={title}
      data-mode={mode}
      onChange={(e) => {
        if (disabled) return;
        if (modeRef.current === "select") setMode("enter");
        let val = e.target.value;
        if (integerOnly) {
          val = val.replace(/[^\d\-]/g, "");
        }
        setText(val);
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        handleExcelMouseDown(e, modeRef.current);
      }}
      onFocus={(e) => {
        if (disabled) {
          onFocus?.(e);
          return;
        }
        // Kiểu Excel: chọn ô -> bôi đen toàn bộ (gõ đè thay thế), chưa vào chế độ sửa.
        setMode("select");
        setText(null);
        selectAllLater(e.currentTarget);
        onFocus?.(e);
      }}
      onDoubleClick={(e) => {
        if (disabled) return;
        enterEdit(e.currentTarget);
      }}
      onBlur={() => {
        if (disabled) return;
        commit();
        setMode("select");
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        const m = modeRef.current;
        const el = e.currentTarget;
        const dir = arrowDir(e.key);
        if (dir) {
          // Chế độ sửa (F2): ← → di chuyển con trỏ trong chữ.
          if (m === "edit" && (dir === "left" || dir === "right")) return;
          e.preventDefault();
          commit();
          setMode("select");
          onNavigate?.(dir, el);
          return;
        }
        if (e.key === "Enter") {
          commit();
          setMode("select");
        } else if (e.key === "F2") {
          e.preventDefault();
          enterEdit(el);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (m !== "select") {
            // Hủy nội dung đang nhập, ở lại ô (giống Excel).
            setText(null);
            setMode("select");
            selectAllLater(el);
          } else {
            cancelRef.current = true;
            setText(null);
            el.blur();
          }
          return;
        } else if (m === "select" && e.key === "Delete") {
          // Delete ở chế độ chọn: xóa trắng ô.
          e.preventDefault();
          onCommit(0);
          setText(null);
          selectAllLater(el);
          return;
        } else if (m === "select" && isPrintableKey(e)) {
          // Gõ đè: nội dung đang bôi đen sẽ được thay bằng ký tự vừa gõ.
          setMode("enter");
          return;
        }
        onKeyDown?.(e);
      }}
      className={className}
    />
  );
};

export interface DetailGridHandle {
  focusMaVt: (rowIndex: number) => void;
}

interface DetailGridProps {
  items: VoucherDetail[];
  currency?: string;
  /** Khi true: bảng lấp đầy chiều cao khung cha (dùng trong split view của ctbhh). */
  embedded?: boolean;
  /** 'list' (ctbhh) hoặc 'form' (ctbhd - thêm cột TK Có / CK / TT). */
  variant?: "list" | "form";
  /** Chế độ sửa dữ liệu (Phase 2) */
  editable?: boolean;
  activeRowIndex?: number;
  onSelectRow?: (index: number) => void;
  onChangeItem?: (
    index: number,
    updatedItem: VoucherDetail,
    fieldName?: string,
  ) => void;
  onDeleteItem?: (index: number) => void;
  onAddItem?: () => void;
  onValidationError?: (message: string | null) => void;
  firstMaVtRef?: React.RefObject<HTMLInputElement | null>;
  gridRef?: React.RefObject<DetailGridHandle | null>;
  /**
   * Tra đơn giá bán & chiết khấu cho một mã vật tư (từ bảng giá VP_2014 BG/BG0).
   * Chỉ được gọi khi ô Đơn giá của dòng đang trống (khớp hành vi VFP).
   */
  onLookupPrice?: (maVt: string) => Promise<PriceLookupResult | null>;
}

export const DetailGrid: React.FC<DetailGridProps> = ({
  items,
  currency = "VND",
  embedded = false,
  variant = "list",
  editable = false,
  activeRowIndex = 0,
  onSelectRow,
  onChangeItem,
  onDeleteItem,
  onAddItem,
  onValidationError,
  firstMaVtRef,
  gridRef,
  onLookupPrice,
}) => {
  const amber = "bg-amber-50 text-amber-900 border-amber-200";

  // Fetcher cho ô Mã vật tư: RAM-only (chờ lần nạp index đầu tiên rồi tra RAM).
  // Memo hóa để không tạo tham chiếu mới mỗi render (tránh Autocomplete fetch lặp).
  const fetchVatTuOptions = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initProductIndex();
      return searchProducts(query);
    },
    [],
  );

  // Fetcher cho ô Mã kho: RAM-only.
  const fetchKhoOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchKho(query);
    },
    [],
  );
  const tableRef = useRef<HTMLTableElement | null>(null);
  const maVtInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const pendingFocusRowRef = useRef<number | null>(null);
  // Luôn giữ bản mới nhất của danh sách dòng để tránh callback async (lookup DmVt)
  // ghi đè các ô người dùng đã nhập (Đơn giá/Số lượng/CK...) bằng snapshot cũ.
  const itemsRef = useRef<VoucherDetail[]>(items);
  itemsRef.current = items;

  // Cho phép component cha (VoucherForm) gọi trực tiếp để focus vào ô Mã vật tư của bất kỳ dòng nào (khi Ctrl +)
  useEffect(() => {
    if (gridRef) {
      (gridRef as React.MutableRefObject<DetailGridHandle | null>).current = {
        focusMaVt: (rowIndex: number) => {
          const doFocus = () => {
            let el = maVtInputRefs.current[rowIndex];
            if (!el && tableRef.current) {
              const rows = tableRef.current.querySelectorAll("tbody tr");
              if (rows[rowIndex]) {
                el =
                  rows[rowIndex].querySelector<HTMLInputElement>(
                    "input[data-vfp-lookup='true']",
                  ) || rows[rowIndex].querySelector<HTMLInputElement>("input");
              }
            }
            if (el) {
              el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
              el.focus();
              el.select();
            }
          };
          doFocus();
          setTimeout(doFocus, 25);
        },
      };
    }
    return () => {
      if (gridRef) {
        (gridRef as React.MutableRefObject<DetailGridHandle | null>).current =
          null;
      }
    };
  }, [gridRef]);

  const prevItemsLenRef = useRef<number>(items.length);

  // Khi tạo dòng mới (từ phím Enter tại ô TT, Ctrl++, hoặc nút Thêm dòng), tự động focus ngay vào ô Mã vật tư của dòng vừa tạo
  useEffect(() => {
    const prevLen = prevItemsLenRef.current;
    prevItemsLenRef.current = items.length;
    const targetIdx =
      pendingFocusRowRef.current !== null
        ? pendingFocusRowRef.current
        : items.length > prevLen
          ? items.length - 1
          : null;
    if (targetIdx !== null) {
      pendingFocusRowRef.current = null;
      setTimeout(() => {
        const el = maVtInputRefs.current[targetIdx];
        if (el) {
          el.focus();
          el.select();
        }
      }, 20);
    }
  }, [items.length]);

  // Kiểm tra dữ liệu dòng trước khi cho phép tạo dòng mới
  const validateRow = (
    rowIdx: number,
    trEl?: HTMLTableRowElement | null,
  ): string | null => {
    const it = items[rowIdx];
    if (!it) return "Dòng dữ liệu không tồn tại.";

    if (!it.ma_vt || !it.ma_vt.trim()) {
      return `Dòng ${rowIdx + 1}: Vui lòng nhập Mã vật tư trước khi tạo dòng mới!`;
    }
    if (!it.ten_vt || !it.ten_vt.trim()) {
      return `Dòng ${rowIdx + 1}: Mã vật tư chưa hợp lệ (thiếu Tên vật tư)!`;
    }
    if (!it.dvt || !it.dvt.trim()) {
      return `Dòng ${rowIdx + 1}: Thiếu Đơn vị tính (Đvt)!`;
    }
    if (!(it.tk_du2 || it.tk_du || "").trim()) {
      return `Dòng ${rowIdx + 1}: Thiếu Tài khoản Có (TK Có)!`;
    }
    if (!it.ma_kho || !it.ma_kho.trim()) {
      return `Dòng ${rowIdx + 1}: Vui lòng chọn hoặc nhập Mã kho!`;
    }

    // Kiểm tra có ô input bắt buộc nào trong dòng bị xóa trắng không (trừ ô Chiết khấu được phép trống = 0)
    if (trEl) {
      const rowInputs = Array.from(
        trEl.querySelectorAll<HTMLInputElement>(
          "input:not([data-optional='true'])",
        ),
      );
      for (const inp of rowInputs) {
        if (inp.value.trim() === "") {
          return `Dòng ${rowIdx + 1}: Không được để trống bất kỳ ô bắt buộc nào trong dòng!`;
        }
      }
    }

    const sl9 = Number(it.so_luong9 ?? 0);
    const soTam = Number(it.so_tam ?? 0);
    const heSo8 = Number(it.he_so8 ?? 0);
    const sl8 = Number(it.so_luong8 ?? 0);

    if (isNaN(sl9) || sl9 <= 0) {
      return `Dòng ${rowIdx + 1}: Số lượng phải lớn hơn 0!`;
    }
    if (
      isNaN(soTam) ||
      soTam <= 0 ||
      isNaN(heSo8) ||
      heSo8 <= 0 ||
      isNaN(sl8) ||
      sl8 <= 0
    ) {
      return `Dòng ${rowIdx + 1}: Số tấm, Hệ số và SL bán phải lớn hơn 0!`;
    }

    const giaNt9 = Number(it.gia_nt9 ?? NaN);
    const tienNt9 = Number(it.tien_nt9 ?? NaN);
    const chietKhau = Number(it.chiet_khau ?? NaN);
    if (isNaN(giaNt9) || isNaN(tienNt9) || isNaN(chietKhau)) {
      return `Dòng ${rowIdx + 1}: Đơn giá, Thành tiền hoặc CK % không hợp lệ!`;
    }

    return null;
  };

  const tryAddNewRow = (
    fromRowIdx: number,
    trEl?: HTMLTableRowElement | null,
  ) => {
    const it = items[fromRowIdx];
    const hasMaVt = Boolean(it && it.ma_vt && it.ma_vt.trim());
    const sl = Number(it?.so_luong9 ?? it?.so_luong ?? 0);
    const hasQty = !isNaN(sl) && sl > 0;

    // Nếu chưa có mã hàng hóa hoặc số lượng bằng 0 (<= 0):
    // không thông báo nữa mà để khách hàng chạy loop mãi ở dòng đó nếu enter liên tục.
    if (!hasMaVt || !hasQty) {
      onValidationError?.(null);
      if (trEl) {
        const inputs = getRowInputs(trEl);
        if (inputs.length > 0) {
          inputs[0].focus();
          inputs[0].select();
          return;
        }
      }
      const currentMaVt = maVtInputRefs.current[fromRowIdx];
      if (currentMaVt) {
        currentMaVt.focus();
        currentMaVt.select();
      }
      return;
    }

    // Nếu đang ở dòng trước (không phải dòng cuối) và đã có dòng kế tiếp, nhảy sang dòng kế tiếp
    if (fromRowIdx < items.length - 1) {
      const nextMaVt = maVtInputRefs.current[fromRowIdx + 1];
      if (nextMaVt) {
        nextMaVt.focus();
        nextMaVt.select();
        return;
      }
    }

    const err = validateRow(fromRowIdx, trEl);
    if (err) {
      onValidationError?.(err);
      return;
    }
    onValidationError?.(null);
    pendingFocusRowRef.current = items.length;
    onAddItem?.();
  };

  // Ghi một dòng vào itemsRef NGAY LẬP TỨC (đồng bộ) rồi mới báo lên cha.
  // Nhờ vậy các bước async tiếp theo (tra giá) luôn đọc được bản mới nhất,
  // không bị ghi đè bằng snapshot cũ (mất Tên VT / TK Có vừa enrich).
  const applyRow = (idx: number, row: VoucherDetail, fieldName?: string) => {
    const next = [...itemsRef.current];
    next[idx] = row;
    itemsRef.current = next;
    onChangeItem?.(idx, row, fieldName);
  };

  // Chỉ tra cứu đầy đủ thông tin vật tư khi người dùng CHỌN từ gợi ý hoặc RỜI Ô (onBlur)
  // Tuyệt đối KHÔNG gọi async ghi đè ma_vt trong lúc người dùng đang gõ từng ký tự!
  const enrichVatTuRow = async (
    idx: number,
    rawCode: string,
    hintTenVt?: string,
  ) => {
    const cleanCode = (rawCode || "").trim().toUpperCase();
    if (!cleanCode) return;

    // 1. Ghi ngay mã + tên để UI phản hồi tức thì (giữ nguyên các ô khác của dòng hiện tại).
    const immediate = itemsRef.current[idx];
    if (!immediate) return;
    applyRow(
      idx,
      {
        ...immediate,
        ma_vt: cleanCode,
        ten_vt: hintTenVt ?? immediate.ten_vt,
        gia_tb_tt: "C",
      },
      "MA_VT",
    );

    // 2. Tra danh mục vật tư NGAY TRONG RAM (Web Worker) — tức thì, không chờ mạng.
    //    Chờ lần nạp index đầu tiên (đã khởi động từ app) rồi tra RAM.
    await initProductIndex();
    let found = await getProductByCode(cleanCode);
    // Không khớp chính xác -> chọn NGAY giá trị ĐẦU TIÊN trong dropdown (gợi ý).
    // Nếu vẫn không có gì -> fallback null (để trống danh mục).
    if (!found) {
      const suggestions = await searchProducts(cleanCode);
      const first = suggestions[0];
      if (first) {
        found = await getProductByCode(first.value);
      }
    }

    // LẤY LẠI dòng HIỆN TẠI (người dùng có thể đã sửa Đơn giá / Số tấm / Hệ số /
    // SL / Chiết khấu / Mã kho trong lúc chờ). Chỉ hợp nhất trường danh mục.
    const latest = itemsRef.current[idx];
    if (!latest) return;
    // Nếu người dùng đã đổi sang mã vật tư khác trong lúc chờ -> bỏ kết quả cũ.
    if ((latest.ma_vt || "").trim().toUpperCase() !== cleanCode) return;

    if (found) {
      const nextLoaiVt = (found.loai_vt || latest.loai_vt || "1").trim();
      const isMut = nextLoaiVt === "2" || nextLoaiVt === "4";
      // Loại 4: Hệ số bị khóa, luôn = 1.
      const isLoai4 = nextLoaiVt === "4";
      const currentSl =
        latest.so_luong9 && latest.so_luong9 > 0 ? latest.so_luong9 : 1;
      applyRow(
        idx,
        {
          ...latest,
          ma_vt: found.ma || cleanCode,
          ten_vt: found.ten || hintTenVt || latest.ten_vt || "",
          dvt: found.dvt || latest.dvt || "",
          dvt_ban: found.dvt_ban || found.dvt || latest.dvt_ban || "",
          loai_vt: nextLoaiVt,
          tk_du2: found.tk_dt || latest.tk_du2 || "5111",
          tk_du: found.tk_vt || latest.tk_du || "1561",
          tk: found.tk_gv || latest.tk || "632",
          tk_du4: found.tk_ck || latest.tk_du4 || undefined,
          he_so9: found.he_so0 || 1.0,
          so_luong9: currentSl,
          so_tam: isMut
            ? (latest.so_tam ?? 0) > 0
              ? latest.so_tam!
              : 1
            : currentSl,
          he_so8: isLoai4
            ? 1
            : isMut
              ? (latest.he_so8 ?? 0) > 0
                ? latest.he_so8!
                : 1
              : 1,
          gia_tb_tt: "C",
        },
        "MA_VT_ENRICHED",
      );
    }

    // 3. Tra đơn giá bán & chiết khấu từ bảng giá VP_2014 (BG/BG0).
    //    Chỉ tra khi ô Đơn giá đang trống/0 (khớp VFP: chỉ fill khi Gia_Nt9 rỗng).
    //    Chạy độc lập với bước 2 (BG0 cho phép mã chưa khai báo trong DmVt).
    if (!onLookupPrice) return;
    const priceRow = itemsRef.current[idx];
    if (!priceRow) return;
    // Dùng mã thực tế trên dòng (có thể đã đổi sang mã gợi ý đầu tiên).
    const priceCode = (priceRow.ma_vt || "").trim().toUpperCase();
    if (!priceCode) return;
    if (Number(priceRow.gia_nt9 ?? 0) > 0) return;

    const price = await onLookupPrice(priceCode);
    if (!price) return;

    // Đọc lại dòng mới nhất; bỏ qua nếu người dùng đã đổi mã hoặc đã tự nhập đơn giá.
    const afterPrice = itemsRef.current[idx];
    if (!afterPrice) return;
    if ((afterPrice.ma_vt || "").trim().toUpperCase() !== priceCode) return;
    if (Number(afterPrice.gia_nt9 ?? 0) > 0) return;

    applyRow(
      idx,
      {
        ...afterPrice,
        gia_nt9: price.gia_nt9,
        chiet_khau: Math.round(price.chiet_khau || 0),
        gia_tb_tt: "C",
      },
      "GIA_NT9",
    );
  };

  // ===== Điều hướng ô trong grid (mô phỏng VFP) =====
  // Danh sách ô nhập được (có class grid-cell-input, không disabled/readonly) theo thứ tự DOM.
  const getGridInputs = (el: HTMLElement): HTMLInputElement[] => {
    const table = el.closest("table");
    if (!table) return [];
    return Array.from(
      table.querySelectorAll<HTMLInputElement>(
        "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
      ),
    );
  };

  // Danh sách ô nhập được (có class grid-cell-input, không disabled/readonly) TRONG CÙNG MỘT DÒNG.
  const getRowInputs = (el: HTMLElement): HTMLInputElement[] => {
    const tr = el.closest("tr");
    if (!tr) return [];
    return Array.from(
      tr.querySelectorAll<HTMLInputElement>(
        "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
      ),
    );
  };

  // Điều hướng NGANG trong cùng một dòng (← / → / Tab / Shift+Tab).
  // - 'left'/'right': chỉ nhảy ô khi con trỏ đã ở đầu/cuối chữ (giống Excel/VFP),
  //   nếu đang ở giữa chữ thì để trình duyệt di chuyển con trỏ bình thường.
  // - 'next'/'prev': luôn nhảy ô (dùng cho Tab / Enter).
  // - wrap: true -> ở đầu/cuối dòng thì nhảy sang dòng kề (dùng cho Tab).
  const navigateCellInRow = (
    dir: "left" | "right" | "next" | "prev",
    el: HTMLInputElement,
    opts: { wrap?: boolean } = {},
  ) => {
    const inputs = getRowInputs(el);
    const idx = inputs.indexOf(el);
    if (idx < 0) return;

    if (dir === "left" || dir === "right") {
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd =
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length;
      if (dir === "left" && !atStart) return; // còn chữ bên trái -> di chuyển con trỏ
      if (dir === "right" && !atEnd) return; // còn chữ bên phải -> di chuyển con trỏ
    }

    const forward = dir === "right" || dir === "next";
    const targetIdx = forward ? idx + 1 : idx - 1;

    if (targetIdx >= 0 && targetIdx < inputs.length) {
      inputs[targetIdx].focus();
      inputs[targetIdx].select();
      return;
    }

    // Đã ở đầu/cuối dòng: nếu cho phép wrap thì nhảy sang dòng kề (giữ cột).
    if (opts.wrap) {
      const tr = el.closest("tr");
      const tbody = tr?.parentElement;
      if (!tr || !tbody) return;
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const rowIdx = rows.indexOf(tr);
      const targetRow = rows[rowIdx + (forward ? 1 : -1)];
      if (!targetRow) return;
      const td = el.closest("td");
      const cellIdx = td ? Array.from(tr.children).indexOf(td) : -1;
      if (cellIdx < 0) return;
      const targetCell = targetRow.children[cellIdx] as HTMLElement | undefined;
      const targetInput = targetCell?.querySelector<HTMLInputElement>(
        "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
      );
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    }
  };

  // Điều hướng ô: 'next'/'prev' theo thứ tự DOM; 'up'/'down' giữ nguyên cột, đổi dòng.
  const navigateCell = (dir: VfpNavDir, el: HTMLInputElement) => {
    if (dir === "up" || dir === "down") {
      const tr = el.closest("tr");
      const tbody = tr?.parentElement;
      if (!tr || !tbody) return;
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const rowIdx = rows.indexOf(tr);
      const targetRow = rows[rowIdx + (dir === "down" ? 1 : -1)];
      if (!targetRow) return;
      // Giữ nguyên chỉ số cột (td) của ô hiện tại.
      const td = el.closest("td");
      const cellIdx = td ? Array.from(tr.children).indexOf(td) : -1;
      if (cellIdx < 0) return;
      const targetCell = targetRow.children[cellIdx] as HTMLElement | undefined;
      const targetInput = targetCell?.querySelector<HTMLInputElement>(
        "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
      );
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
      return;
    }
    const inputs = getGridInputs(el);
    const idx = inputs.indexOf(el);
    if (idx < 0) return;
    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < inputs.length) {
      inputs[nextIdx].focus();
      inputs[nextIdx].select();
    }
  };

  // Callback cho các ô lookup (Mã VT / Kho): điều hướng + tạo dòng mới khi ở ô cuối dòng.
  const handleCellNavigate = (
    dir: VfpNavDir,
    el: HTMLInputElement,
    rowIdx: number,
  ) => {
    // ← / → : di chuyển ngang 1 ô, giới hạn trong cùng một dòng (kiểu Excel:
    // ô tự quyết định khi nào phát lệnh left/right, nên ở đây luôn nhảy ô).
    if (dir === "left" || dir === "right") {
      navigateCellInRow(dir === "left" ? "prev" : "next", el);
      return;
    }
    // Shift+Tab: lùi ô, ở đầu dòng thì sang dòng kề.
    if (dir === "prev") {
      navigateCellInRow("prev", el, { wrap: true });
      return;
    }
    // ↑ / ↓ : đổi dòng, giữ nguyên cột.
    if (dir === "up" || dir === "down") {
      navigateCell(dir, el);
      return;
    }
    // Enter (next): sang ô kế trong dòng; ở ô cuối dòng thì kiểm tra và tạo dòng mới.
    const inputs = getRowInputs(el);
    const idx = inputs.indexOf(el);
    if (idx === inputs.length - 1) {
      tryAddNewRow(rowIdx, el.closest("tr"));
      return;
    }
    navigateCellInRow("next", el);
  };

  // Handle cell navigation cho các ô thường (Enter / Shift+Tab / F8 / ArrowUp / ArrowDown)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    isTtCell: boolean = false,
  ) => {
    if (e.key === "F8") {
      e.preventDefault();
      e.stopPropagation();
      onDeleteItem?.(rowIdx);
      return;
    }

    // Esc: thoát ô (bỏ chọn).
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      return;
    }

    // Mũi tên (ô chỉ-chọn như TT): luôn di chuyển ô, kiểu Excel.
    const dir = arrowDir(e.key);
    if (dir) {
      e.preventDefault();
      handleCellNavigate(dir, e.currentTarget, rowIdx);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const current = e.currentTarget;

      // Nếu đang ở ô TT ("C"): kiểm tra dòng hiện tại, hợp lệ thì tạo dòng mới và focus ngay vào Mã vật tư dòng mới
      if (isTtCell) {
        const tr = current.closest("tr");
        tryAddNewRow(rowIdx, tr);
        return;
      }

      const inputs = getRowInputs(current);
      const currIdx = inputs.indexOf(current);
      if (currIdx >= 0 && currIdx < inputs.length - 1) {
        inputs[currIdx + 1].focus();
        inputs[currIdx + 1].select();
      } else if (currIdx === inputs.length - 1) {
        const tr = current.closest("tr");
        tryAddNewRow(rowIdx, tr);
      }
    } else if (e.key === "Tab") {
      // Tab / Shift+Tab: nhảy ô trong dòng; ở đầu/cuối dòng thì sang dòng kề.
      e.preventDefault();
      navigateCellInRow(e.shiftKey ? "prev" : "next", e.currentTarget, {
        wrap: true,
      });
    }
  };

  // ===== Biến thể FORM (ctbhd): đã bỏ cột Đvt bán; Disable Đvt & TK Có; TT cố định là "C" =====
  if (variant === "form") {
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="overflow-auto flex-1">
          <table
            ref={tableRef}
            className={`w-full text-left dense-table border-collapse text-[11.5px] ${
              editable ? "xl-grid" : ""
            }`}
          >
            <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wide select-none border-b border-neutral-300">
              <tr className="divide-x divide-neutral-200">
                <th className="w-9 text-center" scope="col">
                  #
                </th>
                <th className="w-36" scope="col">
                  Mã vật tư
                </th>
                <th className="min-w-[200px]" scope="col">
                  Tên vật tư
                </th>
                <th className="w-16 text-center" scope="col">
                  Đvt
                </th>
                <th className="w-24 text-right" scope="col">
                  Số lượng
                </th>
                <th className="w-16 text-center" scope="col">
                  TK Có
                </th>
                <th className="w-24 text-center" scope="col">
                  Kho
                </th>
                <th className={`w-24 text-right ${amber}`} scope="col">
                  Số tấm
                </th>
                <th className={`w-16 text-right ${amber}`} scope="col">
                  Hệ số
                </th>
                <th className={`w-24 text-right ${amber}`} scope="col">
                  SL bán
                </th>
                <th className="w-40 text-right" scope="col">
                  Đơn giá
                </th>
                <th className="w-44 text-right" scope="col">
                  Thành tiền
                </th>
                <th className="w-14 text-center" scope="col">
                  CK %
                </th>
                <th className="w-10 text-center" scope="col">
                  TT
                </th>
                {editable && (
                  <th
                    className="w-10 text-center"
                    scope="col"
                    title="Xóa dòng (F8)"
                  >
                    Xóa
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono text-neutral-700">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={editable ? 15 : 14}
                    className="px-4 py-8 text-center text-neutral-400 italic text-xs font-sans"
                  >
                    Không có dòng mặt hàng nào.{" "}
                    {editable && onAddItem && (
                      <button
                        type="button"
                        onClick={onAddItem}
                        className="text-primary-700 underline font-semibold ml-1 cursor-pointer"
                      >
                        Thêm dòng mới
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const isActive = editable && idx === activeRowIndex;

                  if (editable) {
                    return (
                      <tr
                        key={it.stt0 || idx}
                        onClick={() => onSelectRow?.(idx)}
                        className={isActive ? "xl-row-active" : undefined}
                      >
                        {/* Số dòng (kiểu tiêu đề dòng Excel) */}
                        <td className="xl-rowhead">{idx + 1}</td>
                        {/* Mã vật tư */}
                        <td className="xl-cell">
                          <VfpLookupCell
                            inputRef={(el) => {
                              maVtInputRefs.current[idx] = el;
                              if (idx === 0 && firstMaVtRef) {
                                (
                                  firstMaVtRef as React.MutableRefObject<HTMLInputElement | null>
                                ).current = el;
                              }
                            }}
                            value={it.ma_vt || ""}
                            onValueChange={(val) =>
                              // Sửa chữ -> xóa ngay Tên/Đơn giá/CK của mã cũ (như VFP)
                              // để không còn tình trạng mã mới nhưng tên/giá cũ.
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  ma_vt: val,
                                  ten_vt: "",
                                  gia_nt9: 0,
                                  chiet_khau: 0,
                                },
                                "MA_VT",
                              )
                            }
                            onPick={(opt) =>
                              enrichVatTuRow(idx, opt.value, opt.hint)
                            }
                            onCommit={(v) => enrichVatTuRow(idx, v)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            onFocusRow={() => onSelectRow?.(idx)}
                            fetcher={fetchVatTuOptions}
                            debounceMs={30}
                            maxResults={30}
                            dropdownMinWidth={420}
                            className="xl-input font-mono font-bold text-primary-800 uppercase grid-cell-input"
                          />
                        </td>
                        {/* Tên vật tư (chỉ đọc — click chọn/copy được) */}
                        <td className="xl-ro min-w-[200px] max-w-[320px]">
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            data-readonly="true"
                            value={it.ten_vt || ""}
                            title={it.ten_vt || ""}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            className="xl-ro-input font-sans text-neutral-700 truncate"
                          />
                        </td>
                        {/* Đvt (chỉ đọc — click chọn/copy được) */}
                        <td className="xl-ro">
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            data-readonly="true"
                            value={it.dvt || ""}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            className="xl-ro-input text-center font-sans"
                          />
                        </td>
                        {/* Số lượng (chỉ đọc — click chọn/copy được) */}
                        <td className="xl-ro">
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            data-readonly="true"
                            value={formatNumber2(it.so_luong9 ?? 0)}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            className="xl-ro-input text-right font-bold"
                          />
                        </td>
                        {/* TK Có (chỉ đọc — click chọn/copy được) */}
                        <td className="xl-ro">
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            data-readonly="true"
                            value={it.tk_du2 || it.tk_du || "5111"}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            className="xl-ro-input text-center font-semibold text-primary-700"
                          />
                        </td>
                        {/* Kho (VfpLookupCell DmKho) */}
                        <td className="xl-cell">
                          <VfpLookupCell
                            value={it.ma_kho || ""}
                            onValueChange={(val) =>
                              onChangeItem?.(
                                idx,
                                { ...it, ma_kho: val.toUpperCase() },
                                "MA_KHO",
                              )
                            }
                            onPick={(opt) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  ma_kho: opt.value.trim().toUpperCase(),
                                },
                                "MA_KHO",
                              )
                            }
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, ma_kho: v.trim().toUpperCase() },
                                "MA_KHO",
                              )
                            }
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            onFocusRow={() => onSelectRow?.(idx)}
                            fetcher={fetchKhoOptionsLocal}
                            dropdownMinWidth={300}
                            className="xl-input text-center font-mono font-semibold text-neutral-800 uppercase grid-cell-input"
                          />
                        </td>
                        {/* Số tấm */}
                        <td className="xl-cell xl-amber">
                          <NumCell
                            value={it.so_tam ?? 0}
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, so_tam: v },
                                "SO_TAM",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            className="xl-input text-right font-semibold text-amber-950 grid-cell-input"
                          />
                        </td>
                        {/* Hệ số (Loại 4: khóa, luôn = 1) */}
                        <td
                          className={`xl-cell xl-amber ${
                            it.loai_vt === "4" ? "xl-locked" : ""
                          }`}
                        >
                          <NumCell
                            value={it.he_so8 ?? 1}
                            disabled={it.loai_vt === "4"}
                            title={
                              it.loai_vt === "4"
                                ? "Loại vật tư 4: Hệ số cố định = 1"
                                : undefined
                            }
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, he_so8: v },
                                "HE_SO8",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            className="xl-input text-right font-medium text-amber-950 grid-cell-input"
                          />
                        </td>
                        {/* SL bán (chỉ đọc — click chọn/copy được) */}
                        <td className="xl-ro xl-amber">
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            data-readonly="true"
                            value={formatNumber2(it.so_luong8 ?? 0)}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            className="xl-ro-input text-right font-bold text-amber-950"
                          />
                        </td>
                        {/* Đơn giá */}
                        <td className="xl-cell">
                          <NumCell
                            value={it.gia_nt9 ?? 0}
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, gia_nt9: v },
                                "GIA_NT9",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            className="xl-input text-right font-medium text-neutral-800 grid-cell-input"
                          />
                        </td>
                        {/* Thành tiền */}
                        <td className="xl-cell">
                          <NumCell
                            value={it.tien_nt9 ?? 0}
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, tien_nt9: v },
                                "TIEN_NT9",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            className="xl-input text-right font-bold text-neutral-900 grid-cell-input"
                          />
                        </td>
                        {/* CK % */}
                        <td className="xl-cell">
                          <NumCell
                            value={Math.round(it.chiet_khau ?? 0)}
                            blankWhenZero
                            integerOnly
                            onCommit={(v) =>
                              onChangeItem?.(
                                idx,
                                { ...it, chiet_khau: Math.round(v) },
                                "CHIET_KHAU",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            onNavigate={(dir, el) =>
                              handleCellNavigate(dir, el, idx)
                            }
                            className="xl-input text-center font-medium text-neutral-700 grid-cell-input"
                          />
                        </td>
                        {/* TT: luôn cố định là "C" (ô chỉ-chọn), bấm Enter tại ô này sẽ kiểm tra dòng và tạo dòng mới */}
                        <td className="xl-cell">
                          <input
                            type="text"
                            value="C"
                            readOnly
                            data-mode="select"
                            onMouseDown={(e) => handleExcelMouseDown(e, "select")}
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              selectAllLater(e.currentTarget);
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, true)}
                            title="Cố định là C — Bấm Enter để tạo dòng mới"
                            className="xl-input text-center font-bold text-success-700 uppercase grid-cell-input"
                          />
                        </td>
                        <td className="xl-ro text-center !px-0">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem?.(idx);
                            }}
                            disabled={items.length <= 1}
                            title="Xóa dòng (F8)"
                            className="p-0.5 text-neutral-400 hover:text-danger-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Non-editable form row
                  return (
                    <tr
                      key={it.stt0 || idx}
                      className="hover:bg-secondary-50/40 transition-colors divide-x divide-neutral-100"
                    >
                      <td className="py-1 text-center font-sans text-neutral-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-2.5 font-bold text-primary-800">
                        {it.ma_vt}
                      </td>
                      <td
                        className="py-1 px-3 font-sans font-medium text-neutral-800 truncate max-w-[320px]"
                        title={it.ten_vt || ""}
                      >
                        {it.ten_vt || "—"}
                      </td>
                      <td className="py-1 text-center font-sans text-neutral-600">
                        {it.dvt || "—"}
                      </td>
                      <td className="py-1 text-right font-semibold text-neutral-900">
                        {formatQuantity(it.so_luong9)}
                      </td>
                      <td className="py-1 text-center text-primary-700 font-medium">
                        {it.tk_du || it.tk_du2 || "—"}
                      </td>
                      <td className="py-1 text-center font-medium text-neutral-600">
                        {it.ma_kho || "—"}
                      </td>
                      <td className={`py-1 text-right font-medium ${amber}`}>
                        {formatQuantity(it.so_tam)}
                      </td>
                      <td className={`py-1 text-right font-medium ${amber}`}>
                        {formatQuantity(it.he_so8)}
                      </td>
                      <td className={`py-1 text-right font-semibold ${amber}`}>
                        {formatQuantity(it.so_luong8)}
                      </td>
                      <td className="py-1 text-right text-neutral-700">
                        {formatCurrency(it.gia_nt9, currency)}
                      </td>
                      <td className="py-1 text-right font-bold text-neutral-900 bg-neutral-50/60">
                        {formatCurrency(it.tien_nt9, currency)}
                      </td>
                      <td className="py-1 text-center font-sans text-neutral-400">
                        {it.chiet_khau && Number(it.chiet_khau) !== 0
                          ? Math.round(Number(it.chiet_khau))
                          : ""}
                      </td>
                      <td className="py-1 text-center font-bold text-success-700 font-sans">
                        C
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ===== Biến thể LIST (ctbhh) =====
  return (
    <div
      className={
        embedded
          ? "w-full h-full flex flex-col bg-white overflow-hidden"
          : "w-full border border-neutral-300 rounded overflow-hidden bg-white flex flex-col"
      }
    >
      <div
        className={
          embedded ? "overflow-auto flex-1" : "overflow-x-auto max-h-[360px]"
        }
      >
        <table className="w-full text-left dense-table border-collapse text-[12.5px]">
          <thead className="bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
            <tr>
              <th
                className="w-10 text-center border-r border-neutral-200"
                scope="col"
              >
                #
              </th>
              <th
                className="w-36 text-left border-r border-neutral-200 font-mono"
                scope="col"
              >
                Mã vật tư
              </th>
              <th
                className="min-w-[320px] border-r border-neutral-200"
                scope="col"
              >
                Tên vật tư
              </th>
              <th
                className="w-20 text-center border-r border-neutral-200"
                scope="col"
              >
                Mã kho
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                SL xuất
              </th>
              <th
                className="w-20 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Số tấm
              </th>
              <th
                className="w-20 text-center border-r border-neutral-200"
                scope="col"
              >
                Đvt
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Hệ số
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                SL bán
              </th>
              <th
                className="w-32 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Đơn giá
              </th>
              <th className="w-36 text-right pr-3 font-mono" scope="col">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 font-sans">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-6 text-center text-neutral-400 italic text-xs"
                >
                  Không có dòng mặt hàng nào
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr
                  key={it.stt0 || idx}
                  className="hover:bg-neutral-50 transition"
                >
                  <td className="text-center font-mono text-neutral-400 border-r border-neutral-200 text-xs">
                    {idx + 1}
                  </td>
                  <td className="font-mono text-primary-800 font-semibold border-r border-neutral-200">
                    {it.ma_vt}
                  </td>
                  <td className="font-medium text-neutral-900 border-r border-neutral-200">
                    {it.ten_vt || "—"}
                  </td>
                  <td className="text-center font-mono text-neutral-700 border-r border-neutral-200 font-medium bg-neutral-50/50">
                    {it.ma_kho || "—"}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatQuantity(it.so_luong9)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatQuantity(it.so_tam)}
                  </td>
                  <td className="text-center text-neutral-700 border-r border-neutral-200">
                    {it.dvt || "—"}
                  </td>
                  <td className="text-right font-mono text-neutral-700 border-r border-neutral-200">
                    {formatQuantity(it.he_so8)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200 font-medium">
                    {formatQuantity(it.so_luong8)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatCurrency(it.gia_nt9, currency)}
                  </td>
                  <td className="text-right font-mono font-semibold text-neutral-900 pr-3">
                    {formatCurrency(it.tien_nt9, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
