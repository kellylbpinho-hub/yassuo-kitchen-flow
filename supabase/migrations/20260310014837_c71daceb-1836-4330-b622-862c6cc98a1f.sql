
-- 1. Categorias de prato
CREATE TABLE public.dish_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View dish_categories in company" ON public.dish_categories
  FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Manage dish_categories in company" ON public.dish_categories
  FOR ALL TO authenticated
  USING (NOT is_financeiro() AND company_id = current_company_id())
  WITH CHECK (NOT is_financeiro() AND company_id = current_company_id());

-- 2. Pratos
CREATE TABLE public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  category_id uuid REFERENCES public.dish_categories(id),
  is_padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View dishes in company" ON public.dishes
  FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Insert dishes in company" ON public.dishes
  FOR INSERT TO authenticated
  WITH CHECK (NOT is_financeiro() AND company_id = current_company_id());

CREATE POLICY "Update dishes in company" ON public.dishes
  FOR UPDATE TO authenticated
  USING (NOT is_financeiro() AND company_id = current_company_id());

CREATE POLICY "Delete dishes in company" ON public.dishes
  FOR DELETE TO authenticated
  USING ((is_ceo() OR user_can_manage()) AND company_id = current_company_id());

-- 3. Pivot: menu ↔ prato
CREATE TABLE public.menu_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id),
  ordem integer NOT NULL DEFAULT 0,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View menu_dishes in company" ON public.menu_dishes
  FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Insert menu_dishes in company" ON public.menu_dishes
  FOR INSERT TO authenticated
  WITH CHECK (NOT is_financeiro() AND company_id = current_company_id());

CREATE POLICY "Update menu_dishes in company" ON public.menu_dishes
  FOR UPDATE TO authenticated
  USING (NOT is_financeiro() AND company_id = current_company_id());

CREATE POLICY "Delete menu_dishes in company" ON public.menu_dishes
  FOR DELETE TO authenticated
  USING (NOT is_financeiro() AND company_id = current_company_id());
