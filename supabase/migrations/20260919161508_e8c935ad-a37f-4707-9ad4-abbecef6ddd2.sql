-- customer_messages: remove the USING(true) ALL policy; role-scoped SELECT/UPDATE already exist
DROP POLICY IF EXISTS "Staff can manage customer messages" ON public.customer_messages;

-- storefront_banner: remove the USING(true) ALL policy; sales/admin INSERT/UPDATE and scoped SELECTs already exist
DROP POLICY IF EXISTS "Staff can update banner" ON public.storefront_banner;