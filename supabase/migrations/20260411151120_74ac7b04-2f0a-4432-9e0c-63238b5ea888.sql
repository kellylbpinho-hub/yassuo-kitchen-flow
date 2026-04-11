
CREATE OR REPLACE FUNCTION public.rpc_painel_nutri(p_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_today date;
  v_week_start date;
  v_week_end date;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_pending_orders integer;
  v_low_stock jsonb;
  v_blocked jsonb;
  v_week_menu jsonb;
  v_waste_today numeric;
  v_waste_count integer;
  v_expiry_alerts jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  IF NOT user_can_see_unit(p_unit_id) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar esta unidade.';
  END IF;

  v_today := CURRENT_DATE;
  v_week_start := date_trunc('week', v_today)::date; -- Monday
  v_week_end := v_week_start + 6;
  v_today_start := v_today::timestamptz;
  v_today_end := (v_today + 1)::timestamptz;

  -- 1. Pending transfers requested by this user
  SELECT COUNT(*) INTO v_pending_orders
  FROM transferencias
  WHERE solicitado_por = v_user_id
    AND status = 'pendente'
    AND company_id = v_company_id;

  -- 2. Low stock items (saldo from lotes view vs estoque_minimo from products)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', sub.nome, 'saldo', sub.saldo, 'minimo', sub.estoque_minimo
  ) ORDER BY sub.saldo ASC), '[]'::jsonb)
  INTO v_low_stock
  FROM (
    SELECT p.nome, COALESCE(v.saldo, 0) AS saldo, p.estoque_minimo
    FROM products p
    LEFT JOIN v_estoque_por_unidade v ON v.product_id = p.id AND v.unidade_id = p_unit_id
    WHERE p.company_id = v_company_id
      AND p.ativo = true
      AND p.estoque_minimo > 0
      AND COALESCE(v.saldo, 0) < p.estoque_minimo
    ORDER BY COALESCE(v.saldo, 0) ASC
    LIMIT 8
  ) sub;

  -- 3. Blocked products for this unit
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', upr.product_id,
    'nome', p.nome
  )), '[]'::jsonb)
  INTO v_blocked
  FROM unit_product_rules upr
  JOIN products p ON p.id = upr.product_id
  WHERE upr.unit_id = p_unit_id
    AND upr.company_id = v_company_id
    AND upr.status = 'bloqueado'
    AND p.ativo = true;

  -- 4. Week menus with dish counts
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', m.data,
    'nome', m.nome,
    'dishCount', COALESCE(dc.cnt, 0)
  ) ORDER BY m.data), '[]'::jsonb)
  INTO v_week_menu
  FROM menus m
  LEFT JOIN (
    SELECT menu_id, COUNT(*) AS cnt
    FROM menu_dishes
    WHERE company_id = v_company_id
    GROUP BY menu_id
  ) dc ON dc.menu_id = m.id
  WHERE m.unidade_id = p_unit_id
    AND m.company_id = v_company_id
    AND m.data >= v_week_start
    AND m.data <= v_week_end;

  -- 5. Waste today
  SELECT COUNT(*), COALESCE(SUM(quantidade), 0)
  INTO v_waste_count, v_waste_today
  FROM waste_logs
  WHERE unidade_id = p_unit_id
    AND company_id = v_company_id
    AND created_at >= v_today_start
    AND created_at < v_today_end;

  -- 6. Expiry alerts (active lotes expiring within validade_minima_dias)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', sub.nome, 'dias', sub.dias, 'qtd', sub.quantidade
  ) ORDER BY sub.dias ASC), '[]'::jsonb)
  INTO v_expiry_alerts
  FROM (
    SELECT p.nome,
      (l.validade - v_today) AS dias,
      l.quantidade
    FROM lotes l
    JOIN products p ON p.id = l.product_id
    WHERE l.unidade_id = p_unit_id
      AND l.company_id = v_company_id
      AND l.status = 'ativo'
      AND l.quantidade > 0
      AND (l.validade - v_today) <= COALESCE(p.validade_minima_dias, 30)
    ORDER BY (l.validade - v_today) ASC
    LIMIT 6
  ) sub;

  RETURN jsonb_build_object(
    'pending_orders', v_pending_orders,
    'low_stock', v_low_stock,
    'blocked', v_blocked,
    'week_menu', v_week_menu,
    'waste_today', v_waste_today,
    'waste_count', v_waste_count,
    'expiry_alerts', v_expiry_alerts
  );
END;
$function$;
