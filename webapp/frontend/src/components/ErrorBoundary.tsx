import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "Đã xảy ra lỗi giao diện không mong muốn.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface p-6">
        <div className="max-w-md w-full bg-white border border-danger-200 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-danger-600 text-white px-4 py-2.5 flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Ứng dụng gặp sự cố hiển thị</span>
          </div>
          <div className="p-4 space-y-3 text-xs text-neutral-700">
            <p>
              Một lỗi không mong muốn đã xảy ra trong trình duyệt. Dữ liệu chứng từ
              đã lưu trên máy chủ vẫn an toàn và bản nháp đang nhập (nếu có) được giữ
              lại trên trình duyệt.
            </p>
            <div className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-2 font-mono text-[11px] text-danger-700 break-words">
              {this.state.message}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: "" })}
                className="px-3 py-1.5 border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 rounded text-xs font-semibold cursor-pointer"
              >
                Thử khôi phục
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
