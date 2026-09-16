ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS filling_ar text,
  ADD COLUMN IF NOT EXISTS filling_en text,
  ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

CREATE TABLE public.customer_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid,
  handled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.customer_messages TO authenticated;
GRANT ALL ON public.customer_messages TO service_role;

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales social and admins read customer messages"
ON public.customer_messages FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
);

CREATE POLICY "Sales social and admins update customer messages"
ON public.customer_messages FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales'::app_role)
  OR private.has_role(auth.uid(), 'social'::app_role)
);

CREATE TRIGGER update_customer_messages_updated_at
BEFORE UPDATE ON public.customer_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();