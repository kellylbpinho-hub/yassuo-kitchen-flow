
DELETE FROM public.user_unidades WHERE user_id = '8b5344e2-3c38-464e-b672-57321f22aea2';
DELETE FROM public.user_roles WHERE user_id = '8b5344e2-3c38-464e-b672-57321f22aea2';
DELETE FROM public.profiles WHERE user_id = '8b5344e2-3c38-464e-b672-57321f22aea2';
DELETE FROM auth.identities WHERE user_id = '8b5344e2-3c38-464e-b672-57321f22aea2';
DELETE FROM auth.users WHERE id = '8b5344e2-3c38-464e-b672-57321f22aea2';
