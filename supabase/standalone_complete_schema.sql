-- ==============================================================================
-- DELISH CAKE & BAKE — COMPLETE STANDALONE SUPABASE SCHEMA (V3 PRODUCTION READY)
-- Idempotent, self-contained schema with strict RPC access control,
-- Row Level Security (RLS), Optimistic Concurrency Control,
-- and financial ledger integrity.
-- ==============================================================================

-- 1. EXTENSIONS & SCHEMAS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

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
  priority_color text DEFAULT 'soft_green',
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
  price numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
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
  priority_color text NOT NULL DEFAULT 'soft_green',
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
  card_color_palette text NOT NULL DEFAULT 'soft_green',
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
  deposit_paid numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_paid >= 0),
  subtotal numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
  discount_amount numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  total numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
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
  unit_price numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  options_ar text[] DEFAULT '{}'::text[],
  options_en text[] DEFAULT '{}'::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. FINANCIAL PAYMENTS LEDGER
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  payment_type text NOT NULL DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'remainder', 'full', 'refund')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'voided')),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- 10. REALTIME PUBLICATION SETUP
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 11. INDEXES FOR HIGH PERFORMANCE
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
CREATE INDEX IF NOT EXISTS idx_order_edit_tokens_hash ON public.order_edit_tokens(token_hash);

-- 12. SECURITY: ROW LEVEL SECURITY (RLS) POLICIES
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

-- Catalog Policies
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

DROP POLICY IF EXISTS "Staff read staff codes" ON public.staff_codes;
CREATE POLICY "Staff read staff codes" ON public.staff_codes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage staff codes" ON public.staff_codes;
CREATE POLICY "Admins manage staff codes" ON public.staff_codes FOR ALL TO authenticated
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

-- Orders Policies:
-- Sales, Social, Admin view all orders. Kitchen is excluded from direct table reads containing PII/money
-- Kitchen views orders via secure RPC get_kitchen_orders()
DROP POLICY IF EXISTS "Staff view orders" ON public.orders;
CREATE POLICY "Staff view orders" ON public.orders FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
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

-- Order Items Policies: Direct SELECT restricted to Sales, Social, Admin.
-- Kitchen reads sanitized preparation items without unit_price via get_kitchen_order_items()
DROP POLICY IF EXISTS "Staff view order items" ON public.order_items;
CREATE POLICY "Staff view order items" ON public.order_items FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

DROP POLICY IF EXISTS "Sales and admin manage order items" ON public.order_items;
CREATE POLICY "Sales and admin manage order items" ON public.order_items FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

-- Order Payments Ledger Policies
-- Staff can view financial transactions. Direct INSERT/UPDATE/DELETE is strictly forbidden;
-- all financial entries must go through record_order_payment_atomic() to maintain ledger integrity.
DROP POLICY IF EXISTS "Staff view order payments" ON public.order_payments;
CREATE POLICY "Staff view order payments" ON public.order_payments FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin') OR
    private.has_role(auth.uid(), 'sales') OR
    private.has_role(auth.uid(), 'social')
  );

DROP POLICY IF EXISTS "Sales and admin create payments" ON public.order_payments;

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

-- Order Edit Tokens: Managed by backend server functions
DROP POLICY IF EXISTS "Service role manage tokens" ON public.order_edit_tokens;
CREATE POLICY "Service role manage tokens" ON public.order_edit_tokens FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales'));

-- Storage Policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Public read site media" ON storage.objects;
    CREATE POLICY "Public read site media" ON storage.objects FOR SELECT
      USING (bucket_id = 'site-media');

    DROP POLICY IF EXISTS "Staff manage site media" ON storage.objects;
    CREATE POLICY "Staff manage site media" ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'site-media' AND (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales')));

    DROP POLICY IF EXISTS "Staff view designs" ON storage.objects;
    CREATE POLICY "Staff view designs" ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'order-designs' AND (
          private.has_role(auth.uid(), 'admin') OR
          private.has_role(auth.uid(), 'sales') OR
          private.has_role(auth.uid(), 'kitchen') OR
          private.has_role(auth.uid(), 'social')
        )
      );

    DROP POLICY IF EXISTS "Staff upload designs" ON storage.objects;
    CREATE POLICY "Staff upload designs" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'order-designs' AND (
          private.has_role(auth.uid(), 'admin') OR
          private.has_role(auth.uid(), 'sales') OR
          private.has_role(auth.uid(), 'social')
        )
      );

    -- STRICT ISOLATION FOR PAYMENT RECEIPTS: Admin, Sales, and Social
    DROP POLICY IF EXISTS "Sales view payment receipts" ON storage.objects;
    CREATE POLICY "Sales view payment receipts" ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'payment-receipts' AND (
          private.has_role(auth.uid(), 'admin') OR
          private.has_role(auth.uid(), 'sales') OR
          private.has_role(auth.uid(), 'social')
        )
      );

    DROP POLICY IF EXISTS "Sales upload payment receipts" ON storage.objects;
    CREATE POLICY "Sales upload payment receipts" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'payment-receipts' AND (
          private.has_role(auth.uid(), 'admin') OR
          private.has_role(auth.uid(), 'sales') OR
          private.has_role(auth.uid(), 'social')
        )
      );
  END IF;
END $$;


-- 13. HARDENED ATOMIC RPC FUNCTIONS (SECURITY DEFINER + CALLER AUTH VERIFICATION)

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
  v_dup_id uuid;
  v_dup_order_number text;
  v_dup_total numeric;
  v_dup_subtotal numeric;
  v_dup_delivery_fee numeric;
  v_dup_deposit numeric;
  v_dup_version integer;
  v_item jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول للقيام بهذه العملية · Unauthorized: Sign in required';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales') OR private.has_role(v_caller_id, 'social')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية إنشاء طلبات مبيعات · Forbidden: Sales or Admin role required';
  END IF;

  v_client_request_id := NULLIF(TRIM(p_order->>'client_request_id'), '');

  -- Idempotency Check: return existing order if request ID already exists
  IF v_client_request_id IS NOT NULL THEN
    SELECT id, order_number, total, subtotal, delivery_fee, deposit_paid, COALESCE(version, 1)
    INTO v_dup_id, v_dup_order_number, v_dup_total, v_dup_subtotal, v_dup_delivery_fee, v_dup_deposit, v_dup_version
    FROM public.orders
    WHERE client_request_id = v_client_request_id;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_dup_id,
        'order_number', v_dup_order_number,
        'total', v_dup_total,
        'subtotal', v_dup_subtotal,
        'delivery_fee', v_dup_delivery_fee,
        'deposit_paid', v_dup_deposit,
        'is_duplicate', true,
        'version', v_dup_version
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
    IF COALESCE((v_item->>'quantity')::integer, 0) <= 0 THEN
      RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر · Quantity must be greater than zero';
    END IF;
    v_subtotal := v_subtotal + (((v_item->>'unit_price')::numeric) * COALESCE((v_item->>'quantity')::integer, 1));
  END LOOP;

  v_delivery_fee := COALESCE((p_order->>'delivery_fee')::numeric, 0);
  v_discount_amount := COALESCE((p_order->>'discount_amount')::numeric, 0);
  v_discount_percent := COALESCE((p_order->>'discount_percent')::numeric, 0);
  v_initial_deposit := GREATEST(COALESCE((p_order->>'deposit_paid')::numeric, 0), 0);

  v_total := GREATEST(v_subtotal + v_delivery_fee - v_discount_amount, 0);

  IF p_order ? 'modifications' AND p_order->'modifications' IS NOT NULL THEN
    v_initial_modifications := p_order->'modifications';
  END IF;

  SELECT email INTO v_staff_name FROM auth.users WHERE id = v_caller_id;
  v_staff_name := COALESCE(p_order->>'staff_name', v_staff_name, 'موظف مبيعات');

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


-- B. Create Storefront Order Atomic (Restricted to Trusted Server Function Only)
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
  v_dup_id uuid;
  v_dup_order_number text;
  v_dup_subtotal numeric;
  v_dup_delivery numeric;
  v_dup_total numeric;
  v_item_elem jsonb;
BEGIN
  req_client_id := NULLIF(TRIM(order_payload->>'client_request_id'), '');

  IF req_client_id IS NOT NULL THEN
    SELECT id, order_number, subtotal, delivery_fee, total
    INTO v_dup_id, v_dup_order_number, v_dup_subtotal, v_dup_delivery, v_dup_total
    FROM public.orders
    WHERE client_request_id = req_client_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_dup_id,
        'order_number', v_dup_order_number,
        'subtotal', v_dup_subtotal,
        'delivery_fee', v_dup_delivery,
        'total', v_dup_total,
        'is_duplicate', true
      );
    END IF;
  END IF;

  IF items_payload IS NULL OR jsonb_array_length(items_payload) = 0 THEN
    RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل';
  END IF;

  FOR v_item_elem IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    IF ((v_item_elem->>'unit_price')::numeric) < 0 OR COALESCE((v_item_elem->>'quantity')::integer, 0) <= 0 THEN
      RAISE EXCEPTION 'سعر الصنف أو الكمية غير صالحة';
    END IF;
    new_subtotal := new_subtotal + (((v_item_elem->>'unit_price')::numeric) * COALESCE((v_item_elem->>'quantity')::integer, 1));
  END LOOP;

  new_delivery := GREATEST(COALESCE((order_payload->>'delivery_fee')::numeric, 0), 0);
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
    it->>'name_ar',
    COALESCE(it->>'name_en', it->>'name_ar'),
    (it->>'unit_price')::numeric,
    COALESCE((it->>'quantity')::integer, 1),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(it->'options_ar', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(it->'options_en', '[]'::jsonb))),
    it->>'notes'
  FROM jsonb_array_elements(items_payload) AS it;

  RETURN jsonb_build_object(
    'id', new_order_id,
    'order_number', new_order_number,
    'subtotal', new_subtotal,
    'delivery_fee', new_delivery,
    'total', new_total,
    'is_duplicate', false
  );
END;
$$;

-- STRICT: Revoked from anon/public and authenticated! Can only be called via server functions using service_role!
REVOKE ALL ON FUNCTION public.create_storefront_order_atomic(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_atomic(jsonb, jsonb) TO service_role;


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

  -- Recalculate totals
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
  v_existing_rec record;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales') OR private.has_role(v_caller_id, 'social')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية تسجيل الدفعات مقصورة على المبيعات والإدارة';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ الحركة المالية يجب أن يكون أكبر من صفر';
  END IF;

  -- Lock order row first to serialize concurrent payment operations on this order
  SELECT total, deposit_paid, status, order_number, COALESCE(version, 1)
  INTO v_current_total, v_current_deposit, v_order_status, v_order_number, v_version
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Idempotency check with payload verification
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) != '' THEN
    SELECT id, order_id, amount, payment_type, status
    INTO v_existing_rec
    FROM public.order_payments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing_rec.order_id <> p_order_id OR v_existing_rec.amount <> p_amount OR v_existing_rec.payment_type <> p_payment_type THEN
        RAISE EXCEPTION 'مفتاح عدم التكرار مستخدم مسبقاً لحركة مختلفة · Idempotency key conflict';
      END IF;

      RETURN jsonb_build_object(
        'order_id', p_order_id,
        'total', v_current_total,
        'deposit_paid', v_current_deposit,
        'remaining', GREATEST(v_current_total - v_current_deposit, 0),
        'refund_due', GREATEST(v_current_deposit - v_current_total, 0),
        'version', v_version,
        'is_duplicate', true
      );
    END IF;
  END IF;

  -- Calculate current net confirmed payments from the ledger
  SELECT COALESCE(
    SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END),
    0
  )
  INTO v_total_collected
  FROM public.order_payments
  WHERE order_id = p_order_id AND status = 'confirmed';

  -- Refund validation: Refund cannot exceed allowable refund
  IF p_payment_type = 'refund' THEN
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
    p_reference, p_notes, v_caller_id, COALESCE(p_staff_name, 'موظف مبيعات'), NULLIF(TRIM(p_idempotency_key), '')
  );

  -- Financial ledger integrity: ONLY confirmed payments mutate orders.deposit_paid and bump version
  IF p_status = 'confirmed' THEN
    v_total_collected := CASE
      WHEN p_payment_type = 'refund' THEN v_total_collected - p_amount
      ELSE v_total_collected + p_amount
    END;

    UPDATE public.orders
    SET
      deposit_paid = v_total_collected,
      version = v_version + 1,
      last_edited_at = now(),
      last_edited_by = v_caller_id
    WHERE id = p_order_id;

    v_version := v_version + 1;
  ELSE
    -- If status is not confirmed (e.g. pending/failed), deposit_paid remains unchanged
    v_total_collected := v_current_deposit;
  END IF;

  IF p_payment_type = 'refund' AND p_status = 'confirmed' THEN
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
    'version', v_version,
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


-- F. Get Kitchen Orders Feed (Secure View)
CREATE OR REPLACE FUNCTION public.get_kitchen_orders()
RETURNS TABLE(
  id uuid,
  order_number text,
  staff_code integer,
  customer_name text,
  method public.order_method,
  requested_date date,
  requested_time time without time zone,
  status public.order_status,
  inscription text,
  design_image_url text,
  notes text,
  schedule_updated_at timestamptz,
  last_edited_at timestamptz,
  created_at timestamptz,
  modifications jsonb,
  queue_rank integer,
  card_note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.staff_code, o.customer_name, o.method,
         o.requested_date, o.requested_time, o.status, o.inscription,
         o.design_image_url, o.notes, o.schedule_updated_at, o.last_edited_at,
         o.created_at,
         COALESCE(
           (
             SELECT jsonb_agg(
               jsonb_build_object(
                 'id', m->>'id',
                 'field', m->>'field',
                 'timestamp', COALESCE(m->>'timestamp', m->>'updatedAt'),
                 'updatedAt', COALESCE(m->>'updatedAt', m->>'timestamp'),
                 'staff_name', m->>'staff_name',
                 'acknowledged', COALESCE((m->>'acknowledged')::boolean, (m->>'acknowledgedAt') IS NOT NULL, false),
                 'acknowledgedAt', m->>'acknowledgedAt',
                 'acknowledgedBy', m->>'acknowledgedBy',
                 'acknowledgedByName', m->>'acknowledgedByName',
                 'oldValue', CASE 
                   WHEN m->>'field' ~* '(phone|هاتف|جوال|total|إجمالي|subtotal|مجموع|deposit|عربون|مدفوع|discount|خصم)' THEN '***'
                   ELSE COALESCE(m->>'oldValue', m->>'old_value')
                 END,
                 'newValue', CASE 
                   WHEN m->>'field' ~* '(phone|هاتف|جوال|total|إجمالي|subtotal|مجموع|deposit|عربون|مدفوع|discount|خصم)' THEN '***'
                   ELSE COALESCE(m->>'newValue', m->>'new_value')
                 END
               )
             )
             FROM jsonb_array_elements(COALESCE(o.modifications, '[]'::jsonb)) AS m
           ),
           '[]'::jsonb
         ) AS modifications,
         o.queue_rank, o.card_note
  FROM public.orders o
  WHERE (private.has_role(auth.uid(), 'kitchen') OR private.has_role(auth.uid(), 'admin'))
    AND o.status IN ('new', 'confirmed', 'baking', 'ready')
  ORDER BY o.requested_date ASC, o.requested_time ASC;
$$;

REVOKE ALL ON FUNCTION public.get_kitchen_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_orders() TO authenticated;


-- G. Get Kitchen Order Items (Secure View)
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
  WHERE i.order_id = ANY(_order_ids)
    AND (private.has_role(auth.uid(), 'kitchen') OR private.has_role(auth.uid(), 'admin'));
$$;

REVOKE ALL ON FUNCTION public.get_kitchen_order_items(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_order_items(uuid[]) TO authenticated;


-- H. Update Kitchen Order Preparation Status Atomic
CREATE OR REPLACE FUNCTION public.update_kitchen_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_status text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'kitchen') OR private.has_role(v_caller_id, 'admin')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية تحديث المطبخ مقصورة على الشيف والإدارة';
  END IF;

  IF p_status NOT IN ('new', 'confirmed', 'baking', 'ready') THEN
    RAISE EXCEPTION 'مرحلة غير صالحة للمطبخ · Invalid kitchen status transition';
  END IF;

  SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود · Order not found';
  END IF;

  -- Kitchen cannot reactivate terminal/finalized orders
  IF v_current_status IN ('cancelled', 'completed', 'delivered', 'out_for_delivery') THEN
    RAISE EXCEPTION 'لا يمكن تعديل حالة طلب مكتمل أو ملغى أو مسلم من قبل المطبخ (%s) · Kitchen cannot modify finalized order', v_current_status;
  END IF;

  UPDATE public.orders
  SET
    status = p_status::public.order_status,
    last_edited_at = now(),
    last_edited_by = v_caller_id
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_kitchen_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_kitchen_order_status(uuid, text) TO authenticated;


-- I. Rebuild Sales Order Atomic
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


-- J. Record Staff Audit
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


-- K. Clear All Sales Orders Atomic (Admin Only)
CREATE OR REPLACE FUNCTION public.clear_all_sales_orders_atomic()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF NOT (private.has_role(v_caller_id, 'admin')) THEN
    RAISE EXCEPTION 'غير مصرّح: صلاحية مسح الطلبات متاحة للمدير فقط';
  END IF;

  DELETE FROM public.order_edit_tokens;
  DELETE FROM public.order_items;
  DELETE FROM public.order_payments;
  DELETE FROM public.orders;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_all_sales_orders_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_all_sales_orders_atomic TO authenticated;


-- L. Delete Sales Order Atomic (Admin Only)
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


-- M. Update Order Item Atomic with Concurrency Control & Audit
CREATE OR REPLACE FUNCTION public.update_order_item_atomic(
  p_order_id uuid,
  p_item_id uuid,
  p_unit_price numeric,
  p_quantity integer DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_staff_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_version integer;
  v_old_unit_price numeric;
  v_old_quantity integer;
  v_item_name text;
  v_new_subtotal numeric;
  v_delivery_fee numeric;
  v_discount_amount numeric;
  v_discount_percent numeric;
  v_new_total numeric;
  v_new_quantity integer;
  v_mod_entry jsonb;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_order_num text;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية تعديل بنود الطلبات';
  END IF;

  IF p_unit_price < 0 THEN
    RAISE EXCEPTION 'سعر الصنف لا يمكن أن يكون سالباً';
  END IF;

  -- Lock order row
  SELECT order_number, COALESCE(version, 1), delivery_fee, discount_amount, discount_percent
  INTO v_order_num, v_current_version, v_delivery_fee, v_discount_amount, v_discount_percent
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  -- Concurrency check
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'OCC_VERSION_MISMATCH: Order version changed (expected %, current %)', p_expected_version, v_current_version;
  END IF;

  -- Fetch & lock item
  SELECT unit_price, quantity, name_ar
  INTO v_old_unit_price, v_old_quantity, v_item_name
  FROM public.order_items
  WHERE id = p_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'البند غير موجود في الطلب';
  END IF;

  v_new_quantity := COALESCE(p_quantity, v_old_quantity);
  IF v_new_quantity <= 0 THEN
    RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر';
  END IF;

  -- Update item
  UPDATE public.order_items
  SET unit_price = p_unit_price,
      quantity = v_new_quantity
  WHERE id = p_item_id;

  -- Recalculate subtotal
  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_new_subtotal
  FROM public.order_items
  WHERE order_id = p_order_id;

  -- Recalculate total with discount and delivery
  IF v_discount_percent > 0 THEN
    v_discount_amount := ROUND((v_new_subtotal * v_discount_percent / 100), 2);
  END IF;
  v_new_total := GREATEST(v_new_subtotal + COALESCE(v_delivery_fee, 0) - COALESCE(v_discount_amount, 0), 0);

  -- Build modification entry
  v_mod_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'field', 'تعديل صنف: ' || v_item_name,
    'oldValue', v_old_unit_price::text || ' د.أ (كمية: ' || v_old_quantity::text || ')',
    'newValue', p_unit_price::text || ' د.أ (كمية: ' || v_new_quantity::text || ')',
    'staff_name', COALESCE(p_staff_name, 'موظف مبيعات'),
    'timestamp', v_now_iso,
    'updatedAt', v_now_iso,
    'acknowledged', false,
    'acknowledgedAt', null
  );

  -- Update order
  UPDATE public.orders
  SET
    subtotal = v_new_subtotal,
    discount_amount = v_discount_amount,
    total = v_new_total,
    modifications = COALESCE(modifications, '[]'::jsonb) || jsonb_build_array(v_mod_entry),
    version = v_current_version + 1,
    last_edited_at = now(),
    last_edited_by = v_caller_id
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  -- Audit log
  INSERT INTO public.audit_logs (
    order_id, order_number, staff_user_id, staff_name,
    action, original_amount, modified_amount, reason
  ) VALUES (
    p_order_id, v_order_num, v_caller_id, COALESCE(p_staff_name, 'موظف مبيعات'),
    'item_price_update', v_old_unit_price, p_unit_price,
    COALESCE(p_reason, 'تعديل سعر/كمية الصنف: ' || v_item_name)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_item_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_item_atomic TO authenticated;


-- N. Apply Order Discount Atomic
CREATE OR REPLACE FUNCTION public.apply_order_discount_atomic(
  p_order_id uuid,
  p_discount_amount numeric,
  p_discount_percent numeric,
  p_expected_version integer DEFAULT NULL,
  p_staff_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_version integer;
  v_subtotal numeric;
  v_delivery_fee numeric;
  v_old_total numeric;
  v_new_total numeric;
  v_order_num text;
  v_mod_entry jsonb;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح: يجب تسجيل الدخول';
  END IF;

  IF NOT (private.has_role(v_caller_id, 'admin') OR private.has_role(v_caller_id, 'sales')) THEN
    RAISE EXCEPTION 'غير مصرّح: لا تملك صلاحية منح الخصومات';
  END IF;

  IF p_discount_amount < 0 OR p_discount_percent < 0 THEN
    RAISE EXCEPTION 'قيمة الخصم لا يمكن أن تكون سالبة';
  END IF;

  SELECT order_number, COALESCE(version, 1), subtotal, delivery_fee, total
  INTO v_order_num, v_current_version, v_subtotal, v_delivery_fee, v_old_total
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'OCC_VERSION_MISMATCH: Order version changed (expected %, current %)', p_expected_version, v_current_version;
  END IF;

  v_new_total := GREATEST(v_subtotal + COALESCE(v_delivery_fee, 0) - p_discount_amount, 0);

  v_mod_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'field', 'الخصم المالي',
    'oldValue', (v_old_total)::text || ' د.أ',
    'newValue', (v_new_total)::text || ' د.أ (خصم ' || p_discount_percent::text || '%)',
    'staff_name', COALESCE(p_staff_name, 'موظف مبيعات'),
    'timestamp', v_now_iso,
    'updatedAt', v_now_iso,
    'acknowledged', false,
    'acknowledgedAt', null
  );

  UPDATE public.orders
  SET
    discount_amount = p_discount_amount,
    discount_percent = p_discount_percent,
    total = v_new_total,
    modifications = COALESCE(modifications, '[]'::jsonb) || jsonb_build_array(v_mod_entry),
    version = v_current_version + 1,
    last_edited_at = now(),
    last_edited_by = v_caller_id
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  INSERT INTO public.audit_logs (
    order_id, order_number, staff_user_id, staff_name,
    action, original_amount, modified_amount, discount_percent, reason
  ) VALUES (
    p_order_id, v_order_num, v_caller_id, COALESCE(p_staff_name, 'موظف مبيعات'),
    'discount_applied', v_old_total, v_new_total, p_discount_percent,
    COALESCE(p_reason, 'تطبيق خصم على الطلب')
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_order_discount_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_discount_atomic TO authenticated;


-- ==============================================================================
-- 14. INITIAL BOOTSTRAP SEEDS (STORE SETTINGS & BANNER)
-- ==============================================================================

-- Seed default store settings (singleton)
INSERT INTO public.store_settings (singleton, store_name, cliq_alias, contact_phone, card_color_palette)
VALUES (true, 'Delish Cake & Bake', 'DELISHBAKES', '+962790000000', 'soft_green')
ON CONFLICT (singleton) DO NOTHING;

-- Seed default storefront banner
INSERT INTO public.storefront_banner (
  id, title_ar, title_en, subtitle_ar, subtitle_en, subtitle, discount_text, button_text, badge_ar, badge_en, is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'كيك ومخبوزات طازجة يومياً',
  'Fresh Daily Cakes & Bakes',
  'أشهى الحلويات والكيك المخصص لجميع مناسباتكم في عمّان',
  'Delicious custom cakes & desserts for all occasions in Amman',
  'أشهى الحلويات والكيك المخصص لجميع مناسباتكم في عمّان',
  'خصم 10% على طلبات التوصيل المسبقة',
  'اطلب الآن',
  'عرض خاص',
  'Special Offer',
  true
) ON CONFLICT (id) DO NOTHING;
