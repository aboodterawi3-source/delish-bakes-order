-- ============ discounts on orders ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.orders_recalculate_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.method = 'pickup' THEN
    NEW.delivery_fee := 0;
  END IF;
  IF NEW.discount_amount IS NULL OR NEW.discount_amount < 0 THEN
    NEW.discount_amount := 0;
  END IF;
  IF NEW.discount_percent IS NULL OR NEW.discount_percent < 0 THEN
    NEW.discount_percent := 0;
  END IF;
  NEW.total := GREATEST(
    COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount_amount, 0),
    0
  );
  IF NEW.deposit_paid < 0 THEN
    NEW.deposit_paid := 0;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ staff permissions ============
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_price_override boolean NOT NULL DEFAULT false,
  allow_custom_discount boolean NOT NULL DEFAULT false,
  max_discount_percent numeric NOT NULL DEFAULT 0 CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions"
  ON public.staff_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_staff_permissions_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ immutable audit log ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  staff_user_id uuid NOT NULL,
  staff_name text NOT NULL,
  action text NOT NULL,
  original_amount numeric,
  modified_amount numeric,
  discount_percent numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_order_idx ON public.audit_logs (order_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read-only for staff; writes happen through the service role so entries can
-- never be forged, edited or removed by a signed-in account.
CREATE POLICY "Admins read every audit entry"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR staff_user_id = auth.uid());

-- ============ one-time customer edit links ============
CREATE TABLE IF NOT EXISTS public.order_edit_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_edit_tokens_order_idx ON public.order_edit_tokens (order_id);

GRANT SELECT ON public.order_edit_tokens TO authenticated;
GRANT ALL ON public.order_edit_tokens TO service_role;
ALTER TABLE public.order_edit_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can review edit links"
  ON public.order_edit_tokens FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));