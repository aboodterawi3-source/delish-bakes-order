CREATE POLICY "Kitchen and admins can read product images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Kitchen and admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role)));

CREATE POLICY "Kitchen and admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role)));

CREATE POLICY "Kitchen and admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'kitchen'::app_role)));