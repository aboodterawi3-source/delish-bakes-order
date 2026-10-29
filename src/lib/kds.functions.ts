import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { highestPriority, type PriorityColor } from "@/lib/priority";
import { isoDay, todayIso } from "@/lib/date-filter";

const KITCHEN_ROLES: StaffRoleName[] = ["kitchen", "admin"];

/**
 * Gift flags and sender/recipient phone numbers are commercial details, not
 * preparation details, so they are stripped before options reach the kitchen.
 */
const PREP_ONLY =
  /هدية|هاتف|رقم|موبايل|واتساب|واتس|انستغرام|فيسبوك|تيك توك|موقع|المصدر|مصدر|كليك|حوالة|قيمة|مبلغ|سعر|د\.أ|دينار|JD|jd|price|cost|amount|total|gift|phone|whatsapp|instagram|facebook|tiktok|source|cliq|\+?\d[\d\s-]{5,}|\d+(\.\d+)?\s*(د\.أ|JD|jd|دينار)/i;
const prepOptions = (options: string[]): string[] =>
  options.filter((option) => !PREP_ONLY.test(option));

/**
 * Kitchen staff must never see contact numbers, even when a phone number was
 * typed inside a free-text field (name, notes, inscription). Any phone-shaped
 * digit run is masked before the data leaves the server.
 */
const PHONE_LIKE = /\+?[\d٠-٩][\d٠-٩\s-]{6,}[\d٠-٩]/g;
const PRICE_LIKE = /\d+(\.\d+)?\s*(د\.أ|JD|jd|دينار)/gi;
const stripPhones = (text: string | null): string | null =>
  text ? text.replace(PHONE_LIKE, "—") : text;
const stripPhonesAndPrices = (text: string | null): string | null =>
  text ? text.replace(PHONE_LIKE, "—").replace(PRICE_LIKE, "—") : text;

import type { OrderModification } from "@/lib/server-shared";
export type { OrderModification };
import { isValidStorageUrl } from "@/lib/server-shared";


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
  version?: number;
  /** Numeric ID of the employee who created the order, when assigned. */
  staff_code: number | null;
  customer_name: string;
  method: "delivery" | "pickup";
  requested_date: string;
  requested_time: string;
  status: string;
  inscription: string | null;
  card_note?: string | null;
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
  /** Audit log of modifications made to the order */
  modifications: OrderModification[];
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
    // SEC-04: Smart date filter (yesterday's incomplete + today & onwards) and query limit (150)
    const yesterday = isoDay(-1);
    const today = todayIso();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = context.supabase as any;
    const { data, error } = await db
      .rpc("get_kitchen_orders")
      .in("status", ["new", "confirmed", "baking", "ready"])
      .gte("requested_date", yesterday)
      .order("requested_date", { ascending: true })
      .order("requested_time", { ascending: true })
      .limit(150);
    if (error) throw new Error(error.message);

    // Keep all orders from today onwards, and only incomplete orders from yesterday
    const activeOrders = (data ?? []).filter(
      (order: { requested_date: string; status: string }) => {
        if (order.requested_date >= today) return true;
        if (order.requested_date === yesterday) {
          return order.status !== "ready";
        }
        return false;
      },
    );

    const orderIds = activeOrders.map((order: { id: string }) => order.id);
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
    const categoryIds = [
      ...new Set(productRows.map((p) => p.category_id).filter((id): id is string => Boolean(id))),
    ];
    const { data: categoryRows } = categoryIds.length
      ? await context.supabase
          .from("storefront_categories")
          .select("id, priority_color")
          .in("id", categoryIds)
      : { data: [] as { id: string; priority_color: PriorityColor | null }[] };
    const priorityByCategory = new Map(
      ((categoryRows ?? []) as { id: string; priority_color: PriorityColor | null }[]).map(
        (row) => [row.id, row.priority_color],
      ),
    );
    const priorityByProduct = new Map(
      productRows.map((p) => [
        p.id,
        p.priority_color ??
          (p.category_id ? (priorityByCategory.get(p.category_id) ?? null) : null),
      ]),
    );

    const itemsByOrder = new Map<string, KdsItem[]>();
    for (const item of itemsData ?? []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        name_ar: stripPhonesAndPrices(item.name_ar) ?? item.name_ar,
        name_en: stripPhonesAndPrices(item.name_en) ?? item.name_en,
        quantity: item.quantity,
        options_ar: prepOptions(item.options_ar ?? []),
        options_en: prepOptions(item.options_en ?? []),
        notes: stripPhonesAndPrices(item.notes),
        category: categoryByProduct.get(item.product_id) ?? null,
        priority_color: priorityByProduct.get(item.product_id) ?? null,
      });
      itemsByOrder.set(item.order_id, list);
    }

    const FINANCIAL_OR_BASELINE =
      /total|إجمالي|subtotal|مجموع|deposit|عربون|مدفوع|discount|خصم|سعر|price|النسخة الأصلية|الطلب الأساسي/i;
    const PRICE_REGEX = /\d+(\.\d+)?\s*(د\.أ|JD|jd)/gi;

    return activeOrders.map((order: any) => {
      let mods: OrderModification[] = Array.isArray(order.modifications) ? order.modifications : [];

      // The modification history embeds raw phone numbers and financial amounts,
      // so it is strictly masked before reaching the kitchen screen.
      mods = mods.map((mod: OrderModification) => {
        const isFinancial = FINANCIAL_OR_BASELINE.test(mod.field);
        return {
          ...mod,
          field: stripPhones(mod.field) ?? mod.field,
          oldValue: isFinancial
            ? "***"
            : (stripPhones(mod.oldValue)?.replace(PRICE_REGEX, "***") ?? mod.oldValue),
          newValue: isFinancial
            ? "***"
            : (stripPhones(mod.newValue)?.replace(PRICE_REGEX, "***") ?? mod.newValue),
        };
      });

      // If modifications array is still empty but order has edit timestamps, synthesize explicit diff entries
      if (mods.length === 0) {
        if (order.schedule_updated_at) {
          mods = [
            {
              field: "موعد الاستلام/التوصيل (رابط العميل)",
              oldValue: "تم تعديل الموعد عبر رابط الزبون",
              newValue: `${order.requested_date} (${order.requested_time ? String(order.requested_time).slice(0, 5) : ""})`,
              updatedAt: order.schedule_updated_at,
              acknowledgedAt: null,
            },
          ];
        } else if (order.last_edited_at) {
          mods = [
            {
              field: "تعديل تفاصيل الطلب (مكتبي)",
              oldValue: "النسخة السابقة للطلب",
              newValue: "تم إجراء تعديلات بمكتب المبيعات (انظر المواصفات المحدثة أعلاه)",
              updatedAt: order.last_edited_at,
              acknowledgedAt: null,
            },
          ];
        }
      }

      return {
        id: order.id,
        order_number: order.order_number,
        staff_code: order.staff_code ?? null,
        customer_name: stripPhones(order.customer_name) ?? "",
        method: order.method,
        // Never null: the kitchen card reads these directly.
        requested_date: order.requested_date ?? "",
        requested_time: order.requested_time ?? "",
        status: order.status,
        inscription: stripPhones(order.inscription),
        card_note: stripPhones(order.card_note ?? null),
        design_image_url: isValidStorageUrl(order.design_image_url) ? order.design_image_url : null,
        notes: stripPhones(order.notes),
        schedule_updated_at: order.schedule_updated_at,
        last_edited_at: order.last_edited_at ?? null,
        queue_rank: order.queue_rank ?? null,
        created_at: order.created_at,
        items: itemsByOrder.get(order.id) ?? [],
        priority_color: highestPriority(
          (itemsByOrder.get(order.id) ?? []).map((item) => item.priority_color),
        ),
        modifications: mods as OrderModification[],
      };
    });
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
    const { error } = await context.supabase.rpc("update_kitchen_order_status" as any, {
      p_order_id: data.orderId,
      p_status: "ready",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kitchen staff acknowledges modifications on an order */
export const acknowledgeOrderModification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; modIds?: string[] | undefined }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    return {
      orderId: String(input.orderId),
      modIds: Array.isArray(input.modIds) ? input.modIds.map(String) : [],
    };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, KITCHEN_ROLES);
    const { getStaffCodeForUser } = await import("@/lib/server-shared");
    const staffCode = await getStaffCodeForUser(context.supabase, context.userId);
    const chefName = staffCode ? `شيف المطبخ #${staffCode}` : "شيف المطبخ";

    const { data: result, error: rpcError } = await context.supabase.rpc(
      "acknowledge_kds_modifications_atomic",
      {
        p_order_id: data.orderId,
        p_mod_ids: data.modIds,
        p_chef_user_id: context.userId,
        p_chef_name: chefName,
      },
    );

    if (!rpcError && result) {
      return { ok: true, result };
    }

    let orderRow: { modifications?: any } | null = null;

    try {
      const { data: order } = await context.supabase
        .from("orders")
        .select("modifications")
        .eq("id", data.orderId)
        .single();
      orderRow = order;
    } catch {
      /* ignore */
    }

    if (!orderRow && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminRow } = await supabaseAdmin
          .from("orders")
          .select("modifications")
          .eq("id", data.orderId)
          .single();
        orderRow = adminRow;
      } catch {
        /* ignore */
      }
    }

    const currentMods = (orderRow?.modifications as OrderModification[] | null) ?? [];
    const nowIso = new Date().toISOString();
    let updatedMods: OrderModification[];

    if (currentMods.length > 0) {
      updatedMods = currentMods.map((mod: any) => {
        const match =
          data.modIds.length === 0 ||
          data.modIds.includes(mod.id) ||
          data.modIds.includes(mod.updatedAt);
        if (match) {
          return {
            ...mod,
            acknowledgedAt: mod.acknowledgedAt || nowIso,
            acknowledgedBy: context.userId,
            acknowledgedByName: chefName,
          };
        }
        return mod;
      });
    } else {
      updatedMods = [
        {
          field: "اعتماد التعديل بالمطبخ",
          oldValue: "تم التعديل",
          newValue: `تم الاطلاع والاعتماد من قبل ${chefName} ✓`,
          updatedAt: nowIso,
          acknowledgedAt: nowIso,
        },
      ];
    }

    const { error } = await context.supabase
      .from("orders")
      .update({ modifications: updatedMods as any })
      .eq("id", data.orderId);

    if (error && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: adminError } = await supabaseAdmin
        .from("orders")
        .update({ modifications: updatedMods as any })
        .eq("id", data.orderId);
      if (adminError) throw new Error(adminError.message);
    } else if (error) {
      throw new Error(error.message);
    }
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
    const { error } = await context.supabase.rpc("update_kitchen_order_status" as any, {
      p_order_id: data.orderId,
      p_status: data.stage,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- kitchen priority tiers -------------------------- */

export { PRIORITY_COLORS } from "@/lib/priority";
export type { PriorityColor } from "@/lib/priority";
