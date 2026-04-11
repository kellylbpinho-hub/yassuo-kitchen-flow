-- Restrict fornecedores read access to managers only
DROP POLICY IF EXISTS "View fornecedores in company" ON public.fornecedores;

CREATE POLICY "View fornecedores in company" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.user_can_manage()
  );