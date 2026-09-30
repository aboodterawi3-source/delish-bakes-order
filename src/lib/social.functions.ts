import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";
import { jordanDay } from "@/lib/date-filter";

const SOCIAL_ROLES: StaffRoleName[] = ["social", "sales", "admin"];

export type SocialOrderInput = {
  /** Short label shown in the orders list instead of the phone number. */
  order_name?: string | null;
  /** Delivery order: who sends and who receives. */
  sender_phone?: string | null;
  recipient_phone?: string | null;
  customer_name: string;
  customer_phone: string;
  order_details: string;
  quantity: number;
  /** Original price per unit agreed with the customer (السعر الأصلي). */
  unit_price?: number | null;
  /** Text written on the accompanying card. */
  card_note?: string | null;
  /** Customer asked for a final photo before delivery. */
  final_photo_requested?: boolean;
  /** Ready-to-send confirmation message stored with the order. */
  confirmation_message?: string | null;
  method: "pickup" | "delivery";
  /** Amman / other-governorate zone name; the fee is resolved server-side. */
  area?: string | null;
  address?: string | null;
  /** Cash on delivery, fully paid via CliQ, or a deposit via CliQ. */
  payment_option: "cash" | "cliq_full" | "cliq_deposit";
  /** Amount already collected via CliQ (full payment or deposit). */
  deposit_paid?: number | null;
  requested_date: string;
  requested_time: string;
  event_date?: string | null;
  is_urgent: boolean;
  design_notes?: string | null;
  staff_notes?: string | null;
  /** Chosen extras (candles, balloons, acrylic topper, gift phones…) — labels only. */
  extras_ar?: string[] | null;
  extras_en?: string[] | null;
  /** Signed link of the customer's reference photo. */
  design_image_url?: string | null;
  /** Signed link of the CliQ transfer / payment receipt photo. */
  receipt_image_url?: string | null;
};

const MAX_EXTRAS = 20;
const MAX_EXTRA_LENGTH = 160;
/** Signed link returned by uploadDesignImage for photos kept in Cloud storage. */
const STORAGE_URL =
  /^https:\/\/zmeijwtivmniqpwyxezk\.supabase\.co\/storage\/v1\/object\/sign\/order-designs\/[\w./-]+\?[\w=%&.-]+$/i;

/** Extras are plain labels; keep them short, single-line and bounded. */
const extraList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.replace(/[\r\n]+/g, " ").trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, MAX_EXTRAS)
    .map((entry) => entry.slice(0, MAX_EXTRA_LENGTH));
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
    if (!input?.requested_date || !input?.requested_time)
      throw new Error("تاريخ ووقت التسليم مطلوب");
    if (!Number.isFinite(input.quantity) || input.quantity < 1) throw new Error("الكمية غير صحيحة");
    if (!["cash", "cliq_full", "cliq_deposit"].includes(input?.payment_option as string)) {
      throw new Error("طريقة الدفع مطلوبة · Payment method is required");
    }
    if (input.method === "delivery" && !input.area?.trim()) {
      throw new Error("منطقة التوصيل مطلوبة · Delivery area is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SOCIAL_ROLES);
    const orderDetails = data.order_details.trim();
    // Original price agreed with the customer; the row total is recomputed in the DB.
    const unitPrice = Math.min(Math.max(Number(data.unit_price) || 0, 0), 100000);
    const subtotal = unitPrice * data.quantity;
    const area = data.method === "delivery" ? data.area?.trim() || null : null;
    // The browser never sets the fee: it is resolved from the trusted zone table.
    const deliveryFee = area ? (feeForArea(area) ?? 0) : 0;
    // A paid amount is stored for deposits and for CliQ payments alike.
    const deposit =
      data.payment_option === "cash" ? 0 : Math.max(0, Number(data.deposit_paid) || 0);
    const paymentMethod = data.payment_option === "cash" ? "cash" : "cliq";
    const extrasAr = extraList(data.extras_ar);
    const extrasEn = extraList(data.extras_en);
    const designImage =
      typeof data.design_image_url === "string" && STORAGE_URL.test(data.design_image_url.trim())
        ? data.design_image_url.trim()
        : null;
    const receiptImage =
      typeof data.receipt_image_url === "string" && STORAGE_URL.test(data.receipt_image_url.trim())
        ? data.receipt_image_url.trim()
        : null;

    /** The order number comes from the database sequence (DL-1 onwards), so the
     * confirmation message is filled in right after the row exists. */
    const template =
      typeof data.confirmation_message === "string" && data.confirmation_message.trim()
        ? data.confirmation_message
        : null;

    const { data: codeRow } = await context.supabase
      .from("staff_codes")
      .select("staff_code")
      .eq("user_id", context.userId)
      .maybeSingle();

    const staffCode = codeRow?.staff_code ? Number(codeRow.staff_code) : null;

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .insert({
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        order_name: data.order_name?.trim().slice(0, 160) || null,
        sender_phone: data.sender_phone?.trim().slice(0, 40) || null,
        recipient_phone: data.recipient_phone?.trim().slice(0, 40) || null,
        method: data.method,
        area,
        address: data.method === "delivery" ? data.address?.trim() || null : null,
        payment_method: paymentMethod,
        deposit_paid: deposit,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        event_date: data.event_date?.trim() ? data.event_date : null,
        is_urgent: data.is_urgent,
        inscription: data.design_notes?.trim() || null,
        staff_notes: data.staff_notes?.trim() || null,
        card_note: data.card_note?.trim() || null,
        final_photo_requested: Boolean(data.final_photo_requested),
        design_image_url: designImage || receiptImage,
        modifications: receiptImage
          ? [
              {
                field: "حوالة كليك",
                oldValue: "",
                newValue: "صورة الحوالة مرفقة",
                updatedAt: new Date().toISOString(),
              },
            ]
          : [],
        subtotal,
        delivery_fee: deliveryFee,
        total: subtotal + deliveryFee,
        status: "new",
        created_by: context.userId,
        staff_code: staffCode,
      })
      .select("id, order_number, total, staff_code")
      .single();
    if (orderError) throw new Error(orderError.message);

    // Now the sequence number exists, store the message that quotes it.
    const message = template
      ? template.replace(/\{\{ORDER_NUMBER\}\}/g, order.order_number).slice(0, 8000)
      : null;
    if (message) {
      await context.supabase
        .from("orders")
        .update({ confirmation_message: message })
        .eq("id", order.id);
    }

    const { error: itemError } = await context.supabase.from("order_items").insert({
      order_id: order.id,
      product_id: null,
      name_ar: orderDetails,
      name_en: orderDetails,
      unit_price: unitPrice,
      quantity: data.quantity,
      options_ar: [...(data.is_urgent ? ["مستعجل"] : []), ...extrasAr],
      options_en: [...(data.is_urgent ? ["Urgent"] : []), ...extrasEn],
      notes: data.design_notes?.trim() || null,
    });

    if (itemError) throw new Error(itemError.message);

    return {
      id: order.id,
      order_number: order.order_number,
      total: Number(order.total ?? 0),
      confirmation_message: message,
      staff_code: (order.staff_code as number | null) ?? null,
    };
  });

export type SocialStaffStatsResult = {
  currentStaff: {
    userId: string;
    staffCode: number | null;
    username: string;
  };
  myStats: {
    todayCount: number;
    todaySales: number;
    weekCount: number;
    monthCount: number;
    monthSales: number;
    totalCount: number;
    totalSales: number;
  };
  myOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    total: number;
    deposit_paid: number;
    status: string;
    payment_method: string | null;
    order_name: string | null;
    requested_date: string;
    requested_time: string;
    created_at: string;
    created_by: string | null;
    staff_code: number | null;
    method: string;
    area: string | null;
  }>;
};

/**
 * Returns personal order counts and order log for the authenticated social staff member.
 * Strictly scoped to the current staff member for complete privacy.
 */
export const getSocialStaffStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SocialStaffStatsResult> => {
    await assertRole(context, SOCIAL_ROLES);

    const currentUserId = context.userId;

    // 1. Get current staff code
    const { data: codeRow } = await context.supabase
      .from("staff_codes")
      .select("staff_code")
      .eq("user_id", currentUserId)
      .maybeSingle();

    const currentStaffCode = codeRow?.staff_code ? Number(codeRow.staff_code) : null;

    // Get current user's email/username without admin service key
    let currentUsername = currentStaffCode ? `موظفة #${currentStaffCode}` : "موظفة السوشال";
    try {
      const { data: userData } = await context.supabase.auth.getUser();
      const email = userData?.user?.email || "";
      if (email) {
        const rawUser = email.includes("@") ? (email.split("@")[0] ?? email) : email;
        if (rawUser) {
          currentUsername = rawUser.replace(/[._-]/g, " ");
        }
      }
    } catch {
      // fallback
    }

    // 2. Fetch orders strictly created by this staff member
    let query = context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, total, deposit_paid, status, payment_method, order_name, requested_date, requested_time, created_at, created_by, staff_code, method, area",
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (currentStaffCode) {
      query = query.or(`created_by.eq.${currentUserId},staff_code.eq.${currentStaffCode}`);
    } else {
      query = query.eq("created_by", currentUserId);
    }

    const { data: myOrdersRaw, error: ordersError } = await query;
    if (ordersError) throw new Error(ordersError.message);

    const myOrders = myOrdersRaw ?? [];

    const now = new Date();
    const todayStr = jordanDay(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthPrefix = todayStr.slice(0, 7);

    // Day and month boundaries are Jordan dates: created_at is stored in UTC, so
    // comparing the raw ISO string would mis-file evening orders under tomorrow.
    const myTodayOrders = myOrders.filter((o) => jordanDay(o.created_at) === todayStr);
    const myWeekOrders = myOrders.filter((o) => o.created_at && o.created_at >= sevenDaysAgo);
    const myMonthOrders = myOrders.filter((o) => jordanDay(o.created_at).startsWith(monthPrefix));

    // Cancelled orders are not revenue, so they never count towards the money totals.
    const sumSales = (rows: typeof myOrders) =>
      rows
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const myTodayTotal = sumSales(myTodayOrders);
    const myMonthTotal = sumSales(myMonthOrders);
    const myAllTimeTotal = sumSales(myOrders);

    return {
      currentStaff: {
        userId: currentUserId,
        staffCode: currentStaffCode,
        username: currentUsername,
      },
      myStats: {
        todayCount: myTodayOrders.length,
        todaySales: myTodayTotal,
        weekCount: myWeekOrders.length,
        monthCount: myMonthOrders.length,
        monthSales: myMonthTotal,
        totalCount: myOrders.length,
        totalSales: myAllTimeTotal,
      },
      myOrders: myOrders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        total: Number(o.total) || 0,
        deposit_paid: Number(o.deposit_paid) || 0,
        status: o.status,
        payment_method: o.payment_method,
        order_name: o.order_name,
        requested_date: o.requested_date,
        requested_time: o.requested_time,
        created_at: o.created_at,
        created_by: o.created_by,
        staff_code: (o.staff_code as number | null) ?? null,
        method: o.method,
        area: o.area,
      })),
    };
  });
