import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

const KITCHEN_ROLES: StaffRoleName[] = ["kitchen", "admin"];


export type KdsItem = {
  id: string;
  name_ar: string;
  name_en: string;
  quantity: number;
  options_ar: string[];
  options_en: string[];
  notes: string | null;
  category: string | null;
};

export type KdsOrder = {
  id: string;
  order_number: string;
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
  created_at: string;
  items: KdsItem[];
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
    const { data: productsData } = productIds.length
      ? await context.supabase.from("products").select("id, category").in("id", productIds)
      : { data: [] as { id: string; category: string }[] };
    const categoryByProduct = new Map(
      (productsData ?? []).map((p: { id: string; category: string }) => [p.id, p.category]),
    );

    const itemsByOrder = new Map<string, KdsItem[]>();
    for (const item of itemsData ?? []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        name_ar: item.name_ar,
        name_en: item.name_en,
        quantity: item.quantity,
        options_ar: item.options_ar ?? [],
        options_en: item.options_en ?? [],
        notes: item.notes,
        category: categoryByProduct.get(item.product_id) ?? null,
      });
      itemsByOrder.set(item.order_id, list);
    }

    return (data ?? []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      method: order.method,
      requested_date: order.requested_date,
      requested_time: order.requested_time,
      status: order.status,
      inscription: order.inscription,
      design_image_url: order.design_image_url,
      notes: order.notes,
      schedule_updated_at: order.schedule_updated_at,
      created_at: order.created_at,
      items: itemsByOrder.get(order.id) ?? [],
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

/* --------------------------- kitchen priority tiers -------------------------- */

/** Colour tiers that drive kitchen priority for featured items. */
export const PRIORITY_COLORS = [
  "dark_red",
  "warm_orange",
  "golden_yellow",
  "sky_blue",
  "soft_green",
] as const;

export type PriorityColor = (typeof PRIORITY_COLORS)[number];
