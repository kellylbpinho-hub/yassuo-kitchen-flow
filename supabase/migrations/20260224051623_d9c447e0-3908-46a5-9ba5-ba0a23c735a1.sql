
-- Fix: Allow all company users to SELECT products (catalog is not sensitive)
-- The unit-based restriction blocks Nutri from seeing CD products needed for transfer requests
DROP POLICY IF EXISTS "View products in company" ON public.products;

CREATE POLICY "View products in company"
ON public.products
FOR SELECT
USING (company_id = current_company_id());
