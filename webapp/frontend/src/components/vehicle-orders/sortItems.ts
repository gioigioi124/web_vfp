import { VehicleOrder, VehicleOrderItem } from "../../types/vehicleOrders";

const WAREHOUSE_ORDER: Record<string, number> = {
  K02: 1,
  K03: 2,
  K04: 3,
  K01: 4,
};

export interface SortableVehicleItem extends VehicleOrderItem {
  customerName?: string;
  orderId?: string;
}

/**
 * Sort order items by warehouse priority (K02 -> K03 -> K04 -> K01),
 * then by product name + size (Vietnamese locale), matching elanX HomePage/OrderDetail.
 */
export function sortOrderItems<T extends SortableVehicleItem>(
  items: T[],
  groupByCustomer = false,
): T[] {
  return [...items].sort((a, b) => {
    if (groupByCustomer) {
      const custA = (a.customerName || "").toLowerCase();
      const custB = (b.customerName || "").toLowerCase();
      if (custA !== custB) return custA.localeCompare(custB, "vi");

      if ((a.orderId || "") !== (b.orderId || "")) {
        return (a.orderId || "").localeCompare(b.orderId || "");
      }
    }

    const warehouseA = WAREHOUSE_ORDER[a.warehouse] || 999;
    const warehouseB = WAREHOUSE_ORDER[b.warehouse] || 999;
    if (warehouseA !== warehouseB) {
      return warehouseA - warehouseB;
    }

    const nameA = `${a.productName || ""} ${a.size || ""}`.trim().toLowerCase();
    const nameB = `${b.productName || ""} ${b.size || ""}`.trim().toLowerCase();
    return nameA.localeCompare(nameB, "vi");
  });
}

/**
 * Sort orders alphabetically by customer name (Vietnamese locale),
 * matching elanX VehicleOrderList & OrderDetail.
 */
export function sortOrdersByCustomer(orders: VehicleOrder[]): VehicleOrder[] {
  return [...orders].sort((a, b) => {
    const nameA = a.customer?.name || "";
    const nameB = b.customer?.name || "";
    return nameA.localeCompare(nameB, "vi");
  });
}

export function formatDateTimeVi(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateVi(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("vi-VN");
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
