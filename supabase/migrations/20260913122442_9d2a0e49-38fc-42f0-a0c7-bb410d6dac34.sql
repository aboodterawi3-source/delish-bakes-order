DROP POLICY IF EXISTS "Kitchen and admins can read product images" ON storage.objects;

CREATE POLICY "Kitchen and admins can read product images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role))
);

CREATE POLICY "Staff can read order design images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-designs' AND private.is_staff(auth.uid()));

CREATE POLICY "Staff can read site media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'site-media' AND private.is_staff(auth.uid()));

CREATE POLICY "Sales and admins can upload site media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'site-media'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role))
);

CREATE POLICY "Sales and admins can update site media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'site-media'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role))
);

CREATE POLICY "Sales and admins can delete site media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'site-media'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role))
);