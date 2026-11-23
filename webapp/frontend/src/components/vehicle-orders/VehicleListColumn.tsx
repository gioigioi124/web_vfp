import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { Button } from "../ui/Button";
import { VehicleOrderVehicle } from "../../types/vehicleOrders";
import { vehicleOrdersService } from "../../services/vehicleOrdersService";
import { formatDateVi } from "./sortItems";

interface VehicleListColumnProps {
  selectedVehicle: VehicleOrderVehicle | null;
  onSelectVehicle: (vehicle: VehicleOrderVehicle | null) => void;
  fromDate: string;
  toDate: string;
  creator: string;
  refreshTrigger: number;
}

const ITEMS_PER_PAGE = 10;

export const VehicleListColumn: React.FC<VehicleListColumnProps> = ({
  selectedVehicle,
  onSelectVehicle,
  fromDate,
  toDate,
  creator,
  refreshTrigger,
}) => {
  const [vehicles, setVehicles] = useState<VehicleOrderVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  const lastFetchIdRef = useRef(0);

  // Reset về trang 1 khi bộ lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, creator]);

  useEffect(() => {
    const fetchVehicles = async () => {
      const fetchId = ++lastFetchIdRef.current;
      try {
        setLoading(true);
        const data = await vehicleOrdersService.getVehicles({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          creator: creator || undefined,
        });

        if (fetchId !== lastFetchIdRef.current) return;

        setVehicles(data.vehicles);
        setCurrentPage(data.currentPage);
        setTotalPages(data.totalPages);
        setTotalVehicles(data.totalVehicles);
        setHasNextPage(data.hasNextPage);
        setHasPrevPage(data.hasPrevPage);
        setError(null);
      } catch {
        if (fetchId !== lastFetchIdRef.current) return;
        setError("Không thể tải danh sách xe");
      } finally {
        if (fetchId === lastFetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    void fetchVehicles();
  }, [fromDate, toDate, creator, currentPage, refreshTrigger]);

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
      {/* Header cột + phân trang */}
      <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-primary-700" />
          <span>Xe hàng</span>
        </h2>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-400" />
            Đã in
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-500" />
            Xong
          </span>
        </div>
      </div>

      {/* Pagination Controls (top, giống elanX) */}
      <div className="mb-3 flex items-center justify-between gap-1 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={!hasPrevPage}
          className="gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Trước
        </Button>

        <div className="text-xs text-gray-600 text-center">
          <span className="font-semibold text-sm text-gray-800">
            Trang {currentPage} / {totalPages}
          </span>
          <span className="text-gray-400 ml-1.5">({totalVehicles} xe)</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => prev + 1)}
          disabled={!hasNextPage}
          className="gap-1"
        >
          Sau
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Danh sách xe */}
      {vehicles.length === 0 ? (
        <div className="text-gray-500 text-center py-8 text-sm">
          <Truck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Chưa có xe nào</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
          {vehicles.map((vehicle) => {
            const isSelected = selectedVehicle?._id === vehicle._id;

            const borderClass = isSelected
              ? "border-blue-600 ring-2 ring-blue-600/30"
              : vehicle.isCompleted
                ? "border-green-500"
                : vehicle.isPrinted
                  ? "border-yellow-400"
                  : "border-gray-200";

            const bgClass = vehicle.isCompleted
              ? "bg-green-100"
              : vehicle.isPrinted
                ? "bg-yellow-100"
                : isSelected
                  ? "bg-blue-50"
                  : "bg-white hover:bg-gray-50";

            return (
              <div
                key={vehicle._id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectVehicle(vehicle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectVehicle(vehicle);
                  }
                }}
                className={`relative p-3 border rounded-md transition-colors cursor-pointer select-none ${borderClass} ${bgClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-gray-800 leading-snug">
                    {vehicle.weight} - {vehicle.time} - {vehicle.destination}
                  </div>
                  {typeof vehicle.orderCount === "number" && (
                    <span className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white/80 text-gray-700 border border-gray-300/70">
                      {vehicle.orderCount} đơn
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-1 italic">
                  {formatDateVi(vehicle.vehicleDate)}
                  {vehicle.note ? ` - ${vehicle.note}` : ""}
                  {vehicle.createdBy?.name && (
                    <span className="ml-2 text-green-700 font-medium not-italic">
                      • {vehicle.createdBy.name}
                    </span>
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
