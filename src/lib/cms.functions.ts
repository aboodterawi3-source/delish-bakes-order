import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";
import { decodeValidatedImage } from "@/lib/image-validation";
import {
  BANNER_SELECT,
  CATEGORY_SELECT,
  PRODUCT_SELECT,
  normaliseProduct,
  parseSizes,
  type SizePrice,
  type StorefrontBanner,
  type StorefrontCategory,
  type StorefrontContent,
  type StorefrontProduct,
} from "@/lib/storefront-content";

/**
 * Website / catalogue management. Editing the customer app is exclusive to the
 * sales desk (admins keep access for support), enforced here and by RLS.
 */
const CMS_ROLES: StaffRoleName[] = ["sales", "admin"];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SITE_BUCKET = "site-media";
/** Five years: banner and product photos must keep working on the storefront. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5;

const clean = (value: unknown, max: number, label: string, required = false) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new Error(`${label} مطلوب · ${label} is required`);
    return null;
  }
  if (trimmed.length > max) throw new Error(`${label} طويل جداً · ${label} is too long`);
  return trimmed;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `product-${Date.now()}`;

/* --------------------------------- reading --------------------------------- */

/** Everything the sales CMS shows, including hidden/out-of-stock rows. */
export const getCmsContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorefrontContent> => {
    await assertRole(context, CMS_ROLES);

    const [banner, categories, products] = await Promise.all([
      context.supabase.from("storefront_banner").select(BANNER_SELECT).limit(1).maybeSingle(),
      context.supabase.from("storefront_categories").select(CATEGORY_SELECT).order("sort_order"),
      context.supabase.from("products").select(PRODUCT_SELECT).order("sort_order").order("name_en"),
    ]);

    if (banner.error) throw new Error(banner.error.message);
    if (categories.error) throw new Error(categories.error.message);
    if (products.error) throw new Error(products.error.message);

    return {
      banner: (banner.data as StorefrontBanner | null) ?? null,
      categories: (categories.data ?? []) as StorefrontCategory[],
      products: ((products.data ?? []) as Record<string, unknown>[]).map(normaliseProduct),
    };
  });

/* --------------------------------- banner ---------------------------------- */

export type BannerInput = {
  discount_text: string;
  subtitle: string;
  button_text: string;
  image_url?: string | null;
  is_active?: boolean;
};

export const saveBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BannerInput) => ({
    discount_text: clean(input?.discount_text, 40, "نص الخصم", true)!,
    subtitle: clean(input?.subtitle, 80, "العنوان الفرعي", true)!,
    button_text: clean(input?.button_text, 30, "نص الزر", true)!,
    image_url: clean(input?.image_url, 2000, "صورة البانر"),
    is_active: input?.is_active !== false,
  }))
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    const existing = await context.supabase.from("storefront_banner").select("id").limit(1).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const { error } = existing.data?.id
      ? await context.supabase.from("storefront_banner").update(data as never).eq("id", existing.data.id)
      : await context.supabase.from("storefront_banner").insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- categories -------------------------------- */

export type CategoryInput = {
  id?: string | undefined;
  name_en: string;
  name_ar: string;
  image_url?: string | null;
  tint?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CategoryInput) => ({
    id: clean(input?.id, 40, "المعرّف"),
    row: {
      name_en: clean(input?.name_en, 40, "الاسم بالإنجليزية", true)!,
      name_ar: clean(input?.name_ar, 40, "الاسم بالعربية", true)!,
      image_url: clean(input?.image_url, 2000, "الصورة"),
      tint: clean(input?.tint, 20, "اللون") ?? "blush",
      sort_order: Number.isFinite(Number(input?.sort_order)) ? Number(input?.sort_order) : 0,
      is_active: input?.is_active !== false,
    },
  }))
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    const { error } = data.id
      ? await context.supabase.from("storefront_categories").update(data.row as never).eq("id", data.id)
      : await context.supabase.from("storefront_categories").insert(data.row as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    const { error } = await context.supabase.from("storefront_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Persists the new ribbon order after a move up / move down. */
export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => {
    const ids = Array.isArray(input?.ids) ? input.ids.filter((id) => typeof id === "string" && id) : [];
    if (ids.length === 0) throw new Error("لا توجد أقسام · No categories to reorder");
    if (ids.length > 60) throw new Error("عدد الأقسام كبير جداً · Too many categories");
    return { ids };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    for (const [index, id] of data.ids.entries()) {
      const { error } = await context.supabase
        .from("storefront_categories")
        .update({ sort_order: index + 1 } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* -------------------------------- products --------------------------------- */

export type ProductInput = {
  id?: string | undefined;
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  category: string;
  category_id?: string | null;
  price: number;
  sizes?: SizePrice[];
  image_url?: string | null;
  tint?: string | null;
  rating?: number;
  rating_count?: number;
  is_available?: boolean;
  is_popular?: boolean;
  sort_order?: number;
};

export const saveStorefrontProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProductInput) => {
    const price = Number(input?.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("السعر غير صحيح · Invalid price");
    const rating = Number(input?.rating ?? 4.8);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      throw new Error("التقييم بين 0 و 5 · Rating must be between 0 and 5");
    }
    const ratingCount = Math.max(0, Math.floor(Number(input?.rating_count ?? 0) || 0));
    const sizes = parseSizes(input?.sizes).slice(0, 12);
    const nameEn = clean(input?.name_en, 80, "الاسم بالإنجليزية", true)!;

    return {
      id: clean(input?.id, 40, "المعرّف"),
      row: {
        slug: slugify(nameEn),
        name_en: nameEn,
        name_ar: clean(input?.name_ar, 80, "الاسم بالعربية", true)!,
        description_en: clean(input?.description_en, 600, "الوصف بالإنجليزية"),
        description_ar: clean(input?.description_ar, 600, "الوصف بالعربية"),
        category: clean(input?.category, 40, "التصنيف", true)!,
        category_id: clean(input?.category_id, 40, "القسم"),
        price,
        sizes,
        image_url: clean(input?.image_url, 2000, "الصورة"),
        tint: clean(input?.tint, 20, "اللون"),
        rating: Math.round(rating * 10) / 10,
        rating_count: ratingCount,
        is_available: input?.is_available !== false,
        is_popular: input?.is_popular === true,
        sort_order: Number.isFinite(Number(input?.sort_order)) ? Number(input?.sort_order) : 0,
      },
    };
  })
  .handler(async ({ data, context }): Promise<StorefrontProduct> => {
    await assertRole(context, CMS_ROLES);
    const query = data.id
      ? context.supabase.from("products").update(data.row as never).eq("id", data.id)
      : context.supabase.from("products").insert(data.row as never);
    const { data: saved, error } = await query.select(PRODUCT_SELECT).single();
    if (error) throw new Error(error.message);
    return normaliseProduct(saved as unknown as Record<string, unknown>);
  });

/** The Active / Out of stock switch on each product card. */
export const setProductVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_available?: boolean; is_popular?: boolean }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<StorefrontProduct> => {
    await assertRole(context, CMS_ROLES);
    const patch: Record<string, boolean> = {};
    if (typeof data.is_available === "boolean") patch['is_available'] = data.is_available;
    if (typeof data.is_popular === "boolean") patch['is_popular'] = data.is_popular;
    if (Object.keys(patch).length === 0) throw new Error("لا يوجد تغيير · Nothing to update");

    const { data: saved, error } = await context.supabase
      .from("products")
      .update(patch as never)
      .eq("id", data.id)
      .select(PRODUCT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return normaliseProduct(saved as unknown as Record<string, unknown>);
  });

export const deleteStorefrontProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ image uploads ------------------------------ */

/**
 * Stores a banner / product photo (already converted to WebP at 90% quality in
 * the browser) and returns a long-lived signed URL the storefront can render.
 */
export const uploadSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { data_url: string; folder?: string }) => {
    const image = decodeValidatedImage(input?.data_url, MAX_IMAGE_BYTES);
    const folder = input?.folder === "banner" || input?.folder === "categories" ? input.folder : "products";
    return { ...image, folder };
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, CMS_ROLES);
    const path = `${data.folder}/${crypto.randomUUID()}.${data.ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(SITE_BUCKET).upload(path, data.binary, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(SITE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "تعذّر إنشاء رابط الصورة · Could not create the image link");
    }
    return { url: signed.signedUrl, path };
  });
