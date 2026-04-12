
-- Create invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  cargo app_role NOT NULL,
  unidade_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  used_by uuid,
  status text NOT NULL DEFAULT 'pendente',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Managers can create invitations in their company
CREATE POLICY "Managers can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  (is_ceo() OR has_role(auth.uid(), 'gerente_operacional'))
  AND company_id = current_company_id()
);

-- Managers can view invitations in their company
CREATE POLICY "Managers can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  (is_ceo() OR has_role(auth.uid(), 'gerente_operacional'))
  AND company_id = current_company_id()
);

-- Managers can update invitations (e.g., cancel)
CREATE POLICY "Managers can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  (is_ceo() OR has_role(auth.uid(), 'gerente_operacional'))
  AND company_id = current_company_id()
);

-- Public read by token (for the invite page, via edge function - no RLS needed since edge function uses service role)

-- Add updated_at trigger
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
