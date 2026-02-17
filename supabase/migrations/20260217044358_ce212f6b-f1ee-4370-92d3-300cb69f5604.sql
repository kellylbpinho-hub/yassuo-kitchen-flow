
CREATE OR REPLACE FUNCTION public.rpc_receive_digital(
  p_product_id uuid,
  p_unidade_id uuid,
  p_validade date,
  p_lote_codigo text,
  p_quantidade numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_unit_type text;
  v_product_company uuid;
  v_lote_id uuid;
  v_movement_id uuid;
  v_novo_estoque numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não encontrada.';
  END IF;

  IF NOT is_estoquista() THEN
    RAISE EXCEPTION 'Sem permissão para realizar recebimentos.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_validade IS NULL THEN
    RAISE EXCEPTION 'Data de validade é obrigatória.';
  END IF;

  IF p_lote_codigo IS NULL OR trim(p_lote_codigo) = '' THEN
    RAISE EXCEPTION 'Código do lote é obrigatório.';
  END IF;

  SELECT type INTO v_unit_type
  FROM units WHERE id = p_unidade_id AND company_id = v_company_id;

  IF v_unit_type IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada ou não pertence à sua empresa.';
  END IF;

  IF v_unit_type <> 'cd' THEN
    RAISE EXCEPTION 'Recebimento permitido apenas em unidades do tipo CD (Centro de Distribuição).';
  END IF;

  SELECT company_id INTO v_product_company
  FROM products WHERE id = p_product_id;

  IF v_product_company IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF v_product_company <> v_company_id THEN
    RAISE EXCEPTION 'Produto não pertence à sua empresa.';
  END IF;

  INSERT INTO lotes (product_id, unidade_id, validade, codigo, quantidade, company_id)
  VALUES (p_product_id, p_unidade_id, p_validade, trim(p_lote_codigo), p_quantidade, v_company_id)
  RETURNING id INTO v_lote_id;

  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (p_product_id, p_unidade_id, 'entrada', p_quantidade,
          'Recebimento digital - Lote: ' || trim(p_lote_codigo), v_user_id, v_company_id)
  RETURNING id INTO v_movement_id;

  UPDATE products
  SET estoque_atual = estoque_atual + p_quantidade
  WHERE id = p_product_id
  RETURNING estoque_atual INTO v_novo_estoque;

  -- Audit log
  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (
    v_user_id,
    v_company_id,
    p_unidade_id,
    'recebimento_digital',
    'create',
    v_lote_id,
    jsonb_build_object(
      'product_id', p_product_id,
      'lote_codigo', trim(p_lote_codigo),
      'validade', p_validade,
      'quantidade', p_quantidade,
      'movement_id', v_movement_id,
      'novo_estoque_atual', v_novo_estoque
    )
  );

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'movement_id', v_movement_id,
    'novo_estoque_atual', v_novo_estoque,
    'product_id', p_product_id,
    'unidade_id', p_unidade_id
  );
END;
$$;
