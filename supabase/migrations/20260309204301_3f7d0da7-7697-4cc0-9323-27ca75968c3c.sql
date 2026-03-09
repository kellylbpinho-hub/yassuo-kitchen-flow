
-- Add sobra_prato column to waste_logs
ALTER TABLE public.waste_logs ADD COLUMN sobra_prato numeric NOT NULL DEFAULT 0;

-- Add UPDATE RLS policy on waste_logs so the app can update weighing fields
CREATE POLICY "Update waste logs in company"
ON public.waste_logs
FOR UPDATE
TO authenticated
USING ((NOT is_financeiro()) AND user_can_see_unit(unidade_id) AND (company_id = current_company_id()))
WITH CHECK ((NOT is_financeiro()) AND user_can_see_unit(unidade_id) AND (company_id = current_company_id()));
