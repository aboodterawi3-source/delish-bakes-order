-- ==============================================================================
-- Metabase Question: 04. Overpayment & Refund-Due Financial Audit
-- Identifies orders requiring cashier refund action according to Delish financial logic.
-- ==============================================================================

SELECT
  o.id,
  o.order_number,
  o.customer_name,
  o.customer_phone,
  o.payment_method,
  o.total AS order_total_jd,
  o.deposit_paid AS amount_paid_jd,
  (o.deposit_paid - o.total) AS refund_due_jd,
  o.created_at,
  o.status
FROM public.orders o
WHERE o.deposit_paid > o.total
ORDER BY (o.deposit_paid - o.total) DESC, o.created_at DESC;
