import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Package,
  Truck,
  X,
} from "lucide-react";
import {
  TruckSizeClass,
  VehicleOrder,
  VehicleOrderVehicle,
  VehicleYardPlacement,
  YardCameraPreset,
} from "../../../types/vehicleOrders";
import { vehicleOrdersService } from "../../../services/vehicleOrdersService";
import { TRUCK_CLASS_META, TRUCK_CLASS_ORDER } from "./truckSpecs";
import { buildYardLayout } from "./yardLayoutMapper";
import { MinimalYardCanvas3D } from "./MinimalYardCanvas3D";
import { VehicleOrderListColumn } from "../VehicleOrderListColumn";
import { OrderDetailColumn } from "../OrderDetailColumn";
import { formatDateVi } from "../sortItems";

interface VehicleYard3DViewProps {
  fromDate: string;
  toDate: string;
  creator: string;
  refreshTrigger: number;
  selectedVehicle: VehicleOrderVehicle | null;
  onSelectVehicle: (vehicle: VehicleOrderVehicle | null) => void;
}

export const VehicleYard3DView: React.FC<VehicleYard3DViewProps> = ({
  fromDate,
  toDate,
  creator,
  refreshTrigger,
  selectedVehicle,
  onSelectVehicle,
}) => {
  const [vehicles, setVehicles] = useState<VehicleOrderVehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [cameraPreset, setCameraPreset] = useState<YardCameraPreset>("overview");
  const [cameraSignal, setCameraSignal] = useState<number>(0);
  const [sortBySize, setSortBySize] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [highlightSizeClass, setHighlightSizeClass] =
    useState<TruckSizeClass | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<VehicleOrder | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"orders" | "detail">("orders");

  useEffect(() => {
    let active = true;
    const loadAllVehicles = async () => {
      try {
        setLoading(true);
        const res = await vehicleOrdersService.getVehicles({
          page: 1,
          limit: 200,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          creator: creator || undefined,
        });
        if (!active) return;
        setVehicles(res.vehicles);
        setError(null);
      } catch {
        if (!active) return;
        setError("Không thể tải dữ liệu bãi xe 3D");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAllVehicles();
    return () => {
      active = false;
    };
  }, [fromDate, toDate, creator, refreshTrigger]);

  // Reset đơn hàng khi đổi xe
  useEffect(() => {
    setSelectedOrder(null);
    setInspectorTab("orders");
  }, [selectedVehicle?._id]);

  const layout = useMemo(
    () => buildYardLayout(vehicles, sortBySize),
    [vehicles, sortBySize],
  );

  const jumpCamera = (preset: YardCameraPreset) => {
    setCameraPreset(preset);
    setCameraSignal((s) => s + 1);
  };

  const handleSelectPlacement = (placement: VehicleYardPlacement | null) => {
    onSelectVehicle(placement ? placement.vehicle : null);
  };

  const handleSelectOrder = (order: VehicleOrder | null) => {
    setSelectedOrder(order);
    if (order) {
      setInspectorTab("detail");
    }
  };

  const activePlacement = useMemo(
    () =>
      selectedVehicle
        ? layout.placements.find((p) => p.vehicle._id === selectedVehicle._id) ||
          null
        : null,
    [layout.placements, selectedVehicle],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-lg border border-gray-200 text-sm text-gray-500">
        Đang dựng mô hình 3D nhà kho &amp; bãi xe...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-red-200 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Thanh thống kê số lượng xe & lọc nổi bật theo kích thước xe */}
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Tổng quan 2 bãi */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200">
            <Truck className="w-3.5 h-3.5 text-primary-700" />
            <span>Tổng:</span>
            <span className="font-mono font-bold text-primary-800">
              {vehicles.length} xe
            </span>
          </div>

          <button
            type="button"
            onClick={() => jumpCamera("waiting")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors cursor-pointer"
            title="Chuyển góc nhìn tới Bãi xe chờ xếp"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Bãi chờ xếp:</span>
            <span className="font-mono font-bold">{layout.waitingCount}</span>
          </button>

          <button
            type="button"
            onClick={() => jumpCamera("completed")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
            title="Chuyển góc nhìn tới Bãi xe đã xếp xong"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bãi đã xong:</span>
            <span className="font-mono font-bold">{layout.completedCount}</span>
          </button>
        </div>

        {/* Phân bổ theo kích thước xe (click để làm nổi bật nhóm cỡ xe đó trên 3D) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-500 mr-0.5">
            Kích thước xe:
          </span>
          {TRUCK_CLASS_ORDER.map((cls) => {
            const count = layout.countsByClass[cls];
            const meta = TRUCK_CLASS_META[cls];
            const isActive = highlightSizeClass === cls;
            return (
              <button
                key={cls}
                type="button"
                disabled={count === 0}
                onClick={() =>
                  setHighlightSizeClass((prev) => (prev === cls ? null : cls))
                }
                title={
                  count > 0
                    ? `Bấm để làm nổi bật nhóm ${meta.sizeLabel}`
                    : `Không có xe thuộc nhóm ${meta.sizeLabel}`
                }
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                  count === 0
                    ? "opacity-40 bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    : isActive
                      ? "bg-primary-800 text-white border-primary-700 shadow-sm cursor-pointer scale-105"
                      : `${meta.badgeClass} hover:opacity-90 cursor-pointer`
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isActive ? "#ffffff" : meta.accentHex,
                  }}
                />
                <span>{meta.sizeLabel}</span>
                <span className="font-mono font-bold">{count}</span>
              </button>
            );
          })}
          {highlightSizeClass && (
            <button
              type="button"
              onClick={() => setHighlightSizeClass(null)}
              className="text-[11px] text-gray-500 hover:text-gray-800 underline ml-1 cursor-pointer"
            >
              Hiện tất cả
            </button>
          )}
        </div>
      </div>

      {/* Không gian 3D chính + Panel chi tiết bên phải khi chọn xe */}
      <div className="relative flex-1 min-h-[420px] rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-[#d8e3ef]">
        <MinimalYardCanvas3D
          layout={layout}
          selectedVehicleId={selectedVehicle?._id || null}
          highlightSizeClass={highlightSizeClass}
          cameraPreset={cameraPreset}
          cameraSignal={cameraSignal}
          showLabels={showLabels}
          onSelectPlacement={handleSelectPlacement}
        />

        {/* Trạng thái trống khi không có xe theo bộ lọc */}
        {vehicles.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-5 py-4 shadow-md text-center">
              <Truck className="w-8 h-8 mx-auto mb-1.5 text-gray-400" />
              <div className="text-sm font-semibold text-gray-700">
                Không có xe nào trong khoảng lọc này
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Hãy bấm &ldquo;Tất cả ngày&rdquo; hoặc đổi bộ lọc ở thanh trên
              </div>
            </div>
          </div>
        )}

        {/* Chú giải góc dưới trái */}
        <div className="hidden lg:flex absolute bottom-3 left-3 pointer-events-none bg-slate-900/85 text-slate-200 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 shadow-lg items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
            Chờ xếp
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            Đã in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            Đã xếp xong
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            Kéo xoay · Cuộn zoom · Click xe xem đơn
          </span>
        </div>

        {/* Thanh điều khiển góc nhìn & hiển thị */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-3 flex flex-wrap items-center justify-center gap-1 bg-slate-900/90 text-white backdrop-blur-md px-2 py-1.5 rounded-xl shadow-lg border border-white/15">
          <button
            type="button"
            onClick={() => jumpCamera("overview")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              cameraPreset === "overview"
                ? "bg-primary-600 text-white"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Toàn cảnh</span>
          </button>
          <button
            type="button"
            onClick={() => jumpCamera("waiting")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              cameraPreset === "waiting"
                ? "bg-amber-600 text-white"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            Bãi chờ
          </button>
          <button
            type="button"
            onClick={() => jumpCamera("completed")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              cameraPreset === "completed"
                ? "bg-emerald-600 text-white"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            Bãi xong
          </button>
          <button
            type="button"
            onClick={() => jumpCamera("top")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              cameraPreset === "top"
                ? "bg-sky-600 text-white"
                : "text-slate-200 hover:bg-white/10"
            }`}
            title="Nhìn thẳng từ trên xuống để so sánh kích thước các xe rõ nhất"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Nhìn từ trên</span>
          </button>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          <button
            type="button"
            onClick={() => setSortBySize((s) => !s)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              sortBySize
                ? "bg-sky-500/25 text-sky-200 border border-sky-400/40"
                : "text-slate-300 hover:bg-white/10"
            }`}
            title="Xếp xe từ lớn đến nhỏ trong từng bãi để dễ so sánh"
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xếp theo cỡ</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabels((s) => !s)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              showLabels
                ? "bg-sky-500/25 text-sky-200 border border-sky-400/40"
                : "text-slate-300 hover:bg-white/10"
            }`}
            title="Ẩn/hiện nhãn tải trọng trên nóc từng xe"
          >
            {showLabels ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Nhãn nóc</span>
          </button>
        </div>

        {/* Panel trượt bên phải (Chỉ xem đơn hàng & chi tiết hàng hóa của xe đang chọn) */}
        {selectedVehicle && (
          <div className="absolute top-2 right-2 bottom-16 w-[calc(100%-1rem)] sm:w-[440px] lg:w-[520px] bg-white/96 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-30">
            {/* Header xe đang chọn */}
            <div className="px-3.5 py-2.5 border-b border-gray-200 bg-slate-50 flex items-start justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {activePlacement && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: activePlacement.dimensions.accentHex,
                      }}
                    />
                  )}
                  <span className="font-bold text-sm text-gray-900">
                    {selectedVehicle.weight} - {selectedVehicle.time}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      selectedVehicle.isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : selectedVehicle.isPrinted
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {selectedVehicle.isCompleted
                      ? "Bãi đã xếp xong"
                      : selectedVehicle.isPrinted
                        ? "Bãi chờ · Đã in"
                        : "Bãi xe chờ xếp"}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5 truncate">
                  {selectedVehicle.destination} ·{" "}
                  {formatDateVi(selectedVehicle.vehicleDate)}
                  {selectedVehicle.createdBy?.name
                    ? ` · ${selectedVehicle.createdBy.name}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectVehicle(null)}
                aria-label="Đóng chi tiết xe"
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab chuyển nhanh: Danh sách đơn hàng / Chi tiết đơn */}
            <div className="px-3 py-1.5 border-b border-gray-200 bg-white flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setInspectorTab("orders")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  inspectorTab === "orders"
                    ? "bg-primary-50 text-primary-800 border border-primary-200"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Đơn hàng trong xe</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab("detail")}
                disabled={!selectedOrder}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  !selectedOrder
                    ? "opacity-45 cursor-not-allowed text-gray-400"
                    : inspectorTab === "detail"
                      ? "bg-primary-50 text-primary-800 border border-primary-200 cursor-pointer"
                      : "text-gray-600 hover:bg-gray-100 cursor-pointer"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Chi tiết đơn</span>
              </button>
            </div>

            {/* Nội dung chỉ xem tái sử dụng 2 cột đã có */}
            <div className="flex-1 overflow-y-auto p-3">
              {inspectorTab === "orders" ? (
                <VehicleOrderListColumn
                  vehicle={selectedVehicle}
                  selectedOrder={selectedOrder}
                  onSelectOrder={handleSelectOrder}
                  refreshTrigger={refreshTrigger}
                />
              ) : (
                <OrderDetailColumn
                  order={selectedOrder}
                  vehicle={selectedVehicle}
                  refreshTrigger={refreshTrigger}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
