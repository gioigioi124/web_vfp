import React, { useCallback, useEffect, useRef, useState } from "react";
import { VoucherDetail } from "../types/voucher";
import {
  searchProducts,
  getProductByCode,
  initProductIndex,
} from "../lib/productIndex";
import { initCatalogCache, searchKho } from "../lib/catalogCache";
import { AutocompleteOption } from "./ui/Autocomplete";
import { VfpNavDir } from "./ui/VfpLookupCell";
import { arrowDir } from "./ui/excelCell";
import { DetailGridListView } from "./detail-grid/DetailGridListView";
import { DetailGridFormRow } from "./detail-grid/DetailGridFormRow";

/** Kết quả tra giá trả về cho DetailGrid (đơn giá ngoại tệ + % chiết khấu). */
export interface PriceLookupResult {
  gia_nt9: number;
  chiet_khau: number;
  expired?: boolean;
}

export interface DetailGridHandle {
  focusMaVt: (rowIndex: number) => void;
  getFocusedColumnIndex: () => number | undefined;
  scheduleFocusCell: (rowIndex: number, colIndex?: number) => void;
}

interface DetailGridProps {
  items: VoucherDetail[];
  currency?: string;
  /** Khi true: bảng lấp đầy chiều cao khung cha (dùng trong split view của ctbhh). */
  embedded?: boolean;
  /** 'list' (ctbhh) hoặc 'form' (ctbhd - thêm cột TK Có / CK / TT). */
  variant?: "list" | "form";
  /** Chế độ nghiệp vụ: 'sales' | 'return' (VP_2014) hoặc 'warehouse' (KH_2014). */
  voucherMode?: "sales" | "return" | "warehouse";
  /** Mã chứng từ ('X1' | 'N5') dùng để xác định nhãn, TK và cột TT = K khi nhập lại. */
  maCt?: string;
  /** Chế độ sửa dữ liệu (Phase 2) */
  editable?: boolean;
  /** Bật/tắt tô đậm kích thước và độ dày trong cột Tên vật tư (biến thể form). */
  highlightSpecs?: boolean;
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

export const DetailGrid: React.FC<DetailGridProps> = React.memo(
  ({
    items,
    currency = "VND",
    embedded = false,
    variant = "list",
    voucherMode = "sales",
    maCt,
    editable = false,
    highlightSpecs = false,
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
    const isWarehouse = voucherMode === "warehouse";
    const isReturn =
      (maCt || (voucherMode === "return" ? "N5" : "X1"))
        .trim()
        .toUpperCase() === "N5";
    const defaultTt = isReturn ? "K" : "C";

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
    const pendingFocusCellRef = useRef<{
      rowIdx: number;
      colIdx?: number;
    } | null>(null);
    const lastFocusedCellRef = useRef<{
      rowIdx: number;
      colIdx?: number;
    } | null>(null);
    const [internalActiveRow, setInternalActiveRow] = useState<number>(0);

    useEffect(() => {
      if (!onSelectRow) {
        setInternalActiveRow(0);
      }
    }, [items, onSelectRow]);

    const currentActiveRow = onSelectRow ? activeRowIndex : internalActiveRow;
    const handleSelectRow = useCallback(
      (idx: number) => {
        setInternalActiveRow(idx);
        onSelectRow?.(idx);
      },
      [onSelectRow],
    );

    const ensureTrVisible = useCallback((tr: HTMLTableRowElement | null) => {
      if (!tr) return;
      const table = tr.closest("table");
      const container = table?.parentElement;
      if (!table || !container) return;
      const thead = table.querySelector("thead");
      const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
      const cRect = container.getBoundingClientRect();
      const rRect = tr.getBoundingClientRect();
      const visibleTop = cRect.top + headerHeight;
      const visibleBottom = cRect.top + container.clientHeight;
      if (rRect.top < visibleTop) {
        container.scrollTop -= visibleTop - rRect.top;
      } else if (rRect.bottom > visibleBottom) {
        container.scrollTop += rRect.bottom - visibleBottom;
      }
    }, []);

    const handleReadOnlyCopy = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const el = e.currentTarget;
        if (el.selectionStart === el.selectionEnd && el.value) {
          e.clipboardData.setData("text/plain", el.value);
          e.preventDefault();
        }
      },
      [],
    );

    // Điều hướng bằng phím mũi tên / Tab cho các ô chỉ đọc (readOnly)
    const handleReadOnlyCellKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (
          e.key === "Enter" &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.metaKey &&
          !e.altKey &&
          variant === "form" &&
          editable
        ) {
          e.preventDefault();
          e.stopPropagation();
          const el = e.currentTarget;
          const tr = el.closest("tr");
          const td = el.closest("td");
          if (!tr || !td) return;
          const cells = Array.from(tr.children);
          const currCol = cells.indexOf(td);
          for (let i = currCol + 1; i < cells.length; i++) {
            const nextEditable = cells[i].querySelector<HTMLInputElement>(
              "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
            );
            if (nextEditable) {
              nextEditable.focus({ preventScroll: true });
              nextEditable.select();
              return;
            }
          }
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
          return;
        }

        const dir = arrowDir(e.key);
        if (dir === "up" || dir === "down") {
          e.preventDefault();
          e.stopPropagation();
          const el = e.currentTarget;
          const tr = el.closest("tr");
          const tbody = tr?.parentElement;
          if (!tr || !tbody) return;
          const rows = Array.from(
            tbody.querySelectorAll<HTMLTableRowElement>("tr"),
          );
          const rowIdx = rows.indexOf(tr);
          const targetRow = rows[rowIdx + (dir === "down" ? 1 : -1)];
          if (!targetRow) return;
          const td = el.closest("td");
          const cellIdx = td ? Array.from(tr.children).indexOf(td) : -1;
          if (cellIdx < 0) return;
          const targetCell = targetRow.children[cellIdx] as
            | HTMLElement
            | undefined;
          const targetInput =
            targetCell?.querySelector<HTMLInputElement>("input");
          if (targetInput) {
            targetInput.focus({ preventScroll: true });
            targetInput.select();
            ensureTrVisible(targetRow);
          }
          return;
        }

        if (dir === "left" || dir === "right" || e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          const el = e.currentTarget;
          const tr = el.closest("tr");
          if (!tr) return;
          const rowInputs = Array.from(
            tr.querySelectorAll<HTMLInputElement>("input:not([disabled])"),
          );
          const idx = rowInputs.indexOf(el);
          if (idx < 0) return;
          const forward = dir === "right" || (e.key === "Tab" && !e.shiftKey);
          const targetIdx = forward ? idx + 1 : idx - 1;
          if (targetIdx >= 0 && targetIdx < rowInputs.length) {
            rowInputs[targetIdx].focus({ preventScroll: true });
            rowInputs[targetIdx].select();
            return;
          }
          if (e.key === "Tab") {
            const tbody = tr.parentElement;
            if (!tbody) return;
            const rows = Array.from(
              tbody.querySelectorAll<HTMLTableRowElement>("tr"),
            );
            const rowIdx = rows.indexOf(tr);
            const targetRow = rows[rowIdx + (forward ? 1 : -1)];
            if (!targetRow) return;
            const nextRowInputs = Array.from(
              targetRow.querySelectorAll<HTMLInputElement>(
                "input:not([disabled])",
              ),
            );
            const wrapInput = forward
              ? nextRowInputs[0]
              : nextRowInputs[nextRowInputs.length - 1];
            if (wrapInput) {
              wrapInput.focus({ preventScroll: true });
              wrapInput.select();
              ensureTrVisible(targetRow);
            }
          }
        }
      },
      [ensureTrVisible, variant, editable],
    );

    // Luôn giữ bản mới nhất của danh sách dòng để tránh callback async (lookup DmVt)
    // ghi đè các ô người dùng đã nhập (Đơn giá/Số lượng/CK...) bằng snapshot cũ.
    const itemsRef = useRef<VoucherDetail[]>(items);
    itemsRef.current = items;

    // Cho phép component cha (VoucherForm) gọi trực tiếp để focus vào ô Mã vật tư hoặc khôi phục focus sau khi xóa dòng
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
          getFocusedColumnIndex: () => {
            const activeEl = document.activeElement;
            const table = tableRef.current;
            if (
              !table ||
              !(activeEl instanceof HTMLInputElement) ||
              !table.contains(activeEl)
            ) {
              return undefined;
            }
            const td = activeEl.closest("td");
            const tr = td?.closest("tr");
            if (!td || !tr) return undefined;
            const idx = Array.from(tr.children).indexOf(td);
            return idx >= 0 ? idx : undefined;
          },
          scheduleFocusCell: (rowIndex: number, colIndex?: number) => {
            pendingFocusCellRef.current = { rowIdx: rowIndex, colIdx: colIndex };
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

    // Tự động focus sau khi xóa dòng hoặc khi thêm dòng mới
    useEffect(() => {
      const prevLen = prevItemsLenRef.current;
      prevItemsLenRef.current = items.length;

      if (pendingFocusCellRef.current !== null) {
        const { rowIdx, colIdx } = pendingFocusCellRef.current;
        pendingFocusCellRef.current = null;
        pendingFocusRowRef.current = null;

        const focusTargetCell = () => {
          const rows = tableRef.current?.querySelectorAll<HTMLTableRowElement>(
            "tbody tr",
          );
          const targetRow = rows?.[rowIdx];
          if (!targetRow) return;

          let targetInput: HTMLInputElement | null = null;
          if (colIdx !== undefined) {
            const td = targetRow.children[colIdx] as HTMLElement | undefined;
            targetInput =
              td?.querySelector<HTMLInputElement>(
                "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
              ) || null;
          }
          if (!targetInput) {
            targetInput =
              targetRow.querySelector<HTMLInputElement>(
                "input[data-vfp-lookup='true']:not([disabled]):not([data-readonly='true'])",
              ) ||
              maVtInputRefs.current[rowIdx] ||
              targetRow.querySelector<HTMLInputElement>(
                "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
              ) ||
              targetRow.querySelector<HTMLInputElement>("input");
          }
          if (targetInput) {
            targetInput.focus({ preventScroll: true });
            targetInput.select();
            ensureTrVisible(targetRow);
          }
        };

        focusTargetCell();
        window.requestAnimationFrame(() => {
          if (
            tableRef.current &&
            !tableRef.current.contains(document.activeElement)
          ) {
            focusTargetCell();
          }
        });
        return;
      }

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
    }, [items, ensureTrVisible]);

    // ===== Điều hướng ô trong grid (mô phỏng VFP) =====
    // Danh sách ô nhập được (có class grid-cell-input, không disabled/readonly) theo thứ tự DOM.
    const getGridInputs = useCallback((el: HTMLElement): HTMLInputElement[] => {
      const table = el.closest("table");
      if (!table) return [];
      return Array.from(
        table.querySelectorAll<HTMLInputElement>(
          "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
        ),
      );
    }, []);

    // Danh sách ô nhập được (có class grid-cell-input, không disabled/readonly) TRONG CÙNG MỘT DÒNG.
    const getRowInputs = useCallback((el: HTMLElement): HTMLInputElement[] => {
      const tr = el.closest("tr");
      if (!tr) return [];
      return Array.from(
        tr.querySelectorAll<HTMLInputElement>(
          "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
        ),
      );
    }, []);

    // Kiểm tra dữ liệu dòng trước khi cho phép tạo dòng mới
    const validateRow = useCallback(
      (rowIdx: number, trEl?: HTMLTableRowElement | null): string | null => {
        const it = itemsRef.current[rowIdx];
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
        if (!isWarehouse && !(it.tk_du2 || it.tk_du || "").trim()) {
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

        if (!isWarehouse) {
          const giaNt9 = Number(it.gia_nt9 ?? NaN);
          const tienNt9 = Number(it.tien_nt9 ?? NaN);
          const chietKhau = Number(it.chiet_khau ?? NaN);
          if (isNaN(giaNt9) || isNaN(tienNt9) || isNaN(chietKhau)) {
            return `Dòng ${rowIdx + 1}: Đơn giá, Thành tiền hoặc CK % không hợp lệ!`;
          }
        }

        return null;
      },
      [isWarehouse],
    );

    const tryAddNewRow = useCallback(
      (fromRowIdx: number, trEl?: HTMLTableRowElement | null) => {
        const currentList = itemsRef.current;
        const it = currentList[fromRowIdx];
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
        if (fromRowIdx < currentList.length - 1) {
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
        pendingFocusRowRef.current = currentList.length;
        onAddItem?.();
      },
      [getRowInputs, onAddItem, onValidationError, validateRow],
    );

    // Ghi một dòng vào itemsRef NGAY LẬP TỨC (đồng bộ) rồi mới báo lên cha.
    // Nhờ vậy các bước async tiếp theo (tra giá) luôn đọc được bản mới nhất,
    // không bị ghi đè bằng snapshot cũ (mất Tên VT / TK Có vừa enrich).
    const applyRow = useCallback(
      (idx: number, row: VoucherDetail, fieldName?: string) => {
        const next = [...itemsRef.current];
        next[idx] = row;
        itemsRef.current = next;
        onChangeItem?.(idx, row, fieldName);
      },
      [onChangeItem],
    );

    // Chỉ tra cứu đầy đủ thông tin vật tư khi người dùng CHỌN từ gợi ý hoặc RỜI Ô (onBlur)
    // Tuyệt đối KHÔNG gọi async ghi đè ma_vt trong lúc người dùng đang gõ từng ký tự!
    const enrichVatTuRow = useCallback(
      async (idx: number, rawCode: string, hintTenVt?: string) => {
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
            gia_tb_tt: defaultTt,
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
          const nextAccounts = isReturn
            ? {
                tk: found.tk_vt || latest.tk || "1561",
                tk_du: found.tk_gv || latest.tk_du || "632",
                tk_du2: found.tk_hbtl || latest.tk_du2 || "5212",
              }
            : {
                tk_du2: found.tk_dt || latest.tk_du2 || "5111",
                tk_du: found.tk_vt || latest.tk_du || "1561",
                tk: found.tk_gv || latest.tk || "632",
              };
          applyRow(
            idx,
            {
              ...latest,
              ma_vt: found.ma || cleanCode,
              ten_vt: found.ten || hintTenVt || latest.ten_vt || "",
              dvt: found.dvt || latest.dvt || "",
              dvt_ban: found.dvt_ban || found.dvt || latest.dvt_ban || "",
              loai_vt: nextLoaiVt,
              ma_kho: (found.ma_kho || latest.ma_kho || "K0101")
                .trim()
                .toUpperCase(),
              ...nextAccounts,
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
              gia_tb_tt: defaultTt,
            },
            "MA_VT_ENRICHED",
          );
        }

        // 3. Tra đơn giá bán & chiết khấu từ bảng giá VP_2014 (BG/BG0).
        //    Chỉ tra khi ô Đơn giá đang trống/0 (khớp VFP: chỉ fill khi Gia_Nt9 rỗng).
        //    Chạy độc lập với bước 2 (BG0 cho phép mã chưa khai báo trong DmVt).
        if (isWarehouse || !onLookupPrice) return;
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
            gia_tb_tt: defaultTt,
          },
          "GIA_NT9",
        );
      },
      [applyRow, defaultTt, isReturn, isWarehouse, onLookupPrice],
    );

    // Điều hướng NGANG trong cùng một dòng (← / → / Tab / Shift+Tab).
    const navigateCellInRow = useCallback(
      (
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
          if (dir === "left" && !atStart) return;
          if (dir === "right" && !atEnd) return;
        }

        const forward = dir === "right" || dir === "next";
        const targetIdx = forward ? idx + 1 : idx - 1;

        if (targetIdx >= 0 && targetIdx < inputs.length) {
          inputs[targetIdx].focus();
          inputs[targetIdx].select();
          return;
        }

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
          const targetCell = targetRow.children[cellIdx] as
            | HTMLElement
            | undefined;
          const targetInput = targetCell?.querySelector<HTMLInputElement>(
            "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
          );
          if (targetInput) {
            targetInput.focus();
            targetInput.select();
          }
        }
      },
      [getRowInputs],
    );

    // Điều hướng ô: 'next'/'prev' theo thứ tự DOM; 'up'/'down' giữ nguyên cột, đổi dòng.
    const navigateCell = useCallback(
      (dir: VfpNavDir, el: HTMLInputElement) => {
        if (dir === "up" || dir === "down") {
          const tr = el.closest("tr");
          const tbody = tr?.parentElement;
          if (!tr || !tbody) return;
          const rows = Array.from(tbody.querySelectorAll("tr"));
          const rowIdx = rows.indexOf(tr);
          const targetRow = rows[rowIdx + (dir === "down" ? 1 : -1)];
          if (!targetRow) return;
          const td = el.closest("td");
          const cellIdx = td ? Array.from(tr.children).indexOf(td) : -1;
          if (cellIdx < 0) return;
          const targetCell = targetRow.children[cellIdx] as
            | HTMLElement
            | undefined;
          let targetInput =
            targetCell?.querySelector<HTMLInputElement>(
              "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
            ) ||
            targetCell?.querySelector<HTMLInputElement>(
              "input.grid-cell-input:not([disabled])",
            );
          if (!targetInput) {
            // Fallback khi dòng đích là dòng dịch vụ (loai_vt === "4") có ô bị disabled:
            // tìm ô gần nhất có thể focus trong dòng đích để không bị kẹt phím ↑/↓.
            const rowCells = Array.from(targetRow.children);
            for (let offset = 1; offset < rowCells.length; offset++) {
              for (const candidateIdx of [cellIdx - offset, cellIdx + offset]) {
                if (candidateIdx < 0 || candidateIdx >= rowCells.length)
                  continue;
                const candidate = (
                  rowCells[candidateIdx] as HTMLElement | undefined
                )?.querySelector<HTMLInputElement>(
                  "input.grid-cell-input:not([disabled]):not([data-readonly='true'])",
                );
                if (candidate) {
                  targetInput = candidate;
                  break;
                }
              }
              if (targetInput) break;
            }
          }
          if (targetInput) {
            targetInput.focus({ preventScroll: true });
            targetInput.select();
            ensureTrVisible(targetRow as HTMLTableRowElement);
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
      },
      [ensureTrVisible, getGridInputs],
    );

    // Callback cho các ô lookup (Mã VT / Kho): điều hướng + tạo dòng mới khi ở ô cuối dòng.
    const handleCellNavigate = useCallback(
      (dir: VfpNavDir, el: HTMLInputElement, rowIdx: number) => {
        if (dir === "left" || dir === "right") {
          navigateCellInRow(dir === "left" ? "prev" : "next", el);
          return;
        }
        if (dir === "prev") {
          navigateCellInRow("prev", el, { wrap: true });
          return;
        }
        if (dir === "up" || dir === "down") {
          navigateCell(dir, el);
          return;
        }
        const inputs = getRowInputs(el);
        const idx = inputs.indexOf(el);
        if (idx === inputs.length - 1) {
          tryAddNewRow(rowIdx, el.closest("tr"));
          return;
        }
        navigateCellInRow("next", el);
      },
      [getRowInputs, navigateCell, navigateCellInRow, tryAddNewRow],
    );

    // Handle cell navigation cho các ô thường (Enter / Shift+Tab / F8 / ArrowUp / ArrowDown)
    const handleCellKeyDown = useCallback(
      (
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

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
          return;
        }

        const dir = arrowDir(e.key);
        if (dir) {
          e.preventDefault();
          handleCellNavigate(dir, e.currentTarget, rowIdx);
          return;
        }

        if (
          e.key === "Enter" &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          const current = e.currentTarget;

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
          e.preventDefault();
          navigateCellInRow(e.shiftKey ? "prev" : "next", e.currentTarget, {
            wrap: true,
          });
        }
      },
      [
        getRowInputs,
        handleCellNavigate,
        navigateCellInRow,
        onDeleteItem,
        tryAddNewRow,
      ],
    );

    const handleFormTableFocusCapture = useCallback(
      (e: React.FocusEvent<HTMLTableElement>) => {
        const target = e.target;
        const table = tableRef.current;
        if (!table || !(target instanceof HTMLElement)) return;
        const tr = target.closest("tbody tr");
        const td = target.closest("td");
        if (!tr || !td) return;
        const rowIdx = Array.from(table.querySelectorAll("tbody tr")).indexOf(
          tr as HTMLTableRowElement,
        );
        if (rowIdx < 0) return;
        const colIdx = Array.from(tr.children).indexOf(td);
        lastFocusedCellRef.current = {
          rowIdx,
          colIdx: colIdx >= 0 ? colIdx : undefined,
        };
      },
      [],
    );

    const handleFormGridMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        // Không chặn thao tác kéo thanh cuộn dọc/ngang
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        if (
          e.clientX - rect.left >= container.clientWidth ||
          e.clientY - rect.top >= container.clientHeight
        ) {
          return;
        }

        // Chỉ xử lý khi click vào vùng trống bên ngoài các dòng dữ liệu và control tương tác
        const target = e.target as HTMLElement | null;
        if (
          !target ||
          target.closest("tbody tr") ||
          target.closest("button, input, select, textarea, a, [role='button']")
        ) {
          return;
        }

        e.preventDefault();

        const table = tableRef.current;
        if (!table) return;
        const activeEl = document.activeElement;
        if (activeEl && table.contains(activeEl)) {
          return;
        }

        const rows = Array.from(table.querySelectorAll("tbody tr"));
        if (rows.length === 0) return;

        const tryFocusInRow = (rowIdx: number, colIdx?: number): boolean => {
          const row = rows[rowIdx];
          if (!row) return false;
          if (typeof colIdx === "number") {
            const cell = row.children[colIdx];
            const input = cell?.querySelector<HTMLInputElement>(
              "input:not(:disabled)",
            );
            if (input) {
              input.focus({ preventScroll: true });
              return true;
            }
          }
          const maVt = maVtInputRefs.current[rowIdx];
          if (maVt && !maVt.disabled) {
            maVt.focus({ preventScroll: true });
            return true;
          }
          const anyInput = row.querySelector<HTMLInputElement>(
            "input:not(:disabled)",
          );
          if (anyInput) {
            anyInput.focus({ preventScroll: true });
            return true;
          }
          return false;
        };

        const last = lastFocusedCellRef.current;
        if (last && tryFocusInRow(last.rowIdx, last.colIdx)) {
          return;
        }
        if (tryFocusInRow(currentActiveRow)) {
          return;
        }
        tryFocusInRow(0);
      },
      [currentActiveRow],
    );

    // ===== Biến thể FORM (ctbhd): đã bỏ cột Đvt bán; Disable Đvt & TK Có; TT cố định là "C" =====
    if (variant === "form") {
      return (
        <div className="w-full h-full flex flex-col bg-white overflow-hidden">
          <div
            className="overflow-auto flex-1 table-sticky-header"
            onMouseDown={handleFormGridMouseDown}
          >
            <table
              ref={tableRef}
              onFocusCapture={handleFormTableFocusCapture}
              className="w-full min-w-[1120px] table-fixed text-left dense-table border-collapse text-[11.5px] xl-grid xl-grid-no-hover"
            >
              <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 [&_th]:!px-1 text-neutral-700 font-semibold text-[10.5px] uppercase tracking-tight select-none border-b border-neutral-300">
                <tr className="divide-x divide-neutral-200">
                  <th className="w-7 text-center" scope="col">
                    #
                  </th>
                  <th className="w-[116px]" scope="col">
                    Mã vật tư
                  </th>
                  <th className="w-auto" scope="col">
                    Tên vật tư
                  </th>
                  <th className="w-[42px] text-center" scope="col">
                    Đvt
                  </th>
                  <th className="w-[66px] text-right" scope="col">
                    Số lượng
                  </th>
                  {!isWarehouse && (
                    <th className="w-[46px] text-center" scope="col">
                      {isReturn ? "TK Nợ" : "TK Có"}
                    </th>
                  )}
                  <th className="w-[56px] text-center" scope="col">
                    Kho
                  </th>
                  <th className="w-[56px] text-right" scope="col">
                    Số tấm
                  </th>
                  <th className="w-[44px] text-right" scope="col">
                    Hệ số
                  </th>
                  <th className="w-[66px] text-right" scope="col">
                    {isReturn ? "SL nhập" : "SL bán"}
                  </th>
                  {!isWarehouse && (
                    <>
                      <th className="w-[96px] text-right" scope="col">
                        Đơn giá
                      </th>
                      <th className="w-[108px] text-right" scope="col">
                        Thành tiền
                      </th>
                      <th className="w-[44px] text-center" scope="col">
                        CK %
                      </th>
                    </>
                  )}
                  <th className="w-7 text-center" scope="col">
                    TT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-sans text-neutral-900 font-semibold">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isWarehouse ? 10 : 14}
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
                  items.map((it, idx) => (
                    <DetailGridFormRow
                      key={it.stt0 || idx}
                      item={it}
                      idx={idx}
                      isActive={idx === currentActiveRow}
                      editable={editable}
                      isWarehouse={isWarehouse}
                      isReturn={isReturn}
                      currency={currency}
                      highlightSpecs={highlightSpecs}
                      itemsRef={itemsRef}
                      maVtInputRefs={maVtInputRefs}
                      firstMaVtRef={firstMaVtRef}
                      fetchVatTuOptions={fetchVatTuOptions}
                      fetchKhoOptionsLocal={fetchKhoOptionsLocal}
                      onSelectRow={handleSelectRow}
                      onApplyRow={applyRow}
                      onEnrichVatTuRow={enrichVatTuRow}
                      onCellNavigate={handleCellNavigate}
                      onCellKeyDown={handleCellKeyDown}
                      onReadOnlyKeyDown={handleReadOnlyCellKeyDown}
                      onReadOnlyCopy={handleReadOnlyCopy}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ===== Biến thể LIST (ctbhh) =====
    return (
      <DetailGridListView
        items={items}
        currency={currency}
        embedded={embedded}
        isWarehouse={isWarehouse}
        isReturn={isReturn}
        currentActiveRow={currentActiveRow}
        tableRef={tableRef}
        onSelectRow={handleSelectRow}
        onKeyDown={handleReadOnlyCellKeyDown}
        onCopy={handleReadOnlyCopy}
      />
    );
  },
);

DetailGrid.displayName = "DetailGrid";
