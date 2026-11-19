import React from "react";
import { handleExcelMouseDown, selectAllLater } from "../ui/excelCell";

export interface ReadOnlyGridInputProps {
  value: string;
  rowIndex: number;
  className: string;
  placeholder?: string;
  title?: string;
  /** True for read-only columns inside an editable form row (`tabIndex=-1`, `data-readonly="true"`). */
  isFormReadOnlyColumn?: boolean;
  onSelectRow: (idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export const ReadOnlyGridInput: React.FC<ReadOnlyGridInputProps> = ({
  value,
  rowIndex,
  className,
  placeholder,
  title,
  isFormReadOnlyColumn = false,
  onSelectRow,
  onKeyDown,
  onCopy,
}) => (
  <input
    type="text"
    readOnly
    tabIndex={isFormReadOnlyColumn ? -1 : undefined}
    data-readonly={isFormReadOnlyColumn ? "true" : undefined}
    data-mode={isFormReadOnlyColumn ? undefined : "select"}
    value={value}
    placeholder={placeholder}
    title={title}
    onMouseDown={(e) => handleExcelMouseDown(e, "select")}
    onFocus={(e) => {
      onSelectRow(rowIndex);
      e.currentTarget.select();
      selectAllLater(e.currentTarget);
    }}
    onKeyDown={onKeyDown}
    onCopy={onCopy}
    className={className}
  />
);
