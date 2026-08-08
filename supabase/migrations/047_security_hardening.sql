-- Security hardening: immutable account roles, safe public contractor data,
-- and a shared rate-limit store for serverless API instances.

-- Authenticated users previously had table-wide UPDATE permission plus an RLS
-- policy that only checked row ownership. That combination allowed a user to
-- update their own tier/user_type to admin. Remove the table grant and expose
-- only the profile fields users are meant to edit themselves.
REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;

GRANT UPDATE (
    full_name,
    avatar_url,
    preferred_currency,
    phone_number,
    whatsapp_reminders,
    notify_email,
    notify_whatsapp,
    notify_push,
    notify_rfq,
    notify_quote_updates,
    notify_price_alerts,
    notify_project_reminders,
    telegram_chat_id
) ON TABLE public.profiles TO authenticated;

-- Listed contractor rows contain private pricing preferences and internal user
-- identifiers. Keep owner reads on the base table and publish only the columns
-- the directory needs through a deliberately definer-owned view.
DROP POLICY IF EXISTS "Anyone can view listed contractors" ON public.contractors;

DROP VIEW IF EXISTS public.public_contractors;
CREATE VIEW public.public_contractors
WITH (security_barrier = true)
AS
SELECT
    id,
    company_name,
    contact_phone,
    contact_email,
    trades,
    service_areas,
    years_experience,
    about,
    is_verified,
    created_at,
    updated_at
FROM public.contractors
WHERE is_listed = TRUE
  AND deleted_at IS NULL;

REVOKE ALL ON TABLE public.public_contractors FROM PUBLIC;
GRANT SELECT ON TABLE public.public_contractors TO anon, authenticated;

COMMENT ON VIEW public.public_contractors IS
'Public directory projection. Private contractor settings and account identifiers are intentionally excluded.';

-- A process-local Map is not a rate limit in a serverless deployment: every
-- instance has a separate counter. This table and atomic function make all
-- instances consume the same buckets. Only the service role can call it.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    bucket_key      TEXT PRIMARY KEY,
    request_count   INTEGER NOT NULL CHECK (request_count >= 0),
    reset_at        TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
    p_bucket_key TEXT,
    p_limit INTEGER,
    p_window_ms INTEGER
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_count INTEGER;
    v_reset_at TIMESTAMPTZ;
BEGIN
    IF p_bucket_key IS NULL OR length(p_bucket_key) > 300 THEN
        RAISE EXCEPTION 'Invalid rate-limit bucket key';
    END IF;
    IF p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'Invalid rate-limit threshold';
    END IF;
    IF p_window_ms < 1000 OR p_window_ms > 86400000 THEN
        RAISE EXCEPTION 'Invalid rate-limit window';
    END IF;

    INSERT INTO public.api_rate_limits AS buckets (
        bucket_key,
        request_count,
        reset_at,
        updated_at
    )
    VALUES (
        p_bucket_key,
        1,
        v_now + make_interval(secs => p_window_ms::DOUBLE PRECISION / 1000),
        v_now
    )
    ON CONFLICT (bucket_key) DO UPDATE SET
        request_count = CASE
            WHEN buckets.reset_at <= v_now THEN 1
            ELSE buckets.request_count + 1
        END,
        reset_at = CASE
            WHEN buckets.reset_at <= v_now
                THEN v_now + make_interval(secs => p_window_ms::DOUBLE PRECISION / 1000)
            ELSE buckets.reset_at
        END,
        updated_at = v_now
    RETURNING buckets.request_count, buckets.reset_at
    INTO v_count, v_reset_at;

    RETURN QUERY SELECT
        v_count <= p_limit,
        GREATEST(p_limit - v_count, 0),
        v_reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
