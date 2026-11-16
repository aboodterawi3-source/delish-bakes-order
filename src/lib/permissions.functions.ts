import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, getRoles } from "@/lib/role-guard";
import type { ServerAuthContext } from "@/lib/server-shared";

export type ProductPermissionRecord = {
  id: string;
  user_id: string;
  product_id: string;
  can_edit_price: boolean;
  product_name_ar?: string;
  product_name_en?: string;
};

/**
 * Per-product price-edit allow list.
 * A missing row means "allowed"; an explicit row with can_edit_price = false denies.
 * Admins are always allowed.
 */
export async function canEditProductPrice(
  context: ServerAuthContext,
  productId: string | null | undefined,
): Promise<boolean> {
  const roles = await getRoles(context);
  if (roles.includes("admin")) return true;
  if (!productId) return true;

  const { data, error } = await context.supabase
    .from("sales_product_permissions")
    .select("can_edit_price")
    .eq("user_id", context.userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return true;
  return Boolean(data.can_edit_price);
}

/** Admin-only: the full employee × product price-edit matrix. */
export const getStaffPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as ServerAuthContext;
    await assertRole(ctx, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: staffData }, { data: productsData }, { data: permData }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["sales", "admin"]),
      supabaseAdmin
        .from("products")
        .select("id, name_ar, name_en, price, category")
        .order("sort_order", { ascending: true }),
      (supabaseAdmin as any)
        .from("sales_product_permissions")
        .select("user_id, product_id, can_edit_price"),
    ]);

    const products = productsData ?? [];
    const staffUserIds = Array.from(new Set((staffData ?? []).map((s) => s.user_id as string)));
    const perms = (permData ?? []) as {
      user_id: string;
      product_id: string;
      can_edit_price: boolean;
    }[];

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const userId of staffUserIds) {
      matrix[userId] = {};
      for (const prod of products) {
        const row = perms.find((p) => p.user_id === userId && p.product_id === prod.id);
        matrix[userId]![prod.id] = row ? row.can_edit_price : true;
      }
    }

    return { staffUserIds, products, matrix };
  });

/** Admin-only: grant or revoke price editing for one employee and one product. */
export const updateStaffProductPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; productId: string; canEditPrice: boolean }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!input?.productId) throw new Error("productId is required");
    return {
      userId: String(input.userId),
      productId: String(input.productId),
      canEditPrice: Boolean(input.canEditPrice),
    };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as ServerAuthContext;
    await assertRole(ctx, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("sales_product_permissions").upsert(
      {
        user_id: data.userId,
        product_id: data.productId,
        can_edit_price: data.canEditPrice,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,product_id" },
    );
    if (error) throw new Error(error.message);

    return {
      success: true,
      userId: data.userId,
      productId: data.productId,
      canEditPrice: data.canEditPrice,
    };
  });
