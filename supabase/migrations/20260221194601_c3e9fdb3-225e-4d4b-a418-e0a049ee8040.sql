
CREATE OR REPLACE FUNCTION public.rpc_ensure_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_company_id uuid;
  v_profile jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Check if profile already exists
  SELECT jsonb_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'full_name', p.full_name,
    'email', p.email,
    'cargo', p.cargo,
    'unidade_id', p.unidade_id,
    'avatar_url', p.avatar_url,
    'ativo', p.ativo,
    'company_id', p.company_id
  ) INTO v_profile
  FROM profiles p
  WHERE p.user_id = v_user_id;

  IF v_profile IS NOT NULL THEN
    RETURN v_profile;
  END IF;

  -- Profile doesn't exist, try to find company from user_roles
  SELECT ur.company_id INTO v_company_id
  FROM user_roles ur
  WHERE ur.user_id = v_user_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada. Contate o administrador.';
  END IF;

  -- Get user info from auth
  SELECT 
    COALESCE(raw_user_meta_data->>'email', email),
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO v_email, v_full_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Create profile
  INSERT INTO profiles (user_id, email, full_name, cargo, company_id, ativo)
  VALUES (v_user_id, v_email, v_full_name, 'funcionario', v_company_id, true);

  -- Return the newly created profile
  SELECT jsonb_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'full_name', p.full_name,
    'email', p.email,
    'cargo', p.cargo,
    'unidade_id', p.unidade_id,
    'avatar_url', p.avatar_url,
    'ativo', p.ativo,
    'company_id', p.company_id
  ) INTO v_profile
  FROM profiles p
  WHERE p.user_id = v_user_id;

  RETURN v_profile;
END;
$$;
