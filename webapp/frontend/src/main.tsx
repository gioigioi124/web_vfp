import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { AppShell } from "./components/layout/AppShell";
import { ComingSoonPage } from "./components/layout/ComingSoonPage";
import {
  initCustomerIndex,
  refreshCustomerIndex,
} from "./lib/customerIndex";
import {
  initProductIndex,
  refreshProductIndex,
} from "./lib/productIndex";
import { initCatalogCache } from "./lib/catalogCache";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const CashVoucherWorkspace = lazy(() =>
  import("./components/cash/CashVoucherWorkspace").then((m) => ({
    default: m.CashVoucherWorkspace,
  })),
);
const CashBankLedgerPage = lazy(() =>
  import("./components/cash/CashBankLedgerPage").then((m) => ({
    default: m.CashBankLedgerPage,
  })),
);
const CatalogViewerPage = lazy(() =>
  import("./components/catalog/CatalogViewerPage").then((m) => ({
    default: m.CatalogViewerPage,
  })),
);
const PriceListWorkspace = lazy(() =>
  import("./components/price-list/PriceListWorkspace").then((m) => ({
    default: m.PriceListWorkspace,
  })),
);
const GenericVoucherWorkspace = lazy(() =>
  import("./components/modules/GenericVoucherWorkspace").then((m) => ({
    default: m.GenericVoucherWorkspace,
  })),
);
const PartnerDebtPage = lazy(() =>
  import("./components/modules/PartnerDebtPage").then((m) => ({
    default: m.PartnerDebtPage,
  })),
);
const GeneralLedgerReportPage = lazy(() =>
  import("./components/modules/GeneralLedgerReportPage").then((m) => ({
    default: m.GeneralLedgerReportPage,
  })),
);
const InventoryReportPage = lazy(() =>
  import("./components/modules/InventoryReportPage").then((m) => ({
    default: m.InventoryReportPage,
  })),
);
const VehicleOrdersPage = lazy(() =>
  import("./components/vehicle-orders/VehicleOrdersPage").then((m) => ({
    default: m.VehicleOrdersPage,
  })),
);

const LazyFallback = (
  <div className="h-full w-full flex items-center justify-center bg-surface text-xs text-neutral-500">
    Đang tải phân hệ...
  </div>
);

const INDEX_SYNC_INTERVAL_MS = 60_000;
let indexSyncTimer: number | null = null;

const startBackgroundIndexSync = () => {
  if (typeof window === "undefined" || indexSyncTimer !== null) return;
  indexSyncTimer = window.setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void refreshCustomerIndex();
    refreshProductIndex();
  }, INDEX_SYNC_INTERVAL_MS);
};

// Nạp danh mục (Khách hàng, Hàng hóa, Kho/Xe/Bộ phận/Tài khoản) theo cơ chế
// Lazy / Idle sau khi màn hình danh sách chứng từ đã render xong để không
// tranh chấp băng thông với API tải danh sách phiếu lúc mới mở trình duyệt.
const scheduleIdlePreload = () => {
  const preload = () => {
    void initCatalogCache();
    void Promise.allSettled([
      initCustomerIndex(),
      initProductIndex(),
    ]).finally(startBackgroundIndexSync);
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
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {/* Nhóm 1: Tiền mặt & Ngân hàng (CtT / CtT0) */}
            <Route
              path="/cash/receipts"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C1" />
                </Suspense>
              }
            />
            <Route
              path="/cash/receipts/:stt"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C1" />
                </Suspense>
              }
            />
            <Route
              path="/cash/payments"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C2" />
                </Suspense>
              }
            />
            <Route
              path="/cash/payments/:stt"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C2" />
                </Suspense>
              }
            />
            <Route
              path="/bank/credits"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C3" />
                </Suspense>
              }
            />
            <Route
              path="/bank/credits/:stt"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C3" />
                </Suspense>
              }
            />
            <Route
              path="/bank/debits"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C4" />
                </Suspense>
              }
            />
            <Route
              path="/bank/debits/:stt"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashVoucherWorkspace maCt="C4" />
                </Suspense>
              }
            />
            <Route
              path="/cash/ledger"
              element={
                <Suspense fallback={LazyFallback}>
                  <CashBankLedgerPage />
                </Suspense>
              }
            />

            {/* Nhóm 2: Bán hàng & Kho (giữ nguyên toàn bộ route hiện hữu) */}
            <Route path="/sales-invoices" element={<App initialVoucherMode="sales" />} />
            <Route path="/sales-invoices/:stt" element={<App initialVoucherMode="sales" />} />
            <Route path="/sales-returns" element={<App initialVoucherMode="return" />} />
            <Route path="/sales-returns/:stt" element={<App initialVoucherMode="return" />} />
            <Route path="/warehouse-slips" element={<App initialVoucherMode="warehouse" />} />
            <Route path="/warehouse-slips/:stt" element={<App initialVoucherMode="warehouse" />} />
            <Route
              path="/vehicle-orders"
              element={
                <Suspense fallback={LazyFallback}>
                  <VehicleOrdersPage />
                </Suspense>
              }
            />
            <Route
              path="/price-lists"
              element={
                <Suspense fallback={LazyFallback}>
                  <PriceListWorkspace />
                </Suspense>
              }
            />

            {/* Nhóm 2-5: Công nợ 131/331, Mua hàng, Kho khác, Tổng hợp */}
            <Route
              path="/receivables"
              element={
                <Suspense fallback={LazyFallback}>
                  <PartnerDebtPage tkPrefix="131" />
                </Suspense>
              }
            />
            <Route
              path="/purchases"
              element={
                <Suspense fallback={LazyFallback}>
                  <GenericVoucherWorkspace moduleKey="purchase" />
                </Suspense>
              }
            />
            <Route
              path="/payables"
              element={
                <Suspense fallback={LazyFallback}>
                  <PartnerDebtPage tkPrefix="331" />
                </Suspense>
              }
            />
            <Route
              path="/inventory/other"
              element={
                <Suspense fallback={LazyFallback}>
                  <GenericVoucherWorkspace moduleKey="inv-io" />
                </Suspense>
              }
            />
            <Route
              path="/inventory/transfers"
              element={
                <Suspense fallback={LazyFallback}>
                  <GenericVoucherWorkspace moduleKey="inv-transfer" />
                </Suspense>
              }
            />
            <Route
              path="/inventory/reports"
              element={
                <Suspense fallback={LazyFallback}>
                  <InventoryReportPage />
                </Suspense>
              }
            />
            <Route
              path="/gl/vouchers"
              element={
                <Suspense fallback={LazyFallback}>
                  <GenericVoucherWorkspace moduleKey="gl-voucher" />
                </Suspense>
              }
            />
            <Route
              path="/gl/reports"
              element={
                <Suspense fallback={LazyFallback}>
                  <GeneralLedgerReportPage />
                </Suspense>
              }
            />

            {/* Nhóm 6: Catalog danh mục (Chỉ xem) */}
            <Route path="/catalogs" element={<Navigate to="/catalogs/khach-hang" replace />} />
            <Route
              path="/catalogs/:catalogId"
              element={
                <Suspense fallback={LazyFallback}>
                  <CatalogViewerPage />
                </Suspense>
              }
            />

            {/* Các phần hành tiếp theo trên Sidebar */}
            <Route path="/coming-soon/:moduleId" element={<ComingSoonPage />} />

            <Route path="*" element={<Navigate to="/sales-invoices" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
