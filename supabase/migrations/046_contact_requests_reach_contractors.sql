-- ─── Enquiries can reach a contractor, and can come from a stranger ──────────
--
-- contact_requests was supplier-shaped: supplier_id NOT NULL, builder_id NOT
-- NULL. Contractors were therefore outside the lead system entirely — the only
-- route to one was the tel: and mailto: links on their public page, which leave
-- no record, notify nobody, and cannot be measured or followed up.
--
-- Two things change here.
--
-- 1. contractor_id joins supplier_id, with exactly one of the two set. This is
--    the same "one owner, enforced by a CHECK" shape rfq_requests has used
--    since migration 043 and create_rfq_with_items_and_recipients since 045,
--    so there is one idea to learn rather than three.
--
-- 2. builder_id becomes optional. Someone comparing contractors has not
--    necessarily signed up yet, and requiring an account to ask a question is
--    the same auth wall that was taken off registration. builder_name /
--    builder_email / builder_phone already exist on this table and carry the
--    identity of everyone who has no account.

ALTER TABLE contact_requests
    ALTER COLUMN supplier_id DROP NOT NULL,
    ALTER COLUMN builder_id  DROP NOT NULL;

ALTER TABLE contact_requests
    ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE;

-- An enquiry addressed to nobody, or to both at once, is meaningless.
ALTER TABLE contact_requests
    DROP CONSTRAINT IF EXISTS contact_requests_exactly_one_recipient;

ALTER TABLE contact_requests
    ADD CONSTRAINT contact_requests_exactly_one_recipient
    CHECK (num_nonnulls(supplier_id, contractor_id) = 1);

-- An enquiry has to be answerable: either it belongs to an account we can
-- reach, or it carries an email address or a phone number.
ALTER TABLE contact_requests
    DROP CONSTRAINT IF EXISTS contact_requests_reachable;

ALTER TABLE contact_requests
    ADD CONSTRAINT contact_requests_reachable
    CHECK (
        builder_id IS NOT NULL
        OR builder_email IS NOT NULL
        OR builder_phone IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_contact_requests_contractor_id
    ON contact_requests (contractor_id)
    WHERE contractor_id IS NOT NULL;

-- ─── Row level security ─────────────────────────────────────────────────────
--
-- No public INSERT policy, matching the reasoning in migration 041: enquiries
-- arrive through POST /api/enquiries, which validates and rate-limits by IP
-- before inserting with the service role. A direct insert policy would hand
-- the internet an unauthenticated writer on a table two other parties read.
--
-- The existing builder and supplier policies are left alone. "Builders can view
-- own contact requests" uses auth.uid() = builder_id, which is null-safe: a
-- NULL builder_id matches no one, so an anonymous enquiry stays invisible to
-- every signed-in user and is readable only by its recipient and by admins.

DROP POLICY IF EXISTS "Contractors can view contact requests sent to them" ON contact_requests;

CREATE POLICY "Contractors can view contact requests sent to them"
    ON contact_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM contractors
            WHERE contractors.id = contact_requests.contractor_id
              AND contractors.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Contractors can update contact request status" ON contact_requests;

CREATE POLICY "Contractors can update contact request status"
    ON contact_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM contractors
            WHERE contractors.id = contact_requests.contractor_id
              AND contractors.user_id = auth.uid()
        )
    );

COMMENT ON COLUMN contact_requests.contractor_id IS
'The contractor this enquiry was sent to. Exactly one of supplier_id and
contractor_id is set — see contact_requests_exactly_one_recipient.';
