import { feeForArea } from "@/lib/delivery-zones";
import type { OrderModification } from "@/lib/order-modifications";
import { ORDER_STATUS_META, type PaymentMethod, type SalesStatus } from "@/lib/order-status";
import { cleanText, isValidIsoDate, isValidTime } from "@/lib/validators";

export type OrderPatch = {
  orderId: string;
  expected_version?: number | null | undefined;
  status?: SalesStatus;
  cancel_reason?: string | null;
  method?: "delivery" | "pickup";
  /** Delivery zone name; the fee is resolved from the trusted zone table. */
  area?: string | null;
  delivery_fee?: number;
  driver_name?: string | null;
  driver_phone?: string | null;
  payment_method?: PaymentMethod | null;
  /** Card writing, final-photo request and the generated confirmation message. */
  card_note?: string | null;
  final_photo_requested?: boolean;
  confirmation_message?: string | null;
  /** Delivery-order identity fields, editable from Sales and Social alike. */
  order_name?: string | null;
  recipient_name?: string | null;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  customer_name?: string;
  customer_phone?: string;
  address?: string | null;
  requested_date?: string;
  requested_time?: string;
  notes?: string | null;
  staff_notes?: string | null;
  inscription?: string | null;
};

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "cliq", "visa"];

/** Only these columns may be written through updateSalesOrder. */
export function buildOrderPatch(input: OrderPatch): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) {
    if (!((input.status as string) in ORDER_STATUS_META)) {
      throw new Error("حالة غير صالحة · Invalid status");
    }
    patch["status"] = input.status;
  }
  if (input.cancel_reason !== undefined) {
    patch["cancel_reason"] = input.cancel_reason ? String(input.cancel_reason).slice(0, 500) : null;
  }
  if (input.method !== undefined) {
    if (input.method !== "delivery" && input.method !== "pickup") {
      throw new Error("طريقة غير صالحة · Invalid method");
    }
    patch["method"] = input.method;
  }
  if (input.delivery_fee !== undefined) {
    const fee = Number(input.delivery_fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000) {
      throw new Error("أجرة توصيل غير صالحة · Invalid delivery fee");
    }
    patch["delivery_fee"] = fee;
  }
  if (input.area !== undefined) {
    if (input.area === null || input.area === "") {
      patch["area"] = null;
    } else {
      const area = String(input.area).trim().replace(/\s+/g, " ");
      const zoneFee = feeForArea(area);
      if (zoneFee === null) throw new Error("منطقة غير صالحة · Invalid delivery area");
      patch["area"] = area;
      patch["delivery_fee"] = zoneFee;
    }
  }
  if (input.payment_method !== undefined) {
    if (input.payment_method !== null && !PAYMENT_METHODS.includes(input.payment_method)) {
      throw new Error("طريقة دفع غير صالحة · Invalid payment method");
    }
    patch["payment_method"] = input.payment_method;
  }
  if (input.driver_name !== undefined) {
    patch["driver_name"] = input.driver_name ? String(input.driver_name).slice(0, 120) : null;
  }
  if (input.driver_phone !== undefined) {
    patch["driver_phone"] = input.driver_phone ? String(input.driver_phone).slice(0, 40) : null;
  }
  if (input.card_note !== undefined) {
    patch["card_note"] = input.card_note ? String(input.card_note).slice(0, 1000) : null;
  }
  if (input.final_photo_requested !== undefined) {
    patch["final_photo_requested"] = Boolean(input.final_photo_requested);
  }
  if (input.confirmation_message !== undefined) {
    patch["confirmation_message"] = input.confirmation_message
      ? String(input.confirmation_message).slice(0, 8000)
      : null;
  }

  const text = (value: unknown, max: number) => cleanText(value, max);
  if (input.order_name !== undefined) patch["order_name"] = text(input.order_name, 160);
  if (input.recipient_name !== undefined) patch["recipient_name"] = text(input.recipient_name, 160);
  if (input.sender_phone !== undefined) patch["sender_phone"] = text(input.sender_phone, 40);
  if (input.recipient_phone !== undefined)
    patch["recipient_phone"] = text(input.recipient_phone, 40);
  if (input.address !== undefined) patch["address"] = text(input.address, 500);
  if (input.notes !== undefined) patch["notes"] = text(input.notes, 2000);
  if (input.staff_notes !== undefined) patch["staff_notes"] = text(input.staff_notes, 2000);
  if (input.inscription !== undefined) patch["inscription"] = text(input.inscription, 500);
  if (input.customer_name !== undefined) {
    const name = text(input.customer_name, 160);
    if (!name) throw new Error("اسم العميل مطلوب · Customer name is required");
    patch["customer_name"] = name;
  }
  if (input.customer_phone !== undefined) {
    const phone = text(input.customer_phone, 40);
    if (!phone) throw new Error("رقم الهاتف مطلوب · Customer phone is required");
    patch["customer_phone"] = phone;
  }
  if (input.requested_date !== undefined) {
    if (!isValidIsoDate(String(input.requested_date))) {
      throw new Error("تاريخ غير صالح · Invalid date");
    }
    patch["requested_date"] = input.requested_date;
  }
  if (input.requested_time !== undefined) {
    if (!isValidTime(String(input.requested_time))) {
      throw new Error("وقت غير صالح · Invalid time");
    }
    patch["requested_time"] = input.requested_time;
  }

  return patch;
}

/** Optimistically applies an OrderPatch to a cached order row using the same zone-fee rules. */
export function applyOrderPatch<
  T extends {
    status: SalesStatus;
    cancel_reason: string | null;
    method: "delivery" | "pickup";
    area: string | null;
    delivery_fee: number;
    driver_name: string | null;
    driver_phone: string | null;
    payment_method: PaymentMethod | null;
    card_note: string | null;
    final_photo_requested: boolean;
    confirmation_message: string | null;
    order_name: string | null;
    sender_phone: string | null;
    recipient_phone: string | null;
    customer_name: string;
    customer_phone: string;
    address: string | null;
    requested_date: string;
    requested_time: string;
    notes: string | null;
    staff_notes: string | null;
    inscription: string | null;
    subtotal: number;
    discount_amount: number;
    total: number;
    last_edited_at: string | null;
  },
>(order: T, input: OrderPatch): T {
  const next: T = { ...order };
  if (input.status !== undefined) next.status = input.status;
  if (input.cancel_reason !== undefined) next.cancel_reason = input.cancel_reason;
  if (input.method !== undefined) next.method = input.method;
  if (input.area !== undefined) {
    next.area = input.area;
    next.delivery_fee = input.area ? (feeForArea(input.area) ?? next.delivery_fee) : 0;
  }
  if (input.delivery_fee !== undefined) next.delivery_fee = input.delivery_fee;
  if (input.driver_name !== undefined) next.driver_name = input.driver_name;
  if (input.driver_phone !== undefined) next.driver_phone = input.driver_phone;
  if (input.payment_method !== undefined) next.payment_method = input.payment_method;
  if (input.card_note !== undefined) next.card_note = input.card_note;
  if (input.final_photo_requested !== undefined)
    next.final_photo_requested = input.final_photo_requested;
  if (input.confirmation_message !== undefined)
    next.confirmation_message = input.confirmation_message;
  if (input.order_name !== undefined) next.order_name = input.order_name;
  if (input.sender_phone !== undefined) next.sender_phone = input.sender_phone;
  if (input.recipient_phone !== undefined) next.recipient_phone = input.recipient_phone;
  if (input.customer_name !== undefined) next.customer_name = input.customer_name;
  if (input.customer_phone !== undefined) next.customer_phone = input.customer_phone;
  if (input.address !== undefined) next.address = input.address;
  if (input.requested_date !== undefined) next.requested_date = input.requested_date;
  if (input.requested_time !== undefined) next.requested_time = input.requested_time;
  if (input.notes !== undefined) next.notes = input.notes;
  if (input.staff_notes !== undefined) next.staff_notes = input.staff_notes;
  if (input.inscription !== undefined) next.inscription = input.inscription;
  next.total = Math.max(
    next.subtotal + (next.method === "delivery" ? next.delivery_fee : 0) - next.discount_amount,
    0,
  );
  next.last_edited_at = new Date().toISOString();
  return next;
}

export function buildOriginalOrderBaseline(order: any, items: any[]): string {
  const itemsText =
    (items ?? [])
      .map(
        (it: any) =>
          `${it.quantity}× ${it.name_ar || it.name_en || "صنف"}${it.options_ar?.length ? ` (${it.options_ar.join(" ، ")})` : ""}`,
      )
      .join(" + ") || "بدون تفاصيل أصناف";
  const fulfText =
    order.method === "delivery"
      ? `توصيل دليفري (${order.area || "عمان"}${order.address ? ` - ${order.address}` : ""})`
      : "استلام من المحل";
  const giftText =
    order.sender_phone || order.recipient_phone || order.order_name
      ? ` [هدية: ${order.order_name ? `المستلم: ${order.order_name} ` : ""}(هاتف: ${order.recipient_phone || "—"}) / هاتف المرسل: ${order.sender_phone || "—"}]`
      : "";
  const inscText = order.inscription ? `الكتابة: "${order.inscription}"` : "";
  const notesText = order.notes ? `الملاحظات: "${order.notes}"` : "";
  const timeText = order.requested_time ? String(order.requested_time).slice(0, 5) : "";
  const extras = [inscText, notesText].filter(Boolean).join(" | ");

  return `الأصناف الأصلية: ${itemsText}\nالعميل: ${order.customer_name} (${order.customer_phone})${giftText}\nموعد التسليم الأصلي: ${order.requested_date} ${timeText} (${fulfText})${extras ? `\n${extras}` : ""}\nالحساب عند الإنشاء: الإجمالي ${Number(order.total ?? 0).toFixed(2)} د.أ (العربون: ${Number(order.deposit_paid ?? 0).toFixed(2)} د.أ)`;
}

export async function createBaselineModIfNeeded(
  currentMods: OrderModification[],
  nowIso: string,
  buildSummary: () => Promise<string>,
): Promise<OrderModification[]> {
  const hasBaseline = currentMods.some(
    (m) => m.field.includes("الطلب الأساسي") || m.field.includes("النسخة الأصلية"),
  );
  if (hasBaseline) return [];
  return [
    {
      field: "الطلب الأساسي (النسخة الأصلية عند الإنشاء)",
      oldValue: await buildSummary(),
      newValue: "تم إجراء أول تعديل على هذا الطلب",
      updatedAt: nowIso,
      acknowledgedAt: null,
    },
  ];
}
