-- ==============================================================================
-- DELISH CAKE & BAKE — COMPLETE STANDALONE SUPABASE SCHEMA (V2 HARDENED)
-- Idempotent, self-contained schema with strict RPC access control,
-- Row Level Security (RLS), Optimistic Concurrency Control,
-- and financial ledger integrity.
-- ==============================================================================

-- 1. EXTENSIONS & SCHEMAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS private;

-- 2. ENUMS & CUSTOM TYPES
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

CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  allow_price_override boolean NOT NULL DEFAULT false,
  allow_custom_discount boolean NOT NULL DEFAULT false,
  max_discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  tint text DEFAULT 'blush',
  priority_color text DEFAULT 'gold',
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
  subtitle text,
  discount_text text,
  button_text text,
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
  price_on_request boolean NOT NULL DEFAULT false,
  image_url text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_popular boolean NOT NULL DEFAULT false,
  rating numeric(3, 2) NOT NULL DEFAULT 5.0,
  rating_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  tint text NOT NULL DEFAULT 'blush',
  priority_color text DEFAULT 'gold',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_product_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  can_edit_price boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_product_permissions_unique UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  store_name text NOT NULL DEFAULT 'Delish Cake & Bake',
  cliq_alias text NOT NULL DEFAULT 'DELISHBAKES',
  contact_phone text NOT NULL DEFAULT '+962790000000',
  card_color_palette text NOT NULL DEFAULT 'gold',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_store_settings CHECK (singleton = true)
);

-- 6. ORDERS AND ITEMS TABLES
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT ('DL-' || nextval('public.orders_order_number_seq'::regclass)),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  order_name text,
  recipient_name text,
  sender_phone text,
  recipient_phone text,
  method public.order_method NOT NULL DEFAULT 'pickup',
  area text,
  address text,
  requested_date date NOT NULL DEFAULT CURRENT_DATE,
  requested_time time without time zone NOT NULL DEFAULT '12:00:00'::time,
  event_date date,
  notes text,
  inscription text,
  staff_notes text,
  card_note text,
  design_image_url text,
  receipt_image_url text,
  payment_receipt_url text,
  payment_method public.payment_method,
  deposit_paid numeric(10, 2) NOT NULL DEFAULT 0.00,
  subtotal numeric(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0.00,
  total numeric(10, 2) NOT NULL DEFAULT 0.00,
  status public.order_status NOT NULL DEFAULT 'new',
  is_urgent boolean NOT NULL DEFAULT false,
  final_photo_requested boolean NOT NULL DEFAULT false,
  driver_name text,
  driver_phone text,
  confirmation_message text,
  cancel_reason text,
  modifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_items jsonb,
  staff_code integer,
  client_request_id text UNIQUE,
  version integer NOT NULL DEFAULT 1,
  queue_rank integer,
  schedule_updated_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_edited_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0.00,
  quantity integer NOT NULL DEFAULT 1,
  options_ar text[] DEFAULT '{}'::text[],
  options_en text[] DEFAULT '{}'::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. FINANCIAL PAYMENTS LEDGER
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_type text NOT NULL DEFAULT 'deposit', -- 'deposit', 'full', 'refund', 'balance'
  status text NOT NULL DEFAULT 'confirmed',     -- 'confirmed', 'pending', 'voided'
  reference_number text,
  notes text,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. AUDIT LOGS, MESSAGES AND TOKENS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name text NOT NULL,
  action text NOT NULL,
  original_amount numeric(10, 2),
  modified_amount numeric(10, 2),
  discount_percent numeric(5, 2),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  name text,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_edit_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. STORAGE BUCKETS INITIALIZATION
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('order-designs', 'order-designs', false),
      ('site-media', 'site-media', true),
      ('payment-receipts', 'payment-receipts', false)
    ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
  END IF;
END $$;

-- 10. INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_requested_date ON public.orders(requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_client_request_id ON public.orders(client_request_id);
CREATE INDEX IF NOT EXISTS idx_orders_version ON public.orders(version);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_idempotency_key ON public.order_payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON public.audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- 11. SECURITY: ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_product_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_edit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_setup_state ENABLE ROW LEVEL SECURITY;

-- Catalog Policies (Idempotent: DROP IF EXISTS then CREATE)
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "Staff manage products" ON public.products;
CREATE POLICY "Staff manage products" ON public.products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Public read categories" ON public.storefront_categories;
CREATE POLICY "Public read categories" ON public.storefront_categories FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff manage categories" ON public.storefront_categories;
CREATE POLICY "Staff manage categories" ON public.storefront_categories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Public read banner" ON public.storefront_banner;
CREATE POLICY "Public read banner" ON public.storefront_banner FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff manage banner" ON public.storefront_banner;
CREATE POLICY "Staff manage banner" ON public.storefront_banner FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

DROP POLICY IF EXISTS "Public read store settings" ON public.store_settings;
CREATE POLICY "Public read store settings" ON public.store_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage store settings" ON public.store_settings;
CREATE POLICY "Staff manage store settings" ON public.store_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- User Roles & Permissions Policies
DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff read their own product permissions" ON public.sales_product_permissions;
CREATE POLICY "Staff read their own product permissions" ON public.sales_product_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage product permissions" ON public.sales_product_permissions;
CREATE POLICY "Admins manage product permissions" ON public.sales_product_permissions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff read permissions" ON public.staff_permissions;
CREATE POLICY "Staff read permissions" ON public.staff_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage staff permissions" ON public.staff_permissions;
CREATE POLICY "Admins manage staff permissions" ON public.staff_permissions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Orders Policies
-- Sales, Social, Admin view all order data. Kitchen views active orders via KDS server functions or restricted RPC.
DROP POLICY IF EXISTS "Staff view orders" ON public.orders;
CREATE POLICY "Staff view orders" ON public.orders FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social') OR
    private.has_role(auth.uid(), 'kitchen')
  );

DROP POLICY IF EXISTS "Sales, social and admin create orders" ON public.orders;
CREATE POLICY "Sales, social and admin create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

-- STRICT: Kitchen role is EXCLUDED from direct UPDATE on orders table!
DROP POLICY IF EXISTS "Sales and admin update orders" ON public.orders;
CREATE POLICY "Sales and admin update orders" ON public.orders FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Order Items Policies
DROP POLICY IF EXISTS "Staff view order items" ON public.order_items;
CREATE POLICY "Staff view order items" ON public.order_items FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social') OR
    private.has_role(auth.uid(), 'kitchen')
  );

DROP POLICY IF EXISTS "Sales and admin manage order items" ON public.order_items;
CREATE POLICY "Sales and admin manage order items" ON public.order_items FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

-- Order Payments Ledger Policies
DROP POLICY IF EXISTS "Staff view order payments" ON public.order_payments;
CREATE POLICY "Staff view order payments" ON public.order_payments FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

DROP POLICY IF EXISTS "Sales and admin create payments" ON public.order_payments;
CREATE POLICY "Sales and admin create payments" ON public.order_payments FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales')
  );

-- Audit Logs Policies: STRICT INSERT only by owner
DROP POLICY IF EXISTS "Staff view audit logs" ON public.audit_logs;
CREATE POLICY "Staff view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

DROP POLICY IF EXISTS "Staff insert own audit logs" ON public.audit_logs;
CREATE POLICY "Staff insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (staff_user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

-- Customer Messages Policies
DROP POLICY IF EXISTS "Staff manage customer messages" ON public.customer_messages;
CREATE POLICY "Staff manage customer messages" ON public.customer_messages FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

-- Storage Policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Public read site media" ON storage.objects;
    CREATE POLICY "Public read site media" ON storage.objects FOR SELECT
      USING (bucket_id = 'site-media');

    DROP POLICY IF EXISTS "Staff manage site media" ON storage.objects;
    CREATE POLICY "Staff manage site media" ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'site-media' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales')));

    DROP POLICY IF EXISTS "Staff view designs and receipts" ON storage.objects;
    CREATE POLICY "Staff view designs and receipts" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id IN ('order-designs', 'payment-receipts'));

    DROP POLICY IF EXISTS "Staff upload designs and receipts" ON storage.objects;
    CREATE POLICY "Staff upload designs and receipts" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id IN ('order-designs', 'payment-receipts'));
  END IF;
END $$;


-- 12. HARDENED ATOMIC RPC FUNCTIONS (SECURITY DEFINER + CALLER AUTH VERIFICATION)

-- A. Create Staff Order Atomic
CREATE OR REPLACE FUNCTION public.create_staff_order_atomic(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_total numeric := 0;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount_amount numeric := 0;
  v_discount_percent numeric := 0;
  v_initial_deposit numeric := 0;
  v_client_request_id text;
  v_initial_modifications jsonb := '[]'::jsonb;
  v_staff_name text;
  v_item jsonb;
BEGIN
  -- Strict caller verification
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول للقيام بهذه العملية · Unauthorized: Sign in required';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales') OR private.has_role(v_caller_id, 'social')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية إنشاء طلبات مبيعات · Forbidden: Sales or Admin role required';
  END IF;

  v_client_request_id := NULLIF(TRIM(p_order->>'client_request_id'), '');

  -- Idempotency Check: return existing order if request ID already exists
  IF v_client_request_id IS NOT NULL THEN
    SELECT id, order_number, total, subtotal, delivery_fee, deposit_paid
    INTO v_order_id, v_order_number, v_total, v_subtotal, v_delivery_fee, v_initial_deposit
    FROM public.orders
    WHERE client_request_id = v_client_request_id;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'total', v_total,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'deposit_paid', v_initial_deposit,
        'is_duplicate', true,
        'version', 1
      );
    END IF;
  END IF;

  -- Validate minimum items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل للطلب · At least one item is required';
  END IF;

  -- Calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'name_ar') IS NULL OR TRIM(v_item->>'name_ar') = '' THEN
      RAISE EXCEPTION 'اسم الصنف بالعربية مطلوب · Item name in Arabic is required';
    END IF;
    IF ((v_item->>'unit_price')::numeric) < 0 THEN
      RAISE EXCEPTION 'سعر الصنف لا يمكن أن يكون سالباً · Item price cannot be negative';
    END IF;
    v_subtotal := v_subtotal + (((v_item->>'unit_price')::numeric) * COALESCE((v_item->>'quantity')::integer, 1));
  END LOOP;

  v_delivery_fee := COALESCE((p_order->>'delivery_fee')::numeric, 0);
  v_discount_amount := COALESCE((p_order->>'discount_amount')::numeric, 0);
  v_discount_percent := COALESCE((p_order->>'discount_percent')::numeric, 0);
  v_initial_deposit := GREATEST(COALESCE((p_order->>'deposit_paid')::numeric, 0), 0);

  -- Server recalculates total to avoid client tampering
  v_total := GREATEST(v_subtotal + v_delivery_fee - v_discount_amount, 0);

  IF p_order ? 'modifications' AND p_order->'modifications' IS NOT NULL THEN
    v_initial_modifications := p_order->'modifications';
  END IF;

  -- Resolve staff name
  SELECT email INTO v_staff_name FROM auth.users WHERE id = v_caller_id;
  v_staff_name := COALESCE(p_order->>'staff_name', v_staff_name, 'موظف مبيعات');

  -- Insert Order Header
  INSERT INTO public.orders (
    customer_name, customer_phone, order_name, recipient_name, sender_phone, recipient_phone,
    method, area, address, requested_date, requested_time, event_date,
    notes, inscription, staff_notes, card_note, design_image_url, receipt_image_url,
    payment_method, deposit_paid, subtotal, delivery_fee, discount_amount, discount_percent,
    total, status, is_urgent, created_by, staff_code, client_request_id,
    modifications, original_items, version
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
    p_order->>'receipt_image_url',
    CASE WHEN (p_order->>'payment_method') IS NOT NULL THEN (p_order->>'payment_method')::public.payment_method ELSE NULL END,
    v_initial_deposit,
    v_subtotal,
    v_delivery_fee,
    v_discount_amount,
    v_discount_percent,
    v_total,
    'new'::public.order_status,
    COALESCE((p_order->>'is_urgent')::boolean, false),
    v_caller_id,
    (p_order->>'staff_code')::integer,
    v_client_request_id,
    v_initial_modifications,
    p_items,
    1
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert Order Items
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
    COALESCE((item->>'quantity')::integer, 1),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_ar', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_en', '[]'::jsonb))),
    item->>'notes'
  FROM jsonb_array_elements(p_items) AS item;

  -- If deposit was provided, log into order_payments ledger
  IF v_initial_deposit > 0 THEN
    INSERT INTO public.order_payments (
      order_id, amount, payment_method, payment_type, status,
      reference_number, notes, staff_user_id, staff_name, idempotency_key
    ) VALUES (
      v_order_id,
      v_initial_deposit,
      COALESCE(p_order->>'payment_method', 'cash'),
      CASE WHEN v_initial_deposit >= v_total THEN 'full' ELSE 'deposit' END,
      'confirmed',
      'Initial tender at creation',
      'عربون / دفعة مبدئية عند إنشاء الطلب',
      v_caller_id,
      v_staff_name,
      CASE WHEN v_client_request_id IS NOT NULL THEN v_client_request_id || '-init-pay' ELSE NULL END
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'deposit_paid', v_initial_deposit,
    'is_duplicate', false,
    'version', 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_order_atomic(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_order_atomic(jsonb, jsonb) TO authenticated;


-- B. Create Storefront Order Atomic (Customer Web Portal)
CREATE OR REPLACE FUNCTION public.create_storefront_order_atomic(
  order_payload jsonb,
  items_payload jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_order_id uuid;
  new_order_number text;
  new_subtotal numeric := 0;
  new_delivery numeric := 0;
  new_total numeric := 0;
  req_client_id text;
  item jsonb;
BEGIN
  req_client_id := NULLIF(TRIM(order_payload->>'client_request_id'), '');

  -- Idempotency check
  IF req_client_id IS NOT NULL THEN
    SELECT id, order_number, subtotal, delivery_fee, total
    INTO new_order_id, new_order_number, new_subtotal, new_delivery, new_total
    FROM public.orders
    WHERE client_request_id = req_client_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', new_order_id,
        'order_number', new_order_number,
        'subtotal', new_subtotal,
        'delivery_fee', new_delivery,
        'total', new_total
      );
    END IF;
  END IF;

  IF items_payload IS NULL OR jsonb_array_length(items_payload) = 0 THEN
    RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    new_subtotal := new_subtotal + (((item->>'unit_price')::numeric) * COALESCE((item->>'quantity')::integer, 1));
  END LOOP;

  new_delivery := COALESCE((order_payload->>'delivery_fee')::numeric, 0);
  new_total := new_subtotal + new_delivery;

  INSERT INTO public.orders (
    customer_name, customer_phone, method, area, address, requested_date,
    requested_time, notes, inscription, design_image_url, payment_method,
    subtotal, delivery_fee, total, status, client_request_id, original_items
  ) VALUES (
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
    new_subtotal,
    new_delivery,
    new_total,
    'new'::public.order_status,
    req_client_id,
    items_payload
  )
  RETURNING id, order_number INTO new_order_id, new_order_number;

  INSERT INTO public.order_items (
    order_id, name_ar, name_en, unit_price, quantity, options_ar, options_en, notes
  )
  SELECT
    new_order_id,
    item->>'name_ar',
    COALESCE(item->>'name_en', item->>'name_ar'),
    (item->>'unit_price')::numeric,
    COALESCE((item->>'quantity')::integer, 1),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_ar', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'options_en', '[]'::jsonb))),
    item->>'notes'
  FROM jsonb_array_elements(items_payload) AS item;

  -- Create order edit token for customer
  INSERT INTO public.order_edit_tokens (order_id) VALUES (new_order_id);

  RETURN jsonb_build_object(
    'id', new_order_id,
    'order_number', new_order_number,
    'subtotal', new_subtotal,
    'delivery_fee', new_delivery,
    'total', new_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_storefront_order_atomic(jsonb, jsonb) TO anon, authenticated;


-- C. Patch Sales Order Atomic with Optimistic Concurrency Control (OCC)
CREATE OR REPLACE FUNCTION public.patch_sales_order_atomic(
  p_order_id uuid,
  p_patch jsonb,
  p_new_mods jsonb,
  p_user_id uuid,
  p_expected_version integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_mods jsonb;
  v_updated_mods jsonb;
  v_current_version integer;
  v_current_subtotal numeric;
  v_current_delivery numeric;
  v_current_discount numeric;
  v_new_subtotal numeric;
  v_new_delivery numeric;
  v_new_discount numeric;
  v_new_total numeric;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales') OR private.has_role(v_caller_id, 'social')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية تعديل الطلبات';
  END IF;

  SELECT modifications, COALESCE(version, 1), subtotal, delivery_fee, discount_amount
  INTO v_current_mods, v_current_version, v_current_subtotal, v_current_delivery, v_current_discount
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Optimistic Concurrency Control
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'تعارض في التعديل: تم تعديل هذا الطلب مسبقاً (النسخة الحالية: %, نسختك: %). يرجى إعادة تحميل الطلب · Optimistic locking conflict (current: %, expected: %)', v_current_version, p_expected_version, v_current_version, p_expected_version;
  END IF;

  -- Recalculate totals if fee, discount or subtotal were updated
  v_new_subtotal := CASE WHEN p_patch ? 'subtotal' THEN (p_patch->>'subtotal')::numeric ELSE v_current_subtotal END;
  v_new_delivery := CASE WHEN p_patch ? 'delivery_fee' THEN (p_patch->>'delivery_fee')::numeric ELSE v_current_delivery END;
  v_new_discount := CASE WHEN p_patch ? 'discount_amount' THEN (p_patch->>'discount_amount')::numeric ELSE v_current_discount END;
  v_new_total := GREATEST(v_new_subtotal + v_new_delivery - v_new_discount, 0);

  -- Append modifications without truncating history
  v_updated_mods := COALESCE(v_current_mods, '[]'::jsonb) || COALESCE(p_new_mods, '[]'::jsonb);

  UPDATE public.orders 
  SET 
    status = CASE WHEN p_patch ? 'status' THEN (p_patch->>'status')::public.order_status ELSE status END,
    cancel_reason = CASE WHEN p_patch ? 'cancel_reason' THEN (p_patch->>'cancel_reason') ELSE cancel_reason END,
    method = CASE WHEN p_patch ? 'method' THEN (p_patch->>'method')::public.order_method ELSE method END,
    subtotal = v_new_subtotal,
    delivery_fee = v_new_delivery,
    discount_amount = v_new_discount,
    total = v_new_total,
    area = CASE WHEN p_patch ? 'area' THEN (p_patch->>'area') ELSE area END,
    payment_method = CASE WHEN p_patch ? 'payment_method' THEN (p_patch->>'payment_method')::public.payment_method ELSE payment_method END,
    driver_name = CASE WHEN p_patch ? 'driver_name' THEN (p_patch->>'driver_name') ELSE driver_name END,
    driver_phone = CASE WHEN p_patch ? 'driver_phone' THEN (p_patch->>'driver_phone') ELSE driver_phone END,
    card_note = CASE WHEN p_patch ? 'card_note' THEN (p_patch->>'card_note') ELSE card_note END,
    final_photo_requested = CASE WHEN p_patch ? 'final_photo_requested' THEN (p_patch->>'final_photo_requested')::boolean ELSE final_photo_requested END,
    confirmation_message = CASE WHEN p_patch ? 'confirmation_message' THEN (p_patch->>'confirmation_message') ELSE confirmation_message END,
    order_name = CASE WHEN p_patch ? 'order_name' THEN (p_patch->>'order_name') ELSE order_name END,
    recipient_name = CASE WHEN p_patch ? 'recipient_name' THEN (p_patch->>'recipient_name') ELSE recipient_name END,
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
    last_edited_by = v_caller_id
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_sales_order_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_sales_order_atomic TO authenticated;


-- D. Record Order Payment Atomic (Ledger Integrity + Refund Cap)
CREATE OR REPLACE FUNCTION public.record_order_payment_atomic(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_payment_type text DEFAULT 'deposit',
  p_status text DEFAULT 'confirmed',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_staff_user_id uuid DEFAULT NULL,
  p_staff_name text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_total numeric;
  v_current_deposit numeric;
  v_order_status text;
  v_order_number text;
  v_version integer;
  v_total_collected numeric;
  v_max_refundable numeric;
  v_existing_payment_id uuid;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية تسجيل الدفعات مقصورة على المبيعات والإدارة';
  END IF;

  -- Idempotency check on payment
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT id INTO v_existing_payment_id FROM public.order_payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      SELECT total, deposit_paid, COALESCE(version, 1)
      INTO v_current_total, v_total_collected, v_version
      FROM public.orders WHERE id = p_order_id;
      RETURN jsonb_build_object(
        'order_id', p_order_id,
        'total', v_current_total,
        'deposit_paid', v_total_collected,
        'remaining', GREATEST(v_current_total - v_total_collected, 0),
        'refund_due', GREATEST(v_total_collected - v_current_total, 0),
        'version', v_version,
        'is_duplicate', true
      );
    END IF;
  END IF;

  SELECT total, deposit_paid, status, order_number, COALESCE(version, 1)
  INTO v_current_total, v_current_deposit, v_order_status, v_order_number, v_version
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Calculate current net collected payments
  SELECT COALESCE(
    SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END),
    0
  )
  INTO v_total_collected
  FROM public.order_payments
  WHERE order_id = p_order_id AND status = 'confirmed';

  -- Refund validation: Refund cannot exceed allowable refund
  IF p_payment_type = 'refund' THEN
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'مبلغ الاسترجاع يجب أن يكون أكبر من صفر';
    END IF;

    IF v_order_status = 'cancelled' THEN
      v_max_refundable := v_total_collected;
    ELSE
      v_max_refundable := GREATEST(v_total_collected - v_current_total, 0);
    END IF;

    IF p_amount > v_max_refundable THEN
      RAISE EXCEPTION 'مبلغ الاسترجاع (% د.أ) يتجاوز المبلغ المسموح باسترجاعه (% د.أ) · Refund amount exceeds allowable refund', p_amount, v_max_refundable;
    END IF;
  END IF;

  -- Insert ledger entry
  INSERT INTO public.order_payments (
    order_id, amount, payment_method, payment_type, status,
    reference_number, notes, staff_user_id, staff_name, idempotency_key
  ) VALUES (
    p_order_id, p_amount, p_payment_method, p_payment_type, p_status,
    p_reference, p_notes, v_caller_id, COALESCE(p_staff_name, 'موظف مبيعات'), p_idempotency_key
  );

  -- Recalculate net collected
  v_total_collected := CASE
    WHEN p_payment_type = 'refund' THEN v_total_collected - p_amount
    ELSE v_total_collected + p_amount
  END;

  UPDATE public.orders
  SET
    deposit_paid = v_total_collected,
    version = COALESCE(version, 1) + 1,
    last_edited_at = now(),
    last_edited_by = v_caller_id
  WHERE id = p_order_id;

  IF p_payment_type = 'refund' THEN
    INSERT INTO public.audit_logs (
      order_id, order_number, staff_user_id, staff_name,
      action, original_amount, modified_amount, reason
    ) VALUES (
      p_order_id, v_order_number, v_caller_id, COALESCE(p_staff_name, 'موظف مبيعات'),
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
    'version', v_version + 1,
    'is_duplicate', false
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_payment_atomic TO authenticated;


-- E. Acknowledge KDS Modifications Atomic
CREATE OR REPLACE FUNCTION public.acknowledge_kds_modifications_atomic(
  p_order_id uuid,
  p_mod_ids text[],
  p_chef_user_id uuid,
  p_chef_name text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_mods jsonb;
  v_mod_elem jsonb;
  v_updated_mods jsonb := '[]'::jsonb;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_acknowledged_count integer := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'kitchen') OR private.has_role(v_caller_id, 'admin')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية اعتماد المطبخ مقصورة على الشيف والإدارة';
  END IF;

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
            'acknowledgedBy', v_caller_id,
            'acknowledgedByName', COALESCE(p_chef_name, 'شيف المطبخ')
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
        'acknowledgedBy', v_caller_id,
        'acknowledgedByName', COALESCE(p_chef_name, 'شيف المطبخ')
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

REVOKE ALL ON FUNCTION public.acknowledge_kds_modifications_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_kds_modifications_atomic TO authenticated;


-- F. Get Kitchen Order Items (Secure View)
CREATE OR REPLACE FUNCTION public.get_kitchen_order_items(_order_ids uuid[])
RETURNS TABLE (
  id uuid,
  order_id uuid,
  product_id uuid,
  name_ar text,
  name_en text,
  quantity integer,
  options_ar text[],
  options_en text[],
  notes text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.order_id, i.product_id, i.name_ar, i.name_en,
         i.quantity, i.options_ar, i.options_en, i.notes
  FROM public.order_items i
  WHERE i.order_id = ANY(_order_ids);
$$;

REVOKE ALL ON FUNCTION public.get_kitchen_order_items(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_order_items(uuid[]) TO authenticated;


-- G. Rebuild Sales Order Atomic
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
  v_caller_id uuid := auth.uid();
  v_current_mods jsonb;
  v_updated_mods jsonb;
  v_version integer;
  v_item jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية تعديل بنود الطلبات';
  END IF;

  SELECT modifications, COALESCE(version, 1) INTO v_current_mods, v_version
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  v_updated_mods := COALESCE(v_current_mods, '[]'::jsonb) || COALESCE(p_new_mods, '[]'::jsonb);

  -- Delete existing items and re-insert atomically
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, name_ar, name_en, unit_price, quantity, options_ar, options_en, notes
  )
  SELECT
    p_order_id,
    CASE WHEN (line->>'product_id') IS NOT NULL AND (line->>'product_id') != '' THEN (line->>'product_id')::uuid ELSE NULL END,
    line->>'name_ar',
    COALESCE(line->>'name_en', line->>'name_ar'),
    (line->>'unit_price')::numeric,
    COALESCE((line->>'quantity')::integer, 1),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(line->'options_ar', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(line->'options_en', '[]'::jsonb))),
    line->>'notes'
  FROM jsonb_array_elements(p_lines) AS line;

  UPDATE public.orders
  SET
    subtotal = p_subtotal,
    delivery_fee = p_delivery_fee,
    discount_amount = p_discount_amount,
    total = p_total,
    modifications = v_updated_mods,
    version = v_version + 1,
    last_edited_at = now(),
    last_edited_by = v_caller_id
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_sales_order_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_sales_order_atomic TO authenticated;


-- H. Record Staff Audit
CREATE OR REPLACE FUNCTION public.record_staff_audit(
  _order_id uuid,
  _order_number text,
  _staff_name text,
  _action text,
  _original_amount numeric DEFAULT NULL,
  _modified_amount numeric DEFAULT NULL,
  _discount_percent numeric DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (
    order_id, order_number, staff_user_id, staff_name,
    action, original_amount, modified_amount, discount_percent, reason
  ) VALUES (
    _order_id, _order_number, v_caller_id, _staff_name,
    _action, _original_amount, _modified_amount, _discount_percent, _reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_staff_audit FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_staff_audit TO authenticated;


-- I. Delete Sales Order Atomic (Admin Only)
CREATE OR REPLACE FUNCTION public.delete_sales_order_atomic(target_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF NOT (private.has_role(v_caller_id, 'admin')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية الحذف متاحة للمدير فقط · Unauthorized: Admin only';
  END IF;

  DELETE FROM public.order_edit_tokens WHERE order_id = target_order_id;
  DELETE FROM public.order_items WHERE order_id = target_order_id;
  DELETE FROM public.order_payments WHERE order_id = target_order_id;
  DELETE FROM public.orders WHERE id = target_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sales_order_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_sales_order_atomic TO authenticated;
