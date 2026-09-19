-- Migration: Add card_color_palette to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS card_color_palette text NOT NULL DEFAULT 'gold';
