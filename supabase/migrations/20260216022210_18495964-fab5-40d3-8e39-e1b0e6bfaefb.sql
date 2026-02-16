
-- 1) Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2) Insert Yassuo
INSERT INTO public.companies (id, nome, ativo)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Yassuo', true);

-- 3) Add company_id to all business tables with default for backfill
ALTER TABLE public.units ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.user_roles ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.user_unidades ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.products ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.lotes ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.fornecedores ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.product_purchase_units ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.product_fornecedores ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.transferencias ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.purchase_orders ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.purchase_items ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.movements ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.waste_logs ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.menus ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.audit_log ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT 'a0000000-0000-0000-0000-000000000001';

-- 4) Backfill all existing records
UPDATE public.units SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.profiles SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.user_roles SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.user_unidades SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.products SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.lotes SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.fornecedores SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.product_purchase_units SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.product_fornecedores SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.transferencias SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.purchase_orders SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.purchase_items SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.movements SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.waste_logs SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.menus SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.audit_log SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE public.units ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.user_unidades ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.lotes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.fornecedores ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.product_purchase_units ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.product_fornecedores ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.transferencias ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.purchase_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.purchase_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.movements ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.waste_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.menus ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN company_id SET NOT NULL;

-- Remove defaults (company_id should be explicitly set going forward)
ALTER TABLE public.units ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.user_unidades ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.lotes ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.fornecedores ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.product_purchase_units ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.product_fornecedores ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.transferencias ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.purchase_orders ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.purchase_items ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.movements ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.waste_logs ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.menus ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.audit_log ALTER COLUMN company_id DROP DEFAULT;

-- 5) Helper: current_company_id()
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Update user_can_see_unit to also check company_id
CREATE OR REPLACE FUNCTION public.user_can_see_unit(_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units WHERE id = _unit_id AND company_id = public.current_company_id()
  ) AND (
    public.is_ceo() OR EXISTS (
      SELECT 1 FROM public.user_unidades
      WHERE user_id = auth.uid() AND unidade_id = _unit_id
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND unidade_id = _unit_id
    )
  )
$$;

-- Update has_role to scope by company
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND company_id = public.current_company_id()
  )
$$;

-- Update is_ceo scoped by company
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'ceo' AND company_id = public.current_company_id()
  )
$$;

-- Update is_estoquista scoped by company
CREATE OR REPLACE FUNCTION public.is_estoquista()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_operacional', 'estoquista')
      AND company_id = public.current_company_id()
  )
$$;

-- Update is_comprador scoped by company
CREATE OR REPLACE FUNCTION public.is_comprador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_operacional', 'comprador')
      AND company_id = public.current_company_id()
  )
$$;

-- Update user_can_manage scoped by company
CREATE OR REPLACE FUNCTION public.user_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro', 'gerente_operacional')
      AND company_id = public.current_company_id()
  )
$$;

-- Update user_can_approve scoped by company
CREATE OR REPLACE FUNCTION public.user_can_approve()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro')
      AND company_id = public.current_company_id()
  )
$$;

-- Update user_can_see_costs scoped by company
CREATE OR REPLACE FUNCTION public.user_can_see_costs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro')
      AND company_id = public.current_company_id()
  )
$$;

-- Update get_user_role scoped by company
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  LIMIT 1
$$;

-- Update handle_new_user to include company_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, cargo, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'cargo', 'funcionario'),
    COALESCE((NEW.raw_user_meta_data->>'company_id')::uuid, 'a0000000-0000-0000-0000-000000000001')
  );
  RETURN NEW;
END;
$$;

-- 6) RLS Policies

-- companies: only ceo/managers can read
CREATE POLICY "CEO and managers can view companies"
ON public.companies FOR SELECT
USING (is_ceo() OR user_can_manage());

-- Drop and recreate policies that need company_id scoping

-- UNITS
DROP POLICY IF EXISTS "Authenticated can view all units" ON public.units;
CREATE POLICY "Users can view units in their company"
ON public.units FOR SELECT
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only CEO can manage units" ON public.units;
CREATE POLICY "CEO can manage units in their company"
ON public.units FOR ALL
USING (is_ceo() AND company_id = public.current_company_id())
WITH CHECK (is_ceo() AND company_id = public.current_company_id());

-- PROFILES
DROP POLICY IF EXISTS "Users can view profiles in their unit" ON public.profiles;
CREATE POLICY "Users can view profiles in their company"
ON public.profiles FOR SELECT
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can update own profile, managers can update unit profiles" ON public.profiles;
CREATE POLICY "Users can update profiles in their company"
ON public.profiles FOR UPDATE
USING ((user_id = auth.uid() OR is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "CEO and managers can create profiles" ON public.profiles;
CREATE POLICY "CEO and managers can create profiles in their company"
ON public.profiles FOR INSERT
WITH CHECK ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only CEO can delete profiles" ON public.profiles;
CREATE POLICY "CEO can delete profiles in their company"
ON public.profiles FOR DELETE
USING (is_ceo() AND company_id = public.current_company_id());

-- USER_ROLES
DROP POLICY IF EXISTS "CEO and managers can view roles" ON public.user_roles;
CREATE POLICY "View roles in company"
ON public.user_roles FOR SELECT
USING ((is_ceo() OR user_id = auth.uid() OR user_can_manage()) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only CEO and managers can manage roles" ON public.user_roles;
CREATE POLICY "Insert roles in company"
ON public.user_roles FOR INSERT
WITH CHECK ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only CEO can update roles" ON public.user_roles;
CREATE POLICY "CEO can update roles in company"
ON public.user_roles FOR UPDATE
USING (is_ceo() AND company_id = public.current_company_id())
WITH CHECK (is_ceo() AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only CEO can delete roles" ON public.user_roles;
CREATE POLICY "CEO can delete roles in company"
ON public.user_roles FOR DELETE
USING (is_ceo() AND company_id = public.current_company_id());

-- USER_UNIDADES
DROP POLICY IF EXISTS "view_user_unidades" ON public.user_unidades;
CREATE POLICY "View user_unidades in company"
ON public.user_unidades FOR SELECT
USING ((user_id = auth.uid() OR is_ceo() OR has_role(auth.uid(), 'gerente_operacional'::app_role)) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "insert_user_unidades" ON public.user_unidades;
CREATE POLICY "Insert user_unidades in company"
ON public.user_unidades FOR INSERT
WITH CHECK ((is_ceo() OR has_role(auth.uid(), 'gerente_operacional'::app_role)) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "delete_user_unidades" ON public.user_unidades;
CREATE POLICY "Delete user_unidades in company"
ON public.user_unidades FOR DELETE
USING ((is_ceo() OR has_role(auth.uid(), 'gerente_operacional'::app_role)) AND company_id = public.current_company_id());

-- FORNECEDORES
DROP POLICY IF EXISTS "Authenticated can view fornecedores" ON public.fornecedores;
CREATE POLICY "View fornecedores in company"
ON public.fornecedores FOR SELECT
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can manage fornecedores" ON public.fornecedores;
CREATE POLICY "Managers can manage fornecedores in company"
ON public.fornecedores FOR ALL
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id())
WITH CHECK ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

-- PRODUCTS
DROP POLICY IF EXISTS "Users can view products in their unit" ON public.products;
CREATE POLICY "View products in company"
ON public.products FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can manage products" ON public.products;
CREATE POLICY "Insert products in company"
ON public.products FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can update products" ON public.products;
CREATE POLICY "Update products in company"
ON public.products FOR UPDATE
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Only managers can delete products" ON public.products;
CREATE POLICY "Delete products in company"
ON public.products FOR DELETE
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

-- LOTES
DROP POLICY IF EXISTS "Users can view lotes in their unit" ON public.lotes;
CREATE POLICY "View lotes in company"
ON public.lotes FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can insert lotes" ON public.lotes;
CREATE POLICY "Insert lotes in company"
ON public.lotes FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can update lotes" ON public.lotes;
CREATE POLICY "Update lotes in company"
ON public.lotes FOR UPDATE
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

-- PRODUCT_PURCHASE_UNITS
DROP POLICY IF EXISTS "Authenticated can view purchase units" ON public.product_purchase_units;
CREATE POLICY "View purchase units in company"
ON public.product_purchase_units FOR SELECT
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can manage purchase units" ON public.product_purchase_units;
CREATE POLICY "Manage purchase units in company"
ON public.product_purchase_units FOR ALL
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id())
WITH CHECK ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

-- PRODUCT_FORNECEDORES
DROP POLICY IF EXISTS "Authenticated can view product_fornecedores" ON public.product_fornecedores;
CREATE POLICY "View product_fornecedores in company"
ON public.product_fornecedores FOR SELECT
USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can manage product_fornecedores" ON public.product_fornecedores;
CREATE POLICY "Manage product_fornecedores in company"
ON public.product_fornecedores FOR ALL
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id())
WITH CHECK ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

-- TRANSFERENCIAS
DROP POLICY IF EXISTS "Users can view transferencias" ON public.transferencias;
CREATE POLICY "View transferencias in company"
ON public.transferencias FOR SELECT
USING ((user_can_see_unit(unidade_origem_id) OR user_can_see_unit(unidade_destino_id)) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can create transferencias" ON public.transferencias;
CREATE POLICY "Create transferencias in company"
ON public.transferencias FOR INSERT
WITH CHECK (user_can_see_unit(unidade_origem_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can update transferencias" ON public.transferencias;
CREATE POLICY "Update transferencias in company"
ON public.transferencias FOR UPDATE
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS "Users can view orders in their unit" ON public.purchase_orders;
CREATE POLICY "View orders in company"
ON public.purchase_orders FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can create orders" ON public.purchase_orders;
CREATE POLICY "Create orders in company"
ON public.purchase_orders FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Managers can update orders" ON public.purchase_orders;
CREATE POLICY "Update orders in company"
ON public.purchase_orders FOR UPDATE
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

-- PURCHASE_ITEMS (scoped via purchase_orders join)
DROP POLICY IF EXISTS "Users can view order items" ON public.purchase_items;
CREATE POLICY "View order items in company"
ON public.purchase_items FOR SELECT
USING (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id)
));

DROP POLICY IF EXISTS "Users can create order items" ON public.purchase_items;
CREATE POLICY "Create order items in company"
ON public.purchase_items FOR INSERT
WITH CHECK (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id)
));

DROP POLICY IF EXISTS "Users can update order items" ON public.purchase_items;
CREATE POLICY "Update order items in company"
ON public.purchase_items FOR UPDATE
USING (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id)
));

DROP POLICY IF EXISTS "Users can delete order items" ON public.purchase_items;
CREATE POLICY "Delete order items in company"
ON public.purchase_items FOR DELETE
USING (company_id = public.current_company_id() AND EXISTS (
  SELECT 1 FROM purchase_orders po WHERE po.id = purchase_items.purchase_order_id AND user_can_see_unit(po.unidade_id)
));

-- MOVEMENTS
DROP POLICY IF EXISTS "Users can view movements in their unit" ON public.movements;
CREATE POLICY "View movements in company"
ON public.movements FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can create movements" ON public.movements;
CREATE POLICY "Create movements in company"
ON public.movements FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

-- WASTE_LOGS
DROP POLICY IF EXISTS "Users can view waste logs in their unit" ON public.waste_logs;
CREATE POLICY "View waste logs in company"
ON public.waste_logs FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can create waste logs" ON public.waste_logs;
CREATE POLICY "Create waste logs in company"
ON public.waste_logs FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

-- MENUS
DROP POLICY IF EXISTS "Users can view menus in their unit" ON public.menus;
CREATE POLICY "View menus in company"
ON public.menus FOR SELECT
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Nutricionistas and managers can create menus" ON public.menus;
CREATE POLICY "Create menus in company"
ON public.menus FOR INSERT
WITH CHECK (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Nutricionistas and managers can update menus" ON public.menus;
CREATE POLICY "Update menus in company"
ON public.menus FOR UPDATE
USING (user_can_see_unit(unidade_id) AND company_id = public.current_company_id());

-- AUDIT_LOG
DROP POLICY IF EXISTS "Managers can view audit logs" ON public.audit_log;
CREATE POLICY "View audit logs in company"
ON public.audit_log FOR SELECT
USING ((is_ceo() OR user_can_manage()) AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_log;
CREATE POLICY "Insert audit logs in company"
ON public.audit_log FOR INSERT
WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

-- Indexes for performance
CREATE INDEX idx_units_company ON public.units(company_id);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_user_roles_company ON public.user_roles(company_id);
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_fornecedores_company ON public.fornecedores(company_id);
CREATE INDEX idx_lotes_company ON public.lotes(company_id);
CREATE INDEX idx_movements_company ON public.movements(company_id);
CREATE INDEX idx_purchase_orders_company ON public.purchase_orders(company_id);
CREATE INDEX idx_waste_logs_company ON public.waste_logs(company_id);
