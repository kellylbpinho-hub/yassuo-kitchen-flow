-- Update rpc_create_product to check only active products for barcode duplicate
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
    -- Check for existing ACTIVE product with same barcode
    SELECT id INTO v_product_id
    FROM products
    WHERE company_id = v_company_id AND codigo_barras = v_normalized_barcode AND ativo = true;

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

  INSERT INTO products (nome, unidade_medida, codigo_barras, unidade_id, company_id, category_id, ativo)
  VALUES (trim(p_nome), COALESCE(p_unidade_medida, 'kg'), v_normalized_barcode, p_unidade_id, v_company_id, p_category_id, true)
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