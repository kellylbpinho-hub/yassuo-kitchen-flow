
-- Quotation requests table
CREATE TABLE public.quotation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid NOT NULL,
  observacao text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_requests_token ON public.quotation_requests(token);
CREATE INDEX idx_quotation_requests_company ON public.quotation_requests(company_id);
CREATE INDEX idx_quotation_requests_fornecedor ON public.quotation_requests(fornecedor_id);

-- Quotation items table
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotation_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  product_id uuid REFERENCES public.products(id),
  nome_produto text NOT NULL,
  unidade_medida text NOT NULL DEFAULT 'kg',
  quantidade numeric NOT NULL DEFAULT 0,
  preco_unitario numeric,
  observacao_fornecedor text,
  adicionado_pelo_fornecedor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);

-- RLS: View quotations in company (CEO, managers, compradores)
CREATE POLICY "View quotations in company"
ON public.quotation_requests
FOR SELECT
TO authenticated
USING (company_id = current_company_id());

-- RLS: Create quotations (not financeiro)
CREATE POLICY "Create quotations in company"
ON public.quotation_requests
FOR INSERT
TO authenticated
WITH CHECK (NOT is_financeiro() AND company_id = current_company_id());

-- RLS: Update quotations (not financeiro)
CREATE POLICY "Update quotations in company"
ON public.quotation_requests
FOR UPDATE
TO authenticated
USING (NOT is_financeiro() AND company_id = current_company_id());

-- RLS: View quotation items in company
CREATE POLICY "View quotation items in company"
ON public.quotation_items
FOR SELECT
TO authenticated
USING (company_id = current_company_id());

-- RLS: Create quotation items (not financeiro)
CREATE POLICY "Create quotation items in company"
ON public.quotation_items
FOR INSERT
TO authenticated
WITH CHECK (NOT is_financeiro() AND company_id = current_company_id());

-- RLS: Update quotation items (not financeiro, only non-price fields for comprador)
CREATE POLICY "Update quotation items in company"
ON public.quotation_items
FOR UPDATE
TO authenticated
USING (NOT is_financeiro() AND company_id = current_company_id());

-- RLS: Delete quotation items (not financeiro)
CREATE POLICY "Delete quotation items in company"
ON public.quotation_items
FOR DELETE
TO authenticated
USING (NOT is_financeiro() AND company_id = current_company_id());

-- Updated at trigger
CREATE TRIGGER update_quotation_requests_updated_at
BEFORE UPDATE ON public.quotation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
