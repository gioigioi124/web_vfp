import {
  VehicleListQuery,
  VehicleListResponse,
  VehicleOrder,
  VehicleOrderStaff,
  VehicleOrderVehicle,
  VehicleOrdersDataSource,
} from "../types/vehicleOrders";
import { sortOrdersByCustomer } from "../components/vehicle-orders/sortItems";

function offsetIsoDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDateTime(daysOffset: number, time: string): string {
  return `${offsetIsoDate(daysOffset)}T${time}:00`;
}

const MOCK_STAFF: VehicleOrderStaff[] = [
  { _id: "staff-1", name: "Nguyễn Minh Anh", username: "minhanh" },
  { _id: "staff-2", name: "Trần Thu Hà", username: "thuha" },
  { _id: "staff-3", name: "Lê Hoàng Nam", username: "hoangnam" },
];

const MOCK_VEHICLES: VehicleOrderVehicle[] = [
  {
    _id: "veh-1",
    carName: "Xe 3.5T - Hà Nội",
    weight: "3.5T",
    time: "08h30",
    destination: "Hà Nội - Thanh Xuân",
    note: "Ưu tiên giao buổi sáng",
    vehicleDate: isoDateTime(0, "08:30"),
    isPrinted: false,
    isCompleted: false,
    createdBy: MOCK_STAFF[0],
  },
  {
    _id: "veh-2",
    carName: "Xe 5T - Hải Phòng",
    weight: "5T",
    time: "10h00",
    destination: "Hải Phòng - Quảng Ninh",
    note: "Ghép hàng đại lý tuyến QL5",
    vehicleDate: isoDateTime(0, "10:00"),
    isPrinted: true,
    isCompleted: false,
    createdBy: MOCK_STAFF[1],
  },
  {
    _id: "veh-3",
    carName: "Xe 1.25T - Bắc Ninh",
    weight: "1.25T",
    time: "13h30",
    destination: "Bắc Ninh - Từ Sơn",
    note: "",
    vehicleDate: isoDateTime(0, "13:30"),
    isPrinted: true,
    isCompleted: true,
    createdBy: MOCK_STAFF[0],
  },
  {
    _id: "veh-4",
    carName: "Xe 10T Hà Nội - Nghệ An",
    weight: "10T Hà Nội",
    time: "15h30",
    destination: "Thanh Hóa - Nghệ An",
    note: "Bốc hàng cửa kho K04",
    vehicleDate: isoDateTime(0, "15:30"),
    isPrinted: false,
    isCompleted: false,
    createdBy: MOCK_STAFF[2],
  },
  {
    _id: "veh-5",
    carName: "Xe 3.5T - Thái Nguyên",
    weight: "3.5T",
    time: "09h00",
    destination: "Thái Nguyên - Sông Công",
    note: "Xe chạy hôm qua",
    vehicleDate: isoDateTime(-1, "09:00"),
    isPrinted: true,
    isCompleted: true,
    createdBy: MOCK_STAFF[1],
  },
  {
    _id: "veh-6",
    carName: "Xe SG - Miền Nam",
    weight: "Xe SG",
    time: "16h00",
    destination: "TP. Hồ Chí Minh",
    note: "Hàng xuất kho tổng",
    vehicleDate: isoDateTime(-1, "16:00"),
    isPrinted: true,
    isCompleted: false,
    createdBy: MOCK_STAFF[2],
  },
];

const VEHICLE_MAP = new Map<string, VehicleOrderVehicle>(
  MOCK_VEHICLES.map((v) => [v._id, v]),
);

const MOCK_ORDERS: VehicleOrder[] = [
  {
    _id: "ord-101",
    customer: {
      name: "Đại lý An Phát",
      customerCode: "KH00124",
      address: "128 Nguyễn Trãi, Thanh Xuân, Hà Nội",
      phone: "0912 345 678",
      note: "Gọi trước 30 phút khi xe tới",
    },
    items: [
      {
        stt: 1,
        productName: "gấp 3 Alias 9F",
        size: "160x200",
        unit: "cái",
        quantity: 6,
        warehouse: "K04",
        cmQty: 54,
        cmQtyPerUnit: 9,
        note: "Vỏ gấm sáng màu",
        warehouseConfirm: { value: "6" },
        leaderConfirm: { value: 6 },
      },
      {
        stt: 2,
        productName: "Đệm thẳng không chần Vimatt 14F",
        size: "180x200",
        unit: "cái",
        quantity: 4,
        warehouse: "K02",
        cmQty: 56,
        cmQtyPerUnit: 14,
        note: "",
        warehouseConfirm: { value: "4" },
        leaderConfirm: { value: 4 },
      },
      {
        stt: 3,
        productName: "gấp 3 See 5F",
        size: "120x190",
        unit: "cái",
        quantity: 10,
        warehouse: "K03",
        cmQty: 50,
        cmQtyPerUnit: 5,
        note: "Bọc nilon 2 lớp",
        warehouseConfirm: { value: "" },
        leaderConfirm: {},
      },
    ],
    orderDate: isoDateTime(0, "07:45"),
    vehicle: VEHICLE_MAP.get("veh-1") || null,
    createdBy: MOCK_STAFF[0],
    createdAt: isoDateTime(0, "07:45"),
    updatedAt: isoDateTime(0, "08:10"),
  },
  {
    _id: "ord-102",
    customer: {
      name: "Cửa hàng Chăn Ga Minh Đức",
      customerCode: "KH00208",
      address: "45 Lê Văn Lương, Cầu Giấy, Hà Nội",
      phone: "0988 221 904",
      note: "Giao cổng phụ tầng 1",
    },
    items: [
      {
        stt: 1,
        productName: "gấp 3 Fly 7F",
        size: "160x200",
        unit: "cái",
        quantity: 5,
        warehouse: "K04",
        cmQty: 35,
        cmQtyPerUnit: 7,
        note: "",
        warehouseConfirm: { value: "5" },
        leaderConfirm: { value: 5 },
      },
      {
        stt: 2,
        productName: "Ruột gối bông ép Elan",
        size: "45x65",
        unit: "đôi",
        quantity: 12,
        warehouse: "K01",
        cmQty: 12,
        cmQtyPerUnit: 1,
        note: "Đóng kiện 6 đôi",
        warehouseConfirm: { value: "12" },
        leaderConfirm: { value: 12 },
      },
    ],
    orderDate: isoDateTime(0, "08:00"),
    vehicle: VEHICLE_MAP.get("veh-1") || null,
    createdBy: MOCK_STAFF[1],
    createdAt: isoDateTime(0, "08:00"),
    updatedAt: isoDateTime(0, "08:00"),
  },
  {
    _id: "ord-103",
    customer: {
      name: "Nội thất Hoàng Gia",
      customerCode: "KH00315",
      address: "212 Quang Trung, Hà Đông, Hà Nội",
      phone: "0904 667 812",
      note: "",
    },
    isOverDebtLimit: true,
    items: [
      {
        stt: 1,
        productName: "Đệm thẳng không chần Rex 18F",
        size: "200x220",
        unit: "cái",
        quantity: 3,
        warehouse: "K02",
        cmQty: 54,
        cmQtyPerUnit: 18,
        note: "Hàng đặt theo kích thước",
        warehouseConfirm: { value: "10h30" },
        leaderConfirm: {},
      },
    ],
    orderDate: isoDateTime(0, "08:15"),
    vehicle: VEHICLE_MAP.get("veh-1") || null,
    createdBy: MOCK_STAFF[0],
    createdAt: isoDateTime(0, "08:15"),
    updatedAt: isoDateTime(0, "08:20"),
  },
  {
    _id: "ord-201",
    customer: {
      name: "Đại lý Bảo Ngọc Hải Phòng",
      customerCode: "KH00410",
      address: "89 Lạch Tray, Ngô Quyền, Hải Phòng",
      phone: "0936 551 220",
      note: "Kèm hóa đơn VAT",
    },
    items: [
      {
        stt: 1,
        productName: "gấp 3 Vimatt 9F",
        size: "180x200",
        unit: "cái",
        quantity: 8,
        warehouse: "K04",
        cmQty: 72,
        cmQtyPerUnit: 9,
        note: "",
        warehouseConfirm: { value: "8" },
        leaderConfirm: { value: 8 },
      },
      {
        stt: 2,
        productName: "gấp 3 Alias 5F",
        size: "150x190",
        unit: "cái",
        quantity: 10,
        warehouse: "K03",
        cmQty: 50,
        cmQtyPerUnit: 5,
        note: "",
        warehouseConfirm: { value: "10" },
        leaderConfirm: { value: 9 },
      },
    ],
    orderDate: isoDateTime(0, "09:10"),
    vehicle: VEHICLE_MAP.get("veh-2") || null,
    createdBy: MOCK_STAFF[1],
    createdAt: isoDateTime(0, "09:10"),
    updatedAt: isoDateTime(0, "09:35"),
  },
  {
    _id: "ord-202",
    customer: {
      name: "Showroom Hạ Long Home",
      customerCode: "KH00455",
      address: "18 Trần Hưng Đạo, Hạ Long, Quảng Ninh",
      phone: "0979 114 882",
      note: "Giao nhà xe Hồng Gai nếu quá 17h",
    },
    items: [
      {
        stt: 1,
        productName: "Đệm thẳng không chần Alias 14F",
        size: "160x200",
        unit: "cái",
        quantity: 6,
        warehouse: "K02",
        cmQty: 84,
        cmQtyPerUnit: 14,
        note: "Tem mới 2026",
        warehouseConfirm: { value: "6" },
        leaderConfirm: { value: 6 },
      },
      {
        stt: 2,
        productName: "Bộ ga chun cotton cao cấp",
        size: "160x200",
        unit: "bộ",
        quantity: 15,
        warehouse: "K01",
        cmQty: 15,
        cmQtyPerUnit: 1,
        note: "Đủ 3 màu mẫu",
        warehouseConfirm: { value: "" },
        leaderConfirm: {},
      },
    ],
    orderDate: isoDateTime(0, "09:25"),
    vehicle: VEHICLE_MAP.get("veh-2") || null,
    createdBy: MOCK_STAFF[1],
    createdAt: isoDateTime(0, "09:25"),
    updatedAt: isoDateTime(0, "09:25"),
  },
  {
    _id: "ord-301",
    customer: {
      name: "Tổng kho Thành Đạt Từ Sơn",
      customerCode: "KH00501",
      address: "KCN Đại Đồng, Từ Sơn, Bắc Ninh",
      phone: "0963 778 210",
      note: "",
    },
    items: [
      {
        stt: 1,
        productName: "gấp 3 Alias 9F",
        size: "160x200",
        unit: "cái",
        quantity: 12,
        warehouse: "K04",
        cmQty: 108,
        cmQtyPerUnit: 9,
        note: "",
        warehouseConfirm: { value: "12" },
        leaderConfirm: { value: 12 },
      },
      {
        stt: 2,
        productName: "gấp 3 Vimatt 7F",
        size: "180x200",
        unit: "cái",
        quantity: 6,
        warehouse: "K04",
        cmQty: 42,
        cmQtyPerUnit: 7,
        note: "",
        warehouseConfirm: { value: "6" },
        leaderConfirm: { value: 6 },
      },
    ],
    orderDate: isoDateTime(0, "11:20"),
    vehicle: VEHICLE_MAP.get("veh-3") || null,
    createdBy: MOCK_STAFF[0],
    createdAt: isoDateTime(0, "11:20"),
    updatedAt: isoDateTime(0, "13:15"),
  },
  {
    _id: "ord-401",
    customer: {
      name: "Nhà phân phối Miền Trung - Vinh",
      customerCode: "KH00612",
      address: "74 Lê Lợi, TP. Vinh, Nghệ An",
      phone: "0945 901 334",
      note: "Xếp hàng cuối xe để hạ ở Vinh",
    },
    items: [
      {
        stt: 1,
        productName: "Đệm thẳng không chần See 14F",
        size: "180x200",
        unit: "cái",
        quantity: 10,
        warehouse: "K02",
        cmQty: 140,
        cmQtyPerUnit: 14,
        note: "",
        warehouseConfirm: { value: "" },
        leaderConfirm: {},
      },
      {
        stt: 2,
        productName: "gấp 3 Fly 9F",
        size: "160x200",
        unit: "cái",
        quantity: 14,
        warehouse: "K04",
        cmQty: 126,
        cmQtyPerUnit: 9,
        note: "",
        warehouseConfirm: { value: "14" },
        leaderConfirm: {},
      },
    ],
    orderDate: isoDateTime(0, "14:05"),
    vehicle: VEHICLE_MAP.get("veh-4") || null,
    createdBy: MOCK_STAFF[2],
    createdAt: isoDateTime(0, "14:05"),
    updatedAt: isoDateTime(0, "14:05"),
  },
  {
    _id: "ord-501",
    customer: {
      name: "Cửa hàng Hương Lan Thái Nguyên",
      customerCode: "KH00718",
      address: "305 Lương Ngọc Quyến, TP. Thái Nguyên",
      phone: "0915 442 689",
      note: "",
    },
    items: [
      {
        stt: 1,
        productName: "gấp 3 Alias 7F",
        size: "160x200",
        unit: "cái",
        quantity: 8,
        warehouse: "K04",
        cmQty: 56,
        cmQtyPerUnit: 7,
        note: "",
        warehouseConfirm: { value: "8" },
        leaderConfirm: { value: 8 },
      },
    ],
    orderDate: isoDateTime(-1, "08:30"),
    vehicle: VEHICLE_MAP.get("veh-5") || null,
    createdBy: MOCK_STAFF[1],
    createdAt: isoDateTime(-1, "08:30"),
    updatedAt: isoDateTime(-1, "10:15"),
  },
  {
    _id: "ord-601",
    customer: {
      name: "Kho chi nhánh Sài Gòn",
      customerCode: "KH00880",
      address: "KCN Tân Bình, TP. Hồ Chí Minh",
      phone: "0908 991 772",
      note: "Chuyển hàng theo bảng kê tổng",
    },
    items: [
      {
        stt: 1,
        productName: "Đệm thẳng không chần Rex 18F",
        size: "180x200",
        unit: "cái",
        quantity: 12,
        warehouse: "K02",
        cmQty: 216,
        cmQtyPerUnit: 18,
        note: "Đóng đai chắc chắn",
        warehouseConfirm: { value: "12" },
        leaderConfirm: { value: 12 },
      },
      {
        stt: 2,
        productName: "gấp 3 Vimatt 9F",
        size: "160x200",
        unit: "cái",
        quantity: 20,
        warehouse: "K03",
        cmQty: 180,
        cmQtyPerUnit: 9,
        note: "",
        warehouseConfirm: { value: "20" },
        leaderConfirm: { value: 20 },
      },
    ],
    orderDate: isoDateTime(-1, "14:40"),
    vehicle: VEHICLE_MAP.get("veh-6") || null,
    createdBy: MOCK_STAFF[2],
    createdAt: isoDateTime(-1, "14:40"),
    updatedAt: isoDateTime(-1, "15:50"),
  },
];

function getOrderVehicleId(order: VehicleOrder): string | null {
  if (!order.vehicle) return null;
  return typeof order.vehicle === "string" ? order.vehicle : order.vehicle._id;
}

function toYmd(dateStr: string): string {
  return (dateStr || "").slice(0, 10);
}

/**
 * TODO: Khi kết nối Database / Backend API, chỉ cần thay thế phần thân
 * 3 hàm bên dưới bằng lời gọi `fetch("/api/...")` tương ứng.
 */
export const vehicleOrdersService: VehicleOrdersDataSource = {
  async getVehicles(query: VehicleListQuery = {}): Promise<VehicleListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);

    const filtered = MOCK_VEHICLES.filter((v) => {
      const ymd = toYmd(v.vehicleDate);
      if (query.fromDate && ymd < query.fromDate) return false;
      if (query.toDate && ymd > query.toDate) return false;
      if (query.creator && v.createdBy?._id !== query.creator) return false;
      return true;
    }).map((v) => ({
      ...v,
      orderCount: MOCK_ORDERS.filter((o) => getOrderVehicleId(o) === v._id).length,
    }));

    const totalVehicles = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalVehicles / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const vehicles = filtered.slice(start, start + limit);

    return {
      vehicles,
      currentPage: safePage,
      totalPages,
      totalVehicles,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    };
  },

  async getOrdersByVehicle(vehicleId: string): Promise<VehicleOrder[]> {
    const matched = MOCK_ORDERS.filter(
      (order) => getOrderVehicleId(order) === vehicleId,
    );
    return sortOrdersByCustomer(matched);
  },

  async getStaffList(): Promise<VehicleOrderStaff[]> {
    return [...MOCK_STAFF];
  },
};
