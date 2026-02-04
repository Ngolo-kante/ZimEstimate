-- ZimEstimate Database Enhancement
-- Documents, Planning/Milestones, Usage Tracking
-- Run this AFTER previous migrations

-- ============================================
-- 1. DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,  -- 'image/png', 'application/pdf', etc.
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,  -- Supabase storage path
    category TEXT DEFAULT 'general',  -- 'plan', 'permit', 'receipt', 'contract', 'photo', 'general'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster document lookup by project
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);

-- ============================================
-- 2. MILESTONES/PHASES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    completed_date DATE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster milestone lookup by project
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);

-- ============================================
-- 3. TASKS TABLE (within milestones)
-- ============================================

CREATE TABLE IF NOT EXISTS milestone_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster task lookup by milestone
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_milestone_id ON milestone_tasks(milestone_id);

-- ============================================
-- 4. USAGE TRACKING TABLE (materials consumed on-site)
-- ============================================

CREATE TABLE IF NOT EXISTS material_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    boq_item_id UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    quantity_used DECIMAL(12,2) NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_material_usage_project_id ON material_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_material_usage_boq_item_id ON material_usage(boq_item_id);

-- ============================================
-- 5. ADD COLUMNS TO PROJECTS TABLE
-- ============================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS target_completion_date DATE,
ADD COLUMN IF NOT EXISTS savings_frequency TEXT DEFAULT 'monthly';  -- 'weekly', 'monthly', 'quarterly'

-- ============================================
-- 6. RLS POLICIES FOR PROJECT_DOCUMENTS
-- ============================================

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Owners can do everything with their project documents
CREATE POLICY "Users can view own project documents"
    ON project_documents FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can upload documents to own projects"
    ON project_documents FOR INSERT
    WITH CHECK (
        user_owns_project(project_id, auth.uid())
        AND auth.uid() = uploaded_by
    );

CREATE POLICY "Users can delete own project documents"
    ON project_documents FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- Shared users can view documents
CREATE POLICY "Shared users can view project documents"
    ON project_documents FOR SELECT
    USING (project_shared_with_user(project_id, auth.uid()));

-- ============================================
-- 7. RLS POLICIES FOR PROJECT_MILESTONES
-- ============================================

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project milestones"
    ON project_milestones FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can create milestones for own projects"
    ON project_milestones FOR INSERT
    WITH CHECK (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can update own project milestones"
    ON project_milestones FOR UPDATE
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can delete own project milestones"
    ON project_milestones FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- Shared users can view milestones
CREATE POLICY "Shared users can view project milestones"
    ON project_milestones FOR SELECT
    USING (project_shared_with_user(project_id, auth.uid()));

-- ============================================
-- 8. RLS POLICIES FOR MILESTONE_TASKS
-- ============================================

ALTER TABLE milestone_tasks ENABLE ROW LEVEL SECURITY;

-- Function to check if user owns project via milestone
CREATE OR REPLACE FUNCTION user_owns_milestone_project(milestone_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_milestones pm
        JOIN projects p ON p.id = pm.project_id
        WHERE pm.id = milestone_id
        AND p.owner_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if project is shared via milestone
CREATE OR REPLACE FUNCTION milestone_project_shared_with_user(milestone_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_milestones pm
        JOIN project_shares ps ON ps.project_id = pm.project_id
        WHERE pm.id = milestone_id
        AND ps.shared_with_user_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can view own project milestone tasks"
    ON milestone_tasks FOR SELECT
    USING (user_owns_milestone_project(milestone_id, auth.uid()));

CREATE POLICY "Users can create tasks for own project milestones"
    ON milestone_tasks FOR INSERT
    WITH CHECK (user_owns_milestone_project(milestone_id, auth.uid()));

CREATE POLICY "Users can update own project milestone tasks"
    ON milestone_tasks FOR UPDATE
    USING (user_owns_milestone_project(milestone_id, auth.uid()));

CREATE POLICY "Users can delete own project milestone tasks"
    ON milestone_tasks FOR DELETE
    USING (user_owns_milestone_project(milestone_id, auth.uid()));

-- Shared users can view tasks
CREATE POLICY "Shared users can view milestone tasks"
    ON milestone_tasks FOR SELECT
    USING (milestone_project_shared_with_user(milestone_id, auth.uid()));

-- ============================================
-- 9. RLS POLICIES FOR MATERIAL_USAGE
-- ============================================

ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project material usage"
    ON material_usage FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can record usage for own projects"
    ON material_usage FOR INSERT
    WITH CHECK (
        user_owns_project(project_id, auth.uid())
        AND auth.uid() = recorded_by
    );

CREATE POLICY "Users can update own project material usage"
    ON material_usage FOR UPDATE
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can delete own project material usage"
    ON material_usage FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- Shared users can view usage
CREATE POLICY "Shared users can view material usage"
    ON material_usage FOR SELECT
    USING (project_shared_with_user(project_id, auth.uid()));

-- Function to check if user has edit access via share
CREATE OR REPLACE FUNCTION user_has_edit_access(project_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = $1
        AND ps.shared_with_user_id = $2
        AND ps.access_level = 'edit'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Shared users with edit access can record usage
CREATE POLICY "Shared editors can record material usage"
    ON material_usage FOR INSERT
    WITH CHECK (
        user_has_edit_access(project_id, auth.uid())
        AND auth.uid() = recorded_by
    );

-- ============================================
-- 10. UPDATE PROJECT_SHARES TO USE PROPER ACCESS_LEVEL ENUM
-- ============================================

-- Ensure project_shares access_level can be 'view' or 'edit'
-- (already handled by existing schema, but adding a check constraint if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'project_shares_access_level_check'
    ) THEN
        ALTER TABLE project_shares
        ADD CONSTRAINT project_shares_access_level_check
        CHECK (access_level IN ('view', 'edit'));
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- ============================================
-- DONE! Project enhancements applied.
-- ============================================
