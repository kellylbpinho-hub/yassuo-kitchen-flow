
-- Helper function: is_financeiro
CREATE OR REPLACE FUNCTION public.is_financeiro()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'gerente_financeiro'
      AND company_id = public.current_company_id()
  )
$$;

-- Update user_can_manage to EXCLUDE financeiro from write operations
-- (keeping it for SELECT visibility but blocking mutations via specific policies)

-- Update rpc_create_product to block financeiro
CREATE OR REPLACE FUNCTION public.rpc_create_product(p_unidade_id uuid, p_nome text, p_unidade_medida text DEFAULT 'kg'::text, p_category_id uuid DEFAULT NULL::uuid, p_codigo_barras text DEFAULT NULL::text)
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

  -- Block financeiro
  IF is_financeiro() THEN
    RAISE EXCEPTION 'Gerente Financeiro não tem permissão para criar produtos. Acesso somente leitura.';
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

  v_normalized_barcode := normalize_barcode(p_codigo_barras);

  IF v_normalized_barcode IS NOT NULL THEN
    SELECT id INTO v_product_id
    FROM products
    WHERE company_id = v_company_id AND codigo_barras = v_normalized_barcode;

    IF v_product_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'unidade_medida', p.unidade_medida,
        'codigo_barras', p.codigo_barras, 'unidade_id', p.unidade_id,
        'company_id', p.company_id, 'category_id', p.category_id,
        'estoque_atual', p.estoque_atual, 'already_existed', true
      ) INTO v_result FROM products p WHERE p.id = v_product_id;
      RETURN v_result;
    END IF;
  END IF;

  INSERT INTO products (nome, unidade_medida, codigo_barras, unidade_id, company_id, category_id)
  VALUES (trim(p_nome), COALESCE(p_unidade_medida, 'kg'), v_normalized_barcode, p_unidade_id, v_company_id, p_category_id)
  RETURNING id INTO v_product_id;

  SELECT jsonb_build_object(
    'id', p.id, 'nome', p.nome, 'unidade_medida', p.unidade_medida,
    'codigo_barras', p.codigo_barras, 'unidade_id', p.unidade_id,
    'company_id', p.company_id, 'category_id', p.category_id,
    'estoque_atual', p.estoque_atual, 'already_existed', false
  ) INTO v_result FROM products p WHERE p.id = v_product_id;

  RETURN v_result;
END;
$function$;

-- Update rpc_consume_fefo to block financeiro
CREATE OR REPLACE FUNCTION public.rpc_consume_fefo(p_product_id uuid, p_unidade_id uuid, p_quantidade numeric, p_tipo text, p_motivo text DEFAULT NULL::text, p_menu_id uuid DEFAULT NULL::uuid, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    RAISE EXCEPTION 'Gerente Financeiro não tem permissão para registrar movimentações. Acesso somente leitura.';
  END IF;

  IF NOT is_estoquista() THEN
    RAISE EXCEPTION 'Sem permissão para registrar saídas de estoque.';
  END IF;

  IF NOT (p_tipo = ANY(v_valid_types)) THEN
    RAISE EXCEPTION 'Tipo inválido. Use: consumo, desperdicio, saida ou perda.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Produto não encontrado ou não pertence à sua empresa.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM units WHERE id = p_unidade_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada ou não pertence à sua empresa.';
  END IF;

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
      'lote_id', v_lote.id, 'lote_codigo', v_lote.codigo,
      'validade', v_lote.validade, 'quantidade_consumida', v_deducted);

    v_remaining := v_remaining - v_deducted;
  END LOOP;

  INSERT INTO movements (product_id, unidade_id, tipo, quantidade, motivo, user_id, company_id)
  VALUES (p_product_id, p_unidade_id,
    CASE WHEN p_tipo = 'desperdicio' THEN 'perda' ELSE p_tipo END,
    p_quantidade, COALESCE(p_motivo, initcap(p_tipo) || ' via FEFO'),
    v_user_id, v_company_id)
  RETURNING id INTO v_movement_id;

  UPDATE products
  SET estoque_atual = GREATEST(0, estoque_atual - p_quantidade)
  WHERE id = p_product_id
  RETURNING estoque_atual INTO v_novo_estoque;

  IF p_tipo = 'desperdicio' THEN
    INSERT INTO waste_logs (product_id, quantidade, observacao, menu_id, user_id, unidade_id, company_id)
    VALUES (p_product_id, p_quantidade, p_observacao, p_menu_id, v_user_id, p_unidade_id, v_company_id)
    RETURNING id INTO v_waste_id;
  END IF;

  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (v_user_id, v_company_id, p_unidade_id,
    CASE WHEN p_tipo = 'desperdicio' THEN 'desperdicio' ELSE 'estoque' END,
    p_tipo, v_movement_id,
    jsonb_build_object(
      'product_id', p_product_id, 'quantidade', p_quantidade, 'tipo', p_tipo,
      'motivo', p_motivo, 'movement_id', v_movement_id,
      'novo_estoque_atual', v_novo_estoque, 'lotes_consumed', v_lotes_consumed,
      'waste_log_id', v_waste_id));

  RETURN jsonb_build_object(
    'movement_id', v_movement_id, 'novo_estoque_atual', v_novo_estoque,
    'lotes_consumed', v_lotes_consumed, 'waste_log_id', v_waste_id,
    'product_id', p_product_id, 'unidade_id', p_unidade_id);
END;
$function$;

-- Update rpc_receive_digital to block financeiro
CREATE OR REPLACE FUNCTION public.rpc_receive_digital(p_product_id uuid, p_unidade_id uuid, p_validade date, p_lote_codigo text, p_quantidade numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Block financeiro
  IF is_financeiro() THEN
    RAISE EXCEPTION 'Gerente Financeiro não tem permissão para realizar recebimentos. Acesso somente leitura.';
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

  INSERT INTO audit_log (user_id, company_id, unidade_id, tabela, acao, registro_id, dados)
  VALUES (v_user_id, v_company_id, p_unidade_id, 'recebimento_digital', 'create', v_lote_id,
    jsonb_build_object(
      'product_id', p_product_id, 'lote_codigo', trim(p_lote_codigo),
      'validade', p_validade, 'quantidade', p_quantidade,
      'movement_id', v_movement_id, 'novo_estoque_atual', v_novo_estoque));

  RETURN jsonb_build_object(
    'lote_id', v_lote_id, 'movement_id', v_movement_id,
    'novo_estoque_atual', v_novo_estoque, 'product_id', p_product_id,
    'unidade_id', p_unidade_id);
END;
$function$;

-- Update rpc_request_transfer to block financeiro
CREATE OR REPLACE FUNCTION public.rpc_request_transfer(p_product_id uuid, p_unidade_origem_id uuid, p_unidade_destino_id uuid, p_quantidade numeric, p_motivo text DEFAULT NULL::text)
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

  IF NOT is_estoquista() THEN
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

-- Block financeiro from INSERT on purchase_orders  
DROP POLICY IF EXISTS "Create orders in company" ON public.purchase_orders;
CREATE POLICY "Create orders in company" ON public.purchase_orders
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from UPDATE on purchase_orders
DROP POLICY IF EXISTS "Update orders in company" ON public.purchase_orders;
CREATE POLICY "Update orders in company" ON public.purchase_orders
  FOR UPDATE USING (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on purchase_items
DROP POLICY IF EXISTS "Create order items in company" ON public.purchase_items;
CREATE POLICY "Create order items in company" ON public.purchase_items
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND company_id = current_company_id()
    AND EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id))
  );

-- Block financeiro from UPDATE on purchase_items
DROP POLICY IF EXISTS "Update order items in company" ON public.purchase_items;
CREATE POLICY "Update order items in company" ON public.purchase_items
  FOR UPDATE USING (
    NOT is_financeiro()
    AND company_id = current_company_id()
    AND EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id))
  );

-- Block financeiro from DELETE on purchase_items
DROP POLICY IF EXISTS "Delete order items in company" ON public.purchase_items;
CREATE POLICY "Delete order items in company" ON public.purchase_items
  FOR DELETE USING (
    NOT is_financeiro()
    AND company_id = current_company_id()
    AND EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id))
  );

-- Block financeiro from managing categories (the ALL policy already uses user_can_manage which includes financeiro)
-- Replace with explicit non-financeiro check
DROP POLICY IF EXISTS "Manage categories in company" ON public.product_categories;
CREATE POLICY "Manage categories in company" ON public.product_categories
  FOR ALL USING (
    NOT is_financeiro()
    AND user_can_manage()
    AND company_id = current_company_id()
  ) WITH CHECK (
    NOT is_financeiro()
    AND user_can_manage()
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on products
DROP POLICY IF EXISTS "Insert products in company" ON public.products;
CREATE POLICY "Insert products in company" ON public.products
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from UPDATE on products
DROP POLICY IF EXISTS "Update products in company" ON public.products;
CREATE POLICY "Update products in company" ON public.products
  FOR UPDATE USING (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from DELETE on products
DROP POLICY IF EXISTS "Delete products in company" ON public.products;
CREATE POLICY "Delete products in company" ON public.products
  FOR DELETE USING (
    NOT is_financeiro()
    AND (is_ceo() OR user_can_manage())
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on movements
DROP POLICY IF EXISTS "Create movements in company" ON public.movements;
CREATE POLICY "Create movements in company" ON public.movements
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on lotes
DROP POLICY IF EXISTS "Insert lotes in company" ON public.lotes;
CREATE POLICY "Insert lotes in company" ON public.lotes
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from UPDATE on lotes
DROP POLICY IF EXISTS "Update lotes in company" ON public.lotes;
CREATE POLICY "Update lotes in company" ON public.lotes
  FOR UPDATE USING (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on transferencias
DROP POLICY IF EXISTS "Create transferencias in company" ON public.transferencias;
CREATE POLICY "Create transferencias in company" ON public.transferencias
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_origem_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on waste_logs
DROP POLICY IF EXISTS "Create waste logs in company" ON public.waste_logs;
CREATE POLICY "Create waste logs in company" ON public.waste_logs
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from INSERT on menus
DROP POLICY IF EXISTS "Create menus in company" ON public.menus;
CREATE POLICY "Create menus in company" ON public.menus
  FOR INSERT WITH CHECK (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );

-- Block financeiro from UPDATE on menus
DROP POLICY IF EXISTS "Update menus in company" ON public.menus;
CREATE POLICY "Update menus in company" ON public.menus
  FOR UPDATE USING (
    NOT is_financeiro()
    AND user_can_see_unit(unidade_id)
    AND company_id = current_company_id()
  );
