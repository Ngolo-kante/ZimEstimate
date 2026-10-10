-- ─── Make the signup alert answer "is the marketing working?" ───────────────
--
-- Two problems with 051.
--
-- First, it counted the day with date_trunc('day', NOW()), which is UTC.
-- Zimbabwe is UTC+2, so between midnight and 2am local the count reported the
-- previous day: a verification run showed "Joined today: 1" while two people
-- had in fact signed up that Harare day. The product serves one country in one
-- timezone, so the day boundary is Africa/Harare.
--
-- Second, and more to the point: the alert exists so the administrator can see
-- whether marketing is landing without opening the admin page. "Somebody
-- signed up" does not answer that. One signup is noise; the question is
-- whether signups are moving. If the marketing works, these emails get more
-- frequent and each one individually tells you less.
--
-- So each alert now carries its own context — today against yesterday, and the
-- last seven days — which is enough to read a trend from a phone without
-- logging in anywhere.

CREATE OR REPLACE FUNCTION notify_admin_of_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id   UUID;
    v_joined     TEXT;
    v_zone       CONSTANT TEXT := 'Africa/Harare';
    v_day_start  TIMESTAMPTZ;
    v_total      INTEGER;
    v_today      INTEGER;
    v_yesterday  INTEGER;
    v_last7      INTEGER;
    v_prev7      INTEGER;
    v_direction  TEXT;
BEGIN
    SELECT id INTO v_admin_id
    FROM profiles
    WHERE email = 'zimestimate@gmail.com'
    LIMIT 1;

    IF v_admin_id IS NULL OR v_admin_id = NEW.id THEN
        RETURN NEW;
    END IF;

    -- Local wall clock -> truncate to local midnight -> back to an absolute
    -- instant, so comparing against created_at (timestamptz) is correct rather
    -- than merely plausible.
    v_day_start := date_trunc('day', NOW() AT TIME ZONE v_zone) AT TIME ZONE v_zone;

    SELECT COUNT(*) INTO v_total FROM profiles;

    SELECT
        COUNT(*) FILTER (WHERE created_at >= v_day_start),
        COUNT(*) FILTER (WHERE created_at >= v_day_start - INTERVAL '1 day'
                           AND created_at <  v_day_start),
        COUNT(*) FILTER (WHERE created_at >= v_day_start - INTERVAL '6 days'),
        COUNT(*) FILTER (WHERE created_at >= v_day_start - INTERVAL '13 days'
                           AND created_at <  v_day_start - INTERVAL '6 days')
    INTO v_today, v_yesterday, v_last7, v_prev7
    FROM profiles;

    -- Week on week is the comparison that survives a quiet Tuesday. Stated in
    -- words because the point is to be readable at a glance on a phone.
    v_direction := CASE
        WHEN v_prev7 = 0 AND v_last7 = 0 THEN 'no signups either week'
        WHEN v_prev7 = 0                 THEN 'up from none the week before'
        WHEN v_last7 > v_prev7           THEN 'up from ' || v_prev7 || ' the week before'
        WHEN v_last7 < v_prev7           THEN 'down from ' || v_prev7 || ' the week before'
        ELSE                                  'level with the week before'
    END;

    v_joined := COALESCE(NULLIF(TRIM(NEW.full_name), ''), NEW.email, 'Someone');

    INSERT INTO notification_deliveries (user_id, channel, template_key, status, payload)
    VALUES (
        v_admin_id,
        'email',
        'admin_new_user',
        'queued',
        jsonb_build_object(
            'title', 'ZimEstimate signup: ' || v_joined || ' (' || v_today || ' today)',
            'body',
                v_joined || ' just created an account.' || chr(10) || chr(10) ||
                'Today: ' || v_today || '   Yesterday: ' || v_yesterday || chr(10) ||
                'Last 7 days: ' || v_last7 || ' — ' || v_direction || chr(10) ||
                'Total users: ' || v_total || chr(10) || chr(10) ||
                'Days are Harare time.',
            'new_user_id',   NEW.id,
            'total_users',   v_total,
            'joined_today',  v_today,
            'joined_yesterday', v_yesterday,
            'last_7_days',   v_last7,
            'previous_7_days', v_prev7
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- An alert that cannot be queued must never stop somebody signing up.
        -- This runs inside the signup transaction.
        RAISE WARNING 'notify_admin_of_new_user failed: %', SQLERRM;
        RETURN NEW;
END;
$$;
