CREATE TYPE public.priority_color AS ENUM ('dark_red','warm_orange','golden_yellow','sky_blue','soft_green');

ALTER TABLE public.products
  ADD COLUMN priority_color public.priority_color;