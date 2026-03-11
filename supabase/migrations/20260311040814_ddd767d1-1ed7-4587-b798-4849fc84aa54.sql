
ALTER TABLE public.waste_logs ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.waste_logs ADD COLUMN dish_id uuid REFERENCES public.dishes(id);
