-- Migration: Synchronize staff numbering, order customization fields, and store settings

-- 1. Staff numbering and attribution
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_code integer,
  ADD COLUMN IF NOT EXISTS employee_number integer;

ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS employee_number integer,
  ADD COLUMN IF NOT EXISTS staff_code integer;

-- 2. Order Customization & Gift details
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS servings_capacity text,
  ADD COLUMN IF NOT EXISTS filling text,
  ADD COLUMN IF NOT EXISTS cake_writing text,
  ADD COLUMN IF NOT EXISTS is_gift boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text;

-- 3. Store settings (CliQ alias and store information)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  cliq_alias text NOT NULL DEFAULT 'DELISHBAKES',
  store_name text NOT NULL DEFAULT 'DELISH Bakes',
  contact_phone text NOT NULL DEFAULT '+962790000000',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_singleton_check CHECK (singleton)
);

GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view store settings" ON public.store_settings;
CREATE POLICY "Anyone can view store settings" ON public.store_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings" ON public.store_settings
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.store_settings (cliq_alias, store_name, contact_phone)
VALUES ('DELISHBAKES', 'DELISH Bakes', '+962790000000')
ON CONFLICT (singleton) DO NOTHING;
