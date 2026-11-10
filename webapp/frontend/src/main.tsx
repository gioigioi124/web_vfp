import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { initCustomerIndex } from "./lib/customerIndex";
import { initProductIndex } from "./lib/productIndex";
import { initCatalogCache } from "./lib/catalogCache";
import "./index.css";

// Nạp sẵn danh mục vào RAM NGAY khi app khởi động (không chờ tới lúc mở form):
// - Khách hàng (5.199 dòng) + danh mục nhỏ (kho/xe/bộ phận/tài khoản) vào RAM trình duyệt.
// - Hàng hóa (36.995 dòng) vào Web Worker + IndexedDB.
// Nhờ vậy khi người dùng gõ, kết quả hiện tức thì, không phải chờ database.
void initCustomerIndex();
void initProductIndex();
void initCatalogCache();

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
