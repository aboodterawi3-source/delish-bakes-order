/**
 * Printable Thermal Receipt & Kitchen Slip Component
 * Powered by react-to-print (https://github.com/MatthewHerbst/react-to-print)
 * Designed for 80mm / 58mm POS thermal printers and kitchen dispatch slips.
 */

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptData {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  method: "pickup" | "delivery";
  deliveryAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  depositPaid: number;
  refundDue?: number;
  remaining?: number;
  inscription?: string;
  notes?: string;
}

interface PrintableReceiptProps {
  receipt: ReceiptData;
  buttonLabel?: string;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  receipt,
  buttonLabel = "طباعة الفاتورة",
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Receipt-${receipt.orderNumber}`,
  });

  return (
    <div className="flex flex-col items-center">
      {/* Hidden Thermal Print Template (rendered only on print trigger) */}
      <div className="hidden">
        <div
          ref={contentRef}
          className="p-4 bg-white text-black font-mono text-xs w-[80mm] leading-tight"
          style={{ width: "80mm" }}
          dir="rtl"
        >
          {/* Header */}
          <div className="text-center border-b pb-2 mb-2">
            <h1 className="text-base font-bold">ديليش آند بيك</h1>
            <p className="text-[10px] text-gray-600">Delish Cake & Bake — Amman</p>
            <p className="text-[10px]">هاتف: 0790000000</p>
            <p className="text-[10px] text-gray-500 mt-1">{receipt.createdAt}</p>
          </div>

          {/* Order Details */}
          <div className="border-b pb-2 mb-2">
            <p>
              <strong>رقم الطلب:</strong> {receipt.orderNumber}
            </p>
            <p>
              <strong>الزبون:</strong> {receipt.customerName}
            </p>
            <p>
              <strong>الهاتف:</strong> {receipt.customerPhone}
            </p>
            <p>
              <strong>الاستلام:</strong>{" "}
              {receipt.method === "delivery" ? "توصيل" : "استلام من الفرع"}
            </p>
            {receipt.deliveryAddress && (
              <p>
                <strong>العنوان:</strong> {receipt.deliveryAddress}
              </p>
            )}
          </div>

          {/* Items */}
          <table className="w-full text-right border-b pb-2 mb-2">
            <thead>
              <tr className="border-b">
                <th className="py-1">الصنف</th>
                <th className="py-1 text-center">الكمية</th>
                <th className="py-1 text-left">السعر</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1">{item.name}</td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-left">{item.totalPrice.toFixed(2)} د.أ</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Breakdown */}
          <div className="space-y-1 border-b pb-2 mb-2 text-[11px]">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span>{receipt.subtotal.toFixed(2)} د.أ</span>
            </div>
            {Boolean(receipt.deliveryFee) && (
              <div className="flex justify-between">
                <span>أجور التوصيل:</span>
                <span>{(receipt.deliveryFee || 0).toFixed(2)} د.أ</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t">
              <span>الإجمالي الكلي:</span>
              <span>{receipt.total.toFixed(2)} د.أ</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>المبلغ المدفوع:</span>
              <span>{receipt.depositPaid.toFixed(2)} د.أ</span>
            </div>
            {Boolean(receipt.refundDue && receipt.refundDue > 0) ? (
              <div className="flex justify-between font-bold text-red-600 bg-red-50 p-1 rounded">
                <span>مسترجع للزبون (زيادة):</span>
                <span>{receipt.refundDue?.toFixed(2)} د.أ</span>
              </div>
            ) : (
              <div className="flex justify-between text-gray-700">
                <span>المتبقي للدفع:</span>
                <span>{(receipt.remaining || 0).toFixed(2)} د.أ</span>
              </div>
            )}
          </div>

          {/* Notes & Inscriptions */}
          {receipt.inscription && (
            <div className="border-b pb-2 mb-2">
              <p className="font-bold">الكتابة على الكيكة:</p>
              <p className="italic bg-gray-50 p-1">"{receipt.inscription}"</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-2 text-[10px] text-gray-500">
            <p>شكراً لطلبكم من ديليش آند بيك! 🎂</p>
            <p>نتمنى لكم مناسبة سعيدة</p>
          </div>
        </div>
      </div>

      {/* Trigger Button */}
      <button
        onClick={() => handlePrint()}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-all text-sm"
      >
        <Printer className="w-4 h-4" />
        {buttonLabel}
      </button>
    </div>
  );
};
