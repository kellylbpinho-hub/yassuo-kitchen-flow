
-- Update existing type values from 'industria' to 'kitchen'
UPDATE public.units SET type = 'kitchen' WHERE type = 'industria';

-- Change default to 'kitchen'
ALTER TABLE public.units ALTER COLUMN type SET DEFAULT 'kitchen';

-- Add check constraint for allowed values
ALTER TABLE public.units ADD CONSTRAINT units_type_check CHECK (type IN ('cd', 'kitchen'));

-- Insert CD unit for Yassuo company
INSERT INTO public.units (name, type, company_id)
VALUES ('CD - Depósito Central', 'cd', 'a0000000-0000-0000-0000-000000000001');
