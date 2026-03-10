
CREATE TABLE public.unit_product_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bloqueado',
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (unit_id, product_id)
);

ALTER TABLE public.unit_product_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View unit_product_rules in company"
  ON public.unit_product_rules
  FOR SELECT
  TO public
  USING (company_id = current_company_id());

CREATE POLICY "Manage unit_product_rules in company"
  ON public.unit_product_rules
  FOR ALL
  TO public
  USING (
    (is_ceo() OR has_role(auth.uid(), 'gerente_operacional'::app_role))
    AND company_id = current_company_id()
  )
  WITH CHECK (
    (is_ceo() OR has_role(auth.uid(), 'gerente_operacional'::app_role))
    AND company_id = current_company_id()
  );
