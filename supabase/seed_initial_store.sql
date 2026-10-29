-- ==============================================================================
-- DELISH CAKE & BAKE — INITIAL STORE SEED DATA
-- Amman, Jordan (Asia/Amman)
-- Complete seed dataset for catalog, categories, banners, and admin bootstrap.
-- Run this in the Supabase SQL Editor AFTER running standalone_complete_schema.sql.
-- ==============================================================================

-- 1. INITIAL STOREFRONT BANNER
INSERT INTO public.storefront_banner (
  title_ar, title_en, subtitle_ar, subtitle_en,
  badge_ar, badge_en, action_label_ar, action_label_en, action_url, is_active
) VALUES (
  'مخبز وحلويات ديليش كيك · عمّان',
  'Delish Cake & Bake · Amman',
  'أشهى كيكات المناسبات الخاصة، مصممة يدوياً بأجود المكونات الطبيعية والتوصيل لكافة مناطق عمّان',
  'Handcrafted luxury artisan cakes and bakes delivered across Amman for your special moments',
  'المتجر الرسمي الفاخر',
  'Artisan Bakery',
  'تصفح القائمة والطلب الآن',
  'Explore Menu & Order',
  '/discover',
  true
) ON CONFLICT DO NOTHING;

-- 2. STOREFRONT CATEGORIES
INSERT INTO public.storefront_categories (
  id, name_ar, name_en, description_ar, description_en, icon, sort_order, is_active
) VALUES 
  ('11111111-1111-1111-1111-111111111101', 'كيك المناسبات الفاخر', 'Occasion Cakes', 'كيكات مصممة خصيصاً لأعياد الميلاد والخطوبة والأفراح', 'Signature celebration cakes tailored for birthdays and weddings', '🎂', 1, true),
  ('11111111-1111-1111-1111-111111111102', 'كيك التخرج والمناسبات الرسمية', 'Graduation Cakes', 'تصاميم احتفالية راقية لكافة مراحل التخرج', 'Festive graduation designs celebrating success', '🎓', 2, true),
  ('11111111-1111-1111-1111-111111111103', 'تشيز كيك مخبوز', 'Cheesecakes', 'تشيز كيك على الطريقة النيويوركية واللوتس والتوت', 'Rich baked cheesecakes with lotus and berries', '🍰', 3, true),
  ('11111111-1111-1111-1111-111111111104', 'قطع وحلويات فردية', 'Pastries & Slices', 'بوكسات مشكلة وقطع ديزرت سريعة', 'Assorted boxes and bite-sized delights', '🧁', 4, true),
  ('11111111-1111-1111-1111-111111111105', 'هدايا وتوابع الاحتفال', 'Gifts & Extras', 'شموع، بالونات، توبر أكريليك، وكروت إهداء مخصصة', 'Candles, balloons, acrylic toppers, and greeting cards', '🎁', 5, true)
ON CONFLICT DO NOTHING;

-- 3. INITIAL CORE PRODUCTS (DELISH CAKE SPECIALTIES)
INSERT INTO public.products (
  category_id, category, slug, name_ar, name_en,
  description_ar, description_en, filling_ar, filling_en,
  price, sizes, is_available, is_featured, is_popular, rating, rating_count, sort_order, tint
) VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    'Cake',
    'signature-chocolate-fudge',
    'كيك الشوكولاتة الفاخر مع حشوة النوتيلا والكرانش',
    'Signature Chocolate Fudge Cake',
    'طبقات كيك الشوكولاتة البلجيكية الغنية مع كريمة الغاناش وحشوة النوتيلا المقرمشة',
    'Rich Belgian chocolate layers with silky ganache and crunchy Nutella filling',
    'نوتيلا كرانش',
    'Nutella Crunch',
    25.00,
    '[{"label":"6 إنش (6-8 أشخاص)","price":25.00},{"label":"8 إنش (10-12 شخص)","price":35.00},{"label":"10 إنش (16-20 شخص)","price":48.00}]'::jsonb,
    true, true, true, 4.9, 140, 1, 'chocolate'
  ),
  (
    '11111111-1111-1111-1111-111111111101',
    'Cake',
    'salted-caramel-vanilla-crunch',
    'كيك الفانيلا مع الكراميل المملح واللوتس',
    'Salted Caramel & Vanilla Crunch Cake',
    'إسفنجة فانيلا مدغشقرية هشة ومحشوة بكراميل ديليش الخاص ومقرمشات بسكويت اللوتس',
    'Fluffy Madagascar vanilla sponge layered with house salted caramel and lotus crumbs',
    'كراميل مملح وبسكويت لوتس',
    'Salted Caramel & Lotus',
    26.00,
    '[{"label":"6 إنش (6-8 أشخاص)","price":26.00},{"label":"8 إنش (10-12 شخص)","price":36.00},{"label":"10 إنش (16-20 شخص)","price":50.00}]'::jsonb,
    true, true, true, 4.8, 98, 2, 'butter'
  ),
  (
    '11111111-1111-1111-1111-111111111101',
    'Cake',
    'pistachio-rose-water-luxury',
    'كيك الفستق الحلبي وماء الورد الملكي',
    'Royal Pistachio & Rose Water Cake',
    'كيك الفستق الطبيعي الطازج مع لمسة خفيفة من ماء الورد والكريمة المخملية',
    'Fresh natural pistachio sponge infused with organic rose water and velvety cream',
    'فستق حلبي طبيعي وكريمة الورد',
    'Pistachio & Rose Cream',
    30.00,
    '[{"label":"6 إنش (6-8 أشخاص)","price":30.00},{"label":"8 إنش (10-12 شخص)","price":42.00},{"label":"10 إنش (16-20 شخص)","price":58.00}]'::jsonb,
    true, true, false, 5.0, 75, 3, 'pistachio'
  ),
  (
    '11111111-1111-1111-1111-111111111101',
    'Cake',
    'red-velvet-cream-cheese',
    'كيك الريد فيلفيت الكلاسيكي بكريمة الجبن',
    'Classic Red Velvet Cake',
    'الريد فيلفيت الأصلي بقوامه المخملي وحشوة كريمة جبن فيلادلفيا الفاخرة',
    'Traditional velvety red sponge layered with whipped Philadelphia cream cheese frosting',
    'كريمة تشيز كلاسيك',
    'Classic Cream Cheese',
    24.00,
    '[{"label":"6 إنش (6-8 أشخاص)","price":24.00},{"label":"8 إنش (10-12 شخص)","price":34.00}]'::jsonb,
    true, false, true, 4.9, 112, 4, 'rose'
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    'Cheesecake',
    'san-sebastian-burnt-cheesecake',
    'سان سيباستيان تشيز كيك مع صوص الشوكولاتة',
    'San Sebastian Burnt Cheesecake',
    'تشيز كيك كريمي محروق على الطريقة الإسبانية الأصلية، يقدم مع صوص شوكولاتة بلجيكية دافئة',
    'Authentic creamy Basque cheesecake served with warm rich Belgian chocolate ganache',
    'تشيز كريمي طبيعي',
    'Basque Cream Cheese',
    22.00,
    '[{"label":"حجم عائلي (8-10 أشخاص)","price":22.00}]'::jsonb,
    true, true, true, 4.9, 87, 5, 'vanilla'
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    'Dessert',
    'assorted-mini-cake-box',
    'بوكس الميني كيك المشكل (6 قطع)',
    'Assorted Mini Cake Box (6 Pcs)',
    'تشكيلة مميزة من 6 كيكات صغيرة بنكهات مختلفة: نوتيلا، بستاشيو، ريد فيلفيت، كراميل',
    'A curated box of 6 handcrafted individual cakes featuring our top bestselling flavours',
    'مشكل نكهات ديليش',
    'Assorted Delish Flavours',
    18.00,
    '[{"label":"بوكس 6 قطع","price":18.00},{"label":"بوكس 12 قطعة","price":32.00}]'::jsonb,
    true, true, true, 4.8, 64, 6, 'cream'
  )
ON CONFLICT (slug) DO NOTHING;

-- 4. BOOTSTRAP INSTRUCTIONS FOR CREATING THE FIRST ADMIN USER SAFELY
-- ==============================================================================
-- To bootstrap your first administrator safely on your new Supabase project:
-- 1. Go to Supabase Dashboard -> Authentication -> Users.
-- 2. Click "Add User" -> "Create user", enter email as admin@delish.local (must end with @delish.local so username "admin" logs in directly)
--    and choose a strong private password.
-- 3. Copy the created user's "User UID" (UUID).
-- 4. Run the SQL snippet below in the SQL Editor, replacing 'PASTE_USER_UUID_HERE'
--    with your actual copied UID:
--
--    INSERT INTO public.user_roles (user_id, role)
--    VALUES ('PASTE_USER_UUID_HERE'::uuid, 'admin'::public.app_role)
--    ON CONFLICT (user_id, role) DO NOTHING;
--
--    INSERT INTO public.staff_codes (user_id, staff_code)
--    VALUES ('PASTE_USER_UUID_HERE'::uuid, 1)
--    ON CONFLICT (user_id) DO NOTHING;
--
--    INSERT INTO public.app_setup_state (id, admin_setup_completed_at)
--    VALUES (true, now())
--    ON CONFLICT (id) DO UPDATE SET admin_setup_completed_at = now();
--
-- 5. You can now log into the staff portal at /auth with full Admin capabilities!
-- ==============================================================================
