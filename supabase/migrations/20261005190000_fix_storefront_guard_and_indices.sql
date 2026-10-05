-- Migration: Fix orders_guard_discount for storefront checkout & correct token_hash index

-- 1. Allow service_role, postgres, and backend server functions to insert/update orders
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
  is_system boolean := current_user IN ('postgres', 'service_role')
                     OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'
                     OR auth.uid() IS NULL;
  financial_changed boolean;
BEGIN
  -- System/service_role and admins are completely unrestricted
  IF is_system OR is_admin THEN
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

-- 2. Fix the index on order_edit_tokens to reference token_hash instead of the non-existent token column
DROP INDEX IF EXISTS public.idx_order_edit_tokens_token;
CREATE INDEX IF NOT EXISTS idx_order_edit_tokens_token_hash
  ON public.order_edit_tokens (token_hash);
