
-- 1) Create product_categories table
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Unique constraint per company (case-insensitive)
CREATE UNIQUE INDEX product_categories_company_name_unique ON public.product_categories (company_id, lower(name));

-- 3) Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies
CREATE POLICY "View categories in company"
  ON public.product_categories FOR SELECT
  USING (company_id = current_company_id());

CREATE POLICY "Manage categories in company"
  ON public.product_categories FOR ALL
  USING (user_can_manage() AND company_id = current_company_id())
  WITH CHECK (user_can_manage() AND company_id = current_company_id());

-- 5) Add category_id to products
ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id);

-- 6) Seed categories for Yassuo
INSERT INTO public.product_categories (company_id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Padaria'),
  ('a0000000-0000-0000-0000-000000000001', 'Grãos'),
  ('a0000000-0000-0000-0000-000000000001', 'Carnes'),
  ('a0000000-0000-0000-0000-000000000001', 'Hortifruti'),
  ('a0000000-0000-0000-0000-000000000001', 'Laticínios'),
  ('a0000000-0000-0000-0000-000000000001', 'Bebidas'),
  ('a0000000-0000-0000-0000-000000000001', 'Limpeza');
