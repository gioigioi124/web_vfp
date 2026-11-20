import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  PriceListDeleteItemsPreviewResponse,
  PriceListHeader,
  PriceListImportNewPreviewResponse,
  PriceListImportUpdatePreviewResponse,
} from "../../types/priceList";
import { formatCurrency, formatDate } from "../../lib/format";
import { useModalLock } from "../../lib/modalLock";
import { ReadOnlyGridInput } from "../detail-grid/ReadOnlyGridCell";
import { useVirtualExcelGrid } from "../ui/useVirtualExcelGrid";

export type PriceListExcelModalMode = "import-new" | "import-update" | "delete-items";

interface PriceListExcelModalProps {
  isOpen: boolean;
  mode: PriceListExcelModalMode;
  selectedHeaders: PriceListHeader[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc file từ máy."));
    reader.readAsDataURL(file);
  });
}

const MODE_META: Record<
  PriceListExcelModalMode,
  {
    title: string;
    subtitle: string;
    columnsGuide: string;
    accentBg: string;
    buttonBg: string;
  }
> = {
  "import-new": {
    title: "Import Tạo Bảng Giá Mới từ Excel",
    subtitle:
      "Tự động gom nhóm header BG theo (Ngày CT, Số CT, Mã ĐT, Mã Vùng). Nếu có Mã ĐT sẽ ưu tiên bỏ qua Mã Vùng.",
    columnsGuide:
      "File 7 cột (bỏ dòng tiêu đề nếu có): Cột A: Ngày CT | B: Số CT | C: Mã ĐT | D: Mã Vùng | E: Mã VT | F: Giá | G: % CK.",
    accentBg: "bg-sky-50 border-sky-200 text-sky-900",
    buttonBg: "bg-primary hover:bg-primary/90 text-white",
  },
  "import-update": {
    title: "Cập Nhật / Bổ Sung Giá Vào Bảng Giá Đã Chọn",
    subtitle:
      "Tự động nhận diện file 7 cột (Cột E, F, G) hoặc file rút gọn 3 cột (A: Mã VT, B: Giá, C: % CK). Đã có Mã VT sẽ cập nhật giá, chưa có sẽ thêm mới.",
    columnsGuide:
      "Hỗ trợ 7 cột (lấy E: Mã VT, F: Giá, G: % CK) hoặc 3 cột (A: Mã VT, B: Giá, C: % CK).",
    accentBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  "delete-items": {
    title: "Xóa Hàng Hóa Khỏi Bảng Giá Đã Chọn từ Excel",
    subtitle:
      "Xóa hàng loạt các Mã vật tư có trong file Excel khỏi tất cả bảng giá đang được tích chọn.",
    columnsGuide:
      "Hỗ trợ file 7 cột (lấy Cột E: Mã VT) hoặc file 1 cột (lấy Cột A: Mã VT).",
    accentBg: "bg-rose-50 border-rose-200 text-rose-900",
    buttonBg: "bg-rose-600 hover:bg-rose-700 text-white",
  },
};

export const PriceListExcelModal: React.FC<PriceListExcelModalProps> = ({
  isOpen,
  mode,
  selectedHeaders,
  onClose,
  onSuccess,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newPreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const updatePreviewScrollRef = useRef<HTMLDivElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [userName, setUserName] = useState("ADMIN");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPreview, setNewPreview] = useState<PriceListImportNewPreviewResponse | null>(
    null,
  );
  const [updatePreview, setUpdatePreview] =
    useState<PriceListImportUpdatePreviewResponse | null>(null);
  const [deletePreview, setDeletePreview] =
    useState<PriceListDeleteItemsPreviewResponse | null>(null);
  const [activePreviewRow, setActivePreviewRow] = useState(0);

  const newPreviewGrid = useVirtualExcelGrid({
    totalRows: newPreview?.groups.length ?? 0,
    scrollContainerRef: newPreviewScrollRef,
    onSelectRow: setActivePreviewRow,
  });

  const updatePreviewGrid = useVirtualExcelGrid({
    totalRows: updatePreview?.items.length ?? 0,
    scrollContainerRef: updatePreviewScrollRef,
    onSelectRow: setActivePreviewRow,
  });

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    setFileName("");
    setError(null);
    setNewPreview(null);
    setUpdatePreview(null);
    setDeletePreview(null);
    setActivePreviewRow(0);
    setParsing(false);
    setCommitting(false);
  }, [isOpen, mode]);

  const handleFilePicked = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (mode !== "import-new" && selectedHeaders.length === 0) {
        setError("Vui lòng tích chọn ít nhất 1 bảng giá ở danh sách trước.");
        return;
      }

      setFileName(file.name);
      setError(null);
      setNewPreview(null);
      setUpdatePreview(null);
      setDeletePreview(null);
      setParsing(true);

      try {
        const content_base64 = await fileToBase64(file);
        const stt_list = selectedHeaders.map((h) => h.stt);
        const endpoint =
          mode === "import-new"
            ? "/api/price-lists/import-new/preview"
            : mode === "import-update"
              ? "/api/price-lists/import-update/preview"
              : "/api/price-lists/delete-items/preview";

        const payload =
          mode === "import-new"
            ? { filename: file.name, content_base64 }
            : { filename: file.name, content_base64, stt_list };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.detail || "Không thể đọc nội dung file Excel.");
        }

        if (mode === "import-new") {
          setNewPreview(body.data);
        } else if (mode === "import-update") {
          setUpdatePreview(body.data);
        } else {
          setDeletePreview(body.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi đọc file Excel.");
      } finally {
        setParsing(false);
      }
    },
    [mode, selectedHeaders],
  );

  const handleCommit = async () => {
    setError(null);
    setCommitting(true);
    try {
      const stt_list = selectedHeaders.map((h) => h.stt);
      let endpoint = "";
      let payload: unknown = null;

      if (mode === "import-new") {
        if (!newPreview || newPreview.groups.length === 0) return;
        endpoint = "/api/price-lists/import-new/commit";
        payload = newPreview.preview_token
          ? {
              user_name: userName.trim().toUpperCase() || "ADMIN",
              preview_token: newPreview.preview_token,
            }
          : {
              user_name: userName.trim().toUpperCase() || "ADMIN",
              groups: newPreview.groups,
            };
      } else if (mode === "import-update") {
        if (!updatePreview || updatePreview.items.length === 0) return;
        endpoint = "/api/price-lists/import-update/commit";
        payload = updatePreview.preview_token
          ? {
              stt_list,
              preview_token: updatePreview.preview_token,
            }
          : {
              stt_list,
              items: updatePreview.items.map((it) => ({
                ma_vt: it.ma_vt,
                gia: it.gia,
                ck: it.ck,
              })),
            };
      } else {
        if (!deletePreview || deletePreview.ma_vt_list.length === 0) return;
        endpoint = "/api/price-lists/delete-items/commit";
        payload = {
          stt_list,
          ma_vt_list: deletePreview.ma_vt_list,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.detail || "Không thể thực hiện ghi dữ liệu.");
      }
      onSuccess(body.data?.message || "Thao tác Excel thành công.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu vào SQL.");
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  const meta = MODE_META[mode];
  const canCommit =
    (mode === "import-new" && Boolean(newPreview && newPreview.groups.length > 0)) ||
    (mode === "import-update" &&
      Boolean(updatePreview && updatePreview.items.length > 0)) ||
    (mode === "delete-items" &&
      Boolean(deletePreview && deletePreview.ma_vt_list.length > 0));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-primary">
              {mode === "delete-items" ? (
                <Trash2 className="w-4 h-4 text-rose-600" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">{meta.title}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className={`rounded-lg border px-3.5 py-2.5 text-[11.5px] ${meta.accentBg}`}>
            <p className="font-semibold">Định dạng file hỗ trợ (.xlsx / .xlsm / .csv):</p>
            <p className="mt-0.5 opacity-90">{meta.columnsGuide}</p>
            {mode !== "import-new" && (
              <p className="mt-1 font-medium">
                Phạm vi áp dụng: <span className="font-bold">{selectedHeaders.length}</span>{" "}
                bảng giá đang chọn (
                {selectedHeaders
                  .slice(0, 5)
                  .map((h) => h.so_ct || h.stt)
                  .join(", ")}
                {selectedHeaders.length > 5 ? ", ..." : ""}).
              </p>
            )}
          </div>

          {/* File picker + User */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleFilePicked(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing || committing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {parsing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Upload className="w-4 h-4 text-primary" />
              )}
              <span>{fileName ? `Đổi file (${fileName})` : "Chọn file Excel..."}</span>
            </button>

            {mode === "import-new" && (
              <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
                <span className="font-medium">User lập (UserName):</span>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.toUpperCase())}
                  className="erp-input w-28 h-8 text-[12px] uppercase"
                  placeholder="ADMIN"
                />
              </label>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode 1 Preview: Import New */}
          {mode === "import-new" && newPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[12px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Tổng dòng đọc</div>
                  <div className="font-bold text-slate-900">{newPreview.total_rows}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] text-emerald-700">Số bảng giá (BG)</div>
                  <div className="font-bold text-emerald-900">{newPreview.groups_count}</div>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <div className="text-[11px] text-sky-700">Tổng dòng chi tiết (BG0)</div>
                  <div className="font-bold text-sky-900">{newPreview.details_count}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[11px] text-amber-700">Trùng mã VT (gộp cuối)</div>
                  <div className="font-bold text-amber-900">{newPreview.duplicate_rows}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Bỏ qua lỗi / trống</div>
                  <div className="font-bold text-slate-700">{newPreview.skipped_rows}</div>
                </div>
              </div>

              <div
                ref={newPreviewScrollRef}
                className="border border-slate-200 rounded-lg overflow-auto max-h-[42vh] table-sticky-header"
              >
                <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
                  <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
                    <tr>
                      <th className="w-10 text-center border-r border-neutral-200">#</th>
                      <th className="w-28 text-center border-r border-neutral-200">Ngày CT</th>
                      <th className="w-28 border-r border-neutral-200">Số CT</th>
                      <th className="min-w-[180px] border-r border-neutral-200">Đối tượng (Mã ĐT)</th>
                      <th className="w-28 text-center border-r border-neutral-200">Khu vực (Mã Vùng)</th>
                      <th className="w-24 text-right border-r border-neutral-200">
                        Số mặt hàng
                      </th>
                      <th className="min-w-[220px]">
                        Ví dụ hàng hóa đầu tiên
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-sans">
                    {newPreviewGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={7}
                          style={{ height: newPreviewGrid.topSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                    {newPreview.groups
                      .slice(newPreviewGrid.startIndex, newPreviewGrid.endIndex)
                      .map((grp, sliceIdx) => {
                        const idx = newPreviewGrid.startIndex + sliceIdx;
                        const dtText = grp.ma_dt
                          ? `${grp.ma_dt}${grp.ten_dt ? ` · ${grp.ten_dt}` : ""}`
                          : "—";
                        const sampleText =
                          grp.items
                            .slice(0, 3)
                            .map((i) => `${i.ma_vt} (${formatCurrency(i.gia)})`)
                            .join(", ") + (grp.items.length > 3 ? "..." : "");
                        return (
                          <tr
                            key={`${grp.so_ct}-${grp.ngay_ct}-${idx}`}
                            data-vrow={idx}
                            onClick={() => setActivePreviewRow(idx)}
                            className={idx === activePreviewRow ? "xl-row-active" : undefined}
                          >
                            <td className="xl-rowhead">{idx + 1}</td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={formatDate(grp.ngay_ct)}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input text-center font-mono text-neutral-700 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={grp.so_ct}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input font-mono font-semibold text-primary-700 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell min-w-[180px]">
                              <ReadOnlyGridInput
                                value={dtText}
                                title={dtText}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input text-neutral-900 truncate grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={grp.ma_vm || "—"}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input text-center font-mono text-neutral-800 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={String(grp.items.length)}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input text-right font-mono font-semibold text-neutral-900 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell min-w-[220px]">
                              <ReadOnlyGridInput
                                value={sampleText}
                                title={sampleText}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => newPreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={newPreviewGrid.handleCellCopy}
                                className="xl-input text-neutral-600 truncate grid-cell-input"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {newPreviewGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={7}
                          style={{ height: newPreviewGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {newPreview.truncated_preview && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  Đang xem trước {newPreview.groups.length} / {newPreview.groups_count} bảng giá đầu tiên để giữ giao diện mượt. Toàn bộ {newPreview.details_count} dòng chi tiết đã lưu sẵn sàng trên server để ghi SQL.
                </p>
              )}
            </div>
          )}

          {/* Mode 2 Preview: Import Update */}
          {mode === "import-update" && updatePreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[12px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Số Mã VT duy nhất</div>
                  <div className="font-bold text-slate-900">{updatePreview.unique_items}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] text-emerald-700">Ước tính Cập nhật</div>
                  <div className="font-bold text-emerald-900">
                    {updatePreview.existing_updates_estimate} dòng
                  </div>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <div className="text-[11px] text-sky-700">Ước tính Thêm mới</div>
                  <div className="font-bold text-sky-900">
                    {updatePreview.new_inserts_estimate} dòng
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[11px] text-amber-700">Trùng / Bỏ qua</div>
                  <div className="font-bold text-amber-900">
                    {updatePreview.duplicate_rows} / {updatePreview.skipped_rows}
                  </div>
                </div>
              </div>

              <div
                ref={updatePreviewScrollRef}
                className="border border-slate-200 rounded-lg overflow-auto max-h-[42vh] table-sticky-header"
              >
                <table className="w-full text-left dense-table border-collapse text-[12px] xl-grid">
                  <thead className="sticky top-0 z-10 bg-neutral-100 [&_th]:bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
                    <tr>
                      <th className="w-10 text-center border-r border-neutral-200">#</th>
                      <th className="w-36 border-r border-neutral-200 font-mono">Mã VT</th>
                      <th className="min-w-[220px] border-r border-neutral-200">Tên hàng hóa</th>
                      <th className="w-20 text-center border-r border-neutral-200">ĐVT</th>
                      <th className="w-32 text-right border-r border-neutral-200 font-mono">
                        Giá mới
                      </th>
                      <th className="w-24 text-right font-mono">
                        % CK mới
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-sans">
                    {updatePreviewGrid.topSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={6}
                          style={{ height: updatePreviewGrid.topSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                    {updatePreview.items
                      .slice(updatePreviewGrid.startIndex, updatePreviewGrid.endIndex)
                      .map((it, sliceIdx) => {
                        const idx = updatePreviewGrid.startIndex + sliceIdx;
                        return (
                          <tr
                            key={it.ma_vt}
                            data-vrow={idx}
                            onClick={() => setActivePreviewRow(idx)}
                            className={idx === activePreviewRow ? "xl-row-active" : undefined}
                          >
                            <td className="xl-rowhead">{idx + 1}</td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={it.ma_vt}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => updatePreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={updatePreviewGrid.handleCellCopy}
                                className="xl-input font-mono font-semibold text-primary-800 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell min-w-[220px]">
                              <ReadOnlyGridInput
                                value={it.ten_vt || "—"}
                                title={it.ten_vt || ""}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => updatePreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={updatePreviewGrid.handleCellCopy}
                                className="xl-input text-neutral-800 truncate grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={it.dvt || ""}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => updatePreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={updatePreviewGrid.handleCellCopy}
                                className="xl-input text-center text-neutral-600 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={formatCurrency(it.gia)}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => updatePreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={updatePreviewGrid.handleCellCopy}
                                className="xl-input text-right font-mono font-semibold text-emerald-700 grid-cell-input"
                              />
                            </td>
                            <td className="xl-cell">
                              <ReadOnlyGridInput
                                value={`${it.ck}%`}
                                rowIndex={idx}
                                onSelectRow={setActivePreviewRow}
                                onKeyDown={(e) => updatePreviewGrid.handleCellKeyDown(e, idx)}
                                onCopy={updatePreviewGrid.handleCellCopy}
                                className="xl-input text-right font-mono text-neutral-700 grid-cell-input"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {updatePreviewGrid.bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={6}
                          style={{ height: updatePreviewGrid.bottomSpacerHeight, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {updatePreview.truncated_preview && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  Đang xem trước {updatePreview.items.length} / {updatePreview.unique_items} mã hàng đầu tiên. Toàn bộ {updatePreview.unique_items} mã hàng đã sẵn sàng trên server để cập nhật vào SQL.
                </p>
              )}
            </div>
          )}

          {/* Mode 3 Preview: Delete Items */}
          {mode === "delete-items" && deletePreview && (
            <div className="space-y-3">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-900">
                <p className="font-bold">
                  Tìm thấy {deletePreview.ma_vt_count} Mã vật tư trong file Excel.
                </p>
                <p className="mt-1">
                  Dự kiến xóa khoảng{" "}
                  <span className="font-bold underline">
                    {deletePreview.affected_rows_estimate}
                  </span>{" "}
                  dòng chi tiết (BG0) trên {selectedHeaders.length} bảng giá đã chọn.
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 max-h-[36vh] overflow-y-auto flex flex-wrap gap-1.5">
                {deletePreview.ma_vt_list.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-semibold text-slate-800"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!canCommit || committing || parsing}
            onClick={() => void handleCommit()}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-50 ${meta.buttonBg}`}
          >
            {committing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>
              {committing
                ? "Đang xử lý SQL..."
                : mode === "delete-items"
                  ? "Xác nhận XÓA khỏi SQL"
                  : "Xác nhận Ghi vào SQL"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
