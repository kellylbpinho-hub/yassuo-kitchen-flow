
CREATE OR REPLACE FUNCTION public.rpc_get_cd_balance(p_product_id uuid, p_cd_unit_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_unit_type text;
  v_saldo numeric;
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

  -- Verify product belongs to same company
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND company_id = v_company_id) THEN
    RETURN 0;
  END IF;

  -- Sum active lotes for this product in this CD
  SELECT COALESCE(SUM(quantidade), 0) INTO v_saldo
  FROM lotes
  WHERE product_id = p_product_id
    AND unidade_id = p_cd_unit_id
    AND company_id = v_company_id
    AND status = 'ativo';

  RETURN v_saldo;
END;
$$;
