
UPDATE auth.users 
SET encrypted_password = crypt('Teste@123', gen_salt('bf'))
WHERE id = 'b2222222-2222-2222-2222-222222222299';
