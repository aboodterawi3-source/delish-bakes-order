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
import { extraList, isValidStorageUrl, STORAGE_URL } from "@/lib/server-shared";
import { roundJod } from "@/lib/currency";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("تاريخ غير صحيح · Invalid date");
  const time = text(input?.requested_time, 8, "الوقت", true)!;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new Error("وقت غير صحيح · Invalid time");

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
    if (isValidStorageUrl(raw) || STORAGE_URL.test(raw) || /^https?:\/\//i.test(raw)) {
      designImage = raw;
    } else {
      throw new Error("رابط صورة التصميم غير صالح · Invalid design image URL");
    }
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // CMS products live in the database, so their prices are read there — never
    // taken from the browser.
    const lines: PricedLine[] = [...data.priced];
    if (data.cmsLines.length > 0) {
      const ids = [...new Set(data.cmsLines.map((line) => line.spec.productId))];
      const { data: rows, error: productError } = await supabaseAdmin
        .from("products")
        .select("id, name_ar, name_en, price, sizes, is_available")
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
        const sizes = Array.isArray(product.sizes)
          ? (product.sizes as { label?: string; price?: number }[])
          : [];
        const size = line.spec.size
          ? sizes.find((entry) => entry?.label === line.spec.size)
          : undefined;

        let unit: number;
        if (size && typeof size.price === "number") {
          unit = size.price;
        } else {
          // If no custom sizes configured on the product, apply standard SERVING_SIZE_OFFSETS
          const basePrice = Number(product.price ?? 0);
          const sizeOffset = sizes.length > 0 ? 0 : getServingSizeOffset(line.spec.size);
          unit = basePrice + sizeOffset;
        }

        const sizeLabel = size?.label ?? line.spec.size ?? "";
        lines.push({
          name_ar: product.name_ar,
          name_en: product.name_en,
          unit_price: Number.isFinite(unit) ? unit : 0,
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

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
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
      })
      .select("id, order_number, subtotal, delivery_fee, total")
      .single();
    if (error || !order) {
      throw publicError(
        "checkout.insertOrder",
        error,
        "تعذّر حفظ الطلب · Could not save the order",
      );
    }

    const { error: itemError } = await supabaseAdmin.from("order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        name_ar: line.name_ar,
        name_en: line.name_en,
        unit_price: line.unit_price,
        quantity: line.quantity,
        options_ar: line.options_ar,
        options_en: line.options_en,
        notes: line.notes,
      })),
    );
    if (itemError) {
      throw publicError(
        "checkout.insertItems",
        itemError,
        "تعذّر حفظ الطلب · Could not save the order",
      );
    }

    return {
      id: order.id,
      order_number: order.order_number,
      subtotal: Number(order.subtotal ?? 0),
      delivery_fee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
    };
  });
