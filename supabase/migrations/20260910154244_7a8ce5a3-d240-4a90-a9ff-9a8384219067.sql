ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS orders_is_urgent_idx ON public.orders (is_urgent) WHERE is_urgent;

DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
CREATE POLICY "Staff can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
