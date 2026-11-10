import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { DebtSummary, DebtTransactionItem } from "../types/debt";
import { formatCurrency, formatDate } from "../lib/format";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface DebtPanelProps {
  isOpen: boolean;
  onClose: () => void;
  maDt: string;
}

export const DebtPanel: React.FC<DebtPanelProps> = ({
  isOpen,
  onClose,
  maDt,
}) => {
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [transactions, setTransactions] = useState<DebtTransactionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDebt = async () => {
    if (!maDt) return;
    setLoading(true);
    try {
      const summaryRes = await fetch(
        `/api/debt/customer?ma_dt=${encodeURIComponent(maDt)}`,
      );
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setDebt(summaryData.data);
      }
    } catch (e) {
      console.error("Error fetching debt summary", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && maDt) {
      fetchDebt();
    }
  }, [isOpen, maDt]);

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Tra Cứu Dư Nợ Khách Hàng Realtime (TK 131)"
      width="max-w-3xl"
      footer={
        <Button variant="outline" size="sm" onClick={onClose} type="button">
          Đóng (Esc)
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Header Summary Box */}
        <div className="bg-neutral-50 border border-neutral-300 rounded p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">
                {maDt}
              </span>
              <h3 className="font-bold text-sm text-neutral-900">
                {debt?.ten_dt || "Khách hàng"}
              </h3>
            </div>
            <p className="text-neutral-500 mt-1">
              Theo dõi tài khoản công nợ: {debt?.tk || "131"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {debt?.is_over_limit ? (
              <Badge
                variant="danger"
                className="text-xs py-1 px-2.5 flex items-center gap-1 font-bold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Quá giới hạn nợ!
              </Badge>
            ) : debt?.is_near_limit ? (
              <Badge
                variant="warning"
                className="text-xs py-1 px-2.5 flex items-center gap-1 font-bold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Đến hạn mức thanh toán!
              </Badge>
            ) : (
              <Badge
                variant="success"
                className="text-xs py-1 px-2.5 flex items-center gap-1 font-bold"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Trong hạn mức an toàn
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDebt}
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Debt Figures Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-neutral-200 rounded p-3 text-center">
            <span className="text-neutral-500 block text-[11px]">
              Tổng phát sinh nợ
            </span>
            <span className="font-bold font-mono text-neutral-800 text-sm">
              {formatCurrency(debt?.du_no, "VND")} đ
            </span>
          </div>

          <div className="bg-white border border-neutral-200 rounded p-3 text-center">
            <span className="text-neutral-500 block text-[11px]">
              Đã thanh toán (Có)
            </span>
            <span className="font-bold font-mono text-success-700 text-sm">
              {formatCurrency(debt?.du_co, "VND")} đ
            </span>
          </div>

          <div className="bg-white border border-neutral-200 rounded p-3 text-center">
            <span className="text-neutral-500 block text-[11px]">
              Dư nợ hiện tại
            </span>
            <span
              className={`font-bold font-mono text-base ${
                debt?.is_over_limit
                  ? "text-danger-600 font-extrabold"
                  : "text-primary-700"
              }`}
            >
              {formatCurrency(debt?.du_cuoi, "VND")} đ
            </span>
          </div>

          <div className="bg-white border border-neutral-200 rounded p-3 text-center">
            <span className="text-neutral-500 block text-[11px]">
              Hạn mức tín dụng
            </span>
            <span className="font-bold font-mono text-neutral-700 text-sm">
              {debt?.gioi_han
                ? `${formatCurrency(debt.gioi_han, "VND")} đ`
                : "Không giới hạn"}
            </span>
          </div>
        </div>

        {/* Status Message */}
        <div
          className={`p-3 rounded border text-xs font-medium ${
            debt?.is_over_limit
              ? "bg-danger-50 border-danger-200 text-danger-800"
              : debt?.is_near_limit
                ? "bg-tertiary-50 border-tertiary-200 text-tertiary-800"
                : "bg-success-50 border-success-200 text-success-800"
          }`}
        >
          {debt?.status_message}
        </div>
      </div>
    </Dialog>
  );
};
