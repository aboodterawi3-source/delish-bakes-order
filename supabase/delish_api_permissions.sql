-- DELISH: explicit Data API privileges for Supabase.
-- Run in SQL Editor after the standalone schema and seed files.
-- Existing RLS policies, financial guards and RPC permissions remain in force.
BEGIN;

DO $delish_check$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'products', 'storefront_categories', 'storefront_banner', 'store_settings',
    'user_roles', 'staff_codes', 'staff_permissions', 'sales_product_permissions',
    'orders', 'order_items', 'order_payments', 'audit_logs',
    'customer_messages', 'order_edit_tokens', 'app_setup_state', 'categories'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table
        AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Delish table public.% is missing or RLS is disabled. Apply the standalone schema first.', v_table;
    END IF;
  END LOOP;
END;
$delish_check$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Reset only the named Delish tables to an explicit least-privilege baseline.
REVOKE ALL PRIVILEGES ON TABLE
  public.products, public.storefront_categories, public.storefront_banner,
  public.store_settings, public.user_roles, public.staff_codes,
  public.staff_permissions, public.sales_product_permissions,
  public.orders, public.order_items, public.order_payments, public.audit_logs,
  public.customer_messages, public.order_edit_tokens,
  public.app_setup_state, public.categories
FROM anon, authenticated;

-- Public visitors see only catalog rows allowed by existing RLS policies.
GRANT SELECT ON TABLE
  public.products, public.storefront_categories,
  public.storefront_banner, public.store_settings
TO anon, authenticated;

-- Signed-in users still need the appropriate staff role under RLS.
GRANT SELECT ON TABLE
  public.user_roles, public.staff_codes,
  public.staff_permissions, public.sales_product_permissions,
  public.orders, public.order_items, public.order_payments,
  public.audit_logs, public.customer_messages
TO authenticated;

-- CMS and appearance: existing RLS limits these operations to authorized staff.
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.products, public.storefront_categories, public.storefront_banner
TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.store_settings TO authenticated;

-- Existing direct app operations: queue order and social confirmation text.
-- Sensitive financial/history fields remain protected by the installed triggers.
GRANT UPDATE ON TABLE public.orders TO authenticated;
GRANT UPDATE (status, handled_by, handled_at) ON TABLE public.customer_messages TO authenticated;
GRANT DELETE ON TABLE public.customer_messages TO authenticated;

-- The server uses its private service key for admin/backend operations.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.products, public.storefront_categories, public.storefront_banner,
  public.store_settings, public.user_roles, public.staff_codes,
  public.staff_permissions, public.sales_product_permissions,
  public.orders, public.order_items, public.order_payments, public.audit_logs,
  public.customer_messages, public.order_edit_tokens,
  public.app_setup_state, public.categories
TO service_role;

-- Order creation/financial mutations use the existing atomic SECURITY DEFINER RPCs.
REVOKE ALL PRIVILEGES ON SEQUENCE public.orders_order_number_seq FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO service_role;

COMMIT;

SELECT
  c.relname AS table_name,
  has_table_privilege('anon', c.oid, 'SELECT') AS public_read,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS signed_in_read,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'storefront_categories', 'storefront_banner', 'store_settings')
ORDER BY c.relname;

