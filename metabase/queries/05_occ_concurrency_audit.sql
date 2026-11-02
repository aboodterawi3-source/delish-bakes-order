-- ==============================================================================
-- Metabase Question: 05. Optimistic Concurrency Control (OCC) Audit
-- Measures order mutation frequency and multi-staff concurrent edit spikes.
-- ==============================================================================

SELECT
  CASE
    WHEN o.version = 1 THEN 'Initial Version (No Edits)'
    WHEN o.version BETWEEN 2 AND 3 THEN 'Moderate Edits (2-3)'
    WHEN o.version BETWEEN 4 AND 6 THEN 'High Edits (4-6)'
    ELSE 'Critical Concurrency (7+ Edits)'
  END AS edit_intensity_bracket,
  COUNT(o.id) AS order_count,
  ROUND(COUNT(o.id) * 100.0 / NULLIF(SUM(COUNT(o.id)) OVER (), 0), 2) AS percentage_of_all_orders,
  MAX(o.version) AS max_version_reached,
  AVG(o.version) AS avg_version_per_order
FROM public.orders o
GROUP BY 1
ORDER BY avg_version_per_order ASC;
