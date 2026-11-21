import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import {
  BaoCoImportPreviewResponse,
  BaoCoImportRowPreview,
} from "../../types/cashVoucher";
import { initCatalogCache, searchTaiKhoan } from "../../lib/catalogCache";
import { formatCurrency, formatDate } from "../../lib/format";
import { useModalLock } from "../../lib/modalLock";
import { Autocomplete, AutocompleteOption } from "../ui/Autocomplete";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useExcelGridNav } from "../ui/useExcelGridNav";

interface BaoCoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (createdCount: number, message: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc file từ máy."));
    reader.readAsDataURL(file);
  });
}

export const BaoCoImportModal: React.FC<BaoCoImportModalProps> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [tkNo, setTkNo] = useState("11212");
  const [tkCo, setTkCo] = useState("1311");
  const [userName, setUserName] = useState("KTTH");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BaoCoImportPreviewResponse | null>(null);
  const [activeRow, setActiveRow] = useState<number>(0);
  const { handleCellKeyDown, handleCellCopy } = useExcelGridNav();

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPreview(null);
    setFileName("");
    setActiveRow(0);
  }, [isOpen]);

  const fetchTkOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    await initCatalogCache();
    return searchTaiKhoan(q);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch("/api/cash-vouchers/import-baoco/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_base64: b64 }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setPreview(null);
        setError(body?.detail?.message || body?.message || "Không đọc được file Excel.");
        return;
      }
      setPreview(body.data as BaoCoImportPreviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đọc file.");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const validRows = preview.rows.filter((r) => r.valid);
    if (!validRows.length) {
      setError("Không có dòng hợp lệ nào để import.");
      return;
    }
    setError(null);
    setCommitting(true);
    try {
      const res = await fetch("/api/cash-vouchers/import-baoco/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ma_dvcs: "S1",
          ma_ct: "C3",
          tk_no: tkNo.trim() || "11212",
          tk_co: tkCo.trim() || "1311",
          user_name: userName,
          rows: validRows.map((r: BaoCoImportRowPreview) => ({
            noi_dung: r.noi_dung,
            so_tien: r.so_tien,
            ngay_ct: r.ngay_ct,
            ma_dt: r.ma_dt,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(
          body?.detail?.message || body?.message || "Lỗi khi ghi dữ liệu import.",
        );
        return;
      }
      onImported(body.data.created_count, body.data.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối máy chủ.");
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  const validTotal =
    preview?.rows
      .filter((r) => r.valid)
      .reduce((s, r) => s + (r.so_tien || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 md:p-4 bg-neutral-900/50 backdrop-blur-[2px]">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import Báo Có từ Excel"
        className="w-full h-[100dvh] md:h-auto max-w-4xl md:max-h-[88vh] bg-white rounded-none md:rounded-lg shadow-2xl border-0 md:border border-neutral-300 flex flex-col overflow-hidden pt-safe md:pt-0"
      >
        {/* Header */}
        <header className="bg-sky-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-sky-300 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide truncate">
              Import Giấy Báo Có (C3) từ Excel · CtT / CtT0
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sky-200 hover:text-white p-1.5 rounded hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Controls */}
        <div className="p-3 bg-neutral-50 border-b border-neutral-200 space-y-2.5 text-xs shrink-0">
          <div className="text-[11px] text-neutral-600 bg-sky-50 border border-sky-200 rounded px-2.5 py-1.5">
            Định dạng 6 cột chuẩn như tool Python cũ:{" "}
            <b className="font-mono text-sky-900">
              1. Tên TK | 2. Số TK | 3. Nội dung | 4. Số tiền | 5. Ngày | 6. Mã KH
            </b>{" "}
            (hỗ trợ file <b>.xlsx / .xlsm / .csv</b>, ghi toàn bộ trong 1 Transaction ACID + tự tăng Số CT theo tháng + gọi <code>CtT_Post</code>).
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing || committing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-800 text-white font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            >
              {parsing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{fileName ? `Chọn lại (${fileName})` : "Chọn file Excel..."}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <label className="erp-label">TK Nợ (NH):</label>
              <div className="w-24">
                <Autocomplete
                  value={tkNo}
                  fetcher={fetchTkOptions}
                  openOnTypeOnly
                  dropdownMinWidth={320}
                  onChange={setTkNo}
                  onSelect={(opt) => setTkNo(opt.value)}
                  className="erp-input w-full font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="erp-label">TK Có (Công nợ):</label>
              <div className="w-24">
                <Autocomplete
                  value={tkCo}
                  fetcher={fetchTkOptions}
                  openOnTypeOnly
                  dropdownMinWidth={320}
                  onChange={setTkCo}
                  onSelect={(opt) => setTkCo(opt.value)}
                  className="erp-input w-full font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="erp-label">User:</label>
              <select
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="erp-input bg-white font-mono"
              >
                <option value="KTTH">KTTH</option>
                <option value="KTCN3">KTCN3</option>
                <option value="KTCN">KTCN</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-3 py-1.5 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-danger-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Preview Table */}
        <div className="flex-1 min-h-[200px] overflow-auto bg-white">
          {!preview ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 text-xs py-12 gap-2">
              <FileSpreadsheet className="w-8 h-8 text-neutral-300" />
              <span>Chọn file Excel báo có để xem trước dữ liệu trước khi ghi sổ.</span>
            </div>
          ) : (
            <table className="w-full border-collapse xl-grid table-sticky-header mobile-table-sticky text-xs">
              <thead>
                <tr>
                  <th className="vfp-header w-12 text-center">Dòng</th>
                  <th className="vfp-header w-24">Ngày</th>
                  <th className="vfp-header w-24">Mã KH</th>
                  <th className="vfp-header min-w-[160px]">Tên khách hàng (DmDt)</th>
                  <th className="vfp-header min-w-[220px]">Nội dung</th>
                  <th className="vfp-header w-32 text-right">Số tiền</th>
                  <th className="vfp-header w-36 text-center">Kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, idx) => (
                  <tr
                    key={r.row_index}
                    onClick={() => setActiveRow(idx)}
                    className={
                      idx === activeRow
                        ? "xl-row-active"
                        : r.valid
                          ? ""
                          : "bg-danger-50/70"
                    }
                  >
                    <td className="xl-rowhead font-mono">
                      {r.row_index}
                    </td>
                    <td className="xl-cell">
                      <ReadOnlyGridInput
                        value={r.ngay_ct ? formatDate(r.ngay_ct) : "—"}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                      />
                    </td>
                    <td className="xl-cell">
                      <ReadOnlyGridInput
                        value={r.ma_dt || "—"}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className="xl-input font-mono font-bold text-primary-800 grid-cell-input"
                      />
                    </td>
                    <td className="xl-cell max-w-[200px]">
                      <ReadOnlyGridInput
                        value={r.ten_dt || ""}
                        title={r.ten_dt}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className="xl-input text-neutral-900 truncate grid-cell-input"
                      />
                    </td>
                    <td className="xl-cell max-w-[260px]">
                      <ReadOnlyGridInput
                        value={r.noi_dung || ""}
                        title={r.noi_dung}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className="xl-input text-neutral-800 truncate grid-cell-input"
                      />
                    </td>
                    <td className="xl-cell">
                      <ReadOnlyGridInput
                        value={formatCurrency(r.so_tien, "VND")}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className="xl-input text-right font-mono font-bold text-neutral-900 grid-cell-input"
                      />
                    </td>
                    <td className="xl-cell">
                      <ReadOnlyGridInput
                        value={r.valid ? "Hợp lệ" : r.error || "Lỗi"}
                        title={r.error || ""}
                        rowIndex={idx}
                        onSelectRow={setActiveRow}
                        onKeyDown={(e) => handleCellKeyDown(e, idx)}
                        onCopy={handleCellCopy}
                        className={`xl-input text-center font-semibold grid-cell-input ${
                          r.valid ? "text-emerald-700" : "text-danger-700"
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <footer className="px-4 py-2.5 pb-safe bg-neutral-100 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-neutral-700">
            {preview && (
              <>
                <span>
                  Hợp lệ:{" "}
                  <b className="font-mono text-emerald-700">{preview.valid_rows}</b>/
                  <b className="font-mono">{preview.total_rows}</b> dòng
                </span>
                {preview.invalid_rows > 0 && (
                  <span className="text-danger-700 font-semibold">
                    ({preview.invalid_rows} dòng lỗi sẽ bỏ qua)
                  </span>
                )}
                <span>·</span>
                <span>
                  Tổng tiền:{" "}
                  <b className="font-mono text-primary-900">
                    {formatCurrency(validTotal, "VND")} ₫
                  </b>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 md:py-1.5 rounded bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={!preview || preview.valid_rows === 0 || committing}
              onClick={() => void handleCommit()}
              className="px-4 py-2 md:py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-sm disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {committing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Import {preview?.valid_rows || 0} chứng từ
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
