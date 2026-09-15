import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";

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
  discount_amount: number;
  discount_percent: number;
  total: number;
  deposit_paid: number;
  payment_method: PaymentMethod | null;
  driver_name: string | null;
  driver_phone: string | null;
  cancel_reason: string | null;
  /** Text written on the accompanying card. */
  card_note: string | null;
  /** Customer asked for the final photo before delivery. */
  final_photo_requested: boolean;
  /** Last generated customer confirmation message, stored with the order. */
  confirmation_message: string | null;
  status: SalesStatus;
  /** Set when a customer moved the pickup/delivery slot through their edit link. */
  schedule_updated_at: string | null;
  created_at: string;
  updated_at: string;
  items: SalesItem[];
};

const SELECT =
  "id, order_number, customer_name, customer_phone, method, area, address, requested_date, requested_time, notes, staff_notes, inscription, design_image_url, subtotal, delivery_fee, discount_amount, discount_percent, total, deposit_paid, payment_method, driver_name, driver_phone, cancel_reason, status, schedule_updated_at, created_at, updated_at, order_items(id, name_ar, name_en, quantity, unit_price, options_ar, notes, product_id)";

type Row = Record<string, unknown> & { order_items?: unknown[] };

const toOrder = (row: Row): SalesOrder => ({
  ...(row as unknown as Omit<SalesOrder, "items">),
  subtotal: Number(row['subtotal'] ?? 0),
  delivery_fee: Number(row['delivery_fee'] ?? 0),
  discount_amount: Number(row['discount_amount'] ?? 0),
  discount_percent: Number(row['discount_percent'] ?? 0),
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
  /** Delivery zone name; the fee is resolved from the trusted zone table. */
  area?: string | null;
  delivery_fee?: number;
  driver_name?: string | null;
  driver_phone?: string | null;
  deposit_paid?: number;
  payment_method?: PaymentMethod | null;
};

const STATUSES: SalesStatus[] = [
  "new",
  "confirmed",
  "baking",
  "ready",
  "out_for_delivery",
  "completed",
  "delivered",
  "cancelled",
];
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "cliq", "visa"];

/** Only these columns may be written through this endpoint. Money that needs an
 * admin grant (subtotal, total, discounts, item prices) goes through
 * applyOrderDiscount / updateSalesOrderItemPrice so caps and audit logs apply. */
const buildOrderPatch = (input: OrderPatch): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) throw new Error("حالة غير صالحة · Invalid status");
    patch['status'] = input.status;
  }
  if (input.cancel_reason !== undefined) {
    patch['cancel_reason'] = input.cancel_reason ? String(input.cancel_reason).slice(0, 500) : null;
  }
  if (input.method !== undefined) {
    if (input.method !== "delivery" && input.method !== "pickup") {
      throw new Error("طريقة غير صالحة · Invalid method");
    }
    patch['method'] = input.method;
  }
  if (input.delivery_fee !== undefined) {
    const fee = Number(input.delivery_fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000) {
      throw new Error("أجرة توصيل غير صالحة · Invalid delivery fee");
    }
    patch['delivery_fee'] = fee;
  }
  // Selecting a zone sets the fee from the trusted table, overriding any sent fee.
  if (input.area !== undefined) {
    if (input.area === null || input.area === "") {
      patch['area'] = null;
    } else {
      const area = String(input.area).trim().replace(/\s+/g, " ");
      const zoneFee = feeForArea(area);
      if (zoneFee === null) throw new Error("منطقة غير صالحة · Invalid delivery area");
      patch['area'] = area;
      patch['delivery_fee'] = zoneFee;
    }
  }
  if (input.deposit_paid !== undefined) {
    const deposit = Number(input.deposit_paid);
    if (!Number.isFinite(deposit) || deposit < 0 || deposit > 100000) {
      throw new Error("عربون غير صالح · Invalid deposit");
    }
    patch['deposit_paid'] = deposit;
  }
  if (input.payment_method !== undefined) {
    if (input.payment_method !== null && !PAYMENT_METHODS.includes(input.payment_method)) {
      throw new Error("طريقة دفع غير صالحة · Invalid payment method");
    }
    patch['payment_method'] = input.payment_method;
  }
  if (input.driver_name !== undefined) {
    patch['driver_name'] = input.driver_name ? String(input.driver_name).slice(0, 120) : null;
  }
  if (input.driver_phone !== undefined) {
    patch['driver_phone'] = input.driver_phone ? String(input.driver_phone).slice(0, 40) : null;
  }

  return patch;
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
    const clean = buildOrderPatch(data);
    if (Object.keys(clean).length === 0) {
      throw new Error("لا يوجد تغيير · Nothing to update");
    }
    const { data: row, error } = await context.supabase
      .from("orders")
      .update(clean as never)
      .eq("id", data.orderId)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return toOrder(row as Row);
  });


export const updateSalesOrderItemPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; orderId: string; newUnitPrice: number }) => {
    if (!input?.itemId) throw new Error("itemId is required");
    if (!input?.orderId) throw new Error("orderId is required");
    const price = Number(input.newUnitPrice);
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      throw new Error("سعر غير صالح · Invalid price");
    }
    return { itemId: String(input.itemId), orderId: String(input.orderId), newUnitPrice: price };
  })
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);

    // Price overrides are a per-employee privilege granted by an admin.
    const { resolveAuthorization, writeAudit, staffName } = await import("@/lib/authorization.functions");
    const auth = await resolveAuthorization(context as never);
    if (!auth.allow_price_override) {
      throw new Error("تحتاج تصريح المدير لتعديل السعر · Requires admin authorization");
    }

    const { data: before } = await context.supabase
      .from("order_items")
      .select("unit_price, quantity, product_id, order_id")
      .eq("id", data.itemId)
      .single();
    if (!before || before.order_id !== data.orderId) {
      throw new Error("عنصر غير موجود · Order item not found");
    }

    // The per-product allow list configured by the admin is enforced here, not in the UI.
    const { canEditProductPrice } = await import("@/lib/permissions.functions");
    if (!(await canEditProductPrice(context as never, before.product_id))) {
      throw new Error("غير مصرّح بتعديل سعر هذا المنتج · Not authorised to reprice this product");
    }

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

    const order = toOrder(updatedOrder as Row);

    await writeAudit({
      order_id: order.id,
      order_number: order.order_number,
      staff_user_id: context.userId,
      staff_name: staffName(context as never),
      action: "price_override",
      original_amount: Number(before?.unit_price ?? 0),
      modified_amount: data.newUnitPrice,
      discount_percent: null,
      reason: "Unit price adjusted on the sales desk",
    });

    return order;
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
