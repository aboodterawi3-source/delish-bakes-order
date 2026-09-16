ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_name text,
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid;

-- Social media staff manage the orders they take, alongside sales and kitchen.
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
);

DROP POLICY IF EXISTS "Sales and admins can view orders" ON public.orders;
CREATE POLICY "Sales and admins can view orders"
ON public.orders FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
CREATE POLICY "Staff can update order items"
ON public.order_items FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
);

DROP POLICY IF EXISTS "Sales and admins can view order items" ON public.order_items;
CREATE POLICY "Sales and admins can view order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.created_by = auth.uid())
);

-- Order desk staff (sales, social, admin) may correct prices and quantities.
-- Every change is still recorded in public.audit_logs by the application.
CREATE OR REPLACE FUNCTION public.order_items_guard_price_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role)
     OR private.has_role(auth.uid(), 'sales'::app_role)
     OR private.has_role(auth.uid(), 'social'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'Price and quantity changes require sales authorization';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.orders_guard_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  perm record;
  is_admin boolean := private.has_role(auth.uid(), 'admin'::app_role);
  is_desk boolean := private.has_role(auth.uid(), 'sales'::app_role)
                     OR private.has_role(auth.uid(), 'social'::app_role);
  financial_changed boolean;
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  financial_changed := (NEW.subtotal IS DISTINCT FROM OLD.subtotal)
    OR (NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee)
    OR (NEW.deposit_paid IS DISTINCT FROM OLD.deposit_paid)
    OR (NEW.payment_method IS DISTINCT FROM OLD.payment_method)
    OR (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
    OR (NEW.discount_percent IS DISTINCT FROM OLD.discount_percent)
    OR (NEW.total IS DISTINCT FROM OLD.total);

  IF financial_changed AND NOT is_desk THEN
    RAISE EXCEPTION 'Financial changes require sales authorization';
  END IF;

  IF (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
     OR (NEW.discount_percent IS DISTINCT FROM OLD.discount_percent) THEN
    SELECT allow_custom_discount, max_discount_percent INTO perm
    FROM public.staff_permissions WHERE user_id = auth.uid();
    IF perm IS NULL OR NOT perm.allow_custom_discount THEN
      RAISE EXCEPTION 'Custom discounts require admin authorization';
    END IF;
    IF COALESCE(NEW.discount_percent, 0) > COALESCE(perm.max_discount_percent, 0) THEN
      RAISE EXCEPTION 'Discount exceeds the maximum allowed percentage';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;