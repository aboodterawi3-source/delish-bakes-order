-- 1) Order items: price changes require per-product authorisation; kitchen cannot touch money/qty
CREATE OR REPLACE FUNCTION public.order_items_guard_price_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := private.has_role(auth.uid(), 'admin'::app_role);
  is_sales boolean := private.has_role(auth.uid(), 'sales'::app_role);
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF (NEW.unit_price IS DISTINCT FROM OLD.unit_price
      OR NEW.quantity IS DISTINCT FROM OLD.quantity
      OR NEW.product_id IS DISTINCT FROM OLD.product_id)
     AND NOT is_sales THEN
    RAISE EXCEPTION 'Price and quantity changes require sales authorization';
  END IF;

  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.allow_price_override
    ) THEN
      RAISE EXCEPTION 'Price override requires admin authorization';
    END IF;

    IF NEW.product_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.sales_product_permissions spp
      WHERE spp.user_id = auth.uid()
        AND spp.product_id = NEW.product_id
        AND spp.can_edit_price
    ) THEN
      RAISE EXCEPTION 'Not authorised to reprice this product';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Orders: financial columns restricted to admin/sales; discount caps enforced
CREATE OR REPLACE FUNCTION public.orders_guard_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  perm record;
  is_admin boolean := private.has_role(auth.uid(), 'admin'::app_role);
  is_sales boolean := private.has_role(auth.uid(), 'sales'::app_role);
  financial_changed boolean;
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    financial_changed := true;
  ELSE
    financial_changed := (NEW.subtotal IS DISTINCT FROM OLD.subtotal)
      OR (NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee)
      OR (NEW.deposit_paid IS DISTINCT FROM OLD.deposit_paid)
      OR (NEW.payment_method IS DISTINCT FROM OLD.payment_method)
      OR (NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
      OR (NEW.discount_percent IS DISTINCT FROM OLD.discount_percent)
      OR (NEW.total IS DISTINCT FROM OLD.total);
  END IF;

  IF financial_changed AND NOT is_sales THEN
    RAISE EXCEPTION 'Financial changes require sales authorization';
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.subtotal IS DISTINCT FROM OLD.subtotal) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.allow_price_override
    ) THEN
      RAISE EXCEPTION 'Price override requires admin authorization';
    END IF;
  END IF;

  IF (TG_OP = 'UPDATE' AND ((NEW.discount_amount IS DISTINCT FROM OLD.discount_amount) OR (NEW.discount_percent IS DISTINCT FROM OLD.discount_percent)))
     OR (TG_OP = 'INSERT' AND (COALESCE(NEW.discount_amount, 0) > 0 OR COALESCE(NEW.discount_percent, 0) > 0)) THEN
    SELECT allow_custom_discount, max_discount_percent INTO perm
    FROM public.staff_permissions WHERE user_id = auth.uid();
    IF perm IS NULL OR NOT perm.allow_custom_discount THEN
      RAISE EXCEPTION 'Custom discounts require admin authorization';
    END IF;
    IF COALESCE(NEW.discount_percent, 0) > COALESCE(perm.max_discount_percent, 0) THEN
      RAISE EXCEPTION 'Discount exceeds the maximum allowed percentage';
    END IF;
    IF COALESCE(NEW.subtotal, 0) > 0
       AND (COALESCE(NEW.discount_amount, 0) / NEW.subtotal) * 100
           > COALESCE(perm.max_discount_percent, 0) + 0.01 THEN
      RAISE EXCEPTION 'Discount exceeds the maximum allowed percentage';
    END IF;
  END IF;

  IF NEW.total <> GREATEST(COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount_amount, 0), 0) THEN
    RAISE EXCEPTION 'Total mathematically diverges from subtotal and discounts';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Add WITH CHECK to the staff update policies so new rows are validated too
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
);

DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
CREATE POLICY "Staff can update order items"
ON public.order_items FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'kitchen'::app_role)
);