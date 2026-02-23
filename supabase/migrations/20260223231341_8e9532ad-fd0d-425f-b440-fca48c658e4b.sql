-- Add ativo column to products
ALTER TABLE public.products ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Create index for filtering active products
CREATE INDEX idx_products_ativo ON public.products (ativo) WHERE ativo = true;