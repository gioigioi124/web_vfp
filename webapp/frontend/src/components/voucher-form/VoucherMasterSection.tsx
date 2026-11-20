import React from "react";
import { CreditCard, FileText, SlidersHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "../../lib/format";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import {
  clampField,
  DebtInfoSummary,
  InvalidVoucherField,
} from "./types";

export interface VoucherMasterSectionProps {
  isWarehouse: boolean;
  isReturn?: boolean;
  isEditable: boolean;
  invalidField: InvalidVoucherField;
  setInvalidField: React.Dispatch<React.SetStateAction<InvalidVoucherField>>;
  ngayCt: string;
  setNgayCt: (val: string) => void;
  soCt: string;
  setSoCt: (val: string) => void;
  maVm: string;
  debtInfo: DebtInfoSummary | null;
  isOverDebtLimit: boolean;
  maDt: string;
  setMaDt: (val: string) => void;
  maDtError: string | null;
  setMaDtError: (val: string | null) => void;
  tenDt: string;
  setTenDt: (val: string) => void;
  diaChi: string;
  ongBa: string;
  maBp: string;
  tenBp: string;
  dienGiai0: string;
  setDienGiai0: (val: string) => void;
  fallbackDienGiai: string;
  maXe: string;
  setMaXe: (val: string) => void;
  tenXe: string;
  maNx: string;
  tk2: string;
  // Refs
  ngayCtInputRef: React.MutableRefObject<HTMLInputElement | null>;
  soCtInputRef: React.MutableRefObject<HTMLInputElement | null>;
  maDtInputRef: React.MutableRefObject<HTMLInputElement | null>;
  tenDtInputRef: React.MutableRefObject<HTMLInputElement | null>;
  dienGiaiInputRef: React.MutableRefObject<HTMLInputElement | null>;
  maXeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  pickupBtnRef: React.MutableRefObject<HTMLButtonElement | null>;
  firstMaVtRef: React.MutableRefObject<HTMLInputElement | null>;
  autoSuggestedSoCtRef: React.MutableRefObject<string>;
  userEditedSoCtRef: React.MutableRefObject<boolean>;
  maDtValueRef: React.MutableRefObject<string>;
  committedMaDtRef: React.MutableRefObject<string>;
  lastWarnedMaDtRef: React.MutableRefObject<string>;
  tenDtEditedRef: React.MutableRefObject<boolean>;
  // Handlers & fetchers
  onViewDebt?: (maDt: string) => void;
  openDebtLedger: () => void;
  onOpenPickup?: (maDt?: string, ngayCt?: string) => void;
  handleSelectCustomer: (code: string) => Promise<void>;
  handleSelectXe: (code: string, hint?: string) => Promise<void>;
  fetchKhachHangOptionsLocal: (query: string) => Promise<AutocompleteOption[]>;
  fetchXeOptionsLocal: (query: string) => Promise<AutocompleteOption[]>;
  focusHeaderControl: (el: HTMLElement | null | undefined) => void;
  handleHeaderArrowNav: (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) => void;
}

export const VoucherMasterSection: React.FC<VoucherMasterSectionProps> = ({
  isWarehouse,
  isReturn = false,
  isEditable,
  invalidField,
  setInvalidField,
  ngayCt,
  setNgayCt,
  soCt,
  setSoCt,
  maVm,
  debtInfo,
  isOverDebtLimit,
  maDt,
  setMaDt,
  maDtError,
  setMaDtError,
  tenDt,
  setTenDt,
  diaChi,
  ongBa,
  maBp,
  tenBp,
  dienGiai0,
  setDienGiai0,
  fallbackDienGiai,
  maXe,
  setMaXe,
  tenXe,
  maNx,
  tk2,
  ngayCtInputRef,
  soCtInputRef,
  maDtInputRef,
  tenDtInputRef,
  dienGiaiInputRef,
  maXeInputRef,
  pickupBtnRef,
  firstMaVtRef,
  autoSuggestedSoCtRef,
  userEditedSoCtRef,
  maDtValueRef,
  committedMaDtRef,
  lastWarnedMaDtRef,
  tenDtEditedRef,
  onViewDebt,
  openDebtLedger,
  onOpenPickup,
  handleSelectCustomer,
  handleSelectXe,
  fetchKhachHangOptionsLocal,
  fetchXeOptionsLocal,
  focusHeaderControl,
  handleHeaderArrowNav,
}) => {
  const readonlyField =
    "erp-input w-full font-mono text-neutral-800 bg-neutral-100 border-neutral-200 cursor-text select-text";
  const disabledLookupField =
    "erp-input w-full text-xs py-0.5 bg-neutral-100 text-neutral-700 border-neutral-200 cursor-text select-text";

  return (
    <section
      className="bg-neutral-50/90 border-b border-neutral-200 px-3 py-1.5 shrink-0"
      data-purpose="master-form"
    >
      <div className="flex flex-col xl:flex-row items-start gap-2.5 max-w-[1920px] mx-auto">
        {/* Left & Center: Transaction & Customer */}
        <div className="w-full xl:flex-1 min-w-0 grid grid-cols-12 gap-x-2 gap-y-1.5">
          {/* Row 1: Dates, Voucher No & Credit Guard */}
          <div className="col-span-12 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <label className="erp-label w-[72px] shrink-0 inline-block text-neutral-700 font-bold">
                Ngày:
              </label>
              <div className="w-40 shrink-0">
                {isEditable ? (
                  <input
                    ref={ngayCtInputRef}
                    type="date"
                    className={`erp-input w-full text-xs py-0.5 font-mono font-semibold ${
                      invalidField === "ngayCt" ? "erp-input-danger" : ""
                    }`}
                    value={ngayCt}
                    onChange={(e) => {
                      setNgayCt(e.target.value);
                      if (invalidField === "ngayCt") setInvalidField(null);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.ctrlKey &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.altKey
                      ) {
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
                    className={readonlyField + " text-xs py-0.5"}
                    value={formatDate(ngayCt)}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                )}
              </div>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setSoCt(val);
                    const clean = val.trim().toUpperCase();
                    userEditedSoCtRef.current =
                      Boolean(clean) && clean !== autoSuggestedSoCtRef.current;
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.altKey
                    ) {
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

            {/* Khu vực + Giới hạn nợ + Dư nợ (hiển thị dạng label thông thường cạnh Số phiếu) */}
            <div className="flex items-center gap-1.5 ml-2">
              <label className="erp-label text-neutral-600 font-semibold">
                Khu vực:
              </label>
              <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md text-xs">
                {maVm || "—"}
              </span>
            </div>

            {!isWarehouse && (
              <>
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
                    {onViewDebt ? (
                      <button
                        type="button"
                        onClick={openDebtLedger}
                        className={`inline-flex items-center gap-1 text-xs cursor-pointer hover:underline ${
                          debtInfo.is_over_limit
                            ? "text-danger-700 font-bold"
                            : debtInfo.is_near_limit
                              ? "text-amber-700 font-semibold"
                              : "text-neutral-700 font-medium"
                        }`}
                        title="Mở sổ chi tiết công nợ [Ctrl+Shift+E]"
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
                    ) : (
                      <div
                        className={`inline-flex items-center gap-1 text-xs ${
                          debtInfo.is_over_limit
                            ? "text-danger-700 font-bold"
                            : debtInfo.is_near_limit
                              ? "text-amber-700 font-semibold"
                              : "text-neutral-700 font-medium"
                        }`}
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
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Row 2: Đối tượng (Mã + Tên), Địa chỉ (readonly) cân đối cùng 1 dòng */}
          <div className="col-span-12 flex items-center gap-2 min-w-0">
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
                    committedMaDtRef.current = "";
                    lastWarnedMaDtRef.current = "";
                    setMaDt(val);
                    if (maDtError) setMaDtError(null);
                    if (invalidField === "maDt") setInvalidField(null);
                  }}
                  onSelect={(opt) => {
                    maDtValueRef.current = opt.value;
                    lastWarnedMaDtRef.current = "";
                    if (invalidField === "maDt") setInvalidField(null);
                    handleSelectCustomer(opt.value);
                    tenDtInputRef.current?.focus();
                    tenDtInputRef.current?.select();
                  }}
                  onBlur={() => {
                    const v = maDtValueRef.current.trim();
                    const upper = v.toUpperCase();
                    if (
                      v &&
                      upper !== committedMaDtRef.current &&
                      upper !== lastWarnedMaDtRef.current
                    ) {
                      handleSelectCustomer(v);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.altKey
                    ) {
                      e.preventDefault();
                      const v = maDtValueRef.current.trim();
                      lastWarnedMaDtRef.current = "";
                      if (v) {
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
                    maDtError || isOverDebtLimit || invalidField === "maDt"
                      ? "erp-input-danger"
                      : "text-primary-800"
                  }`}
                />
              </div>
            ) : (
              <div className="w-40 shrink-0">
                <input
                  className={`${disabledLookupField} font-mono font-bold ${
                    isOverDebtLimit ? "erp-input-danger" : ""
                  }`}
                  value={maDt}
                  onFocus={(e) => e.currentTarget.select()}
                  title={isOverDebtLimit ? debtInfo?.status_message : maDt}
                  readOnly
                />
              </div>
            )}
            <div className="flex-1 min-w-[200px] max-w-[384px]">
              {isEditable ? (
                <input
                  ref={tenDtInputRef}
                  className={`erp-input w-full font-semibold text-neutral-800 text-xs py-0.5 bg-white border-neutral-300 ${
                    isOverDebtLimit ? "erp-input-danger" : ""
                  }`}
                  value={tenDt || ""}
                  onChange={(e) => {
                    tenDtEditedRef.current = true;
                    setTenDt(e.target.value);
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.altKey
                    ) {
                      e.preventDefault();
                      dienGiaiInputRef.current?.focus();
                      dienGiaiInputRef.current?.select();
                      return;
                    }
                    handleHeaderArrowNav(e, 3);
                  }}
                  title={
                    isOverDebtLimit ? debtInfo?.status_message : tenDt || ""
                  }
                  placeholder="Tên khách hàng"
                />
              ) : (
                <input
                  className={`${disabledLookupField} font-semibold text-neutral-800 ${
                    isOverDebtLimit ? "erp-input-danger" : ""
                  }`}
                  value={tenDt || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={
                    isOverDebtLimit ? debtInfo?.status_message : tenDt || ""
                  }
                  placeholder="Tên khách hàng"
                />
              )}
            </div>

            <label className="erp-label shrink-0 ml-1">Địa chỉ:</label>
            <div className="flex-1 min-w-[140px]">
              <input
                maxLength={64}
                className={disabledLookupField}
                value={diaChi || ""}
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                title={diaChi || ""}
              />
            </div>
          </div>

          {/* Row 3: Ông/Bà (readonly) và Bộ phận (readonly) cùng 1 dòng ngay dưới Đối tượng */}
          <div className="col-span-12 flex items-center gap-2 min-w-0">
            <label className="erp-label w-[72px] shrink-0 inline-block">
              Ông/Bà:
            </label>
            <div className="flex-1 min-w-[180px] max-w-[350px]">
              <input
                maxLength={64}
                className={disabledLookupField + " font-medium"}
                value={ongBa || ""}
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                title={ongBa || ""}
              />
            </div>

            <div className="flex items-center gap-2 ml-1 w-36 shrink-0">
              <label className="erp-label shrink-0 text-neutral-500">
                Bộ phận:
              </label>
              <div className="flex-1 min-w-0">
                <input
                  className={
                    disabledLookupField +
                    " font-mono font-semibold text-center"
                  }
                  value={maBp || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                />
              </div>
            </div>
            <div className="flex-1 min-w-[160px] max-w-[384px]">
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
          <div className="col-span-12 flex items-center gap-2 min-w-0">
            <label className="erp-label w-[72px] shrink-0 inline-block">
              Diễn giải:
            </label>
            <div className="flex-1 min-w-[180px] max-w-[350px]">
              <input
                ref={dienGiaiInputRef}
                maxLength={128}
                className={`erp-input w-full font-medium text-neutral-800 text-xs py-0.5 ${
                  isEditable
                    ? "bg-white border-neutral-300"
                    : "bg-neutral-100 cursor-text select-text"
                }`}
                value={dienGiai0 || ""}
                onChange={(e) => setDienGiai0(clampField(e.target.value, 128))}
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
                  if (
                    isEditable &&
                    (e.ctrlKey || e.metaKey) &&
                    !e.shiftKey &&
                    !e.altKey &&
                    (e.key.toLowerCase() === "d" || e.code === "KeyD")
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = e.currentTarget;
                    const source =
                      input.value || dienGiai0 || fallbackDienGiai || "";
                    const nextVal = source.slice(0, 10);
                    setDienGiai0(nextVal);
                    setTimeout(() => {
                      if (document.activeElement === input) {
                        input.setSelectionRange(
                          nextVal.length,
                          nextVal.length,
                        );
                      }
                    }, 0);
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
                    maXeInputRef.current?.focus();
                    maXeInputRef.current?.select();
                    return;
                  }
                  handleHeaderArrowNav(e, 4);
                }}
                title={
                  isEditable
                    ? "Diễn giải (Ctrl+D: cắt giữ 10 ký tự đầu)"
                    : undefined
                }
                readOnly={!isEditable}
              />
            </div>

            <div className="flex items-center gap-2 ml-1 w-36 shrink-0">
              <label className="erp-label shrink-0">Xe:</label>
              {isEditable ? (
                <div className="flex-1 min-w-0">
                  <Autocomplete
                    inputRef={maXeInputRef}
                    selectOnFocus
                    value={maXe || ""}
                    onChange={(val) => setMaXe(val)}
                    onSelect={(opt) => handleSelectXe(opt.value, opt.hint)}
                    onBlur={() => handleSelectXe(maXe)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.ctrlKey &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.altKey
                      ) {
                        e.preventDefault();
                        if (maXe.trim()) {
                          handleSelectXe(maXe);
                        }
                        if (!isWarehouse && pickupBtnRef.current) {
                          pickupBtnRef.current.focus();
                        } else if (firstMaVtRef.current) {
                          firstMaVtRef.current.focus();
                          firstMaVtRef.current.select();
                        }
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
                <div className="flex-1 min-w-0">
                  <input
                    className={disabledLookupField + " font-mono text-center"}
                    value={maXe || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    readOnly
                  />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-[220px] max-w-[420px] flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  className={disabledLookupField}
                  value={tenXe || ""}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={tenXe || ""}
                />
              </div>

              {!isWarehouse && isEditable && onOpenPickup && (
                <button
                  ref={pickupBtnRef}
                  type="button"
                  onClick={() => onOpenPickup(maDt, ngayCt)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.altKey
                    ) {
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
                  title={
                    isReturn
                      ? "Chọn phiếu nhập lại từ kho"
                      : "Chọn phiếu xuất từ kho"
                  }
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-secondary-600" />
                  {isReturn ? "Chọn phiếu nhập lại" : "Chọn phiếu xuất"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Accounting Posting Parameters (chỉ hiển thị ở chế độ bán hàng) */}
        {!isWarehouse && (
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
                  {isReturn ? "TK Có:" : "TK Nợ:"}
                </label>
                <input
                  className="erp-input !w-16 shrink-0 text-center font-mono font-bold text-xs py-0.5 bg-neutral-100 border-neutral-200 text-primary-900 cursor-text select-text"
                  value={tk2}
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  title={`Tài khoản ${isReturn ? "Có" : "Nợ"} cố định (${tk2})`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
