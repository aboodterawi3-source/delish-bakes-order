-- Restrict full order reads to sales/admin (and the row creator for insert-returning)
drop policy if exists "Staff can view orders" on public.orders;
create policy "Sales and admins can view orders"
  on public.orders for select to authenticated
  using (
    private.has_role(auth.uid(), 'admin'::app_role)
    or private.has_role(auth.uid(), 'sales'::app_role)
    or created_by = auth.uid()
  );

drop policy if exists "Staff can view order items" on public.order_items;
create policy "Sales and admins can view order items"
  on public.order_items for select to authenticated
  using (
    private.has_role(auth.uid(), 'admin'::app_role)
    or private.has_role(auth.uid(), 'sales'::app_role)
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.created_by = auth.uid()
    )
  );

-- Kitchen-safe views: prep fields only, no phones/payments/discounts.
-- Views run as owner (bypass base RLS) but filter to kitchen/admin only.
create or replace view public.kitchen_orders
with (security_barrier = true) as
select id, order_number, customer_name, method, requested_date, requested_time,
       status, inscription, design_image_url, notes, schedule_updated_at, created_at, is_urgent
from public.orders
where private.has_role(auth.uid(), 'kitchen'::app_role)
   or private.has_role(auth.uid(), 'admin'::app_role);

grant select on public.kitchen_orders to authenticated;

create or replace view public.kitchen_order_items
with (security_barrier = true) as
select id, order_id, product_id, name_ar, name_en, quantity, options_ar, options_en, notes, created_at
from public.order_items
where private.has_role(auth.uid(), 'kitchen'::app_role)
   or private.has_role(auth.uid(), 'admin'::app_role);

grant select on public.kitchen_order_items to authenticated;