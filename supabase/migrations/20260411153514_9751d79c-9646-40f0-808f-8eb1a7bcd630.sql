-- Add fornecedor_id to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX idx_purchase_orders_fornecedor ON public.purchase_orders(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
