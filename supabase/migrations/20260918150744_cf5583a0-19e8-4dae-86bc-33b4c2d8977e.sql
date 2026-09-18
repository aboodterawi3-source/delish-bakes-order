CREATE TABLE IF NOT EXISTS public.app_setup_state (
  id boolean PRIMARY KEY DEFAULT true,
  admin_setup_completed_at timestamptz,
  CONSTRAINT app_setup_state_single_row CHECK (id)
);

GRANT ALL ON public.app_setup_state TO service_role;
ALTER TABLE public.app_setup_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_setup_state (id, admin_setup_completed_at)
SELECT true, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN now() ELSE NULL END
ON CONFLICT (id) DO NOTHING;