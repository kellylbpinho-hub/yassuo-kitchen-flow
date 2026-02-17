
-- Add barcode column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS codigo_barras text;

-- Create unique index per company (same barcode can exist in different companies)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_codigo_barras_company 
ON public.products (codigo_barras, company_id) 
WHERE codigo_barras IS NOT NULL;
