import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

const SOCIAL_ROLES: StaffRoleName[] = ["social", "sales", "admin"];


export type SocialOrderInput = {
  customer_name: string;
  customer_phone: string;
  order_details: string;
  quantity: number;
  method: "pickup" | "delivery";
  requested_date: string;
  requested_time: string;
  event_date?: string | null;
  is_urgent: boolean;
  design_notes?: string | null;
  staff_notes?: string | null;
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
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SOCIAL_ROLES);
    const orderDetails = data.order_details.trim();
    const subtotal = 0;

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        method: data.method,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        event_date: data.event_date?.trim() ? data.event_date : null,
        is_urgent: data.is_urgent,
        inscription: data.design_notes?.trim() || null,
        staff_notes: data.staff_notes?.trim() || null,
        subtotal,
        delivery_fee: 0,
        total: subtotal,
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
      unit_price: 0,
      quantity: data.quantity,
      options_ar: data.is_urgent ? ["مستعجل"] : [],
      options_en: data.is_urgent ? ["Urgent"] : [],
      notes: data.design_notes?.trim() || null,
    });
    if (itemError) throw new Error(itemError.message);

    return { id: order.id, order_number: order.order_number, total: Number(order.total ?? 0) };
  });
