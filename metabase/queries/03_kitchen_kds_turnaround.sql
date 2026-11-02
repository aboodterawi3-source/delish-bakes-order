-- ==============================================================================
-- Metabase Question: 03. Kitchen Display System (KDS) Turnaround & Pipeline
-- Monitors live pipeline load across kitchen stages and urgent priority tags.
-- ==============================================================================

SELECT
  o.status AS kitchen_status,
  COUNT(o.id) AS active_orders_count,
  COUNT(CASE WHEN o.is_urgent = true THEN 1 END) AS urgent_orders_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(o.updated_at, now()) - o.created_at)) / 60), 1) AS avg_duration_minutes,
  SUM(o.total) AS pipeline_value_jd
FROM public.orders o
WHERE o.status IN ('new', 'confirmed', 'baking', 'ready', 'out_for_delivery')
GROUP BY 1
ORDER BY
  CASE o.status
    WHEN 'new' THEN 1
    WHEN 'confirmed' THEN 2
    WHEN 'baking' THEN 3
    WHEN 'ready' THEN 4
    WHEN 'out_for_delivery' THEN 5
    ELSE 6
  END;
