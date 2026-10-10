-- ─── Tell the administrator when somebody signs up ──────────────────────────
--
-- Hooked to profiles rather than to the signup form. Every route into the
-- product — the email form, Google sign-in, anything added later — ends at
-- handle_new_user() inserting a profiles row, so this is the one place that
-- sees all of them. A client-side call from the signup page would miss OAuth
-- entirely, and would be callable by anyone holding the anon key.
--
-- Delivery goes through notification_deliveries, which the dispatcher already
-- drains, so this needs no new secret, no HTTP call out of Postgres, and no
-- second mail path to keep working. The cost is that the alert is not instant:
-- it arrives on the next dispatcher run, which is every 15 minutes via the
-- external scheduler and daily via the Vercel cron.

CREATE OR REPLACE FUNCTION notify_admin_of_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id   UUID;
    v_total      INTEGER;
    v_today      INTEGER;
    v_joined     TEXT;
BEGIN
    -- Addressed by email rather than by a hardcoded uuid, so restoring or
    -- reseeding the account does not silently stop the alerts. Change the
    -- address here to move them.
    SELECT id INTO v_admin_id
    FROM profiles
    WHERE email = 'zimestimate@gmail.com'
    LIMIT 1;

    -- No administrator on file, or the administrator is the account that was
    -- just created: nothing useful to send.
    IF v_admin_id IS NULL OR v_admin_id = NEW.id THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_total FROM profiles;
    SELECT COUNT(*) INTO v_today
    FROM profiles
    WHERE created_at >= date_trunc('day', NOW());

    v_joined := COALESCE(NULLIF(TRIM(NEW.full_name), ''), NEW.email, 'Someone');

    INSERT INTO notification_deliveries (user_id, channel, template_key, status, payload)
    VALUES (
        v_admin_id,
        'email',
        'admin_new_user',
        'queued',
        jsonb_build_object(
            'title', 'New ZimEstimate user: ' || v_joined,
            'body',
                v_joined || ' just created an account.' || chr(10) || chr(10) ||
                'Total users: ' || v_total || chr(10) ||
                'Joined today: ' || v_today,
            'new_user_id', NEW.id,
            'total_users', v_total,
            'joined_today', v_today
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- An alert that cannot be queued must never stop somebody signing up.
        -- This trigger runs inside the signup transaction, so without this an
        -- unrelated fault here — a changed column, a full disk — would turn
        -- into "account creation failed" for a real person.
        RAISE WARNING 'notify_admin_of_new_user failed: %', SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_notify_admin ON profiles;

CREATE TRIGGER on_profile_created_notify_admin
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_admin_of_new_user();

COMMENT ON FUNCTION notify_admin_of_new_user() IS
'Queues an email to the administrator when a profile is created, carrying the
running total and the number who joined today. Delivered by the notifications
dispatcher, so it arrives on the next run rather than instantly. Never raises:
a failure here must not block account creation.';
