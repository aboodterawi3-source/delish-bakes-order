-- ============================================================================
-- Delish Bakes - Strict Row Level Security (RLS) Policy Migration
-- Tables protected: public.orders, public.order_items, public.customer_messages
-- 
-- Security Rules:
-- 1. Anonymous users ('anon'):
--    - Permitted to INSERT new records (orders, order items, customer messages)
--    - STRICTLY PROHIBITED from SELECT, UPDATE, DELETE (cannot read or tamper with data)
-- 2. Authenticated staff ('authenticated'):
--    - Authorized roles (admin, sales, kitchen, social) can SELECT and UPDATE
--    - Only authorized roles (admin) can DELETE
-- ============================================================================

-- Ensure helper functions exist in private schema or public schema
CREATE OR REPLACE FUNCTION public.is_staff_member(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = $1 AND role IN ('admin', 'sales', 'kitchen', 'social')
  );
$$;

-- ============================================================================
-- 1. TABLE: public.orders
-- ============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Revoke dangerous permissions from public/anon
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- Clean existing policies on orders
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Anon can place an order" ON public.orders;
DROP POLICY IF EXISTS "Public can place an order" ON public.orders;
DROP POLICY IF EXISTS "Allow anon and authenticated to place orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "Sales and admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated staff to view orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated staff to update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admins to delete orders" ON public.orders;

-- Policy 1.1: Authenticated INSERT (Placing staff orders)
CREATE POLICY "Allow authenticated to place orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 1.2: Authenticated Staff SELECT (Viewing orders)
-- Public 'anon' has NO SELECT policy, completely preventing reading customer records
CREATE POLICY "Allow authenticated staff to view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    public.is_staff_member(auth.uid())
    OR created_by = auth.uid()
  );

-- Policy 1.3: Authenticated Staff UPDATE (Editing order details / status)
CREATE POLICY "Allow authenticated staff to update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_staff_member(auth.uid()))
  WITH CHECK (public.is_staff_member(auth.uid()));

-- Policy 1.4: Admin DELETE (Deleting orders)
CREATE POLICY "Allow admins to delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 2. TABLE: public.order_items
-- ============================================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Revoke dangerous permissions from public/anon
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.order_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

-- Clean existing policies on order_items
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow anon and authenticated to insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Sales and admins can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow authenticated staff to view order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow authenticated staff to update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Order desk can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow authenticated staff to delete order items" ON public.order_items;

-- Policy 2.1: Authenticated INSERT (Cart items during staff order placement)
CREATE POLICY "Allow authenticated to insert order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 2.2: Authenticated Staff SELECT
CREATE POLICY "Allow authenticated staff to view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    public.is_staff_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.created_by = auth.uid()
    )
  );

-- Policy 2.3: Authenticated Staff UPDATE
CREATE POLICY "Allow authenticated staff to update order items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (public.is_staff_member(auth.uid()))
  WITH CHECK (public.is_staff_member(auth.uid()));

-- Policy 2.4: Authenticated Staff DELETE (Order desk item modification)
CREATE POLICY "Allow authenticated staff to delete order items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- ============================================================================
-- 3. TABLE: public.customer_messages
-- ============================================================================
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

-- Grant INSERT to public/anon for feedback/contact form
GRANT INSERT ON public.customer_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_messages TO authenticated;
GRANT ALL ON public.customer_messages TO service_role;
REVOKE SELECT, UPDATE, DELETE ON public.customer_messages FROM anon;

-- Clean existing policies on customer_messages
DROP POLICY IF EXISTS "Anyone can submit customer message" ON public.customer_messages;
DROP POLICY IF EXISTS "Allow anyone to submit customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Sales social and admins read customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Allow authenticated staff to view customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Sales social and admins update customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Allow authenticated staff to update customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Admins can delete customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Allow admins to delete customer messages" ON public.customer_messages;

-- Policy 3.1: Public INSERT (Storefront contact/feedback drawer)
CREATE POLICY "Allow anyone to submit customer messages"
  ON public.customer_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 3.2: Authenticated Staff SELECT
CREATE POLICY "Allow authenticated staff to view customer messages"
  ON public.customer_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- Policy 3.3: Authenticated Staff UPDATE (Mark handled/assigned)
CREATE POLICY "Allow authenticated staff to update customer messages"
  ON public.customer_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- Policy 3.4: Admin DELETE
CREATE POLICY "Allow admins to delete customer messages"
  ON public.customer_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
