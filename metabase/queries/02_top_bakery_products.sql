-- ==============================================================================
-- Metabase Question: 02. Top-Selling Bakery Products & Categories
-- Identifies best-performing cakes, pastries, and treats by units and revenue.
-- ==============================================================================

SELECT
  COALESCE(p.category, 'Bakery') AS product_category,
  COALESCE(p.name_ar, oi.name_ar) AS product_name_ar,
  COALESCE(p.name_en, oi.name_en) AS product_name_en,
  SUM(oi.quantity) AS total_units_sold,
  SUM(oi.unit_price * oi.quantity) AS total_sales_jd,
  ROUND(AVG(oi.unit_price), 2) AS avg_unit_price_jd
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.status != 'cancelled'
GROUP BY 1, 2, 3
ORDER BY total_sales_jd DESC
LIMIT 15;
