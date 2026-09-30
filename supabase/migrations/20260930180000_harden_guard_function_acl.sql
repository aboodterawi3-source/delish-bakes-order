-- Security hardening: deterministic EXECUTE privileges for the two
-- SECURITY DEFINER guard functions.
--
-- public.order_items_guard_price_override() and public.orders_guard_discount()
-- are trigger functions (they return trigger and read OLD/NEW), so they are not
-- meant to be callable through the REST API. A REVOKE was issued early in the
-- history, but both functions are later re-created with CREATE OR REPLACE, which
-- preserves whatever ACL the object had at that moment. This migration makes the
-- end state explicit and independent of that history.
--
-- Trigger execution does not require EXECUTE for the invoking role, so revoking
-- here is safe: the project already relies on exactly this pattern for
-- public.orders_stamp_staff_code(), which is attached as a trigger and revoked
-- from PUBLIC, anon and authenticated in the same migration that creates it.
--
-- Idempotent: does nothing if a function is absent.

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['orders_guard_discount', 'order_items_guard_price_override']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn
        AND p.pronargs = 0
    ) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;
END
$$;
