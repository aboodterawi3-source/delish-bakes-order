REVOKE EXECUTE ON FUNCTION public.order_items_guard_price_override() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_guard_discount() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.sales_product_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  can_edit_price BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT ON public.sales_product_permissions TO authenticated;
GRANT ALL ON public.sales_product_permissions TO service_role;

ALTER TABLE public.sales_product_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.sales_product_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.sales_product_permissions;

CREATE POLICY "Staff read their own product permissions"
  ON public.sales_product_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sales_product_permissions_updated_at
  BEFORE UPDATE ON public.sales_product_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();