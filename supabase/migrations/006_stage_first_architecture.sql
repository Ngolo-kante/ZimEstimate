-- ZimEstimate Stage-First Architecture Migration
-- Implements project stages (substructure, superstructure, etc.) as primary tabs
-- Run this AFTER previous migrations

-- ============================================
-- 1. PROJECT_STAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    boq_category TEXT NOT NULL,  -- 'substructure', 'superstructure', 'roofing', 'finishing', 'exterior'
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planning',  -- 'planning', 'pending_approval', 'in_progress', 'on_hold', 'completed'
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, boq_category)
);

-- Index for faster stage lookup by project
CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_boq_category ON project_stages(boq_category);

-- ============================================
-- 2. STAGE_TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS stage_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    verification_note TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster task lookup by stage
CREATE INDEX IF NOT EXISTS idx_stage_tasks_stage_id ON stage_tasks(stage_id);

-- ============================================
-- 3. DEFAULT STAGE CONFIGURATION
-- ============================================

-- Configuration for default stages and their tasks
CREATE TABLE IF NOT EXISTS default_stage_config (
    boq_category TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL,
    default_tasks JSONB NOT NULL DEFAULT '[]'
);

-- Insert default stage configurations
INSERT INTO default_stage_config (boq_category, name, description, sort_order, default_tasks) VALUES
('substructure', 'Substructure', 'Foundation, trenches, and groundwork', 0, '[
    {"title": "Ensure inspector approves building plan", "description": "Get official approval before breaking ground"},
    {"title": "Obtain building permit", "description": "Secure necessary permits from local authority"},
    {"title": "Clear and level site", "description": "Prepare land for construction"},
    {"title": "Mark foundation layout", "description": "Set out foundation dimensions with pegs and strings"}
]'::jsonb),
('superstructure', 'Superstructure', 'Walls, columns, and structural elements', 1, '[
    {"title": "Verify foundation curing complete", "description": "Ensure foundation has properly cured before building"},
    {"title": "Inspect material delivery", "description": "Check bricks, cement, and steel quality"},
    {"title": "Set up scaffolding safely", "description": "Ensure proper scaffolding for wall construction"}
]'::jsonb),
('roofing', 'Roofing', 'Roof structure, trusses, and covering', 2, '[
    {"title": "Verify wall plate installation", "description": "Ensure wall plates are level and secure"},
    {"title": "Schedule truss delivery", "description": "Coordinate roof truss delivery and installation"},
    {"title": "Arrange roofing material inspection", "description": "Check IBR sheets or tiles before installation"}
]'::jsonb),
('finishing', 'Finishing', 'Plastering, painting, and interior work', 3, '[
    {"title": "Complete electrical rough-in", "description": "Install wiring before plastering"},
    {"title": "Complete plumbing rough-in", "description": "Install pipes before wall finishing"},
    {"title": "Schedule paint color selection", "description": "Finalize interior and exterior colors"}
]'::jsonb),
('exterior', 'Exterior', 'Fencing, gates, paving, and landscaping', 4, '[
    {"title": "Plan boundary wall layout", "description": "Mark fence/wall positions"},
    {"title": "Order gate and security fixtures", "description": "Select and order gates, locks"},
    {"title": "Schedule driveway construction", "description": "Plan paving or concrete work"}
]'::jsonb)
ON CONFLICT (boq_category) DO NOTHING;

-- ============================================
-- 4. FUNCTION TO CREATE DEFAULT STAGES
-- ============================================

CREATE OR REPLACE FUNCTION create_default_stages(p_project_id UUID, p_scope TEXT)
RETURNS void AS $$
DECLARE
    stage_config RECORD;
    new_stage_id UUID;
    task_item JSONB;
    task_sort INTEGER;
BEGIN
    -- Loop through each default stage configuration
    FOR stage_config IN
        SELECT * FROM default_stage_config ORDER BY sort_order
    LOOP
        -- Determine if stage is applicable based on project scope
        -- If scope is 'entire_house', all stages apply
        -- Otherwise, only the matching stage applies
        INSERT INTO project_stages (
            project_id,
            boq_category,
            name,
            description,
            sort_order,
            is_applicable,
            status
        ) VALUES (
            p_project_id,
            stage_config.boq_category,
            stage_config.name,
            stage_config.description,
            stage_config.sort_order,
            CASE
                WHEN p_scope = 'entire_house' THEN TRUE
                WHEN p_scope = stage_config.boq_category THEN TRUE
                ELSE FALSE
            END,
            'planning'
        )
        RETURNING id INTO new_stage_id;

        -- Create default tasks for this stage
        task_sort := 0;
        FOR task_item IN SELECT * FROM jsonb_array_elements(stage_config.default_tasks)
        LOOP
            INSERT INTO stage_tasks (
                stage_id,
                title,
                description,
                sort_order,
                is_default,
                is_completed
            ) VALUES (
                new_stage_id,
                task_item->>'title',
                task_item->>'description',
                task_sort,
                TRUE,
                FALSE
            );
            task_sort := task_sort + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. TRIGGER FOR AUTO-CREATING STAGES
-- ============================================

CREATE OR REPLACE FUNCTION trigger_create_project_stages()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default stages for the new project
    PERFORM create_default_stages(NEW.id, NEW.scope);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_project_created_create_stages ON projects;

CREATE TRIGGER on_project_created_create_stages
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_project_stages();

-- ============================================
-- 6. CREATE STAGES FOR EXISTING PROJECTS
-- ============================================

-- Create stages for all existing projects that don't have stages yet
DO $$
DECLARE
    proj RECORD;
BEGIN
    FOR proj IN
        SELECT p.id, p.scope FROM projects p
        WHERE NOT EXISTS (
            SELECT 1 FROM project_stages ps WHERE ps.project_id = p.id
        )
    LOOP
        PERFORM create_default_stages(proj.id, proj.scope);
    END LOOP;
END $$;

-- ============================================
-- 7. RLS POLICIES FOR PROJECT_STAGES
-- ============================================

ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project stages"
    ON project_stages FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can update own project stages"
    ON project_stages FOR UPDATE
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can insert stages for own projects"
    ON project_stages FOR INSERT
    WITH CHECK (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can delete own project stages"
    ON project_stages FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- Shared users can view stages
CREATE POLICY "Shared users can view project stages"
    ON project_stages FOR SELECT
    USING (project_shared_with_user(project_id, auth.uid()));

-- ============================================
-- 8. RLS POLICIES FOR STAGE_TASKS
-- ============================================

ALTER TABLE stage_tasks ENABLE ROW LEVEL SECURITY;

-- Function to check if user owns project via stage
CREATE OR REPLACE FUNCTION user_owns_stage_project(p_stage_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_stages ps
        JOIN projects p ON p.id = ps.project_id
        WHERE ps.id = p_stage_id
        AND p.owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if project is shared via stage
CREATE OR REPLACE FUNCTION stage_project_shared_with_user(p_stage_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_stages ps
        JOIN project_shares psh ON psh.project_id = ps.project_id
        WHERE ps.id = p_stage_id
        AND psh.shared_with_user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can view own project stage tasks"
    ON stage_tasks FOR SELECT
    USING (user_owns_stage_project(stage_id, auth.uid()));

CREATE POLICY "Users can create tasks for own project stages"
    ON stage_tasks FOR INSERT
    WITH CHECK (user_owns_stage_project(stage_id, auth.uid()));

CREATE POLICY "Users can update own project stage tasks"
    ON stage_tasks FOR UPDATE
    USING (user_owns_stage_project(stage_id, auth.uid()));

CREATE POLICY "Users can delete own project stage tasks"
    ON stage_tasks FOR DELETE
    USING (user_owns_stage_project(stage_id, auth.uid()));

-- Shared users can view tasks
CREATE POLICY "Shared users can view stage tasks"
    ON stage_tasks FOR SELECT
    USING (stage_project_shared_with_user(stage_id, auth.uid()));

-- Shared users with edit access can manage tasks
CREATE OR REPLACE FUNCTION user_has_stage_edit_access(p_stage_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_stages ps
        JOIN project_shares psh ON psh.project_id = ps.project_id
        WHERE ps.id = p_stage_id
        AND psh.shared_with_user_id = p_user_id
        AND psh.access_level = 'edit'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Shared editors can create stage tasks"
    ON stage_tasks FOR INSERT
    WITH CHECK (user_has_stage_edit_access(stage_id, auth.uid()));

CREATE POLICY "Shared editors can update stage tasks"
    ON stage_tasks FOR UPDATE
    USING (user_has_stage_edit_access(stage_id, auth.uid()));

-- ============================================
-- 9. UPDATED_AT TRIGGER FOR PROJECT_STAGES
-- ============================================

CREATE OR REPLACE FUNCTION update_stage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_stage_update ON project_stages;

CREATE TRIGGER on_stage_update
    BEFORE UPDATE ON project_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_stage_updated_at();

-- ============================================
-- DONE! Stage-first architecture applied.
-- ============================================
