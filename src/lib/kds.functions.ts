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
    const { data, error } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, method, requested_date, requested_time, status, inscription, design_image_url, created_at, order_items(id, name_ar, name_en, quantity, options_ar, options_en, notes, products(category))",
      )
      .in("status", ["new", "confirmed", "baking", "ready"])
      .order("requested_date", { ascending: true })
      .order("requested_time", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      method: order.method,
      requested_date: order.requested_date,
      requested_time: order.requested_time,
      status: order.status,
      inscription: order.inscription,
      design_image_url: order.design_image_url,
      created_at: order.created_at,
      items: (order.order_items ?? []).map((item) => ({
        id: item.id,
        name_ar: item.name_ar,
        name_en: item.name_en,
        quantity: item.quantity,
        options_ar: item.options_ar ?? [],
        options_en: item.options_en ?? [],
        notes: item.notes,
        category: (item.products as { category: string } | null)?.category ?? null,
      })),
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

/* ------------------------- menu & pricing management ------------------------ */

export type MenuItem = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  category: string;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
};

export type MenuItemInput = Omit<MenuItem, "id"> & { id?: string };

const MENU_SELECT =
  "id, slug, name_ar, name_en, description_ar, description_en, category, price, is_available, is_featured, sort_order";

/** Full menu, including unavailable items, for the kitchen menu manager. */
export const listMenuItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MenuItem[]> => {
    await assertRole(context, KITCHEN_ROLES);
    const { data, error } = await context.supabase
      .from("products")
      .select(MENU_SELECT)
      .order("category")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ ...(row as MenuItem), price: Number(row.price ?? 0) }));
  });

/** Creates or updates one menu item. */
export const saveMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MenuItemInput) => {
    if (!input?.name_ar?.trim() || !input?.name_en?.trim()) {
      throw new Error("الاسم بالعربية والإنجليزية مطلوب · Arabic and English names are required");
    }
    if (!input?.category?.trim()) throw new Error("التصنيف مطلوب · Category is required");
    if (!(Number(input.price) >= 0)) throw new Error("السعر غير صحيح · Invalid price");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, KITCHEN_ROLES);
    const slug =
      data.slug?.trim() ||
      data.name_en.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      `product-${Date.now()}`;
    const row = {
      slug,
      name_ar: data.name_ar.trim(),
      name_en: data.name_en.trim(),
      description_ar: data.description_ar?.trim() || null,
      description_en: data.description_en?.trim() || null,
      category: data.category.trim(),
      price: Number(data.price),
      is_available: !!data.is_available,
      is_featured: !!data.is_featured,
      sort_order: Number(data.sort_order ?? 0),
    };
    const query = data.id
      ? context.supabase.from("products").update(row as never).eq("id", data.id)
      : context.supabase.from("products").insert(row as never);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, KITCHEN_ROLES);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
