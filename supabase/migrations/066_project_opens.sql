-- When each person last opened each project.
--
-- The My projects page leads with a "Continue your build" panel showing the
-- active build the person opened most recently, on any device. This is kept in
-- its own table rather than as a column on projects: projects has an
-- updated_at trigger, so writing an "opened" time there would also change the
-- project's "Updated" date every time someone merely looked at it. One row per
-- person per project also lets a homeowner and their builder each have their
-- own "last opened".

CREATE TABLE IF NOT EXISTS public.project_opens (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_opens_user_recent
    ON public.project_opens (user_id, opened_at DESC);

ALTER TABLE public.project_opens ENABLE ROW LEVEL SECURITY;

-- People see and write only their own rows, and only for projects they can
-- already see (the EXISTS runs under the projects table's own RLS).
DROP POLICY IF EXISTS "Own project opens: read" ON public.project_opens;
CREATE POLICY "Own project opens: read" ON public.project_opens
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Own project opens: insert" ON public.project_opens;
CREATE POLICY "Own project opens: insert" ON public.project_opens
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id)
    );

DROP POLICY IF EXISTS "Own project opens: update" ON public.project_opens;
CREATE POLICY "Own project opens: update" ON public.project_opens
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id)
    );

DROP POLICY IF EXISTS "Own project opens: delete" ON public.project_opens;
CREATE POLICY "Own project opens: delete" ON public.project_opens
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Required for new public tables from 30 October 2026 (see supabase/AGENTS.md).
-- Not readable by anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_opens TO authenticated;
GRANT ALL ON public.project_opens TO service_role;
