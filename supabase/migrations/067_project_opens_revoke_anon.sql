-- Close project_opens to signed-out users at the privilege level too.
--
-- 066 granted the table only to authenticated and service_role, but this
-- project was created before Supabase's 30 October 2026 change, so its
-- default privileges still gave the new table to anon as well. Row level
-- security already returned no rows to anon (every policy is TO authenticated);
-- this makes a signed-out request fail outright instead of returning [].

REVOKE ALL ON public.project_opens FROM anon;
