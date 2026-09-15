ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS card_note text,
  ADD COLUMN IF NOT EXISTS final_photo_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_message text;