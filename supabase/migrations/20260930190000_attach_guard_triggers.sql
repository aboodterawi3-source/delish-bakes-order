-- Attach the two SECURITY DEFINER guard functions as triggers.
--
-- public.orders_guard_discount() and public.order_items_guard_price_override()
-- exist in the schema, but no migration ever attaches them to a table, so the
-- caps stored in staff_permissions / sales_product_permissions may never have
-- been enforced on direct API writes. They are trigger functions (RETURNS
-- trigger, they read OLD/NEW), which is why they do nothing on their own.
--
-- Safe by construction:
--   * Each block creates the trigger only when NO trigger on that table already
--     calls the same function, so a trigger created from the dashboard is never
--     duplicated.
--   * Both blocks do nothing when the function itself is absent.
--   * Trigger firing order is alphabetical, so orders_guard_discount runs before
--     orders_recalculate_totals, exactly as the guard expects: it compares the
--     values the caller wrote, before totals are recomputed.
--
-- Every code path in the app that updates public.orders / public.order_items was
-- checked against both guards:
--   * financial updates (subtotal, delivery_fee, deposit_paid, payment_method,
--     discount, total) are only issued by sales / social / admin sessions, which
--     orders_guard_discount() allows; admin bypasses it entirely;
--   * kitchen writes change status / queue_rank / modifications only;
--   * the customer edit link (submitOrderEdit) writes notes, inscription,
--     customer_phone, requested_date/time and modifications through the service
--     role and never touches a financial column, so the guard does not fire.
--
-- Idempotent and safe to re-run. To roll back:
--   DROP TRIGGER IF EXISTS orders_guard_discount ON public.orders;
--   DROP TRIGGER IF EXISTS order_items_guard_price_override ON public.order_items;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'orders_guard_discount'
      AND p.pronargs = 0
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE cn.nspname = 'public'
      AND c.relname = 'orders'
      AND NOT t.tgisinternal
      AND pn.nspname = 'public'
      AND p.proname = 'orders_guard_discount'
  ) THEN
    CREATE TRIGGER orders_guard_discount
      BEFORE INSERT OR UPDATE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.orders_guard_discount();
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'order_items_guard_price_override'
      AND p.pronargs = 0
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE cn.nspname = 'public'
      AND c.relname = 'order_items'
      AND NOT t.tgisinternal
      AND pn.nspname = 'public'
      AND p.proname = 'order_items_guard_price_override'
  ) THEN
    CREATE TRIGGER order_items_guard_price_override
      BEFORE UPDATE ON public.order_items
      FOR EACH ROW EXECUTE FUNCTION public.order_items_guard_price_override();
  END IF;
END
$$;
