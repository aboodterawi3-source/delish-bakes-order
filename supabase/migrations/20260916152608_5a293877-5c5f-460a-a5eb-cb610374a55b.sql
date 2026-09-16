REVOKE ALL ON FUNCTION public.get_kitchen_orders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kitchen_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_orders() TO authenticated, service_role;