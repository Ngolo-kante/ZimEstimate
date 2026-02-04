-- ZimEstimate Database Fix
-- Fix infinite recursion in RLS policies
-- Run this AFTER previous migrations

-- ============================================
-- 1. DROP PROBLEMATIC POLICIES
-- ============================================

-- Drop the policies that cause recursion
DROP POLICY IF EXISTS "Users can view shared projects" ON projects;
DROP POLICY IF EXISTS "Shared users can view BOQ items" ON boq_items;

-- ============================================
-- 2. CREATE SECURITY DEFINER FUNCTIONS
-- These functions bypass RLS checks internally
-- ============================================

-- Function to check if user owns a project
CREATE OR REPLACE FUNCTION user_owns_project(project_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_id
        AND p.owner_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if project is shared with user
CREATE OR REPLACE FUNCTION project_shared_with_user(project_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = $1
        AND ps.shared_with_user_id = $2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 3. RECREATE POLICIES USING FUNCTIONS
-- ============================================

-- Policy for viewing shared projects (uses function to avoid recursion)
CREATE POLICY "Users can view shared projects"
    ON projects FOR SELECT
    USING (
        project_shared_with_user(id, auth.uid())
    );

-- Policy for shared users to view BOQ items (uses function)
CREATE POLICY "Shared users can view BOQ items"
    ON boq_items FOR SELECT
    USING (
        project_shared_with_user(project_id, auth.uid())
    );

-- ============================================
-- 4. UPDATE BOQ ITEM POLICIES TO USE FUNCTIONS
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own project BOQ items" ON boq_items;
DROP POLICY IF EXISTS "Users can create BOQ items for own projects" ON boq_items;
DROP POLICY IF EXISTS "Users can update own project BOQ items" ON boq_items;
DROP POLICY IF EXISTS "Users can delete own project BOQ items" ON boq_items;

-- Recreate with functions
CREATE POLICY "Users can view own project BOQ items"
    ON boq_items FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can create BOQ items for own projects"
    ON boq_items FOR INSERT
    WITH CHECK (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can update own project BOQ items"
    ON boq_items FOR UPDATE
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Users can delete own project BOQ items"
    ON boq_items FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- ============================================
-- 5. UPDATE PROJECT_SHARES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project owners can view shares" ON project_shares;
DROP POLICY IF EXISTS "Project owners can create shares" ON project_shares;
DROP POLICY IF EXISTS "Project owners can delete shares" ON project_shares;

CREATE POLICY "Project owners can view shares"
    ON project_shares FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Project owners can create shares"
    ON project_shares FOR INSERT
    WITH CHECK (user_owns_project(project_id, auth.uid()));

CREATE POLICY "Project owners can delete shares"
    ON project_shares FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- ============================================
-- 6. UPDATE REMINDERS POLICY
-- ============================================

DROP POLICY IF EXISTS "Users can create reminders for own projects" ON reminders;

CREATE POLICY "Users can create reminders for own projects"
    ON reminders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND user_owns_project(project_id, auth.uid())
    );

-- ============================================
-- DONE! RLS recursion fixed.
-- ============================================
