/**
 * Shared shapes for the sales-managed storefront content (banner, category
 * ribbon and product grid rendered on /discover). Client-safe: no server-only
 * imports, so both the public app and the sales CMS can use it.
 */
import type { PriorityColor } from "@/lib/priority";

export type Tint = "blush" | "butter" | "pistachio" | "sky" | "lilac" | "cream";

export const TINTS: { value: Tint; ar: string; en: string; fill: string; swatch: string }[] = [
  { value: "blush", ar: "وردي هادئ", en: "Blush", fill: "bg-tint-blush", swatch: "var(--tint-blush)" },
  { value: "butter", ar: "أصفر زبدة", en: "Butter", fill: "bg-tint-butter", swatch: "var(--tint-butter)" },
  { value: "pistachio", ar: "فستقي", en: "Pistachio", fill: "bg-tint-pistachio", swatch: "var(--tint-pistachio)" },
  { value: "sky", ar: "سماوي", en: "Sky", fill: "bg-tint-sky", swatch: "var(--tint-sky)" },
  { value: "lilac", ar: "ليلكي", en: "Lilac", fill: "bg-tint-lilac", swatch: "var(--tint-lilac)" },
  { value: "cream", ar: "كريمي", en: "Cream", fill: "bg-tint-cream", swatch: "var(--tint-cream)" },
];

export const tintFill = (tint: string | null | undefined) =>
  TINTS.find((option) => option.value === tint)?.fill ?? "bg-tint-cream";

export type SizePrice = { label: string; price: number };

export type StorefrontBanner = {
  id: string;
  is_active: boolean;
  discount_text: string;
  subtitle: string;
  button_text: string;
  image_url: string | null;
};

export type StorefrontCategory = {
  id: string;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  tint: string;
  sort_order: number;
  is_active: boolean;
  /** Optional kitchen priority for every product in this category. */
  priority_color: PriorityColor | null;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  category: string;
  category_id: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  rating: number;
  rating_count: number;
  sizes: SizePrice[];
  tint: string | null;
  sort_order: number;
  /** Optional kitchen priority; falls back to the category, then the base tier. */
  priority_color: PriorityColor | null;
};

export type StorefrontContent = {
  banner: StorefrontBanner | null;
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
};

export const BANNER_SELECT = "id, is_active, discount_text, subtitle, button_text, image_url";
export const CATEGORY_SELECT =
  "id, name_en, name_ar, image_url, tint, sort_order, is_active, priority_color";
export const PRODUCT_SELECT =
  "id, slug, name_ar, name_en, description_ar, description_en, category, category_id, price, image_url, is_available, is_popular, rating, rating_count, sizes, tint, sort_order, priority_color";

/** Normalises a jsonb size list coming back from the database. */
export function parseSizes(value: unknown): SizePrice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as { label?: unknown; price?: unknown };
      const label = typeof row?.label === "string" ? row.label.trim() : "";
      const price = Number(row?.price);
      return label && Number.isFinite(price) && price >= 0 ? { label, price } : null;
    })
    .filter((size): size is SizePrice => size !== null);
}

export function normaliseProduct(row: Record<string, unknown>): StorefrontProduct {
  return {
    ...(row as unknown as StorefrontProduct),
    price: Number(row['price'] ?? 0),
    rating: Number(row['rating'] ?? 0),
    rating_count: Number(row['rating_count'] ?? 0),
    sizes: parseSizes(row['sizes']),
  };
}

/** Price shown on a card: the selected size, else the base price. */
export const priceForSize = (product: StorefrontProduct, label: string | null) =>
  product.sizes.find((size) => size.label === label)?.price ?? product.price;
