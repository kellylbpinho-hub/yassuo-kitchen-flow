
-- Use the GoTrue-compatible password format
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, 
  aud, role, raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'nutri.teste@yassuo.app',
  '$2a$10$' || substr(encode(gen_random_bytes(22), 'base64'), 1, 22) || substr(encode(digest('Teste@123', 'sha256'), 'base64'), 1, 31),
  now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'Nutri Teste', 'email', 'nutri.teste@yassuo.app', 'company_id', 'a0000000-0000-0000-0000-000000000001'),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(), now(), '', ''
);
