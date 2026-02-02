-- ZimEstimate Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bjvnisdfkkhonjtytheb/sql/new

-- ============================================
-- 1. CREATE CUSTOM TYPES (ENUMS)
-- ============================================

CREATE TYPE user_tier AS ENUM ('free', 'pro', 'admin');
CREATE TYPE project_status AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE project_scope AS ENUM ('entire_house', 'substructure', 'superstructure', 'roofing', 'finishing', 'exterior');
CREATE TYPE labor_preference AS ENUM ('materials_only', 'with_labor');
CREATE TYPE access_level AS ENUM ('view', 'edit');
CREATE TYPE currency AS ENUM ('USD', 'ZWG');

-- ============================================
-- 2. PROFILES TABLE
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    tier user_tier NOT NULL DEFAULT 'free',
    preferred_currency currency NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. SUPPLIERS TABLE
-- ============================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    website TEXT,
    is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
    rating DECIMAL(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Everyone can view suppliers
CREATE POLICY "Anyone can view suppliers"
    ON suppliers FOR SELECT
    USING (true);

-- Only admins can manage suppliers
CREATE POLICY "Admins can insert suppliers"
    ON suppliers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE POLICY "Admins can update suppliers"
    ON suppliers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- ============================================
-- 4. MATERIALS TABLE
-- ============================================

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    subcategory TEXT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    specifications TEXT,
    price_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
    price_zwg DECIMAL(12,2) NOT NULL DEFAULT 0,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Everyone can view active materials
CREATE POLICY "Anyone can view active materials"
    ON materials FOR SELECT
    USING (is_active = true);

-- Only admins can manage materials
CREATE POLICY "Admins can insert materials"
    ON materials FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE POLICY "Admins can update materials"
    ON materials FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- ============================================
-- 5. PROJECTS TABLE
-- ============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    scope project_scope NOT NULL DEFAULT 'entire_house',
    labor_preference labor_preference NOT NULL DEFAULT 'materials_only',
    status project_status NOT NULL DEFAULT 'draft',
    total_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_zwg DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (auth.uid() = owner_id);

-- Users can insert projects (with tier limit check done in application)
CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = owner_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (auth.uid() = owner_id);

-- Trigger for projects updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. BOQ ITEMS TABLE
-- ============================================

CREATE TABLE boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL,
    material_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    unit_price_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_price_zwg DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_usd DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price_usd) STORED,
    total_zwg DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price_zwg) STORED,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;

-- Users can view BOQ items for their own projects
CREATE POLICY "Users can view own project BOQ items"
    ON boq_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = boq_items.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Users can insert BOQ items for their own projects
CREATE POLICY "Users can create BOQ items for own projects"
    ON boq_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = boq_items.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Users can update BOQ items for their own projects
CREATE POLICY "Users can update own project BOQ items"
    ON boq_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = boq_items.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Users can delete BOQ items from their own projects
CREATE POLICY "Users can delete own project BOQ items"
    ON boq_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = boq_items.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Trigger for boq_items updated_at
CREATE TRIGGER update_boq_items_updated_at
    BEFORE UPDATE ON boq_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. PROJECT SHARES TABLE
-- ============================================

CREATE TABLE project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    access_level access_level NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Project owners can view shares
CREATE POLICY "Project owners can view shares"
    ON project_shares FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_shares.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Shared users can view their share record
CREATE POLICY "Shared users can view their share"
    ON project_shares FOR SELECT
    USING (shared_with_user_id = auth.uid());

-- Project owners can create shares
CREATE POLICY "Project owners can create shares"
    ON project_shares FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_shares.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Project owners can delete shares
CREATE POLICY "Project owners can delete shares"
    ON project_shares FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_shares.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Add policy for shared users to view shared projects
CREATE POLICY "Users can view shared projects"
    ON projects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_shares
            WHERE project_shares.project_id = projects.id
            AND project_shares.shared_with_user_id = auth.uid()
        )
    );

-- Add policy for shared users with edit access to view BOQ items
CREATE POLICY "Shared users can view BOQ items"
    ON boq_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_shares
            WHERE project_shares.project_id = boq_items.project_id
            AND project_shares.shared_with_user_id = auth.uid()
        )
    );

-- ============================================
-- 8. EXCHANGE RATES TABLE
-- ============================================

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    usd_to_zwg DECIMAL(12,4) NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can view exchange rates
CREATE POLICY "Anyone can view exchange rates"
    ON exchange_rates FOR SELECT
    USING (true);

-- Only admins can manage exchange rates
CREATE POLICY "Admins can insert exchange rates"
    ON exchange_rates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to get user's project count
CREATE OR REPLACE FUNCTION get_user_project_count(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM projects
        WHERE owner_id = user_id
        AND status != 'archived'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create more projects
CREATE OR REPLACE FUNCTION can_create_project(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier user_tier;
    project_count INTEGER;
BEGIN
    SELECT tier INTO user_tier FROM profiles WHERE id = user_id;

    -- Pro and admin users have unlimited projects
    IF user_tier IN ('pro', 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Free users limited to 3 projects
    SELECT get_user_project_count(user_id) INTO project_count;
    RETURN project_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update project totals
CREATE OR REPLACE FUNCTION update_project_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects
    SET
        total_usd = (SELECT COALESCE(SUM(total_usd), 0) FROM boq_items WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
        total_zwg = (SELECT COALESCE(SUM(total_zwg), 0) FROM boq_items WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update project totals when BOQ items change
CREATE TRIGGER update_project_totals_on_boq_change
    AFTER INSERT OR UPDATE OR DELETE ON boq_items
    FOR EACH ROW EXECUTE FUNCTION update_project_totals();

-- ============================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_boq_items_project_id ON boq_items(project_id);
CREATE INDEX idx_boq_items_category ON boq_items(category);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_is_active ON materials(is_active);
CREATE INDEX idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX idx_project_shares_shared_with ON project_shares(shared_with_user_id);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date DESC);

-- ============================================
-- DONE! Your database is ready.
-- ============================================
