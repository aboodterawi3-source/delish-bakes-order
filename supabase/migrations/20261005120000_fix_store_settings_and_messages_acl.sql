-- ============================================================================
-- Migration: 20261005120000_fix_store_settings_and_messages_acl.sql
-- Description:
--   1. Add cliq_alias, store_name, and contact_phone to store_settings
--   2. Grant DELETE permissions and RLS policy on customer_messages for staff
--   3. Tighten orders_text_length_check constraint on design_image_url (max 2500 chars)
-- ============================================================================

-- 1. Store settings essential columns
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS cliq_alias text NOT NULL DEFAULT 'DELISHBAKES',
  ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT 'DELISH Bakes',
  ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '+962779179995';

-- 2. Customer messages staff DELETE permissions & RLS policy
GRANT DELETE ON public.customer_messages TO authenticated;

DROP POLICY IF EXISTS "Allow admins to delete customer messages" ON public.customer_messages;
DROP POLICY IF EXISTS "Allow staff to delete customer messages" ON public.customer_messages;

CREATE POLICY "Allow staff to delete customer messages"
  ON public.customer_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sales', 'social')
    )
  );

-- 3. Block oversized Base64 data strings in orders table (cap design_image_url at 2500 chars)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_text_length_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_text_length_check CHECK (
    length(customer_name) <= 120 AND length(customer_phone) <= 25
    AND (area IS NULL OR length(area) <= 120)
    AND (address IS NULL OR length(address) <= 400)
    AND (notes IS NULL OR length(notes) <= 2000)
    AND (staff_notes IS NULL OR length(staff_notes) <= 2000)
    AND (inscription IS NULL OR length(inscription) <= 500)
    AND (design_image_url IS NULL OR length(design_image_url) <= 2500)
  );
