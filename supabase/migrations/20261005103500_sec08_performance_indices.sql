-- ============================================================================
-- Delish Bakes - Performance & Scalability Indices (SEC-08)
-- Optimized for: Kitchen Display System (KDS), Cashier POS, Order Lookup,
-- Realtime Subscriptions, and Admin Analytics at 50,000+ orders scale.
-- ============================================================================

-- 1. Enable pg_trgm extension for ultra-fast customer name and phone substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- TABLE: public.orders
-- ============================================================================

-- 2. KDS Active Orders Index (Ultra-compact Partial Index)
-- Specifically optimizes get_kitchen_orders filtering by active statuses and sorting by date/time
CREATE INDEX IF NOT EXISTS idx_orders_kds_active
  ON public.orders (requested_date ASC, requested_time ASC)
  WHERE status IN ('new', 'confirmed', 'baking', 'ready');

-- 3. Sales & Calendar Daily Schedule Index
-- Accelerates date-filter (today, tomorrow, week, custom date ranges)
CREATE INDEX IF NOT EXISTS idx_orders_requested_date_time
  ON public.orders (requested_date DESC, requested_time ASC);

-- 4. Order Feed & Reverse Chronological History Index
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders (created_at DESC);

-- 5. Customer Phone Lookup (Exact and Prefix B-Tree)
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_exact
  ON public.orders (customer_phone);

-- 6. Customer Phone & Name Fuzzy Search (Trigram GIN)
-- Accelerates customer auto-complete dropdown in PosOrderEntry and Social forms
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_trgm
  ON public.orders USING gin (customer_phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_customer_name_trgm
  ON public.orders USING gin (customer_name gin_trgm_ops);

-- 7. Order Number Direct Lookup Index
CREATE INDEX IF NOT EXISTS idx_orders_order_number_lookup
  ON public.orders (order_number);

-- 8. General Status Index
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

-- 9. Active Orders Index for Cashier & Workspace
CREATE INDEX IF NOT EXISTS idx_orders_active_created
  ON public.orders (created_at DESC)
  WHERE status IN ('new', 'confirmed', 'baking', 'ready', 'out_for_delivery');

-- 10. Completed & Archive Orders Index
CREATE INDEX IF NOT EXISTS idx_orders_completed_created
  ON public.orders (created_at DESC)
  WHERE status IN ('delivered', 'completed');

-- 11. Staff Code & Attribution Index
CREATE INDEX IF NOT EXISTS idx_orders_staff_code
  ON public.orders (staff_code)
  WHERE staff_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created_by
  ON public.orders (created_by)
  WHERE created_by IS NOT NULL;

-- 12. Payment Method Index for Financial Analytics
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON public.orders (payment_method)
  WHERE payment_method IS NOT NULL;

-- ============================================================================
-- TABLE: public.order_items
-- ============================================================================

-- 13. Foreign Key Order Join Index
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- 14. Product Foreign Key Index
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id)
  WHERE product_id IS NOT NULL;

-- ============================================================================
-- TABLE: public.customer_messages
-- ============================================================================

-- 15. Unread & Active Customer Messages Index
CREATE INDEX IF NOT EXISTS idx_customer_messages_status_created
  ON public.customer_messages (status, created_at DESC);

-- ============================================================================
-- TABLE: public.audit_logs
-- ============================================================================

-- 16. Order Audit Trail Index
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id_created
  ON public.audit_logs (order_id, created_at DESC);

-- ============================================================================
-- TABLE: public.order_edit_tokens
-- ============================================================================

-- 17. Customer Edit Link Token Lookup
CREATE INDEX IF NOT EXISTS idx_order_edit_tokens_token_hash
  ON public.order_edit_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_order_edit_tokens_order_id
  ON public.order_edit_tokens (order_id);
