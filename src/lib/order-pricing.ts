import {
  builderFillings,
  builderFlavors,
  builderFrostings,
  builderSizes,
  products,
  DELIVERY_FEE,
  type Option,
} from "@/lib/menu";
import { feeForArea } from "@/lib/delivery-zones";

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

export type LineSpec = CatalogSpec | BuilderSpec;

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
  spec: LineSpec,
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
      options_ar: [size ? `الحجم: ${size.ar}` : "", flavor ? `النكهة: ${flavor.ar}` : "", ...extras.ar].filter(Boolean),
      options_en: [size ? `Size: ${size.en}` : "", flavor ? `Flavor: ${flavor.en}` : "", ...extras.en].filter(Boolean),
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
