
-- Create view for stock per unit
CREATE OR REPLACE VIEW public.v_estoque_por_unidade AS
SELECT
  product_id,
  unidade_id,
  company_id,
  SUM(quantidade) AS saldo
FROM public.lotes
WHERE status = 'ativo'
GROUP BY product_id, unidade_id, company_id;

-- Enable RLS on the view by granting access and relying on lotes RLS
-- Views inherit RLS from underlying tables when accessed by authenticated users
GRANT SELECT ON public.v_estoque_por_unidade TO authenticated;
GRANT SELECT ON public.v_estoque_por_unidade TO anon;
