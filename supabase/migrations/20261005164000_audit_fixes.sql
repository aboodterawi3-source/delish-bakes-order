-- Migration: Zero-Tolerance Audit Fixes (Transactions & Race Conditions)
-- Fixes DB-03 and RACE-01

-- 1. Atomic Order Rebuild (Prevents Orphaned Items when modifying order lines)
CREATE OR REPLACE FUNCTION public.rebuild_sales_order_atomic(
  p_order_id uuid,
  p_lines jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_user_id uuid,
  p_new_mods jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_mods jsonb;
  v_updated_mods jsonb;
BEGIN
  -- Lock the row to serialize concurrent writes
  SELECT modifications INTO v_current_mods 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  -- Append new modifications and enforce max 30 limit
  IF jsonb_array_length(p_new_mods) > 0 THEN
    v_updated_mods := COALESCE(v_current_mods, '[]'::jsonb) || p_new_mods;
    IF jsonb_array_length(v_updated_mods) > 30 THEN
      v_updated_mods := jsonb_path_query_array(
        v_updated_mods, 
        '$[(jsonb_array_length(@) - 30) to (jsonb_array_length(@) - 1)]'
      );
    END IF;
  ELSE
    v_updated_mods := v_current_mods;
  END IF;

  -- Clear all old items
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  
  -- Insert all new items atomically
  INSERT INTO public.order_items (order_id, product_id, name_ar, name_en, unit_price, quantity, options_ar, options_en, notes)
  SELECT 
    p_order_id,
    CASE WHEN item->>'product_id' IS NOT NULL THEN (item->>'product_id')::uuid ELSE NULL END,
    item->>'name_ar',
    item->>'name_en',
    (item->>'unit_price')::numeric,
    (item->>'quantity')::integer,
    ARRAY(SELECT jsonb_array_elements_text(item->'options_ar')),
    ARRAY(SELECT jsonb_array_elements_text(item->'options_en')),
    item->>'notes'
  FROM jsonb_array_elements(p_lines) AS item;

  -- Commit changes to the order row
  UPDATE public.orders 
  SET 
    subtotal = p_subtotal,
    delivery_fee = p_delivery_fee,
    discount_amount = p_discount_amount,
    total = p_total,
    last_edited_at = now(),
    last_edited_by = p_user_id,
    modifications = v_updated_mods
  WHERE id = p_order_id;
END;
$$;

-- 2. Atomic Order Patch (Fixes Lost Updates via Read-Modify-Write Race Conditions on JSONB)
CREATE OR REPLACE FUNCTION public.patch_sales_order_atomic(
  p_order_id uuid,
  p_patch jsonb,
  p_new_mods jsonb,
  p_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_mods jsonb;
  v_updated_mods jsonb;
  v_result jsonb;
BEGIN
  -- Lock the row to serialize concurrent writes
  SELECT modifications INTO v_current_mods 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  -- Safely merge new modifications with existing ones
  v_updated_mods := COALESCE(v_current_mods, '[]'::jsonb) || COALESCE(p_new_mods, '[]'::jsonb);
  
  -- Truncate to last 30 items
  IF jsonb_array_length(v_updated_mods) > 30 THEN
    v_updated_mods := (
      SELECT jsonb_agg(val) FROM (
        SELECT val FROM jsonb_array_elements(v_updated_mods) WITH ORDINALITY AS t(val, ord)
        ORDER BY ord DESC LIMIT 30
      ) sub
    );
  END IF;

  -- Apply the patch using strict key presence checks (p_patch ? 'key') to allow nulling fields
  UPDATE public.orders 
  SET 
    status = CASE WHEN p_patch ? 'status' THEN (p_patch->>'status') ELSE status END,
    cancel_reason = CASE WHEN p_patch ? 'cancel_reason' THEN (p_patch->>'cancel_reason') ELSE cancel_reason END,
    method = CASE WHEN p_patch ? 'method' THEN (p_patch->>'method') ELSE method END,
    delivery_fee = CASE WHEN p_patch ? 'delivery_fee' THEN (p_patch->>'delivery_fee')::numeric ELSE delivery_fee END,
    area = CASE WHEN p_patch ? 'area' THEN (p_patch->>'area') ELSE area END,
    deposit_paid = CASE WHEN p_patch ? 'deposit_paid' THEN (p_patch->>'deposit_paid')::numeric ELSE deposit_paid END,
    payment_method = CASE WHEN p_patch ? 'payment_method' THEN (p_patch->>'payment_method') ELSE payment_method END,
    driver_name = CASE WHEN p_patch ? 'driver_name' THEN (p_patch->>'driver_name') ELSE driver_name END,
    driver_phone = CASE WHEN p_patch ? 'driver_phone' THEN (p_patch->>'driver_phone') ELSE driver_phone END,
    card_note = CASE WHEN p_patch ? 'card_note' THEN (p_patch->>'card_note') ELSE card_note END,
    final_photo_requested = CASE WHEN p_patch ? 'final_photo_requested' THEN (p_patch->>'final_photo_requested')::boolean ELSE final_photo_requested END,
    confirmation_message = CASE WHEN p_patch ? 'confirmation_message' THEN (p_patch->>'confirmation_message') ELSE confirmation_message END,
    order_name = CASE WHEN p_patch ? 'order_name' THEN (p_patch->>'order_name') ELSE order_name END,
    sender_phone = CASE WHEN p_patch ? 'sender_phone' THEN (p_patch->>'sender_phone') ELSE sender_phone END,
    recipient_phone = CASE WHEN p_patch ? 'recipient_phone' THEN (p_patch->>'recipient_phone') ELSE recipient_phone END,
    address = CASE WHEN p_patch ? 'address' THEN (p_patch->>'address') ELSE address END,
    notes = CASE WHEN p_patch ? 'notes' THEN (p_patch->>'notes') ELSE notes END,
    staff_notes = CASE WHEN p_patch ? 'staff_notes' THEN (p_patch->>'staff_notes') ELSE staff_notes END,
    inscription = CASE WHEN p_patch ? 'inscription' THEN (p_patch->>'inscription') ELSE inscription END,
    customer_name = CASE WHEN p_patch ? 'customer_name' THEN (p_patch->>'customer_name') ELSE customer_name END,
    customer_phone = CASE WHEN p_patch ? 'customer_phone' THEN (p_patch->>'customer_phone') ELSE customer_phone END,
    requested_date = CASE WHEN p_patch ? 'requested_date' THEN (p_patch->>'requested_date')::date ELSE requested_date END,
    requested_time = CASE WHEN p_patch ? 'requested_time' THEN (p_patch->>'requested_time')::time ELSE requested_time END,
    modifications = v_updated_mods,
    last_edited_at = now(),
    last_edited_by = p_user_id
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  RETURN v_result;
END;
$$;
