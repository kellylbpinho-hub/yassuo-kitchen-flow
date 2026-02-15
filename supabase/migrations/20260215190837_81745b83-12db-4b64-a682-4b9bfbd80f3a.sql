
-- Fase 1A: Adicionar novos cargos ao enum (separado)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'estoquista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comprador';
