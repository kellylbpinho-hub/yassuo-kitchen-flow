
CREATE OR REPLACE FUNCTION public.rpc_consume_fefo(
  p_product_id uuid,
  p_unidade_id uuid,
  p_quantidade numeric,
  p_tipo text,         -- 'consumo', 'desperdicio', 'saida', 'perda'
  p_motivo text DEFAULT NULL,
  p_menu_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_remaining numeric;
  v_lote record;
  v_deducted numeric;
  v_movement_id uuid;
  v_novo_estoque numeric;
  v_lotes_consumed jsonb := '[]'::jsonb;
  v_waste_id uuid;
  v_valid_types text[] := ARRAY['consumo', 'desperdicio', 'saida', 'perda'];
BEGIN
  -- Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não encontrada.';
  END IF;

  -- Permission: estoquista-level
  IF NOT is_estoquista() THEN
    RAISE EXCEPTION 'Sem permissão para registrar saídas de estoque.';
  END IF;

  -- Validate tipo
  IF NOT (p_tipo = ANY(v_valid_types)) THEN
    RAISE EXCEPTION 'Tipo inválido. Use: consumo, desperdicio, saida ou perda.';
  END IF;

  -- Validate quantity
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  -- Validate product belongs to company
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Produto não encontrado ou não pertence à sua empresa.';
  END IF;

  -- Validate unit belongs to company
  IF NOT EXISTS (SELECT 1 FROM units WHERE id = p_unidade_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada ou não pertence à sua empresa.';
  END IF;

  -- FEFO: consume from oldest expiry lots first
  v_remaining := p_quantidade;

  FOR v_lote IN
    SELECT id, quantidade, validade, codigo
    FROM lotes
    WHERE product_id = p_product_id
      AND unidade_id = p_unidade_id
      AND company_id = v_company_id
      AND status = 'ativo'
      AND quantidade > 0
    ORDER BY validade ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_lote.quantidade >= v_remaining THEN
      v_deducted := v_remaining;
    ELSE
      v_deducted := v_lote.quantidade;
    END IF;

    UPDATE lotes
    SET quantidade = quantidade - v_deducted,
        status = CASE WHEN (quantidade - v_deducted) <= 0 THEN 'consumido' ELSE status END
    WHERE id = v_lote.id;

    v_lotes_consumed := v_lotes_consumed || jsonb_build_object(
      'lote_id', v_lote.id,
      'lote_codigo', v_lote.codigo,
      'validade', v_lote.validade,
      'quantidade_consumida', v_deducted
    );

    v_remaining := v_remaining - v_deducted;
  END LOOP;

  -- If not enough stock in lots, still allow (product.estoque_atual may have stock without lots)
  -- The movement and stock update proceed regardless

  -- Create movement
  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (
    p_product_id, p_unidade_id,
    CASE WHEN p_tipo = 'desperdicio' THEN 'perda' ELSE p_tipo END,
    p_quantidade,
    COALESCE(p_motivo, initcap(p_tipo) || ' via FEFO'),
    v_user_id, v_company_id
  )
  RETURNING id INTO v_movement_id;

  -- Atomic stock decrement
  UPDATE products
  SET estoque_atual = GREATEST(0, estoque_atual - p_quantidade)
  WHERE id = p_product_id
  RETURNING estoque_atual INTO v_novo_estoque;

  -- If tipo is desperdicio, also insert waste_log
  IF p_tipo = 'desperdicio' THEN
    INSERT INTO waste_logs (product_id, quantidade, observacao, menu_id, user_id, unidade_id, company_id)
    VALUES (p_product_id, p_quantidade, p_observacao, p_menu_id, v_user_id, p_unidade_id, v_company_id)
    RETURNING id INTO v_waste_id;
  END IF;

  -- Audit log
  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (
    v_user_id, v_company_id, p_unidade_id,
    CASE WHEN p_tipo = 'desperdicio' THEN 'desperdicio' ELSE 'estoque' END,
    p_tipo,
    v_movement_id,
    jsonb_build_object(
      'product_id', p_product_id,
      'quantidade', p_quantidade,
      'tipo', p_tipo,
      'motivo', p_motivo,
      'movement_id', v_movement_id,
      'novo_estoque_atual', v_novo_estoque,
      'lotes_consumed', v_lotes_consumed,
      'waste_log_id', v_waste_id
    )
  );

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'novo_estoque_atual', v_novo_estoque,
    'lotes_consumed', v_lotes_consumed,
    'waste_log_id', v_waste_id,
    'product_id', p_product_id,
    'unidade_id', p_unidade_id
  );
END;
$$;
