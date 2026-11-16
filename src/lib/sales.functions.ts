import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, getPortalAccess, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";
import { getStaffCodeForUser, serializeValidStorageUrls } from "@/lib/server-shared";
import type { OrderModification } from "@/lib/order-modifications";
import { getPaymentMethodLabel, type PaymentMethod, type SalesStatus } from "@/lib/order-status";
import {
  buildOrderPatch,
  buildOriginalOrderBaseline,
  createBaselineModIfNeeded,
  type OrderPatch,
} from "@/lib/sales-helpers";
import { roundJod } from "@/lib/currency";
import { staffRpcError } from "@/lib/server-log";
import {
  aggregateShiftReport,
  cleanText,
  type ShiftOrderSourceRow,
  type ShiftPaymentSourceRow,
} from "@/lib/validators";

/** The order desk: sales, social media and admins all manage the same orders. */
const SALES_ROLES: StaffRoleName[] = ["sales", "admin", "social"];

export type { PaymentMethod, SalesStatus };

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
  modifications?: OrderModification[] | null;
  version?: number;
  recipient_name?: string | null;
};

const SELECT =
  "id, order_number, staff_code, queue_rank, order_name, recipient_name, sender_phone, recipient_phone, last_edited_at, customer_name, customer_phone, method, area, address, requested_date, requested_time, notes, staff_notes, inscription, card_note, final_photo_requested, confirmation_message, design_image_url, subtotal, delivery_fee, discount_amount, discount_percent, total, deposit_paid, payment_method, driver_name, driver_phone, cancel_reason, status, schedule_updated_at, created_at, updated_at, modifications, version, order_items(id, name_ar, name_en, quantity, unit_price, options_ar, notes, product_id)";

type Row = Record<string, unknown> & { order_items?: unknown[] };

const toOrder = (row: Row): SalesOrder => ({
  ...(row as unknown as Omit<SalesOrder, "items">),
  subtotal: Number(row["subtotal"] ?? 0),
  delivery_fee: Number(row["delivery_fee"] ?? 0),
  discount_amount: Number(row["discount_amount"] ?? 0),
  discount_percent: Number(row["discount_percent"] ?? 0),
  total: Number(row["total"] ?? 0),
  deposit_paid: Number(row["deposit_paid"] ?? 0),
  version: Number(row["version"] ?? 1),
  recipient_name: (row["recipient_name"] as string | null) ?? null,
  modifications: (row["modifications"] as OrderModification[] | null) ?? null,
  items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
    id: String(item["id"]),
    name_ar: String(item["name_ar"]),
    name_en: String(item["name_en"]),
    quantity: Number(item["quantity"] ?? 1),
    unit_price: Number(item["unit_price"] ?? 0),
    options_ar: (item["options_ar"] as string[]) ?? [],
    notes: (item["notes"] as string | null) ?? null,
    product_id: (item["product_id"] as string | null) ?? null,
  })),
});

/** Confirms the signed-in user may use the sales interface. */
export const getSalesAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getPortalAccess(context, ["sales", "admin"]));

export const getSalesOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { page?: number }) => ({
    page: Math.max(Number(input?.page) || 1, 1),
  }))
  .handler(async ({ data, context }): Promise<SalesOrder[]> => {
    await assertRole(context, SALES_ROLES);
    const limit = 300;
    const offset = (data.page - 1) * limit;

    const { data: rows, error } = await context.supabase
      .from("orders")
      .select(SELECT)
      .order("requested_date", { ascending: false })
      .order("requested_time", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => toOrder(row as Row));
  });

export type CreateSalesOrderInput = {
  client_request_id?: string | null;
  customer_name: string;
  customer_phone: string;
  order_name?: string | null | undefined;
  recipient_name?: string | null | undefined;
  sender_phone?: string | null | undefined;
  recipient_phone?: string | null | undefined;
  method: "delivery" | "pickup";
  area?: string | null | undefined;
  address?: string | null | undefined;
  requested_date: string;
  requested_time: string;
  notes?: string | null | undefined;
  staff_notes?: string | null | undefined;
  inscription?: string | null | undefined;
  card_note?: string | null | undefined;
  design_image_url?: string | null | undefined;
  payment_method?: PaymentMethod | null | undefined;
  deposit_paid?: number | undefined;
  discount_percent?: number | undefined;
  discount_amount?: number | undefined;
  items: {
    productId?: string | null | undefined;
    name_ar: string;
    quantity: number;
    unit_price: number;
    options_ar?: string[] | undefined;
    notes?: string | null | undefined;
  }[];
};

export const createSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: CreateSalesOrderInput) => {
    if (!input?.customer_name?.trim())
      throw new Error("اسم العميل مطلوب · Customer name is required");
    if (!input?.customer_phone?.trim())
      throw new Error("رقم هاتف العميل مطلوب · Customer phone is required");
    if (!input?.requested_date) throw new Error("التاريخ مطلوب · Date is required");
    if (!input?.requested_time) throw new Error("الوقت مطلوب · Time is required");
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("أضف صنفاً واحداً على الأقل · Add at least one item");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);

    // Check idempotency (IDEM-01)
    if (data.client_request_id) {
      const { data: existing } = await context.supabase
        .from("orders")
        .select(SELECT)
        .eq("client_request_id" as any, data.client_request_id)
        .maybeSingle();
      if (existing) return toOrder(existing as Row);
    }

    const subtotal = roundJod(
      data.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    );
    const deliveryFee =
      data.method === "delivery" && data.area ? roundJod(feeForArea(data.area) ?? 0) : 0;
    const discountAmount = roundJod(data.discount_amount ?? 0);
    const discountPercent = data.discount_percent ?? 0;

    // Per-product price edit check (allows official base price AND official size prices)
    const { canEditProductPrice } = await import("@/lib/permissions.functions");
    const { isOfficialCatalogPrice } = await import("@/lib/order-pricing");
    for (const item of data.items) {
      const pid = (item as any).productId || (item as any).product_id;
      if (pid) {
        const canEdit = await canEditProductPrice(context as never, pid);
        if (!canEdit) {
          const { data: catProd } = await context.supabase
            .from("products")
            .select("price, sizes")
            .eq("id", pid)
            .maybeSingle();
          if (catProd && !isOfficialCatalogPrice(Number(item.unit_price), catProd)) {
            throw new Error(
              "غير مصرّح: لا تملك صلاحية تعديل سعر هذا المنتج · You are not allowed to edit the price for this product",
            );
          }
        }
      }
    }

    // Strict staff discount authorization
    const { resolveAuthorization } = await import("@/lib/authorization.functions");
    const authz = await resolveAuthorization(context as never);
    if (!authz.isAdmin) {
      if (discountAmount > 0 || discountPercent > 0) {
        if (!authz.allow_custom_discount) {
          throw new Error(
            "غير مصرّح: لا تملك صلاحية تطبيق الخصم · You are not allowed to apply discounts",
          );
        }
        const computedPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : discountPercent;
        if (
          discountPercent > authz.max_discount_percent ||
          computedPercent > authz.max_discount_percent + 0.01
        ) {
          throw new Error(
            `الخصم المطلوب يتجاوز الحد الأقصى المسموح لك (${authz.max_discount_percent}%) · Discount exceeds your limit (${authz.max_discount_percent}%)`,
          );
        }
      }
    }

    const total = roundJod(Math.max(subtotal + deliveryFee - discountAmount, 0));

    // Respect cashier / customer deposit input; clamp safely between 0 and total
    const rawDeposit = roundJod(Number(data.deposit_paid) || 0);
    const finalDeposit = roundJod(Math.min(Math.max(rawDeposit, 0), total));

    const staffCode = await getStaffCodeForUser(context.supabase, context.userId);
    const requestedTime =
      data.requested_time.length === 5 ? `${data.requested_time}:00` : data.requested_time;

    let createdId: string | null = null;
    const { data: atomicResult, error: atomicErr } = await context.supabase.rpc(
      "create_staff_order_atomic",
      {
        p_order: {
          customer_name: data.customer_name.trim(),
          customer_phone: data.customer_phone.trim(),
          order_name: data.order_name?.trim() || null,
          recipient_name: data.recipient_name?.trim() || data.order_name?.trim() || null,
          sender_phone: data.sender_phone?.trim() || null,
          recipient_phone: data.recipient_phone?.trim() || null,
          method: data.method,
          area: data.method === "delivery" ? data.area || null : null,
          address: data.method === "delivery" ? data.address?.trim() || null : null,
          requested_date: data.requested_date,
          requested_time: requestedTime,
          notes: data.notes?.trim() || null,
          staff_notes: data.staff_notes?.trim() || null,
          inscription: data.inscription?.trim() || null,
          card_note: data.card_note?.trim() || null,
          design_image_url: serializeValidStorageUrls(data.design_image_url, false, 10),
          payment_method: data.payment_method || null,
          deposit_paid: finalDeposit,
          subtotal,
          delivery_fee: deliveryFee,
          discount_amount: discountAmount,
          discount_percent: discountPercent,
          total,
          staff_code: staffCode,
          client_request_id: data.client_request_id || null,
          user_id: context.userId,
          staff_name: staffCode ? `موظف #${staffCode}` : "موظف مبيعات",
        },
        p_items: data.items.map((item) => ({
          product_id: item.productId || null,
          name_ar: item.name_ar,
          name_en: item.name_ar,
          unit_price: item.unit_price,
          quantity: item.quantity,
          options_ar: item.options_ar || [],
          options_en: item.options_ar || [],
          notes: item.notes || null,
        })),
      } as any,
    );

    if (!atomicErr && atomicResult && (atomicResult as any).id) {
      createdId = (atomicResult as any).id;
    } else {
      throw new Error(
        atomicErr?.message || "تعذّر حفظ الطلب عبر الإجراء الذري · Could not save order atomically",
      );
    }

    const { data: fullOrder, error: fetchError } = await context.supabase
      .from("orders")
      .select(SELECT)
      .eq("id", createdId!)
      .single();

    if (fetchError || !fullOrder)
      throw new Error(fetchError?.message || "تعذّر استرجاع الطلب المحفوظ");

    return toOrder(fullOrder as Row);
  });

export type { OrderModification, OrderPatch };
export { buildOriginalOrderBaseline };

export const updateSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: OrderPatch) => {
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

    // Fetch existing order details to compute modification diffs for KDS and audit
    const { data: existing } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_method, driver_name, driver_phone, customer_name, customer_phone, requested_date, requested_time, method, area, address, order_name, sender_phone, recipient_phone, deposit_paid, notes, inscription, staff_notes, card_note, total, modifications",
      )
      .eq("id", data.orderId)
      .single();

    const newDiffs: OrderModification[] = [];
    if (existing) {
      const currentMods = (existing.modifications as OrderModification[] | null) ?? [];
      const nowIso = new Date().toISOString();

      // Preserve the original order baseline on the first modification.
      newDiffs.push(
        ...(await createBaselineModIfNeeded(currentMods, nowIso, async () => {
          const { data: existingItems } = await context.supabase
            .from("order_items")
            .select("name_ar, name_en, quantity, unit_price, options_ar, notes")
            .eq("order_id", data.orderId);
          return buildOriginalOrderBaseline(existing, existingItems ?? []);
        })),
      );

      if (clean["customer_name"] !== undefined) {
        const oldVal = (existing.customer_name ?? "").trim();
        const newVal = String(clean["customer_name"] ?? "").trim();
        if (oldVal && newVal && oldVal !== newVal) {
          newDiffs.push({
            field: "اسم العميل",
            oldValue: oldVal,
            newValue: newVal,
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["customer_phone"] !== undefined) {
        const oldVal = (existing.customer_phone ?? "").trim();
        const newVal = String(clean["customer_phone"] ?? "").trim();
        if (oldVal && newVal && oldVal !== newVal) {
          newDiffs.push({
            field: "رقم هاتف العميل",
            oldValue: oldVal,
            newValue: newVal,
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["order_name"] !== undefined) {
        const oldVal = (existing.order_name ?? "").trim();
        const newVal = String(clean["order_name"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "اسم المستلم / الطلب",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["sender_phone"] !== undefined) {
        const oldVal = (existing.sender_phone ?? "").trim();
        const newVal = String(clean["sender_phone"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "هاتف المرسل",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["recipient_phone"] !== undefined) {
        const oldVal = (existing.recipient_phone ?? "").trim();
        const newVal = String(clean["recipient_phone"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "هاتف المستلم",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["requested_date"] !== undefined) {
        const oldVal = existing.requested_date ?? "";
        const newVal = String(clean["requested_date"]);
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "تاريخ التسليم",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["requested_time"] !== undefined) {
        const oldVal = (existing.requested_time ?? "").slice(0, 5);
        const newVal = String(clean["requested_time"]).slice(0, 5);
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "وقت التسليم",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (
        clean["method"] !== undefined ||
        clean["area"] !== undefined ||
        clean["address"] !== undefined
      ) {
        const oldMethod =
          existing.method === "delivery"
            ? `توصيل (${existing.area || "عمان"}${existing.address ? ` - ${existing.address}` : ""})`
            : "استلام من المحل";
        const newM = clean["method"] !== undefined ? clean["method"] : existing.method;
        const newArea = clean["area"] !== undefined ? clean["area"] : existing.area;
        const newAddr = clean["address"] !== undefined ? clean["address"] : existing.address;
        const newMethod =
          newM === "delivery"
            ? `توصيل (${newArea || "عمان"}${newAddr ? ` - ${newAddr}` : ""})`
            : "استلام من المحل";
        if (oldMethod !== newMethod) {
          newDiffs.push({
            field: "طريقة الاستلام / العنوان",
            oldValue: oldMethod,
            newValue: newMethod,
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["notes"] !== undefined) {
        const oldVal = (existing.notes ?? "").trim();
        const newVal = String(clean["notes"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "الملاحظات",
            oldValue: oldVal || "بدون ملاحظات",
            newValue: newVal || "بدون ملاحظات",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["inscription"] !== undefined) {
        const oldVal = (existing.inscription ?? "").trim();
        const newVal = String(clean["inscription"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "الكتابة على الكيك",
            oldValue: oldVal || "بدون كتابة",
            newValue: newVal || "بدون كتابة",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["staff_notes"] !== undefined) {
        const oldVal = (existing.staff_notes ?? "").trim();
        const newVal = String(clean["staff_notes"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "ملاحظات الموظفين",
            oldValue: oldVal || "بدون ملاحظات",
            newValue: newVal || "بدون ملاحظات",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["card_note"] !== undefined) {
        const oldVal = (existing.card_note ?? "").trim();
        const newVal = String(clean["card_note"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "كرت الإهداء / ملاحظة الكرت",
            oldValue: oldVal || "بدون كرت",
            newValue: newVal || "بدون كرت",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["driver_name"] !== undefined) {
        const oldVal = (existing.driver_name ?? "").trim();
        const newVal = String(clean["driver_name"] ?? "").trim();
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "سائق التوصيل",
            oldValue: oldVal || "غير محدد",
            newValue: newVal || "غير محدد",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["payment_method"] !== undefined) {
        const oldVal = String(existing.payment_method ?? "");
        const newVal = String(clean["payment_method"] ?? "");
        if (oldVal !== newVal) {
          const pmLabel = (val: string) => (val ? getPaymentMethodLabel(val) : "غير محدد");
          newDiffs.push({
            field: "طريقة الدفع",
            oldValue: pmLabel(oldVal),
            newValue: pmLabel(newVal),
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      if (clean["status"] !== undefined) {
        const oldVal = String(existing.status ?? "");
        const newVal = String(clean["status"] ?? "");
        if (oldVal !== newVal) {
          newDiffs.push({
            field: "حالة الطلب",
            oldValue: oldVal,
            newValue: newVal,
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }

      // Saves that changed no tracked field record nothing: no extra query, and
      // no empty diff pushed to the kitchen.
      // modifications logic is now handled strictly in the DB to avoid RACE-01
    }

    const { data: row, error } = await context.supabase.rpc("patch_sales_order_atomic", {
      p_order_id: data.orderId,
      p_patch: clean as any,
      p_new_mods: newDiffs,
      p_user_id: context.userId,
      p_expected_version: data.expected_version ?? null,
    } as any);
    if (error) {
      throw staffRpcError(
        "sales.updateSalesOrder.rpc",
        error,
        "تعذّر تحديث الطلب · Could not update order",
      );
    }

    // After RPC update, fetch the fully mapped record
    const { data: fullOrder, error: fetchError } = await context.supabase
      .from("orders")
      .select(SELECT)
      .eq("id", data.orderId)
      .single();
    if (fetchError || !fullOrder) {
      throw staffRpcError(
        "sales.updateSalesOrder.fetch",
        fetchError ?? new Error("Missing updated order"),
        "تعذّر تحميل الطلب المحدّث · Failed to load updated order",
      );
    }

    const order = toOrder(fullOrder as Row);
    if (row && typeof (row as any).version === "number") {
      order.version = (row as any).version;
    }
    return order;
  });

export type OrderItemPatch = {
  itemId: string;
  orderId: string;
  expectedVersion?: number | null;
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
  .validator((input: OrderItemPatch) => {
    if (!input?.itemId) throw new Error("itemId is required");
    if (!input?.orderId) throw new Error("orderId is required");
    const out: OrderItemPatch = { itemId: String(input.itemId), orderId: String(input.orderId) };
    if (input.expectedVersion !== undefined) {
      out.expectedVersion = input.expectedVersion !== null ? Number(input.expectedVersion) : null;
    }
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
      out.notes = input.notes !== null ? String(input.notes).trim().slice(0, 2000) : "";
    }
    // Customer extras (candles, balloons, acrylic, filling…) — cleaned and capped.
    if (input.options !== undefined) {
      if (!Array.isArray(input.options)) throw new Error("إضافات غير صالحة · Invalid options");
      out.options = input.options
        .map((option) =>
          String(option ?? "")
            .replace(/[\r\n]+/g, " ")
            .trim()
            .slice(0, 200),
        )
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
      .select("unit_price, quantity, product_id, order_id, name_ar, options_ar, notes")
      .eq("id", data.itemId)
      .single();
    if (!before || before.order_id !== data.orderId) {
      throw new Error("عنصر غير موجود · Order item not found");
    }

    // Per-product price lock: an admin can deny repricing of specific products.
    if (
      data.newUnitPrice !== undefined &&
      Number(data.newUnitPrice) !== Number(before.unit_price ?? 0)
    ) {
      const { canEditProductPrice } = await import("@/lib/permissions.functions");
      const allowed = await canEditProductPrice(
        context as never,
        (before.product_id as string | null) ?? null,
      );
      if (!allowed) {
        throw new Error(
          "لا تملك صلاحية تعديل سعر هذا المنتج · You are not allowed to change this product's price",
        );
      }
    }

    // Fetch order modifications to update them
    const { data: existingOrder } = await context.supabase
      .from("orders")
      .select("modifications")
      .eq("id", data.orderId)
      .single();
    const currentMods = (existingOrder?.modifications as OrderModification[] | null) ?? [];
    const nowIso = new Date().toISOString();
    const newDiffs: OrderModification[] = [];

    // Build inline old/new summary for kitchen
    const oldNameLabel = (before.name_ar as string | null) ?? "";
    const oldOptions = (before.options_ar as string[] | null) ?? [];
    const oldSummary = [oldNameLabel, ...oldOptions].filter(Boolean).join(" - ");

    const newNameLabel = data.name ?? oldNameLabel;
    const newOptions = data.options ?? oldOptions;
    const newSummary = [newNameLabel, ...newOptions].filter(Boolean).join(" - ");

    newDiffs.push(
      ...(await createBaselineModIfNeeded(currentMods, nowIso, async () => {
        const { data: allItems } = await context.supabase
          .from("order_items")
          .select("name_ar, name_en, quantity, unit_price, options_ar, notes")
          .eq("order_id", data.orderId);
        return (
          (allItems ?? [])
            .map(
              (it: any) =>
                `${it.quantity}× ${it.name_ar}${it.options_ar?.length ? ` (${(it.options_ar as string[]).join("، ")})` : ""}`,
            )
            .join(" + ") || "بدون أصناف"
        );
      })),
    );

    // Per-field granular diffs
    if (data.name !== undefined && data.name !== oldNameLabel) {
      newDiffs.push({
        field: "اسم الصنف",
        oldValue: oldNameLabel || "—",
        newValue: data.name || "—",
        updatedAt: nowIso,
        acknowledgedAt: null,
      });
    }

    if (data.quantity !== undefined && Number(data.quantity) !== Number(before.quantity)) {
      newDiffs.push({
        field: `كمية: ${oldNameLabel || "صنف"}`,
        oldValue: String(before.quantity ?? 1),
        newValue: String(data.quantity),
        updatedAt: nowIso,
        acknowledgedAt: null,
      });
    }

    if (data.options !== undefined) {
      const oldSet = new Set(oldOptions);
      const newSet = new Set(data.options);
      // Options removed
      for (const opt of oldOptions) {
        if (!newSet.has(opt)) {
          newDiffs.push({
            field: "خيار حُذف",
            oldValue: opt,
            newValue: "— (تم حذفه)",
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }
      // Options added
      for (const opt of data.options) {
        if (!oldSet.has(opt)) {
          newDiffs.push({
            field: "خيار جديد ✨",
            oldValue: "— (لم يكن موجودًا)",
            newValue: opt,
            updatedAt: nowIso,
            acknowledgedAt: null,
          });
        }
      }
    }

    if (data.notes !== undefined && (data.notes || null) !== (before.notes || null)) {
      newDiffs.push({
        field: "ملاحظة الصنف",
        oldValue: before.notes || "—",
        newValue: data.notes || "— (تم مسح الملاحظة)",
        updatedAt: nowIso,
        acknowledgedAt: null,
      });
    }

    const newPrice =
      data.newUnitPrice !== undefined ? data.newUnitPrice : Number(before.unit_price ?? 0);
    const newQty = data.quantity !== undefined ? data.quantity : Number(before.quantity ?? 1);

    const { data: rpcData, error: rpcError } = await context.supabase.rpc(
      "update_order_item_atomic",
      {
        p_order_id: data.orderId,
        p_item_id: data.itemId,
        p_unit_price: newPrice,
        p_quantity: newQty,
        p_expected_version: data.expectedVersion !== undefined ? data.expectedVersion : null,
        p_staff_name: staffName(context as never),
        p_reason: `تعديل صنف: ${data.name || before.name_ar}`,
        p_name_ar: data.name ?? null,
        p_name_en: data.name ?? null,
        p_options_ar: data.options ? (data.options as never) : null,
        p_options_en: data.options ? (data.options as never) : null,
        p_notes: data.notes ?? null,
        p_new_mods: newDiffs.length > 0 ? (newDiffs as never) : null,
      },
    );

    if (rpcError) {
      throw staffRpcError(
        "sales.updateSalesOrderItemPrice.rpc",
        rpcError,
        "تعذّر تعديل الصنف · Could not update order item",
      );
    }

    const { data: updatedOrder, error: orderError } = await context.supabase
      .from("orders")
      .select(SELECT)
      .eq("id", data.orderId)
      .single();
    if (orderError) {
      throw staffRpcError(
        "sales.updateSalesOrderItemPrice.fetch",
        orderError,
        "تعذّر تحميل الطلب بعد التعديل · Could not reload order",
      );
    }

    const order = toOrder(updatedOrder as Row);
    if (rpcData && typeof (rpcData as any).version === "number") {
      order.version = (rpcData as any).version;
    }
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
  .validator(
    (input: { orderId: string; lines: RebuildLine[]; expectedVersion?: number | null }) => {
      if (!input?.orderId) throw new Error("orderId is required");
      if (!Array.isArray(input.lines) || input.lines.length === 0) {
        throw new Error("أضف صنفاً واحداً على الأقل · Add at least one item");
      }
      if (input.lines.length > 40) throw new Error("عدد الأصناف كبير · Too many items");
      const lines: RebuildLine[] = input.lines.map((line) => {
        const name = String(line?.name ?? "")
          .trim()
          .slice(0, 2000);
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
              .map((option) =>
                String(option ?? "")
                  .replace(/[\r\n]+/g, " ")
                  .trim()
                  .slice(0, 200),
              )
              .filter(Boolean)
              .slice(0, 30)
          : [];
        const productId = line?.productId ? String(line.productId) : null;
        const notes = line?.notes ? String(line.notes).trim().slice(0, 2000) || null : null;
        return { productId, name, quantity, unitPrice, options, notes };
      });
      return {
        orderId: String(input.orderId),
        lines,
        expectedVersion:
          input.expectedVersion !== undefined
            ? input.expectedVersion !== null
              ? Number(input.expectedVersion)
              : null
            : null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<SalesOrder> => {
    await assertRole(context, SALES_ROLES);
    const { writeAudit, staffName } = await import("@/lib/authorization.functions");

    const { data: existing, error: readError } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, requested_date, requested_time, method, area, address, order_name, sender_phone, recipient_phone, deposit_paid, notes, inscription, staff_notes, card_note, total, delivery_fee, discount_amount, discount_percent, subtotal, modifications",
      )
      .eq("id", data.orderId)
      .single();
    if (readError || !existing) throw new Error("طلب غير موجود · Order not found");

    const { data: oldItemsData } = await context.supabase
      .from("order_items")
      .select("name_ar, name_en, quantity, unit_price, options_ar, notes")
      .eq("order_id", data.orderId);

    const oldSummary =
      (oldItemsData ?? [])
        .map(
          (it: any) =>
            `${it.quantity}× ${it.name_ar}${it.options_ar?.length ? ` (${it.options_ar.join(" ، ")})` : ""}`,
        )
        .join(" + ") || "بدون أصناف";

    const newSummary =
      data.lines
        .map(
          (line) =>
            `${line.quantity}× ${line.name}${line.options?.length ? ` (${line.options.join(" ، ")})` : ""}`,
        )
        .join(" + ") || "بدون أصناف";

    const currentMods = (existing.modifications as OrderModification[] | null) ?? [];
    const nowIso = new Date().toISOString();
    const baselineDiffs = await createBaselineModIfNeeded(currentMods, nowIso, async () =>
      buildOriginalOrderBaseline(existing, oldItemsData ?? []),
    );

    const newDiffs = [
      ...baselineDiffs,
      ...(oldSummary !== newSummary
        ? [
            {
              field: "أصناف الطلب / الحشوة",
              oldValue: oldSummary,
              newValue: newSummary,
              updatedAt: nowIso,
              acknowledgedAt: null,
            },
          ]
        : []),
    ];

    // Per-product price lock: staff denied repricing must keep an official catalog price (base or size).
    const { canEditProductPrice } = await import("@/lib/permissions.functions");
    const { isOfficialCatalogPrice } = await import("@/lib/order-pricing");
    const pricedProductIds = Array.from(
      new Set(data.lines.map((line) => line.productId).filter((id): id is string => Boolean(id))),
    );
    if (pricedProductIds.length > 0) {
      const { data: catalog } = await context.supabase
        .from("products")
        .select("id, price, sizes")
        .in("id", pricedProductIds);
      const catalogProducts = new Map<string, { price: number | null; sizes: unknown }>(
        (catalog ?? []).map((row: { id: string; price: number | null; sizes?: unknown }) => [
          row.id,
          { price: row.price, sizes: row.sizes },
        ]),
      );
      for (const productId of pricedProductIds) {
        const allowed = await canEditProductPrice(context as never, productId);
        if (allowed) continue;
        const lockedProduct = catalogProducts.get(productId);
        const mismatched = data.lines.some(
          (line) =>
            line.productId === productId &&
            lockedProduct !== undefined &&
            !isOfficialCatalogPrice(Number(line.unitPrice), lockedProduct),
        );
        if (mismatched) {
          throw new Error(
            "لا تملك صلاحية تعديل سعر هذا المنتج · You are not allowed to change this product's price",
          );
        }
      }
    }

    const subtotal = roundJod(
      data.lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0),
    );
    const deliveryFee =
      existing.method === "delivery" ? roundJod(Number(existing.delivery_fee ?? 0)) : 0;
    const discountPercent = Number(existing.discount_percent ?? 0);
    const discountAmount =
      discountPercent > 0
        ? roundJod((subtotal * discountPercent) / 100)
        : roundJod(Math.min(Number(existing.discount_amount ?? 0), subtotal));
    const total = roundJod(Math.max(subtotal + deliveryFee - discountAmount, 0));

    // DB-03: Atomic Rebuild
    const { data: rpcData, error: rpcError } = await context.supabase.rpc(
      "rebuild_sales_order_atomic",
      {
        p_order_id: data.orderId,
        p_lines: data.lines.map((line) => ({
          product_id: line.productId,
          name_ar: line.name,
          name_en: line.name,
          unit_price: line.unitPrice,
          quantity: line.quantity,
          options_ar: line.options ?? [],
          options_en: line.options ?? [],
          notes: line.notes,
        })),
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee,
        p_discount_amount: discountAmount,
        p_total: total,
        p_user_id: context.userId,
        p_new_mods: newDiffs,
        p_expected_version: data.expectedVersion,
      },
    );
    if (rpcError) {
      throw staffRpcError(
        "sales.replaceSalesOrderItems.rpc",
        rpcError,
        "تعذّر استبدال أصناف الطلب · Could not replace order items",
      );
    }

    const { data: row, error: orderError } = await context.supabase
      .from("orders")
      .select(SELECT)
      .eq("id", data.orderId)
      .single();
    if (orderError) {
      throw staffRpcError(
        "sales.replaceSalesOrderItems.fetch",
        orderError,
        "تعذّر تحميل الطلب بعد إعادة البناء · Could not reload rebuilt order",
      );
    }

    const order = toOrder(row as Row);
    if (rpcData && typeof (rpcData as any).version === "number") {
      order.version = (rpcData as any).version;
    }
    await writeAudit(context as never, {
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
  .validator((input: { date: string }) => {
    if (!input?.date) throw new Error("date is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<ShiftReport> => {
    await assertRole(context, SALES_ROLES);
    // 1. Shift payments collected on this date regardless of delivery date (Amman Asia/Amman UTC+03:00)
    const startIso = `${data.date}T00:00:00.000+03:00`;
    const endIso = `${data.date}T23:59:59.999+03:00`;
    const SHIFT_PAGE_SIZE = 1000;

    const allPaymentRows: ShiftPaymentSourceRow[] = [];
    for (let from = 0; ; from += SHIFT_PAGE_SIZE) {
      const { data: page, error: paymentErr } = await context.supabase
        .from("order_payments")
        .select("amount, payment_method, payment_type, status")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .eq("status", "confirmed")
        .order("id", { ascending: true })
        .range(from, from + SHIFT_PAGE_SIZE - 1);

      if (paymentErr) {
        throw staffRpcError(
          "sales.getShiftReport.payments",
          paymentErr,
          "تعذّر تحميل حركات الدفع · Could not load shift payments",
        );
      }
      const chunk = (page ?? []) as ShiftPaymentSourceRow[];
      allPaymentRows.push(...chunk);
      if (chunk.length < SHIFT_PAGE_SIZE) break;
    }

    // 2. Orders scheduled for delivery on this date (paginated beyond PostgREST 1000-row cap)
    const allOrderRows: ShiftOrderSourceRow[] = [];
    for (let from = 0; ; from += SHIFT_PAGE_SIZE) {
      const { data: page, error: orderErr } = await context.supabase
        .from("orders")
        .select("status, total, deposit_paid")
        .eq("requested_date", data.date)
        .order("id", { ascending: true })
        .range(from, from + SHIFT_PAGE_SIZE - 1);

      if (orderErr) {
        throw staffRpcError(
          "sales.getShiftReport.orders",
          orderErr,
          "تعذّر تحميل طلبات التقرير · Could not load shift orders",
        );
      }
      const chunk = (page ?? []) as ShiftOrderSourceRow[];
      allOrderRows.push(...chunk);
      if (chunk.length < SHIFT_PAGE_SIZE) break;
    }

    return aggregateShiftReport(allPaymentRows, allOrderRows, data.date);
  });

/**
 * Permanently deletes a single sales order along with its items, tokens, and audit records.
 */
export const deleteSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("رقم معرّف الطلب مطلوب · orderId is required");
    return { orderId: String(input.orderId) };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: rpcError } = await supabaseAdmin.rpc("delete_sales_order_atomic", {
      target_order_id: data.orderId,
    });
    if (rpcError) {
      throw staffRpcError(
        "sales.deleteSalesOrder",
        rpcError,
        "تعذّر حذف الطلب · Could not delete order",
      );
    }

    return { ok: true, orderId: data.orderId };
  });

/**
 * Permanently clears and wipes ALL sales orders from the database.
 * Used for cleaning test data and starting fresh.
 */
export const clearAllSalesOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: rpcError } = await supabaseAdmin.rpc("clear_all_sales_orders_atomic");
    if (rpcError) {
      throw staffRpcError(
        "sales.clearAllSalesOrders",
        rpcError,
        "تعذّر مسح الطلبات · Could not clear sales orders",
      );
    }

    return { ok: true, count: 0, message: "تم مسح وتنظيف كافة الطلبات بنجاح ✅" };
  });

export type RecordPaymentInput = {
  orderId: string;
  amount: number;
  paymentMethod?: PaymentMethod | null | undefined;
  paymentType?: "deposit" | "remainder" | "full" | "refund" | undefined;
  referenceNumber?: string | null | undefined;
  notes?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
};

/**
 * Records a financial payment transaction (deposit, remainder, or refund) in the order_payments ledger
 * and updates the order's deposit_paid balance and optimistic locking version atomically.
 */
export const recordOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: RecordPaymentInput) => {
    if (!input?.orderId) throw new Error("رقم الطلب مطلوب · Order ID is required");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("المبلغ يجب أن يكون أكبر من صفر · Payment amount must be greater than zero");
    }
    return {
      orderId: String(input.orderId),
      amount: roundJod(amount),
      paymentMethod: input.paymentMethod || "cash",
      paymentType: input.paymentType || "remainder",
      referenceNumber: input.referenceNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      idempotencyKey: input.idempotencyKey?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SALES_ROLES);
    const staffCode = await getStaffCodeForUser(context.supabase, context.userId);

    const { data: result, error } = await context.supabase.rpc("record_order_payment_atomic", {
      p_order_id: data.orderId,
      p_amount: data.amount,
      p_payment_method: data.paymentMethod,
      p_payment_type: data.paymentType,
      p_status: "confirmed",
      p_reference: data.referenceNumber,
      p_notes: data.notes,
      p_staff_user_id: context.userId,
      p_staff_name: staffCode ? `موظف #${staffCode}` : "موظف مبيعات",
      p_idempotency_key: data.idempotencyKey || null,
    } as any);

    if (error) {
      throw staffRpcError(
        "sales.recordOrderPayment.rpc",
        error,
        "تعذّر تسجيل الدفعة في الدفتر المالي · Could not record payment",
      );
    }

    const { data: fullOrder, error: fetchErr } = await context.supabase
      .from("orders")
      .select(SELECT)
      .eq("id", data.orderId)
      .single();
    if (fetchErr || !fullOrder) {
      throw staffRpcError(
        "sales.recordOrderPayment.fetch",
        fetchErr ?? new Error("Missing order"),
        "تعذّر تحميل الطلب · Failed to load order",
      );
    }
    const order = toOrder(fullOrder as Row);
    if (result && typeof (result as any).version === "number") {
      order.version = (result as any).version;
    }
    return order;
  });
