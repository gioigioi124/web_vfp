import React, { useEffect, useState } from "react";
import { Eye, RotateCcw, Search, Truck } from "lucide-react";
import { Button } from "../ui/Button";
import {
  VehicleOrder,
  VehicleOrderStaff,
  VehicleOrderVehicle,
} from "../../types/vehicleOrders";
import { vehicleOrdersService } from "../../services/vehicleOrdersService";
import { VehicleListColumn } from "./VehicleListColumn";
import { VehicleOrderListColumn } from "./VehicleOrderListColumn";
import { OrderDetailColumn } from "./OrderDetailColumn";
import { getTodayIsoDate } from "./sortItems";

export const VehicleOrdersPage: React.FC = () => {
  const today = getTodayIsoDate();

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleOrderVehicle | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<VehicleOrder | null>(null);

  const [staffList, setStaffList] = useState<VehicleOrderStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("all");

  // Input state cho DateRangeSearch
  const [fromDateInput, setFromDateInput] = useState<string>(today);
  const [toDateInput, setToDateInput] = useState<string>(today);

  // Active filter đã áp dụng
  const [dateRange, setDateRange] = useState<{
    fromDate: string;
    toDate: string;
  }>({
    fromDate: today,
    toDate: today,
  });

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const fetchStaff = async () => {
      try {
        const list = await vehicleOrdersService.getStaffList();
        if (active) setStaffList(list);
      } catch {
        if (active) setStaffList([]);
      }
    };
    void fetchStaff();
    return () => {
      active = false;
    };
  }, []);

  // Reset đơn hàng đang chọn khi đổi xe
  useEffect(() => {
    setSelectedOrder(null);
  }, [selectedVehicle?._id]);

  // Reset xe & đơn đang chọn khi đổi bộ lọc
  useEffect(() => {
    setSelectedVehicle(null);
    setSelectedOrder(null);
  }, [selectedStaff, dateRange.fromDate, dateRange.toDate]);

  const handleDateSearch = () => {
    let nextFrom = fromDateInput;
    let nextTo = toDateInput;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      nextTo = nextFrom;
      setToDateInput(nextFrom);
    }
    setDateRange({ fromDate: nextFrom, toDate: nextTo });
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleViewAllDates = () => {
    setFromDateInput("");
    setToDateInput("");
    setDateRange({ fromDate: "", toDate: "" });
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleResetToday = () => {
    const t = getTodayIsoDate();
    setFromDateInput(t);
    setToDateInput(t);
    setSelectedStaff("all");
    setDateRange({ fromDate: t, toDate: t });
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleDateSearch();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto lg:overflow-hidden bg-surface p-2 md:p-4">
      {/* Header + Bộ lọc (chỉ xem, bỏ các nút tạo/sửa/xóa của elanX) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-3 mb-3 md:mb-4 shrink-0">
        <div className="flex flex-wrap items-end gap-3 md:gap-4 w-full lg:w-auto">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-700" />
                <span>Xe hàng &amp; Đơn hàng</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                <Eye className="w-3 h-3" />
                <span>Chỉ xem · Dữ liệu mẫu</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Theo dõi danh sách xe hàng, đơn hàng theo xe và chi tiết hàng hóa (chờ kết nối CSDL)
            </p>
          </div>
        </div>

        {/* Bộ lọc ngày & người tạo (giống PageHeader + DateRangeSearch của elanX) */}
        <div className="flex flex-wrap items-end gap-2 w-full lg:w-auto">
          <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
            <label
              htmlFor="vo-from-date"
              className="text-[11px] font-medium text-gray-600"
            >
              Từ ngày
            </label>
            <input
              id="vo-from-date"
              type="date"
              value={fromDateInput}
              onChange={(e) => setFromDateInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:w-36 bg-white border border-gray-300 rounded px-2 h-8 text-xs text-gray-800 focus:outline-none focus:border-primary-600"
            />
          </div>

          <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
            <label
              htmlFor="vo-to-date"
              className="text-[11px] font-medium text-gray-600"
            >
              Đến ngày
            </label>
            <input
              id="vo-to-date"
              type="date"
              value={toDateInput}
              onChange={(e) => setToDateInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:w-36 bg-white border border-gray-300 rounded px-2 h-8 text-xs text-gray-800 focus:outline-none focus:border-primary-600"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="md"
              variant="primary"
              onClick={handleDateSearch}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Tìm</span>
            </Button>
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={handleViewAllDates}
              title="Xem tất cả các ngày"
            >
              Tất cả ngày
            </Button>
            <Button
              type="button"
              size="md"
              variant="ghost"
              onClick={handleResetToday}
              title="Quay lại hôm nay"
              className="px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Người tạo */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label
              htmlFor="vo-staff-filter"
              className="text-[11px] font-medium text-gray-600"
            >
              Người tạo
            </label>
            <select
              id="vo-staff-filter"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full sm:w-44 bg-white border border-gray-300 rounded px-2 h-8 text-xs text-gray-800 focus:outline-none focus:border-primary-600"
            >
              <option value="all">Tất cả nhân viên</option>
              {staffList.map((staff) => (
                <option key={staff._id} value={staff._id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bố cục 3 cột giống HomePage của elanX: 3 / 3 / 6 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2 md:gap-4 flex-1 min-h-0">
        {/* Cột 1: Danh sách xe hàng */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-3 md:p-4 border border-gray-200/80 overflow-y-auto max-h-[50vh] lg:max-h-none lg:h-full">
          <VehicleListColumn
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            fromDate={dateRange.fromDate}
            toDate={dateRange.toDate}
            creator={selectedStaff === "all" ? "" : selectedStaff}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Cột 2: Danh sách đơn hàng của xe */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-3 md:p-4 border border-gray-200/80 overflow-y-auto max-h-[50vh] lg:max-h-none lg:h-full">
          <VehicleOrderListColumn
            vehicle={selectedVehicle}
            selectedOrder={selectedOrder}
            onSelectOrder={setSelectedOrder}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Cột 3: Chi tiết đơn hàng */}
        <div className="md:col-span-2 lg:col-span-6 bg-white rounded-lg shadow-sm p-3 md:p-4 border border-gray-200/80 overflow-y-auto max-h-[65vh] lg:max-h-none lg:h-full">
          <OrderDetailColumn
            order={selectedOrder}
            vehicle={selectedVehicle}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};
