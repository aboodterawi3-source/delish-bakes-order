import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    supabase.from("storefront_banner").select(BANNER_SELECT).eq("is_active", true).limit(1).maybeSingle(),
    supabase.from("storefront_categories").select(CATEGORY_SELECT).eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_available", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  return {
    banner: (banner.data as StorefrontBanner | null) ?? null,
    categories: ((categories.data ?? []) as StorefrontCategory[]),
    products: ((products.data ?? []) as Record<string, unknown>[]).map(normaliseProduct),
  };
}

/**
 * Streams the sales-managed content into the customer app: any banner, category
 * or product change published from /sales lands here without a refresh.
 */
export function useStorefrontContent() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: STOREFRONT_CONTENT_KEY,
    queryFn: fetchStorefrontContent,
    staleTime: 30_000,
    // Realtime drives updates; the interval is only a safety net.
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: STOREFRONT_CONTENT_KEY });
    const channel = supabase
      .channel("storefront-content-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "storefront_categories" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "storefront_banner" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
