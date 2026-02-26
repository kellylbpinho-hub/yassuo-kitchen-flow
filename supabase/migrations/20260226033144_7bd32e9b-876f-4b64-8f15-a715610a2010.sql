
-- =============================================
-- FASE 1: Ficha Técnica + Desperdício + Colaboradores
-- =============================================

-- 1. Tabela recipe_ingredients (Ficha Técnica: vincula menus a products)
CREATE TABLE public.recipe_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  peso_limpo_per_capita numeric NOT NULL DEFAULT 0,
  fator_correcao numeric NOT NULL DEFAULT 1,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_id, product_id)
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recipe_ingredients in company"
  ON public.recipe_ingredients FOR SELECT
  USING (company_id = current_company_id());

CREATE POLICY "Create recipe_ingredients in company"
  ON public.recipe_ingredients FOR INSERT
  WITH CHECK (
    NOT is_financeiro()
    AND company_id = current_company_id()
  );

CREATE POLICY "Update recipe_ingredients in company"
  ON public.recipe_ingredients FOR UPDATE
  USING (
    NOT is_financeiro()
    AND company_id = current_company_id()
  );

CREATE POLICY "Delete recipe_ingredients in company"
  ON public.recipe_ingredients FOR DELETE
  USING (
    NOT is_financeiro()
    AND company_id = current_company_id()
  );

-- 2. Ajustar waste_logs: adicionar 2 pesagens
ALTER TABLE public.waste_logs
  ADD COLUMN sobra_limpa_rampa numeric NOT NULL DEFAULT 0,
  ADD COLUMN desperdicio_total_organico numeric NOT NULL DEFAULT 0;

-- 3. Adicionar numero_colaboradores em units
ALTER TABLE public.units
  ADD COLUMN numero_colaboradores integer NOT NULL DEFAULT 0;
