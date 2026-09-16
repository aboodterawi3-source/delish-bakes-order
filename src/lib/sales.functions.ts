import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";

/** The order desk: sales, social media and admins all manage the same orders. */
const SALES_ROLES: StaffRoleName[] = ["sales", "admin", "social"];


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
  /** Numeric ID of the employee who created the order (manager-assigned). */
  staff_code: number | null;
  /** Short label for the order, shown in the list instead of the phone number. */
  order_name: string | null;
  sender_phone: string | null;
  recipient_phone: string | null;
  /** Set every time staff edit the order, so the list shows an edit badge. */
  last_edited_at: string | null;
  /** Manual queue position set by staff with the up/down buttons. */
  queue_rank: number | null;
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
  "id, order_number, staff_code, queue_rank, order_name, sender_phone, recipient_phone, last_edited_at, customer_name, customer_phone, method, area, address, requested_date, requested_time, notes, staff_notes, inscription, card_note, final_photo_requested, confirmation_message, design_image_url, subtotal, delivery_fee, discount_amount, discount_percent, total, deposit_paid, payment_method, driver_name, driver_phone, cancel_reason, status, schedule_updated_at, created_at, updated_at, order_items(id, name_ar, name_en, quantity, unit_price, options_ar, notes, product_id)";

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
  /** Card writing, final-photo request and the generated confirmation message. */
  card_note?: string | null;
  final_photo_requested?: boolean;
  confirmation_message?: string | null;
  /** Delivery-order identity fields, editable from Sales and Social alike. */
  order_name?: string | null;
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
  if (input.card_note !== undefined) {
    patch['card_note'] = input.card_note ? String(input.card_note).slice(0, 1000) : null;
  }
  if (input.final_photo_requested !== undefined) {
    patch['final_photo_requested'] = Boolean(input.final_photo_requested);
  }
  if (input.confirmation_message !== undefined) {
    patch['confirmation_message'] = input.confirmation_message
      ? String(input.confirmation_message).slice(0, 8000)
      : null;
  }

  // Free-text order identity fields — trimmed and length-capped.
  const text = (value: unknown, max: number) => {
    const clean = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
    return clean ? clean.slice(0, max) : null;
  };
  if (input.order_name !== undefined) patch['order_name'] = text(input.order_name, 160);
  if (input.sender_phone !== undefined) patch['sender_phone'] = text(input.sender_phone, 40);
  if (input.recipient_phone !== undefined) patch['recipient_phone'] = text(input.recipient_phone, 40);
  if (input.address !== undefined) patch['address'] = text(input.address, 500);
  if (input.notes !== undefined) patch['notes'] = text(input.notes, 2000);
  if (input.staff_notes !== undefined) patch['staff_notes'] = text(input.staff_notes, 2000);
  if (input.inscription !== undefined) patch['inscription'] = text(input.inscription, 500);
  if (input.customer_name !== undefined) {
    const name = text(input.customer_name, 160);
    if (!name) throw new Error("اسم العميل مطلوب · Customer name is required");
    patch['customer_name'] = name;
  }
  if (input.customer_phone !== undefined) {
    const phone = text(input.customer_phone, 40);
    if (!phone) throw new Error("رقم الهاتف مطلوب · Customer phone is required");
    patch['customer_phone'] = phone;
  }
  if (input.requested_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.requested_date))) {
      throw new Error("تاريخ غير صالح · Invalid date");
    }
    patch['requested_date'] = input.requested_date;
  }
  if (input.requested_time !== undefined) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(input.requested_time))) {
      throw new Error("وقت غير صالح · Invalid time");
    }
    patch['requested_time'] = input.requested_time;
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
    // Every desk edit is stamped so the list and printouts show the edit badge.
    clean['last_edited_at'] = new Date().toISOString();
    clean['last_edited_by'] = context.userId;
    const { data: row, error } = await context.supabase
      .from("orders")
      .update(clean as never)
      .eq("id", data.orderId)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return toOrder(row as Row);
  });


export type OrderItemPatch = {
  itemId: string;
  orderId: string;
  newUnitPrice?: number;
  quantity?: number;
  name?: string;
  notes?: string | null;
  /** Customer extras: candles, balloons, acrylic topper, filling, any request. */
  options?: string[];
};

/** Order-desk staff may correct any line: price, quantity, description, notes. */
export const updateSalesOrderItemPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrderItemPatch) => {
    if (!input?.itemId) throw new Error("itemId is required");
    if (!input?.orderId) throw new Error("orderId is required");
    const out: OrderItemPatch = { itemId: String(input.itemId), orderId: String(input.orderId) };
    if (input.newUnitPrice !== undefined) {
      const price = Number(input.newUnitPrice);
      if (!Number.isFinite(price) || price < 0 || price > 100000) {
        throw new Error("سعر غير صالح · Invalid price");
      }
      out.newUnitPrice = price;
    }
    if (input.quantity !== undefined) {
      const qty = Math.trunc(Number(input.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
        throw new Error("كمية غير صالحة · Invalid quantity");
      }
      out.quantity = qty;
    }
    if (input.name !== undefined) {
      const name = String(input.name).trim().slice(0, 2000);
      if (!name) throw new Error("وصف الصنف مطلوب · Item description is required");
      out.name = name;
    }
    if (input.notes !== undefined) {
      out.notes = input.notes ? String(input.notes).trim().slice(0, 2000) || null : null;
    }
    // Customer extras (candles, balloons, acrylic, filling…) — cleaned and capped.
    if (input.options !== undefined) {
      if (!Array.isArray(input.options)) throw new Error("إضافات غير صالحة · Invalid options");
      out.options = input.options
        .map((option) => String(option ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 30);
    }
    return out;
  })
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);

    const { writeAudit, staffName } = await import("@/lib/authorization.functions");

    const { data: before } = await context.supabase
      .from("order_items")
      .select("unit_price, quantity, product_id, order_id")
      .eq("id", data.itemId)
      .single();
    if (!before || before.order_id !== data.orderId) {
      throw new Error("عنصر غير موجود · Order item not found");
    }

    const itemPatch: Record<string, unknown> = {};
    if (data.newUnitPrice !== undefined) itemPatch['unit_price'] = data.newUnitPrice;
    if (data.quantity !== undefined) itemPatch['quantity'] = data.quantity;
    if (data.name !== undefined) {
      itemPatch['name_ar'] = data.name;
      itemPatch['name_en'] = data.name;
    }
    if (data.notes !== undefined) itemPatch['notes'] = data.notes;
    if (data.options !== undefined) {
      itemPatch['options_ar'] = data.options;
      itemPatch['options_en'] = data.options;
    }
    if (Object.keys(itemPatch).length === 0) {
      throw new Error("لا يوجد تغيير · Nothing to update");
    }

    const { error: itemError } = await context.supabase
      .from("order_items")
      .update(itemPatch as never)
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
      .update({
        subtotal,
        total,
        last_edited_at: new Date().toISOString(),
        last_edited_by: context.userId,
      } as never)
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
      modified_amount: data.newUnitPrice ?? Number(before?.unit_price ?? 0),
      discount_percent: null,
      reason: "Order line edited on the order desk",
    });

    return order;
  });

/** One rebuilt order line coming from the website-style modification screen. */
export type RebuildLine = {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  options?: string[];
  notes?: string | null;
};

/**
 * Rebuilds the whole order from the website-style builder: the old lines are
 * cleared and replaced with the freshly configured ones, then totals recalc.
 */
export const replaceSalesOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; lines: RebuildLine[] }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error("أضف صنفاً واحداً على الأقل · Add at least one item");
    }
    if (input.lines.length > 40) throw new Error("عدد الأصناف كبير · Too many items");
    const lines: RebuildLine[] = input.lines.map((line) => {
      const name = String(line?.name ?? "").trim().slice(0, 2000);
      if (!name) throw new Error("وصف الصنف مطلوب · Item description is required");
      const quantity = Math.trunc(Number(line?.quantity ?? 1));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1000) {
        throw new Error("كمية غير صالحة · Invalid quantity");
      }
      const unitPrice = Number(line?.unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) {
        throw new Error("سعر غير صالح · Invalid price");
      }
      const options = Array.isArray(line?.options)
        ? line.options
            .map((option) => String(option ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200))
            .filter(Boolean)
            .slice(0, 30)
        : [];
      const productId = line?.productId ? String(line.productId) : null;
      const notes = line?.notes ? String(line.notes).trim().slice(0, 2000) || null : null;
      return { productId, name, quantity, unitPrice, options, notes };
    });
    return { orderId: String(input.orderId), lines };
  })
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);
    const { writeAudit, staffName } = await import("@/lib/authorization.functions");

    const { data: existing, error: readError } = await context.supabase
      .from("orders")
      .select("id, order_number, method, delivery_fee, discount_amount, subtotal")
      .eq("id", data.orderId)
      .single();
    if (readError || !existing) throw new Error("طلب غير موجود · Order not found");

    const { error: deleteError } = await context.supabase
      .from("order_items")
      .delete()
      .eq("order_id", data.orderId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await context.supabase.from("order_items").insert(
      data.lines.map((line) => ({
        order_id: data.orderId,
        product_id: line.productId,
        name_ar: line.name,
        name_en: line.name,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        options_ar: line.options ?? [],
        options_en: line.options ?? [],
        notes: line.notes,
      })) as never,
    );
    if (insertError) throw new Error(insertError.message);

    const subtotal = data.lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);
    const deliveryFee = existing.method === "delivery" ? Number(existing.delivery_fee ?? 0) : 0;
    const total = Math.max(subtotal + deliveryFee - Number(existing.discount_amount ?? 0), 0);

    const { data: row, error: orderError } = await context.supabase
      .from("orders")
      .update({
        subtotal,
        total,
        last_edited_at: new Date().toISOString(),
        last_edited_by: context.userId,
      } as never)
      .eq("id", data.orderId)
      .select(SELECT)
      .single();
    if (orderError) throw new Error(orderError.message);

    const order = toOrder(row as Row);
    await writeAudit({
      order_id: order.id,
      order_number: order.order_number,
      staff_user_id: context.userId,
      staff_name: staffName(context as never),
      action: "order_rebuilt",
      original_amount: Number(existing.subtotal ?? 0),
      modified_amount: subtotal,
      discount_percent: null,
      reason: "Order rebuilt from the website-style modification screen",
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

/* ------------------------------- order history ------------------------------ */

export type HistoryRow = {
  id: string;
  order_number: string;
  staff_code: number | null;
  order_name: string | null;
  customer_name: string;
  customer_phone: string;
  method: "delivery" | "pickup";
  area: string | null;
  requested_date: string;
  requested_time: string;
  status: SalesStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  deposit_paid: number;
  items: string;
  created_at: string;
};

/**
 * Full order archive for the history table: every past and new order inside the
 * chosen date range, ready to browse or export.
 */
export const listOrderHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; status?: SalesStatus | "all" }) => {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!day.test(String(input?.from)) || !day.test(String(input?.to))) {
      throw new Error("نطاق تاريخ غير صالح · Invalid date range");
    }
    const status =
      input.status && input.status !== "all" && STATUSES.includes(input.status) ? input.status : "all";
    return { from: input.from, to: input.to, status } as const;
  })
  .handler(async ({ data, context }): Promise<HistoryRow[]> => {
    await assertRole(context, SALES_ROLES);
    let query = context.supabase
      .from("orders")
      .select(
        "id, order_number, staff_code, order_name, customer_name, customer_phone, method, area, requested_date, requested_time, status, payment_method, subtotal, delivery_fee, discount_amount, total, deposit_paid, created_at, order_items(name_ar, quantity)",
      )
      .gte("requested_date", data.from)
      .lte("requested_date", data.to)
      .order("requested_date", { ascending: false })
      .order("requested_time", { ascending: false })
      .limit(2000);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const record = row as unknown as Record<string, unknown> & {
        order_items?: { name_ar: string; quantity: number }[];
      };
      return {
        ...(record as unknown as Omit<HistoryRow, "items">),
        subtotal: Number(record['subtotal'] ?? 0),
        delivery_fee: Number(record['delivery_fee'] ?? 0),
        discount_amount: Number(record['discount_amount'] ?? 0),
        total: Number(record['total'] ?? 0),
        deposit_paid: Number(record['deposit_paid'] ?? 0),
        items: (record.order_items ?? [])
          .map((item) => `${item.quantity} × ${item.name_ar}`)
          .join(" · "),
      };
    });
  });
