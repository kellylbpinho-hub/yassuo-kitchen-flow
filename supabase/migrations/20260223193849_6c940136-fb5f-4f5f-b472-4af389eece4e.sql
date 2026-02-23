
-- Update rpc_approve_transfer to block gerente_financeiro
-- Replace user_can_manage() with explicit CEO/gerente_operacional check
CREATE OR REPLACE FUNCTION public.rpc_approve_transfer(p_transfer_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
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

  -- Only CEO and gerente_operacional can approve (gerente_financeiro blocked)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role IN ('ceo', 'gerente_operacional')
      AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar transferências. Apenas CEO e Gerente Operacional.';
  END IF;

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

    UPDATE lotes
    SET quantidade = quantidade - v_deducted,
        status = CASE WHEN (quantidade - v_deducted) <= 0 THEN 'consumido' ELSE status END
    WHERE id = v_lote.id;

    v_lotes_consumed := v_lotes_consumed || jsonb_build_object(
      'lote_id', v_lote.id, 'lote_codigo', v_lote.codigo,
      'validade', v_lote.validade, 'quantidade_consumida', v_deducted);

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

  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (v_transfer.product_id, v_transfer.unidade_origem_id, 'saida', v_transfer.quantidade,
          'Transferência aprovada #' || p_transfer_id::text, v_user_id, v_company_id)
  RETURNING id INTO v_movement_cd_id;

  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (v_transfer.product_id, v_transfer.unidade_destino_id, 'entrada', v_transfer.quantidade,
          'Transferência recebida #' || p_transfer_id::text, v_user_id, v_company_id)
  RETURNING id INTO v_movement_kitchen_id;

  UPDATE transferencias
  SET status = 'aprovada',
      aprovado_por = v_user_id,
      updated_at = now()
  WHERE id = p_transfer_id;

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
