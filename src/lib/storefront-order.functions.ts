import { createServerFn } from "@tanstack/react-start";
import {
  deliveryFeeFor,
  getServingSizeOffset,
  priceLine,
  type CmsSpec,
  type LineSpec,
  type PricedLine,
} from "@/lib/order-pricing";
import { publicError } from "@/lib/public-error";
import { extraList, isValidStorageUrl } from "@/lib/server-shared";
import { roundJod } from "@/lib/currency";
import { isReasonableOrderDate, isValidTime, UUID_PATTERN } from "@/lib/validators";
import { logServerError } from "@/lib/server-log";

const MAX_LINES = 100;
const MAX_QTY = 500;

export type StorefrontOrderRequest = {
  customer_name: string;
  customer_phone: string;
  method: "delivery" | "pickup";
  area?: string | null;
  address?: string | null;
  requested_date: string;
  requested_time: string;
  notes?: string | null;
  /** How the customer wants to pay: cash on delivery or CliQ transfer. */
  payment_method?: "cash" | "cliq" | null;
  /** Idempotency key generated once per checkout attempt in the browser. */
  client_request_id?: string | null;
  design_image?: string | null;
  lines: {
    spec: LineSpec;
    quantity: number;
    notes?: string | null;
    /** Chosen extras (candles, balloons, acrylic topper, gift…) — labels only, never prices. */
    extras_ar?: string[] | null;
    extras_en?: string[] | null;
  }[];
};


const text = (value: unknown, max: number, label: string, required = false) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new Error(`${label} مطلوب · ${label} is required`);
    return null;
  }
  if (trimmed.length > max) throw new Error(`${label} طويل جداً · ${label} is too long`);
  return trimmed;
};

function validate(input: StorefrontOrderRequest) {
  const name = text(input?.customer_name, 80, "الاسم", true)!;
  const phone = text(input?.customer_phone, 25, "الهاتف", true)!;
  if (!/^[0-9+\s-]{7,25}$/.test(phone)) throw new Error("رقم هاتف غير صحيح · Invalid phone number");

  const method = input?.method === "pickup" ? "pickup" : "delivery";
  const area = text(input?.area, 80, "المنطقة", method === "delivery");
  const address = text(input?.address, 300, "العنوان", method === "delivery");

  const date = text(input?.requested_date, 10, "التاريخ", true)!;
  // Real calendar date inside a sane window (was: regex only, accepted 2026-99-99 and past dates).
  if (!isReasonableOrderDate(date)) throw new Error("تاريخ غير صحيح · Invalid date");
  const time = text(input?.requested_time, 8, "الوقت", true)!;
  if (!isValidTime(time)) throw new Error("وقت غير صحيح · Invalid time");

  const rawRequestId =
    typeof input?.client_request_id === "string" ? input.client_request_id.trim() : "";
  if (rawRequestId && !UUID_PATTERN.test(rawRequestId)) {
    throw new Error("طلب غير صالح · Invalid request");
  }
  const clientRequestId = rawRequestId || null;

  const notes = text(input?.notes, 1000, "الملاحظات");

  let designImage: string | null = null;
  if (typeof input?.design_image === "string" && input.design_image.trim()) {
    const raw = input.design_image.trim();
    // Strictly reject long Base64 strings or Data URLs in design_image_url
    if (raw.startsWith("data:") || raw.includes(";base64,")) {
      throw new Error(
        "يُحظر إرسال صور Base64 مباشرة، يجب رفع الصورة إلى مساحة التخزين أولاً · Base64 image payloads are not allowed; upload to storage first",
      );
    }
    if (raw.length > 2500) {
      throw new Error("رابط صورة التصميم طويل جداً · Design image URL exceeds maximum length");
    }
    // Only Storage objects of our own project are accepted; the old `https?://` fallback allowed any host.
    if (!isValidStorageUrl(raw)) {
      throw new Error("رابط صورة التصميم غير صالح · Invalid design image URL");
    }
    designImage = raw;
  }

  const rawLines = Array.isArray(input?.lines) ? input.lines : [];
  if (rawLines.length === 0) throw new Error("السلة فارغة · The cart is empty");
  if (rawLines.length > MAX_LINES) throw new Error("عدد الأصناف كبير جداً · Too many items");

  const priced: PricedLine[] = [];
  const cmsLines: {
    spec: CmsSpec;
    quantity: number;
    notes: string | null;
    extras: { ar: string[]; en: string[] };
  }[] = [];

  for (const line of rawLines) {
    const quantity = Math.floor(Number(line?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new Error("الكمية غير صحيحة · Invalid quantity");
    }
    const spec = line?.spec;
    const lineNotes = text(line?.notes, 400, "الملاحظات");
    const extras = { ar: extraList(line?.extras_ar), en: extraList(line?.extras_en) };
    if (!spec) throw new Error("صنف غير صحيح · Invalid item");

    if (spec.kind === "cms") {
      const productId = text(spec.productId, 40, "المنتج", true)!;
      cmsLines.push({
        spec: { kind: "cms", productId, size: text(spec.size, 60, "الحجم") },
        quantity,
        notes: lineNotes,
        extras,
      });
      continue;
    }

    if (spec.kind !== "catalog" && spec.kind !== "builder") {
      throw new Error("صنف غير صحيح · Invalid item");
    }
    if (spec.kind === "builder" && spec.message) {
      text(spec.message, 120, "الكتابة");
    }
    priced.push(priceLine(spec, quantity, lineNotes, extras));
  }

  const payment: "cash" | "cliq" | null =
    input?.payment_method === "cash" || input?.payment_method === "cliq"
      ? input.payment_method
      : null;

  return {
    name,
    phone,
    method,
    area,
    address,
    date,
    time,
    notes,
    payment,
    clientRequestId,
    designImage,
    priced,
    cmsLines,
  } as const;
}

/**
 * Public checkout: the browser sends only *what* was ordered. Every price, the
 * delivery fee and the total are recomputed here from the trusted catalogue.
 */
export const submitStorefrontOrder = createServerFn({ method: "POST" })
  .inputValidator((input: StorefrontOrderRequest) => validate(input))
  .handler(async ({ data }) => {
    // 10 orders / 10 min / client: blocks scripted floods of fake orders reaching the kitchen.
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    enforceRateLimit("storefront-order", 10, 10 * 60_000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: a retried checkout (network drop, double tap) returns the original order.
    if (data.clientRequestId) {
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, subtotal, delivery_fee, total")
        .eq("client_request_id" as never, data.clientRequestId as never)
        .maybeSingle();
      if (existing) {
        return {
          id: existing.id,
          order_number: existing.order_number,
          subtotal: Number(existing.subtotal ?? 0),
          delivery_fee: Number(existing.delivery_fee ?? 0),
          total: Number(existing.total ?? 0),
        };
      }
    }

    // CMS products live in the database, so their prices are read there — never
    // taken from the browser.
    const lines: PricedLine[] = [...data.priced];
    if (data.cmsLines.length > 0) {
      const ids = [...new Set(data.cmsLines.map((line) => line.spec.productId))];
      const { data: rows, error: productError } = await supabaseAdmin
        .from("products")
        .select("id, name_ar, name_en, price, sizes, is_available, price_on_request")
        .in("id", ids);
      if (productError) {
        throw publicError(
          "checkout.loadProducts",
          productError,
          "تعذّر حفظ الطلب · Could not save the order",
        );
      }
      for (const line of data.cmsLines) {
        const product = (rows ?? []).find((row) => row.id === line.spec.productId);
        if (!product || product.is_available === false) {
          throw new Error(
            "أحد المنتجات في السلة غير متوفر، يرجى تحديث الصفحة · An item in your cart is no longer available, please refresh the page",
          );
        }
        // "Price on request" items cannot be ordered through the self-service checkout.
        if (product.price_on_request === true) {
          throw new Error(
            "أحد المنتجات يتطلب التواصل لمعرفة السعر · An item requires contacting us for its price",
          );
        }
        const sizes = Array.isArray(product.sizes)
          ? (product.sizes as { label?: string; price?: number }[])
          : [];
        const size = line.spec.size
          ? sizes.find((entry) => entry?.label === line.spec.size)
          : undefined;

        if (line.spec.size && sizes.length > 0 && !size) {
          throw new Error("الحجم المختار غير صالح · Selected size is invalid");
        }

        let unit: number;
        if (size && typeof size.price === "number") {
          unit = size.price;
        } else {
          // If no custom sizes configured on the product, apply standard SERVING_SIZE_OFFSETS
          const basePrice = Number(product.price);
          const sizeOffset = sizes.length > 0 ? 0 : getServingSizeOffset(line.spec.size);
          unit = basePrice + sizeOffset;
        }

        // A missing/invalid/non-positive price must stop the order, never silently sell it for 0 (was: `: 0`).
        if (!Number.isFinite(unit) || unit <= 0) {
          throw publicError(
            "checkout.invalidPrice",
            new Error(`product ${product.id} resolved to price ${String(unit)}`),
            "تعذّر حفظ الطلب · Could not save the order",
          );
        }

        const sizeLabel = size?.label ?? line.spec.size ?? "";
        lines.push({
          name_ar: product.name_ar,
          name_en: product.name_en,
          unit_price: unit,
          quantity: line.quantity,
          options_ar: [sizeLabel ? `الحجم: ${sizeLabel}` : "", ...line.extras.ar].filter(
            Boolean,
          ),
          options_en: [sizeLabel ? `Size: ${sizeLabel}` : "", ...line.extras.en].filter(Boolean),
          notes: line.notes,
          message: null,
        });
      }
    }

    const subtotal = roundJod(lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0));
    const deliveryFee = roundJod(deliveryFeeFor(data.method, lines.length, data.area));
    const total = roundJod(subtotal + deliveryFee);
    const inscription = lines
      .map((line) => line.message)
      .filter(Boolean)
      .join(" / ");

    const orderPayload = {
      customer_name: data.name,
      customer_phone: data.phone,
      method: data.method,
      area: data.area,
      address: data.address,
      requested_date: data.date,
      requested_time: data.time,
      notes: data.notes,
      inscription: inscription || null,
      design_image_url: data.designImage,
      payment_method: data.payment,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: "new",
      client_request_id: data.clientRequestId || null,
    };

    const itemsPayload = lines.map((line) => ({
      name_ar: line.name_ar,
      name_en: line.name_en,
      unit_price: line.unit_price,
      quantity: line.quantity,
      options_ar: line.options_ar,
      options_en: line.options_en,
      notes: line.notes,
    }));

    const { data: rawOrder, error } = await supabaseAdmin.rpc("create_storefront_order_atomic", {
      order_payload: orderPayload,
      items_payload: itemsPayload,
    });

    if (error || !rawOrder) {
      // Unique-violation on the idempotency key = a concurrent twin request won the race: return its order.
      if (data.clientRequestId && (error as { code?: string } | null)?.code === "23505") {
        const { data: twin } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, subtotal, delivery_fee, total")
          .eq("client_request_id" as never, data.clientRequestId as never)
          .maybeSingle();
        if (twin) {
          return {
            id: twin.id,
            order_number: twin.order_number,
            subtotal: Number(twin.subtotal ?? 0),
            delivery_fee: Number(twin.delivery_fee ?? 0),
            total: Number(twin.total ?? 0),
          };
        }
      }
      throw publicError(
        "checkout.insertOrder",
        error ?? new Error("No order returned"),
        "تعذّر حفظ الطلب · Could not save the order",
      );
    }

    const order = rawOrder as any;

    return {
      id: order.id,
      order_number: order.order_number,
      subtotal: Number(order.subtotal ?? 0),
      delivery_fee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
    };
  });
