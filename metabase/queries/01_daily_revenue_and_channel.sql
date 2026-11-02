-- ==============================================================================
-- Metabase Question: 01. Daily Revenue, Channel Breakdown & Volume
-- Tracks GMV (Gross Merchandise Value), actual deposits, and order counts
-- filtered by pickup vs delivery channel.
-- ==============================================================================

SELECT
  date_trunc('day', o.created_at) AS order_date,
  o.method AS fulfillment_channel,
  COUNT(o.id) AS total_orders,
  SUM(o.total) AS total_revenue_jd,
  SUM(o.deposit_paid) AS total_collected_jd,
  SUM(CASE WHEN o.deposit_paid > o.total THEN (o.deposit_paid - o.total) ELSE 0 END) AS potential_refunds_jd,
  AVG(o.total) AS average_order_value_jd
FROM public.orders o
WHERE o.status != 'cancelled'
GROUP BY 1, 2
ORDER BY 1 DESC, 2 ASC;
