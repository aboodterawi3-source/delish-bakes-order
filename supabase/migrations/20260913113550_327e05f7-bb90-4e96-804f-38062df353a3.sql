-- ============ banner ============
CREATE TABLE public.storefront_banner (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  discount_text text NOT NULL DEFAULT '40% OFF',
  subtitle text NOT NULL DEFAULT 'Everyone''s Favorite',
  button_text text NOT NULL DEFAULT 'Order now',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_banner_singleton_check CHECK (singleton)
);

GRANT SELECT ON public.storefront_banner TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_banner TO authenticated;
GRANT ALL ON public.storefront_banner TO service_role;
ALTER TABLE public.storefront_banner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitors can view the banner" ON public.storefront_banner
  FOR SELECT TO anon USING (is_active);
CREATE POLICY "Signed-in users can view the banner" ON public.storefront_banner
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales can update the banner" ON public.storefront_banner
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Sales can create the banner" ON public.storefront_banner
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));

CREATE TRIGGER update_storefront_banner_updated_at BEFORE UPDATE ON public.storefront_banner
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.storefront_banner (discount_text, subtitle, button_text, image_url)
VALUES ('40% OFF', 'Everyone''s Favorite', 'Order now', '/images/croissants.jpg');

-- ============ categories ============
CREATE TABLE public.storefront_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  image_url text,
  tint text NOT NULL DEFAULT 'blush',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storefront_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_categories TO authenticated;
GRANT ALL ON public.storefront_categories TO service_role;
ALTER TABLE public.storefront_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitors can view active categories" ON public.storefront_categories
  FOR SELECT TO anon USING (is_active);
CREATE POLICY "Signed-in users can view categories" ON public.storefront_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales can insert categories" ON public.storefront_categories
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Sales can update categories" ON public.storefront_categories
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Sales can delete categories" ON public.storefront_categories
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));

CREATE TRIGGER update_storefront_categories_updated_at BEFORE UPDATE ON public.storefront_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX storefront_categories_sort_idx ON public.storefront_categories (sort_order, created_at);

INSERT INTO public.storefront_categories (name_en, name_ar, image_url, tint, sort_order) VALUES
  ('Cake',    'كيك',     '/images/ube-drip-cake.jpg',  'blush',      1),
  ('Pastry',  'معجنات',  '/images/croissants.jpg',      'butter',     2),
  ('Cupcake', 'كب كيك',  '/images/macaron-stack.jpg',   'pistachio',  3),
  ('Donuts',  'دونات',   '/images/macaron-pair.jpg',    'sky',        4);

-- ============ products: storefront fields ============
ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.storefront_categories(id) ON DELETE SET NULL,
  ADD COLUMN is_popular boolean NOT NULL DEFAULT false,
  ADD COLUMN rating numeric(2,1) NOT NULL DEFAULT 4.8,
  ADD COLUMN rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tint text;

CREATE INDEX products_popular_idx ON public.products (is_popular, sort_order);
CREATE INDEX products_category_id_idx ON public.products (category_id);

-- catalogue editing moves from kitchen to sales
DROP POLICY IF EXISTS "Kitchen and admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Kitchen and admins can update products" ON public.products;
DROP POLICY IF EXISTS "Kitchen and admins can delete products" ON public.products;

CREATE POLICY "Sales and admins can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Sales and admins can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Sales and admins can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'sales'::app_role));

INSERT INTO public.products
  (slug, name_ar, name_en, description_ar, description_en, category, price, image_url,
   is_available, is_featured, is_popular, rating, rating_count, sizes, tint, sort_order, category_id)
VALUES
  ('ube-flavoured-cake', 'كيك الأوبي', 'Ube Flavoured Cake',
   'كيك بنكهة الأوبي مع دريب بنفسجي وماكرون.', 'Ube sponge with violet drip and macarons.',
   'Cake', 55, '/images/ube-drip-cake.jpg', true, false, true, 4.9, 128,
   '[{"label":"6 inch","price":55},{"label":"9 inch","price":72},{"label":"12 inch","price":95}]'::jsonb,
   'blush', 1, (SELECT id FROM public.storefront_categories WHERE name_en = 'Cake')),
  ('german-chocolate-cake', 'كيك الشوكولاتة الألماني', 'German Chocolate Cake',
   'شوكولاتة غنية مع جوز الهند والبيكان.', 'Rich chocolate with coconut pecan filling.',
   'Cake', 48, '/images/ombre-ruffle-cake.jpg', true, false, true, 4.8, 94,
   '[{"label":"6 inch","price":48},{"label":"9 inch","price":66}]'::jsonb,
   'cream', 2, (SELECT id FROM public.storefront_categories WHERE name_en = 'Cake'));

-- ============ realtime ============
ALTER TABLE public.storefront_banner REPLICA IDENTITY FULL;
ALTER TABLE public.storefront_categories REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.storefront_banner; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.storefront_categories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;