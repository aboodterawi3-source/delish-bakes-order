/**
 * Fuzzy Search Engine for Delish Cake & Bake Products and Orders
 * Powered by Fuse.js (https://github.com/krisk/Fuse)
 * Provides typo-tolerant search across Arabic & English catalog records.
 */

import Fuse, { type IFuseOptions } from "fuse.js";

export interface SearchableProduct {
  id: string;
  name_ar: string;
  name_en: string;
  category: string;
  price: number;
  description_ar?: string;
  description_en?: string;
}

export interface SearchableOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total: number;
}

/**
 * Normalizes common Arabic character variations for superior fuzzy matching:
 * - Unifies alef (أ, إ, آ -> ا)
 * - Unifies taa marbuta & haa (ة -> ه)
 * - Unifies yaa & alef maksura (ي, ى -> ي)
 * - Removes tatweel (ـ)
 */
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .toLowerCase();
}

const DEFAULT_PRODUCT_OPTIONS: IFuseOptions<SearchableProduct> = {
  keys: [
    { name: "name_ar_norm", weight: 2.5 },
    { name: "name_ar", weight: 2.0 },
    { name: "name_en", weight: 1.5 },
    { name: "category", weight: 1.0 },
    { name: "description_ar", weight: 0.8 },
  ],
  threshold: 0.5,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

const DEFAULT_ORDER_OPTIONS: IFuseOptions<SearchableOrder> = {
  keys: [
    { name: "order_number", weight: 2.5 },
    { name: "customer_name_norm", weight: 2.0 },
    { name: "customer_name", weight: 1.8 },
    { name: "customer_phone", weight: 1.5 },
    { name: "status", weight: 0.8 },
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Searches bakery products with fuzzy typo-tolerance and Arabic normalization
 */
export function searchBakeryProducts(
  query: string,
  products: SearchableProduct[],
  options?: Partial<IFuseOptions<SearchableProduct>>
): SearchableProduct[] {
  if (!query || query.trim() === "") return products;

  const enriched = products.map((p) => ({
    ...p,
    name_ar_norm: normalizeArabicText(p.name_ar),
  }));

  const normalizedQuery = normalizeArabicText(query.trim());
  const fuse = new Fuse(enriched, { ...DEFAULT_PRODUCT_OPTIONS, ...options });
  const results = fuse.search(normalizedQuery);
  return results.map((r) => r.item);
}

/**
 * Searches cashier orders by order number, customer name, or phone number
 */
export function searchOrders(
  query: string,
  orders: SearchableOrder[],
  options?: Partial<IFuseOptions<SearchableOrder>>
): SearchableOrder[] {
  if (!query || query.trim() === "") return orders;

  const enriched = orders.map((o) => ({
    ...o,
    customer_name_norm: normalizeArabicText(o.customer_name),
  }));

  const normalizedQuery = normalizeArabicText(query.trim());
  const fuse = new Fuse(enriched, { ...DEFAULT_ORDER_OPTIONS, ...options });
  const results = fuse.search(normalizedQuery);
  return results.map((r) => r.item);
}
