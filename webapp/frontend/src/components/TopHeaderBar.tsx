import React, { useState, useEffect, useRef, useCallback } from "react";
import { Autocomplete } from "./ui/Autocomplete";
import { Badge } from "./ui/Badge";
import {
  initCustomerIndex,
  searchCustomers,
  getCustomer,
} from "../lib/customerIndex";
import { VoucherFilterParams, VoucherMode } from "../types/voucher";
import { User, RefreshCw, X } from "lucide-react";

interface TopHeaderBarProps {
  voucherMode?: VoucherMode;
  onChangeVoucherMode?: (mode: VoucherMode) => void;
  filters: Pick<
    VoucherFilterParams,
    "ngay_ct1" | "ngay_ct2" | "ma_dt" | "dien_giai"
  >;
  loading: boolean;
  onApplyFilter: (next: Partial<VoucherFilterParams>) => void;
  onRefresh: () => void;
  customerSearchInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  moduleBadge?: string;
  moduleTitle?: string;
  moduleAccentClass?: string;
  hideModeSwitcher?: boolean;
  extraRightActions?: React.ReactNode;
}

export const TopHeaderBar: React.FC<TopHeaderBarProps> = React.memo(
  ({
    voucherMode = "sales",
    onChangeVoucherMode,
    filters,
    loading,
    onApplyFilter,
    onRefresh,
    customerSearchInputRef: externalCustomerInputRef,
    moduleBadge,
    moduleTitle,
    moduleAccentClass,
    hideModeSwitcher = false,
    extraRightActions,
  }) => {
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
    const internalCustomerRef = useRef<HTMLInputElement | null>(null);
    const customerSearchInputRef =
      externalCustomerInputRef ?? internalCustomerRef;
    const dienGiaiInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setHeaderNgayCt1(filters?.ngay_ct1 || "");
      setHeaderNgayCt2(filters?.ngay_ct2 || "");
      const dt = filters?.ma_dt || "";
      setHeaderCustomerQuery(dt);
      headerCustomerRef.current = dt;
      const dg = filters?.dien_giai || "";
      setHeaderDienGiai(dg);
      headerDienGiaiRef.current = dg;
    }, [
      filters?.ngay_ct1,
      filters?.ngay_ct2,
      filters?.ma_dt,
      filters?.dien_giai,
    ]);

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

        onApplyFilter({
          ngay_ct1: headerNgayCt1,
          ngay_ct2: headerNgayCt2,
          ma_dt: resolvedDt,
          dien_giai: dg,
        });
      },
      [onApplyFilter, headerNgayCt1, headerNgayCt2, resolveHeaderCustomer],
    );

    const badgeText =
      moduleBadge ||
      (voucherMode === "warehouse"
        ? "KH"
        : voucherMode === "return"
          ? "NL"
          : "PX");
    const badgeBg =
      moduleAccentClass ||
      (voucherMode === "warehouse"
        ? "bg-emerald-700"
        : voucherMode === "return"
          ? "bg-amber-700"
          : "bg-primary-700");

    return (
      <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 flex-shrink-0 z-30">
        <div className="px-3.5 py-1.5 flex items-center justify-between gap-4">
          {/* Logo, Breadcrumb, Tiêu đề & Khung lọc nhanh */}
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded text-white font-bold text-xs font-mono shadow ${badgeBg}`}
            >
              {badgeText}
            </div>
            <div className="flex items-center gap-2">
              {hideModeSwitcher && moduleTitle ? (
                <span className="text-sm font-bold text-white tracking-tight">
                  {moduleTitle}
                </span>
              ) : (
                <>
                  <span className="text-neutral-600">/</span>
                  {/* Bộ chuyển đổi chế độ Phiếu Bán (VP_2014) <-> Nhập lại N5 <-> Phiếu Kho (KH_2014) */}
                  <div className="inline-flex items-center bg-neutral-800 p-0.5 rounded border border-neutral-700">
                    <button
                      type="button"
                      onClick={() => onChangeVoucherMode?.("sales")}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                        voucherMode === "sales"
                          ? "bg-primary-700 text-white shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                      title="Quản lý Hóa đơn / Phiếu Xuất Bán (CSDL VP_2014)"
                    >
                      Phiếu Xuất Bán
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeVoucherMode?.("return")}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                        voucherMode === "return"
                          ? "bg-amber-700 text-white shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                      title="Quản lý Phiếu Nhập Lại Hàng Trả Lại N5 (CSDL VP_2014)"
                    >
                      Nhập lại (N5)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeVoucherMode?.("warehouse")}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                        voucherMode === "warehouse"
                          ? "bg-emerald-700 text-white shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                      title="Quản lý Phiếu Xuất Kho (CSDL KH_2014)"
                    >
                      Phiếu Xuất Kho
                    </button>
                  </div>
                </>
              )}
              <Badge
                variant={
                  voucherMode === "warehouse"
                    ? "info"
                    : voucherMode === "return"
                      ? "warning"
                      : "success"
                }
                className="ml-0.5 font-mono text-[10px]"
              >
                {hideModeSwitcher
                  ? "CSDL: VP_2014 · CtT"
                  : voucherMode === "warehouse"
                    ? "CSDL: KH_2014"
                    : voucherMode === "return"
                      ? "CSDL: VP_2014 · N5"
                      : "CSDL: VP_2014"}
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
                    title="Xóa lọc khách hàng"
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
                    title="Xóa lọc diễn giải"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nút chức năng & thông tin người dùng */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {extraRightActions}
            {/* Nút làm mới */}
            <button
              onClick={onRefresh}
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
    );
  },
);

TopHeaderBar.displayName = "TopHeaderBar";
