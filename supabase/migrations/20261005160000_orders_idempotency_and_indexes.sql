-- Terminate the implicit transaction to allow CONCURRENTLY index creation
COMMIT;

-- Idempotency key sent by the storefront: a retried checkout returns the same order instead of creating a duplicate.
alter table public.orders add column if not exists client_request_id uuid;

create unique index concurrently if not exists orders_client_request_id_key
  on public.orders (client_request_id)
  where client_request_id is not null;

-- Query indexes for the sales/kitchen lists and the social "my orders" filters.
create index concurrently if not exists orders_requested_date_time_idx
  on public.orders (requested_date desc, requested_time desc);

create index concurrently if not exists orders_created_by_created_at_idx
  on public.orders (created_by, created_at desc);

create index concurrently if not exists orders_staff_code_created_at_idx
  on public.orders (staff_code, created_at desc);

-- Every order card loads its items by order_id.
create index concurrently if not exists order_items_order_id_idx
  on public.order_items (order_id);
