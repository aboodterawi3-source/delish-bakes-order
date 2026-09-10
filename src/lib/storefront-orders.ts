import { supabase } from "@/integrations/supabase/client";
import type { CartLine } from "@/lib/cart";

export type StorefrontOrderInput = {
  customer_name: string;
  customer_phone: string;
  method: "delivery" | "pickup";
  area?: string | null;
  address?: string | null;
  requested_date: string;
  requested_time: string;
  notes?: string | null;
  inscription?: string | null;
  design_image_url?: string | null;
  subtotal: number;
  delivery_fee: number;
  lines: CartLine[];
};

/**
 * Saves a storefront checkout into the database as a pending ("new") order.
 * Anonymous insert policies allow this, and Realtime broadcasts it to /sales and /kds.
 */
export async function saveStorefrontOrder(input: StorefrontOrderInput) {
  const total = input.subtotal + input.delivery_fee;
  // Customers may insert but not read orders, so the id is generated here
  // instead of reading it back from the insert.
  const orderId = crypto.randomUUID();

  const { error } = await supabase.from("orders").insert({
    id: orderId,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    method: input.method,
    area: input.area ?? null,
    address: input.address ?? null,
    requested_date: input.requested_date,
    requested_time: input.requested_time,
    notes: input.notes ?? null,
    inscription: input.inscription ?? null,
    design_image_url: input.design_image_url ?? null,
    subtotal: input.subtotal,
    delivery_fee: input.delivery_fee,
    total,
    status: "new",
  });

  if (error) throw new Error(error.message);


  const items = input.lines.map((line) => ({
    order_id: orderId,
    name_ar: line.ar,
    name_en: line.en,
    unit_price: line.unit,
    quantity: line.qty,
    options_ar: line.detailsAr ?? [],
    options_en: line.detailsEn ?? [],
    notes: line.notes?.trim() || null,
  }));

  if (items.length > 0) {
    const { error: itemError } = await supabase.from("order_items").insert(items);
    if (itemError) throw new Error(itemError.message);
  }

  return { id: orderId };
}
