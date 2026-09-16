ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS queue_rank integer;

DROP FUNCTION IF EXISTS public.get_kitchen_orders();

CREATE FUNCTION public.get_kitchen_orders()
RETURNS TABLE(
  id uuid,
  order_number text,
  staff_code integer,
  customer_name text,
  method order_method,
  requested_date date,
  requested_time time without time zone,
  status order_status,
  inscription text,
  design_image_url text,
  notes text,
  schedule_updated_at timestamp with time zone,
  last_edited_at timestamp with time zone,
  created_at timestamp with time zone,
  is_urgent boolean,
  queue_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.order_number, o.staff_code, o.customer_name, o.method,
         o.requested_date, o.requested_time, o.status, o.inscription,
         o.design_image_url, o.notes, o.schedule_updated_at, o.last_edited_at,
         o.created_at, o.is_urgent, o.queue_rank
  FROM public.orders o
  WHERE private.has_role(auth.uid(), 'kitchen'::app_role)
     OR private.has_role(auth.uid(), 'admin'::app_role)
$$;

REVOKE EXECUTE ON FUNCTION public.get_kitchen_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_kitchen_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_orders() TO authenticated, service_role;