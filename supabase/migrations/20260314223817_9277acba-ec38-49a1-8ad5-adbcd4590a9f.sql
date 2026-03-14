
CREATE OR REPLACE VIEW public.meal_cost_daily
WITH (security_invoker = true)
AS
WITH purchase_cost AS (
  SELECT
    (po.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    po.unidade_id AS unit_id,
    po.company_id,
    SUM(pi.quantidade * COALESCE(pi.custo_unitario, 0)) AS total_food_cost
  FROM purchase_orders po
  JOIN purchase_items pi ON pi.purchase_order_id = po.id
  WHERE po.status IN ('aprovado', 'recebido')
  GROUP BY 1, 2, 3
),
consumption_cost AS (
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
food_cost AS (
  SELECT
    COALESCE(pc.date, cc.date) AS date,
    COALESCE(pc.unit_id, cc.unit_id) AS unit_id,
    COALESCE(pc.company_id, cc.company_id) AS company_id,
    CASE
      WHEN COALESCE(pc.total_food_cost, 0) > 0 THEN pc.total_food_cost
      ELSE COALESCE(cc.total_food_cost, 0)
    END AS total_food_cost
  FROM purchase_cost pc
  FULL OUTER JOIN consumption_cost cc
    ON cc.date = pc.date AND cc.unit_id = pc.unit_id AND cc.company_id = pc.company_id
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
  SELECT DISTINCT date, unit_id, company_id FROM food_cost
  UNION
  SELECT DISTINCT date, unit_id, company_id FROM waste
)
SELECT 
  du.date,
  du.unit_id,
  du.company_id,
  u.name AS unit_name,
  u.numero_colaboradores AS meals_served,
  COALESCE(fc.total_food_cost, 0) AS total_food_cost,
  COALESCE(w.waste_cost, 0) AS waste_cost,
  COALESCE(w.waste_kg, 0) AS waste_kg,
  CASE WHEN u.numero_colaboradores > 0 
    THEN GREATEST(0, (COALESCE(fc.total_food_cost, 0) - COALESCE(w.waste_cost, 0)) / u.numero_colaboradores)
    ELSE 0 
  END AS real_meal_cost
FROM dates_units du
JOIN units u ON u.id = du.unit_id
LEFT JOIN food_cost fc ON fc.date = du.date AND fc.unit_id = du.unit_id AND fc.company_id = du.company_id
LEFT JOIN waste w ON w.date = du.date AND w.unit_id = du.unit_id AND w.company_id = du.company_id;
