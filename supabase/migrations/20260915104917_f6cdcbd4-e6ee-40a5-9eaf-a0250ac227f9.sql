ALTER TABLE public.storefront_categories
  ADD COLUMN IF NOT EXISTS priority_color public.priority_color;