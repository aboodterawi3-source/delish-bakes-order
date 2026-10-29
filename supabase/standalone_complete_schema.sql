-- ==============================================================================
-- DELISH CAKE & BAKE — STANDALONE PRODUCTION DATABASE SCHEMA
-- Amman, Jordan (Asia/Amman)
-- Complete, self-contained, idempotent PostgreSQL schema for standalone Supabase.
-- Run this in the Supabase SQL Editor on a fresh, clean Supabase project.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create private schema for role checking functions
CREATE SCHEMA IF NOT EXISTS private;

-- 2. ENUM TYPES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'kitchen', 'social');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'new', 'confirmed', 'baking', 'ready', 'out_for_delivery', 'completed', 'delivered', 'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_method') THEN
    CREATE TYPE public.order_method AS ENUM ('delivery', 'pickup');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'cliq', 'visa');
  END IF;
END $$;

-- 3. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 4. ROLES AND ACCESS CONTROL TABLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.staff_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  staff_code integer NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_setup_state (
  id boolean PRIMARY KEY DEFAULT true,
  admin_setup_completed_at timestamptz,
  CONSTRAINT single_row CHECK (id = true)
);

-- Role lookup helper in private schema
CREATE OR REPLACE FUNCTION private.has_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- 5. STOREFRONT & CATALOG TABLES
CREATE TABLE IF NOT EXISTS public.storefront_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  icon text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storefront_banner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  subtitle_ar text,
  subtitle_en text,
  badge_ar text,
  badge_en text,
  image_url text,
  action_label_ar text,
  action_label_en text,
  action_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.storefront_categories(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Cake',
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  filling_ar text,
  filling_en text,
  price numeric(10, 2) NOT NULL DEFAULT 0.00,
  image_url text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_popular boolean NOT NULL DEFAULT false,
  rating numeric(3, 2) NOT NULL DEFAULT 5.0,
  rating_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  tint text NOT NULL DEFAULT 'blush',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('DL-' || nextval('public.orders_order_number_seq')::text),
  client_request_id uuid UNIQUE,
  staff_code integer,
  queue_rank integer,
  order_name text,
  recipient_name text,
  sender_phone text,
  recipient_phone text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  method public.order_method NOT NULL DEFAULT 'pickup',
  area text,
  address text,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  event_date date,
  is_urgent boolean NOT NULL DEFAULT false,
  is_gift boolean DEFAULT false,
  servings text,
  notes text,
  staff_notes text,
  inscription text,
  card_note text,
  design_image_url text,
  final_photo_requested boolean NOT NULL DEFAULT false,
  confirmation_message text,
  subtotal numeric(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
  total numeric(10, 2) NOT NULL DEFAULT 0.00,
  deposit_paid numeric(10, 2) NOT NULL DEFAULT 0.00,
  payment_method public.payment_method DEFAULT 'cash',
  driver_name text,
  driver_phone text,
  cancel_reason text,
  status public.order_status NOT NULL DEFAULT 'new',
  modifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  schedule_updated_at timestamptz,
  last_edited_at timestamptz,
  last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0.00,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  options_ar text[] NOT NULL DEFAULT '{}',
  options_en text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. ORDER PAYMENTS LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  payment_type text NOT NULL DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'remainder', 'full', 'refund')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  reference_number text,
  notes text,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. AUDIT LOGS & TOKENS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  action text NOT NULL,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name text NOT NULL DEFAULT 'النظام',
  original_amount numeric(10, 2),
  modified_amount numeric(10, 2),
  discount_percent numeric(5, 2),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_edit_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. INDEXES FOR PERFORMANCE AND FILTERING
CREATE INDEX IF NOT EXISTS idx_orders_requested_date_time ON public.orders(requested_date, requested_time);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_client_request_id ON public.orders(client_request_id);
CREATE INDEX IF NOT EXISTS idx_orders_version ON public.orders(version);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON public.audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- 11. SECURITY: ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_edit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_setup_state ENABLE ROW LEVEL SECURITY;

-- Catalog Policies (Public read, staff manage)
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (is_available = true);
CREATE POLICY "Staff manage products" ON public.products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

CREATE POLICY "Public read categories" ON public.storefront_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage categories" ON public.storefront_categories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

CREATE POLICY "Public read banner" ON public.storefront_banner FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage banner" ON public.storefront_banner FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

-- User Roles Policies
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Staff Codes Policies
CREATE POLICY "Users read own staff code" ON public.staff_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage staff codes" ON public.staff_codes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Orders Policies
CREATE POLICY "Staff view orders" ON public.orders FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social') OR
    private.has_role(auth.uid(), 'kitchen')
  );

CREATE POLICY "Sales, social and admin create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

CREATE POLICY "Sales and admin update orders" ON public.orders FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social') OR
    private.has_role(auth.uid(), 'kitchen')
  );

CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Order Items Policies
CREATE POLICY "Staff view order items" ON public.order_items FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social') OR
    private.has_role(auth.uid(), 'kitchen')
  );

CREATE POLICY "Sales and admin manage order items" ON public.order_items FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

-- Order Payments Ledger Policies
CREATE POLICY "Staff view order payments" ON public.order_payments FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

CREATE POLICY "Sales and admin create payments" ON public.order_payments FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

CREATE POLICY "Admins update or delete payments" ON public.order_payments FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Audit Logs Policies
CREATE POLICY "Staff view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));
CREATE POLICY "System insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- 12. SECURITY TRIGGER: RESTRICT KITCHEN ROLE TO PREP ONLY
CREATE OR REPLACE FUNCTION public.fn_enforce_kitchen_order_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF private.has_role(auth.uid(), 'kitchen') AND NOT private.has_role(auth.uid(), 'admin') THEN
    IF (OLD.total IS DISTINCT FROM NEW.total) OR
       (OLD.subtotal IS DISTINCT FROM NEW.subtotal) OR
       (OLD.delivery_fee IS DISTINCT FROM NEW.delivery_fee) OR
       (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount) OR
       (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) OR
       (OLD.payment_method IS DISTINCT FROM NEW.payment_method) OR
       (OLD.customer_name IS DISTINCT FROM NEW.customer_name) OR
       (OLD.customer_phone IS DISTINCT FROM NEW.customer_phone) OR
       (OLD.recipient_phone IS DISTINCT FROM NEW.recipient_phone) OR
       (OLD.sender_phone IS DISTINCT FROM NEW.sender_phone) THEN
      RAISE EXCEPTION 'غير مصرح لموظف المطبخ بتعديل البيانات المالية أو بيانات الاتصال · Kitchen staff cannot modify financial or customer identity data';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kitchen_order_restrictions ON public.orders;
CREATE TRIGGER trg_kitchen_order_restrictions
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_kitchen_order_restrictions();

-- 13. CORE ATOMIC RPC FUNCTIONS

-- A. Create Staff Order (Sales & Social) in a Single Guaranteed Transaction
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

-- B. Patch Sales Order Atomic with Optimistic Concurrency Control
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
  SELECT modifications, COALESCE(version, 1) INTO v_current_mods, v_current_version 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Optimistic Concurrency Control
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'تعارض في التعديل: تم تعديل هذا الطلب مسبقاً من قبل موظف آخر (النسخة الحالية: %, نسختك: %). يرجى إعادة تحميل الطلب · Optimistic locking conflict (current: %, expected: %)', v_current_version, p_expected_version, v_current_version, p_expected_version;
  END IF;

  v_updated_mods := COALESCE(v_current_mods, '[]'::jsonb) || COALESCE(p_new_mods, '[]'::jsonb);
  
  IF jsonb_array_length(v_updated_mods) > 30 THEN
    v_updated_mods := (
      SELECT jsonb_agg(val) FROM (
        SELECT val FROM jsonb_array_elements(v_updated_mods) WITH ORDINALITY AS t(val, ord)
        ORDER BY ord DESC LIMIT 30
      ) sub
    );
  END IF;

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

-- C. Record Order Payment Atomic
CREATE OR REPLACE FUNCTION public.record_order_payment_atomic(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_payment_type text DEFAULT 'deposit',
  p_status text DEFAULT 'confirmed',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_staff_user_id uuid DEFAULT NULL,
  p_staff_name text DEFAULT NULL
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
  SELECT total, deposit_paid, order_number, COALESCE(version, 1)
  INTO v_current_total, v_current_deposit, v_order_number, v_version
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  INSERT INTO public.order_payments (
    order_id, amount, payment_method, payment_type, status,
    reference_number, notes, staff_user_id, staff_name
  ) VALUES (
    p_order_id, p_amount, p_payment_method, p_payment_type, p_status,
    p_reference, p_notes, p_staff_user_id, p_staff_name
  );

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

  UPDATE public.orders
  SET
    deposit_paid = v_total_collected,
    version = COALESCE(version, 1) + 1,
    last_edited_at = now(),
    last_edited_by = p_staff_user_id
  WHERE id = p_order_id;

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

-- D. Acknowledge KDS Modifications Atomic
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
      IF (cardinality(p_mod_ids) = 0) OR (v_mod_elem->>'id' = ANY(p_mod_ids)) OR (v_mod_elem->>'updatedAt' = ANY(p_mod_ids)) THEN
        v_updated_mods := v_updated_mods || jsonb_build_array(
          v_mod_elem || jsonb_build_object(
            'acknowledgedAt', COALESCE(v_mod_elem->>'acknowledgedAt', v_now_iso),
            'acknowledgedBy', p_chef_user_id,
            'acknowledgedByName', p_chef_name
          )
        );
        v_acknowledged_count := v_acknowledged_count + 1;
      ELSE
        v_updated_mods := v_updated_mods || jsonb_build_array(v_mod_elem);
      END IF;
    END LOOP;
  ELSE
    v_updated_mods := jsonb_build_array(
      jsonb_build_object(
        'field', 'اعتماد التعديل بالمطبخ',
        'oldValue', 'تم التعديل',
        'newValue', 'تم الاطلاع والاعتماد من قبل شيف المطبخ ✓',
        'updatedAt', v_now_iso,
        'acknowledgedAt', v_now_iso,
        'acknowledgedBy', p_chef_user_id,
        'acknowledgedByName', p_chef_name
      )
    );
    v_acknowledged_count := 1;
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

-- E. Delete Sales Order Atomic
CREATE OR REPLACE FUNCTION public.delete_sales_order_atomic(target_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'غير مصرح: صلاحية الحذف متاحة للمدير فقط · Unauthorized: Admin only';
  END IF;

  DELETE FROM public.order_edit_tokens WHERE order_id = target_order_id;
  DELETE FROM public.audit_logs WHERE order_id = target_order_id;
  DELETE FROM public.order_payments WHERE order_id = target_order_id;
  DELETE FROM public.order_items WHERE order_id = target_order_id;
  DELETE FROM public.orders WHERE id = target_order_id;
END;
$$;

-- F. Clear All Sales Orders Atomic
CREATE OR REPLACE FUNCTION public.clear_all_sales_orders_atomic()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'غير مصرح: تنظيف كافة الطلبات متاح للمدير فقط · Unauthorized: Admin only';
  END IF;

  DELETE FROM public.order_edit_tokens;
  DELETE FROM public.audit_logs;
  DELETE FROM public.order_payments;
  DELETE FROM public.order_items;
  DELETE FROM public.orders;

  ALTER SEQUENCE public.orders_order_number_seq RESTART WITH 1001;
END;
$$;

-- G. Kitchen Order Feeds (SEC-04: Masking & Filtering)
CREATE OR REPLACE FUNCTION public.get_kitchen_orders()
RETURNS TABLE(
  id uuid,
  order_number text,
  staff_code integer,
  queue_rank integer,
  customer_name text,
  method public.order_method,
  requested_date text,
  requested_time text,
  notes text,
  inscription text,
  design_image_url text,
  status public.order_status,
  schedule_updated_at timestamptz,
  last_edited_at timestamptz,
  created_at timestamptz,
  is_urgent boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.order_number,
    o.staff_code,
    o.queue_rank,
    o.customer_name,
    o.method,
    o.requested_date::text,
    o.requested_time::text,
    o.notes,
    o.inscription,
    o.design_image_url,
    o.status,
    o.schedule_updated_at,
    o.last_edited_at,
    o.created_at,
    o.is_urgent
  FROM public.orders o
  ORDER BY o.requested_date ASC, o.requested_time ASC;
$$;

-- 14. REALTIME CONFIGURATION
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.order_payments REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
