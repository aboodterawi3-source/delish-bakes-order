DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Kitchen and admins can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role));

CREATE POLICY "Kitchen and admins can update products"
ON public.products FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role));

CREATE POLICY "Kitchen and admins can delete products"
ON public.products FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role));