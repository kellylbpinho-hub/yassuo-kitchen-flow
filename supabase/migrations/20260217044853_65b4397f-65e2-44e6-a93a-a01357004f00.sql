
-- Recreate view with security_invoker to use querying user's RLS
DROP VIEW IF EXISTS public.v_estoque_por_unidade;

CREATE VIEW public.v_estoque_por_unidade
WITH (security_invoker = true)
AS
SELECT
  product_id,
  unidade_id,
  company_id,
  SUM(quantidade) AS saldo
FROM public.lotes
WHERE status = 'ativo'
GROUP BY product_id, unidade_id, company_id;

GRANT SELECT ON public.v_estoque_por_unidade TO authenticated;
