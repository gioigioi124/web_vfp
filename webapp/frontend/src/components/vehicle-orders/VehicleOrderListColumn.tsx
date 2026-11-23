import React, { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { VehicleOrder, VehicleOrderVehicle } from "../../types/vehicleOrders";
import { vehicleOrdersService } from "../../services/vehicleOrdersService";
import { formatDateTimeVi } from "./sortItems";

interface VehicleOrderListColumnProps {
  vehicle: VehicleOrderVehicle | null;
  selectedOrder: VehicleOrder | null;
  onSelectOrder: (order: VehicleOrder | null) => void;
  refreshTrigger: number;
}

export const VehicleOrderListColumn: React.FC<VehicleOrderListColumnProps> = ({
  vehicle,
  selectedOrder,
  onSelectOrder,
  refreshTrigger,
}) => {
  const [orders, setOrders] = useState<VehicleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      if (!vehicle?._id) {
        setOrders([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await vehicleOrdersService.getOrdersByVehicle(vehicle._id);
        if (!active) return;
        setOrders(data);
      } catch {
        if (!active) return;
        setError("Không thể tải danh sách đơn hàng");
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchOrders();
    return () => {
      active = false;
    };
  }, [vehicle?._id, refreshTrigger]);

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center py-8 text-sm">
        <Package className="w-10 h-10 mb-2 text-gray-300" />
        <p>Chọn xe để xem đơn hàng</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">Đang tải...</div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center py-8 text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <h2 className="text-base font-semibold text-gray-800">
          Đơn hàng trong xe
        </h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
          {orders.length} đơn
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
          {orders.map((order) => {
            const totalItems = order.items?.length || 0;
            const unconfirmedCount =
              order.items?.filter(
                (item) =>
                  item.warehouseConfirm?.value === undefined ||
                  item.warehouseConfirm?.value === null ||
                  String(item.warehouseConfirm.value).trim() === "",
              ).length || 0;

            const isActive = selectedOrder?._id === order._id;

            return (
              <div
                key={order._id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectOrder(order);
                  }
                }}
                className={`relative p-3 border rounded-md transition-colors cursor-pointer select-none ${
                  isActive
                    ? "bg-blue-50 border-blue-500 ring-2 ring-blue-600/30"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                {/* Badge số lượng mặt hàng chưa xác nhận (giống elanX) */}
                {totalItems > 0 && (
                  <div className="absolute top-2 right-2">
                    <div
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        unconfirmedCount > 0
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-green-100 text-green-700 border border-green-300"
                      }`}
                      title={
                        unconfirmedCount > 0
                          ? `${unconfirmedCount} mặt hàng chưa xác nhận`
                          : "Đã xác nhận tất cả"
                      }
                    >
                      {unconfirmedCount > 0
                        ? `${unconfirmedCount}/${totalItems}`
                        : "✓"}
                    </div>
                  </div>
                )}

                {/* Thông tin đơn hàng */}
                <div className="pr-14">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <div className="text-sm font-medium text-gray-900">
                      {order.customer?.name || "Không có tên"}
                    </div>
                    {order.isOverDebtLimit && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                        Quá hạn nợ
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mb-1">
                    {totalItems} mặt hàng
                  </div>

                  <div className="text-xs text-gray-400">
                    {formatDateTimeVi(order.createdAt)}
                    {order.createdBy?.name && (
                      <span className="ml-2 text-green-600 font-medium">
                        • {order.createdBy.name}
                      </span>
                    )}
                  </div>

                  {order.customer?.note && (
                    <div className="text-xs text-gray-400 mt-1 italic">
                      {order.customer.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
