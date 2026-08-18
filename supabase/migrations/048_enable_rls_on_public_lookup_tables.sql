-- Close the two public-schema tables reported by the Supabase security advisor.
-- Both tables are application-owned lookup data: clients may read the rows they
-- need, but only trusted backend/database roles may change them.

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.subscription_plans FROM anon, authenticated;
GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view active subscription plans"
    ON public.subscription_plans;

CREATE POLICY "Anyone can view active subscription plans"
    ON public.subscription_plans
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

ALTER TABLE public.default_stage_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.default_stage_config FROM anon, authenticated;
GRANT SELECT ON TABLE public.default_stage_config TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view default stage configuration"
    ON public.default_stage_config;

CREATE POLICY "Authenticated users can view default stage configuration"
    ON public.default_stage_config
    FOR SELECT
    TO authenticated
    USING (TRUE);

COMMENT ON POLICY "Anyone can view active subscription plans"
    ON public.subscription_plans IS
'Only active plan definitions are public; plan changes require a trusted database role.';

COMMENT ON POLICY "Authenticated users can view default stage configuration"
    ON public.default_stage_config IS
'Signed-in project builders may read stage templates; template changes require a trusted database role.';
