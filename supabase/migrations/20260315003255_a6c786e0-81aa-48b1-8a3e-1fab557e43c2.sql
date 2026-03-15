
-- Create internal_orders table
CREATE TABLE public.internal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial NOT NULL,
  unidade_origem_id uuid NOT NULL REFERENCES public.units(id),
  unidade_destino_id uuid NOT NULL REFERENCES public.units(id),
  solicitado_por uuid NOT NULL,
  observacao text,
  status text NOT NULL DEFAULT 'pendente',
  aprovado_por uuid,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create internal_order_items table
CREATE TABLE public.internal_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.internal_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantidade numeric NOT NULL,
  quantidade_aprovada numeric,
  status text NOT NULL DEFAULT 'pendente',
  observacao text,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_items ENABLE ROW LEVEL SECURITY;

-- RLS for internal_orders
CREATE POLICY "View internal_orders in company" ON public.internal_orders
  FOR SELECT TO public
  USING (
    (user_can_see_unit(unidade_origem_id) OR user_can_see_unit(unidade_destino_id))
    AND company_id = current_company_id()
  );

CREATE POLICY "Create internal_orders in company" ON public.internal_orders
  FOR INSERT TO public
  WITH CHECK (
    NOT is_financeiro()
    AND company_id = current_company_id()
  );

CREATE POLICY "Update internal_orders in company" ON public.internal_orders
  FOR UPDATE TO public
  USING (
    (is_ceo() OR user_can_manage())
    AND company_id = current_company_id()
  );

-- RLS for internal_order_items
CREATE POLICY "View internal_order_items in company" ON public.internal_order_items
  FOR SELECT TO public
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.internal_orders o
      WHERE o.id = internal_order_items.order_id
      AND (user_can_see_unit(o.unidade_origem_id) OR user_can_see_unit(o.unidade_destino_id))
    )
  );

CREATE POLICY "Create internal_order_items in company" ON public.internal_order_items
  FOR INSERT TO public
  WITH CHECK (
    NOT is_financeiro()
    AND company_id = current_company_id()
  );

CREATE POLICY "Update internal_order_items in company" ON public.internal_order_items
  FOR UPDATE TO public
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.internal_orders o
      WHERE o.id = internal_order_items.order_id
      AND (is_ceo() OR user_can_manage())
    )
  );

CREATE POLICY "Delete internal_order_items in company" ON public.internal_order_items
  FOR DELETE TO public
  USING (
    NOT is_financeiro()
    AND company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.internal_orders o
      WHERE o.id = internal_order_items.order_id
      AND o.status = 'pendente'
    )
  );

-- Enable realtime for internal_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_orders;
