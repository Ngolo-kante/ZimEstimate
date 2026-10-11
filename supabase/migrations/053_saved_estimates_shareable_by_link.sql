-- ─── A saved estimate can be opened by anyone with its link ─────────────────
--
-- Saved quick estimates were private to their owner (RLS on user_id), so the
-- Share button sent a link that showed "not found" to whoever received it.
--
-- Sharing is per estimate and opt-in: a random share_token is created only
-- when the owner presses Share, and clearing it (Stop sharing) kills the link.
-- The token, not the row id, is what goes in the link, so a link cannot be
-- guessed from anything else and can be revoked without touching the estimate.
--
-- Deliberately NOT a "public" flag with an RLS policy: the anon key is in the
-- browser, so such a policy would let anyone list every shared estimate with
-- one query. Here the only way in is a function that needs the exact token,
-- and it returns the estimate alone — not the owner, the linked project, the
-- money they have saved towards it, their target date or compliance progress.

ALTER TABLE quick_boqs
  ADD COLUMN IF NOT EXISTS share_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS quick_boqs_share_token_key
  ON quick_boqs (share_token)
  WHERE share_token IS NOT NULL;

-- The owner sets and clears share_token through the existing "update own"
-- policy; nothing new is needed for that.

CREATE OR REPLACE FUNCTION public.get_shared_quick_boq(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'project_type', q.project_type,
    'answers', q.answers,
    'boq_items', q.boq_items,
    'labor_enabled', q.labor_enabled,
    'labor_method', q.labor_method,
    'labor_value', q.labor_value,
    'labor_days', q.labor_days,
    'labor_workers', q.labor_workers,
    'markup_pct', q.markup_pct,
    'currency', q.currency,
    'updated_at', q.updated_at
  )
  FROM public.quick_boqs q
  WHERE p_token IS NOT NULL
    AND q.share_token = p_token;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quick_boq(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quick_boq(UUID) TO anon, authenticated;
