import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVouchers } from "./hooks/useVouchers";
import { useHotkeys } from "./hooks/useHotkeys";
import { VoucherList } from "./components/VoucherList";
import { VoucherForm } from "./components/VoucherForm";
import { FilterDialog } from "./components/FilterDialog";
import { PickupDialog } from "./components/PickupDialog";
import { DebtPanel } from "./components/DebtPanel";
import { PrintPreview } from "./components/PrintPreview";
import { Badge } from "./components/ui/Badge";
import { formatDate } from "./lib/format";
import {
  VoucherFullDetail,
  VoucherDetail,
  VoucherHeader,
} from "./types/voucher";
import { User, ShieldCheck, Search, RefreshCw, Trash2, X } from "lucide-react";

export function App() {
  const {
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
    printStt,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  } = useVouchers();

  const [notification, setNotification] = useState<string | null>(null);
  // Đánh dấu dòng (Mark) giống ctbhh — Space / Ctrl+A / Ctrl+U tác động.
  const [marked, setMarked] = useState<Set<string>>(new Set());

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<VoucherHeader | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

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

  const navToDetail = (stt: string) =>
    navigate(`/sales-invoices/${encodeURIComponent(stt)}`);
  const navToNew = () => navigate("/sales-invoices/new");
  const navToList = () => navigate("/sales-invoices");

  useEffect(() => {
    if (sttParam && !isNew) {
      if (activeVoucher?.stt !== sttParam) {
        handleOpenDetail(sttParam);
      }
    } else if (!sttParam && activeVoucher) {
      handleCloseDetail();
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

  // Handler for F2 (New Voucher)
  const handleActionNew = () => {
    if (currentSelectedVoucher) {
      setInheritedData({
        ma_dt: currentSelectedVoucher.ma_dt,
        ten_dt: currentSelectedVoucher.ten_dt,
        dia_chi: currentSelectedVoucher.dia_chi,
        ong_ba: currentSelectedVoucher.ong_ba,
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
      setDeleteTarget(currentSelectedVoucher);
    } else {
      showToast("Chưa chọn chứng từ để xóa.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/vouchers/${encodeURIComponent(deleteTarget.stt)}?user_name=KTCN3`,
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
      showToast(
        `Đã xóa thành công chứng từ số ${deleteTarget.so_ct || deleteTarget.stt}.`,
      );
      setDeleteTarget(null);
      refresh();
      if (sttParam) {
        navToList();
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // VFP Keyboard Shortcuts Handler (khớp ctbhh / ctbhd / ctbhch)
  useHotkeys(
    {
      // F2 = Thêm mới (ctbhh Command1)
      onF2: () => {
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
      // F7 = In chứng từ (ctbhh Command5)
      onF7: () => {
        if (activeVoucher) handleOpenPrint(activeVoucher.stt);
        else if (selectedStt) handleOpenPrint(selectedStt);
        else showToast("Chưa chọn chứng từ để in.");
      },
      // Shift+F7 / Ctrl+F7 = Xem trước (ctbhh Command4)
      onPreview: () => {
        if (activeVoucher) handleOpenPrint(activeVoucher.stt);
        else if (selectedStt) handleOpenPrint(selectedStt);
        else showToast("Chưa chọn chứng từ để xem trước.");
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
      onSpace: () => toggleMark(selectedStt),
      // Ctrl+A = chọn tất cả dòng (Mark = .T.)
      onCtrlA: () => {
        setMarked(new Set(vouchers.map((v) => v.stt)));
        showToast(`Đã chọn tất cả ${vouchers.length} chứng từ.`);
      },
      // Ctrl+U = bỏ chọn tất cả dòng (Mark = .F.)
      onCtrlU: () => {
        setMarked(new Set());
        showToast("Đã bỏ chọn tất cả chứng từ.");
      },
      onCtrlF: () => showToast("Ctrl+F - Đánh số chứng từ tự động."),
      // Enter = mở chi tiết dòng đang chọn (tương đương double-click)
      onEnter: () => {
        if (!sttParam && selectedStt) {
          navToDetail(selectedStt);
        }
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
        if (vouchers.length > 0) setSelectedStt(vouchers[0].stt);
      },
      onCtrlEnd: () => {
        if (vouchers.length > 0)
          setSelectedStt(vouchers[vouchers.length - 1].stt);
      },
      // Tắt hotkey danh sách khi có dialog đang mở (tránh Space/Ctrl+A/Enter
      // ảnh hưởng tới VoucherList trong lúc thao tác trên PickupDialog/Filter...).
    },
    !(
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
      case "PREVIEW":
        if (activeVoucher) handleOpenPrint(activeVoucher.stt);
        else if (selectedStt) handleOpenPrint(selectedStt);
        else showToast("Chưa chọn chứng từ.");
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-900 text-white px-4 py-2 rounded shadow-lg text-xs flex items-center gap-2 border border-neutral-700 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-4 h-4 text-tertiary-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded shadow-2xl border border-neutral-300 w-[440px] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-danger-700 text-white px-4 py-2.5 flex items-center justify-between shadow">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span className="font-bold text-sm">Xác nhận xóa chứng từ</span>
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
                Bạn có chắc chắn muốn xóa chứng từ số:{" "}
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
                xóa bút toán sổ cái trên CSDL VP_2014.
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
            {/* Logo, Breadcrumb & Tiêu đề màn hình */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-primary-700 text-white font-bold text-sm shadow">
                PX
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">/</span>
                <h1 className="text-sm font-semibold text-white tracking-wide">
                  Phiếu Xuất Bán
                </h1>
                <Badge variant="success" className="ml-1 font-mono text-[10px]">
                  GĐ2: PERSISTENCE (ACID)
                </Badge>
              </div>
            </div>

            {/* Khung tìm kiếm & bộ lọc kỳ kế toán nhanh */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-xs text-neutral-300">
                <span className="font-mono text-[11px]">
                  {filters?.ngay_ct1 ? formatDate(filters.ngay_ct1) : "Tất cả"}
                  {filters?.ngay_ct2 && filters.ngay_ct2 !== filters.ngay_ct1
                    ? ` - ${formatDate(filters.ngay_ct2)}`
                    : ""}
                </span>
              </div>

              {/* Input tìm kiếm nhanh */}
              <div className="relative w-64">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  className="w-full pl-8 pr-12 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-400 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none"
                  placeholder="Tìm số phiếu, khách hàng, diễn giải..."
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setIsFilterOpen(true);
                  }}
                />
                <span className="absolute inset-y-0 right-1.5 flex items-center">
                  <kbd className="text-[9px] bg-neutral-700 border-neutral-600 text-neutral-300 py-0.5 px-1">
                    F9
                  </kbd>
                </span>
              </div>

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
            mode={isNew ? "M" : "S"}
            voucher={isNew ? null : activeVoucher}
            initialInherited={inheritedData || undefined}
            pickupPayload={pickupPayload}
            onClearPickupPayload={() => setPickupPayload(null)}
            onBack={navToList}
            onPrint={() => {
              if (activeVoucher) handleOpenPrint(activeVoucher.stt);
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
            onSelectStt={setSelectedStt}
            onToggleMark={toggleMark}
            onOpenDetail={navToDetail}
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
                  defaultChecked
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
                className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition flex items-center gap-1 cursor-pointer"
              >
                <kbd className="text-[9px] py-0 px-1">Ctrl+F7</kbd>
                <span>Xem phiếu</span>
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
        onAccept={(_slips, items, maXe) => {
          setPickupPayload({ items, ma_xe: maXe });
          if (!sttParam) {
            // If currently on list view, open new voucher form with pickup items
            navToNew();
          }
          showToast(`Đã lấy ${items.length} dòng hàng từ kho.`);
        }}
      />

      <DebtPanel
        isOpen={isDebtOpen}
        onClose={() => setIsDebtOpen(false)}
        maDt={debtMaDt}
      />

      <PrintPreview
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        stt={printStt}
      />
    </div>
  );
}

export default App;
