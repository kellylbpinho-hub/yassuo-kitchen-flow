
-- Add sequential number to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS numero serial;

-- Add purchase unit fields to purchase_items (nullable for backward compatibility)
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS purchase_unit_id uuid REFERENCES public.product_purchase_units(id);
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS purchase_unit_nome text;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS fator_conversao numeric DEFAULT 1;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS quantidade_estoque numeric;
