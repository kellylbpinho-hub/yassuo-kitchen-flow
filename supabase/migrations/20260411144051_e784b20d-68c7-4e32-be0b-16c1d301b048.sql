-- Ensure single profile per user to make current_company_id() deterministic
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);