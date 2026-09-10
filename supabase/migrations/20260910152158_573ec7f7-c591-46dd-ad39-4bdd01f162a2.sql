REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated, service_role;

DROP POLICY "Anyone can view available products" ON public.products;
CREATE POLICY "Visitors can view available products" ON public.products
  FOR SELECT TO anon USING (is_available);
CREATE POLICY "Signed-in users can view products" ON public.products
  FOR SELECT TO authenticated USING (is_available OR public.is_staff(auth.uid()));