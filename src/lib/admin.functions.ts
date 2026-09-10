import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffRole = "admin" | "sales" | "kitchen" | "social";

export type StaffMember = {
  id: string;
  email: string;
  roles: StaffRole[];
  created_at: string;
  last_sign_in_at: string | null;
};

export type AdminProduct = {
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

export type OrderLog = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  method: string;
  requested_date: string;
  requested_time: string;
  total: number;
  deposit_paid: number;
  payment_method: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by: string | null;
};

export type AgentPerformance = {
  agent: string;
  orders: number;
  volume: number;
};

export type CustomerEntry = {
  phone: string;
  name: string;
  orders: number;
  spend: number;
  last_order: string;
};

export type AdminAnalytics = {
  revenue: { gross: number; collected: number; outstanding: number; orders: number; cancelled: number; avgOrder: number };
  payments: { method: string; orders: number; collected: number }[];
  active: OrderLog[];
  completed: OrderLog[];
  cancelled: OrderLog[];
  agents: AgentPerformance[];
  customers: CustomerEntry[];
};

const ACTIVE = ["new", "confirmed", "baking", "ready", "out_for_delivery"];
const DONE = ["delivered", "completed"];

/** True only while the database has no admin yet, so the one-time setup screen can run. */
export const getAdminSetupState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { needsSetup: (count ?? 0) === 0 };
});

/**
 * Creates the very first admin account. Refuses once any admin exists and always
 * requires the out-of-band ADMIN_SETUP_TOKEN, so a stranger who finds the page
 * cannot claim the account.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; token: string }) => {
    if (!input?.email?.trim()) throw new Error("البريد الإلكتروني مطلوب · Email is required");
    if (!input?.password || input.password.length < 8) {
      throw new Error("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
    }
    if (!input?.token?.trim()) throw new Error("رمز التهيئة مطلوب · Setup token is required");
    return { email: input.email.trim().toLowerCase(), password: input.password, token: input.token.trim() };
  })
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_SETUP_TOKEN"];
    if (!expected || data.token !== expected) {
      throw new Error("رمز التهيئة غير صحيح · Invalid setup token");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup already completed");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the admin account");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: { from: (t: string) => any }; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row: { role: string }) => row.role);
  if (!roles.includes("admin")) throw new Error("غير مصرّح · Not authorised");
  return roles as StaffRole[];
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((row) => row.role as StaffRole);
    return { allowed: roles.includes("admin"), roles };
  });

/* ---------------------------------- staff --------------------------------- */

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roleRows, error: roleError } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (roleError) throw new Error(roleError.message);
    const byUser = new Map<string, StaffRole[]>();
    for (const row of roleRows ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.role as StaffRole);
      byUser.set(row.user_id, list);
    }
    return users.users
      .map((user) => ({
        id: user.id,
        email: user.email ?? "—",
        roles: byUser.get(user.id) ?? [],
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      }))
      .filter((member) => member.roles.length > 0)
      .sort((a, b) => a.email.localeCompare(b.email));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; role: StaffRole }) => {
    if (!input?.email?.trim()) throw new Error("البريد الإلكتروني مطلوب · Email is required");
    if (!input?.password || input.password.length < 8) {
      throw new Error("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
    }
    if (!["admin", "sales", "kitchen", "social"].includes(input.role)) throw new Error("Invalid role");
    return { email: input.email.trim().toLowerCase(), password: input.password, role: input.role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    let reused = false;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (created?.user) {
      userId = created.user.id;
    } else {
      // The email may already belong to an existing account: update it instead of failing.
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = (existing?.users ?? []).find(
        (user) => (user.email ?? "").toLowerCase() === data.email,
      );
      if (!match) throw new Error(error?.message ?? "تعذّر إنشاء الحساب · Could not create the account");
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
        password: data.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(updateError.message);
      userId = match.id;
      reused = true;
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    return { ok: true, reused };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!input?.password || input.password.length < 8) {
      throw new Error("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: StaffRole }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!["admin", "sales", "kitchen", "social"].includes(input.role)) throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك · You cannot remove your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- products -------------------------------- */

const PRODUCT_SELECT =
  "id, slug, name_ar, name_en, description_ar, description_en, category, price, is_available, is_featured, sort_order";

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProduct[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("category")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ ...(row as AdminProduct), price: Number(row.price ?? 0) }));
  });

export type ProductInput = Omit<AdminProduct, "id"> & { id?: string };

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProductInput) => {
    if (!input?.name_ar?.trim() || !input?.name_en?.trim()) {
      throw new Error("الاسم بالعربية والإنجليزية مطلوب · Arabic and English names are required");
    }
    if (!input?.category?.trim()) throw new Error("التصنيف مطلوب · Category is required");
    if (!(Number(input.price) >= 0)) throw new Error("السعر غير صحيح · Invalid price");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- analytics -------------------------------- */

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, status, method, requested_date, requested_time, total, deposit_paid, payment_method, cancel_reason, created_at, created_by",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const rows: OrderLog[] = (data ?? []).map((row) => ({
      ...(row as unknown as OrderLog),
      total: Number(row.total ?? 0),
      deposit_paid: Number(row.deposit_paid ?? 0),
    }));

    let gross = 0;
    let collected = 0;
    let outstanding = 0;
    let orders = 0;
    const paymentMap = new Map<string, { orders: number; collected: number }>();
    const agentMap = new Map<string, { orders: number; volume: number }>();
    const customerMap = new Map<string, CustomerEntry>();

    for (const row of rows) {
      if (row.status !== "cancelled") {
        orders += 1;
        gross += row.total;
        collected += row.deposit_paid;
        outstanding += Math.max(row.total - row.deposit_paid, 0);
        const key = row.payment_method ?? "unpaid";
        const bucket = paymentMap.get(key) ?? { orders: 0, collected: 0 };
        bucket.orders += 1;
        bucket.collected += row.deposit_paid;
        paymentMap.set(key, bucket);

        const customer = customerMap.get(row.customer_phone) ?? {
          phone: row.customer_phone,
          name: row.customer_name,
          orders: 0,
          spend: 0,
          last_order: row.created_at,
        };
        customer.orders += 1;
        customer.spend += row.total;
        if (row.created_at > customer.last_order) {
          customer.last_order = row.created_at;
          customer.name = row.customer_name;
        }
        customerMap.set(row.customer_phone, customer);

        if (row.created_by) {
          const agent = agentMap.get(row.created_by) ?? { orders: 0, volume: 0 };
          agent.orders += 1;
          agent.volume += row.total;
          agentMap.set(row.created_by, agent);
        }
      }
    }

    let agentNames = new Map<string, string>();
    if (agentMap.size > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      agentNames = new Map((users?.users ?? []).map((user) => [user.id, user.email ?? user.id]));
    }

    return {
      revenue: {
        gross,
        collected,
        outstanding,
        orders,
        cancelled: rows.filter((row) => row.status === "cancelled").length,
        avgOrder: orders ? gross / orders : 0,
      },
      payments: ["cash", "cliq", "visa", "unpaid"].map((method) => ({
        method,
        orders: paymentMap.get(method)?.orders ?? 0,
        collected: paymentMap.get(method)?.collected ?? 0,
      })),
      active: rows.filter((row) => ACTIVE.includes(row.status)),
      completed: rows.filter((row) => DONE.includes(row.status)),
      cancelled: rows.filter((row) => row.status === "cancelled"),
      agents: [...agentMap.entries()]
        .map(([id, value]) => ({ agent: agentNames.get(id) ?? id, ...value }))
        .sort((a, b) => b.orders - a.orders),
      customers: [...customerMap.values()].sort((a, b) => b.last_order.localeCompare(a.last_order)),
    };
  });
