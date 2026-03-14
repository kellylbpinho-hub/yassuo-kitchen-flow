
CREATE OR REPLACE VIEW public.meal_cost_daily
WITH (security_invoker = true)
AS
WITH consumption AS (
  SELECT 
    (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    m.unidade_id AS unit_id,
    m.company_id,
    SUM(m.quantidade * COALESCE(p.custo_unitario, 0)) AS total_food_cost
  FROM movements m
  JOIN products p ON p.id = m.product_id
  WHERE m.tipo IN ('consumo', 'saida')
  GROUP BY 1, 2, 3
),
waste AS (
  SELECT 
    (w.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    w.unidade_id AS unit_id,
    w.company_id,
    SUM(w.quantidade * COALESCE(p.custo_unitario, 0)) AS waste_cost,
    SUM(w.quantidade) AS waste_kg
  FROM waste_logs w
  LEFT JOIN products p ON p.id = w.product_id
  GROUP BY 1, 2, 3
),
dates_units AS (
  SELECT DISTINCT date, unit_id, company_id FROM consumption
  UNION
  SELECT DISTINCT date, unit_id, company_id FROM waste
)
SELECT 
  du.date,
  du.unit_id,
  du.company_id,
  u.name AS unit_name,
  u.numero_colaboradores AS meals_served,
  COALESCE(c.total_food_cost, 0) AS total_food_cost,
  COALESCE(w.waste_cost, 0) AS waste_cost,
  COALESCE(w.waste_kg, 0) AS waste_kg,
  CASE WHEN u.numero_colaboradores > 0 
    THEN (COALESCE(c.total_food_cost, 0) - COALESCE(w.waste_cost, 0)) / u.numero_colaboradores
    ELSE 0 
  END AS real_meal_cost
FROM dates_units du
JOIN units u ON u.id = du.unit_id
LEFT JOIN consumption c ON c.date = du.date AND c.unit_id = du.unit_id AND c.company_id = du.company_id
LEFT JOIN waste w ON w.date = du.date AND w.unit_id = du.unit_id AND w.company_id = du.company_id;
