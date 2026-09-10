CREATE INDEX IF NOT EXISTS orders_active_schedule_idx
  ON public.orders (requested_date, requested_time)
  WHERE status IN ('new', 'confirmed', 'baking', 'ready');

CREATE INDEX IF NOT EXISTS orders_schedule_idx
  ON public.orders (requested_date DESC, requested_time DESC);