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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'sales'::public.app_role)
    OR private.has_role(auth.uid(), 'social'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to record audit entries';
  END IF;

  INSERT INTO public.audit_logs (
    order_id,
    order_number,
    staff_user_id,
    staff_name,
    action,
    original_amount,
    modified_amount,
    discount_percent,
    reason
  ) VALUES (
    _order_id,
    _order_number,
    auth.uid(),
    left(coalesce(nullif(trim(_staff_name), ''), auth.uid()::text), 200),
    left(coalesce(_action, ''), 100),
    _original_amount,
    _modified_amount,
    _discount_percent,
    left(_reason, 1000)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_staff_audit(uuid, text, text, text, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_staff_audit(uuid, text, text, text, numeric, numeric, numeric, text) TO authenticated, service_role;