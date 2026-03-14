UPDATE auth.users 
SET encrypted_password = extensions.crypt('Teste@123', extensions.gen_salt('bf'))
WHERE email = 'karen.financeiro@yassuo.com';