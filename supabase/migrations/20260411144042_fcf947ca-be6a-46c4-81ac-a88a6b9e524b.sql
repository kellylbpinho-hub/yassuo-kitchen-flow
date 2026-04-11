-- Fix privilege escalation: only CEOs can assign the CEO role
DROP POLICY IF EXISTS "Insert roles in company" ON public.user_roles;

CREATE POLICY "Insert roles in company" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.user_can_manage()
    AND (
      role <> 'ceo' OR public.is_ceo()
    )
  );