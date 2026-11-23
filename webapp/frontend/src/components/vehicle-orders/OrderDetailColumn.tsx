import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Eye, FileText, Package, Truck } from "lucide-react";
import {
  VehicleOrder,
  VehicleOrderItem,
  VehicleOrderVehicle,
} from "../../types/vehicleOrders";
import { vehicleOrdersService } from "../../services/vehicleOrdersService";
import { formatDateTimeVi, sortOrderItems } from "./sortItems";

interface OrderDetailColumnProps {
  order: VehicleOrder | null;
  vehicle: VehicleOrderVehicle | null;
  refreshTrigger: number;
}

const ItemsReadOnlyTable: React.FC<{ items: VehicleOrderItem[] }> = ({
  items,
}) => (
  <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
    <table className="w-full border-collapse text-left text-xs md:text-[13px]">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
          <th className="py-2 px-2 text-center font-semibold w-[50px]">STT</th>
          <th className="py-2 px-2.5 font-semibold min-w-[150px] max-w-[250px]">
            Tên hàng hóa
          </th>
          <th className="py-2 px-2 font-semibold w-[95px]">Kích thước</th>
          <th className="py-2 px-2 font-semibold w-[70px]">ĐVT</th>
          <th className="py-2 px-2 text-right font-semibold w-[85px]">
            Số lượng
          </th>
          <th className="py-2 px-2 font-semibold w-[70px]">Kho</th>
          <th className="py-2 px-2 text-right font-semibold w-[75px]">Số cm</th>
          <th className="py-2 px-2.5 font-semibold min-w-[110px] max-w-[180px]">
            Ghi chú
          </th>
          <th className="py-2 px-2 text-center font-semibold w-[85px]">Kho</th>
          <th className="py-2 px-2 text-center font-semibold w-[90px]">
            Điều vận
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <tr key={`${item.productName}-${item.size || ""}-${index}`} className="hover:bg-gray-50/70">
            <td className="py-2 px-2 text-center text-gray-500">{index + 1}</td>
            <td className="py-2 px-2.5 break-words whitespace-normal font-medium text-gray-900">
              {item.productName || "-"}
            </td>
            <td className="py-2 px-2 text-gray-700">{item.size || "-"}</td>
            <td className="py-2 px-2 text-gray-700">{item.unit || "-"}</td>
            <td className="py-2 px-2 text-right font-bold text-gray-900 font-mono">
              {item.quantity || 0}
            </td>
            <td className="py-2 px-2 text-gray-700">{item.warehouse || "-"}</td>
            <td className="py-2 px-2 text-right text-red-600 font-medium font-mono">
              {item.cmQty || 0}
            </td>
            <td className="py-2 px-2.5 text-xs text-gray-600 break-words whitespace-normal">
              {item.note || "-"}
            </td>
            <td className="py-2 px-2 text-center text-gray-800">
              {item.warehouseConfirm?.value !== undefined &&
              String(item.warehouseConfirm.value).trim() !== ""
                ? String(item.warehouseConfirm.value)
                : "-"}
            </td>
            <td className="py-2 px-2 text-center text-gray-800">
              {item.leaderConfirm?.value !== undefined &&
              String(item.leaderConfirm.value).trim() !== ""
                ? String(item.leaderConfirm.value)
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const OrderDetailColumn: React.FC<OrderDetailColumnProps> = ({
  order,
  vehicle,
  refreshTrigger,
}) => {
  const [viewMode, setViewMode] = useState<1 | 2>(1); // 1: Đơn hàng hiện tại, 2: Xem cả xe
  const [vehicleOrders, setVehicleOrders] = useState<VehicleOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const resolvedVehicle: VehicleOrderVehicle | null = useMemo(() => {
    if (order?.vehicle && typeof order.vehicle === "object") {
      return order.vehicle;
    }
    return vehicle;
  }, [order?.vehicle, vehicle]);

  const vehicleId = useMemo(() => {
    if (order?.vehicle) {
      return typeof order.vehicle === "string"
        ? order.vehicle
        : order.vehicle._id;
    }
    return vehicle?._id || null;
  }, [order?.vehicle, vehicle?._id]);

  // Nếu đơn hàng không gắn xe thì quay về chế độ xem đơn lẻ
  useEffect(() => {
    if (!vehicleId && viewMode === 2) {
      setViewMode(1);
    }
  }, [vehicleId, viewMode]);

  useEffect(() => {
    let active = true;
    const fetchVehicleOrders = async () => {
      if (!order || viewMode !== 2 || !vehicleId) {
        return;
      }

      try {
        setLoadingOrders(true);
        const data = await vehicleOrdersService.getOrdersByVehicle(vehicleId);
        if (active) setVehicleOrders(data);
      } catch {
        if (active) setVehicleOrders([]);
      } finally {
        if (active) setLoadingOrders(false);
      }
    };

    void fetchVehicleOrders();
    return () => {
      active = false;
    };
  }, [order, viewMode, vehicleId, refreshTrigger]);

  const sortedItems = useMemo(
    () => (order?.items ? sortOrderItems(order.items) : []),
    [order?.items],
  );

  const allVehicleItems = useMemo(() => {
    if (viewMode !== 2) return [];
    const items: VehicleOrderItem[] = [];
    vehicleOrders.forEach((o) => {
      if (o.items) items.push(...o.items);
    });
    return items;
  }, [viewMode, vehicleOrders]);

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8 text-gray-500 text-sm">
        <FileText className="w-10 h-10 mb-2 text-gray-300" />
        <p>Chọn đơn hàng để xem chi tiết</p>
      </div>
    );
  }

  const isAssigned = Boolean(vehicleId);
  const totalQuantity = sortedItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );
  const totalCmQty = sortedItems.reduce(
    (sum, item) => sum + (item.cmQty || 0),
    0,
  );

  const vehicleTotalQuantity = allVehicleItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );
  const vehicleTotalCmQty = allVehicleItems.reduce(
    (sum, item) => sum + (item.cmQty || 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* View Mode Tabs (chỉ gồm 2 tab xem: Đơn hàng & Xem cả xe) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-gray-100 p-1 rounded-lg w-fit border border-gray-200/80">
          <button
            type="button"
            onClick={() => setViewMode(1)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              viewMode === 1
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Đơn hàng</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode(2)}
            disabled={!isAssigned}
            title={!isAssigned ? "Đơn hàng chưa được gán xe" : "Xem tổng hợp toàn bộ đơn hàng trên xe"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !isAssigned
                ? "opacity-45 cursor-not-allowed text-gray-400"
                : viewMode === 2
                  ? "bg-white text-gray-900 shadow-sm cursor-pointer"
                  : "text-gray-600 hover:text-gray-900 cursor-pointer"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Xem cả xe</span>
          </button>
        </div>

        <h2 className="text-base font-semibold text-gray-800">
          {viewMode === 1 ? "Chi tiết đơn hàng" : "Tổng hợp đơn hàng trên xe"}
        </h2>
      </div>

      {/* Khối thông tin khách hàng & thông tin xe */}
      <div className="flex flex-col md:flex-row gap-2 w-full">
        {viewMode === 1 && (
          <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base md:text-lg uppercase font-bold text-gray-900">
                {order.customer?.name || "N/A"}
              </span>
              {order.isOverDebtLimit && (
                <span className="text-[11px] px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                  Quá hạn nợ
                </span>
              )}
            </div>

            <div className="mt-1 text-xs md:text-sm text-gray-600 space-y-0.5">
              {order.customer?.customerCode && (
                <div>
                  <span className="font-medium">Mã KH:</span>{" "}
                  {order.customer.customerCode}
                  {order.customer.phone && ` - (${order.customer.phone})`}
                </div>
              )}
              {order.customer?.address && (
                <div>
                  <span className="font-medium">Địa chỉ:</span>{" "}
                  {order.customer.address}
                </div>
              )}
            </div>

            {order.customer?.note && (
              <div className="mt-2">
                <span className="text-xs md:text-sm italic text-gray-500">
                  {order.customer.note}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Trạng thái đơn hàng / Thông tin xe */}
        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-3 md:p-4 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {isAssigned ? (
              <>
                <Truck className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-600 font-medium">
                  {viewMode === 1 ? "Đã gán xe" : "Thông tin xe"}
                </span>
                {resolvedVehicle && (
                  <span className="text-sm text-gray-700">
                    - {resolvedVehicle.weight} - {resolvedVehicle.time} -{" "}
                    {resolvedVehicle.destination}
                  </span>
                )}
              </>
            ) : (
              <>
                <Package className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="text-sm text-orange-600 font-medium">
                  Chưa gán xe
                </span>
              </>
            )}
          </div>

          {viewMode === 1 ? (
            <>
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Ngày tạo: {formatDateTimeVi(order.createdAt)}</span>
              </div>
              {order.updatedAt && order.updatedAt !== order.createdAt && (
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Cập nhật lần cuối: {formatDateTimeVi(order.updatedAt)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs md:text-sm text-gray-600">
              Tổng cộng:{" "}
              <span className="font-bold text-gray-900">
                {vehicleOrders.length}
              </span>{" "}
              đơn hàng trên xe
            </div>
          )}
        </div>
      </div>

      {/* Bảng danh sách hàng hóa */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 md:p-4 border-b border-gray-100">
          <h3 className="text-sm md:text-base font-semibold text-gray-800">
            {viewMode === 1
              ? "Danh sách hàng hóa"
              : "Tổng hợp hàng hóa toàn xe"}
          </h3>

          <div className="flex flex-wrap text-xs md:text-sm text-gray-600 gap-3 md:gap-4">
            <div>
              Mặt hàng:{" "}
              <span className="font-semibold text-gray-900 font-mono">
                {viewMode === 1 ? sortedItems.length : allVehicleItems.length}
              </span>
            </div>
            <div>
              Số lượng:{" "}
              <span className="font-semibold text-gray-900 font-mono">
                {viewMode === 1 ? totalQuantity : vehicleTotalQuantity}
              </span>
            </div>
            <div>
              Số cm:{" "}
              <span className="font-semibold text-red-600 font-mono">
                {viewMode === 1 ? totalCmQty : vehicleTotalCmQty}
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {loadingOrders ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-700" />
            </div>
          ) : viewMode === 1 ? (
            sortedItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">
                Chưa có hàng hóa
              </p>
            ) : (
              <ItemsReadOnlyTable items={sortedItems} />
            )
          ) : vehicleOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">
              Chưa có hàng hóa nào trên xe
            </p>
          ) : (
            <div className="space-y-6">
              {vehicleOrders.map((vOrder, vIndex) => {
                const vItems = sortOrderItems(vOrder.items || []);
                const isCurrentOrder = vOrder._id === order._id;

                return (
                  <div
                    key={vOrder._id || vIndex}
                    className={`space-y-3 pb-5 border-b border-gray-200 last:border-0 last:pb-0 ${
                      isCurrentOrder
                        ? "bg-blue-50/50 -mx-2 px-2.5 py-3 rounded-lg border border-blue-100"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="bg-gray-100 text-gray-700 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                            {vIndex + 1}
                          </div>
                          <span className="text-sm md:text-base uppercase font-bold text-primary-700">
                            {vOrder.customer?.name || "N/A"}
                          </span>
                          {isCurrentOrder && (
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase font-bold shadow-sm">
                              Đang chọn
                            </span>
                          )}
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 pl-8">
                          {vOrder.customer?.customerCode && (
                            <span className="font-medium mr-2">
                              {vOrder.customer.customerCode}
                            </span>
                          )}
                          <span>{vOrder.customer?.address}</span>
                        </div>
                        {vOrder.customer?.note && (
                          <div className="text-xs italic text-gray-500 pl-8">
                            "{vOrder.customer.note}"
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs md:text-sm bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm shrink-0">
                        <div>
                          <span className="text-gray-500">SL:</span>{" "}
                          <span className="font-bold font-mono text-gray-900">
                            {vItems.reduce((s, i) => s + (i.quantity || 0), 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">CM:</span>{" "}
                          <span className="font-bold font-mono text-red-600">
                            {vItems.reduce((s, i) => s + (i.cmQty || 0), 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ItemsReadOnlyTable items={vItems} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
