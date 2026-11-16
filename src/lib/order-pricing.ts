import {
  builderFillings,
  builderFlavors,
  builderFrostings,
  builderSizes,
  products,
  DELIVERY_FEE,
  type Option,
} from "./menu.ts";
import { feeForArea } from "./delivery-zones.ts";

export type ServingSizeOffset = {
  label: string;
  ar: string;
  offset: number;
};

/**
 * Standard serving size price offsets applied to storefront cakes
 * when custom sizes are not explicitly configured in the database products table.
 */
export const SERVING_SIZE_OFFSETS: readonly ServingSizeOffset[] = [
  { label: "8 people", ar: "8 أشخاص", offset: 0 },
  { label: "12 people", ar: "12 شخص", offset: 7 },
  { label: "16 people", ar: "16 شخص", offset: 15 },
] as const;

/** Resolves the price offset for a given serving size label (English or Arabic). Exact match only. */
export function getServingSizeOffset(sizeLabel?: string | null): number {
  if (!sizeLabel) return 0;
  const trimmed = sizeLabel.trim().toLowerCase();
  // Exact match: the old `includes()` let "28 people" resolve to the "8 people" tier.
  const match = SERVING_SIZE_OFFSETS.find(
    (s) => s.label.toLowerCase() === trimmed || s.ar.toLowerCase() === trimmed,
  );
  return match ? match.offset : 0;
}

/**
 * A cart line is described by a *spec* (which catalogue item / builder choices were
 * picked), never by a price. Prices are always resolved from the trusted catalogue
 * below — on the server — so a tampered request cannot change what an order costs.
 */
export type CatalogSpec = {
  kind: "catalog";
  productId: string;
  sizeId?: string | undefined;
  flavorId?: string | undefined;
};

export type BuilderSpec = {
  kind: "builder";
  sizeId: string;
  flavorId: string;
  fillingId: string;
  frostingId: string;
  message?: string | undefined;
};

/** A product managed in the storefront CMS; priced from the database. */
export type CmsSpec = {
  kind: "cms";
  productId: string;
  size?: string | null;
};

export type LineSpec = CatalogSpec | BuilderSpec | CmsSpec;

export type PricedLine = {
  name_ar: string;
  name_en: string;
  unit_price: number;
  quantity: number;
  options_ar: string[];
  options_en: string[];
  notes: string | null;
  message: string | null;
};

const pick = (list: Option[] | undefined, id: string | undefined | null) =>
  list?.find((option) => option.id === id) ?? null;

/** Free extras picked by the customer (candles, balloons, topper, gift…). */
export type LineExtras = { ar: string[]; en: string[] };

export function priceLine(
  spec: CatalogSpec | BuilderSpec,
  quantity: number,
  notes: string | null,
  extras: LineExtras = { ar: [], en: [] },
): PricedLine {
  if (spec.kind === "catalog") {
    const product = products.find((candidate) => candidate.id === spec.productId);
    if (!product) {
      // Usually a stale cart from an older version of the menu: ask for a refresh
      // rather than showing a bare technical failure.
      throw new Error(
        "أحد المنتجات في السلة غير متوفر، يرجى تحديث الصفحة · An item in your cart is no longer available, please refresh the page",
      );
    }
    const size = pick(product.sizes, spec.sizeId);
    const flavor = pick(product.flavors, spec.flavorId);
    if (spec.sizeId && !size) throw new Error("خيار غير صحيح · Invalid option");
    if (spec.flavorId && !flavor) throw new Error("خيار غير صحيح · Invalid option");
    return {
      name_ar: product.ar,
      name_en: product.en,
      unit_price: product.price + (size?.price ?? 0) + (flavor?.price ?? 0),
      quantity,
      options_ar: [
        size ? `الحجم: ${size.ar}` : "",
        flavor ? `النكهة: ${flavor.ar}` : "",
        ...extras.ar,
      ].filter(Boolean),
      options_en: [
        size ? `Size: ${size.en}` : "",
        flavor ? `Flavor: ${flavor.en}` : "",
        ...extras.en,
      ].filter(Boolean),
      notes,
      message: null,
    };
  }

  const size = pick(builderSizes, spec.sizeId);
  const flavor = pick(builderFlavors, spec.flavorId);
  const filling = pick(builderFillings, spec.fillingId);
  const frosting = pick(builderFrostings, spec.frostingId);
  if (!size || !flavor || !filling || !frosting) throw new Error("خيار غير صحيح · Invalid option");
  const message = spec.message?.trim() || null;
  return {
    name_ar: "كيكة مصمّمة خاصة",
    name_en: "Custom designed cake",
    unit_price: size.price + flavor.price + filling.price + frosting.price,
    quantity,
    options_ar: [
      `الحجم: ${size.ar}`,
      `النكهة: ${flavor.ar}`,
      `الحشوة: ${filling.ar}`,
      `التغليف: ${frosting.ar}`,
      ...(message ? [`الكتابة: ${message}`] : []),
      ...extras.ar,
    ],
    options_en: [
      `Size: ${size.en}`,
      `Flavor: ${flavor.en}`,
      `Filling: ${filling.en}`,
      `Frosting: ${frosting.en}`,
      ...(message ? [`Message: ${message}`] : []),
      ...extras.en,
    ],
    notes,
    message,
  };
}

/**
 * Delivery is priced by zone: the area name is looked up in the trusted table.
 * Unknown areas fall back to the base fee so an order is never under-charged
 * silently below the cheapest zone.
 */
export function deliveryFeeFor(
  method: "delivery" | "pickup",
  lineCount: number,
  area?: string | null,
) {
  if (method !== "delivery" || lineCount === 0) return 0;
  return feeForArea(area) ?? DELIVERY_FEE;
}

/**
 * Combines modal-level flavor, filling, and cake writing with customization extras,
 * ensuring filling is never duplicated when set in both places and all choices reach the server.
 */
export function mergeModalSpecExtras(input: {
  flavor?: string | null | undefined;
  filling?: string | null | undefined;
  customizationFilling?: string | null | undefined;
  inscription?: string | null | undefined;
  extrasAr?: string[] | null | undefined;
  extrasEn?: string[] | null | undefined;
}): { extrasAr: string[]; extrasEn: string[] } {
  const resolvedFilling = (input.customizationFilling ?? "").trim() || (input.filling ?? "").trim();
  const cleanExtrasAr = (input.extrasAr ?? []).filter((item) => !item.trim().startsWith("الحشوة:"));
  const cleanExtrasEn = (input.extrasEn ?? []).filter(
    (item) => !/^Filling:/i.test(item.trim()),
  );
  const flavor = (input.flavor ?? "").trim();
  const inscription = (input.inscription ?? "").trim();

  return {
    extrasAr: [
      flavor ? `النكهة: ${flavor}` : "",
      resolvedFilling ? `الحشوة: ${resolvedFilling}` : "",
      inscription ? `الكتابة: ${inscription}` : "",
      ...cleanExtrasAr,
    ].filter(Boolean),
    extrasEn: [
      flavor ? `Flavor: ${flavor}` : "",
      resolvedFilling ? `Filling: ${resolvedFilling}` : "",
      inscription ? `Message: ${inscription}` : "",
      ...cleanExtrasEn,
    ].filter(Boolean),
  };
}

/**
 * Extracts a cake writing inscription from bilingual line extras so CMS catalog cakes
 * also populate `orders.inscription` for KDS and Sales views.
 */
export function extractLineInscription(extras: LineExtras): string | null {
  for (const item of extras.ar) {
    const trimmed = item.trim();
    if (trimmed.startsWith("الكتابة:")) {
      const msg = trimmed.replace(/^الكتابة:\s*/, "").trim();
      if (msg) return msg;
    }
  }
  for (const item of extras.en) {
    const trimmed = item.trim();
    if (/^Message:/i.test(trimmed)) {
      const msg = trimmed.replace(/^Message:\s*/i, "").trim();
      if (msg) return msg;
    }
  }
  return null;
}

/**
 * Checks whether a unit price matches any official catalog price for a product:
 * either its base price, one of its configured `sizes` prices, or (when no custom sizes exist)
 * a standard serving size offset tier.
 */
export function isOfficialCatalogPrice(
  unitPrice: number,
  product: { price?: number | null | undefined; sizes?: unknown },
): boolean {
  const target = Number(unitPrice);
  if (!Number.isFinite(target)) return false;
  const basePrice = Number(product.price ?? 0);
  if (Math.abs(target - basePrice) <= 0.01) return true;

  const sizes = Array.isArray(product.sizes)
    ? (product.sizes as { label?: string; price?: number }[])
    : [];
  if (sizes.length > 0) {
    return sizes.some(
      (entry) =>
        typeof entry?.price === "number" &&
        Number.isFinite(entry.price) &&
        Math.abs(target - Number(entry.price)) <= 0.01,
    );
  }

  return SERVING_SIZE_OFFSETS.some(
    (tier) => Math.abs(target - (basePrice + tier.offset)) <= 0.01,
  );
}

