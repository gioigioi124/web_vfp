import React, { useState, useEffect, useCallback, useRef } from "react";
import { VoucherFullDetail, VoucherDetail } from "../types/voucher";
import { DetailGrid, DetailGridHandle } from "./DetailGrid";
import {
  formatCurrency,
  formatDate,
  formatQuantity,
  getTodayDate,
} from "../lib/format";
import { Autocomplete, AutocompleteOption } from "./ui/Autocomplete";
import { fetchPrice } from "../lib/lookups";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import { initProductIndex } from "../lib/productIndex";
import {
  initCatalogCache,
  searchXe,
  searchTaiKhoan,
  getXe,
  getBoPhan,
} from "../lib/catalogCache";
import { calcLoai2Item, calcVoucherTotals } from "../lib/calc";
import { isModalOpen, useModalLock } from "../lib/modalLock";
import {
  Printer,
  CreditCard,
  X,
  FileText,
  SlidersHorizontal,
  Table,
  Check,
  Ban,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface VoucherFormProps {
  voucher?: VoucherFullDetail | null;
  mode?: "M" | "S" | "VIEW";
  initialInherited?: Partial<VoucherFullDetail>;
  onBack: () => void;
  onPrint: () => void;
  onViewDebt: (maDt: string) => void;
  onOpenPickup: (maDt?: string, ngayCt?: string) => void;
  onSaveSuccess?: (stt: string) => void;
  pickupPayload?: { items: VoucherDetail[]; ma_xe?: string } | null;
  onClearPickupPayload?: () => void;
}

const emptyDetailRow = (): VoucherDetail => ({
  stt0: Math.random().toString(36).substring(2, 9),
  ma_vt: "",
  ten_vt: "",
  dvt: "",
  dvt_ban: "",
  loai_vt: "1",
  so_tam: 1,
  he_so8: 1,
  so_luong8: 1,
  he_so9: 1,
  so_luong9: 1,
  gia_nt9: 0,
  gia9: 0,
  tien_nt9: 0,
  tien9: 0,
  so_luong: 1,
  gia_nt: 0,
  gia: 0,
  tien_nt: 0,
  tien: 0,
  chiet_khau: 0,
  tien_nt4: 0,
  tien4: 0,
  tien_nt2: 0,
  tien2: 0,
  tien_nt3: 0,
  tien3: 0,
  tk: "632",
  tk_du: "1561",
  tk_du2: "5111",
  tk_du4: "521",
  ma_kho: "K0101",
  gia_tb_tt: "C",
});

export const VoucherForm: React.FC<VoucherFormProps> = ({
  voucher,
  mode = voucher?.stt ? "S" : "M",
  initialInherited,
  onBack,
  onPrint,
  onViewDebt,
  onOpenPickup,
  onSaveSuccess,
  pickupPayload,
  onClearPickupPayload,
}) => {
  const isCreate = mode === "M";
  const isEdit = mode === "S";
  const isEditable = isCreate || isEdit;

  // Refs for sequential focus & Enter navigation:
  // Ngày -> Số phiếu -> Mã đối tượng -> Diễn giải -> Mã xe -> Chọn phiếu xuất
  const ngayCtInputRef = useRef<HTMLInputElement | null>(null);
  const soCtInputRef = useRef<HTMLInputElement | null>(null);
  const maDtInputRef = useRef<HTMLInputElement | null>(null);
  const tenDtInputRef = useRef<HTMLInputElement | null>(null);
  const dienGiaiInputRef = useRef<HTMLInputElement | null>(null);
  const maXeInputRef = useRef<HTMLInputElement | null>(null);
  const pickupBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstMaVtRef = useRef<HTMLInputElement | null>(null);
  const detailGridRef = useRef<DetailGridHandle | null>(null);

  // Header State
  const [ngayCt, setNgayCt] = useState<string>(
    voucher?.ngay_ct || initialInherited?.ngay_ct || getTodayDate(),
  );
  const [soCt, setSoCt] = useState<string>(
    isCreate ? "" : voucher?.so_ct || initialInherited?.so_ct || "",
  );
  const [maDt, setMaDt] = useState<string>(
    voucher?.ma_dt || initialInherited?.ma_dt || "",
  );
  const [tenDt, setTenDt] = useState<string>(
    voucher?.ten_dt || initialInherited?.ten_dt || "",
  );
  const [ongBa, setOngBa] = useState<string>(
    voucher?.ong_ba ||
      initialInherited?.ong_ba ||
      voucher?.ten_dt ||
      initialInherited?.ten_dt ||
      "",
  );
  const [diaChi, setDiaChi] = useState<string>(
    voucher?.dia_chi || initialInherited?.dia_chi || "",
  );
  const [dienGiai0, setDienGiai0] = useState<string>(
    voucher?.dien_giai0 || initialInherited?.dien_giai0 || "Mua hàng",
  );
  const [maBp, setMaBp] = useState<string>(
    voucher?.ma_bp || initialInherited?.ma_bp || "",
  );
  const [tenBp, setTenBp] = useState<string>(
    voucher?.ten_bp || initialInherited?.ten_bp || "",
  );
  const [maXe, setMaXe] = useState<string>(
    voucher?.ma_xe || initialInherited?.ma_xe || "",
  );
  const [tenXe, setTenXe] = useState<string>(
    voucher?.ten_xe || initialInherited?.ten_xe || "",
  );
  const [hanTt, setHanTt] = useState<number>(
    voucher?.han_tt ?? initialInherited?.han_tt ?? 30,
  );
  const [tyGia, setTyGia] = useState<number>(
    voucher?.ty_gia ?? initialInherited?.ty_gia ?? 1.0,
  );
  const [maTte] = useState<string>(
    voucher?.ma_tte || initialInherited?.ma_tte || "VND",
  );
  const [maNx] = useState<string>(
    voucher?.ma_nx || initialInherited?.ma_nx || "131",
  );
  const [tk2, setTk2] = useState<string>(
    voucher?.tk2 || initialInherited?.tk2 || "1311",
  );
  const [tk3] = useState<string>(
    voucher?.tk3 || initialInherited?.tk3 || "33311",
  );
  const [thueGtgt] = useState<number>(
    voucher?.thue_gtgt ?? initialInherited?.thue_gtgt ?? 0,
  );
  const [loaiCk] = useState<string>(
    voucher?.loai_ck || initialInherited?.loai_ck || "2",
  );
  const [maCt] = useState<string>(
    voucher?.ma_ct || initialInherited?.ma_ct || "X1",
  );
  const [maDtGtGt, setMaDtGtGt] = useState<string>(
    voucher?.ma_dtgtgt || initialInherited?.ma_dtgtgt || "",
  );
  // Mã vùng/khu vực của khách hàng (DmDt.Ma_Vm) — hiển thị trên header.
  const [maVm, setMaVm] = useState<string>("");
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);

  // Detail Items State
  const [items, setItems] = useState<VoucherDetail[]>(() => {
    if (voucher?.items && voucher.items.length > 0) {
      return voucher.items.map((it) =>
        calcLoai2Item(
          { ...it, gia_tb_tt: "C" },
          voucher.ty_gia || 1.0,
          "",
          voucher.ma_tte || "VND",
        ),
      );
    }
    if (initialInherited?.items && initialInherited.items.length > 0) {
      return initialInherited.items.map((it) =>
        calcLoai2Item(
          { ...it, gia_tb_tt: "C" },
          initialInherited.ty_gia || 1.0,
          "",
          initialInherited.ma_tte || "VND",
        ),
      );
    }
    return [emptyDetailRow()];
  });

  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Status & Validation States
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debt Info State (khớp CustomerDebtSummary từ /api/debt/customer)
  const [debtInfo, setDebtInfo] = useState<{
    du_no: number;
    du_co: number;
    du_cuoi: number;
    gioi_han: number;
    toi_han: number;
    is_over_limit: boolean;
    is_near_limit: boolean;
    status_message: string;
  } | null>(null);
  // Dialog cảnh báo công nợ (thay cho thẻ span trước đây).
  const [debtDialog, setDebtDialog] = useState<{
    title: string;
    message: string;
    tone: "danger" | "warning";
  } | null>(null);
  // Chỉ kiểm tra hạn nợ SAU khi người dùng chọn khách hàng / Enter.
  // Khi tạo mới (mã KH kế thừa từ đơn đang xem) thì KHÔNG kiểm tra ngay.
  const [debtCheckArmed, setDebtCheckArmed] = useState<boolean>(!isCreate);
  const debtDialogRef = useRef<HTMLDivElement | null>(null);
  const accountPickerRef = useRef<HTMLDivElement | null>(null);
  useModalLock(!!debtDialog, debtDialogRef);
  useModalLock(showAccountPicker, accountPickerRef);

  // 0a. Nạp danh mục khách hàng (RAM) + index vật tư (Web Worker) + danh mục nhỏ
  //     (kho/xe/bộ phận/tài khoản) một lần khi mở form.
  useEffect(() => {
    initCustomerIndex();
    initProductIndex();
    initCatalogCache();
  }, []);

  // Ref giữ mã khách mới nhất để effect enrich async không ghi đè khi người dùng đã đổi mã.
  const maDtRef = useRef<string>(maDt);
  maDtRef.current = maDt;

  // Ref giữ giá trị ô Mã KH mới nhất, cập nhật ĐỒNG BỘ trong onChange/onSelect.
  // Tránh việc onKeyDown/onBlur dùng giá trị cũ (stale closure) ghi đè mã vừa chọn.
  const maDtValueRef = useRef<string>(maDt);
  // Đồng bộ khi maDt đổi từ bên ngoài (nạp phiếu cũ) — không ảnh hưởng luồng gõ/chọn.
  useEffect(() => {
    maDtValueRef.current = maDt;
  }, [maDt]);

  // 0. Khi F2 tạo phiếu mới (isCreate), tự động focus vào ô Mã đối tượng và bôi đen nội dung có sẵn
  useEffect(() => {
    if (!isCreate) return;
    const timer = setTimeout(() => {
      if (maDtInputRef.current) {
        maDtInputRef.current.focus();
        maDtInputRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isCreate]);

  // 1. Tự động lấy số phiếu tiếp theo (VD: lớn nhất HD1000 -> tự điền HD1001) khi tạo phiếu mới
  useEffect(() => {
    if (!isCreate) return;
    let cancelled = false;
    const fetchNextSoCt = async () => {
      try {
        const res = await fetch(
          `/api/vouchers/next-number?ma_ct=${encodeURIComponent(maCt || "X1")}&ngay_ct=${encodeURIComponent(ngayCt)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const suggested = data?.data?.so_ct;
          if (!cancelled && suggested) {
            setSoCt((prev) => (prev.trim() ? prev : suggested));
          }
        }
      } catch {
        // Fallback giữ nguyên nếu offline
      }
    };
    fetchNextSoCt();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, maCt]);

  // 2. Watch for pickup payload from PickupDialog
  useEffect(() => {
    if (pickupPayload && pickupPayload.items.length > 0) {
      const calculatedItems = pickupPayload.items.map((it) =>
        calcLoai2Item({ ...it, gia_tb_tt: "C" }, tyGia, "", maTte),
      );
      setItems(calculatedItems);
      // R2.3: Kế thừa ma_xe nếu header đang trống
      if (pickupPayload.ma_xe && !maXe.trim()) {
        setMaXe(pickupPayload.ma_xe);
      }
      setActiveRowIndex(0);
      onClearPickupPayload?.();
    }
  }, [pickupPayload, tyGia, maTte, maXe, onClearPickupPayload]);

  // 3. Tự động lookup thông tin Ông/Bà, Địa chỉ, Mã bộ phận, Tên bộ phận từ DmDt khi có maDt ban đầu.
  //    Dùng index RAM (tức thì); CHỈ áp kết quả nếu mã khách chưa đổi trong lúc chờ (chống ghi đè).
  useEffect(() => {
    if (!maDt || !maDt.trim()) return;
    let cancelled = false;
    const target = maDt.trim().toUpperCase();
    const enrichFromMaDt = async () => {
      // RAM-only: chờ lần nạp danh mục đầu tiên (đã khởi động từ app) rồi tra trong RAM.
      await initCustomerIndex();
      const cust = getCustomer(target);
      if (cancelled || !cust) return;
      // Người dùng đã đổi sang mã khách khác trong lúc chờ -> bỏ kết quả cũ.
      if ((maDtRef.current || "").trim().toUpperCase() !== target) return;
      if (cust.ten_dt) setTenDt(cust.ten_dt);
      const resolvedOngBa = cust.ong_ba || cust.doi_tac || cust.ten_dt || "";
      if (resolvedOngBa) setOngBa(resolvedOngBa);
      if (cust.dia_chi !== undefined && !diaChi) setDiaChi(cust.dia_chi);
      if (cust.ma_bp) setMaBp(cust.ma_bp);
      if (cust.ten_bp) setTenBp(cust.ten_bp);
      if (cust.ms_thue) setMaDtGtGt(cust.ms_thue);
      setMaVm(cust.ma_vm || "");
    };
    enrichFromMaDt();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maDt]);

  // 4. Nếu đã có maBp nhưng tenBp đang trống -> tự động lookup tên bộ phận từ DmBp
  useEffect(() => {
    if (!maBp || !maBp.trim()) {
      setTenBp("");
      return;
    }
    if (tenBp && tenBp.trim()) return;
    let cancelled = false;
    // RAM-only: chờ lần nạp danh mục đầu tiên rồi tra trong RAM.
    initCatalogCache().then(() => {
      if (cancelled) return;
      const bp = getBoPhan(maBp);
      if (bp && bp.ten_bp) setTenBp(bp.ten_bp);
    });
    return () => {
      cancelled = true;
    };
  }, [maBp, tenBp]);

  // 5. Nếu đã có maXe nhưng tenXe đang trống -> tự động lookup biển số / tên xe từ DmXe
  useEffect(() => {
    if (!maXe || !maXe.trim()) {
      setTenXe("");
      return;
    }
    if (tenXe && tenXe.trim()) return;
    let cancelled = false;
    // RAM-only: chờ lần nạp danh mục đầu tiên rồi tra trong RAM.
    initCatalogCache().then(() => {
      if (cancelled) return;
      const xe = getXe(maXe);
      if (xe && xe.ten_xe) setTenXe(xe.ten_xe);
    });
    return () => {
      cancelled = true;
    };
  }, [maXe, tenXe]);

  // Load customer debt info on maDt change (công nợ đến NGÀY HIỆN TẠI).
  const loadDebtInfo = useCallback(async (dt: string) => {
    if (!dt) {
      setDebtInfo(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/debt/customer?ma_dt=${encodeURIComponent(dt)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const d = data.data;
          setDebtInfo({
            du_no: d.du_no ?? 0,
            du_co: d.du_co ?? 0,
            du_cuoi: d.du_cuoi ?? 0,
            gioi_han: d.gioi_han ?? 0,
            toi_han: d.toi_han ?? 0,
            is_over_limit: !!d.is_over_limit,
            is_near_limit: !!d.is_near_limit,
            status_message: d.status_message ?? "",
          });
        }
      }
    } catch {
      setDebtInfo(null);
    }
  }, []);

  useEffect(() => {
    if (maDt) {
      loadDebtInfo(maDt);
    } else {
      setDebtInfo(null);
    }
  }, [maDt, loadDebtInfo]);

  // Hiện dialog cảnh báo khi công nợ vượt/chạm hạn mức (chỉ khi mã khách đổi).
  const lastDebtWarnRef = useRef<string>("");
  useEffect(() => {
    if (!debtInfo || !maDt) return;
    // Chưa "kích hoạt" kiểm tra (tạo mới, chưa chọn khách) -> không cảnh báo.
    if (!debtCheckArmed) return;
    const key = `${maDt}|${debtInfo.is_over_limit}|${debtInfo.is_near_limit}`;
    if (lastDebtWarnRef.current === key) return;
    lastDebtWarnRef.current = key;

    const fmt = (n: number) => formatCurrency(n, "VND");
    if (debtInfo.is_over_limit) {
      setDebtDialog({
        title: "Vượt quá hạn mức nợ",
        tone: "danger",
        message:
          `Khách hàng ${maDt} vượt quá hạn mức nợ cho phép!\n\n` +
          `Dư nợ hiện tại: ${fmt(debtInfo.du_cuoi)}\n` +
          `Giới hạn nợ: ${fmt(debtInfo.gioi_han)}\n\n` +
          `Vui lòng kiểm tra lại trước khi lưu chứng từ.`,
      });
    } else if (debtInfo.is_near_limit) {
      setDebtDialog({
        title: "Đến hạn mức thanh toán",
        tone: "warning",
        message:
          `Khách hàng ${maDt} đã chạm ngưỡng cảnh báo thanh toán.\n\n` +
          `Dư nợ hiện tại: ${fmt(debtInfo.du_cuoi)}\n` +
          `Ngưỡng cảnh báo: ${fmt(debtInfo.toi_han)}`,
      });
    }
  }, [debtInfo, maDt, debtCheckArmed]);

  // Handle Customer Selection -> tự động điền Tên KH, Ông/Bà (từ Doi_Tac hoặc Ten_Dt), Địa chỉ, Mã bộ phận, Tên bộ phận
  const [maDtError, setMaDtError] = useState<string | null>(null);
  const handleSelectCustomer = async (selectedCode: string) => {
    const raw = selectedCode.trim().toUpperCase();
    if (!raw) {
      setMaDtError(null);
      return;
    }
    // Người dùng đã chọn/Enter khách hàng -> bật kiểm tra hạn nợ.
    setDebtCheckArmed(true);
    // RAM-only: chờ lần nạp danh mục đầu tiên (đã khởi động từ app) rồi tra trong RAM.
    await initCustomerIndex();
    const cust = getCustomer(raw);
    // Nếu người dùng đã đổi sang mã khác trong lúc chờ -> bỏ kết quả cũ.
    if (maDtValueRef.current.trim().toUpperCase() !== raw) return;
    if (cust && cust.ma_dt) {
      // LUÔN lấy MÃ thật từ danh mục DmDt, không dùng chuỗi người dùng đã gõ.
      // Tránh trường hợp người dùng gõ TÊN khách -> Ma_Dt bị ghi thành tên (ghi rác).
      const realCode = cust.ma_dt.trim().toUpperCase();
      maDtValueRef.current = realCode;
      setMaDt(realCode);
      setMaDtError(null);
      setTenDt(cust.ten_dt || "");
      setOngBa(cust.ong_ba || cust.doi_tac || cust.ten_dt || "");
      setDiaChi(cust.dia_chi || "");
      setMaBp(cust.ma_bp || "");
      setTenBp(cust.ten_bp || "");
      if (cust.han_tt !== undefined) setHanTt(cust.han_tt);
      if (cust.ma_xe && !maXe) {
        setMaXe(cust.ma_xe);
        setTenXe("");
      }
      setMaDtGtGt(cust.ms_thue || "");
      setMaVm(cust.ma_vm || "");
    } else {
      // Không tìm thấy mã khách trong DmDt -> giữ nguyên chuỗi để người dùng sửa,
      // đánh dấu lỗi và chặn Lưu (khớp hành vi VFP: Ma_Dt phải là mã hợp lệ).
      setMaDt(raw);
      setMaDtError(
        `Mã khách hàng "${raw}" không tồn tại trong danh mục. Vui lòng chọn từ danh sách.`,
      );
    }
  };

  // Handle Xe Selection -> tự động điền Mã xe và Biển số (Ten_Xe).
  // - Để trống: KHÔNG tự chọn (xóa cả mã lẫn tên).
  // - Có gõ mã: lấy mã khớp chính xác; nếu không, lấy mã ĐẦU TIÊN tìm thấy; nếu vẫn không có -> null.
  const handleSelectXe = async (selectedMaXe: string, hintTenXe?: string) => {
    const cleanXe = (selectedMaXe || "").trim().toUpperCase();
    if (!cleanXe) {
      setMaXe("");
      setTenXe("");
      return;
    }
    if (hintTenXe) {
      setMaXe(cleanXe);
      setTenXe(hintTenXe);
      return;
    }
    await initCatalogCache();
    const cached = getXe(cleanXe);
    if (cached) {
      setMaXe(cached.ma_xe);
      setTenXe(cached.ten_xe || "");
      return;
    }
    // Không khớp chính xác -> lấy mã đầu tiên tìm thấy.
    const first = searchXe(cleanXe)[0];
    if (first) {
      setMaXe(first.value);
      setTenXe(first.hint || "");
      return;
    }
    // Không tìm thấy -> fallback null.
    setMaXe("");
    setTenXe("");
  };

  // Fetcher cho ô Mã xe: RAM-only (chờ lần nạp đầu tiên rồi tra RAM).
  const fetchXeOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchXe(query);
    },
    [],
  );

  // Fetcher cho ô Tài khoản (F4): RAM-only.
  const fetchTaiKhoanOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchTaiKhoan(query);
    },
    [],
  );

  // Fetcher cho ô Mã khách hàng: RAM-only (chờ lần nạp đầu tiên rồi tra RAM).
  // Memo hóa để không tạo tham chiếu mới mỗi render (tránh Autocomplete fetch lặp).
  const fetchKhachHangOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCustomerIndex();
      return searchCustomers(query);
    },
    [],
  );

  // Tra đơn giá bán & chiết khấu từ bảng giá VP_2014 (BG/BG0) cho một mã vật tư.
  const handleLookupPrice = useCallback(
    async (maVt: string) => {
      const price = await fetchPrice(maVt, maDt, ngayCt);
      if (!price) return null;
      return {
        gia_nt9: price.gia,
        chiet_khau: price.chiet_khau,
        expired: price.expired,
      };
    },
    [maDt, ngayCt],
  );

  // Detail Item changes & recalculations
  const handleItemChange = (
    idx: number,
    updatedItem: VoucherDetail,
    fieldName?: string,
  ) => {
    const calculated = calcLoai2Item(
      { ...updatedItem, gia_tb_tt: "C" },
      tyGia,
      fieldName || "",
      maTte,
    );
    // Dùng functional update để tránh dùng snapshot `items` cũ khi callback async
    // (lookup DmVt) hoàn tất muộn hơn các ô người dùng đã nhập.
    setItems((prev) => {
      const nextItems = [...prev];
      nextItems[idx] = calculated;
      return nextItems;
    });
  };

  const handleDeleteItem = (idx: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    if (activeRowIndex >= next.length) {
      setActiveRowIndex(next.length - 1);
    }
  };

  const handleAddItem = () => {
    setErrorMessage(null);

    // Tìm dòng trống (chưa có mã hàng hóa / mã vật tư)
    let emptyIdx = -1;
    if (
      activeRowIndex >= 0 &&
      activeRowIndex < items.length &&
      (!items[activeRowIndex]?.ma_vt || !items[activeRowIndex].ma_vt.trim())
    ) {
      emptyIdx = activeRowIndex;
    } else {
      emptyIdx = items.findIndex((it) => !it.ma_vt || !it.ma_vt.trim());
    }

    if (emptyIdx >= 0) {
      // Dòng trống: focus ngay vào mã hàng hóa của dòng đó, không thông báo nữa
      setActiveRowIndex(emptyIdx);
      detailGridRef.current?.focusMaVt(emptyIdx);
      return;
    }

    // Nếu tất cả các dòng đều đã có mã hàng hóa: thêm dòng mới
    const next = [...items, emptyDetailRow()];
    setItems(next);
    setActiveRowIndex(next.length - 1);
  };

  // Calculate voucher totals
  const totals = calcVoucherTotals(items, tyGia, thueGtgt, loaiCk);
  const totalQty = items.reduce((s, it) => s + (it.so_luong9 || 0), 0);

  // Save handler (POST / PUT): lúc lưu tự động kiểm tra số phiếu, nếu trùng tự thay bằng số gợi ý
  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!maDt.trim()) {
      setErrorMessage("Vui lòng chọn Mã khách hàng / Đối tượng.");
      return;
    }
    if (maDtError) {
      setErrorMessage(maDtError);
      return;
    }
    if (!ngayCt.trim()) {
      setErrorMessage("Vui lòng nhập Ngày hạch toán.");
      return;
    }
    if (!maNx.trim()) {
      setErrorMessage("Vui lòng nhập Mã nhập xuất.");
      return;
    }
    if (items.length === 0 || !items.some((it) => it.ma_vt?.trim())) {
      setErrorMessage(
        "Chứng từ phải có ít nhất 1 dòng mặt hàng với Mã vật tư hợp lệ.",
      );
      return;
    }

    // Kiểm tra các dòng hàng trong Grid trước khi lưu
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.ma_vt?.trim()) {
        setErrorMessage(`Dòng ${i + 1}: Chưa nhập Mã vật tư.`);
        return;
      }
      if (!it.ma_kho?.trim()) {
        setErrorMessage(`Dòng ${i + 1}: Chưa nhập Mã kho.`);
        return;
      }
      if (Number(it.so_luong9 ?? 0) <= 0) {
        setErrorMessage(`Dòng ${i + 1}: Số lượng phải lớn hơn 0.`);
        return;
      }
    }

    setSaving(true);
    try {
      let currentSoCt = soCt.trim().toUpperCase();

      // Tự động kiểm tra lại số phiếu trước khi lưu và thay bằng số gợi ý nếu trùng hoặc đang trống
      try {
        const chkRes = await fetch("/api/vouchers/check-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ma_dvcs: "S1",
            moi_sua: isCreate ? "M" : "S",
            stt: voucher?.stt || "",
            ma_ct: maCt || "X1",
            ngay_ct: ngayCt,
            so_ct: currentSoCt,
          }),
        });
        if (chkRes.ok) {
          const chkData = await chkRes.json();
          const suggested = chkData?.data?.valid_so_ct;
          if (suggested) {
            currentSoCt = suggested;
            setSoCt(suggested);
          }
        }
      } catch {
        // Nếu check-number gặp lỗi mạng tạm thời, backend save_voucher vẫn kiểm tra trong ACID transaction
      }

      const payload = {
        ma_dvcs: "S1",
        ma_ct: maCt || "X1",
        nh_ct: "2",
        ma_tte: maTte,
        ty_gia: tyGia,
        ngay_ct: ngayCt,
        so_ct: currentSoCt,
        ma_dt: maDt.trim().toUpperCase(),
        ten_dt: tenDt,
        ong_ba: ongBa,
        dia_chi: diaChi,
        dien_giai0: dienGiai0,
        ma_bp: maBp,
        ma_xe: maXe.trim().toUpperCase(),
        han_tt: hanTt,
        ma_nx: maNx,
        tk2: tk2,
        tk3: tk3,
        thue_gtgt: thueGtgt,
        loai_ck: loaiCk,
        ma_dtgtgt: maDtGtGt,
        ttien_nt: totals.ttien_nt,
        ttien_nt4: totals.ttien_nt4,
        ttien_nt2: totals.ttien_nt2,
        ttien_nt3: totals.ttien_nt3,
        ttien_nt0: totals.ttien_nt0,
        ttien: totals.ttien,
        ttien4: totals.ttien4,
        ttien2: totals.ttien2,
        ttien3: totals.ttien3,
        ttien0: totals.ttien0,
        user_name: "KTCN3",
        items: items.map((it) => ({
          ...it,
          ma_vt: (it.ma_vt || "").trim().toUpperCase(),
          ma_kho: (it.ma_kho || "K0101").trim().toUpperCase(),
          tk: it.tk || "632",
          tk_du: it.tk_du || "1561",
          tk_du2: it.tk_du2 || "5111",
          tk_du4: it.tk_du4 || "521",
          gia_tb_tt: "C",
        })),
      };

      const url = isCreate
        ? "/api/vouchers"
        : `/api/vouchers/${encodeURIComponent(voucher?.stt || "")}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg =
          data?.detail?.message || data?.message || "Lỗi khi lưu chứng từ.";
        // Cảnh báo hạn mức nợ hiện qua dialog thay vì thẻ span.
        if (/hạn mức nợ|gioi han no|vượt quá hạn mức/i.test(msg)) {
          setDebtDialog({
            title: "Vượt quá hạn mức nợ",
            tone: "danger",
            message: msg,
          });
        } else {
          setErrorMessage(msg);
        }
        return;
      }

      const savedSoCt = data.data?.so_ct || currentSoCt;
      if (savedSoCt) {
        setSoCt(savedSoCt);
      }

      setSuccessMessage(
        `${isCreate ? "Tạo mới" : "Cập nhật"} chứng từ thành công! Số phiếu: ${savedSoCt}`,
      );
      if (onSaveSuccess && data.data?.stt) {
        setTimeout(() => {
          onSaveSuccess(data.data.stt);
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi mạng hoặc máy chủ không phản hồi.");
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut listener for Ctrl+Enter / Esc / F8 / F4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Khi có dialog đang mở (PickupDialog / DebtPanel / ...) -> khóa cứng,
      // không cho ESC/Ctrl+Enter/F8/F4 thoát ra ngoài form.
      if (isModalOpen()) return;
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onBack();
      } else if (e.key === "F8" && isEditable) {
        e.preventDefault();
        handleDeleteItem(activeRowIndex);
      } else if (e.key === "F4" && isEditable) {
        e.preventDefault();
        setShowAccountPicker(true);
      } else if (
        isEditable &&
        e.ctrlKey &&
        (e.code === "NumpadAdd" ||
          e.key === "+" ||
          e.key === "=" ||
          e.code === "Equal")
      ) {
        // Ctrl + (numpad hoặc phím +/=) = thêm dòng
        e.preventDefault();
        handleAddItem();
      } else if (
        isEditable &&
        e.ctrlKey &&
        (e.code === "NumpadSubtract" || e.key === "-")
      ) {
        // Ctrl - (numpad) = xóa dòng đang chọn
        e.preventDefault();
        handleDeleteItem(activeRowIndex);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable, activeRowIndex, items, maDt, ngayCt, soCt, totals]);

  const readonlyField =
    "erp-input w-full font-mono text-neutral-800 bg-neutral-100 border-neutral-200 cursor-text select-text";
  const disabledLookupField =
    "erp-input w-full text-xs py-0.5 bg-neutral-100 text-neutral-700 border-neutral-200 cursor-text select-text";

  // Điều hướng các ô trên Header bằng phím mũi tên ↑ / ↓ / ← / → (tương tự Excel / VFP)
  const headerOrderedRefs = [
    ngayCtInputRef,
    soCtInputRef,
    maDtInputRef,
    tenDtInputRef,
    dienGiaiInputRef,
    maXeInputRef,
  ];
  const focusHeaderControl = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== "date") {
      setTimeout(() => {
        if (document.activeElement === el) el.select();
      }, 0);
    }
  };
  const handleHeaderArrowNav = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) => {
    const el = e.currentTarget;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < headerOrderedRefs.length - 1) {
        focusHeaderControl(headerOrderedRefs[idx + 1].current);
      } else {
        focusHeaderControl(firstMaVtRef.current);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) {
        focusHeaderControl(headerOrderedRefs[idx - 1].current);
      }
    } else if (e.key === "ArrowLeft") {
      const atStart =
        el.type === "date" ||
        (el.selectionStart === 0 && el.selectionEnd === 0) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atStart && idx > 0) {
        e.preventDefault();
        focusHeaderControl(headerOrderedRefs[idx - 1].current);
      }
    } else if (e.key === "ArrowRight") {
      const atEnd =
        el.type === "date" ||
        (el.selectionStart === el.value.length &&
          el.selectionEnd === el.value.length) ||
        (el.selectionStart === 0 && el.selectionEnd === el.value.length);
      if (atEnd) {
        e.preventDefault();
        if (idx < headerOrderedRefs.length - 1) {
          focusHeaderControl(headerOrderedRefs[idx + 1].current);
        } else {
          focusHeaderControl(firstMaVtRef.current);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* ===== Window Header (navy) ===== */}
      <header className="bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0 border-b border-primary-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-white/15 text-primary-100 border border-white/20">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide uppercase text-white">
              {isCreate
                ? "Thêm Mới Chứng Từ"
                : isEdit
                  ? "Sửa Chứng Từ"
                  : "Xem Chứng Từ"}
            </span>
            <span className="text-primary-200 text-xs font-normal">
              / Bán hàng công nợ (ctbhd)
            </span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isCreate
                  ? "bg-success-600/30 text-success-200 border-success-400/40"
                  : isEdit
                    ? "bg-amber-500/30 text-amber-200 border-amber-400/40"
                    : "bg-white/10 text-white border-white/20"
              }`}
            >
              {isCreate
                ? "MODE: THÊM MỚI (M)"
                : isEdit
                  ? "MODE: SỬA (S)"
                  : "MODE: XEM"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-primary-200">Người lập:</span>
            <span className="font-semibold text-white bg-primary-900/60 px-2 py-0.5 rounded border border-white/20">
              KTCN3
            </span>
          </div>
          <div className="flex items-center gap-1 pl-2 border-l border-white/20">
            {voucher?.stt && (
              <button
                className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="In phiếu (F7)"
                onClick={onPrint}
                type="button"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}
            {maDt && (
              <button
                className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Chi tiết công nợ"
                onClick={() => onViewDebt(maDt)}
                type="button"
              >
                <CreditCard className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              className="p-1 px-2 text-rose-200 hover:text-white hover:bg-danger-600 rounded transition-colors ml-1"
              title="Đóng (Esc)"
              onClick={onBack}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Toast Notifications / Alerts ===== */}
      {errorMessage && (
        <div className="bg-danger-50 border-b border-danger-200 px-4 py-2 flex items-center justify-between text-xs text-danger-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-danger-500 hover:text-danger-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-success-50 border-b border-success-200 px-4 py-2 flex items-center justify-between text-xs text-success-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-success-500 hover:text-success-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===== Master Information Form ===== */}
      <section
        className="bg-neutral-50/90 border-b border-neutral-200 px-3 py-1.5 shrink-0"
        data-purpose="master-form"
      >
        <div className="flex flex-col xl:flex-row items-start gap-2.5 max-w-[1920px] mx-auto">
          {/* Left & Center: Transaction & Customer */}
          <div className="w-full xl:flex-1 min-w-0 grid grid-cols-12 gap-x-2 gap-y-1.5">
            {/* Row 1: Dates, Voucher No & Credit Guard */}
            <div className="col-span-12 flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 border-b border-neutral-200/80">
              <div className="flex items-center gap-1.5">
                <label className="erp-label text-neutral-700 font-bold">
                  Ngày hạch toán:
                </label>
                {isEditable ? (
                  <input
                    ref={ngayCtInputRef}
                    type="date"
                    className="erp-input w-32 text-xs py-0.5 font-mono font-semibold"
                    value={ngayCt}
                    onChange={(e) => setNgayCt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        soCtInputRef.current?.focus();
                        soCtInputRef.current?.select();
                        return;
                      }
                      handleHeaderArrowNav(e, 0);
                    }}
                  />
                ) : (
                  <input
                    className={readonlyField + " w-28 text-xs py-0.5"}
                    value={formatDate(ngayCt)}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <label className="erp-label text-neutral-700 font-bold">
                  Số phiếu:
                </label>
                {isEditable ? (
                  <input
                    ref={soCtInputRef}
                    className="erp-input w-28 font-mono font-bold text-primary-700 bg-white border-primary-300 uppercase tracking-wide text-xs py-0.5"
                    value={soCt}
                    onChange={(e) => setSoCt(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        maDtInputRef.current?.focus();
                        maDtInputRef.current?.select();
                        return;
                      }
                      handleHeaderArrowNav(e, 1);
                    }}
                    placeholder="Tự động cấp số"
                  />
                ) : (
                  <input
                    className="erp-input w-24 font-mono font-bold text-primary-700 bg-white border-primary-300 text-center uppercase tracking-wide text-xs py-0.5 cursor-text select-text"
                    value={soCt || "—"}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                )}
              </div>

              {/* Ma_Vm + Giới hạn nợ + Dư nợ (hiển thị dạng label thông thường cạnh Số phiếu) */}
              <div className="flex items-center gap-1.5 ml-2">
                <label className="erp-label text-neutral-600 font-semibold">
                  Ma_Vm:
                </label>
                <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md text-xs">
                  {maVm || "—"}
                </span>
              </div>

              <span className="text-neutral-300">|</span>

              <div className="flex items-center gap-1.5">
                <label className="erp-label text-neutral-600 font-semibold">
                  Giới hạn nợ:
                </label>
                <span className="font-mono font-bold text-neutral-800 px-2 py-0.5 rounded-md text-xs">
                  {debtInfo ? formatCurrency(debtInfo.gioi_han) : "—"}
                </span>
              </div>

              {debtInfo && (
                <>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const fmt = (n: number) => formatCurrency(n, "VND");
                      setDebtDialog({
                        title: debtInfo.is_over_limit
                          ? "Vượt quá hạn mức nợ"
                          : debtInfo.is_near_limit
                            ? "Đến hạn mức thanh toán"
                            : "Công nợ khách hàng",
                        tone: debtInfo.is_over_limit
                          ? "danger"
                          : debtInfo.is_near_limit
                            ? "warning"
                            : "warning",
                        message:
                          `Khách hàng: ${maDt}\n\n` +
                          `Dư nợ hiện tại: ${fmt(debtInfo.du_cuoi)}\n` +
                          `Giới hạn nợ: ${fmt(debtInfo.gioi_han)}\n` +
                          `Ngưỡng cảnh báo: ${fmt(debtInfo.toi_han)}\n\n` +
                          `${debtInfo.status_message}`,
                      });
                    }}
                    className={`inline-flex items-center gap-1 text-xs cursor-pointer hover:underline ${
                      debtInfo.is_over_limit
                        ? "text-danger-700 font-bold"
                        : debtInfo.is_near_limit
                          ? "text-amber-700 font-semibold"
                          : "text-neutral-700 font-medium"
                    }`}
                    title="Xem chi tiết công nợ"
                  >
                    <CreditCard className="w-3.5 h-3.5 opacity-70" />
                    <span>
                      Dư nợ:{" "}
                      <span className="font-mono font-bold">
                        {formatCurrency(debtInfo.du_cuoi)}
                      </span>
                    </span>
                    {debtInfo.is_over_limit && (
                      <span className="text-danger-600 ml-0.5 font-bold">
                        (Vượt HM!)
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Row 2: Đối tượng (Mã + Tên), Địa chỉ (readonly), Ông/Bà (readonly) cân đối cùng 1 dòng */}
            <div className="col-span-12 flex items-center gap-2">
              <label className="erp-label w-[72px] shrink-0 inline-block">
                Đối tượng:
              </label>
              {isEditable ? (
                <div className="w-40 shrink-0">
                  <Autocomplete
                    inputRef={maDtInputRef}
                    selectOnFocus
                    value={maDt}
                    onChange={(val) => {
                      maDtValueRef.current = val;
                      setMaDt(val);
                      if (maDtError) setMaDtError(null);
                    }}
                    onSelect={(opt) => {
                      maDtValueRef.current = opt.value;
                      handleSelectCustomer(opt.value);
                    }}
                    onBlur={() => {
                      const v = maDtValueRef.current;
                      if (v.trim()) {
                        handleSelectCustomer(v);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = maDtValueRef.current;
                        if (v.trim()) {
                          handleSelectCustomer(v);
                        }
                        tenDtInputRef.current?.focus();
                        tenDtInputRef.current?.select();
                        return;
                      }
                      handleHeaderArrowNav(e, 2);
                    }}
                    fetcher={fetchKhachHangOptionsLocal}
                    placeholder="Mã KH..."
                    openOnTypeOnly
                    debounceMs={30}
                    maxResults={30}
                    dropdownMinWidth={680}
                    className={`font-mono font-bold uppercase ${
                      maDtError
                        ? "text-danger-700 border-danger-400 bg-danger-50"
                        : "text-primary-800"
                    }`}
                  />
                  {maDtError && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-danger-700">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={maDtError}>
                        Mã KH không hợp lệ
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-28 shrink-0">
                  <input
                    className={disabledLookupField + " font-mono font-bold"}
                    value={maDt}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                </div>
              )}
              <div className="w-96 shrink-0">
                {isEditable ? (
                  <input
                    ref={tenDtInputRef}
                    className="erp-input w-full font-semibold text-neutral-800 text-xs py-0.5 bg-white border-neutral-300"
                    value={tenDt || ""}
                    onChange={(e) => setTenDt(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        dienGiaiInputRef.current?.focus();
                        dienGiaiInputRef.current?.select();
                        return;
                      }
                      handleHeaderArrowNav(e, 3);
                    }}
                    placeholder="Tên khách hàng"
                  />
                ) : (
                  <input
                    className={
                      disabledLookupField + " font-semibold text-neutral-800"
                    }
                    value={tenDt || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                    title={tenDt || ""}
                    placeholder="Tên khách hàng"
                  />
                )}
              </div>

              <label className="erp-label shrink-0 ml-1">Địa chỉ:</label>
              <div className="flex-1 min-w-[180px] ">
                <input
                  className={disabledLookupField}
                  value={diaChi || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={diaChi || ""}
                />
              </div>
            </div>

            {/* Row 3: Ông/Bà (readonly) và Bộ phận (readonly) cùng 1 dòng ngay dưới Đối tượng */}
            <div className="col-span-12 flex items-center gap-2">
              <label className="erp-label w-[72px] shrink-0 inline-block">
                Ông/Bà:
              </label>
              <div className="w-[350px] shrink-0">
                <input
                  className={disabledLookupField + " font-medium"}
                  value={ongBa || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={ongBa || ""}
                />
              </div>

              <label className="erp-label shrink-0 ml-1 text-neutral-500">
                Bộ phận:
              </label>
              <div className="w-16 shrink-0">
                <input
                  className={
                    disabledLookupField + " font-mono font-semibold text-center"
                  }
                  value={maBp || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                />
              </div>
              <div className="w-96 shrink-0">
                <input
                  className={disabledLookupField}
                  value={tenBp || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={tenBp || ""}
                />
              </div>
            </div>

            {/* Row 4: Diễn giải, Mã xe + Biển số, và nút Chọn phiếu xuất cùng 1 dòng */}
            <div className="col-span-12 flex items-center gap-2">
              <label className="erp-label w-[72px] shrink-0 inline-block">
                Diễn giải:
              </label>
              <div className="w-[350px] shrink-0">
                <input
                  ref={dienGiaiInputRef}
                  className={`erp-input w-full font-medium text-neutral-800 text-xs py-0.5 ${
                    isEditable
                      ? "bg-white border-neutral-300"
                      : "bg-neutral-100 cursor-text select-text"
                  }`}
                  value={dienGiai0 || ""}
                  onChange={(e) => setDienGiai0(e.target.value)}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => {
                      if (document.activeElement === target) {
                        target.select();
                      }
                    }, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      maXeInputRef.current?.focus();
                      maXeInputRef.current?.select();
                      return;
                    }
                    handleHeaderArrowNav(e, 4);
                  }}
                  readOnly={!isEditable}
                />
              </div>

              <label className="erp-label shrink-0 ml-1">Xe:</label>
              {isEditable ? (
                <div className="w-24 shrink-0">
                  <Autocomplete
                    inputRef={maXeInputRef}
                    selectOnFocus
                    value={maXe || ""}
                    onChange={(val) => setMaXe(val)}
                    onSelect={(opt) => handleSelectXe(opt.value, opt.hint)}
                    onBlur={() => handleSelectXe(maXe)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (maXe.trim()) {
                          handleSelectXe(maXe);
                        }
                        pickupBtnRef.current?.focus();
                        return;
                      }
                      handleHeaderArrowNav(e, 5);
                    }}
                    fetcher={fetchXeOptionsLocal}
                    openOnTypeOnly
                    debounceMs={30}
                    maxResults={30}
                    dropdownMinWidth={360}
                    placeholder="Mã xe..."
                    className="font-mono font-semibold text-neutral-800 uppercase"
                  />
                </div>
              ) : (
                <div className="w-20 shrink-0">
                  <input
                    className={disabledLookupField + " font-mono text-center"}
                    value={maXe || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                </div>
              )}
              <div className="w-64 shrink-0">
                <input
                  className={disabledLookupField}
                  value={tenXe || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={tenXe || ""}
                />
              </div>

              {isEditable && (
                <button
                  ref={pickupBtnRef}
                  type="button"
                  onClick={() => onOpenPickup(maDt, ngayCt)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenPickup(maDt, ngayCt);
                    } else if (
                      (e.key === "Tab" && !e.shiftKey) ||
                      e.key === "ArrowDown" ||
                      e.key === "ArrowRight"
                    ) {
                      if (firstMaVtRef.current) {
                        e.preventDefault();
                        firstMaVtRef.current.focus();
                        firstMaVtRef.current.select();
                      }
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      focusHeaderControl(maXeInputRef.current);
                    }
                  }}
                  className="inline-flex items-center px-2.5 py-0.5 rounded bg-secondary-50 hover:bg-secondary-100 focus:ring-2 focus:ring-primary-600 focus:outline-none text-secondary-700 border border-secondary-300 shadow-sm font-semibold text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  title="Chọn phiếu xuất từ kho (ctbhch)"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-secondary-600" />
                  Chọn phiếu xuất
                </button>
              )}
            </div>
          </div>

          {/* Right: Accounting Posting Parameters (thu gọn, đồng bộ kích thước Mã NX và TK Nợ) */}
          <div className="w-auto shrink-0 bg-white px-2.5 py-1.5 rounded border border-neutral-200 shadow-sm flex flex-col gap-1 self-start">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider pb-0.5 border-b border-neutral-100 flex items-center justify-between gap-2">
              <span>Định khoản</span>
              <SlidersHorizontal className="w-3 h-3 text-neutral-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="erp-label shrink-0 text-neutral-600">
                  Mã NX:
                </label>
                <input
                  className="erp-input !w-16 shrink-0 text-center font-mono font-bold text-xs py-0.5 bg-neutral-100 border-neutral-200 text-neutral-800 cursor-text select-text"
                  value={maNx}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="erp-label shrink-0 text-neutral-600">
                  TK Nợ:
                </label>
                <input
                  className="erp-input !w-16 shrink-0 text-center font-mono font-bold text-xs py-0.5 bg-neutral-100 border-neutral-200 text-primary-900 cursor-text select-text"
                  value={tk2}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title="Tài khoản Nợ cố định (1311)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Grid Toolbar ===== */}
      <div
        className="bg-neutral-100 px-4 py-1.5 border-b border-neutral-200 flex items-center justify-between shrink-0"
        data-purpose="grid-actions"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wide text-neutral-700 flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5 text-primary-600" /> Chi tiết hàng hóa
          </span>
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-500 text-[11px]">
            Đang ghi nhận:{" "}
            <b className="text-neutral-800">{items.length} dòng</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 px-2 py-1 rounded bg-white border border-neutral-300 shadow-sm text-xs">
            <span className="text-[11px] text-neutral-500 font-medium">
              Tổng SL:
            </span>
            <span className="font-mono font-bold text-neutral-800">
              {formatQuantity(totalQty)}
            </span>
          </div>
          {isEditable && (
            <button
              type="button"
              onClick={() => handleDeleteItem(activeRowIndex)}
              disabled={items.length <= 1}
              className="inline-flex items-center px-2 py-1 rounded bg-white border border-neutral-300 text-neutral-700 shadow-sm font-medium hover:border-danger-400 hover:text-danger-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              title="Xóa dòng đang chọn (F8)"
            >
              <Trash2 className="w-3.5 h-3.5 text-danger-500 mr-1" /> Xóa dòng
              <kbd className="ml-1 text-[10px]">F8</kbd>
            </button>
          )}
        </div>
      </div>

      {/* ===== Main Data Grid ===== */}
      <div
        className="flex-1 overflow-hidden bg-white relative"
        data-purpose="ledger-table-container"
      >
        <DetailGrid
          gridRef={detailGridRef}
          items={items}
          currency={maTte}
          variant="form"
          editable={isEditable}
          activeRowIndex={activeRowIndex}
          onSelectRow={setActiveRowIndex}
          onChangeItem={handleItemChange}
          onDeleteItem={handleDeleteItem}
          onAddItem={handleAddItem}
          onValidationError={(msg) => setErrorMessage(msg)}
          firstMaVtRef={firstMaVtRef}
          onLookupPrice={handleLookupPrice}
        />
      </div>

      {/* ===== Action Footer Bar ===== */}
      <footer
        className="bg-white border-t border-neutral-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0"
        data-purpose="footer-controls"
      >
        <div className="flex items-center gap-2">
          {isEditable ? (
            <button
              className="inline-flex items-center px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              type="button"
              onClick={handleSave}
              disabled={saving}
              title="Chấp nhận lưu chứng từ (Ctrl + Enter)"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {saving ? "Đang lưu..." : "Chấp nhận"}
              <kbd className="ml-2 bg-primary-900/40 text-primary-100 border-primary-600 text-[10px]">
                Ctrl + Enter
              </kbd>
            </button>
          ) : (
            <button
              className="inline-flex items-center px-4 py-1.5 bg-neutral-200 text-neutral-500 font-semibold rounded shadow-sm cursor-not-allowed"
              type="button"
              disabled
            >
              <Check className="w-4 h-4 mr-2" />
              Chấp nhận
            </button>
          )}

          <button
            className="inline-flex items-center px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded border border-neutral-300 transition-all cursor-pointer"
            type="button"
            onClick={onBack}
          >
            <Ban className="w-4 h-4 text-neutral-500 mr-2" />
            Hủy bỏ
            <kbd className="ml-2 text-[10px]">Esc</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 text-neutral-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-tight">
                Tiền hàng:
              </span>
              <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded px-2.5 py-1 shadow-sm">
                <span className="font-mono font-bold text-neutral-900 text-xs">
                  {/* Tiền hàng trước chiết khấu = tổng thành tiền bán (Tien_Nt9).
                      Không dùng totals.ttien_nt (giá vốn COGS) để tránh hiển thị 0. */}
                  {formatCurrency(
                    items.reduce((s, it) => s + (it.tien_nt9 || 0), 0),
                    maTte,
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-tight">
                Tiền CK:
              </span>
              <div className="flex items-center gap-1 bg-white border border-primary-200 rounded px-2.5 py-1 shadow-sm">
                <span className="font-mono font-bold text-primary-900 text-xs">
                  {formatCurrency(totals.ttien_nt4, maTte)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-tight">
                Thuế VAT:
              </span>
              <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded px-2.5 py-1 shadow-sm">
                <span className="font-mono font-bold text-neutral-900 text-xs">
                  {formatCurrency(totals.ttien_nt3, maTte)}
                </span>
              </div>
            </div>
            <div className="h-5 w-px bg-neutral-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold text-neutral-600 tracking-wide">
                Tổng thanh toán:
              </span>
              <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded px-3 py-1 shadow-sm">
                <span className="font-mono font-bold text-primary-900 tracking-tight text-sm">
                  {formatCurrency(totals.ttien_nt0, maTte)}
                </span>
                <span className="text-xs font-bold text-primary-700">₫</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Debt Warning Dialog */}
      {debtDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div
            ref={debtDialogRef}
            className="bg-white rounded shadow-2xl border border-neutral-300 w-[420px] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div
              className={`px-3.5 py-2 flex items-center justify-between text-white ${
                debtDialog.tone === "danger" ? "bg-danger-700" : "bg-amber-600"
              }`}
            >
              <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                {debtDialog.tone === "danger" ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {debtDialog.title}
              </span>
              <button
                type="button"
                onClick={() => setDebtDialog(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
              {debtDialog.message}
            </div>
            <div className="bg-neutral-100 px-3 py-2 flex justify-end border-t border-neutral-200">
              <button
                type="button"
                data-autofocus
                onClick={() => setDebtDialog(null)}
                className="px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Picker Modal (F4) */}
      {showAccountPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div
            ref={accountPickerRef}
            className="bg-white rounded shadow-2xl border border-neutral-300 w-96 overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-primary-800 text-white px-3.5 py-2 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide">
                F4: Chọn tài khoản
              </span>
              <button
                type="button"
                onClick={() => setShowAccountPicker(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <label className="text-xs text-neutral-600 font-medium block">
                Tìm số hiệu hoặc tên tài khoản:
              </label>
              <Autocomplete
                value=""
                onChange={() => {}}
                onSelect={(opt) => {
                  if (activeRowIndex >= 0 && activeRowIndex < items.length) {
                    const row = items[activeRowIndex];
                    handleItemChange(
                      activeRowIndex,
                      { ...row, tk_du2: opt.value, tk_du: opt.value },
                      "TK_DU2",
                    );
                  }
                  setShowAccountPicker(false);
                }}
                fetcher={fetchTaiKhoanOptionsLocal}
                placeholder="Ví dụ: 5111, 131, 33311..."
                className="w-full text-xs"
              />
              <p className="text-[11px] text-neutral-500 italic">
                Tài khoản chọn sẽ được áp dụng cho dòng {activeRowIndex + 1}{" "}
                đang đứng.
              </p>
            </div>
            <div className="bg-neutral-100 px-3 py-1.5 flex justify-end border-t border-neutral-200">
              <button
                type="button"
                data-autofocus
                onClick={() => setShowAccountPicker(false)}
                className="px-3 py-1 bg-white border border-neutral-300 rounded text-xs font-medium hover:bg-neutral-50 cursor-pointer"
              >
                Đóng (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
