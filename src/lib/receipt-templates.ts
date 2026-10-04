/**
 * Unified thermal printing templates for Delish Bakery.
 * Designed for 80mm & 58mm thermal POS printers.
 */
import { esc, printDocument } from "@/lib/print";
import { formatJod } from "@/lib/currency";
import { formatJordanianPhone } from "@/lib/whatsapp";
import { orderLabel } from "@/lib/order-label";

export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  cash: "كاش",
  cliq: "CliQ / محفظة",
  visa: "فيزا / بطاقة",
};

export function getPaymentMethodName(method?: string | null): string {
  if (!method) return "—";
  return PAYMENT_METHOD_NAMES[method] ?? method;
}

/** Formats HH:mm to 12-hour Arabic (e.g. 11:30 ص / 02:00 م) */
export function formatTimeSlotArabic(timeStr?: string | null): string {
  if (!timeStr) return "";
  try {
    const parts = timeStr.slice(0, 5).split(":");
    const h = parseInt(parts[0] ?? "", 10);
    const m = parts[1] || "00";
    if (isNaN(h)) return timeStr.slice(0, 5);
    const period = h >= 12 ? "م" : "ص";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  } catch {
    return timeStr.slice(0, 5);
  }
}

export interface CustomerReceiptItem {
  name_ar?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  options_ar?: string[];
  options?: string[];
  notes?: string | null;
}

export interface CustomerReceiptOrder {
  order_number: string;
  staff_code?: number | null;
  order_name?: string | null;
  customer_name: string;
  customer_phone: string;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  method: "delivery" | "pickup" | string;
  area?: string | null;
  address?: string | null;
  requested_date: string;
  requested_time: string;
  inscription?: string | null;
  card_note?: string | null;
  notes?: string | null;
  subtotal: number;
  discount_amount?: number | null;
  delivery_fee?: number | null;
  total: number;
  deposit_paid?: number | null;
  payment_method?: string | null;
  items: CustomerReceiptItem[];
}

export function generateCustomerReceiptHtml(order: CustomerReceiptOrder): string {
  const remaining = Math.max(order.total - (order.deposit_paid ?? 0), 0);
  const rows =
    order.items && order.items.length
      ? order.items
          .map((item) => {
            const name = item.name_ar || item.name || "صنف";
            const options = item.options_ar || item.options || [];
            const totalLine = (item.unit_price * item.quantity).toFixed(2);
            return (
              `<tr><td style="padding:4px 0;vertical-align:top;">` +
              `<b>${item.quantity} × ${esc(name)}</b>` +
              (options.length
                ? `<br><small style="color:#555;">${esc(options.join(" · "))}</small>`
                : "") +
              (item.notes
                ? `<br><small style="color:#8b4513;">ملاحظة: ${esc(item.notes)}</small>`
                : "") +
              `<br><small style="color:#666;">${formatJod(item.unit_price)} / حبة</small></td>` +
              `<td style="text-align:left;font-weight:bold;vertical-align:top;white-space:nowrap;padding-left:2px;">${totalLine}</td></tr>`
            );
          })
          .join("")
      : `<tr><td colspan="2">لا توجد أصناف مسجلة</td></tr>`;

  const phone = formatJordanianPhone(order.customer_phone);
  const senderPhone = order.sender_phone ? formatJordanianPhone(order.sender_phone) : null;
  const recipientPhone = order.recipient_phone ? formatJordanianPhone(order.recipient_phone) : null;
  const payLabel = getPaymentMethodName(order.payment_method);
  const deliveryInfo =
    order.method === "delivery"
      ? `توصيل منازل (${esc(order.area ?? "")} ${esc(order.address ?? "")})`.trim()
      : "استلام من المحل";

  return `<h1 style="text-align:center;font-size:20px;margin-bottom:4px;font-weight:900;">Delish Cake &amp; Bake</h1>
<div style="text-align:center;font-size:12px;color:#555;">عمان – الأردن · 0779179995</div>
<div style="text-align:center;font-weight:bold;margin:8px 0;border-bottom:2px dashed #000;padding-bottom:4px;">إيصال العميل · CUSTOMER RECEIPT</div>
<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-bottom:4px;">
  <span>${esc(orderLabel(order.order_number, order.staff_code))}</span>
  <span>${esc(order.requested_date)} ${esc(order.requested_time.slice(0, 5))}</span>
</div>
${order.order_name ? `<div style="font-size:13px;margin-bottom:3px;"><b>الطلب:</b> ${esc(order.order_name)}</div>` : ""}
<div style="font-size:13px;margin-bottom:3px;"><b>العميل:</b> ${esc(order.customer_name)} (${esc(phone)})</div>
${senderPhone ? `<div style="font-size:12px;margin-bottom:2px;"><b>المرسل:</b> ${esc(senderPhone)}</div>` : ""}
${recipientPhone ? `<div style="font-size:12px;margin-bottom:2px;"><b>المستلم:</b> ${esc(recipientPhone)}</div>` : ""}
<div style="font-size:13px;margin-bottom:6px;"><b>طريقة الاستلام:</b> ${deliveryInfo}</div>
${order.inscription ? `<div style="background:#fff9e6;padding:6px;border:1px solid #d4a373;border-radius:4px;margin:6px 0;font-size:14px;font-weight:bold;">✍️ الكتابة على الكيك: ${esc(order.inscription)}</div>` : ""}
${order.card_note ? `<div style="font-size:12px;margin:4px 0;"><b>نص الكرت:</b> ${esc(order.card_note)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<table style="width:100%;font-size:13px;border-collapse:collapse;">${rows}</table>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>المجموع الفرعي</span><span>${formatJod(order.subtotal)}</span></div>
${order.discount_amount ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:red;"><span>الخصم</span><span>-${formatJod(order.discount_amount)}</span></div>` : ""}
${order.delivery_fee ? `<div style="display:flex;justify-content:space-between;font-size:13px;"><span>التوصيل</span><span>${formatJod(order.delivery_fee)}</span></div>` : ""}
<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px;"><b>الإجمالي</b><b>${formatJod(order.total)}</b></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>المدفوع</span><span>${formatJod(order.deposit_paid ?? 0)}</span></div>
<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;color:${remaining > 0 ? "red" : "green"};"><span>المتبقي</span><span>${formatJod(remaining)}</span></div>
<div style="font-size:12px;margin-top:4px;">طريقة الدفع: ${esc(payLabel)}</div>
${order.notes ? `<div style="border-top:1px dashed #ccc;margin-top:6px;padding-top:4px;font-size:12px;">ملاحظات: ${esc(order.notes)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:8px 0;"></div>
<div style="text-align:center;font-size:12px;font-weight:bold;">شكراً لاختياركم ديليش 🤍</div>`;
}

export function printCustomerReceipt(order: CustomerReceiptOrder): boolean {
  const title = `إيصال ${order.order_number}`;
  const html = generateCustomerReceiptHtml(order);
  return printDocument(title, html, "b{font-size:13px}");
}

export interface KitchenTicketItem {
  name_ar?: string;
  name?: string;
  quantity: number;
  options_ar?: string[];
  options?: string[];
  notes?: string | null;
}

export interface KitchenTicketOrder {
  order_number?: string | null;
  staff_code?: number | null;
  order_name?: string | null;
  customer_name?: string | null;
  method?: "delivery" | "pickup" | "quick" | string | null;
  area?: string | null;
  address?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  inscription?: string | null;
  notes?: string | null;
  staff_notes?: string | null;
  schedule_updated_at?: string | null;
  is_quick?: boolean;
  items: KitchenTicketItem[];
}

export function generateKitchenTicketHtml(order: KitchenTicketOrder): string {
  const lines =
    order.items && order.items.length
      ? order.items
          .map((item) => {
            const name = item.name_ar || item.name || "صنف";
            const options = item.options_ar || item.options || [];
            return (
              `<div class="item" style="padding:4px 0;border-bottom:1px dashed #bbb;">` +
              `<b style="font-size:17px;">${item.quantity} × ${esc(name)}</b>` +
              (options.length
                ? `<div class="opt" style="font-size:13px;color:#222;font-weight:bold;margin-top:2px;">${options.map((o) => `• ${esc(o)}`).join("<br>")}</div>`
                : "") +
              (item.notes
                ? `<div class="note" style="font-size:13px;color:#8b4513;font-weight:bold;margin-top:2px;">ملاحظة: ${esc(item.notes)}</div>`
                : "") +
              `</div>`
            );
          })
          .join("")
      : `<div class="item">لا توجد أصناف مسجلة</div>`;

  const orderTitle = order.order_number
    ? orderLabel(order.order_number, order.staff_code)
    : order.is_quick
      ? "كاشير محلي فوري"
      : "طلب جديد";

  const methodBadge =
    order.method === "delivery"
      ? "توصيل 🛵"
      : order.is_quick
        ? "محلي فوري 🏪"
        : "استلام 🏪";

  const formattedTime = order.requested_time
    ? formatTimeSlotArabic(order.requested_time)
    : "";

  return `<h1 style="text-align:center;font-size:22px;margin-bottom:6px;font-weight:900;">Delish Bakery • تذكرة المطبخ</h1>
<div style="font-size:17px;font-weight:bold;display:flex;justify-content:space-between;margin-bottom:6px;border-bottom:2px dashed #000;padding-bottom:4px;">
  <span>${esc(orderTitle)}</span>
  <span>${methodBadge}</span>
</div>
<div style="font-size:15px;font-weight:bold;margin-bottom:6px;"><b>الموعد المطلوب:</b> ${esc(order.requested_date ?? "")}${formattedTime ? ` | ${esc(formattedTime)}` : ""}</div>
${order.customer_name ? `<div style="font-size:14px;margin-bottom:4px;"><b>العميل:</b> ${esc(order.customer_name)}</div>` : ""}
${order.order_name ? `<div style="font-size:13px;margin-bottom:4px;"><b>اسم الطلب:</b> ${esc(order.order_name)}</div>` : ""}
${order.method === "delivery" && (order.area || order.address) ? `<div style="font-size:13px;margin-bottom:4px;"><b>المنطقة:</b> ${esc(order.area ?? "")} ${esc(order.address ?? "")}</div>` : ""}
${order.schedule_updated_at ? `<div style="color:red;font-weight:bold;margin-bottom:4px;">⚠️ تنبيه: تم تعديل موعد الطلب مسبقاً</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${lines}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${order.inscription ? `<div style="background:#FFF3CD;padding:8px;border:2px solid #000;border-radius:6px;margin:8px 0;font-size:16px;font-weight:bold;">✍️ الكتابة على الكيك:<br><span style="font-size:18px;">${esc(order.inscription)}</span></div>` : ""}
${order.notes ? `<div style="margin-top:6px;font-size:13px;background:#f5f5f5;padding:6px;border-radius:4px;"><b>ملاحظات:</b> ${esc(order.notes)}</div>` : ""}
${order.staff_notes ? `<div style="margin-top:6px;font-size:13px;background:#fdf2e9;padding:6px;border-radius:4px;color:#7c2d12;"><b>ملاحظات الفريق:</b> ${esc(order.staff_notes)}</div>` : ""}`;
}

export function printKitchenTicket(order: KitchenTicketOrder): boolean {
  const title = order.order_number ? `تذكرة مطبخ ${order.order_number}` : "بون المطبخ";
  const html = generateKitchenTicketHtml(order);
  return printDocument(title, html, "body{font-family:sans-serif;font-size:14px;}");
}
