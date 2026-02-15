
-- Fase 1B: Tabelas, lotes, fornecedores, transferências, audit_log

-- 1. Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  contato text,
  telefone text,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view fornecedores"
  ON public.fornecedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage fornecedores"
  ON public.fornecedores FOR ALL TO authenticated
  USING (public.is_ceo() OR public.user_can_manage())
  WITH CHECK (public.is_ceo() OR public.user_can_manage());

-- 2. Unidades de compra por produto
CREATE TABLE IF NOT EXISTS public.product_purchase_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  nome text NOT NULL,
  fator_conversao numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_purchase_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view purchase units"
  ON public.product_purchase_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage purchase units"
  ON public.product_purchase_units FOR ALL TO authenticated
  USING (public.is_ceo() OR public.user_can_manage())
  WITH CHECK (public.is_ceo() OR public.user_can_manage());

-- 3. Vínculo produto-fornecedor
CREATE TABLE IF NOT EXISTS public.product_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  preco_referencia numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, fornecedor_id)
);
ALTER TABLE public.product_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view product_fornecedores"
  ON public.product_fornecedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage product_fornecedores"
  ON public.product_fornecedores FOR ALL TO authenticated
  USING (public.is_ceo() OR public.user_can_manage())
  WITH CHECK (public.is_ceo() OR public.user_can_manage());

-- 4. Novos campos em products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS validade_minima_dias integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS proteina_por_100g numeric DEFAULT NULL;

-- 5. Lotes
CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.units(id),
  codigo text,
  quantidade numeric NOT NULL DEFAULT 0,
  validade date NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'quarentena', 'vencido', 'consumido')),
  recebido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lotes in their unit"
  ON public.lotes FOR SELECT TO authenticated USING (public.user_can_see_unit(unidade_id));

CREATE POLICY "Users can insert lotes"
  ON public.lotes FOR INSERT TO authenticated WITH CHECK (public.user_can_see_unit(unidade_id));

CREATE POLICY "Users can update lotes"
  ON public.lotes FOR UPDATE TO authenticated USING (public.user_can_see_unit(unidade_id));

CREATE TRIGGER update_lotes_updated_at
  BEFORE UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  acao text NOT NULL,
  tabela text NOT NULL,
  registro_id uuid,
  dados jsonb,
  unidade_id uuid REFERENCES public.units(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view audit logs"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_ceo() OR public.user_can_manage());

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Transferências
CREATE TABLE IF NOT EXISTS public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  lote_id uuid REFERENCES public.lotes(id),
  unidade_origem_id uuid NOT NULL REFERENCES public.units(id),
  unidade_destino_id uuid NOT NULL REFERENCES public.units(id),
  quantidade numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'executada')),
  solicitado_por uuid NOT NULL,
  aprovado_por uuid,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transferencias"
  ON public.transferencias FOR SELECT TO authenticated
  USING (public.user_can_see_unit(unidade_origem_id) OR public.user_can_see_unit(unidade_destino_id));

CREATE POLICY "Users can create transferencias"
  ON public.transferencias FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_unit(unidade_origem_id));

CREATE POLICY "Managers can update transferencias"
  ON public.transferencias FOR UPDATE TO authenticated
  USING (public.is_ceo() OR public.user_can_manage());

CREATE TRIGGER update_transferencias_updated_at
  BEFORE UPDATE ON public.transferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Funções auxiliares para novos cargos
CREATE OR REPLACE FUNCTION public.is_estoquista()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_operacional', 'estoquista')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_comprador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('ceo', 'gerente_operacional', 'comprador')
  )
$$;
