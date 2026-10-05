-- Migration: Atomic Operations for Orders
-- Resolves DB-01 and LOG-01

-- 1. Atomic Order Deletion (Replaces non-atomic client-side multi-deletes)
CREATE OR REPLACE FUNCTION public.delete_sales_order_atomic(target_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Delete all associated records inside a single guaranteed transaction
  DELETE FROM public.order_edit_tokens WHERE order_id = target_order_id;
  DELETE FROM public.order_items WHERE order_id = target_order_id;
  DELETE FROM public.orders WHERE id = target_order_id;
END;
$$;

-- 2. Atomic Clear All Orders (For testing/reset)
CREATE OR REPLACE FUNCTION public.clear_all_sales_orders_atomic()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Delete everything except the dummy '00000000-0000-0000-0000-000000000000' records if they exist
  DELETE FROM public.order_edit_tokens WHERE id != '00000000-0000-0000-0000-000000000000';
  DELETE FROM public.order_items WHERE id != '00000000-0000-0000-0000-000000000000';
  DELETE FROM public.orders WHERE id != '00000000-0000-0000-0000-000000000000';
END;
$$;

-- 3. Atomic Storefront Checkout (Replaces non-atomic client-side inserts and fragile rollbacks)
CREATE OR REPLACE FUNCTION public.create_storefront_order_atomic(
  order_payload jsonb,
  items_payload jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_order_id uuid;
  new_order_number text;
  new_subtotal numeric;
  new_delivery numeric;
  new_total numeric;
  result jsonb;
BEGIN
  -- Insert the order and return the generated ID and Number
  INSERT INTO public.orders (
    customer_name, customer_phone, method, area, address, requested_date,
    requested_time, notes, inscription, design_image_url, payment_method,
    subtotal, delivery_fee, total, status, client_request_id
  )
  SELECT
    order_payload->>'customer_name',
    order_payload->>'customer_phone',
    (order_payload->>'method')::public.order_method,
    order_payload->>'area',
    order_payload->>'address',
    (order_payload->>'requested_date')::date,
    (order_payload->>'requested_time')::time,
    order_payload->>'notes',
    order_payload->>'inscription',
    order_payload->>'design_image_url',
    (order_payload->>'payment_method')::public.payment_method,
    (order_payload->>'subtotal')::numeric,
    (order_payload->>'delivery_fee')::numeric,
    (order_payload->>'total')::numeric,
    (order_payload->>'status')::public.order_status,
    (order_payload->>'client_request_id')::uuid
  RETURNING id, order_number, subtotal, delivery_fee, total
  INTO new_order_id, new_order_number, new_subtotal, new_delivery, new_total;

  -- Insert all items associated with this new order ID atomically
  INSERT INTO public.order_items (
    order_id, name_ar, name_en, unit_price, quantity, options_ar, options_en, notes
  )
  SELECT
    new_order_id,
    item->>'name_ar',
    item->>'name_en',
    (item->>'unit_price')::numeric,
    (item->>'quantity')::integer,
    ARRAY(SELECT jsonb_array_elements_text(item->'options_ar')),
    ARRAY(SELECT jsonb_array_elements_text(item->'options_en')),
    item->>'notes'
  FROM jsonb_array_elements(items_payload) AS item;

  -- Build and return the response payload matching the client expectation
  result := jsonb_build_object(
    'id', new_order_id,
    'order_number', new_order_number,
    'subtotal', new_subtotal,
    'delivery_fee', new_delivery,
    'total', new_total
  );
  
  RETURN result;
END;
$$;
