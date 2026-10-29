-- ============================================================================
-- Delish Bakes - Production Hardening, Concurrency & Payment Ledger Migration
-- Timestamp: 2026-10-29
-- ============================================================================

-- 1. Optimistic Concurrency Version Counter on Orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Ensure explicit recipient_name and recipient_phone exist for clean gifting
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_phone text;

-- 2. Payment & Refund Ledger Table
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash', -- 'cash', 'cliq', 'visa'
  payment_type text NOT NULL DEFAULT 'deposit', -- 'deposit', 'settle', 'full', 'refund'
  status text NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'pending', 'refunded', 'void'
  reference_number text, -- CliQ transaction ID or receipt reference
  notes text,
  staff_user_id uuid,
  staff_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_created_at ON public.order_payments(created_at DESC);

-- Enable RLS on order_payments
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.order_payments FROM anon;
GRANT SELECT ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;

-- Only authenticated staff can view payments
CREATE POLICY "Allow authenticated staff to view order payments"
  ON public.order_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- Only sales, social and admin staff can insert payments (Kitchen cannot!)
CREATE POLICY "Allow authorized staff to insert order payments"
  ON public.order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- Only admin can update or delete payment records
CREATE POLICY "Allow admins to manage order payments"
  ON public.order_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Trigger: Restrict Kitchen updates to preparation status and acknowledgment only
CREATE OR REPLACE FUNCTION public.enforce_kitchen_order_update_restrictions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_roles text[];
BEGIN
  -- If executed by service_role or trigger without auth.uid, allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(role::text) INTO v_user_roles
  FROM public.user_roles
  WHERE user_id = auth.uid();

  -- If user has admin, sales, or social, they have broader update rights
  IF v_user_roles && ARRAY['admin', 'sales', 'social']::text[] THEN
    RETURN NEW;
  END IF;

  -- If user is purely kitchen staff, block financial and customer changes
  IF 'kitchen' = ANY(v_user_roles) THEN
    IF (OLD.subtotal IS DISTINCT FROM NEW.subtotal) OR
       (OLD.delivery_fee IS DISTINCT FROM NEW.delivery_fee) OR
       (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount) OR
       (OLD.total IS DISTINCT FROM NEW.total) OR
       (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) OR
       (OLD.payment_method IS DISTINCT FROM NEW.payment_method) OR
       (OLD.customer_name IS DISTINCT FROM NEW.customer_name) OR
       (OLD.customer_phone IS DISTINCT FROM NEW.customer_phone) OR
       (OLD.sender_phone IS DISTINCT FROM NEW.sender_phone) THEN
      RAISE EXCEPTION 'غير مصرح لموظف المطبخ بتعديل البيانات المالية أو بيانات العميل · Kitchen staff cannot edit prices or customer data';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kitchen_order_restrictions ON public.orders;
CREATE TRIGGER trg_enforce_kitchen_order_restrictions
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kitchen_order_update_restrictions();

-- 4. Atomic Function: Record Order Payment or Refund
CREATE OR REPLACE FUNCTION public.record_order_payment_atomic(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_type text, -- 'deposit', 'settle', 'full', 'refund'
  p_status text,       -- 'confirmed', 'pending'
  p_reference text,
  p_notes text,
  p_staff_user_id uuid,
  p_staff_name text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_total numeric;
  v_current_deposit numeric;
  v_total_collected numeric;
  v_order_number text;
  v_version integer;
  v_result jsonb;
BEGIN
  -- Lock the order row for update
  SELECT total, deposit_paid, order_number, version
  INTO v_current_total, v_current_deposit, v_order_number, v_version
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Insert payment ledger record
  INSERT INTO public.order_payments (
    order_id, amount, payment_method, payment_type, status,
    reference_number, notes, staff_user_id, staff_name
  ) VALUES (
    p_order_id, p_amount, p_payment_method, p_payment_type, p_status,
    p_reference, p_notes, p_staff_user_id, p_staff_name
  );

  -- Compute total confirmed payments minus refunds
  SELECT COALESCE(
    SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END),
    0
  )
  INTO v_total_collected
  FROM public.order_payments
  WHERE order_id = p_order_id AND status = 'confirmed';

  IF v_total_collected < 0 THEN
    RAISE EXCEPTION 'مبلغ الاسترجاع يتجاوز إجمالي المبالغ المحصلة · Refund exceeds collected payments';
  END IF;

  -- Update order deposit_paid and increment version
  UPDATE public.orders
  SET
    deposit_paid = v_total_collected,
    version = COALESCE(version, 1) + 1,
    last_edited_at = now(),
    last_edited_by = p_staff_user_id
  WHERE id = p_order_id;

  -- If refund, write to audit_logs
  IF p_payment_type = 'refund' THEN
    INSERT INTO public.audit_logs (
      order_id, order_number, staff_user_id, staff_name,
      action, original_amount, modified_amount, reason
    ) VALUES (
      p_order_id, v_order_number, p_staff_user_id, p_staff_name,
      'payment_refund', v_current_deposit, v_total_collected,
      COALESCE(p_notes, 'استرجاع مالي للعميل')
    );
  END IF;

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'total', v_current_total,
    'deposit_paid', v_total_collected,
    'remaining', GREATEST(v_current_total - v_total_collected, 0),
    'refund_due', GREATEST(v_total_collected - v_current_total, 0),
    'version', v_version + 1
  );

  RETURN v_result;
END;
$$;

-- 5. Atomic Function: Create Staff Order (Sales & Social) in a Single Guaranteed Transaction
CREATE OR REPLACE FUNCTION public.create_staff_order_atomic(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_client_request_id uuid;
  v_existing_order jsonb;
  v_initial_deposit numeric;
  v_subtotal numeric;
  v_delivery_fee numeric;
  v_discount_amount numeric;
  v_discount_percent numeric;
  v_total numeric;
  v_user_id uuid;
  v_staff_name text;
  v_initial_modifications jsonb;
BEGIN
  -- Idempotency check
  IF (p_order->>'client_request_id') IS NOT NULL AND (p_order->>'client_request_id') != '' THEN
    v_client_request_id := (p_order->>'client_request_id')::uuid;
    SELECT jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'total', o.total,
      'subtotal', o.subtotal,
      'delivery_fee', o.delivery_fee,
      'deposit_paid', o.deposit_paid,
      'version', o.version
    ) INTO v_existing_order
    FROM public.orders o
    WHERE o.client_request_id = v_client_request_id;

    IF v_existing_order IS NOT NULL THEN
      RETURN v_existing_order;
    END IF;
  END IF;

  v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
  v_delivery_fee := COALESCE((p_order->>'delivery_fee')::numeric, 0);
  v_discount_amount := COALESCE((p_order->>'discount_amount')::numeric, 0);
  v_discount_percent := COALESCE((p_order->>'discount_percent')::numeric, 0);
  v_total := COALESCE((p_order->>'total')::numeric, GREATEST(v_subtotal + v_delivery_fee - v_discount_amount, 0));
  v_initial_deposit := COALESCE((p_order->>'deposit_paid')::numeric, 0);
  v_user_id := (p_order->>'user_id')::uuid;
  v_staff_name := p_order->>'staff_name';
  v_initial_modifications := COALESCE(p_order->'modifications', '[]'::jsonb);

  -- Insert order
  INSERT INTO public.orders (
    customer_name, customer_phone, order_name, recipient_name,
    sender_phone, recipient_phone, method, area, address,
    requested_date, requested_time, event_date, notes, inscription,
    staff_notes, card_note, design_image_url, payment_method,
    deposit_paid, subtotal, delivery_fee, discount_amount, discount_percent,
    total, status, is_urgent, created_by, staff_code, client_request_id,
    modifications, version
  ) VALUES (
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'order_name',
    COALESCE(p_order->>'recipient_name', p_order->>'order_name'),
    p_order->>'sender_phone',
    p_order->>'recipient_phone',
    (p_order->>'method')::public.order_method,
    p_order->>'area',
    p_order->>'address',
    (p_order->>'requested_date')::date,
    (p_order->>'requested_time')::time,
    CASE WHEN (p_order->>'event_date') IS NOT NULL AND (p_order->>'event_date') != '' THEN (p_order->>'event_date')::date ELSE NULL END,
    p_order->>'notes',
    p_order->>'inscription',
    p_order->>'staff_notes',
    p_order->>'card_note',
    p_order->>'design_image_url',
    CASE WHEN (p_order->>'payment_method') IS NOT NULL THEN (p_order->>'payment_method')::public.payment_method ELSE NULL END,
    v_initial_deposit,
    v_subtotal,
    v_delivery_fee,
    v_discount_amount,
    v_discount_percent,
    v_total,
    'new'::public.order_status,
    COALESCE((p_order->>'is_urgent')::boolean, false),
    v_user_id,
    (p_order->>'staff_code')::integer,
    v_client_request_id,
    v_initial_modifications,
    1
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert items
  INSERT INTO public.order_items (
    order_id, product_id, name_ar, name_en, unit_price, quantity,
    options_ar, options_en, notes
  )
  SELECT
    v_order_id,
    CASE WHEN (item->>'product_id') IS NOT NULL AND (item->>'product_id') != '' THEN (item->>'product_id')::uuid ELSE NULL END,
    item->>'name_ar',
    COALESCE(item->>'name_en', item->>'name_ar'),
    (item->>'unit_price')::numeric,
    (item->>'quantity')::integer,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_ar', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_en', '[]'::jsonb))),
    item->>'notes'
  FROM jsonb_array_elements(p_items) AS item;

  -- If deposit was provided, log into order_payments ledger
  IF v_initial_deposit > 0 THEN
    INSERT INTO public.order_payments (
      order_id, amount, payment_method, payment_type, status,
      reference_number, notes, staff_user_id, staff_name
    ) VALUES (
      v_order_id,
      v_initial_deposit,
      COALESCE(p_order->>'payment_method', 'cash'),
      CASE WHEN v_initial_deposit >= v_total THEN 'full' ELSE 'deposit' END,
      'confirmed',
      'Initial tender at creation',
      'عربون / دفعة مبدئية عند إنشاء الطلب',
      v_user_id,
      v_staff_name
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'deposit_paid', v_initial_deposit,
    'version', 1
  );
END;
$$;

-- 6. Atomic Function: Acknowledge KDS Modifications
CREATE OR REPLACE FUNCTION public.acknowledge_kds_modifications_atomic(
  p_order_id uuid,
  p_mod_ids text[],
  p_chef_user_id uuid,
  p_chef_name text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mods jsonb;
  v_mod_elem jsonb;
  v_updated_mods jsonb := '[]'::jsonb;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_acknowledged_count integer := 0;
BEGIN
  SELECT modifications INTO v_mods
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  IF v_mods IS NOT NULL AND jsonb_typeof(v_mods) = 'array' THEN
    FOR v_mod_elem IN SELECT * FROM jsonb_array_elements(v_mods)
    LOOP
      -- Check if this mod's id or timestamp is in p_mod_ids
      IF (v_mod_elem->>'id' = ANY(p_mod_ids)) OR (v_mod_elem->>'updatedAt' = ANY(p_mod_ids)) THEN
        v_updated_mods := v_updated_mods || jsonb_build_array(
          v_mod_elem || jsonb_build_object(
            'acknowledgedAt', COALESCE(v_mod_elem->>'acknowledgedAt', v_now_iso),
            'acknowledgedBy', p_chef_user_id,
            'acknowledgedByName', p_chef_name
          )
        );
        v_acknowledged_count := v_acknowledged_count + 1;
      ELSE
        -- Retain mod unchanged (e.g. newly arrived modifications)
        v_updated_mods := v_updated_mods || jsonb_build_array(v_mod_elem);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET modifications = v_updated_mods
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'acknowledged_count', v_acknowledged_count,
    'modifications', v_updated_mods
  );
END;
$$;

-- 7. Enhanced Atomic Patch with Optimistic Concurrency Control
CREATE OR REPLACE FUNCTION public.patch_sales_order_atomic(
  p_order_id uuid,
  p_patch jsonb,
  p_new_mods jsonb,
  p_user_id uuid,
  p_expected_version integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_mods jsonb;
  v_updated_mods jsonb;
  v_current_version integer;
  v_result jsonb;
BEGIN
  -- Lock the row to serialize concurrent writes
  SELECT modifications, COALESCE(version, 1) INTO v_current_mods, v_current_version 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Optimistic Concurrency Control Check
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'تعارض في التعديل: تم تعديل هذا الطلب مسبقاً من قبل موظف آخر (النسخة الحالية: %, نسختك: %). يرجى إعادة تحميل الطلب · Optimistic locking conflict (current: %, expected: %)', v_current_version, p_expected_version, v_current_version, p_expected_version;
  END IF;

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
    status = CASE WHEN p_patch ? 'status' THEN (p_patch->>'status')::public.order_status ELSE status END,
    cancel_reason = CASE WHEN p_patch ? 'cancel_reason' THEN (p_patch->>'cancel_reason') ELSE cancel_reason END,
    method = CASE WHEN p_patch ? 'method' THEN (p_patch->>'method')::public.order_method ELSE method END,
    delivery_fee = CASE WHEN p_patch ? 'delivery_fee' THEN (p_patch->>'delivery_fee')::numeric ELSE delivery_fee END,
    area = CASE WHEN p_patch ? 'area' THEN (p_patch->>'area') ELSE area END,
    deposit_paid = CASE WHEN p_patch ? 'deposit_paid' THEN (p_patch->>'deposit_paid')::numeric ELSE deposit_paid END,
    payment_method = CASE WHEN p_patch ? 'payment_method' THEN (p_patch->>'payment_method')::public.payment_method ELSE payment_method END,
    driver_name = CASE WHEN p_patch ? 'driver_name' THEN (p_patch->>'driver_name') ELSE driver_name END,
    driver_phone = CASE WHEN p_patch ? 'driver_phone' THEN (p_patch->>'driver_phone') ELSE driver_phone END,
    card_note = CASE WHEN p_patch ? 'card_note' THEN (p_patch->>'card_note') ELSE card_note END,
    final_photo_requested = CASE WHEN p_patch ? 'final_photo_requested' THEN (p_patch->>'final_photo_requested')::boolean ELSE final_photo_requested END,
    confirmation_message = CASE WHEN p_patch ? 'confirmation_message' THEN (p_patch->>'confirmation_message') ELSE confirmation_message END,
    order_name = CASE WHEN p_patch ? 'order_name' THEN (p_patch->>'order_name') ELSE order_name END,
    recipient_name = CASE WHEN p_patch ? 'recipient_name' THEN (p_patch->>'recipient_name') WHEN p_patch ? 'order_name' THEN (p_patch->>'order_name') ELSE recipient_name END,
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
    version = v_current_version + 1,
    last_edited_at = now(),
    last_edited_by = p_user_id
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  RETURN v_result;
END;
$$;

