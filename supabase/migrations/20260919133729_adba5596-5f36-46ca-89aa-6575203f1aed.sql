CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  card_color_palette text NOT NULL DEFAULT 'gold',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_singleton_true CHECK (singleton)
);

GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store settings"
ON public.store_settings FOR SELECT
USING (true);

CREATE POLICY "Order desk can update store settings"
ON public.store_settings FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales') OR private.has_role(auth.uid(), 'social'))
WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'sales') OR private.has_role(auth.uid(), 'social'));

CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_settings (singleton, card_color_palette) VALUES (true, 'gold');

ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;