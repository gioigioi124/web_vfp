import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Layers } from "lucide-react";
import { ALL_NAV_ITEMS } from "../../config/accountingModules";
import { ModuleIcon } from "./ModuleIcon";

export const ComingSoonPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const mod = ALL_NAV_ITEMS.find((it) => it.id === moduleId);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface p-6 text-center">
      <div className="max-w-md w-full bg-white border border-neutral-300 rounded-lg shadow-sm p-6 space-y-4">
        <div className="mx-auto w-12 h-12 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 flex items-center justify-center">
          {mod ? (
            <ModuleIcon name={mod.iconName} className="w-6 h-6" />
          ) : (
            <Layers className="w-6 h-6" />
          )}
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2">
            {mod && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-700">
                {mod.shortCode}
              </span>
            )}
            <h1 className="text-base font-bold text-neutral-900">
              {mod?.label || "Phần hành kế toán"}
            </h1>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed pt-1">
            Phần hành này đang nằm trong lộ trình triển khai tiếp theo (hiện đã hoàn thiện{" "}
            <b>Nhóm 1: Tiền mặt & Ngân hàng</b> và <b>Nhóm 2: Bán hàng & Kho</b>).
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate("/cash/receipts")}
            className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
          >
            Mở Phiếu thu (PT)
          </button>
          <button
            type="button"
            onClick={() => navigate("/sales-invoices")}
            className="px-3 py-1.5 rounded bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về Bán hàng (X1)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
