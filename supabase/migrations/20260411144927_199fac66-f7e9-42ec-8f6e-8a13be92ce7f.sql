CREATE OR REPLACE FUNCTION public.rpc_dashboard_executive()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
  v_units jsonb;
  v_low_stock integer;
  v_expiring integer;
  v_divergences jsonb;
  v_meal_costs jsonb;
  v_rupture integer;
  v_thirty_days_ago timestamptz;
  v_five_days_later date;
  v_two_days_ago timestamptz;
BEGIN
  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  -- Only CEO and gerente_operacional
  IF NOT (is_ceo() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente_operacional' AND company_id = v_company_id
  )) THEN
    RAISE EXCEPTION 'Sem permissão para acessar dados executivos.';
  END IF;

  v_thirty_days_ago := now() - interval '30 days';
  v_five_days_later := (now() + interval '5 days')::date;
  v_two_days_ago := now() - interval '48 hours';

  -- Kitchen units with details
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'name', u.name, 'contract_value', u.contract_value,
    'target_meal_cost', u.target_meal_cost, 'numero_colaboradores', u.numero_colaboradores
  )), '[]'::jsonb) INTO v_units
  FROM units u WHERE u.company_id = v_company_id AND u.type = 'kitchen';

  -- Low stock count
  SELECT COUNT(*) INTO v_low_stock
  FROM products p
  WHERE p.company_id = v_company_id AND p.ativo = true
    AND p.estoque_atual <= p.estoque_minimo AND p.estoque_minimo > 0;

  -- Expiring lots count
  SELECT COUNT(*) INTO v_expiring
  FROM lotes l
  WHERE l.company_id = v_company_id AND l.status = 'ativo'
    AND l.quantidade > 0 AND l.validade <= v_five_days_later;

  -- Recent weight divergences (last 48h, limit 10)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_name', w.product_name, 'percentual_desvio', w.percentual_desvio,
    'created_at', w.created_at, 'unidade_id', w.unidade_id
  ) ORDER BY w.created_at DESC), '[]'::jsonb) INTO v_divergences
  FROM (
    SELECT product_name, percentual_desvio, created_at, unidade_id
    FROM weight_divergence_logs
    WHERE company_id = v_company_id AND created_at >= v_two_days_ago
    ORDER BY created_at DESC LIMIT 10
  ) w;

  -- Meal cost aggregations per unit
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'unit_id', mc.unit_id, 'total_cost', mc.total_cost,
    'total_meals', mc.total_meals, 'avg_cost', mc.avg_cost
  )), '[]'::jsonb) INTO v_meal_costs
  FROM (
    SELECT unit_id,
      SUM(COALESCE(real_meal_cost, 0) * COALESCE(meals_served, 0)) AS total_cost,
      SUM(COALESCE(meals_served, 0)) AS total_meals,
      CASE WHEN SUM(COALESCE(meals_served, 0)) > 0
        THEN SUM(COALESCE(real_meal_cost, 0) * COALESCE(meals_served, 0)) / SUM(COALESCE(meals_served, 0))
        ELSE 0 END AS avg_cost
    FROM meal_cost_daily
    WHERE company_id = v_company_id AND unit_id IS NOT NULL
    GROUP BY unit_id
  ) mc;

  -- Rupture risk (products with < 3 days of stock based on 30d consumption)
  SELECT COUNT(*) INTO v_rupture
  FROM (
    SELECT p.id
    FROM products p
    JOIN LATERAL (
      SELECT COALESCE(SUM(m.quantidade), 0) AS total_consumed
      FROM movements m
      WHERE m.product_id = p.id AND m.company_id = v_company_id
        AND m.tipo IN ('consumo', 'saida', 'perda')
        AND m.created_at >= v_thirty_days_ago
    ) cons ON true
    WHERE p.company_id = v_company_id AND p.ativo = true
      AND p.estoque_atual > 0 AND cons.total_consumed > 0
      AND (p.estoque_atual / (cons.total_consumed / 30.0)) <= 3
  ) r;

  v_result := jsonb_build_object(
    'units', v_units,
    'low_stock_count', v_low_stock,
    'expiring_count', v_expiring,
    'divergences', v_divergences,
    'meal_costs', v_meal_costs,
    'rupture_risk', v_rupture
  );

  RETURN v_result;
END;
$$;