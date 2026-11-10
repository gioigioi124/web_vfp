import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { formatCurrency, formatQuantity, formatDate } from "../lib/format";
import { Printer } from "lucide-react";

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  stt: string;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  isOpen,
  onClose,
  stt,
}) => {
  const [printData, setPrintData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !stt) return;
    const fetchPrint = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/print/${encodeURIComponent(stt)}?loai=hd`,
        );
        const json = await res.json();
        if (json.success) {
          setPrintData(json.data);
        }
      } catch (e) {
        console.error("Error fetching print payload", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrint();
  }, [isOpen, stt]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const header = printData?.header || {};
  const items = printData?.items || [];
  const vat = printData?.vat_breakdown || {};
  const currency = header.ma_tte || "VND";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Xem Trước Khi In (F7 / In_Ct_Hd)"
      width="max-w-4xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Đóng (Esc)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            type="button"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            In ngay (F7)
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          Đang chuẩn bị mẫu in...
        </div>
      ) : (
        <div className="print-area bg-white p-6 border border-slate-300 rounded shadow-sm text-slate-900 select-text font-serif print:border-none print:shadow-none print:p-0">
          {/* Company Header */}
          <div className="flex justify-between items-start pb-4 border-b border-slate-300 mb-4">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                CÔNG TY CỔ PHẦN MÚT XỐP SÀI GÒN
              </h2>
              <p className="text-xs text-slate-600">
                128 Đường số 7, KCN Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP.HCM
              </p>
              <p className="text-xs text-slate-600">
                MST: 0301234567 | ĐT: (028) 3815 1234
              </p>
            </div>
            <div className="text-right text-xs font-mono">
              <p>
                Mẫu số: <strong>01GTKT0/001</strong>
              </p>
              <p>
                Ký hiệu: <strong>1S/26P</strong>
              </p>
              <p className="text-sm font-bold text-primary-800">
                Số: {header.so_ct || "—"}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h1 className="text-lg font-bold uppercase text-slate-900 tracking-wide">
              {printData?.title || "HÓA ĐƠN BÁN HÀNG KIÊM PHIẾU XUẤT KHO"}
            </h1>
            <p className="text-xs italic text-slate-600">
              {printData?.formal_date || formatDate(header.ngay_ct)}
            </p>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-4">
            <div>
              <span className="font-semibold text-slate-700">
                Đơn vị mua hàng:
              </span>{" "}
              <strong className="text-slate-900">
                {header.ten_dtgtgt || header.ten_dt || header.ma_dt}
              </strong>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Mã số thuế:</span>{" "}
              <span className="font-mono">{header.ma_dtgtgt || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">
                Người mua hàng:
              </span>{" "}
              <span>{header.ong_ba || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">
                Hình thức thanh toán:
              </span>{" "}
              TM / CK
            </div>
            <div className="col-span-2">
              <span className="font-semibold text-slate-700">Địa chỉ:</span>{" "}
              <span>{header.dia_chi || "—"}</span>
            </div>
            <div className="col-span-2">
              <span className="font-semibold text-slate-700">Diễn giải:</span>{" "}
              <span className="italic">{header.dien_giai0 || "—"}</span>
            </div>
          </div>

          {/* Detail Table */}
          <table className="w-full border-collapse border border-slate-400 text-xs my-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 w-8 text-center">
                  STT
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-20 text-center">
                  Mã VT
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Tên hàng hóa, dịch vụ
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-12 text-center">
                  ĐVT
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-14 text-right">
                  Số tấm
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-12 text-right">
                  Hệ số
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-16 text-right">
                  Số lượng
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-20 text-right">
                  Đơn giá
                </th>
                <th className="border border-slate-400 px-2 py-1.5 w-24 text-right">
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-slate-400 px-2 py-1 text-center font-mono">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 font-mono">
                    {it.ma_vt}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 font-medium">
                    {it.ten_vt}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-center">
                    {it.dvt_ban || it.dvt}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono">
                    {formatQuantity(it.so_tam)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono">
                    {formatQuantity(it.he_so8)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono font-semibold">
                    {formatQuantity(it.so_luong9)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono">
                    {formatCurrency(it.gia_nt9, currency)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono font-semibold">
                    {formatCurrency(it.tien_nt9, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={8}
                  className="border border-slate-400 px-2 py-1 text-right font-semibold"
                >
                  Cộng tiền hàng:
                </td>
                <td className="border border-slate-400 px-2 py-1 text-right font-mono font-bold">
                  {/* Tiền hàng trước CK = TTien_Nt2 (sau CK) + TTien_Nt4 (CK).
                      KHÔNG dùng TTien_Nt vì đây là cột GIÁ VỐN (COGS), luôn NULL khi lưu. */}
                  {formatCurrency(
                    (header.ttien_nt2 || 0) + (header.ttien_nt4 || 0),
                    currency,
                  )}
                </td>
              </tr>
              {header.ttien_nt4 > 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="border border-slate-400 px-2 py-1 text-right font-semibold text-amber-700"
                  >
                    Tiền chiết khấu thương mại:
                  </td>
                  <td className="border border-slate-400 px-2 py-1 text-right font-mono font-bold text-amber-700">
                    -{formatCurrency(header.ttien_nt4, currency)}
                  </td>
                </tr>
              )}
              <tr>
                <td
                  colSpan={8}
                  className="border border-slate-400 px-2 py-1 text-right font-semibold"
                >
                  Tiền thuế GTGT ({vat.thue_suat || 0}%):
                </td>
                <td className="border border-slate-400 px-2 py-1 text-right font-mono font-bold">
                  {formatCurrency(vat.tien_thue, currency)}
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold text-sm">
                <td
                  colSpan={8}
                  className="border border-slate-400 px-2 py-1.5 text-right uppercase"
                >
                  Tổng cộng tiền thanh toán:
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono text-emerald-800">
                  {formatCurrency(header.ttien_nt0, currency)} {currency}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Amount in words */}
          <div className="text-xs my-3 italic">
            <span className="font-semibold not-italic">
              Số tiền viết bằng chữ:
            </span>{" "}
            <strong className="text-slate-900">
              {printData?.tong_tien_chu}
            </strong>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-4 text-center text-xs mt-8 pt-4">
            <div>
              <p className="font-bold">Người mua hàng</p>
              <p className="italic text-[11px] text-slate-500">
                (Ký, ghi rõ họ tên)
              </p>
            </div>
            <div>
              <p className="font-bold">Người giao hàng</p>
              <p className="italic text-[11px] text-slate-500">
                (Ký, ghi rõ họ tên)
              </p>
            </div>
            <div>
              <p className="font-bold">Thủ kho</p>
              <p className="italic text-[11px] text-slate-500">
                (Ký, ghi rõ họ tên)
              </p>
            </div>
            <div>
              <p className="font-bold">Kế toán trưởng / Giám đốc</p>
              <p className="italic text-[11px] text-slate-500">
                (Ký, đóng dấu)
              </p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};
