-- ============================================
-- Migration 041: let signed-out visitors file a support ticket
-- ============================================
-- support_tickets required a user_id and its insert policy was
-- auth.uid() = user_id, so the only people who could ask for help were people
-- who already had an account and could sign in. Anyone locked out, anyone
-- deciding whether to sign up, and anyone whose problem *is* the sign-up had
-- no route at all — and the email addresses printed on the support page have
-- no MX records behind them, so those bounce too.
--
-- user_id stays for tickets raised by signed-in users; contact_name and
-- contact_email carry the identity of everyone else.
--
-- No public INSERT policy is added on purpose. Anonymous submissions go
-- through POST /api/support, which validates and rate-limits by IP before
-- inserting with the service role. Opening a direct insert policy on a table
-- admins read would hand the internet an unauthenticated writer.

ALTER TABLE support_tickets
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS contact_name  TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- A ticket has to be answerable: either it belongs to an account we can reach,
-- or it carries an email address.
ALTER TABLE support_tickets
    DROP CONSTRAINT IF EXISTS support_tickets_reachable;

ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_reachable
    CHECK (user_id IS NOT NULL OR contact_email IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_support_tickets_contact_email
    ON support_tickets (contact_email)
    WHERE contact_email IS NOT NULL;

-- The existing "Users can view own tickets" policy uses auth.uid() = user_id,
-- which is null-safe: a NULL user_id never matches, so anonymous tickets stay
-- invisible to every signed-in user and remain readable only by admins.
