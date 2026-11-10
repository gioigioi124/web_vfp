import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { initCustomerIndex } from "./lib/customerIndex";
import { initProductIndex } from "./lib/productIndex";
import { initCatalogCache } from "./lib/catalogCache";
import "./index.css";

// Nạp danh mục (Khách hàng, Hàng hóa, Kho/Xe/Bộ phận/Tài khoản) theo cơ chế
// Lazy / Idle sau khi màn hình danh sách chứng từ đã render xong để không
// tranh chấp băng thông với API tải danh sách phiếu lúc mới mở trình duyệt.
const scheduleIdlePreload = () => {
  const preload = () => {
    void initCatalogCache();
    void initCustomerIndex();
    void initProductIndex();
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (
      window as Window & {
        requestIdleCallback: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback(() => setTimeout(preload, 800), { timeout: 2500 });
  } else {
    setTimeout(preload, 1200);
  }
};
scheduleIdlePreload();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route nghiệp vụ (plan §1.4): danh sách + chi tiết/sửa phiếu */}
        <Route path="/sales-invoices" element={<App />} />
        <Route path="/sales-invoices/:stt" element={<App />} />
        <Route path="*" element={<Navigate to="/sales-invoices" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
