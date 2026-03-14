ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guided_task_id text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guided_step integer DEFAULT 0;