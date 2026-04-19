-- 1. Add traceability flag to lotes
ALTER TABLE public.lotes
ADD COLUMN IF NOT EXISTS entrada_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lotes.entrada_manual IS 'TRUE quando o lote foi criado via entrada manual no Estoque (não via Recebimento Digital).';

-- 2. RPC for manual stock entry
CREATE OR REPLACE FUNCTION public.rpc_create_manual_lote(
  p_product_id uuid,
  p_unidade_id uuid,
  p_quantidade numeric,
  p_validade date,
  p_lote_codigo text DEFAULT NULL,
  p_fornecedor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_user_role text;
  v_product_company uuid;
  v_unit_company uuid;
  v_lote_id uuid;
  v_movement_id uuid;
  v_novo_estoque numeric;
  v_codigo_final text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não encontrada.';
  END IF;

  -- Block financeiro
  IF is_financeiro() THEN
    RAISE EXCEPTION 'Gerente Financeiro não tem permissão para criar lotes. Acesso somente leitura.';
  END IF;

  -- Allow CEO, gerente_operacional, estoquista, comprador
  SELECT role::text INTO v_user_role
  FROM public.user_roles
  WHERE user_id = v_user_id AND company_id = v_company_id
  LIMIT 1;

  IF v_user_role IS NULL OR v_user_role NOT IN ('ceo', 'gerente_operacional', 'estoquista', 'comprador') THEN
    RAISE EXCEPTION 'Sem permissão para registrar entrada manual de estoque.';
  END IF;

  -- Validations
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF p_validade IS NULL THEN
    RAISE EXCEPTION 'Data de validade é obrigatória.';
  END IF;

  SELECT company_id INTO v_product_company FROM products WHERE id = p_product_id;
  IF v_product_company IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;
  IF v_product_company <> v_company_id THEN
    RAISE EXCEPTION 'Produto não pertence à sua empresa.';
  END IF;

  SELECT company_id INTO v_unit_company FROM units WHERE id = p_unidade_id;
  IF v_unit_company IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada.';
  END IF;
  IF v_unit_company <> v_company_id THEN
    RAISE EXCEPTION 'Unidade não pertence à sua empresa.';
  END IF;

  -- Auto-generate lote code if empty
  v_codigo_final := NULLIF(trim(COALESCE(p_lote_codigo, '')), '');
  IF v_codigo_final IS NULL THEN
    v_codigo_final := 'MAN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  -- Create lote with entrada_manual flag
  INSERT INTO lotes (product_id, unidade_id, validade, codigo, quantidade, company_id, entrada_manual)
  VALUES (p_product_id, p_unidade_id, p_validade, v_codigo_final, p_quantidade, v_company_id, true)
  RETURNING id INTO v_lote_id;

  -- Register movement
  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (p_product_id, p_unidade_id, 'entrada', p_quantidade,
          'Entrada manual - Lote: ' || v_codigo_final, v_user_id, v_company_id)
  RETURNING id INTO v_movement_id;

  -- Update product stock
  UPDATE products
  SET estoque_atual = estoque_atual + p_quantidade
  WHERE id = p_product_id
  RETURNING estoque_atual INTO v_novo_estoque;

  -- Audit log
  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (v_user_id, v_company_id, p_unidade_id, 'lotes', 'manual_entry', v_lote_id,
    jsonb_build_object(
      'product_id', p_product_id,
      'lote_codigo', v_codigo_final,
      'validade', p_validade,
      'quantidade', p_quantidade,
      'fornecedor_id', p_fornecedor_id,
      'movement_id', v_movement_id,
      'novo_estoque_atual', v_novo_estoque,
      'entrada_manual', true
    ));

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'movement_id', v_movement_id,
    'novo_estoque_atual', v_novo_estoque,
    'lote_codigo', v_codigo_final,
    'product_id', p_product_id,
    'unidade_id', p_unidade_id
  );
END;
$function$;