
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
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_product_id uuid;
  v_result jsonb;
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

  -- Validate unit belongs to company
  IF NOT EXISTS (SELECT 1 FROM units WHERE id = p_unidade_id AND company_id = v_company_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada ou não pertence à sua empresa.';
  END IF;

  -- Validate category if provided
  IF p_category_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM product_categories WHERE id = p_category_id AND company_id = v_company_id) THEN
      RAISE EXCEPTION 'Categoria não encontrada ou não pertence à sua empresa.';
    END IF;
  END IF;

  INSERT INTO products (nome, unidade_medida, codigo_barras, unidade_id, company_id, category_id)
  VALUES (trim(p_nome), COALESCE(p_unidade_medida, 'kg'), NULLIF(trim(COALESCE(p_codigo_barras, '')), ''), p_unidade_id, v_company_id, p_category_id)
  RETURNING id INTO v_product_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'unidade_medida', p.unidade_medida,
    'codigo_barras', p.codigo_barras,
    'unidade_id', p.unidade_id,
    'company_id', p.company_id,
    'category_id', p.category_id,
    'estoque_atual', p.estoque_atual
  ) INTO v_result
  FROM products p WHERE p.id = v_product_id;

  RETURN v_result;
END;
$$;
