import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVouchers } from "./hooks/useVouchers";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModalLock } from "./lib/modalLock";
import { peek } from "./lib/apiCache";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "./lib/customerIndex";
import { VoucherList } from "./components/VoucherList";
import { VoucherForm } from "./components/VoucherForm";
import { FilterDialog } from "./components/FilterDialog";
import { PickupDialog } from "./components/PickupDialog";
import { DebtPanel } from "./components/DebtPanel";
import { PrintPreview } from "./components/PrintPreview";
import { Autocomplete } from "./components/ui/Autocomplete";
import { Badge } from "./components/ui/Badge";
import { formatDate } from "./lib/format";
import {
  VoucherFullDetail,
  VoucherDetail,
  VoucherHeader,
} from "./types/voucher";
import { User, ShieldCheck, RefreshCw, Trash2, X } from "lucide-react";

export function App() {
  const {
    voucherMode,
    setVoucherMode,
    vouchers,
    pagination,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    listDetail,
    listDetailLoading,
    debtAmount,
    activeVoucher,
    handleOpenDetail,
    handleCloseDetail,
    isFilterOpen,
    setIsFilterOpen,
    handleApplyFilter,
    handleChangePage,
    refresh,
    isPrintOpen,
    setIsPrintOpen,
    printStts,
    printInGia,
    printCopies,
    printMode,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  } = useVouchers();

  const [notification, setNotification] = useState<string | null>(null);
  // Tùy chọn in từ thanh đáy danh sách: "1" = In giá bán, "0" = Không in giá.
  const [printPrice, setPrintPrice] = useState<"1" | "0">("1");
  // Đánh dấu dòng (Mark) giống ctbhh — Space / Ctrl+A / Ctrl+U tác động.
  const [marked, setMarked] = useState<Set<string>>(new Set());

  // Ô tìm kiếm nhanh khách hàng & ngày chứng từ trên header (Enter để di chuyển và tìm kiếm)
  const [headerNgayCt1, setHeaderNgayCt1] = useState<string>(
    filters?.ngay_ct1 || "",
  );
  const [headerNgayCt2, setHeaderNgayCt2] = useState<string>(
    filters?.ngay_ct2 || "",
  );
  const [headerCustomerQuery, setHeaderCustomerQuery] = useState<string>(
    filters?.ma_dt || "",
  );
  const [headerDienGiai, setHeaderDienGiai] = useState<string>(
    filters?.dien_giai || "",
  );
  const headerCustomerRef = useRef<string>(filters?.ma_dt || "");
  const headerDienGiaiRef = useRef<string>(filters?.dien_giai || "");
  const ngayCt1InputRef = useRef<HTMLInputElement | null>(null);
  const ngayCt2InputRef = useRef<HTMLInputElement | null>(null);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dienGiaiInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void initCustomerIndex();
  }, []);

  useEffect(() => {
    setHeaderNgayCt1(filters?.ngay_ct1 || "");
    setHeaderNgayCt2(filters?.ngay_ct2 || "");
    const dt = filters?.ma_dt || "";
    setHeaderCustomerQuery(dt);
    headerCustomerRef.current = dt;
    const dg = filters?.dien_giai || "";
    setHeaderDienGiai(dg);
    headerDienGiaiRef.current = dg;
  }, [filters?.ngay_ct1, filters?.ngay_ct2, filters?.ma_dt, filters?.dien_giai]);

  const fetchHeaderKhachHangOptions = useCallback(async (query: string) => {
    await initCustomerIndex();
    return searchCustomers(query);
  }, []);

  const resolveHeaderCustomer = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return "";
    await initCustomerIndex();
    const exact = getCustomer(trimmed);
    return exact
      ? exact.ma_dt
      : (searchCustomers(trimmed, 1)[0]?.value ?? trimmed);
  }, []);

  const handleHeaderSearchSubmit = useCallback(
    async (overrideMaDt?: string, overrideDienGiai?: string) => {
      const rawDt =
        overrideMaDt !== undefined ? overrideMaDt : headerCustomerRef.current;
      const resolvedDt =
        overrideMaDt !== undefined
          ? overrideMaDt
          : await resolveHeaderCustomer(rawDt);
      headerCustomerRef.current = resolvedDt;
      setHeaderCustomerQuery(resolvedDt);

      const dg = (
        overrideDienGiai !== undefined
          ? overrideDienGiai
          : headerDienGiaiRef.current
      ).trim();

      // Mọi thao tác tìm kiếm hoặc xóa lọc từ header đều reset lọc kho & mã hàng của F9
      handleApplyFilter({
        ngay_ct1: headerNgayCt1,
        ngay_ct2: headerNgayCt2,
        ma_dt: resolvedDt,
        dien_giai: dg,
        ma_kho: "",
        ma_vt: "",
      });
    },
    [handleApplyFilter, headerNgayCt1, headerNgayCt2, resolveHeaderCustomer],
  );

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<
    (Pick<VoucherHeader, "stt" | "so_ct" | "ma_dt" | "ten_dt" | "ngay_ct"> & {
      dbMode: "sales" | "warehouse";
      fromPickup?: boolean;
    }) | null
  >(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  useModalLock(!!deleteTarget, deleteDialogRef);

  // Inherited data for new voucher (F2 / Ctrl+F2 / Pickup)
  const [inheritedData, setInheritedData] =
    useState<Partial<VoucherFullDetail> | null>(null);
  const [pickupPayload, setPickupPayload] = useState<{
    items: VoucherDetail[];
    ma_xe?: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const toggleMark = (stt: string | null) => {
    if (!stt) return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) next.delete(stt);
      else next.add(stt);
      return next;
    });
  };

  // ==== Đồng bộ URL route (/sales-invoices, /sales-invoices/new, /sales-invoices/:stt) ====
  const { stt: sttParam } = useParams();
  const navigate = useNavigate();

  const isNew = sttParam === "new";
  const isEditing = Boolean(sttParam && !isNew);

  const navToDetail = (stt: string) => {
    handleOpenDetail(stt);
    navigate(`/sales-invoices/${encodeURIComponent(stt)}`);
  };
  const navToNew = () => navigate("/sales-invoices/new");
  const navToList = () => navigate("/sales-invoices");

  // Lấy dữ liệu phiếu tức thì (từ state activeVoucher, cache RAM, hoặc ghép từ dòng đang chọn)
  // để mở form Sửa (mode="S") không bị trống ở render đầu tiên trước khi useEffect chạy.
  const editingVoucher: VoucherFullDetail | null = (() => {
    if (!sttParam || isNew) return null;
    if (activeVoucher?.stt === sttParam) return activeVoucher;
    const cached = peek<any>(`voucher:${voucherMode}:${sttParam}`);
    if (cached?.success && cached.data?.stt === sttParam) {
      return cached.data as VoucherFullDetail;
    }
    const header = vouchers.find((v) => v.stt === sttParam);
    if (header) {
      return {
        ...header,
        items: selectedStt === sttParam ? listDetail : [],
      };
    }
    return null;
  })();

  useEffect(() => {
    if (sttParam && !isNew) {
      if (activeVoucher?.stt !== sttParam) {
        handleOpenDetail(sttParam);
      }
    } else if (!sttParam) {
      if (activeVoucher) {
        handleCloseDetail();
      }
      setInheritedData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttParam]);

  // Selected voucher header
  const currentSelectedVoucher =
    vouchers.find((v) => v.stt === selectedStt) ||
    (vouchers.length > 0 ? vouchers[0] : null);

  const [pickupParams, setPickupParams] = useState<{
    maDt?: string;
    ngayCt?: string;
  }>({});

  // Overlay Thêm mới (F2) / Sửa (F3) phiếu xuất kho trực tiếp từ PickupDialog
  const [warehouseOverlay, setWarehouseOverlay] = useState<{
    mode: "M" | "S";
    stt?: string;
    voucher?: VoucherFullDetail | null;
    initialInherited?: Partial<VoucherFullDetail>;
  } | null>(null);
  const [pickupRefreshTrigger, setPickupRefreshTrigger] = useState<number>(0);
  const [pickupFocusStt, setPickupFocusStt] = useState<string | null>(null);

  const handleOpenPickup = (maDt?: string, ngayCt?: string) => {
    setPickupParams({
      maDt: maDt || activeVoucher?.ma_dt || currentSelectedVoucher?.ma_dt || "",
      ngayCt:
        ngayCt ||
        activeVoucher?.ngay_ct ||
        currentSelectedVoucher?.ngay_ct ||
        undefined,
    });
    setIsPickupOpen(true);
  };

  const handleCreateWarehouseSlipFromPickup = async () => {
    const dtCode = (
      pickupParams.maDt ||
      activeVoucher?.ma_dt ||
      currentSelectedVoucher?.ma_dt ||
      ""
    ).trim();
    const ngayCtVal =
      pickupParams.ngayCt ||
      activeVoucher?.ngay_ct ||
      currentSelectedVoucher?.ngay_ct ||
      undefined;

    let custInfo: Partial<VoucherFullDetail> = {};
    if (dtCode) {
      await initCustomerIndex();
      const hit = getCustomer(dtCode);
      if (hit) {
        custInfo = {
          ma_dt: hit.ma_dt,
          ten_dt: hit.ten_dt,
          dia_chi: hit.dia_chi,
          ong_ba: hit.ong_ba,
          ma_bp: hit.ma_bp,
          ten_bp: hit.ten_bp,
        };
      } else {
        custInfo = { ma_dt: dtCode };
      }
    }

    setWarehouseOverlay({
      mode: "M",
      voucher: null,
      initialInherited: {
        ...custInfo,
        ngay_ct: ngayCtVal,
        dien_giai0: "xuất bán",
        ma_ct: "X1",
      },
    });
  };

  const handleEditWarehouseSlipFromPickup = async (stt: string) => {
    try {
      const res = await fetch(
        `/api/vouchers/${encodeURIComponent(stt)}?db_mode=warehouse`,
      );
      const data = await res.json();
      if (res.ok && data?.success && data?.data) {
        setWarehouseOverlay({
          mode: "S",
          stt,
          voucher: data.data as VoucherFullDetail,
        });
      } else {
        showToast(
          `Không thể tải phiếu kho ${stt}: ${data?.message || "Lỗi không xác định"}`,
        );
      }
    } catch (err: any) {
      showToast(`Lỗi tải phiếu kho: ${err.message}`);
    }
  };

  // Handler for F2 (New Voucher)
  const handleActionNew = () => {
    if (currentSelectedVoucher) {
      setInheritedData({
        ma_dt: currentSelectedVoucher.ma_dt,
        ten_dt: currentSelectedVoucher.ten_dt,
        dia_chi: currentSelectedVoucher.dia_chi,
        ong_ba: currentSelectedVoucher.ong_ba,
        dien_giai0: currentSelectedVoucher.dien_giai0,
        ma_xe: currentSelectedVoucher.ma_xe,
        ten_xe: currentSelectedVoucher.ten_xe,
        ma_bp: currentSelectedVoucher.ma_bp,
        ten_bp: currentSelectedVoucher.ten_bp,
        ma_ct: currentSelectedVoucher.ma_ct || "X1",
      });
    } else {
      setInheritedData(null);
    }
    navToNew();
  };

  // Handler for Ctrl+F2 (Copy Voucher)
  const handleActionCopy = () => {
    if (activeVoucher) {
      setInheritedData({
        ...activeVoucher,
        stt: undefined,
        so_ct: undefined,
        items: activeVoucher.items.map((it) => ({
          ...it,
          stt: undefined,
          stt0: undefined,
        })),
      });
      navToNew();
      showToast(
        `Đã sao chép nội dung chứng từ số ${activeVoucher.so_ct || activeVoucher.stt}.`,
      );
    } else if (currentSelectedVoucher) {
      setInheritedData({
        ...currentSelectedVoucher,
        stt: undefined,
        so_ct: undefined,
        items: listDetail.map((it) => ({
          ...it,
          stt: undefined,
          stt0: undefined,
        })),
      });
      navToNew();
      showToast(
        `Đã sao chép nội dung chứng từ số ${currentSelectedVoucher.so_ct || currentSelectedVoucher.stt}.`,
      );
    } else {
      showToast("Chưa chọn chứng từ để sao chép.");
    }
  };

  // Handler for F3 (Edit Voucher)
  const handleActionEdit = () => {
    if (selectedStt) {
      navToDetail(selectedStt);
    } else {
      showToast("Chưa chọn chứng từ để sửa.");
    }
  };

  // Handler for F8 (Delete Voucher)
  const handleActionDelete = () => {
    if (currentSelectedVoucher) {
      setDeleteTarget({
        stt: currentSelectedVoucher.stt,
        so_ct: currentSelectedVoucher.so_ct,
        ma_dt: currentSelectedVoucher.ma_dt,
        ten_dt: currentSelectedVoucher.ten_dt,
        ngay_ct: currentSelectedVoucher.ngay_ct,
        dbMode: voucherMode,
        fromPickup: false,
      });
    } else {
      showToast("Chưa chọn chứng từ để xóa.");
    }
  };

  // Handler for F7 / Ctrl+F7 / quick print (Print marked vouchers or active voucher)
  const handleActionPrint = (options?: {
    inGia?: "1" | "0";
    copies?: number;
    mode?: "direct" | "preview";
  }) => {
    const targets =
      marked.size > 0
        ? [
            ...vouchers.filter((v) => marked.has(v.stt)).map((v) => v.stt),
            ...Array.from(marked).filter(
              (s) => !vouchers.some((v) => v.stt === s),
            ),
          ]
        : activeVoucher
          ? [activeVoucher.stt]
          : selectedStt
            ? [selectedStt]
            : [];
    if (targets.length > 0) {
      handleOpenPrint(targets, options);
      if (marked.size > 0) {
        setMarked(new Set());
      }
    } else {
      showToast("Chưa chọn chứng từ để in.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/vouchers/${encodeURIComponent(target.stt)}?user_name=KTCN3&db_mode=${encodeURIComponent(target.dbMode)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(
          `Lỗi khi xóa: ${data?.detail?.message || data?.message || "Không thể xóa chứng từ."}`,
        );
        return;
      }
      if (target.fromPickup) {
        showToast(
          `Đã xóa thành công phiếu xuất kho số ${target.so_ct || target.stt}.`,
        );
        setDeleteTarget(null);
        setPickupFocusStt(null);
        setPickupRefreshTrigger((prev) => prev + 1);
      } else {
        showToast(
          `Đã xóa thành công chứng từ số ${target.so_ct || target.stt}.`,
        );
        setDeleteTarget(null);
        refresh();
        if (sttParam) {
          navToList();
        }
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Phím tắt riêng cho modal xác nhận xóa (Esc hủy, F8/Enter xác nhận) kể cả khi mở từ PickupDialog
  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!deleting) setDeleteTarget(null);
      } else if (e.key === "F8" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!deleting) void handleConfirmDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  // VFP Keyboard Shortcuts Handler (khớp ctbhh / ctbhd / ctbhch)
  useHotkeys(
    {
      // F2 / Ctrl+M = Thêm mới (ctbhh Command1)
      onF2: () => {
        if (!sttParam) handleActionNew();
      },
      onCtrlM: () => {
        if (!sttParam) handleActionNew();
      },
      // Ctrl+F2 = Sao chép tạo mới
      onCtrlF2: () => {
        if (!sttParam) handleActionCopy();
      },
      // F3 = Sửa (ctbhh Command2)
      onF3: () => {
        if (!sttParam) handleActionEdit();
      },
      onCtrlF3: () => showToast("Ctrl+F3 - Sửa mẫu in."),
      onF6: () => showToast("F6 - Nhập số IMEI."),
      // F7 = In chứng từ trực tiếp (nếu đã Space đánh dấu nhiều phiếu -> in toàn bộ phiếu đã chọn và bỏ chọn)
      onF7: () => handleActionPrint(),
      // Alt+Numpad3 / Alt+Numpad4 = In không giá (3 / 4 bản copy) trên VoucherList
      onAltNumpad3: () => {
        if (!sttParam) handleActionPrint({ inGia: "0", copies: 3 });
      },
      onAltNumpad4: () => {
        if (!sttParam) handleActionPrint({ inGia: "0", copies: 4 });
      },
      // Ctrl+Numpad3 / Ctrl+Numpad4 = In có giá (3 / 4 bản copy) trên VoucherList
      onCtrlNumpad3: () => {
        if (!sttParam) handleActionPrint({ inGia: "1", copies: 3 });
      },
      onCtrlNumpad4: () => {
        if (!sttParam) handleActionPrint({ inGia: "1", copies: 4 });
      },
      // Ctrl+F7 / Shift+F7 = Mở dialog PrintPreview (có tùy chọn In nợ cũ) trên VoucherList
      onPreview: () => {
        if (!sttParam) handleActionPrint({ mode: "preview" });
      },
      // F8 = Xóa (ctbhh Command3)
      onF8: () => {
        if (!sttParam) handleActionDelete();
      },
      // F9 = Lọc chứng từ (ctbhh Command6)
      onF9: () => setIsFilterOpen(true),
      // F4 = Chọn tài khoản
      onF4: () => {
        if (activeVoucher || isNew)
          showToast("F4 - Đang chọn tài khoản ngầm định.");
      },
      // Space = đánh dấu / bỏ đánh dấu dòng (ctbhh KeyPress 32)
      onSpace: () => {
        if (!sttParam) toggleMark(selectedStt);
      },
      // Ctrl+A = chọn tất cả dòng (Mark = .T.)
      onCtrlA: () => {
        if (!sttParam) {
          setMarked(new Set(vouchers.map((v) => v.stt)));
          showToast(`Đã chọn tất cả ${vouchers.length} chứng từ.`);
        }
      },
      // Ctrl+U = bỏ chọn tất cả dòng (Mark = .F.)
      onCtrlU: () => {
        if (!sttParam) {
          setMarked(new Set());
          showToast("Đã bỏ chọn tất cả chứng từ.");
        }
      },
      onCtrlF: () => {
        if (!sttParam) showToast("Ctrl+F - Đánh số chứng từ tự động.");
      },
      onEscape: () => {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (isPrintOpen) {
          setIsPrintOpen(false);
        } else if (isDebtOpen) {
          setIsDebtOpen(false);
        } else if (isPickupOpen) {
          setIsPickupOpen(false);
        } else if (isFilterOpen) {
          setIsFilterOpen(false);
        } else if (sttParam) {
          navToList();
        }
      },
      onCtrlHome: () => {
        if (!sttParam && vouchers.length > 0) setSelectedStt(vouchers[0].stt);
      },
      onCtrlEnd: () => {
        if (!sttParam && vouchers.length > 0)
          setSelectedStt(vouchers[vouchers.length - 1].stt);
      },
      // Tắt hotkey danh sách khi có dialog đang mở (tránh Space/Ctrl+A/Enter
      // ảnh hưởng tới VoucherList trong lúc thao tác trên PickupDialog/Filter...).
    },
    !(
      !!warehouseOverlay ||
      isPickupOpen ||
      isFilterOpen ||
      isDebtOpen ||
      isPrintOpen ||
      !!deleteTarget
    ),
  );

  const handleHotkeyBarAction = (actionId: string) => {
    switch (actionId) {
      case "NEW":
        handleActionNew();
        break;
      case "EDIT":
        handleActionEdit();
        break;
      case "IMEI":
        showToast("F6 - Nhập số IMEI.");
        break;
      case "DELETE":
        handleActionDelete();
        break;
      case "FILTER":
        setIsFilterOpen(true);
        break;
      case "PRINT":
        handleActionPrint();
        break;
      case "PREVIEW":
        handleActionPrint({ mode: "preview" });
        break;
      case "TOGGLE_MARK":
        toggleMark(selectedStt);
        break;
      case "SELECT_ALL":
        setMarked(new Set(vouchers.map((v) => v.stt)));
        break;
      case "DESELECT_ALL":
        setMarked(new Set());
        break;
      case "ESCAPE":
        if (deleteTarget) setDeleteTarget(null);
        else if (isPrintOpen) setIsPrintOpen(false);
        else if (isDebtOpen) setIsDebtOpen(false);
        else if (isPickupOpen) setIsPickupOpen(false);
        else if (isFilterOpen) setIsFilterOpen(false);
        else if (sttParam) navToList();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface print:hidden">
        {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-[80] bg-neutral-900 text-white px-4 py-2 rounded shadow-lg text-xs flex items-center gap-2 border border-neutral-700 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-4 h-4 text-tertiary-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div
            ref={deleteDialogRef}
            className="bg-white rounded shadow-2xl border border-neutral-300 w-[440px] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-danger-700 text-white px-4 py-2.5 flex items-center justify-between shadow">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span className="font-bold text-sm">
                  {deleteTarget.dbMode === "warehouse"
                    ? "Xác nhận xóa phiếu xuất kho"
                    : "Xác nhận xóa chứng từ"}
                </span>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-neutral-800 space-y-2.5">
              <p className="text-sm">
                Bạn có chắc chắn muốn xóa{" "}
                {deleteTarget.dbMode === "warehouse"
                  ? "phiếu xuất kho"
                  : "chứng từ"}{" "}
                số:{" "}
                <b className="font-mono text-primary-800 text-base">
                  {deleteTarget.so_ct || deleteTarget.stt}
                </b>
                ?
              </p>
              <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200 text-neutral-600 space-y-1">
                <div>
                  Khách hàng: <b>{deleteTarget.ten_dt || deleteTarget.ma_dt}</b>
                </div>
                <div>
                  Ngày lập: <b>{formatDate(deleteTarget.ngay_ct)}</b>
                </div>
              </div>
              <p className="text-danger-700 font-medium text-[11px]">
                Lưu ý: Thao tác sẽ gọi thủ tục CtBH_Delete để hoàn nhập kho và
                xóa bút toán trên CSDL{" "}
                {deleteTarget.dbMode === "warehouse" ? "KH_2014" : "VP_2014"}.
              </p>
            </div>
            <div className="bg-neutral-100 px-4 py-2 flex justify-end gap-2 border-t border-neutral-200">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 rounded text-neutral-700 font-medium text-xs cursor-pointer"
              >
                Hủy bỏ (Esc)
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3.5 py-1 bg-danger-600 hover:bg-danger-700 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Xóa chứng từ (F8)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Top Global Header (ẩn khi đang mở form Thêm mới / Sửa chứng từ) ===== */}
      {!sttParam && (
        <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 flex-shrink-0 z-30">
          <div className="px-3.5 py-1.5 flex items-center justify-between gap-4">
            {/* Logo, Breadcrumb, Tiêu đề & Khung lọc nhanh (dịch sang trái để dropdown KH rộng rãi) */}
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded text-white font-bold text-sm shadow ${
                  voucherMode === "warehouse"
                    ? "bg-emerald-700"
                    : "bg-primary-700"
                }`}
              >
                {voucherMode === "warehouse" ? "KH" : "PX"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">/</span>
                {/* Bộ chuyển đổi chế độ Phiếu Bán (VP_2014) <-> Phiếu Kho (KH_2014) */}
                <div className="inline-flex items-center bg-neutral-800 p-0.5 rounded border border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setVoucherMode("sales")}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                      voucherMode === "sales"
                        ? "bg-primary-700 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    title="Quản lý Hóa đơn / Phiếu Xuất Bán (CSDL VP_2014)"
                  >
                    Phiếu Xuất Bán
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherMode("warehouse")}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                      voucherMode === "warehouse"
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    title="Quản lý Phiếu Xuất Kho (CSDL KH_2014)"
                  >
                    Phiếu Xuất Kho
                  </button>
                </div>
                <Badge
                  variant={voucherMode === "warehouse" ? "info" : "success"}
                  className="ml-0.5 font-mono text-[10px]"
                >
                  {voucherMode === "warehouse" ? "CSDL: KH_2014" : "CSDL: VP_2014"}
                </Badge>
              </div>

              {/* Khung tìm kiếm & bộ lọc ngày (Enter để di chuyển & tìm kiếm) */}
              <div className="flex items-center gap-2 ml-2">
                <div className="flex items-center gap-1.5 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-xs text-neutral-300">
                  <label
                    htmlFor="header-ngay-ct1"
                    className="text-[11px] text-neutral-400 select-none"
                  >
                    Từ
                  </label>
                  <input
                    ref={ngayCt1InputRef}
                    id="header-ngay-ct1"
                    type="date"
                    value={headerNgayCt1}
                    onChange={(e) => setHeaderNgayCt1(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        ngayCt2InputRef.current?.focus();
                      }
                    }}
                    className="bg-transparent text-white font-mono text-[11px] outline-none [color-scheme:dark] cursor-pointer"
                    title="Từ ngày chứng từ (Enter sang Đến ngày)"
                  />
                  <span className="text-neutral-600">-</span>
                  <label
                    htmlFor="header-ngay-ct2"
                    className="text-[11px] text-neutral-400 select-none"
                  >
                    Đến
                  </label>
                  <input
                    ref={ngayCt2InputRef}
                    id="header-ngay-ct2"
                    type="date"
                    value={headerNgayCt2}
                    onChange={(e) => setHeaderNgayCt2(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        customerSearchInputRef.current?.focus();
                        customerSearchInputRef.current?.select();
                      }
                    }}
                    className="bg-transparent text-white font-mono text-[11px] outline-none [color-scheme:dark] cursor-pointer"
                    title="Đến ngày chứng từ (Enter sang ô Khách hàng)"
                  />
                </div>

                {/* Input tìm kiếm khách hàng (RAM index, dropdown 680px, Enter để tìm) */}
                <div className="relative w-48">
                  <Autocomplete
                    inputRef={customerSearchInputRef}
                    selectOnFocus
                    value={headerCustomerQuery}
                    onChange={(val) => {
                      headerCustomerRef.current = val;
                      setHeaderCustomerQuery(val);
                    }}
                    fetcher={fetchHeaderKhachHangOptions}
                    openOnTypeOnly
                    debounceMs={30}
                    maxResults={30}
                    dropdownMinWidth={680}
                    hideIcon={!!headerCustomerQuery}
                    placeholder="Mã/Tên KH (Enter tìm)"
                    className="w-full !pr-7 py-1 text-xs rounded bg-white text-neutral-900 border-neutral-300 font-medium placeholder-neutral-400"
                    onSelect={(opt) => {
                      void handleHeaderSearchSubmit(opt.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.defaultPrevented) {
                        e.preventDefault();
                        void handleHeaderSearchSubmit();
                      }
                    }}
                  />
                  {headerCustomerQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleHeaderSearchSubmit("");
                      }}
                      className="absolute inset-y-0 right-1.5 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer z-10"
                      title="Xóa lọc khách hàng (xóa cả kho & mã hàng)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Input tìm kiếm theo diễn giải (Enter để tìm) */}
                <div className="relative w-48">
                  <input
                    ref={dienGiaiInputRef}
                    type="text"
                    value={headerDienGiai}
                    onChange={(e) => {
                      headerDienGiaiRef.current = e.target.value;
                      setHeaderDienGiai(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleHeaderSearchSubmit();
                      }
                    }}
                    placeholder="Diễn giải (Enter tìm)..."
                    className="erp-input w-full !pr-7 py-1 text-xs rounded bg-white text-neutral-900 border-neutral-300 font-medium placeholder-neutral-400"
                    title="Tìm theo diễn giải (Enter để tìm)"
                  />
                  {headerDienGiai && (
                    <button
                      type="button"
                      onClick={() => {
                        headerDienGiaiRef.current = "";
                        setHeaderDienGiai("");
                        void handleHeaderSearchSubmit(undefined, "");
                      }}
                      className="absolute inset-y-0 right-1.5 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer z-10"
                      title="Xóa lọc diễn giải (xóa cả kho & mã hàng)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nút chức năng & thông tin người dùng */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Nút làm mới */}
              <button
                onClick={() => refresh()}
                disabled={loading}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition flex items-center justify-center cursor-pointer"
                title="Làm mới dữ liệu từ SQL (F5)"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>

              {/* Người dùng */}
              <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1 rounded border border-neutral-700">
                <User className="w-3.5 h-3.5 text-primary-300" />
                <span className="font-semibold text-neutral-200 text-xs">
                  KTCN3
                </span>
                <span className="text-neutral-400 text-[10px]">(ĐVCS: S1)</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative min-h-0">
        {sttParam ? (
          <VoucherForm
            key={`${voucherMode}:${isNew ? "new" : sttParam}`}
            stt={isNew ? undefined : sttParam}
            mode={isNew ? "M" : "S"}
            voucherMode={voucherMode}
            isSuspended={!!warehouseOverlay}
            voucher={isNew ? null : editingVoucher}
            initialInherited={inheritedData || undefined}
            pickupPayload={pickupPayload}
            onClearPickupPayload={() => setPickupPayload(null)}
            onBack={navToList}
            onPrint={() => {
              const targetStt = editingVoucher?.stt || sttParam;
              if (targetStt && !isNew) handleOpenPrint(targetStt);
            }}
            onViewDebt={(dt) => handleOpenDebt(dt)}
            onOpenPickup={handleOpenPickup}
            onSaveSuccess={(newStt) => {
              setSelectedStt(newStt);
              refresh();
              navToList();
            }}
          />
        ) : (
          <VoucherList
            vouchers={vouchers}
            pagination={pagination}
            filters={filters}
            loading={loading}
            selectedStt={selectedStt}
            markedStts={marked}
            detailItems={listDetail}
            detailLoading={listDetailLoading}
            debtAmount={debtAmount}
            voucherMode={voucherMode}
            onSelectStt={setSelectedStt}
            onToggleMark={toggleMark}
            onOpenFilter={() => setIsFilterOpen(true)}
            onOpenPrint={handleOpenPrint}
            onOpenPickup={() => handleOpenPickup()}
            onOpenDebt={handleOpenDebt}
            onRefresh={refresh}
            onChangePage={handleChangePage}
          />
        )}
      </main>

      {/* ===== Bottom Shortcut Action Toolbar (ẩn khi đang mở form Thêm mới / Sửa) ===== */}
      {!sttParam && (
        <footer className="bg-neutral-900 text-neutral-200 border-t border-neutral-800 px-3 py-1 flex-shrink-0 z-20 text-[11px]">
          <div className="flex items-center justify-between flex-wrap gap-y-1 gap-x-2">
            {/* Tùy chọn in */}
            <div className="flex items-center gap-2.5 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700 text-[11px]">
              <span className="font-medium text-neutral-300">Tùy chọn in:</span>
              <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-white">
                <input
                  checked={printPrice === "1"}
                  onChange={() => setPrintPrice("1")}
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="1"
                />
                <span>
                  <span className="font-mono font-bold text-primary-300">
                    1
                  </span>{" "}
                  - In giá bán
                </span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer text-neutral-300 hover:text-white">
                <input
                  checked={printPrice === "0"}
                  onChange={() => setPrintPrice("0")}
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="0"
                />
                <span>
                  <span className="font-mono text-neutral-400">0</span> - Không
                  in giá
                </span>
              </label>
            </div>

            {/* Nhóm phím thêm/sửa/xóa/in/lọc */}
            <div className="flex items-center flex-wrap gap-1 text-[11px]">
              <button
                onClick={() => handleHotkeyBarAction("NEW")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Thêm mới chứng từ (F2)"
              >
                <kbd className="text-[9px] py-0 px-1">F2</kbd>
                <span>Thêm</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("EDIT")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Sửa chứng từ đang chọn (F3)"
              >
                <kbd className="text-[9px] py-0 px-1">F3</kbd>
                <span>Sửa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("DELETE")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-danger-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Xóa chứng từ đang chọn (F8)"
              >
                <kbd className="text-[9px] py-0 px-1">F8</kbd>
                <span>Xóa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PRINT")}
                className="px-2 py-0.5 bg-primary-700 hover:bg-primary-800 text-white rounded border border-primary-600 transition flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="bg-primary-800 text-white border-primary-600 text-[9px] py-0 px-1">
                  F7
                </kbd>
                <span>In phiếu</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PREVIEW")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
                title="Mở hộp thoại xem trước khi in & tùy chọn In nợ cũ (Ctrl+F7)"
              >
                <kbd className="text-[9px] py-0 px-1">Ctrl+F7</kbd>
                <span>Xem trước</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("FILTER")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition flex items-center gap-1 cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">F9</kbd>
                <span>Lọc dữ liệu</span>
              </button>
            </div>

            {/* Nhóm tiện ích và thoát */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleHotkeyBarAction("ESCAPE")}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">Esc</kbd>
                <span>Quay ra</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      <FilterDialog
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilter}
      />

      <PickupDialog
        isOpen={isPickupOpen}
        isSuspended={!!warehouseOverlay || !!deleteTarget}
        onClose={() => setIsPickupOpen(false)}
        maDt={
          pickupParams.maDt ||
          activeVoucher?.ma_dt ||
          currentSelectedVoucher?.ma_dt ||
          ""
        }
        ngayCt={
          pickupParams.ngayCt ||
          activeVoucher?.ngay_ct ||
          currentSelectedVoucher?.ngay_ct ||
          undefined
        }
        refreshTrigger={pickupRefreshTrigger}
        focusStt={pickupFocusStt}
        onCreateWarehouseSlip={() => {
          void handleCreateWarehouseSlipFromPickup();
        }}
        onEditWarehouseSlip={(stt) => {
          void handleEditWarehouseSlipFromPickup(stt);
        }}
        onDeleteWarehouseSlip={(slip) => {
          setDeleteTarget({
            stt: slip.stt,
            so_ct: slip.so_ct,
            ma_dt: slip.ma_dt,
            ten_dt: slip.ten_dt,
            ngay_ct: slip.ngay_ct,
            dbMode: "warehouse",
            fromPickup: true,
          });
        }}
        onAccept={(_slips, items, maXe) => {
          setPickupPayload({ items, ma_xe: maXe });
          if (!sttParam) {
            // If currently on list view, open new voucher form with pickup items
            navToNew();
          }
          showToast(`Đã lấy ${items.length} dòng hàng từ kho.`);
        }}
      />

      {/* Overlay Thêm / Sửa Phiếu Xuất Kho (KH_2014) mở trực tiếp từ PickupDialog */}
      {warehouseOverlay && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col overflow-hidden shadow-2xl">
          <VoucherForm
            key={`wh-overlay:${warehouseOverlay.mode}:${warehouseOverlay.stt || "new"}`}
            stt={warehouseOverlay.stt}
            mode={warehouseOverlay.mode}
            voucherMode="warehouse"
            voucher={warehouseOverlay.voucher || null}
            initialInherited={warehouseOverlay.initialInherited}
            onBack={() => {
              setWarehouseOverlay(null);
            }}
            onPrint={() => {}}
            onViewDebt={() => {}}
            onOpenPickup={() => {}}
            onSaveSuccess={(savedStt) => {
              setWarehouseOverlay(null);
              setPickupFocusStt(savedStt);
              setPickupRefreshTrigger((prev) => prev + 1);
              showToast(
                warehouseOverlay.mode === "M"
                  ? "Đã tạo mới phiếu xuất kho thành công."
                  : "Đã cập nhật phiếu xuất kho thành công.",
              );
            }}
          />
        </div>
      )}

      <DebtPanel
        isOpen={isDebtOpen}
        onClose={() => setIsDebtOpen(false)}
        maDt={debtMaDt}
      />
      </div>

      <PrintPreview
        isOpen={isPrintOpen}
        onClose={() => {
          setIsPrintOpen(false);
          if (sttParam) navToList();
        }}
        stts={printStts}
        inGia={printInGia ?? printPrice}
        copies={printCopies}
        mode={printMode}
      />
    </>
  );
}

export default App;
