import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

const SOCIAL_ROLES: StaffRoleName[] = ["social", "sales", "admin"];


export type SocialProduct = {
  id: string;
  name_ar: string;
  name_en: string;
  category: string;
  price: number;
};

export type SocialOrderInput = {
  customer_name: string;
  customer_phone: string;
  product_id: string;
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

export const getSocialProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SocialProduct[]> => {
    await assertRole(context, SOCIAL_ROLES);
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name_ar, name_en, category, price")
      .eq("is_available", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      name_ar: row.name_ar,
      name_en: row.name_en,
      category: row.category,
      price: Number(row.price ?? 0),
    }));
  });

/**
 * Creates an order from the social portal. Design notes ride on the order item
 * so the kitchen sees them; internal staff notes stay on the order row, which
 * the kitchen feed never selects.
 */
export const createSocialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SocialOrderInput) => {
    if (!input?.customer_name?.trim()) throw new Error("اسم العميل مطلوب");
    if (!input?.customer_phone?.trim()) throw new Error("رقم الهاتف مطلوب");
    if (!input?.product_id) throw new Error("اختيار المنتج مطلوب");
    if (!input?.requested_date || !input?.requested_time) throw new Error("تاريخ ووقت التسليم مطلوب");
    if (!Number.isFinite(input.quantity) || input.quantity < 1) throw new Error("الكمية غير صحيحة");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SOCIAL_ROLES);
    const { data: product, error: productError } = await context.supabase
      .from("products")
      .select("id, name_ar, name_en, price")
      .eq("id", data.product_id)
      .single();
    if (productError) throw new Error(productError.message);

    const unitPrice = Number(product.price ?? 0);
    const subtotal = unitPrice * data.quantity;

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
      product_id: product.id,
      name_ar: product.name_ar,
      name_en: product.name_en,
      unit_price: unitPrice,
      quantity: data.quantity,
      options_ar: data.is_urgent ? ["مستعجل"] : [],
      options_en: data.is_urgent ? ["Urgent"] : [],
      notes: data.design_notes?.trim() || null,
    });
    if (itemError) throw new Error(itemError.message);

    return { id: order.id, order_number: order.order_number, total: Number(order.total ?? 0) };
  });
