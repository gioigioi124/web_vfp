import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Save, Trash2, X } from "lucide-react";
import {
  DOC_MODULE_CONFIGS,
  DocModuleConfig,
  DocModuleKey,
  ModuleVoucherDetailItem,
  ModuleVoucherDetailResponse,
  ModuleVoucherSavePayload,
} from "../../types/moduleVoucher";
import { ChungTuItem, VatTuItem } from "../../types/lookup";
import {
  formatNumber0,
  formatNumber2,
  getTodayDate,
} from "../../lib/format";
import { useIsMobile } from "../../hooks/useViewport";
import { MobileModuleDetailList } from "./MobileModuleDetailList";
import { useModalLock } from "../../lib/modalLock";
import {
  getCustomer,
  initCustomerIndex,
  searchCustomers,
} from "../../lib/customerIndex";
import {
  getProductByCode,
  initProductIndex,
  searchProducts,
} from "../../lib/productIndex";
import {
  getDocumentsByModule,
  getKho,
  getNhapXuat,
  getTaiKhoan,
  getThueList,
  getTienTeList,
  initCatalogCache,
  searchBoPhan,
  searchKho,
  searchKhoanMuc,
  searchNhapXuat,
  searchSanPham,
  searchTaiKhoan,
} from "../../lib/catalogCache";
import { lookupVatTu } from "../../lib/lookups";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { VfpLookupCell, VfpNavDir } from "../ui/VfpLookupCell";
import { NumCell } from "../detail-grid/NumCell";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { arrowDir } from "../ui/excelCell";
import { extractApiError } from "../ui/SqlErrorState";

interface GenericVoucherFormModalProps {
  open: boolean;
  moduleKey: DocModuleKey;
  stt: string | null;
  onClose: () => void;
  onSaved: (saved: ModuleVoucherDetailResponse) => void;
}

function makeEmptyDetailRow(config: DocModuleConfig, defaultTk = config.defaultMainTk): ModuleVoucherDetailItem {
  return {
    stt0: Math.random().toString(36).slice(2, 10),
    stt_nv: 1,
    ma_kho: config.detailKind === "gl" ? "" : "K1",
    ma_kho_n: config.detailKind === "transfer" ? "K2" : "",
    ma_vt: "",
    ten_vt: "",
    dvt: "",
    he_so9: 1,
    so_luong9: config.detailKind === "gl" ? 0 : 1,
    gia_nt9: 0,
    tien_nt9: 0,
    so_luong: config.detailKind === "gl" ? 0 : 1,
    gia_nt: 0,
    tien_nt: 0,
    tien_nt3: 0,
    gia_tb_tt: " ",
    no_co: "N",
    tk: config.detailKind === "gl" ? config.defaultOffsetTk : defaultTk,
    tk_du: config.defaultOffsetTk,
    dien_giai: "",
    ma_dt: "",
    ma_bp: "",
    ma_km: "",
    ma_sp: "",
    ma_hd: "",
  };
}

interface UnitOption {
  dvt: string;
  he_so: number;
}

function getUnitOptions(v?: VatTuItem | null): UnitOption[] {
  if (!v) return [];
  const opts: UnitOption[] = [];
  const seen = new Set<string>();
  const add = (d?: string, hs?: number) => {
    const clean = (d || "").trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    opts.push({ dvt: clean, he_so: hs && hs > 0 ? hs : 1 });
  };
  add(v.dvt, 1);
  add(v.dvt0, v.he_so0);
  add(v.dvt1, v.he_so1);
  add(v.dvt2, v.he_so2);
  return opts;
}

export const GenericVoucherFormModal: React.FC<GenericVoucherFormModalProps> = ({
  open,
  moduleKey,
  stt,
  onClose,
  onSaved,
}) => {
  const isMobile = useIsMobile();
  const [showMobileTax, setShowMobileTax] = useState(false);
  const config = DOC_MODULE_CONFIGS[moduleKey];
  const modalRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  useModalLock(open, modalRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docList, setDocList] = useState<ChungTuItem[]>([]);
  const [vatTuMeta, setVatTuMeta] = useState<Record<string, VatTuItem>>({});

  const [ngayCt, setNgayCt] = useState(getTodayDate());
  const [soCt, setSoCt] = useState("");
  const [customSoCt, setCustomSoCt] = useState(false);
  const [maCt, setMaCt] = useState(config.defaultMaCt);
  const [nhCt, setNhCt] = useState("1");
  const [maDt, setMaDt] = useState("");
  const [tenDt, setTenDt] = useState("");
  const [ongBa, setOngBa] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [maNx, setMaNx] = useState("");
  const [tk, setTk] = useState(config.defaultMainTk);
  const [dienGiai0, setDienGiai0] = useState("");
  const [maTte, setMaTte] = useState("VND");
  const [tyGia, setTyGia] = useState(1);
  const [ctDiKem, setCtDiKem] = useState("");

  // Tax fields (purchase receipts)
  const [soSeri0, setSoSeri0] = useState("");
  const [soCt0, setSoCt0] = useState("");
  const [ngayCt0, setNgayCt0] = useState("");
  const [maThue, setMaThue] = useState("10");
  const [thueGtgt, setThueGtgt] = useState(10);
  const [tk3, setTk3] = useState("1331");
  const [tkDu3, setTkDu3] = useState("3311");
  const [maDtGtGt, setMaDtGtGt] = useState("");
  const [tenDtGtGt, setTenDtGtGt] = useState("");

  const [items, setItems] = useState<ModuleVoucherDetailItem[]>(() => [
    makeEmptyDetailRow(config),
  ]);
  const itemsRef = useRef<ModuleVoucherDetailItem[]>(items);
  itemsRef.current = items;

  const [activeRow, setActiveRow] = useState(0);

  const fetchNextNumber = useCallback(
    async (targetMaCt: string, targetNgayCt: string) => {
      try {
        const params = new URLSearchParams({
          ma_ct: targetMaCt,
          ngay_ct: targetNgayCt,
        });
        const res = await fetch(
          `/api/modules/${moduleKey}/next-number?${params.toString()}`,
        );
        if (!res.ok) return;
        const body = await res.json();
        if (body?.so_ct) setSoCt(String(body.so_ct));
      } catch {
        // Ignore silent auto-number fetch error; user can still type So_Ct
      }
    },
    [moduleKey],
  );

  useEffect(() => {
    if (!open) return;
    void initCustomerIndex();
    void initProductIndex();
    void initCatalogCache().then(() => {
      setDocList(getDocumentsByModule(moduleKey));
    });
  }, [open, moduleKey]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!stt) {
      const todayStr = getTodayDate();
      const docs = getDocumentsByModule(moduleKey);
      const firstDoc = docs[0];
      const initMaCt = firstDoc?.ma_ct || config.defaultMaCt;
      const initNhCt = firstDoc?.nh_ct || (moduleKey === "inv-transfer" ? "2" : "1");
      const initTk = firstDoc?.tk || config.defaultMainTk;

      setNgayCt(todayStr);
      setSoCt("");
      setCustomSoCt(false);
      setMaCt(initMaCt);
      setNhCt(initNhCt);
      setMaDt("");
      setTenDt("");
      setOngBa("");
      setDiaChi("");
      setMaNx("");
      setTk(initTk);
      setDienGiai0("");
      setMaTte("VND");
      setTyGia(1);
      setCtDiKem("");
      setSoSeri0("");
      setSoCt0("");
      setNgayCt0("");
      setMaThue("10");
      setThueGtgt(10);
      setTk3("1331");
      setTkDu3(initTk || "3311");
      setMaDtGtGt("");
      setTenDtGtGt("");
      setItems([makeEmptyDetailRow(config, initTk)]);
      setActiveRow(0);
      void fetchNextNumber(initMaCt, todayStr);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/modules/${moduleKey}/vouchers/${encodeURIComponent(stt)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await extractApiError(res);
          throw new Error(err.message);
        }
        return (await res.json()) as ModuleVoucherDetailResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setNgayCt(data.ngay_ct || getTodayDate());
        setSoCt(data.so_ct || "");
        setCustomSoCt(true);
        setMaCt(data.ma_ct || config.defaultMaCt);
        setNhCt(data.nh_ct || "1");
        setMaDt(data.ma_dt || "");
        setTenDt(data.ten_dt || "");
        setOngBa(data.ong_ba || "");
        setDiaChi(data.dia_chi || "");
        setMaNx(data.ma_nx || "");
        setTk(data.tk || config.defaultMainTk);
        setDienGiai0(data.dien_giai0 || "");
        setMaTte(data.ma_tte || "VND");
        setTyGia(data.ty_gia || 1);
        setCtDiKem(data.ct_di_kem || "");
        setSoSeri0(data.so_seri0 || "");
        setSoCt0(data.so_ct0 || "");
        setNgayCt0(data.ngay_ct0 || "");
        setMaThue(data.ma_thue || "10");
        setThueGtgt(data.thue_gtgt || 0);
        setTk3(data.tk3 || "1331");
        setTkDu3(data.tk_du3 || data.tk || "3311");
        setMaDtGtGt(data.ma_dtgtgt || "");
        setTenDtGtGt(data.ten_dtgtgt || "");
        setItems(
          data.items && data.items.length > 0
            ? data.items.map((it) => ({
                ...it,
                stt0: it.stt0 || Math.random().toString(36).slice(2, 10),
                stt_nv: it.stt_nv || 1,
                he_so9: it.he_so9 || 1,
                so_luong9: it.so_luong9 || it.so_luong || 0,
                gia_nt9: it.gia_nt9 || it.gia_nt || 0,
                tien_nt9: it.tien_nt9 || it.tien_nt || 0,
                gia_tb_tt: it.gia_tb_tt || " ",
              }))
            : [makeEmptyDetailRow(config)],
        );
        setActiveRow(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được chứng từ");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, moduleKey, stt, config, fetchNextNumber]);

  const fetchCustomerOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCustomerIndex();
    return searchCustomers(q, 20);
  }, []);

  const fetchProductOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initProductIndex();
    return searchProducts(q);
  }, []);

  const fetchKhoOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchKho(q);
  }, []);

  const fetchTkOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const fetchBpOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchBoPhan(q);
  }, []);

  const fetchNxOpts = useCallback(
    async (q: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchNhapXuat(q, maCt);
    },
    [maCt],
  );

  const fetchKmOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchKhoanMuc(q);
  }, []);

  const fetchSpOpts = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchSanPham(q);
  }, []);

  const isVnd = (maTte || "VND").toUpperCase() === "VND";

  const updateItem = useCallback(
    (idx: number, patch: Partial<ModuleVoucherDetailItem>, recalcFromQtyPrice = false) => {
      setItems((prev) =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          const next = { ...row, ...patch };
          if (config.detailKind !== "gl") {
            const hs = Number(next.he_so9) > 0 ? Number(next.he_so9) : 1;
            const sl9 = Number(next.so_luong9) || 0;
            next.he_so9 = hs;
            next.so_luong = Number((sl9 * hs).toFixed(4));
            if (recalcFromQtyPrice) {
              const rawAmt = sl9 * (Number(next.gia_nt9) || 0);
              next.tien_nt9 = isVnd ? Math.round(rawAmt) : Number(rawAmt.toFixed(2));
              next.tien_nt = next.tien_nt9;
              next.gia_nt = next.so_luong > 0 ? Number((next.tien_nt / next.so_luong).toFixed(4)) : 0;
            } else if (patch.tien_nt9 !== undefined) {
              next.tien_nt = next.tien_nt9;
              next.gia_nt9 = sl9 > 0 ? Number((next.tien_nt9 / sl9).toFixed(4)) : 0;
              next.gia_nt = next.so_luong > 0 ? Number((next.tien_nt / next.so_luong).toFixed(4)) : 0;
            }
          }
          return next;
        }),
      );
    },
    [config.detailKind, isVnd],
  );

  // Async enrich unit options & catalog fields without overwriting user-entered qty/price (memory A7)
  const enrichProductMeta = useCallback(
    async (idx: number, maVt: string) => {
      const clean = maVt.trim().toUpperCase();
      if (!clean) return;
      const vt = await lookupVatTu(clean);
      if (!vt) return;
      setVatTuMeta((prev) => ({ ...prev, [clean]: vt }));
      const curRow = itemsRef.current[idx];
      if (!curRow || (curRow.ma_vt || "").trim().toUpperCase() !== clean) {
        return; // Row changed while awaiting -> ignore stale result
      }
      setItems((prev) =>
        prev.map((row, i) => {
          if (i !== idx || (row.ma_vt || "").trim().toUpperCase() !== clean) return row;
          const nextDvt = row.dvt || vt.dvt || "";
          const opts = getUnitOptions(vt);
          const matched = opts.find((o) => o.dvt.toLowerCase() === nextDvt.toLowerCase());
          const hs = matched ? matched.he_so : row.he_so9 || 1;
          const sl9 = Number(row.so_luong9) || 0;
          return {
            ...row,
            ten_vt: row.ten_vt || vt.ten_vt || "",
            dvt: nextDvt,
            he_so9: hs,
            so_luong: Number((sl9 * hs).toFixed(4)),
            tk_du: row.tk_du || vt.tk_vt || config.defaultOffsetTk,
          };
        }),
      );
    },
    [config.defaultOffsetTk],
  );

  const handleAddRow = useCallback(() => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      const next = makeEmptyDetailRow(config, tk);
      if (config.detailKind === "gl" && last) {
        next.stt_nv = last.stt_nv || 1;
        next.no_co = last.no_co === "N" ? "C" : "N";
      }
      return [...prev, next];
    });
  }, [config, tk]);

  const handleDeleteRow = useCallback(
    (idx: number) => {
      setItems((prev) => {
        if (prev.length <= 1) return [makeEmptyDetailRow(config, tk)];
        return prev.filter((_, i) => i !== idx);
      });
    },
    [config, tk],
  );

  const navigateCell = useCallback(
    (dir: VfpNavDir, currentEl: HTMLInputElement, rowIdx: number) => {
      const table = tableRef.current;
      if (!table) return;
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const curTr = currentEl.closest("tr");
      if (!curTr) return;
      const getInputs = (tr: Element) =>
        Array.from(tr.querySelectorAll<HTMLInputElement>("input")).filter(
          (inp) => inp.dataset.readonly !== "true" && !inp.disabled,
        );

      const rowInputs = getInputs(curTr);
      const colIdx = rowInputs.indexOf(currentEl);

      if (dir === "next" || dir === "right") {
        if (colIdx >= 0 && colIdx + 1 < rowInputs.length) {
          rowInputs[colIdx + 1].focus();
          rowInputs[colIdx + 1].select();
          return;
        }
        if (rowIdx + 1 < rows.length) {
          const nextInputs = getInputs(rows[rowIdx + 1]);
          if (nextInputs[0]) {
            nextInputs[0].focus();
            nextInputs[0].select();
            setActiveRow(rowIdx + 1);
          }
        } else if (dir === "next") {
          handleAddRow();
          window.setTimeout(() => {
            const updatedRows = Array.from(table.querySelectorAll("tbody tr"));
            const target = updatedRows[rowIdx + 1];
            if (target) {
              const nextInputs = getInputs(target);
              nextInputs[0]?.focus();
              nextInputs[0]?.select();
              setActiveRow(rowIdx + 1);
            }
          }, 20);
        }
      } else if (dir === "prev" || dir === "left") {
        if (colIdx > 0) {
          rowInputs[colIdx - 1].focus();
          rowInputs[colIdx - 1].select();
          return;
        }
        if (rowIdx > 0) {
          const prevInputs = getInputs(rows[rowIdx - 1]);
          const last = prevInputs[prevInputs.length - 1];
          if (last) {
            last.focus();
            last.select();
            setActiveRow(rowIdx - 1);
          }
        }
      } else if (dir === "down" && rowIdx + 1 < rows.length) {
        const nextInputs = getInputs(rows[rowIdx + 1]);
        const target = nextInputs[Math.min(colIdx, nextInputs.length - 1)];
        if (target) {
          target.focus();
          target.select();
          setActiveRow(rowIdx + 1);
        }
      } else if (dir === "up" && rowIdx > 0) {
        const prevInputs = getInputs(rows[rowIdx - 1]);
        const target = prevInputs[Math.min(colIdx, prevInputs.length - 1)];
        if (target) {
          target.focus();
          target.select();
          setActiveRow(rowIdx - 1);
        }
      }
    },
    [handleAddRow],
  );

  // Totals & GL Balance Summary
  const glBalance = useMemo(() => {
    if (config.detailKind !== "gl") {
      return { totalDebit: 0, totalCredit: 0, balanced: true, msg: "" };
    }
    const groups = new Map<number, { dr: number; cr: number }>();
    let totalDebit = 0;
    let totalCredit = 0;
    for (const it of items) {
      if (!it.tk?.trim() && !it.tien_nt) continue;
      const amt = Number(it.tien_nt) || 0;
      const g = groups.get(it.stt_nv || 1) || { dr: 0, cr: 0 };
      if ((it.no_co || "N").toUpperCase() === "N") {
        g.dr += amt;
        totalDebit += amt;
      } else {
        g.cr += amt;
        totalCredit += amt;
      }
      groups.set(it.stt_nv || 1, g);
    }
    let unbalancedMsg = "";
    for (const [grpId, g] of groups.entries()) {
      if (Math.abs(g.dr - g.cr) > 0.01) {
        unbalancedMsg = `Nhóm ${grpId}: Nợ (${formatNumber0(g.dr)}) ≠ Có (${formatNumber0(g.cr)})`;
        break;
      }
    }
    return {
      totalDebit,
      totalCredit,
      balanced: unbalancedMsg === "" && totalDebit > 0,
      msg: unbalancedMsg,
    };
  }, [config.detailKind, items]);

  const subTotal = useMemo(() => {
    if (config.detailKind === "gl") return glBalance.totalDebit;
    return items.reduce((sum, it) => sum + (Number(it.tien_nt9 || it.tien_nt) || 0), 0);
  }, [config.detailKind, glBalance.totalDebit, items]);

  const totalTaxAmount = useMemo(() => {
    if (!config.showTaxFields) return 0;
    const rate = Number(thueGtgt) || 0;
    if (rate <= 0) return 0;
    const raw = (subTotal * rate) / 100;
    return isVnd ? Math.round(raw) : Number(raw.toFixed(2));
  }, [config.showTaxFields, subTotal, thueGtgt, isVnd]);

  const grandTotal = useMemo(
    () => subTotal + totalTaxAmount,
    [subTotal, totalTaxAmount],
  );

  const handleSave = useCallback(async () => {
    if (!ngayCt) {
      setError("Vui lòng chọn Ngày chứng từ.");
      return;
    }
    if (moduleKey !== "gl-voucher" && !maDt.trim()) {
      setError(`Vui lòng chọn ${config.partnerLabel}.`);
      return;
    }
    if (moduleKey !== "gl-voucher" && !maNx.trim()) {
      setError("Vui lòng chọn Mã nhập xuất (Ma_Nx).");
      return;
    }
    const cleanItems = items
      .filter((it) =>
        config.detailKind === "gl"
          ? Boolean(it.tk?.trim() || it.tien_nt || it.dien_giai?.trim())
          : Boolean(it.ma_vt?.trim() || it.ten_vt?.trim() || it.tien_nt9 || it.tien_nt),
      )
      .map((it, idx) => ({
        ...it,
        stt0: String(idx + 1).padStart(4, "0"),
        tien_nt: config.detailKind === "gl" ? it.tien_nt : it.tien_nt9 || it.tien_nt,
        tien_nt3:
          config.showTaxFields && thueGtgt > 0
            ? isVnd
              ? Math.round(((it.tien_nt9 || it.tien_nt || 0) * thueGtgt) / 100)
              : Number((((it.tien_nt9 || it.tien_nt || 0) * thueGtgt) / 100).toFixed(2))
            : 0,
      }));

    if (cleanItems.length === 0) {
      setError("Cần ít nhất 1 dòng chi tiết hợp lệ.");
      return;
    }
    if (config.detailKind === "gl" && !glBalance.balanced) {
      setError(glBalance.msg || "Tổng phát sinh Nợ và Tổng phát sinh Có phải bằng nhau và > 0.");
      return;
    }

    const payload: ModuleVoucherSavePayload = {
      ma_dvcs: "S1",
      ma_ct: maCt.trim() || config.defaultMaCt,
      nh_ct: nhCt || "1",
      ngay_ct: ngayCt,
      so_ct: soCt.trim(),
      custom_so_ct: customSoCt,
      ma_dt: maDt.trim(),
      ten_dt: tenDt.trim(),
      ong_ba: ongBa.trim(),
      dia_chi: diaChi.trim(),
      dien_giai0: dienGiai0.trim(),
      ma_nx: maNx.trim(),
      tk: tk.trim(),
      ma_tte: maTte || "VND",
      ty_gia: isVnd ? 1 : Number(tyGia) || 1,
      posted: true,
      user_name: "ADMIN",
      so_seri0: config.showTaxFields ? soSeri0.trim() : "",
      so_ct0: config.showTaxFields ? soCt0.trim() : "",
      ngay_ct0: config.showTaxFields && ngayCt0 ? ngayCt0 : null,
      ma_thue: config.showTaxFields ? maThue.trim() : "",
      thue_gtgt: config.showTaxFields ? Number(thueGtgt) || 0 : 0,
      tk3: config.showTaxFields ? tk3.trim() : "",
      tk_du3: config.showTaxFields ? tkDu3.trim() || tk.trim() : "",
      ma_dtgtgt: config.showTaxFields ? maDtGtGt.trim() : "",
      ten_dtgtgt: config.showTaxFields ? tenDtGtGt.trim() : "",
      ct_di_kem: moduleKey === "gl-voucher" ? ctDiKem.trim() : "",
      items: cleanItems,
    };

    setSaving(true);
    setError(null);
    try {
      const url = stt
        ? `/api/modules/${moduleKey}/vouchers/${encodeURIComponent(stt)}`
        : `/api/modules/${moduleKey}/vouchers`;
      const res = await fetch(url, {
        method: stt ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await extractApiError(res);
        throw new Error(err.message);
      }
      const saved = (await res.json()) as ModuleVoucherDetailResponse;
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu chứng từ");
    } finally {
      setSaving(false);
    }
  }, [
    ngayCt,
    moduleKey,
    maDt,
    config,
    maNx,
    items,
    glBalance,
    maCt,
    nhCt,
    soCt,
    customSoCt,
    tenDt,
    ongBa,
    diaChi,
    dienGiai0,
    tk,
    maTte,
    isVnd,
    tyGia,
    soSeri0,
    soCt0,
    ngayCt0,
    maThue,
    thueGtgt,
    tk3,
    tkDu3,
    maDtGtGt,
    tenDtGtGt,
    ctDiKem,
    stt,
    onSaved,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleAddRow();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleDeleteRow(activeRow);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, handleSave, handleAddRow, handleDeleteRow, activeRow]);

  if (!open) return null;

  const tteOpts = getTienTeList();
  const taxOpts = getThueList();
  const mainTkLabel =
    moduleKey === "purchase"
      ? nhCt === "2"
        ? "TK Nợ (NCC)"
        : "TK Có (331/111)"
      : nhCt === "1"
        ? "TK Có (Header)"
        : "TK Nợ (Header)";
  const detailOffsetTkLabel =
    moduleKey === "purchase"
      ? nhCt === "2"
        ? "TK Có"
        : "TK Nợ"
      : nhCt === "1"
        ? "TK Nợ"
        : "TK Có";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-0 md:p-2.5">
      <div
        ref={modalRef}
        className="w-full h-[100dvh] md:h-auto max-w-[1320px] md:max-h-[94vh] bg-white rounded-none md:rounded-xl shadow-2xl border-0 md:border border-slate-200 flex flex-col overflow-hidden pt-safe md:pt-0"
      >
        {/* Modal Header */}
        <div className="px-3 md:px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 md:gap-3 shrink-0">
          <div className="flex items-center gap-2 md:gap-2.5 flex-wrap min-w-0">
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold shrink-0 ${config.accentClass}`}
            >
              {maCt || config.shortCode}
            </span>
            <h2 className="text-[14px] font-semibold text-slate-900 truncate">
              {stt ? `Sửa ${config.title}` : `Thêm ${config.title}`}
            </h2>
            <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
              ({config.sqlTables})
            </span>
            {docList.length > 0 && (
              <select
                value={maCt}
                onChange={(e) => {
                  const selected = docList.find((d) => d.ma_ct === e.target.value);
                  const nextMaCt = e.target.value;
                  setMaCt(nextMaCt);
                  if (selected) {
                    setNhCt(selected.nh_ct || "1");
                    if (selected.tk) setTk(selected.tk);
                  }
                  if (!stt && !customSoCt) {
                    void fetchNextNumber(nextMaCt, ngayCt);
                  }
                }}
                className="h-7 md:h-6 px-2 border border-slate-300 rounded bg-white text-[11px] font-medium text-slate-700 max-w-full"
              >
                {docList.map((d) => (
                  <option key={d.ma_ct} value={d.ma_ct}>
                    {d.ma_ct} — {d.ten_ct} ({d.nh_ct === "1" ? "Nhập" : "Xuất"})
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 md:p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 shrink-0"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-2.5 md:p-3 gap-2">
          {error && (
            <div className="px-3 py-1.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[12px]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
              Đang tải dữ liệu chứng từ...
            </div>
          ) : (
            <>
              {/* Master Header Fields */}
              <div className="grid grid-cols-12 gap-x-2.5 gap-y-2 bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 text-[12px]">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Ngày CT
                  </label>
                  <input
                    type="date"
                    data-autofocus
                    value={ngayCt}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNgayCt(v);
                      if (!stt && !customSoCt && v) {
                        void fetchNextNumber(maCt, v);
                      }
                    }}
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Số CT
                  </label>
                  <input
                    type="text"
                    value={soCt}
                    onChange={(e) => {
                      setSoCt(e.target.value);
                      setCustomSoCt(true);
                    }}
                    placeholder="Tự cấp..."
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] font-mono font-semibold bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                {moduleKey !== "gl-voucher" ? (
                  <>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Mã Nhập/Xuất *
                      </label>
                      <Autocomplete
                        value={maNx}
                        onChange={setMaNx}
                        fetcher={fetchNxOpts}
                        onSelect={(opt) => {
                          setMaNx(opt.value);
                          const nx = getNhapXuat(opt.value);
                          if (nx?.tk) {
                            setTk(nx.tk);
                            if (moduleKey === "purchase") setTkDu3(nx.tk);
                          }
                        }}
                        openOnTypeOnly={false}
                        hideIcon
                        className="h-7 text-[12px] font-mono uppercase"
                        placeholder="Ma_Nx..."
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        {mainTkLabel}
                      </label>
                      <Autocomplete
                        value={tk}
                        onChange={setTk}
                        fetcher={fetchTkOpts}
                        onSelect={(opt) => {
                          setTk(opt.value);
                          if (moduleKey === "purchase") setTkDu3(opt.value);
                        }}
                        openOnTypeOnly
                        hideIcon
                        className="h-7 text-[12px] font-mono"
                        placeholder={config.defaultMainTk}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Kèm chứng từ gốc
                    </label>
                    <input
                      type="text"
                      value={ctDiKem}
                      onChange={(e) => setCtDiKem(e.target.value)}
                      placeholder="Số chứng từ đính kèm..."
                      className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] bg-white"
                    />
                  </div>
                )}

                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    {config.partnerLabel}
                    {moduleKey !== "gl-voucher" ? " *" : ""}
                  </label>
                  <div className="flex gap-1.5">
                    <div className="w-28 shrink-0">
                      <Autocomplete
                        value={maDt}
                        onChange={setMaDt}
                        fetcher={fetchCustomerOpts}
                        onSelect={(opt) => {
                          setMaDt(opt.value);
                          const c = getCustomer(opt.value);
                          setTenDt(c?.ten_dt || opt.hint || "");
                          if (c?.dia_chi) setDiaChi(c.dia_chi);
                          if (c?.ong_ba) setOngBa(c.ong_ba);
                          if (moduleKey === "purchase" && c) {
                            if (c.ms_thue) setMaDtGtGt(c.ms_thue);
                            setTenDtGtGt(c.ten_dt || "");
                          }
                        }}
                        openOnTypeOnly
                        hideIcon
                        className="h-7 text-[12px] font-mono uppercase"
                        placeholder="Mã ĐT..."
                      />
                    </div>
                    <input
                      type="text"
                      value={tenDt}
                      onChange={(e) => setTenDt(e.target.value)}
                      placeholder="Tên đối tượng..."
                      className="flex-1 min-w-0 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Tiền tệ / Tỷ giá
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={maTte}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMaTte(v);
                        const found = tteOpts.find((t) => t.ma_tte === v);
                        setTyGia(v === "VND" ? 1 : found?.ty_gia || 25000);
                      }}
                      className="w-16 h-7 px-1 border border-slate-300 rounded text-[12px] bg-white"
                    >
                      {tteOpts.length > 0 ? (
                        tteOpts.map((t) => (
                          <option key={t.ma_tte} value={t.ma_tte}>
                            {t.ma_tte}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="VND">VND</option>
                          <option value="USD">USD</option>
                        </>
                      )}
                    </select>
                    <input
                      type="number"
                      value={tyGia}
                      disabled={isVnd}
                      onChange={(e) => setTyGia(Number(e.target.value) || 1)}
                      className="flex-1 min-w-0 h-7 px-1.5 border border-slate-300 rounded text-[12px] text-right font-mono bg-white disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Người giao dịch / Địa chỉ
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={ongBa}
                      onChange={(e) => setOngBa(e.target.value)}
                      placeholder="Ông/Bà..."
                      className="w-32 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white"
                    />
                    <input
                      type="text"
                      value={diaChi}
                      onChange={(e) => setDiaChi(e.target.value)}
                      placeholder="Địa chỉ..."
                      className="flex-1 min-w-0 h-7 px-2 border border-slate-300 rounded text-[12px] bg-white"
                    />
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Diễn giải chung
                  </label>
                  <input
                    type="text"
                    value={dienGiai0}
                    onChange={(e) => setDienGiai0(e.target.value)}
                    placeholder="Nội dung chứng từ..."
                    className="w-full h-7 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                {config.showTaxFields && isMobile && (
                  <div className="col-span-12 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowMobileTax((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700"
                    >
                      {showMobileTax ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showMobileTax
                          ? "Ẩn hóa đơn GTGT đầu vào"
                          : `Hóa đơn GTGT đầu vào (${thueGtgt}%${soCt0 ? ` · ${soCt0}` : ""})`}
                      </span>
                    </button>
                  </div>
                )}

                {config.showTaxFields && (!isMobile || showMobileTax) && (
                  <>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Hóa đơn GTGT đầu vào (Ký hiệu / Số / Ngày)
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={soSeri0}
                          onChange={(e) => setSoSeri0(e.target.value)}
                          placeholder="Ký hiệu"
                          className="w-24 h-8 md:h-7 px-1.5 border border-slate-300 rounded text-[11px] bg-white font-mono"
                        />
                        <input
                          type="text"
                          value={soCt0}
                          onChange={(e) => setSoCt0(e.target.value)}
                          placeholder="Số HĐ"
                          className="w-24 h-8 md:h-7 px-1.5 border border-slate-300 rounded text-[11px] bg-white font-mono"
                        />
                        <input
                          type="date"
                          value={ngayCt0}
                          onChange={(e) => setNgayCt0(e.target.value)}
                          className="flex-1 min-w-0 h-8 md:h-7 px-1 border border-slate-300 rounded text-[11px] bg-white"
                        />
                      </div>
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Biểu thuế / % VAT
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={maThue}
                          onChange={(e) => {
                            const code = e.target.value;
                            setMaThue(code);
                            const found = taxOpts.find((t) => t.ma_thue === code);
                            if (found) {
                              setThueGtgt(found.thue_gtgt);
                              if (found.tk) setTk3(found.tk);
                            }
                          }}
                          className="w-20 h-8 md:h-7 px-1 border border-slate-300 rounded text-[11px] bg-white font-mono"
                        >
                          {taxOpts.length > 0 ? (
                            taxOpts.map((t) => (
                              <option key={t.ma_thue} value={t.ma_thue}>
                                {t.ma_thue} ({t.thue_gtgt}%)
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="00">0%</option>
                              <option value="05">5%</option>
                              <option value="08">8%</option>
                              <option value="10">10%</option>
                            </>
                          )}
                        </select>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={thueGtgt}
                          onChange={(e) => setThueGtgt(Number(e.target.value) || 0)}
                          className="flex-1 min-w-0 h-8 md:h-7 px-1.5 border border-slate-300 rounded text-[11px] text-right font-mono bg-white"
                        />
                      </div>
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        TK Thuế (1331)
                      </label>
                      <Autocomplete
                        value={tk3}
                        onChange={setTk3}
                        fetcher={fetchTkOpts}
                        onSelect={(opt) => setTk3(opt.value)}
                        openOnTypeOnly
                        hideIcon
                        className="h-8 md:h-7 text-[11px] font-mono"
                        placeholder="1331"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        MST / Tên ĐT khai thuế
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={maDtGtGt}
                          onChange={(e) => setMaDtGtGt(e.target.value)}
                          placeholder="MST..."
                          className="w-28 h-8 md:h-7 px-1.5 border border-slate-300 rounded text-[11px] font-mono bg-white"
                        />
                        <input
                          type="text"
                          value={tenDtGtGt}
                          onChange={(e) => setTenDtGtGt(e.target.value)}
                          placeholder="Tên đơn vị trên hóa đơn..."
                          className="flex-1 min-w-0 h-8 md:h-7 px-1.5 border border-slate-300 rounded text-[11px] bg-white"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Detail Grid Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] shrink-0">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <span className="font-semibold text-slate-700">
                    Chi tiết chứng từ ({items.length} dòng)
                  </span>
                  {config.detailKind === "gl" && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        glBalance.balanced
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {glBalance.balanced
                        ? `Cân đối Nợ = Có (${formatNumber0(glBalance.totalDebit)})`
                        : glBalance.msg || "Nhập định khoản Nợ / Có cân bằng theo Stt_NV"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 md:py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-[11px] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isMobile ? "Thêm dòng" : "Thêm dòng (F4) · Xóa dòng (F8)"}</span>
                </button>
              </div>

              {/* Excel-style Detail Grid (Desktop) / Card List (Mobile) */}
              {isMobile ? (
                <MobileModuleDetailList
                  items={items}
                  moduleKey={moduleKey}
                  config={config}
                  mainTk={tk}
                  isVnd={isVnd}
                  activeRow={activeRow}
                  vatTuMeta={vatTuMeta}
                  getUnitOptions={getUnitOptions}
                  detailOffsetTkLabel={detailOffsetTkLabel}
                  onSelectRow={setActiveRow}
                  onUpdateItem={updateItem}
                  onEnrichProductMeta={enrichProductMeta}
                  onAddRow={handleAddRow}
                  onDeleteRow={handleDeleteRow}
                  fetchProductOpts={fetchProductOpts}
                  fetchKhoOpts={fetchKhoOpts}
                  fetchTkOpts={fetchTkOpts}
                  fetchCustomerOpts={fetchCustomerOpts}
                  fetchBpOpts={fetchBpOpts}
                  fetchKmOpts={fetchKmOpts}
                  fetchSpOpts={fetchSpOpts}
                />
              ) : (
              <div className="flex-1 min-h-[220px] overflow-auto border border-slate-300 rounded-lg table-sticky-header bg-white">
                <table
                  ref={tableRef}
                  className="w-full text-left dense-table border-collapse text-[12px] xl-grid"
                >
                  <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider border-b border-neutral-300">
                    <tr>
                      <th className="w-9 text-center border-r border-neutral-200">#</th>
                      {config.detailKind !== "gl" ? (
                        <>
                          <th className="w-24 border-r border-neutral-200">Mã VT</th>
                          <th className="min-w-[170px] border-r border-neutral-200">Tên vật tư</th>
                          <th className="w-20 text-center border-r border-neutral-200">ĐVT</th>
                          <th className="w-20 border-r border-neutral-200">
                            {config.detailKind === "transfer" ? "Kho xuất" : "Kho"}
                          </th>
                          {config.detailKind === "transfer" && (
                            <th className="w-20 border-r border-neutral-200">Kho nhận</th>
                          )}
                          <th className="w-20 text-right border-r border-neutral-200">SL</th>
                          <th className="w-16 text-right border-r border-neutral-200">HS</th>
                          <th className="w-24 text-right border-r border-neutral-200">Đơn giá</th>
                          <th className="w-28 text-right border-r border-neutral-200">Thành tiền</th>
                          <th className="w-20 border-r border-neutral-200">{detailOffsetTkLabel}</th>
                          <th className="w-20 border-r border-neutral-200">TK ĐƯ</th>
                          <th className="w-20 border-r border-neutral-200">Mã SP</th>
                        </>
                      ) : (
                        <>
                          <th className="w-14 text-center border-r border-neutral-200">NV</th>
                          <th className="w-14 text-center border-r border-neutral-200">N/C</th>
                          <th className="w-24 border-r border-neutral-200">Tài khoản</th>
                          <th className="w-32 text-right border-r border-neutral-200">Phát sinh</th>
                          <th className="w-24 border-r border-neutral-200">Mã ĐT</th>
                          <th className="w-20 border-r border-neutral-200">Bộ phận</th>
                          <th className="w-20 border-r border-neutral-200">Khoản mục</th>
                          <th className="w-20 border-r border-neutral-200">Sản phẩm</th>
                          <th className="min-w-[160px] border-r border-neutral-200">Diễn giải</th>
                        </>
                      )}
                      <th className="w-9 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isActive = idx === activeRow;
                      const vtInfo = vatTuMeta[(item.ma_vt || "").trim().toUpperCase()];
                      const unitOpts = getUnitOptions(vtInfo);
                      return (
                        <tr
                          key={item.stt0 || `row-${idx}`}
                          onClick={() => setActiveRow(idx)}
                          className={isActive ? "xl-row-active" : undefined}
                        >
                          <td className="xl-rowhead font-mono">{idx + 1}</td>

                          {config.detailKind !== "gl" ? (
                            <>
                              {/* Mã VT */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_vt || ""}
                                  fetcher={fetchProductOpts}
                                  placeholder="Mã VT..."
                                  dropdownMinWidth={380}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) =>
                                    updateItem(idx, { ma_vt: v, ten_vt: "" })
                                  }
                                  onPick={async (opt) => {
                                    const p = await getProductByCode(opt.value);
                                    updateItem(idx, {
                                      ma_vt: opt.value,
                                      ten_vt: p?.ten || opt.hint || "",
                                      dvt: p?.dvt || "",
                                      tk: item.tk || tk || config.defaultMainTk,
                                      tk_du: p?.tk_vt || item.tk_du || config.defaultOffsetTk,
                                    });
                                    void enrichProductMeta(idx, opt.value);
                                  }}
                                  onCommit={async (raw) => {
                                    const clean = raw.trim().toUpperCase();
                                    const p = await getProductByCode(clean);
                                    updateItem(idx, {
                                      ma_vt: p ? p.ma : clean,
                                      ten_vt: p?.ten || item.ten_vt || "",
                                      dvt: p?.dvt || item.dvt || "",
                                      tk: item.tk || tk || config.defaultMainTk,
                                      tk_du: p?.tk_vt || item.tk_du || config.defaultOffsetTk,
                                    });
                                    void enrichProductMeta(idx, p ? p.ma : clean);
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono font-semibold text-sky-900"
                                />
                              </td>

                              {/* Tên vật tư (RO) */}
                              <td className="xl-ro">
                                <ReadOnlyGridInput
                                  value={item.ten_vt || ""}
                                  rowIndex={idx}
                                  isFormReadOnlyColumn
                                  className="xl-ro-input text-slate-800"
                                  onSelectRow={setActiveRow}
                                  onKeyDown={() => {}}
                                  onCopy={() => {}}
                                />
                              </td>

                              {/* ĐVT (select if multi-unit exists, else input) */}
                              <td className="xl-cell">
                                {unitOpts.length > 1 ? (
                                  <select
                                    value={item.dvt || ""}
                                    onFocus={() => setActiveRow(idx)}
                                    onChange={(e) => {
                                      const chosen = unitOpts.find((u) => u.dvt === e.target.value);
                                      updateItem(
                                        idx,
                                        {
                                          dvt: e.target.value,
                                          he_so9: chosen?.he_so || 1,
                                        },
                                        false,
                                      );
                                    }}
                                    className="xl-input text-center bg-white"
                                  >
                                    {unitOpts.map((u) => (
                                      <option key={u.dvt} value={u.dvt}>
                                        {u.dvt} (x{u.he_so})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.dvt || ""}
                                    onFocus={() => setActiveRow(idx)}
                                    onChange={(e) => updateItem(idx, { dvt: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        navigateCell("next", e.currentTarget, idx);
                                      }
                                    }}
                                    className="xl-input text-center"
                                  />
                                )}
                              </td>

                              {/* Kho / Kho xuất */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_kho || ""}
                                  fetcher={fetchKhoOpts}
                                  placeholder="Kho"
                                  dropdownMinWidth={240}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_kho: v })}
                                  onPick={(opt) => updateItem(idx, { ma_kho: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getKho(raw);
                                    updateItem(idx, {
                                      ma_kho: found ? found.ma_kho : raw.trim().toUpperCase(),
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono uppercase"
                                />
                              </td>

                              {config.detailKind === "transfer" && (
                                <td className="xl-cell">
                                  <VfpLookupCell
                                    value={item.ma_kho_n || ""}
                                    fetcher={fetchKhoOpts}
                                    placeholder="Kho nhận"
                                    dropdownMinWidth={240}
                                    onFocusRow={() => setActiveRow(idx)}
                                    onValueChange={(v) => updateItem(idx, { ma_kho_n: v })}
                                    onPick={(opt) => updateItem(idx, { ma_kho_n: opt.value })}
                                    onCommit={(raw) => {
                                      const found = getKho(raw);
                                      updateItem(idx, {
                                        ma_kho_n: found ? found.ma_kho : raw.trim().toUpperCase(),
                                      });
                                    }}
                                    onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                    className="xl-input font-mono uppercase"
                                  />
                                </td>
                              )}

                              {/* So_Luong9 */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.so_luong9 || 0}
                                  compactDecimals
                                  dataField="so_luong9"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { so_luong9: v }, true)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono"
                                />
                              </td>

                              {/* He_So9 */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.he_so9 || 1}
                                  compactDecimals
                                  dataField="he_so9"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { he_so9: v > 0 ? v : 1 }, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono text-slate-600"
                                />
                              </td>

                              {/* Gia_Nt9 */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.gia_nt9 || 0}
                                  noDecimals={isVnd}
                                  dataField="gia_nt9"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { gia_nt9: v }, true)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono"
                                />
                              </td>

                              {/* Tien_Nt9 */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.tien_nt9 || 0}
                                  noDecimals={isVnd}
                                  dataField="tien_nt9"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { tien_nt9: v }, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono font-bold text-slate-900"
                                />
                              </td>

                              {/* Tk_Du (CT) */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk_du || ""}
                                  fetcher={fetchTkOpts}
                                  dropdownMinWidth={280}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk_du: v })}
                                  onPick={(opt) => updateItem(idx, { tk_du: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getTaiKhoan(raw);
                                    updateItem(idx, { tk_du: found ? found.tk : raw.trim() });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Tk (Header/Offset) */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk || ""}
                                  fetcher={fetchTkOpts}
                                  dropdownMinWidth={280}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk: v })}
                                  onPick={(opt) => updateItem(idx, { tk: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getTaiKhoan(raw);
                                    updateItem(idx, { tk: found ? found.tk : raw.trim() });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Ma_Sp */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_sp || ""}
                                  fetcher={fetchSpOpts}
                                  dropdownMinWidth={260}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_sp: v })}
                                  onPick={(opt) => updateItem(idx, { ma_sp: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_sp: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono uppercase"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Stt_NV */}
                              <td className="xl-cell">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.stt_nv || 1}
                                  onFocus={() => setActiveRow(idx)}
                                  onChange={(e) =>
                                    updateItem(idx, { stt_nv: Math.max(1, Number(e.target.value) || 1) })
                                  }
                                  className="xl-input text-center font-mono"
                                />
                              </td>

                              {/* Ps: N / C */}
                              <td className="xl-cell">
                                <select
                                  value={(item.no_co || "N").toUpperCase()}
                                  onFocus={() => setActiveRow(idx)}
                                  onChange={(e) => updateItem(idx, { no_co: e.target.value })}
                                  className={`xl-input text-center font-mono font-bold bg-white ${
                                    (item.no_co || "N").toUpperCase() === "N"
                                      ? "text-sky-700"
                                      : "text-rose-700"
                                  }`}
                                >
                                  <option value="N">Nợ</option>
                                  <option value="C">Có</option>
                                </select>
                              </td>

                              {/* Tk */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.tk || ""}
                                  fetcher={fetchTkOpts}
                                  placeholder="Tài khoản"
                                  dropdownMinWidth={320}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { tk: v })}
                                  onPick={(opt) => updateItem(idx, { tk: opt.value })}
                                  onCommit={(raw) => {
                                    const found = getTaiKhoan(raw);
                                    updateItem(idx, {
                                      tk: found ? found.tk : raw.trim().toUpperCase(),
                                    });
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono font-semibold"
                                />
                              </td>

                              {/* Tien_Nt */}
                              <td className="xl-cell">
                                <NumCell
                                  value={item.tien_nt || 0}
                                  noDecimals={isVnd}
                                  dataField="tien_nt"
                                  onFocus={() => setActiveRow(idx)}
                                  onCommit={(v) => updateItem(idx, { tien_nt: v }, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    }
                                  }}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input text-right font-mono font-bold text-slate-900"
                                />
                              </td>

                              {/* Ma_Dt */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_dt || ""}
                                  fetcher={fetchCustomerOpts}
                                  dropdownMinWidth={320}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_dt: v })}
                                  onPick={(opt) => updateItem(idx, { ma_dt: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_dt: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Ma_Bp */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_bp || ""}
                                  fetcher={fetchBpOpts}
                                  dropdownMinWidth={240}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_bp: v })}
                                  onPick={(opt) => updateItem(idx, { ma_bp: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_bp: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Ma_Km */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_km || ""}
                                  fetcher={fetchKmOpts}
                                  dropdownMinWidth={240}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_km: v })}
                                  onPick={(opt) => updateItem(idx, { ma_km: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_km: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Ma_Sp */}
                              <td className="xl-cell">
                                <VfpLookupCell
                                  value={item.ma_sp || ""}
                                  fetcher={fetchSpOpts}
                                  dropdownMinWidth={240}
                                  onFocusRow={() => setActiveRow(idx)}
                                  onValueChange={(v) => updateItem(idx, { ma_sp: v })}
                                  onPick={(opt) => updateItem(idx, { ma_sp: opt.value })}
                                  onCommit={(raw) => updateItem(idx, { ma_sp: raw.trim().toUpperCase() })}
                                  onNavigate={(dir, el) => navigateCell(dir, el, idx)}
                                  className="xl-input font-mono"
                                />
                              </td>

                              {/* Dien_Giai */}
                              <td className="xl-cell">
                                <input
                                  type="text"
                                  value={item.dien_giai || ""}
                                  onFocus={() => setActiveRow(idx)}
                                  onChange={(e) => updateItem(idx, { dien_giai: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      navigateCell("next", e.currentTarget, idx);
                                    } else {
                                      const dir = arrowDir(e.key);
                                      if (dir === "up" || dir === "down") {
                                        e.preventDefault();
                                        navigateCell(dir, e.currentTarget, idx);
                                      }
                                    }
                                  }}
                                  placeholder="Diễn giải..."
                                  className="xl-input"
                                />
                              </td>
                            </>
                          )}

                          <td className="text-center border-l border-neutral-200">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Xóa dòng (F8)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 md:px-4 py-2.5 pb-safe bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 md:gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 md:gap-4 text-[12px]">
            {config.detailKind === "gl" ? (
              <>
                <span className="text-slate-600">
                  Tổng Nợ:{" "}
                  <strong className="font-mono text-sky-700">
                    {isVnd ? formatNumber0(glBalance.totalDebit) : formatNumber2(glBalance.totalDebit)} {maTte}
                  </strong>
                </span>
                <span className="text-slate-600">
                  Tổng Có:{" "}
                  <strong className="font-mono text-rose-700">
                    {isVnd ? formatNumber0(glBalance.totalCredit) : formatNumber2(glBalance.totalCredit)} {maTte}
                  </strong>
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-600">
                  Tiền hàng:{" "}
                  <strong className="font-mono text-slate-900">
                    {isVnd ? formatNumber0(subTotal) : formatNumber2(subTotal)} {maTte}
                  </strong>
                </span>
                {config.showTaxFields && (
                  <span className="text-slate-600">
                    Thuế ({thueGtgt}%):{" "}
                    <strong className="font-mono text-slate-900">
                      {isVnd ? formatNumber0(totalTaxAmount) : formatNumber2(totalTaxAmount)}
                    </strong>
                  </span>
                )}
                <span className="text-slate-700">
                  Tổng:{" "}
                  <strong className="font-mono text-[13px] text-sky-700">
                    {isVnd ? formatNumber0(grandTotal) : formatNumber2(grandTotal)} {maTte}
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 md:py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-medium"
            >
              {isMobile ? "Đóng" : "Đóng (Esc)"}
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 px-4 md:px-3.5 py-2 md:py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Đang lưu..." : isMobile ? "Lưu chứng từ" : "Lưu chứng từ (Ctrl+S)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
