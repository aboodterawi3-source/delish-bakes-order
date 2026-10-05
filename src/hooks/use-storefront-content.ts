import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BANNER_SELECT,
  CATEGORY_SELECT,
  PRODUCT_SELECT,
  normaliseProduct,
  type StorefrontBanner,
  type StorefrontCategory,
  type StorefrontContent,
} from "@/lib/storefront-content";

export const STOREFRONT_CONTENT_KEY = ["storefront-content"] as const;

/** Public banner + category ribbon + product grid, exactly as sales published it. */
async function fetchStorefrontContent(): Promise<StorefrontContent> {
  const [banner, categories, products] = await Promise.all([
    supabase
      .from("storefront_banner")
      .select(BANNER_SELECT)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("storefront_categories")
      .select(CATEGORY_SELECT)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_available", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  return {
    banner: (banner.data as StorefrontBanner | null) ?? null,
    categories: (categories.data ?? []) as StorefrontCategory[],
    products: ((products.data ?? []) as Record<string, unknown>[]).map(normaliseProduct),
  };
}

/**
 * Streams the sales-managed content into the customer app using React Query caching.
 * Protects Supabase Realtime channel limits by avoiding random visitor subscriptions.
 */
export function useStorefrontContent() {
  return useQuery({
    queryKey: STOREFRONT_CONTENT_KEY,
    queryFn: fetchStorefrontContent,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
