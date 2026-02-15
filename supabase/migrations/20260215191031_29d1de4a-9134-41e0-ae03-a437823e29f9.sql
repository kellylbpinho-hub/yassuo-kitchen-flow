
-- Corrigir policy de audit_log para exigir que user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_log;
CREATE POLICY "Users can insert own audit logs"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
