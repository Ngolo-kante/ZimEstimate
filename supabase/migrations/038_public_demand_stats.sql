-- ============================================
-- Migration 038: Public demand stats
-- ============================================
-- The supplier and contractor registration pages ask people to invest real
-- effort — five steps and three documents for a supplier — with nothing on the
-- page saying whether any demand exists on the other side. The honest fix is to
-- show the real numbers.
--
-- rfq_requests, contact_requests and projects are all RLS-locked to their
-- owners, so an anonymous visitor reading them directly sees zero. This
-- function returns aggregate counts only — no ids, no names, no rows — through
-- a definer so the counts are visible while the underlying rows stay private.
--
-- Deliberately NOT exposed: any breakdown fine enough to identify a single
-- buyer or supplier (per-supplier counts, per-city counts on small numbers).
-- Callers are expected to hide these figures when they are too small to be
-- meaningful rather than advertise a quiet marketplace.

CREATE OR REPLACE FUNCTION public_demand_stats()
RETURNS TABLE (
    quote_requests_30d   INTEGER,
    contact_requests_30d INTEGER,
    projects_30d         INTEGER,
    listed_contractors   INTEGER,
    active_suppliers     INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        (SELECT COUNT(*) FROM rfq_requests
          WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER,
        (SELECT COUNT(*) FROM contact_requests
          WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER,
        (SELECT COUNT(*) FROM projects
          WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER,
        (SELECT COUNT(*) FROM contractors
          WHERE is_listed = TRUE AND deleted_at IS NULL)::INTEGER,
        (SELECT COUNT(*) FROM suppliers
          WHERE deleted_at IS NULL)::INTEGER;
$$;

-- Anonymous visitors are the whole point: these numbers have to be readable
-- before anyone has an account.
GRANT EXECUTE ON FUNCTION public_demand_stats() TO anon, authenticated;
