
-- Update rpc_get_cd_balance to also consider products.estoque_atual
-- when the product's home unit is the CD itself (no lotes scenario)
CREATE OR REPLACE FUNCTION public.rpc_get_cd_balance(p_product_id uuid, p_cd_unit_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_unit_type text;
  v_saldo_lotes numeric;
  v_saldo_produto numeric;
  v_product_unidade_id uuid;
BEGIN
  v_company_id := current_company_id();
  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Verify the unit belongs to the same company and is a CD
  SELECT type INTO v_unit_type
  FROM units
  WHERE id = p_cd_unit_id AND company_id = v_company_id;

  IF v_unit_type IS NULL OR v_unit_type <> 'cd' THEN
    RETURN 0;
  END IF;

  -- Get product info
  SELECT unidade_id, estoque_atual INTO v_product_unidade_id, v_saldo_produto
  FROM products
  WHERE id = p_product_id AND company_id = v_company_id;

  IF v_product_unidade_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Sum active lotes for this product in this CD
  SELECT COALESCE(SUM(quantidade), 0) INTO v_saldo_lotes
  FROM lotes
  WHERE product_id = p_product_id
    AND unidade_id = p_cd_unit_id
    AND company_id = v_company_id
    AND status = 'ativo';

  -- If the product's home unit IS the CD, use the greater of lotes or estoque_atual
  -- This handles legacy data where estoque_atual was set without lotes
  IF v_product_unidade_id = p_cd_unit_id THEN
    RETURN GREATEST(v_saldo_lotes, COALESCE(v_saldo_produto, 0));
  END IF;

  -- For products from other units, only use lotes in the CD
  RETURN v_saldo_lotes;
END;
$$;
