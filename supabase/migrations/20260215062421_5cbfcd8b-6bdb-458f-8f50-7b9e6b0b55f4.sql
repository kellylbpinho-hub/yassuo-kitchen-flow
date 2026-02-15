
-- 1. Create user_unidades (many-to-many user ↔ unit)
CREATE TABLE IF NOT EXISTS public.user_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unidade_id)
);

ALTER TABLE public.user_unidades ENABLE ROW LEVEL SECURITY;

-- RLS for user_unidades
CREATE POLICY "view_user_unidades" ON public.user_unidades
FOR SELECT USING (
  user_id = auth.uid() OR is_ceo() OR public.has_role(auth.uid(), 'gerente_operacional')
);

CREATE POLICY "insert_user_unidades" ON public.user_unidades
FOR INSERT WITH CHECK (
  is_ceo() OR public.has_role(auth.uid(), 'gerente_operacional')
);

CREATE POLICY "delete_user_unidades" ON public.user_unidades
FOR DELETE USING (
  is_ceo() OR public.has_role(auth.uid(), 'gerente_operacional')
);

-- 2. Make units readable by all authenticated
DROP POLICY IF EXISTS "Users can view units they belong to" ON public.units;
CREATE POLICY "Authenticated can view all units" ON public.units
FOR SELECT TO authenticated USING (true);

-- 3. Ensure unique user_id on user_roles for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. Update user_can_see_unit to also check user_unidades
CREATE OR REPLACE FUNCTION public.user_can_see_unit(_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_ceo() OR EXISTS (
    SELECT 1 FROM public.user_unidades
    WHERE user_id = auth.uid() AND unidade_id = _unit_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND unidade_id = _unit_id
  )
$$;

-- 5. Seed existing profile.unidade_id into user_unidades
INSERT INTO public.user_unidades (user_id, unidade_id)
SELECT p.user_id, p.unidade_id FROM public.profiles p
WHERE p.unidade_id IS NOT NULL
ON CONFLICT (user_id, unidade_id) DO NOTHING;
