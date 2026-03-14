
UPDATE public.profiles 
SET cargo = 'nutricionista', unidade_id = '01c7a621-2cf2-4832-9c3d-7b1e0e0363d9', full_name = 'Nutri Teste'
WHERE user_id = 'b2222222-2222-2222-2222-222222222299';

INSERT INTO public.user_roles (user_id, role, company_id)
VALUES ('b2222222-2222-2222-2222-222222222299', 'nutricionista', 'a0000000-0000-0000-0000-000000000001');

INSERT INTO public.user_unidades (user_id, unidade_id, company_id)
VALUES ('b2222222-2222-2222-2222-222222222299', '01c7a621-2cf2-4832-9c3d-7b1e0e0363d9', 'a0000000-0000-0000-0000-000000000001');
