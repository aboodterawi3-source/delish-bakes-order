import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { highestPriority, type PriorityColor } from "@/lib/priority";

const KITCHEN_ROLES: StaffRoleName[] = ["kitchen", "admin"];

/**
 * Gift flags and sender/recipient phone numbers are commercial details, not
 * preparation details, so they are stripped before options reach the kitchen.
 */
const PREP_ONLY = /هدية|هاتف|رقم|gift|phone|whatsapp|\+?\d[\d\s-]{5,}/i;
const prepOptions = (options: string[]): string[] => options.filter((option) => !PREP_ONLY.test(option));

/**
 * Kitchen staff must never see contact numbers, even when a phone number was
 * typed inside a free-text field (name, notes, inscription). Any phone-shaped
 * digit run is masked before the data leaves the server.
 */
const PHONE_LIKE = /\+?\d[\d\s-]{6,}\d/g;
const stripPhones = (text: string | null): string | null =>
  text ? text.replace(PHONE_LIKE, "—") : text;


export type KdsItem = {
  id: string;
  name_ar: string;
  name_en: string;
  quantity: number;
  options_ar: string[];
  options_en: string[];
  notes: string | null;
  category: string | null;
  /** Product priority, else its category priority, else null (base tier). */
  priority_color: PriorityColor | null;
};

export type KdsOrder = {
  id: string;
  order_number: string;
  /** Numeric ID of the employee who created the order, when assigned. */
  staff_code: number | null;
  customer_name: string;
  method: "delivery" | "pickup";
  requested_date: string;
  requested_time: string;
  status: string;
  inscription: string | null;
  design_image_url: string | null;
  /** Customer-facing notes only; staff notes and money fields never reach the kitchen. */
  notes: string | null;
  /** Set when a customer moved the pickup/delivery slot through their edit link. */
  schedule_updated_at: string | null;
  /** Set whenever sales/social edit the order; drives the kitchen alert. */
  last_edited_at: string | null;
  /** Manual queue position set with the up/down buttons. */
  queue_rank: number | null;
  created_at: string;
  items: KdsItem[];
  /** Most urgent priority across the order's lines; drives the card colour. */
  priority_color: PriorityColor;
};

/** Confirms the signed-in user may use the kitchen display. */
export const getKitchenAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((row) => row.role as string);
    return {
      allowed: roles.includes("kitchen") || roles.includes("admin"),
      roles,
    };
  });

/**
 * Kitchen-safe order feed. Prices, delivery fees, totals and payment data are
 * never selected, so they cannot reach the kitchen screen.
 */
export const getKitchenOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KdsOrder[]> => {
    await assertRole(context, KITCHEN_ROLES);
    // Reads go through role-checked, prep-safe database functions so kitchen
    // accounts can never reach customer phones, payments or discounts.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = context.supabase as any;
    const { data, error } = await db
      .rpc("get_kitchen_orders")
      .in("status", ["new", "confirmed", "baking", "ready"])
      .order("requested_date", { ascending: true })
      .order("requested_time", { ascending: true });
    if (error) throw new Error(error.message);

    const orderIds = (data ?? []).map((order: { id: string }) => order.id);
    const { data: itemsData, error: itemsError } = orderIds.length
      ? await db.rpc("get_kitchen_order_items", { _order_ids: orderIds })
      : { data: [] as any[], error: null };
    if (itemsError) throw new Error(itemsError.message);

    const productIds = [
      ...new Set<string>(
        (itemsData ?? [])
          .map((item: { product_id: string | null }) => item.product_id)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    ];
    type ProductRow = {
      id: string;
      category: string;
      category_id: string | null;
      priority_color: PriorityColor | null;
    };
    const { data: productsData } = productIds.length
      ? await context.supabase
          .from("products")
          .select("id, category, category_id, priority_color")
          .in("id", productIds)
      : { data: [] as ProductRow[] };
    const productRows = (productsData ?? []) as ProductRow[];
    const categoryByProduct = new Map(productRows.map((p) => [p.id, p.category]));

    // Category priority is the fallback whenever a product has none of its own.
    const categoryIds = [...new Set(productRows.map((p) => p.category_id).filter((id): id is string => Boolean(id)))];
    const { data: categoryRows } = categoryIds.length
      ? await context.supabase
          .from("storefront_categories")
          .select("id, priority_color")
          .in("id", categoryIds)
      : { data: [] as { id: string; priority_color: PriorityColor | null }[] };
    const priorityByCategory = new Map(
      ((categoryRows ?? []) as { id: string; priority_color: PriorityColor | null }[]).map((row) => [
        row.id,
        row.priority_color,
      ]),
    );
    const priorityByProduct = new Map(
      productRows.map((p) => [
        p.id,
        p.priority_color ?? (p.category_id ? priorityByCategory.get(p.category_id) ?? null : null),
      ]),
    );

    const itemsByOrder = new Map<string, KdsItem[]>();
    for (const item of itemsData ?? []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        name_ar: item.name_ar,
        name_en: item.name_en,
        quantity: item.quantity,
        options_ar: prepOptions(item.options_ar ?? []),
        options_en: prepOptions(item.options_en ?? []),
        notes: stripPhones(item.notes),
        category: categoryByProduct.get(item.product_id) ?? null,
        priority_color: priorityByProduct.get(item.product_id) ?? null,
      });
      itemsByOrder.set(item.order_id, list);
    }

    return (data ?? []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      staff_code: order.staff_code ?? null,
      customer_name: stripPhones(order.customer_name) ?? "",
      method: order.method,
      requested_date: order.requested_date,
      requested_time: order.requested_time,
      status: order.status,
      inscription: stripPhones(order.inscription),
      design_image_url: order.design_image_url,
      notes: stripPhones(order.notes),
      schedule_updated_at: order.schedule_updated_at,
      last_edited_at: order.last_edited_at ?? null,
      queue_rank: order.queue_rank ?? null,
      created_at: order.created_at,
      items: itemsByOrder.get(order.id) ?? [],
      priority_color: highestPriority(
        (itemsByOrder.get(order.id) ?? []).map((item) => item.priority_color),
      ),
    }));
  });

/** Marks an order ready; sales sees the same row instantly. */
export const markOrderReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, KITCHEN_ROLES);
    const { error } = await context.supabase
      .from("orders")
      .update({ status: "ready" })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kitchen stages the cook may set: start preparing, mark ready, or undo back. */
export type KitchenStage = "new" | "baking" | "ready";
const KITCHEN_STAGES: KitchenStage[] = ["new", "baking", "ready"];

export const setKitchenStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; stage: KitchenStage }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    if (!KITCHEN_STAGES.includes(input.stage)) throw new Error("مرحلة غير صالحة · Invalid stage");
    return { orderId: String(input.orderId), stage: input.stage };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, KITCHEN_ROLES);
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.stage })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- kitchen priority tiers -------------------------- */

export { PRIORITY_COLORS } from "@/lib/priority";
export type { PriorityColor } from "@/lib/priority";
