import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export async function extractApiError(
  res: Response,
  fallback = `HTTP ${res.status}`,
): Promise<{ message: string; isSqlUnavailable: boolean }> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  const code =
    typeof detail === "object" && detail !== null ? detail.code : undefined;
  const msg =
    typeof detail === "string"
      ? detail
      : typeof detail === "object" && detail !== null && detail.message
        ? String(detail.message)
        : fallback;

  return {
    message: msg,
    isSqlUnavailable: res.status === 503 || code === "SQL_UNAVAILABLE",
  };
}

interface SqlErrorStateProps {
  message: string;
  isSqlUnavailable?: boolean;
  onRetry?: () => void;
}

export const SqlErrorState: React.FC<SqlErrorStateProps> = ({
  message,
  isSqlUnavailable = true,
  onRetry,
}) => {
  return (
    <div className="mx-3 my-3 p-4 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-900 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="text-[12.5px]">
          <div className="font-semibold">
            {isSqlUnavailable
              ? "Chưa kết nối được SQL Server (VP_2014 / VTSYS)"
              : "Lỗi tải dữ liệu"}
          </div>
          <div className="text-rose-800 mt-0.5">{message}</div>
          {isSqlUnavailable && (
            <div className="text-[11px] text-rose-700 mt-1">
              Ứng dụng đang chạy ở chế độ dữ liệu SQL thật (đã tắt dữ liệu mẫu).
              Hãy kiểm tra cấu hình{" "}
              <code className="px-1 py-0.5 rounded bg-rose-100 font-mono">
                backend/.env
              </code>{" "}
              hoặc kết nối mạng tới máy chủ SQL.
            </div>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-medium shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Thử lại
        </button>
      )}
    </div>
  );
};
