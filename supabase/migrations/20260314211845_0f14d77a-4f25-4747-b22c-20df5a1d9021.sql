
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'b2222222-2222-2222-2222-222222222299',
  '00000000-0000-0000-0000-000000000000',
  'nutri.teste@yassuo.app',
  crypt('Teste@123', gen_salt('bf')),
  now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'Nutri Teste', 'email', 'nutri.teste@yassuo.app', 'company_id', 'a0000000-0000-0000-0000-000000000001'),
  now(), now(), '', ''
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  'b2222222-2222-2222-2222-222222222299',
  'b2222222-2222-2222-2222-222222222299',
  jsonb_build_object('sub', 'b2222222-2222-2222-2222-222222222299', 'email', 'nutri.teste@yassuo.app'),
  'email', 'b2222222-2222-2222-2222-222222222299', now(), now(), now()
);
