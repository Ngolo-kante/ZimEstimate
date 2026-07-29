-- Let admins read every profile.
--
-- profiles carried a single SELECT policy, USING (auth.uid() = id), so a signed
-- in user could only ever read their own row. /admin/users therefore reported
-- "1 total users" against a table holding eight, and every other admin screen
-- that joins profiles saw the same slice. The page was not broken in the client:
-- the rows never left the database.
--
-- A policy on profiles cannot query profiles directly to test for admin without
-- recursing, which is what 003_fix_rls_recursion.sql was written to undo. Follow
-- the pattern established there and read the role inside a SECURITY DEFINER
-- function, which runs with the definer's rights and so skips RLS.

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND (p.user_type = 'admin' OR p.tier = 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Keep the existing self-read policy; add admin read alongside it. Postgres ORs
-- multiple permissive SELECT policies together, so ordinary users are unaffected.
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (current_user_is_admin());

-- Suspending and role changes are already routed through the admin API, which
-- authenticates with the service role, so UPDATE is deliberately left alone.
