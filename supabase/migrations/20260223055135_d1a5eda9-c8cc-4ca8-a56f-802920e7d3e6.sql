
-- P1: Barcode normalization function
CREATE OR REPLACE FUNCTION public.normalize_barcode(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(trim(COALESCE(raw, '')), '[^0-9]', '', 'g'), '')
$$;

-- P1: Unique index on normalized barcode per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_codigo_barras_company
ON public.products (company_id, codigo_barras)
WHERE codigo_barras IS NOT NULL;

-- P1: Update rpc_create_product with upsert logic + normalization
CREATE OR REPLACE FUNCTION public.rpc_create_product(
  p_unidade_id uuid,
  p_nome text,
  p_unidade_medida text DEFAULT 'kg',
  p_category_id uuid DEFAULT NULL,
  p_codigo_barras text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_product_id uuid;
  v_result jsonb;
  v_normalized_barcode text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não encontrada.';
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório.';
  END IF;

  IF p_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Unidade é obrigatória.';
  END IF;

  IF NOT user_can_see_unit(p_unidade_id) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar produtos nesta unidade.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM units WHERE id = p_unidade_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada ou não pertence à sua empresa.';
  END IF;

  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM product_categories WHERE id = p_category_id AND company_id = v_company_id) THEN
      RAISE EXCEPTION 'Categoria não encontrada ou não pertence à sua empresa.';
    END IF;
  END IF;

  -- Normalize barcode
  v_normalized_barcode := normalize_barcode(p_codigo_barras);

  -- If barcode provided, check if product already exists in this company
  IF v_normalized_barcode IS NOT NULL THEN
    SELECT id INTO v_product_id
    FROM products
    WHERE company_id = v_company_id AND codigo_barras = v_normalized_barcode;

    IF v_product_id IS NOT NULL THEN
      -- Return existing product (no error)
      SELECT jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'unidade_medida', p.unidade_medida,
        'codigo_barras', p.codigo_barras,
        'unidade_id', p.unidade_id,
        'company_id', p.company_id,
        'category_id', p.category_id,
        'estoque_atual', p.estoque_atual,
        'already_existed', true
      ) INTO v_result
      FROM products p WHERE p.id = v_product_id;

      RETURN v_result;
    END IF;
  END IF;

  INSERT INTO products (nome, unidade_medida, codigo_barras, unidade_id, company_id, category_id)
  VALUES (trim(p_nome), COALESCE(p_unidade_medida, 'kg'), v_normalized_barcode, p_unidade_id, v_company_id, p_category_id)
  RETURNING id INTO v_product_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'unidade_medida', p.unidade_medida,
    'codigo_barras', p.codigo_barras,
    'unidade_id', p.unidade_id,
    'company_id', p.company_id,
    'category_id', p.category_id,
    'estoque_atual', p.estoque_atual,
    'already_existed', false
  ) INTO v_result
  FROM products p WHERE p.id = v_product_id;

  RETURN v_result;
END;
$function$;

-- P2: rpc_approve_transfer
CREATE OR REPLACE FUNCTION public.rpc_approve_transfer(
  p_transfer_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_transfer record;
  v_remaining numeric;
  v_lote record;
  v_deducted numeric;
  v_movement_cd_id uuid;
  v_movement_kitchen_id uuid;
  v_new_lote_id uuid;
  v_novo_estoque numeric;
  v_lotes_consumed jsonb := '[]'::jsonb;
  v_lotes_created jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não encontrada.';
  END IF;

  -- Only managers/CEO can approve
  IF NOT user_can_manage() THEN
    RAISE EXCEPTION 'Sem permissão para aprovar transferências.';
  END IF;

  -- Fetch transfer
  SELECT * INTO v_transfer
  FROM transferencias
  WHERE id = p_transfer_id AND company_id = v_company_id
  FOR UPDATE;

  IF v_transfer IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;

  IF v_transfer.status <> 'pendente' THEN
    RAISE EXCEPTION 'Transferência já foi processada (status: %).', v_transfer.status;
  END IF;

  IF p_decision = 'rejeitar' THEN
    UPDATE transferencias
    SET status = 'rejeitada',
        aprovado_por = v_user_id,
        motivo_rejeicao = p_reason,
        updated_at = now()
    WHERE id = p_transfer_id;

    INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
    VALUES (v_user_id, v_company_id, v_transfer.unidade_origem_id, 'transferencias', 'reject', p_transfer_id,
      jsonb_build_object('motivo_rejeicao', p_reason, 'product_id', v_transfer.product_id, 'quantidade', v_transfer.quantidade));

    RETURN jsonb_build_object('status', 'rejeitada', 'transfer_id', p_transfer_id);
  END IF;

  IF p_decision <> 'aprovar' THEN
    RAISE EXCEPTION 'Decisão inválida. Use "aprovar" ou "rejeitar".';
  END IF;

  -- APPROVE: consume from CD lots via FEFO
  v_remaining := v_transfer.quantidade;

  FOR v_lote IN
    SELECT id, quantidade, validade, codigo
    FROM lotes
    WHERE product_id = v_transfer.product_id
      AND unidade_id = v_transfer.unidade_origem_id
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

    -- Deduct from CD lot
    UPDATE lotes
    SET quantidade = quantidade - v_deducted,
        status = CASE WHEN (quantidade - v_deducted) <= 0 THEN 'consumido' ELSE status END
    WHERE id = v_lote.id;

    v_lotes_consumed := v_lotes_consumed || jsonb_build_object(
      'lote_id', v_lote.id, 'lote_codigo', v_lote.codigo,
      'validade', v_lote.validade, 'quantidade_consumida', v_deducted);

    -- Create lot in kitchen with preserved expiry
    INSERT INTO lotes (product_id, unidade_id, validade, codigo, quantidade, company_id)
    VALUES (v_transfer.product_id, v_transfer.unidade_destino_id, v_lote.validade,
            COALESCE(v_lote.codigo, '') || '-TR', v_deducted, v_company_id)
    RETURNING id INTO v_new_lote_id;

    v_lotes_created := v_lotes_created || jsonb_build_object(
      'lote_id', v_new_lote_id, 'validade', v_lote.validade, 'quantidade', v_deducted);

    v_remaining := v_remaining - v_deducted;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente no CD. Faltam % unidades.', v_remaining;
  END IF;

  -- Movement: saída no CD
  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (v_transfer.product_id, v_transfer.unidade_origem_id, 'saida', v_transfer.quantidade,
          'Transferência aprovada #' || p_transfer_id::text, v_user_id, v_company_id)
  RETURNING id INTO v_movement_cd_id;

  -- Movement: entrada na cozinha
  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (v_transfer.product_id, v_transfer.unidade_destino_id, 'entrada', v_transfer.quantidade,
          'Transferência recebida #' || p_transfer_id::text, v_user_id, v_company_id)
  RETURNING id INTO v_movement_kitchen_id;

  -- Update global stock (stays same since it's internal transfer, but we track per-unit via lots)
  -- Actually products.estoque_atual is global so no change needed for internal transfers

  -- Update transfer status
  UPDATE transferencias
  SET status = 'aprovada',
      aprovado_por = v_user_id,
      updated_at = now()
  WHERE id = p_transfer_id;

  -- Audit log
  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (v_user_id, v_company_id, v_transfer.unidade_origem_id, 'transferencias', 'approve', p_transfer_id,
    jsonb_build_object(
      'product_id', v_transfer.product_id,
      'quantidade', v_transfer.quantidade,
      'unidade_origem_id', v_transfer.unidade_origem_id,
      'unidade_destino_id', v_transfer.unidade_destino_id,
      'lotes_consumed', v_lotes_consumed,
      'lotes_created', v_lotes_created,
      'movement_cd_id', v_movement_cd_id,
      'movement_kitchen_id', v_movement_kitchen_id
    ));

  RETURN jsonb_build_object(
    'status', 'aprovada',
    'transfer_id', p_transfer_id,
    'lotes_consumed', v_lotes_consumed,
    'lotes_created', v_lotes_created,
    'movement_cd_id', v_movement_cd_id,
    'movement_kitchen_id', v_movement_kitchen_id
  );
END;
$function$;
