export interface VehicleOrderStaff {
  _id: string;
  name: string;
  username?: string;
}

export interface VehicleOrderVehicle {
  _id: string;
  carName?: string;
  weight: string;
  time: string;
  destination: string;
  note?: string;
  vehicleDate: string;
  isPrinted: boolean;
  isCompleted: boolean;
  orderCount?: number;
  createdBy?: VehicleOrderStaff;
}

export interface VehicleOrderCustomer {
  name: string;
  customerCode?: string;
  address?: string;
  phone?: string;
  note?: string;
}

export interface VehicleOrderConfirm {
  value?: string | number;
  confirmedAt?: string;
}

export interface VehicleOrderItem {
  stt?: number;
  productName: string;
  size?: string;
  unit: string;
  quantity: number;
  warehouse: string;
  cmQty: number;
  cmQtyPerUnit?: number;
  note?: string;
  warehouseConfirm?: VehicleOrderConfirm;
  leaderConfirm?: VehicleOrderConfirm;
}

export interface VehicleOrder {
  _id: string;
  customer: VehicleOrderCustomer;
  items: VehicleOrderItem[];
  isCompensationOrder?: boolean;
  isOverDebtLimit?: boolean;
  orderDate: string;
  vehicle?: VehicleOrderVehicle | string | null;
  createdBy?: VehicleOrderStaff;
  createdAt: string;
  updatedAt?: string;
}

export interface VehicleListQuery {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  creator?: string;
}

export interface VehicleListResponse {
  vehicles: VehicleOrderVehicle[];
  currentPage: number;
  totalPages: number;
  totalVehicles: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Abstraction layer for fetching vehicle & order data.
 * Currently backed by local mock data; swap implementation to API calls when DB is connected.
 */
export interface VehicleOrdersDataSource {
  getVehicles: (query?: VehicleListQuery) => Promise<VehicleListResponse>;
  getOrdersByVehicle: (vehicleId: string) => Promise<VehicleOrder[]>;
  getStaffList: () => Promise<VehicleOrderStaff[]>;
}
