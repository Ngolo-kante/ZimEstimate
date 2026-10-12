-- ─── Quick estimates can be archived, like projects ────────────────────────
--
-- The card menu on My Projects offered full builds Archive but quick
-- estimates only Copy link / Download / Delete, so the only way to tidy away
-- a finished borehole estimate was to delete it. archived_at rather than a
-- status column: quick estimates have no lifecycle beyond "put away", and the
-- timestamp says when. The owner sets and clears it through the existing
-- "update own" policy.

ALTER TABLE public.quick_boqs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
