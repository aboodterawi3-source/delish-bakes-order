import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { feeForArea } from "@/lib/delivery-zones";
import { jordanDay } from "@/lib/date-filter";
import { getStaffCodeForUser, isValidStorageUrl, STORAGE_URL, extraList } from "@/lib/server-shared";
import { roundJod } from "@/lib/currency";

const SOCIAL_ROLES: StaffRoleName[] = ["social", "sales", "admin"];

export type SocialOrderInput = {
  client_request_id?: string | null;
  /** Short label shown in the orders list instead of the phone number. */
  order_name?: string | null;
  recipient_name?: string | null | undefined;
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
  /** Amman / other-governorate zone name, or delivery address */
  area?: string | null;
  address?: string | null;
  /** Custom delivery fee entered manually by staff */
  delivery_fee?: number | null;
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
    if (input.method === "delivery" && !input.area?.trim() && !input.address?.trim()) {
      throw new Error("عنوان وتفاصيل التوصيل مطلوبة · Delivery address is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SOCIAL_ROLES);
    const orderDetails = data.order_details.trim();
    // Original price agreed with the customer; the row total is recomputed in the DB.
    const unitPrice = roundJod(Math.min(Math.max(Number(data.unit_price) || 0, 0), 100000));
    const subtotal = roundJod(unitPrice * data.quantity);
    const address = data.method === "delivery" ? data.address?.trim() || data.area?.trim() || null : null;
    const area = data.method === "delivery" ? data.area?.trim() || data.address?.trim() || null : null;
    // Use manual delivery fee if provided by staff; otherwise resolve from zone table if available.
    const deliveryFee =
      data.method === "delivery"
        ? data.delivery_fee !== undefined && data.delivery_fee !== null
          ? roundJod(Math.max(0, Number(data.delivery_fee)))
          : area ? roundJod(feeForArea(area) ?? 0) : 0
        : 0;
    // A paid amount is stored for deposits and for CliQ payments alike.
    const deposit =
      data.payment_option === "cash" ? 0 : roundJod(Math.max(0, Number(data.deposit_paid) || 0));
    const paymentMethod = data.payment_option === "cash" ? "cash" : "cliq";
    const extrasAr = extraList(data.extras_ar);
    const extrasEn = extraList(data.extras_en);
    const designImage =
      typeof data.design_image_url === "string" &&
      (isValidStorageUrl(data.design_image_url) || STORAGE_URL.test(data.design_image_url.trim()))
        ? data.design_image_url.trim()
        : null;
    const receiptImage =
      typeof data.receipt_image_url === "string" &&
      (isValidStorageUrl(data.receipt_image_url) || STORAGE_URL.test(data.receipt_image_url.trim()))
        ? data.receipt_image_url.trim()
        : null;

    /** The order number comes from the database sequence (DL-1 onwards), so the
     * confirmation message is filled in right after the row exists. */
    const template =
      typeof data.confirmation_message === "string" && data.confirmation_message.trim()
        ? data.confirmation_message
        : null;

    const staffCode = await getStaffCodeForUser(context.supabase, context.userId);
    const initialMods = receiptImage
      ? [
          {
            field: "حوالة كليك",
            oldValue: "",
            newValue: "صورة الحوالة مرفقة",
            updatedAt: new Date().toISOString(),
          },
        ]
      : [];

    let orderId: string;
    let orderNumber: string;
    let orderTotal: number;
    let orderStaffCode: number | null = staffCode;

    const { data: atomicResult, error: atomicErr } = await context.supabase.rpc(
      "create_staff_order_atomic",
      {
        p_order: {
          customer_name: data.customer_name.trim(),
          customer_phone: data.customer_phone.trim(),
          order_name: data.order_name?.trim().slice(0, 160) || null,
          recipient_name: data.recipient_name?.trim() || null,
          sender_phone: data.sender_phone?.trim().slice(0, 40) || null,
          recipient_phone: data.recipient_phone?.trim().slice(0, 40) || null,
          method: data.method,
          area,
          address,
          payment_method: paymentMethod,
          deposit_paid: deposit,
          requested_date: data.requested_date,
          requested_time: data.requested_time,
          event_date: data.event_date?.trim() ? data.event_date : null,
          is_urgent: data.is_urgent,
          inscription: data.design_notes?.trim() || null,
          staff_notes: data.staff_notes?.trim() || null,
          card_note: data.card_note?.trim() || null,
          design_image_url: designImage || null,
          receipt_image_url: receiptImage || null,
          modifications: initialMods,
          subtotal,
          delivery_fee: deliveryFee,
          total: subtotal + deliveryFee,
          staff_code: staffCode,
          client_request_id: data.client_request_id || null,
          user_id: context.userId,
          staff_name: staffCode ? `موظف #${staffCode}` : "موظف سوشيال",
        },
        p_items: [
          {
            product_id: null,
            name_ar: orderDetails,
            name_en: orderDetails,
            unit_price: unitPrice,
            quantity: data.quantity,
            options_ar: [...(data.is_urgent ? ["مستعجل"] : []), ...extrasAr],
            options_en: [...(data.is_urgent ? ["Urgent"] : []), ...extrasEn],
            notes: data.design_notes?.trim() || null,
          },
        ],
      } as any,
    );

    if (atomicErr || !atomicResult || !(atomicResult as any).id) {
      throw new Error(atomicErr?.message || "تعذّر حفظ طلب السوشيال عبر المعاملة الذرية");
    }
    orderId = (atomicResult as any).id;
    orderNumber = (atomicResult as any).order_number;
    orderTotal = Number((atomicResult as any).total ?? subtotal + deliveryFee);

    const isDuplicate = Boolean((atomicResult as any).is_duplicate);
    if (isDuplicate) {
      // Idempotent retry: do not overwrite the confirmation message or alter previous state
      const { data: existingOrder } = await context.supabase
        .from("orders")
        .select("confirmation_message, staff_code, total")
        .eq("id", orderId)
        .single();
      return {
        id: orderId,
        order_number: orderNumber,
        total: Number(existingOrder?.total ?? orderTotal),
        confirmation_message: existingOrder?.confirmation_message || null,
        staff_code: existingOrder?.staff_code ?? orderStaffCode,
      };
    }

    // Now the sequence number exists, store the message that quotes it.
    const message = template
      ? template.replace(/\{\{ORDER_NUMBER\}\}/g, orderNumber).slice(0, 8000)
      : null;
    if (message) {
      await context.supabase
        .from("orders")
        .update({ confirmation_message: message } as any)
        .eq("id", orderId);
    }

    return {
      id: orderId,
      order_number: orderNumber,
      total: orderTotal,
      confirmation_message: message,
      staff_code: orderStaffCode,
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
    const currentStaffCode = await getStaffCodeForUser(context.supabase, currentUserId);

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
