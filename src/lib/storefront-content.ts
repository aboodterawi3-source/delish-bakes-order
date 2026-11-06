/**
 * Shared shapes for the sales-managed storefront content (banner, category
 * ribbon and product grid rendered on /discover). Client-safe: no server-only
 * imports, so both the public app and the sales CMS can use it.
 */
import type { PriorityColor } from "@/lib/priority";
import { images } from "@/lib/images";
import luxuryCakeShowcaseImg from "@/assets/luxury-cake-showcase.jpg";

export type Tint =
  | "rose"
  | "pistachio"
  | "chocolate"
  | "vanilla"
  | "lavender"
  | "blush"
  | "butter"
  | "sky"
  | "lilac"
  | "cream";

export const TINTS: {
  value: Tint;
  ar: string;
  en: string;
  fill: string;
  border: string;
  badge: string;
  text: string;
  hex: string;
}[] = [
  {
    value: "rose",
    ar: "وردي فاخر · Luxury Rose",
    en: "Luxury Rose",
    fill: "bg-[#FFF0F3]",
    border: "border-[#FFCCD5]",
    badge: "bg-[#E91E63] text-white",
    text: "text-[#590D22]",
    hex: "#FFF0F3",
  },
  {
    value: "pistachio",
    ar: "فستق حلبي · Fresh Pistachio",
    en: "Fresh Pistachio",
    fill: "bg-[#F1F8F5]",
    border: "border-[#C8E6C9]",
    badge: "bg-[#2E7D32] text-white",
    text: "text-[#1B3B1D]",
    hex: "#F1F8F5",
  },
  {
    value: "chocolate",
    ar: "شوكولاتة دافئة · Warm Chocolate",
    en: "Warm Chocolate",
    fill: "bg-[#FDF8F5]",
    border: "border-[#D7CCC8]",
    badge: "bg-[#8D6E63] text-white",
    text: "text-[#3E2723]",
    hex: "#FDF8F5",
  },
  {
    value: "vanilla",
    ar: "فانيلا ذهبية · Golden Vanilla",
    en: "Golden Vanilla",
    fill: "bg-[#FFFDE7]",
    border: "border-[#FFF59D]",
    badge: "bg-[#F57F17] text-white",
    text: "text-[#4E342E]",
    hex: "#FFFDE7",
  },
  {
    value: "lavender",
    ar: "لافندر ناعم · Soft Lavender",
    en: "Soft Lavender",
    fill: "bg-[#F3E5F5]",
    border: "border-[#E1BEE7]",
    badge: "bg-[#7B1FA2] text-white",
    text: "text-[#311B92]",
    hex: "#F3E5F5",
  },
  {
    value: "blush",
    ar: "باستيل وردي · Blush",
    en: "Blush",
    fill: "bg-tint-blush",
    border: "border-[#FAD2E1]",
    badge: "bg-[#D81B60] text-white",
    text: "text-[#4A0E17]",
    hex: "#FDE2CF",
  },
  {
    value: "butter",
    ar: "زبدة دافئة · Butter",
    en: "Butter",
    fill: "bg-tint-butter",
    border: "border-[#FFE5EC]",
    badge: "bg-[#D97706] text-white",
    text: "text-[#78350F]",
    hex: "#FFF1C5",
  },
  {
    value: "sky",
    ar: "سماوي · Sky",
    en: "Sky",
    fill: "bg-tint-sky",
    border: "border-[#BEE3F8]",
    badge: "bg-[#0284C7] text-white",
    text: "text-[#0C4A6E]",
    hex: "#E0F2FE",
  },
  {
    value: "lilac",
    ar: "ليلكي · Lilac",
    en: "Lilac",
    fill: "bg-tint-lilac",
    border: "border-[#E9D5FF]",
    badge: "bg-[#9333EA] text-white",
    text: "text-[#581C87]",
    hex: "#F3E8FF",
  },
  {
    value: "cream",
    ar: "كريمي غني · Cream",
    en: "Cream",
    fill: "bg-tint-cream",
    border: "border-[#E5E7EB]",
    badge: "bg-[#8B4513] text-white",
    text: "text-[#3E2723]",
    hex: "#FFF9F5",
  },
];

export const getTintMeta = (tint: string | null | undefined) =>
  TINTS.find((option) => option.value === tint) ?? TINTS[0]!;

export const tintFill = (tint: string | null | undefined) =>
  (TINTS.find((option) => option.value === tint) ?? TINTS[0]!).fill;

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
  icon?: string | null;
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
  /** Optional filling shown to customers (e.g. Nutella, Lotus). */
  filling_ar: string | null;
  filling_en: string | null;
  /** True when the cake has no fixed price and the customer must ask for one. */
  price_on_request: boolean;
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
  "id, name_en, name_ar, icon, image_url, tint, sort_order, is_active, priority_color";
export const PRODUCT_SELECT =
  "id, slug, name_ar, name_en, description_ar, description_en, category, category_id, price, image_url, is_available, is_popular, filling_ar, filling_en, price_on_request, sizes, tint, sort_order, priority_color";

/** Returns an authentic bakery emoji icon based on category keywords */
export function getCategoryFallbackIcon(name?: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("تخرج") || n.includes("graduat")) return "🎓";
  if (n.includes("تشيز") || n.includes("cheesecake")) return "🍰";
  if (n.includes("حلويات") || n.includes("pastr") || n.includes("cupcake") || n.includes("كب كيك") || n.includes("ميني")) return "🧁";
  if (n.includes("كوكيز") || n.includes("cookie") || n.includes("براوني") || n.includes("brownie")) return "🍪";
  if (n.includes("هدايا") || n.includes("توابع") || n.includes("gift")) return "🎁";
  if (n.includes("عربية") || n.includes("arabic") || n.includes("كنافة") || n.includes("بقلاوة")) return "✨";
  return "🎂";
}

/** Resolves an optimized, high-resolution product photography asset when image_url is missing */
export function getProductFallbackImage(slug?: string, category?: string, name?: string): string {
  const s = (slug || "").toLowerCase();
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (s.includes("choc") || n.includes("شوكولاتة") || n.includes("chocolate") || n.includes("فادج")) return images["cake-choc"] || "";
  if (s.includes("red-velvet") || n.includes("فيلفيت") || n.includes("red velvet")) return images["cake-red"] || "";
  if (s.includes("cheesecake") || s.includes("san-sebastian") || n.includes("تشيز") || n.includes("سان سيباستيان") || c.includes("cheesecake")) return images["cheesecake"] || "";
  if (s.includes("pistachio") || n.includes("فستق")) return luxuryCakeShowcaseImg || images["cake-berry"] || "";
  if (s.includes("caramel") || n.includes("كراميل") || s.includes("vanilla") || n.includes("فانيلا") || s.includes("berry") || n.includes("توت")) return images["cake-berry"] || "";
  if (s.includes("mini-cake") || s.includes("cupcake") || n.includes("ميني") || n.includes("كب كيك") || c.includes("dessert") || c.includes("pastr")) return images["cupcakes"] || "";
  if (s.includes("cookie") || s.includes("brownie") || n.includes("كوكيز") || n.includes("براوني")) return images["cookies"] || "";
  if (s.includes("knafeh") || n.includes("كنافة")) return images["knafeh"] || "";
  if (s.includes("baklava") || n.includes("بقلاوة")) return images["baklava"] || "";

  if (c.includes("cake")) return images["cake-choc"] || "";
  return luxuryCakeShowcaseImg || images["cake-choc"] || "";
}

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

export function normaliseCategory(row: Record<string, unknown>): StorefrontCategory {
  const nameAr = typeof row["name_ar"] === "string" ? row["name_ar"] : "";
  const nameEn = typeof row["name_en"] === "string" ? row["name_en"] : "";
  const rawIcon = typeof row["icon"] === "string" && row["icon"].trim() ? row["icon"].trim() : null;
  const rawImage = typeof row["image_url"] === "string" && row["image_url"].trim() ? row["image_url"].trim() : null;

  return {
    ...(row as unknown as StorefrontCategory),
    icon: rawIcon || getCategoryFallbackIcon(nameAr || nameEn),
    image_url: rawImage,
  };
}

export function normaliseProduct(row: Record<string, unknown>): StorefrontProduct {
  const slug = typeof row["slug"] === "string" ? row["slug"] : "";
  const category = typeof row["category"] === "string" ? row["category"] : "";
  const nameAr = typeof row["name_ar"] === "string" ? row["name_ar"] : "";
  const nameEn = typeof row["name_en"] === "string" ? row["name_en"] : "";
  const rawImage = typeof row["image_url"] === "string" && row["image_url"].trim() ? row["image_url"].trim() : null;
  const fallback = getProductFallbackImage(slug, category, nameAr || nameEn);

  return {
    ...(row as unknown as StorefrontProduct),
    image_url: rawImage || fallback,
    price: Number(row["price"] ?? 0),
    price_on_request: row["price_on_request"] === true,
    sizes: parseSizes(row["sizes"]),
  };
}

/** Price shown on a card: the selected size, else the base price. */
export const priceForSize = (product: StorefrontProduct, label: string | null) =>
  product.sizes.find((size) => size.label === label)?.price ?? product.price;
