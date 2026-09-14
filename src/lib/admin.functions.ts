import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailToUsername, normalizeUsername, usernameToEmail } from "@/lib/username";

export type StaffRole = "admin" | "sales" | "kitchen" | "social";

function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("weak") || m.includes("easy to guess") || m.includes("pwned") || m.includes("leaked")) {
    return "كلمة المرور ضعيفة أو مكشوفة، اختر كلمة أقوى (8 أحرف مع أرقام ورموز) · Password is too weak or leaked, pick a stronger one (8+ chars with numbers and symbols)";
  }
  return message;
}


export type StaffMember = {
  id: string;
  username: string;
  roles: StaffRole[];
  created_at: string;
  last_sign_in_at: string | null;
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
 * Creates the very first admin account. Refuses once any admin exists.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string }) => {
    if (!normalizeUsername(input?.username ?? "")) throw new Error("اسم المستخدم مطلوب · Name is required");
    if (!input?.password || input.password.length < 8) {
      throw new Error("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
    }
    return { email: usernameToEmail(input.username), password: input.password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup already completed");

    // Reuse an existing account with the same name instead of failing on a duplicate.
    let userId: string | null = null;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created?.user) {
      userId = created.user.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find(
        (user) => (user.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!existing) throw new Error(authErrorMessage(error?.message ?? "Could not create the admin account"));
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(authErrorMessage(updateError.message));
      userId = existing.id;
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
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
        username: emailToUsername(user.email),
        roles: byUser.get(user.id) ?? [],
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      }))
      .filter((member) => member.roles.length > 0)
      .sort((a, b) => a.username.localeCompare(b.username));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; password: string; role: StaffRole }) => {
    if (!normalizeUsername(input?.username ?? "")) throw new Error("اسم المستخدم مطلوب · Name is required");
    if (!input?.password || input.password.length < 8) {
      throw new Error("كلمة المرور 8 أحرف على الأقل · Password must be at least 8 characters");
    }
    if (!["admin", "sales", "kitchen", "social"].includes(input.role)) throw new Error("Invalid role");
    return { email: usernameToEmail(input.username), password: input.password, role: input.role };
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
      // The name may already belong to an existing account: update it instead of failing.
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = (existing?.users ?? []).find(
        (user) => (user.email ?? "").toLowerCase() === data.email,
      );
      if (!match) throw new Error(authErrorMessage(error?.message ?? "تعذّر إنشاء الحساب · Could not create the account"));
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
        password: data.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(authErrorMessage(updateError.message));
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
    if (error) throw new Error(authErrorMessage(error.message));
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
      agentNames = new Map((users?.users ?? []).map((user) => [user.id, emailToUsername(user.email) || user.id]));
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
