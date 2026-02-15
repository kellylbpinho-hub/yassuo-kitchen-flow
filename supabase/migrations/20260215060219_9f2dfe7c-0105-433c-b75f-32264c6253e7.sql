
-- Role enum
CREATE TYPE public.app_role AS ENUM ('ceo', 'gerente_financeiro', 'gerente_operacional', 'nutricionista', 'funcionario');

-- Units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'industria', -- 'cd' or 'industria'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'funcionario',
  unidade_id UUID REFERENCES public.units(id),
  avatar_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'kg', -- kg, L, un, caixa, fardo
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC DEFAULT 0,
  validade DATE,
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Movements table
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- entrada, saida, consumo, ajuste, perda
  quantidade NUMERIC NOT NULL,
  motivo TEXT, -- obrigatório para ajuste
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, enviado, aprovado, recebido
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Purchase items
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantidade NUMERIC NOT NULL,
  custo_unitario NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Menus (cardápios)
CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  descricao TEXT,
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- Waste logs (desperdício)
CREATE TABLE public.waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES public.menus(id),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantidade NUMERIC NOT NULL,
  observacao TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

-- ========== SECURITY DEFINER FUNCTIONS ==========

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'ceo'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_unit_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade_id FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_unit(_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_ceo() OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND unidade_id = _unit_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro', 'gerente_operacional')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_approve()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_costs()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_financeiro')
  )
$$;

-- ========== RLS POLICIES ==========

-- units
CREATE POLICY "Users can view units they belong to" ON public.units FOR SELECT TO authenticated
  USING (public.is_ceo() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND unidade_id = units.id));
CREATE POLICY "Only CEO can manage units" ON public.units FOR ALL TO authenticated
  USING (public.is_ceo()) WITH CHECK (public.is_ceo());

-- user_roles
CREATE POLICY "CEO and managers can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_ceo() OR user_id = auth.uid() OR public.user_can_manage());
CREATE POLICY "Only CEO and managers can manage roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo() OR public.user_can_manage());
CREATE POLICY "Only CEO can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_ceo()) WITH CHECK (public.is_ceo());
CREATE POLICY "Only CEO can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_ceo());

-- profiles
CREATE POLICY "Users can view profiles in their unit" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_ceo() OR user_id = auth.uid() OR public.user_can_see_unit(unidade_id));
CREATE POLICY "CEO and managers can create profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo() OR public.user_can_manage());
CREATE POLICY "Users can update own profile, managers can update unit profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_ceo() OR public.user_can_manage());
CREATE POLICY "Only CEO can delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_ceo());

-- products
CREATE POLICY "Users can view products in their unit" ON public.products FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Managers can manage products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_id));
CREATE POLICY "Managers can update products" ON public.products FOR UPDATE TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Only managers can delete products" ON public.products FOR DELETE TO authenticated
  USING (public.is_ceo() OR public.user_can_manage());

-- movements
CREATE POLICY "Users can view movements in their unit" ON public.movements FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Users can create movements" ON public.movements FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_id));

-- purchase_orders
CREATE POLICY "Users can view orders in their unit" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Users can create orders" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_id));
CREATE POLICY "Managers can update orders" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.user_can_see_unit(unidade_id));

-- purchase_items
CREATE POLICY "Users can view order items" ON public.purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_can_see_unit(po.unidade_id)));
CREATE POLICY "Users can create order items" ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_can_see_unit(po.unidade_id)));
CREATE POLICY "Users can update order items" ON public.purchase_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_can_see_unit(po.unidade_id)));
CREATE POLICY "Users can delete order items" ON public.purchase_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_can_see_unit(po.unidade_id)));

-- menus
CREATE POLICY "Users can view menus in their unit" ON public.menus FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Nutricionistas and managers can create menus" ON public.menus FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_id));
CREATE POLICY "Nutricionistas and managers can update menus" ON public.menus FOR UPDATE TO authenticated
  USING (public.user_can_see_unit(unidade_id));

-- waste_logs
CREATE POLICY "Users can view waste logs in their unit" ON public.waste_logs FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_id));
CREATE POLICY "Users can create waste logs" ON public.waste_logs FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_id));

-- ========== TRIGGER for updated_at ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'cargo', 'funcionario')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
