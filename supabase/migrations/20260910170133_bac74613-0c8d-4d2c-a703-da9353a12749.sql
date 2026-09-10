-- 1. Private schema for role helpers so they are no longer callable through the API
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Only explicit staff roles count as staff (social agents included, unknown future roles are not)
CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'sales'::public.app_role, 'kitchen'::public.app_role, 'social'::public.app_role)
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

-- 2. Recreate every policy against the private helpers
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Signed-in users can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Signed-in users can view products" ON public.products FOR SELECT TO authenticated USING (is_available OR private.is_staff(auth.uid()));
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- 3. Orders: no anonymous writes any more (public checkout goes through a trusted server function)
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Staff can view orders" ON public.orders FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Staff can create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales') OR private.has_role(auth.uid(), 'kitchen'));
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Staff can view order items" ON public.order_items FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.created_by = auth.uid()));
CREATE POLICY "Staff can add order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (private.is_staff(auth.uid()) OR o.created_by = auth.uid())));
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales') OR private.has_role(auth.uid(), 'kitchen'));
CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;

-- 4. Drop the API-exposed helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);

-- 5. Size caps as defence in depth against oversized submissions
ALTER TABLE public.orders
  ADD CONSTRAINT orders_text_length_check CHECK (
    length(customer_name) <= 120 AND length(customer_phone) <= 25
    AND (area IS NULL OR length(area) <= 120)
    AND (address IS NULL OR length(address) <= 400)
    AND (notes IS NULL OR length(notes) <= 2000)
    AND (staff_notes IS NULL OR length(staff_notes) <= 2000)
    AND (inscription IS NULL OR length(inscription) <= 500)
    AND (design_image_url IS NULL OR length(design_image_url) <= 1600000)
  );

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_text_length_check CHECK (
    length(name_ar) <= 200 AND length(name_en) <= 200
    AND (notes IS NULL OR length(notes) <= 1000)
    AND quantity > 0 AND quantity <= 200
    AND array_length(options_ar, 1) IS NULL OR array_length(options_ar, 1) <= 20
  );