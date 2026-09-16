CREATE TABLE public.staff_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_code integer NOT NULL UNIQUE CHECK (staff_code > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.staff_codes TO authenticated;
GRANT ALL ON public.staff_codes TO service_role;

ALTER TABLE public.staff_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read staff codes" ON public.staff_codes
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE TRIGGER update_staff_codes_updated_at
  BEFORE UPDATE ON public.staff_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ADD COLUMN staff_code integer;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq AS bigint START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.order_number_seq TO authenticated, service_role, anon;
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT ('DL-' || nextval('public.order_number_seq')::text);

CREATE OR REPLACE FUNCTION public.orders_stamp_staff_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.staff_code IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT sc.staff_code INTO NEW.staff_code
    FROM public.staff_codes sc
    WHERE sc.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_stamp_staff_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_stamp_staff_code() TO postgres, service_role;

CREATE TRIGGER orders_stamp_staff_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stamp_staff_code();