DROP POLICY IF EXISTS "Public can insert customer messages" ON public.customer_messages;
REVOKE INSERT ON public.customer_messages FROM anon;