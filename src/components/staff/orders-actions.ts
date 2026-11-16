import { toast } from "sonner";
import { buildConfirmationMessage } from "@/lib/confirmation-message";
import { orderLabel } from "@/lib/order-label";
import { esc, printDocument } from "@/lib/print";
import { payMeta } from "@/lib/staff-orders-shared";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import type { SalesOrder, ShiftReport } from "@/lib/sales.functions";

export function formatOrderConfirmation(
  order: SalesOrder,
  totalOverride?: number,
  paidOverride?: number,
): string {
  return buildConfirmationMessage({
    orderNumber: orderLabel(order.order_number, order.staff_code),
    customerName: order.order_name?.trim() || order.customer_name,
    when: `${order.requested_date} ${order.requested_time}`.trim(),
    fulfilment:
      order.method === "delivery"
        ? `توصيل · ${order.area || "—"}${order.address ? ` — ${order.address}` : ""}`
        : "استلام من المحل",
    items: order.items.flatMap((item) => [
      `${item.quantity} × ${item.name_ar}`,
      ...item.options_ar.map((option) => `— ${option}`),
    ]),
    cakeWriting: order.inscription ?? "",
    cardWriting: order.card_note ?? "",
    extraNote: "",
    notes: order.notes ?? "",
    price: order.subtotal,
    deliveryFee: order.method === "delivery" ? order.delivery_fee : 0,
    total: totalOverride ?? order.total,
    paid: paidOverride ?? order.deposit_paid,
    paymentMethod: payMeta[order.payment_method ?? "cash"].ar,
    recipientPhone: order.recipient_phone || order.customer_phone,
    senderPhone: order.sender_phone ?? "",
  });
}

function copyTextSilently(text: string) {
  void navigator.clipboard?.writeText(text).catch((err) => {
    console.warn("[OrdersWorkspace] Clipboard copy unavailable:", err);
  });
}

export function sendScheduleConfirmation(order: SalesOrder) {
  const message = `أهلاً بك من مخبز ديلش! 🌸 تم تحديث موعد طلبك رقم ${order.order_number} بنجاح إلى ${order.requested_date} الساعة ${order.requested_time.slice(0, 5)}. يسعدنا خدمتكم دائماً!`;
  copyTextSilently(message);
  window.open(getWhatsAppChatUrl(order.customer_phone, message), "_blank", "noopener");
  toast.success("تم تجهيز رسالة التأكيد للواتساب 📲");
}

export function sendCustomerWhatsApp(order: SalesOrder) {
  const message = formatOrderConfirmation(order);
  copyTextSilently(message);
  window.open(getWhatsAppChatUrl(order.customer_phone, message), "_blank", "noopener");
  toast.success("تم فتح محادثة الواتساب مع العميل 📲");
}

export function printShiftReport(report: ShiftReport, date: string) {
  const rows = report.byMethod
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>${row.method === "unpaid" ? "بدون طريقة دفع" : payMeta[row.method].ar} (${row.orders})</span><span>${row.collected.toFixed(2)} د.أ</span></div>`,
    )
    .join("");
  const body = `<h1 style="text-align:center;font-size:20px;margin-bottom:4px;font-weight:900;">Delish Bakery • تقرير الشيفت</h1>
<div style="text-align:center;font-weight:bold;font-size:13px;margin-bottom:4px;">تاريخ الشيفت: ${esc(date)}</div>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${rows || "<div>لا توجد مدفوعات مسجلة</div>"}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;"><span>إجمالي المحصل</span><span>${report.collected.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>المتبقي على العملاء</span><span>${report.outstanding.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>عدد الطلبات المنجزة</span><span>${report.orders}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;color:red;"><span>الطلبات الملغاة</span><span>${report.cancelled}</span></div>
<div style="border-top:2px dashed #000;margin:12px 0 6px 0;"></div>
<div style="text-align:center;font-size:12px;color:#555;">توقيع واستلام الكاشير: __________________</div>`;

  printDocument(`تقرير ${date}`, body, "b{font-size:13px}");
}
