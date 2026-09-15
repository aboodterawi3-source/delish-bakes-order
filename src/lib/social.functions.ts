import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";

const SOCIAL_ROLES: StaffRoleName[] = ["social", "sales", "admin"];


export type SocialOrderInput = {
  customer_name: string;
  customer_phone: string;
  order_details: string;
  quantity: number;
  /** Original price per unit agreed with the customer (السعر الأصلي). */
  unit_price?: number | null;
  /** Text written on the accompanying card. */
  card_note?: string | null;
  /** Customer asked for a final photo before delivery. */
  final_photo_requested?: boolean;
  /** Ready-to-send confirmation message stored with the order. */
  confirmation_message?: string | null;
  method: "pickup" | "delivery";
  /** Amman / other-governorate zone name; the fee is resolved server-side. */
  area?: string | null;
  address?: string | null;
  /** Cash on delivery, fully paid via CliQ, or a deposit via CliQ. */
  payment_option: "cash" | "cliq_full" | "cliq_deposit";
  /** Amount already collected via CliQ (full payment or deposit). */
  deposit_paid?: number | null;
  requested_date: string;
  requested_time: string;
  event_date?: string | null;
  is_urgent: boolean;
  design_notes?: string | null;
  staff_notes?: string | null;
  /** Chosen extras (candles, balloons, acrylic topper, gift phones…) — labels only. */
  extras_ar?: string[] | null;
  extras_en?: string[] | null;
  /** Signed link of the customer's reference photo. */
  design_image_url?: string | null;
};

const MAX_EXTRAS = 20;
const MAX_EXTRA_LENGTH = 160;
/** Signed link returned by uploadDesignImage for photos kept in Cloud storage. */
const STORAGE_URL = /^https:\/\/zmeijwtivmniqpwyxezk\.supabase\.co\/storage\/v1\/object\/sign\/order-designs\/[\w./-]+\?[\w=%&.-]+$/i;


/** Extras are plain labels; keep them short, single-line and bounded. */
const extraList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.replace(/[\r\n]+/g, " ").trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, MAX_EXTRAS)
    .map((entry) => entry.slice(0, MAX_EXTRA_LENGTH));
};


/** Confirms the signed-in user may use the social media portal. */
export const getSocialAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((row) => row.role as string);
    return {
      allowed: roles.includes("social") || roles.includes("sales") || roles.includes("admin"),
      roles,
    };
  });

/**
 * Creates a free-form custom order from the social portal. The complete request
 * is the order item's primary bilingual description, so Sales, KDS and printed
 * invoices all display it without relying on the public product catalogue.
 */
export const createSocialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SocialOrderInput) => {
    if (!input?.customer_name?.trim()) throw new Error("اسم العميل مطلوب");
    if (!input?.customer_phone?.trim()) throw new Error("رقم الهاتف مطلوب");
    if (!input?.order_details?.trim()) {
      throw new Error("تفاصيل طلب الزبون مطلوبة · Customer order details are required");
    }
    if (input.order_details.trim().length > 2000) {
      throw new Error("تفاصيل الطلب طويلة جداً · Order details are too long");
    }
    if (!input?.requested_date || !input?.requested_time) throw new Error("تاريخ ووقت التسليم مطلوب");
    if (!Number.isFinite(input.quantity) || input.quantity < 1) throw new Error("الكمية غير صحيحة");
    if (!["cash", "cliq_full", "cliq_deposit"].includes(input?.payment_option as string)) {
      throw new Error("طريقة الدفع مطلوبة · Payment method is required");
    }
    if (input.method === "delivery" && !input.area?.trim()) {
      throw new Error("منطقة التوصيل مطلوبة · Delivery area is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SOCIAL_ROLES);
    const orderDetails = data.order_details.trim();
    // Original price agreed with the customer; the row total is recomputed in the DB.
    const unitPrice = Math.min(Math.max(Number(data.unit_price) || 0, 0), 100000);
    const subtotal = unitPrice * data.quantity;
    const area = data.method === "delivery" ? data.area?.trim() || null : null;
    // The browser never sets the fee: it is resolved from the trusted zone table.
    const deliveryFee = area ? feeForArea(area) ?? 0 : 0;
    // A paid amount is stored for deposits and for CliQ payments alike.
    const deposit = data.payment_option === "cash" ? 0 : Math.max(0, Number(data.deposit_paid) || 0);
    const paymentMethod = data.payment_option === "cash" ? "cash" : "cliq";
    const extrasAr = extraList(data.extras_ar);
    const extrasEn = extraList(data.extras_en);
    const designImage =
      typeof data.design_image_url === "string" && STORAGE_URL.test(data.design_image_url.trim())
        ? data.design_image_url.trim()
        : null;

    /** Assigned here (not by the column default) so the confirmation message can
     * carry the real order number in the very same insert. */
    const orderNumber = `DL-${String(Date.now()).slice(-5)}`;
    const message =
      typeof data.confirmation_message === "string" && data.confirmation_message.trim()
        ? data.confirmation_message.replace(/\{\{ORDER_NUMBER\}\}/g, orderNumber).slice(0, 8000)
        : null;

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        confirmation_message: message,
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        method: data.method,
        area,
        address: data.method === "delivery" ? data.address?.trim() || null : null,
        payment_method: paymentMethod,
        deposit_paid: deposit,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        event_date: data.event_date?.trim() ? data.event_date : null,
        is_urgent: data.is_urgent,
        inscription: data.design_notes?.trim() || null,
        staff_notes: data.staff_notes?.trim() || null,
        card_note: data.card_note?.trim() || null,
        final_photo_requested: Boolean(data.final_photo_requested),
        design_image_url: designImage,
        subtotal,
        delivery_fee: deliveryFee,
        total: subtotal + deliveryFee,
        status: "new",
        created_by: context.userId,
      })
      .select("id, order_number, total")
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: itemError } = await context.supabase.from("order_items").insert({
      order_id: order.id,
      product_id: null,
      name_ar: orderDetails,
      name_en: orderDetails,
      unit_price: unitPrice,
      quantity: data.quantity,
      options_ar: [...(data.is_urgent ? ["مستعجل"] : []), ...extrasAr],
      options_en: [...(data.is_urgent ? ["Urgent"] : []), ...extrasEn],
      notes: data.design_notes?.trim() || null,
    });

    if (itemError) throw new Error(itemError.message);

    // The message is written by the portal with a placeholder, because the order
    // number only exists after the insert. Store the final text with the order.
    const message =
      typeof data.confirmation_message === "string" && data.confirmation_message.trim()
        ? data.confirmation_message
            .replace(/\{\{ORDER_NUMBER\}\}/g, order.order_number)
            .slice(0, 8000)
        : null;
    if (message) {
      await context.supabase
        .from("orders")
        .update({ confirmation_message: message })
        .eq("id", order.id);
    }

    return {
      id: order.id,
      order_number: order.order_number,
      total: Number(order.total ?? 0),
      confirmation_message: message,
    };
  });
