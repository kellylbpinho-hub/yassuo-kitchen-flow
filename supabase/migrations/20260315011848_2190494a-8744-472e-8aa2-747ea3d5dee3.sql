
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS modo_preparo text,
  ADD COLUMN IF NOT EXISTS tempo_preparo text,
  ADD COLUMN IF NOT EXISTS equipamento text,
  ADD COLUMN IF NOT EXISTS peso_porcao numeric;
