-- Migration: Add sales_product_permissions table for employee price editing control
CREATE TABLE IF NOT EXISTS public.sales_product_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  can_edit_price BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_product_permissions TO authenticated;
GRANT ALL ON public.sales_product_permissions TO service_role;

ALTER TABLE public.sales_product_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions" ON public.sales_product_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions" ON public.sales_product_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
