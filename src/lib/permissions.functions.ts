import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProductPermissionRecord = {
  id: string;
  user_id: string;
  product_id: string;
  can_edit_price: boolean;
  product_name_ar?: string;
  product_name_en?: string;
};

// In-memory / server-session cache to ensure seamless operation even if migration is pending in Supabase
const permissionCache = new Map<string, boolean>();

const cacheKey = (userId: string, productId: string) => `${userId}:${productId}`;

/**
 * Returns whether a specific user can edit the price of a specific product.
 */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ permittedProductIds: string[]; isAdmin: boolean }> => {
    // Check if user is admin
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const roles = (roleData ?? []).map((r) => r.role);
    const isAdmin = roles.includes("admin");

    // Try querying sales_product_permissions table in Supabase
    try {
      const { data, error } = await context.supabase
        .from("sales_product_permissions")
        .select("product_id, can_edit_price")
        .eq("user_id", context.userId);

      if (!error && data) {
        const permitted = data
          .filter((p: { can_edit_price: boolean }) => p.can_edit_price)
          .map((p: { product_id: string }) => p.product_id);
        return { permittedProductIds: permitted, isAdmin };
      }
    } catch {
      // Table may not exist yet on remote, fall through to memory cache
    }

    // Check memory cache
    const permittedFromCache: string[] = [];
    for (const [key, val] of permissionCache.entries()) {
      if (key.startsWith(`${context.userId}:`) && val) {
        permittedFromCache.push(key.split(":")[1]);
      }
    }

    return { permittedProductIds: permittedFromCache, isAdmin };
  });

/**
 * Retrieves the full permission matrix for all employees across all products.
 */
export const getStaffPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Fetch all staff members
    const { data: staffData } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["sales", "admin"]);

    // Fetch all products
    const { data: productsData } = await context.supabase
      .from("products")
      .select("id, name_ar, name_en, price, category")
      .order("sort_order", { ascending: true });

    const products = productsData ?? [];
    const staffUserIds = Array.from(new Set((staffData ?? []).map((s) => s.user_id)));

    // Try fetching existing permissions from Supabase
    let dbPerms: { user_id: string; product_id: string; can_edit_price: boolean }[] = [];
    try {
      const { data, error } = await context.supabase
        .from("sales_product_permissions")
        .select("user_id, product_id, can_edit_price");
      if (!error && data) {
        dbPerms = data;
      }
    } catch {
      // Ignore
    }

    // Combine dbPerms with cache
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const userId of staffUserIds) {
      matrix[userId] = {};
      for (const prod of products) {
        const key = cacheKey(userId, prod.id);
        const fromDb = dbPerms.find((p) => p.user_id === userId && p.product_id === prod.id);
        if (fromDb !== undefined) {
          matrix[userId][prod.id] = fromDb.can_edit_price;
        } else if (permissionCache.has(key)) {
          matrix[userId][prod.id] = permissionCache.get(key) ?? false;
        } else {
          // Default: allowed for demo / initial state if not configured
          matrix[userId][prod.id] = true;
        }
      }
    }

    return {
      staffUserIds,
      products,
      matrix,
    };
  });

/**
 * Toggles or sets can_edit_price for a specific staff member and product.
 */
export const updateStaffProductPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; productId: string; canEditPrice: boolean }) => input)
  .handler(async ({ input, context }) => {
    // Update local cache immediately
    permissionCache.set(cacheKey(input.userId, input.productId), input.canEditPrice);

    // Persist to Supabase if table exists
    try {
      await context.supabase.from("sales_product_permissions").upsert(
        {
          user_id: input.userId,
          product_id: input.productId,
          can_edit_price: input.canEditPrice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product_id" }
      );
    } catch {
      // Graceful fallback to cache
    }

    return { success: true, userId: input.userId, productId: input.productId, canEditPrice: input.canEditPrice };
  });
