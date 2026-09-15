drop view if exists public.kitchen_orders;
drop view if exists public.kitchen_order_items;

create or replace function public.get_kitchen_orders()
returns table (
  id uuid, order_number text, customer_name text, method order_method,
  requested_date date, requested_time time, status order_status,
  inscription text, design_image_url text, notes text,
  schedule_updated_at timestamptz, created_at timestamptz, is_urgent boolean
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.order_number, o.customer_name, o.method, o.requested_date, o.requested_time,
         o.status, o.inscription, o.design_image_url, o.notes, o.schedule_updated_at, o.created_at, o.is_urgent
  from public.orders o
  where private.has_role(auth.uid(), 'kitchen'::app_role)
     or private.has_role(auth.uid(), 'admin'::app_role);
$$;

revoke all on function public.get_kitchen_orders() from public, anon;
grant execute on function public.get_kitchen_orders() to authenticated;

create or replace function public.get_kitchen_order_items(_order_ids uuid[])
returns table (
  id uuid, order_id uuid, product_id uuid, name_ar text, name_en text,
  quantity integer, options_ar text[], options_en text[], notes text
)
language sql stable security definer set search_path = public
as $$
  select i.id, i.order_id, i.product_id, i.name_ar, i.name_en,
         i.quantity, i.options_ar, i.options_en, i.notes
  from public.order_items i
  where i.order_id = any(_order_ids)
    and (private.has_role(auth.uid(), 'kitchen'::app_role)
      or private.has_role(auth.uid(), 'admin'::app_role));
$$;

revoke all on function public.get_kitchen_order_items(uuid[]) from public, anon;
grant execute on function public.get_kitchen_order_items(uuid[]) to authenticated;