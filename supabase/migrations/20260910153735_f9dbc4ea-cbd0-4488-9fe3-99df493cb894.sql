ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'cliq', 'visa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method,
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS driver_phone text,
  ADD COLUMN IF NOT EXISTS staff_notes text,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE OR REPLACE FUNCTION public.orders_recalculate_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.method = 'pickup' THEN
    NEW.delivery_fee := 0;
  END IF;
  NEW.total := COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0);
  IF NEW.deposit_paid < 0 THEN
    NEW.deposit_paid := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_recalculate_totals ON public.orders;
CREATE TRIGGER orders_recalculate_totals
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_recalculate_totals();
