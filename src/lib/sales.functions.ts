import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

const SALES_ROLES: StaffRoleName[] = ["sales", "admin"];


export type SalesStatus =
  | "new"
  | "confirmed"
  | "baking"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "cliq" | "visa";

export type SalesItem = {
  id: string;
  name_ar: string;
  name_en: string;
  quantity: number;
  unit_price: number;
  options_ar: string[];
  notes: string | null;
  product_id?: string | null;
};

export type SalesOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  method: "delivery" | "pickup";
  area: string | null;
  address: string | null;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  staff_notes: string | null;
  inscription: string | null;
  design_image_url: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  deposit_paid: number;
  payment_method: PaymentMethod | null;
  driver_name: string | null;
  driver_phone: string | null;
  cancel_reason: string | null;
  status: SalesStatus;
  created_at: string;
  updated_at: string;
  items: SalesItem[];
};

const SELECT =
  "id, order_number, customer_name, customer_phone, method, area, address, requested_date, requested_time, notes, staff_notes, inscription, design_image_url, subtotal, delivery_fee, total, deposit_paid, payment_method, driver_name, driver_phone, cancel_reason, status, created_at, updated_at, order_items(id, name_ar, name_en, quantity, unit_price, options_ar, notes, product_id)";

type Row = Record<string, unknown> & { order_items?: unknown[] };

const toOrder = (row: Row): SalesOrder => ({
  ...(row as unknown as Omit<SalesOrder, "items">),
  subtotal: Number(row['subtotal'] ?? 0),
  delivery_fee: Number(row['delivery_fee'] ?? 0),
  total: Number(row['total'] ?? 0),
  deposit_paid: Number(row['deposit_paid'] ?? 0),
  items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
    id: String(item['id']),
    name_ar: String(item['name_ar']),
    name_en: String(item['name_en']),
    quantity: Number(item['quantity'] ?? 1),
    unit_price: Number(item['unit_price'] ?? 0),
    options_ar: (item['options_ar'] as string[]) ?? [],
    notes: (item['notes'] as string | null) ?? null,
    product_id: (item['product_id'] as string | null) ?? null,
  })),
});

/** Confirms the signed-in user may use the sales interface. */
export const getSalesAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((row) => row.role as string);
    return { allowed: roles.includes("sales") || roles.includes("admin"), roles };
  });

export const getSalesOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalesOrder[]> => {
    await assertRole(context, SALES_ROLES);
    const { data, error } = await context.supabase
      .from("orders")
      .select(SELECT)
      .order("requested_date", { ascending: false })
      .order("requested_time", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toOrder(row as Row));
  });

export type OrderPatch = {
  orderId: string;
  status?: SalesStatus;
  cancel_reason?: string | null;
  method?: "delivery" | "pickup";
  delivery_fee?: number;
  driver_name?: string | null;
  driver_phone?: string | null;
  deposit_paid?: number;
  payment_method?: PaymentMethod | null;
};

export const updateSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrderPatch) => {
    if (!input?.orderId) throw new Error("orderId is required");
    if (input.status === "cancelled" && !input.cancel_reason?.trim()) {
      throw new Error("سبب الإلغاء مطلوب · Cancellation reason is required");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);
    const { orderId, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) clean[key] = value;
    }
    const { data: row, error } = await context.supabase
      .from("orders")
      .update(clean as never)
      .eq("id", orderId)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return toOrder(row as Row);
  });

export const updateSalesOrderItemPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; orderId: string; newUnitPrice: number }) => input)
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);
    // Update order_items table
    const { error: itemError } = await context.supabase
      .from("order_items")
      .update({ unit_price: data.newUnitPrice })
      .eq("id", data.itemId);
    if (itemError) throw new Error(itemError.message);

    // Recalculate order subtotal and total
    const { data: items, error: fetchError } = await context.supabase
      .from("order_items")
      .select("unit_price, quantity")
      .eq("order_id", data.orderId);
    if (fetchError) throw new Error(fetchError.message);

    const subtotal = (items ?? []).reduce(
      (acc, it) => acc + Number(it.unit_price) * Number(it.quantity),
      0
    );

    const { data: currentOrder } = await context.supabase
      .from("orders")
      .select("delivery_fee, method")
      .eq("id", data.orderId)
      .single();

    const deliveryFee = currentOrder?.method === "delivery" ? Number(currentOrder?.delivery_fee ?? 0) : 0;
    const total = subtotal + deliveryFee;

    const { data: updatedOrder, error: orderError } = await context.supabase
      .from("orders")
      .update({ subtotal, total })
      .eq("id", data.orderId)
      .select(SELECT)
      .single();
    if (orderError) throw new Error(orderError.message);

    return toOrder(updatedOrder as Row);
  });

export type ShiftReport = {
  date: string;
  byMethod: { method: PaymentMethod | "unpaid"; orders: number; collected: number }[];
  orders: number;
  collected: number;
  outstanding: number;
  cancelled: number;
};

export const getShiftReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!input?.date) throw new Error("date is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<ShiftReport> => {
    await assertRole(context, SALES_ROLES);
    const { data: rows, error } = await context.supabase
      .from("orders")
      .select("status, total, deposit_paid, payment_method")
      .eq("requested_date", data.date);
    if (error) throw new Error(error.message);

    const buckets = new Map<PaymentMethod | "unpaid", { orders: number; collected: number }>();
    let collected = 0;
    let outstanding = 0;
    let cancelled = 0;
    let orders = 0;

    for (const row of rows ?? []) {
      if (row.status === "cancelled") {
        cancelled += 1;
        continue;
      }
      orders += 1;
      const paid = Number(row.deposit_paid ?? 0);
      const total = Number(row.total ?? 0);
      collected += paid;
      outstanding += Math.max(total - paid, 0);
      const key = (row.payment_method as PaymentMethod | null) ?? "unpaid";
      const bucket = buckets.get(key) ?? { orders: 0, collected: 0 };
      bucket.orders += 1;
      bucket.collected += paid;
      buckets.set(key, bucket);
    }

    return {
      date: data.date,
      byMethod: (["cash", "cliq", "visa", "unpaid"] as const).map((method) => ({
        method,
        orders: buckets.get(method)?.orders ?? 0,
        collected: buckets.get(method)?.collected ?? 0,
      })),
      orders,
      collected,
      outstanding,
      cancelled,
    };
  });
