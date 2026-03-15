
CREATE TABLE public.weight_divergence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  peso_informado NUMERIC NOT NULL,
  media_historica NUMERIC NOT NULL,
  percentual_desvio NUMERIC NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  unidade_id UUID NOT NULL REFERENCES public.units(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weight_divergence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO and gerente_operacional can view weight divergence logs"
  ON public.weight_divergence_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_ceo() OR public.has_role(auth.uid(), 'gerente_operacional'))
  );

CREATE POLICY "Authenticated users can insert weight divergence logs"
  ON public.weight_divergence_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.current_company_id());
