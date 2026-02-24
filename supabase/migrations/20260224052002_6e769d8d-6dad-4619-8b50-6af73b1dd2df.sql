
-- Allow nutricionista to request transfers (not just estoquista roles)
CREATE OR REPLACE FUNCTION public.rpc_request_transfer(
  p_product_id uuid,
  p_unidade_origem_id uuid,
  p_unidade_destino_id uuid,
  p_quantidade numeric,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_origin_type text;
  v_dest_type text;
  v_transfer_id uuid;
  v_user_role text;
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
    RAISE EXCEPTION 'Gerente Financeiro não tem permissão para solicitar transferências. Acesso somente leitura.';
  END IF;

  -- Allow estoquista roles OR nutricionista to request transfers
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = v_user_id AND company_id = v_company_id
  LIMIT 1;

  IF v_user_role IS NULL OR v_user_role NOT IN ('ceo', 'gerente_operacional', 'estoquista', 'nutricionista') THEN
    RAISE EXCEPTION 'Sem permissão para solicitar transferências.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Produto não encontrado ou não pertence à sua empresa.';
  END IF;

  SELECT type INTO v_origin_type
  FROM units WHERE id = p_unidade_origem_id AND company_id = v_company_id;

  IF v_origin_type IS NULL THEN
    RAISE EXCEPTION 'Unidade de origem não encontrada.';
  END IF;

  IF v_origin_type <> 'cd' THEN
    RAISE EXCEPTION 'A unidade de origem deve ser do tipo CD (Centro de Distribuição).';
  END IF;

  SELECT type INTO v_dest_type
  FROM units WHERE id = p_unidade_destino_id AND company_id = v_company_id;

  IF v_dest_type IS NULL THEN
    RAISE EXCEPTION 'Unidade de destino não encontrada.';
  END IF;

  IF v_dest_type <> 'kitchen' THEN
    RAISE EXCEPTION 'A unidade de destino deve ser do tipo Cozinha.';
  END IF;

  IF p_unidade_origem_id = p_unidade_destino_id THEN
    RAISE EXCEPTION 'Origem e destino devem ser diferentes.';
  END IF;

  INSERT INTO transferencias (
    product_id, unidade_origem_id, unidade_destino_id,
    quantidade, solicitado_por, status, company_id
  )
  VALUES (
    p_product_id, p_unidade_origem_id, p_unidade_destino_id,
    p_quantidade, v_user_id, 'pendente', v_company_id
  )
  RETURNING id INTO v_transfer_id;

  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (
    v_user_id, v_company_id, p_unidade_origem_id,
    'transferencias', 'request', v_transfer_id,
    jsonb_build_object(
      'product_id', p_product_id,
      'unidade_origem_id', p_unidade_origem_id,
      'unidade_destino_id', p_unidade_destino_id,
      'quantidade', p_quantidade,
      'motivo', p_motivo));

  RETURN v_transfer_id;
END;
$function$;
