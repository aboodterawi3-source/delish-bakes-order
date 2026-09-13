import { createServerFn } from "@tanstack/react-start";
import { deliveryFeeFor, priceLine, type LineSpec } from "@/lib/order-pricing";

export type StorefrontOrderRequest = {
  customer_name: string;
  customer_phone: string;
  method: "delivery" | "pickup";
  area?: string | null;
  address?: string | null;
  requested_date: string;
  requested_time: string;
  notes?: string | null;
  design_image?: string | null;
  lines: { spec: LineSpec; quantity: number; notes?: string | null }[];
};

const MAX_LINES = 40;
const MAX_QTY = 50;
const MAX_IMAGE_BYTES = 1_500_000;
const IMAGE_PREFIX = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
/** Signed link returned by uploadDesignImage for photos kept in Cloud storage. */
const STORAGE_URL = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/sign\/order-designs\/[\w./-]+\?[\w=%&.-]+$/i;

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
    if (!IMAGE_PREFIX.test(raw) && !STORAGE_URL.test(raw)) {
      throw new Error("صورة غير مدعومة · Unsupported image format");
    }
    if (raw.length > MAX_IMAGE_BYTES) throw new Error("حجم الصورة كبير جداً · Image is too large");
    designImage = raw;
  }

  const rawLines = Array.isArray(input?.lines) ? input.lines : [];
  if (rawLines.length === 0) throw new Error("السلة فارغة · The cart is empty");
  if (rawLines.length > MAX_LINES) throw new Error("عدد الأصناف كبير جداً · Too many items");

  const priced = rawLines.map((line) => {
    const quantity = Math.floor(Number(line?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new Error("الكمية غير صحيحة · Invalid quantity");
    }
    const spec = line?.spec;
    if (!spec || (spec.kind !== "catalog" && spec.kind !== "builder")) {
      throw new Error("صنف غير صحيح · Invalid item");
    }
    if (spec.kind === "builder" && spec.message) {
      text(spec.message, 120, "الكتابة");
    }
    return priceLine(spec, quantity, text(line?.notes, 400, "الملاحظات"));
  });

  return { name, phone, method, area, address, date, time, notes, designImage, priced } as const;
}

/**
 * Public checkout: the browser sends only *what* was ordered. Every price, the
 * delivery fee and the total are recomputed here from the trusted catalogue.
 */
export const submitStorefrontOrder = createServerFn({ method: "POST" })
  .inputValidator((input: StorefrontOrderRequest) => validate(input))
  .handler(async ({ data }) => {
    const subtotal = data.priced.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
    const deliveryFee = deliveryFeeFor(data.method, data.priced.length);
    const inscription = data.priced
      .map((line) => line.message)
      .filter(Boolean)
      .join(" / ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
        subtotal,
        delivery_fee: deliveryFee,
        total: subtotal + deliveryFee,
        status: "new",
      })
      .select("id, order_number, subtotal, delivery_fee, total")
      .single();
    if (error || !order) throw new Error(error?.message ?? "تعذّر حفظ الطلب · Could not save the order");

    const { error: itemError } = await supabaseAdmin.from("order_items").insert(
      data.priced.map((line) => ({
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
    if (itemError) throw new Error(itemError.message);

    return {
      id: order.id,
      order_number: order.order_number,
      subtotal: Number(order.subtotal ?? 0),
      delivery_fee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
    };
  });
