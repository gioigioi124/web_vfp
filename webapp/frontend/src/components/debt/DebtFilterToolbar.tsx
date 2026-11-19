import React from "react";
import { Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";

export interface DebtFilterToolbarProps {
  fromDate: string;
  toDate: string;
  inputMaDt: string;
  tenDt: string;
  loading: boolean;
  errorMsg: string | null;
  maDtInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFromDateChange: (val: string) => void;
  onToDateChange: (val: string) => void;
  onMaDtChange: (val: string) => void;
  onSelectCustomer: (code: string, hintName?: string) => void;
  onMaDtEnter: () => void;
  onSearch: () => void;
  fetchCustomers: (query: string) => Promise<AutocompleteOption[]>;
}

export const DebtFilterToolbar: React.FC<DebtFilterToolbarProps> = ({
  fromDate,
  toDate,
  inputMaDt,
  tenDt,
  loading,
  errorMsg,
  maDtInputRef,
  onFromDateChange,
  onToDateChange,
  onMaDtChange,
  onSelectCustomer,
  onMaDtEnter,
  onSearch,
  fetchCustomers,
}) => (
  <section
    className="bg-neutral-50 border-b border-neutral-300 px-3 py-1.5 text-xs shrink-0"
    data-purpose="query-filter-bar"
  >
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="erp-label" htmlFor="debt-ledger-from-date">
          Từ ngày:
        </label>
        <input
          id="debt-ledger-from-date"
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
          className="erp-input h-7 w-32 font-mono text-neutral-800 bg-white"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label className="erp-label" htmlFor="debt-ledger-to-date">
          Đến ngày:
        </label>
        <input
          id="debt-ledger-to-date"
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
          className="erp-input h-7 w-32 font-mono text-neutral-800 bg-white"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
        <label className="erp-label">Mã ĐT:</label>
        <div className="flex items-center">
          <div className="w-28">
            <Autocomplete
              inputRef={maDtInputRef}
              data-autofocus
              value={inputMaDt}
              onChange={onMaDtChange}
              onSelect={(opt) => onSelectCustomer(opt.value, opt.hint)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.ctrlKey &&
                  !e.shiftKey &&
                  !e.metaKey &&
                  !e.altKey
                ) {
                  e.preventDefault();
                  onMaDtEnter();
                }
              }}
              fetcher={fetchCustomers}
              openOnTypeOnly
              hideIcon
              debounceMs={30}
              maxResults={30}
              dropdownMinWidth={560}
              placeholder="Mã KH..."
              className="h-7 uppercase font-bold text-xs border-neutral-300 rounded-r-none text-primary-800"
            />
          </div>
          <button
            className="h-7 px-2 bg-neutral-200 hover:bg-neutral-300 border-y border-r border-neutral-300 text-neutral-600 rounded-r flex items-center justify-center cursor-pointer"
            title="Tìm đối tượng [F4]"
            type="button"
            onClick={() => {
              maDtInputRef.current?.focus();
              maDtInputRef.current?.select();
            }}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        <input
          className="erp-input h-7 flex-1 min-w-[160px] bg-neutral-100 text-neutral-700 font-medium truncate cursor-default"
          readOnly
          type="text"
          value={tenDt}
          placeholder="Tên đối tượng..."
          title={tenDt}
          tabIndex={-1}
        />
      </div>

      <Button
        variant="primary"
        size="sm"
        className="h-7 px-3 shrink-0"
        disabled={loading}
        onClick={onSearch}
        type="button"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Tìm kiếm</span>
      </Button>
    </div>

    {errorMsg && (
      <div className="mt-1.5 px-2.5 py-1 bg-danger-50 border border-danger-200 text-danger-700 rounded text-xs">
        {errorMsg}
      </div>
    )}
  </section>
);
