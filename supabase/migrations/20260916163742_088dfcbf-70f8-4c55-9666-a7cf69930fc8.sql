CREATE POLICY "Order desk can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
);