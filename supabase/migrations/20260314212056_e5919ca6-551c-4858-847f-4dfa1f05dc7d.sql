
-- Delete and recreate with a known-good approach
DELETE FROM public.user_unidades WHERE user_id = 'b2222222-2222-2222-2222-222222222299';
DELETE FROM public.user_roles WHERE user_id = 'b2222222-2222-2222-2222-222222222299';
DELETE FROM public.profiles WHERE user_id = 'b2222222-2222-2222-2222-222222222299';
DELETE FROM auth.identities WHERE user_id = 'b2222222-2222-2222-2222-222222222299';
DELETE FROM auth.users WHERE id = 'b2222222-2222-2222-2222-222222222299';
