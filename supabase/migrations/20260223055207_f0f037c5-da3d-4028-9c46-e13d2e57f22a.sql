
-- Fix search path warning for normalize_barcode
CREATE OR REPLACE FUNCTION public.normalize_barcode(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(regexp_replace(trim(COALESCE(raw, '')), '[^0-9]', '', 'g'), '')
$$;
