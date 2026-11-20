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

  useModalLock(isOpen, containerRef);

  useEffect(() => {
    if (!isOpen) return;
    setFileName("");
    setError(null);
    setNewPreview(null);
    setUpdatePreview(null);
    setDeletePreview(null);
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
        payload = {
          user_name: userName.trim().toUpperCase() || "ADMIN",
          groups: newPreview.groups,
        };
      } else if (mode === "import-update") {
        if (!updatePreview || updatePreview.items.length === 0) return;
        endpoint = "/api/price-lists/import-update/commit";
        payload = {
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

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[42vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 border-b border-slate-200">Ngày CT</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">Số CT</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">Đối tượng (Mã ĐT)</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">Khu vực (Mã Vùng)</th>
                      <th className="px-2.5 py-2 border-b border-slate-200 text-right">
                        Số mặt hàng
                      </th>
                      <th className="px-2.5 py-2 border-b border-slate-200">
                        Ví dụ hàng hóa đầu tiên
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newPreview.groups.map((grp, idx) => (
                      <tr key={`${grp.so_ct}-${grp.ngay_ct}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 font-mono text-[11px]">
                          {formatDate(grp.ngay_ct)}
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold text-primary">
                          {grp.so_ct}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {grp.ma_dt ? (
                            <span className="font-mono font-semibold text-slate-800">
                              {grp.ma_dt}
                              {grp.ten_dt ? (
                                <span className="font-sans font-normal text-slate-500 ml-1">
                                  · {grp.ten_dt}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono">
                          {grp.ma_vm || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {grp.items.length}
                        </td>
                        <td className="px-2.5 py-1.5 text-[11px] text-slate-600 truncate max-w-[260px]">
                          {grp.items
                            .slice(0, 3)
                            .map((i) => `${i.ma_vt} (${formatCurrency(i.gia)})`)
                            .join(", ")}
                          {grp.items.length > 3 ? "..." : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[42vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 border-b border-slate-200 w-10">#</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">Mã VT</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">Tên hàng hóa</th>
                      <th className="px-2.5 py-2 border-b border-slate-200">ĐVT</th>
                      <th className="px-2.5 py-2 border-b border-slate-200 text-right">
                        Giá mới
                      </th>
                      <th className="px-2.5 py-2 border-b border-slate-200 text-right">
                        % CK mới
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {updatePreview.items.slice(0, 300).map((it, idx) => (
                      <tr key={it.ma_vt} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="px-2.5 py-1.5 font-mono font-semibold text-slate-900">
                          {it.ma_vt}
                        </td>
                        <td className="px-2.5 py-1.5 text-slate-700">{it.ten_vt || "—"}</td>
                        <td className="px-2.5 py-1.5 text-slate-500">{it.dvt || ""}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(it.gia)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                          {it.ck}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {updatePreview.items.length > 300 && (
                  <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200">
                    Đang hiển thị 300 / {updatePreview.items.length} mặt hàng...
                  </div>
                )}
              </div>
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
