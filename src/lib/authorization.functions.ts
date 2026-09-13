import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, getRoles, type StaffRoleName } from "@/lib/role-guard";
import { emailToUsername } from "@/lib/username";

const SALES_ROLES: StaffRoleName[] = ["sales", "admin"];

export type StaffAuthorization = {
  allow_price_override: boolean;
  allow_custom_discount: boolean;
  max_discount_percent: number;
};

export type StaffAuthorizationRow = StaffAuthorization & {
  user_id: string;
  username: string;
  roles: string[];
};

export type AuditEntry = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  staff_name: string;
  action: string;
  original_amount: number | null;
  modified_amount: number | null;
  discount_percent: number | null;
  reason: string | null;
  created_at: string;
};

const ADMIN_AUTHORIZATION: StaffAuthorization = {
  allow_price_override: true,
  allow_custom_discount: true,
  max_discount_percent: 100,
};

const NO_AUTHORIZATION: StaffAuthorization = {
  allow_price_override: false,
  allow_custom_discount: false,
  max_discount_percent: 0,
};

type Ctx = { supabase: any; userId: string; claims: Record<string, unknown> };

const staffName = (context: Ctx) =>
  emailToUsername(typeof context.claims['email'] === "string" ? (context.claims['email'] as string) : "") ||
  context.userId;

/** Resolves what a staff account is actually allowed to do with money. */
async function resolveAuthorization(context: Ctx): Promise<StaffAuthorization & { isAdmin: boolean }> {
  const roles = await getRoles(context);
  if (roles.includes("admin")) return { ...ADMIN_AUTHORIZATION, isAdmin: true };
  const { data } = await context.supabase
    .from("staff_permissions")
    .select("allow_price_override, allow_custom_discount, max_discount_percent")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!data) return { ...NO_AUTHORIZATION, isAdmin: false };
  return {
    allow_price_override: Boolean(data.allow_price_override),
    allow_custom_discount: Boolean(data.allow_custom_discount),
    max_discount_percent: Number(data.max_discount_percent ?? 0),
    isAdmin: false,
  };
}

/** Writes an audit row with the service role, so a signed-in account can never forge or edit it. */
async function writeAudit(entry: {
  order_id: string | null;
  order_number: string | null;
  staff_user_id: string;
  staff_name: string;
  action: string;
  original_amount: number | null;
  modified_amount: number | null;
  discount_percent: number | null;
  reason: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_logs").insert(entry as never);
  if (error) throw new Error(error.message);
}

export { resolveAuthorization, writeAudit, staffName };

/* ------------------------------- staff side ------------------------------- */

export const getMyAuthorization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => resolveAuthorization(context as unknown as Ctx));

/* ------------------------------- admin side ------------------------------- */

async function assertAdmin(context: Ctx) {
  await assertRole(context, ["admin"]);
}

export const listStaffAuthorizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffAuthorizationRow[]> => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: users }, { data: roleRows }, { data: perms }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("staff_permissions").select("user_id, allow_price_override, allow_custom_discount, max_discount_percent"),
    ]);

    const rolesByUser = new Map<string, string[]>();
    for (const row of roleRows ?? []) {
      const list = rolesByUser.get(row.user_id) ?? [];
      list.push(row.role as string);
      rolesByUser.set(row.user_id, list);
    }
    const permByUser = new Map((perms ?? []).map((row) => [row.user_id as string, row]));

    return (users?.users ?? [])
      .map((user) => {
        const roles = rolesByUser.get(user.id) ?? [];
        const perm = permByUser.get(user.id);
        return {
          user_id: user.id,
          username: emailToUsername(user.email) || user.id,
          roles,
          allow_price_override: Boolean(perm?.allow_price_override),
          allow_custom_discount: Boolean(perm?.allow_custom_discount),
          max_discount_percent: Number(perm?.max_discount_percent ?? 0),
        };
      })
      .filter((row) => row.roles.some((role) => role === "sales" || role === "admin"))
      .sort((a, b) => a.username.localeCompare(b.username));
  });

export const setStaffAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string } & Partial<StaffAuthorization>) => {
    if (!input?.userId) throw new Error("userId is required");
    const cap = input.max_discount_percent;
    if (cap !== undefined && (!Number.isFinite(cap) || cap < 0 || cap > 100)) {
      throw new Error("نسبة الخصم بين 0 و 100 · Discount cap must be between 0 and 100");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("staff_permissions")
      .select("allow_price_override, allow_custom_discount, max_discount_percent")
      .eq("user_id", data.userId)
      .maybeSingle();

    const next = {
      user_id: data.userId,
      allow_price_override: data.allow_price_override ?? Boolean(current?.allow_price_override),
      allow_custom_discount: data.allow_custom_discount ?? Boolean(current?.allow_custom_discount),
      max_discount_percent: data.max_discount_percent ?? Number(current?.max_discount_percent ?? 0),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("staff_permissions")
      .upsert(next as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return next;
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, order_id, order_number, staff_name, action, original_amount, modified_amount, discount_percent, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AuditEntry[];
  });

/* ------------------------------- discounting ------------------------------ */

export const applyOrderDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; percent: number; reason: string }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    const percent = Number(input.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error("نسبة الخصم بين 0 و 100 · Discount must be between 0 and 100");
    }
    if (percent > 0 && !input.reason?.trim()) {
      throw new Error("سبب الخصم مطلوب · A reason is required");
    }
    return { orderId: input.orderId, percent, reason: (input.reason ?? "").trim() };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertRole(ctx, SALES_ROLES);
    const auth = await resolveAuthorization(ctx);
    if (!auth.allow_custom_discount) {
      throw new Error("تحتاج تصريح المدير للخصم · Requires admin authorization");
    }
    if (data.percent > auth.max_discount_percent) {
      throw new Error(
        `الحد الأقصى للخصم ${auth.max_discount_percent}% · Maximum allowed discount is ${auth.max_discount_percent}%`,
      );
    }

    const { data: order, error: readError } = await context.supabase
      .from("orders")
      .select("id, order_number, subtotal, delivery_fee, method, total")
      .eq("id", data.orderId)
      .single();
    if (readError) throw new Error(readError.message);

    const subtotal = Number(order.subtotal ?? 0);
    const discountAmount = Number(((subtotal * data.percent) / 100).toFixed(2));

    const { error } = await context.supabase
      .from("orders")
      .update({ discount_amount: discountAmount, discount_percent: data.percent })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);

    await writeAudit({
      order_id: order.id,
      order_number: order.order_number,
      staff_user_id: ctx.userId,
      staff_name: staffName(ctx),
      action: "discount_applied",
      original_amount: Number(order.total ?? 0),
      modified_amount: Number(order.total ?? 0) - discountAmount,
      discount_percent: data.percent,
      reason: data.reason || null,
    });

    return { ok: true, discount_amount: discountAmount, discount_percent: data.percent };
  });

/* --------------------- one-time, one-hour customer link -------------------- */

const TOKEN_TTL_MS = 60 * 60 * 1000;

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const createOrderEditLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertRole(ctx, SALES_ROLES);

    const { data: order, error: readError } = await context.supabase
      .from("orders")
      .select("id, order_number")
      .eq("id", data.orderId)
      .single();
    if (readError) throw new Error(readError.message);

    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Any earlier link for this order dies the moment a new one is issued.
    await supabaseAdmin
      .from("order_edit_tokens")
      .update({ used_at: new Date().toISOString() } as never)
      .eq("order_id", data.orderId)
      .is("used_at", null);

    const { error } = await supabaseAdmin.from("order_edit_tokens").insert({
      order_id: data.orderId,
      token_hash: await hashToken(token),
      expires_at: expiresAt,
      created_by: ctx.userId,
    } as never);
    if (error) throw new Error(error.message);

    await writeAudit({
      order_id: order.id,
      order_number: order.order_number,
      staff_user_id: ctx.userId,
      staff_name: staffName(ctx),
      action: "edit_link_issued",
      original_amount: null,
      modified_amount: null,
      discount_percent: null,
      reason: "One-time customer edit link, valid 1 hour",
    });

    return { token, expires_at: expiresAt, order_number: order.order_number };
  });

type TokenRow = { id: string; order_id: string; expires_at: string; used_at: string | null };

async function loadToken(token: string): Promise<TokenRow> {
  if (!token || token.length < 32) throw new Error("رابط غير صالح · Invalid link");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("order_edit_tokens")
    .select("id, order_id, expires_at, used_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("رابط غير صالح · Invalid link");
  if (data.used_at) throw new Error("تم استخدام هذا الرابط · This link has already been used");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("انتهت صلاحية الرابط · This link has expired");
  }
  return data as unknown as TokenRow;
}

export const getOrderByEditToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }) => {
    const row = await loadToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("order_number, customer_name, customer_phone, requested_date, requested_time, notes, inscription, area, address, method, total")
      .eq("id", row.order_id)
      .single();
    if (error) throw new Error(error.message);
    return { order, expires_at: row.expires_at };
  });

export const submitOrderEdit = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; notes: string; inscription: string; customer_phone: string }) => ({
    token: String(input?.token ?? ""),
    notes: String(input?.notes ?? "").slice(0, 600),
    inscription: String(input?.inscription ?? "").slice(0, 200),
    customer_phone: String(input?.customer_phone ?? "").slice(0, 30),
  }))
  .handler(async ({ data }) => {
    const row = await loadToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        notes: data.notes.trim() || null,
        inscription: data.inscription.trim() || null,
        ...(data.customer_phone.trim() ? { customer_phone: data.customer_phone.trim() } : {}),
      } as never)
      .eq("id", row.order_id);
    if (error) throw new Error(error.message);

    // Single use: the link is locked the instant it is submitted.
    const { error: lockError } = await supabaseAdmin
      .from("order_edit_tokens")
      .update({ used_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (lockError) throw new Error(lockError.message);

    return { ok: true };
  });
