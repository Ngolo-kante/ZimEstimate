-- ZimEstimate Database Schema
-- Run this migration in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  preferred_currency TEXT DEFAULT 'USD' CHECK (preferred_currency IN ('USD', 'ZWG')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

-- ============================================
-- MILESTONES TABLE (5 per project)
-- ============================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('substructure', 'superstructure', 'roofing', 'finishing', 'exterior')),
  calculated_progress NUMERIC DEFAULT 0 CHECK (calculated_progress >= 0 AND calculated_progress <= 100),
  manual_override BOOLEAN DEFAULT FALSE,
  override_value NUMERIC CHECK (override_value IS NULL OR (override_value >= 0 AND override_value <= 100)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, type)
);

CREATE INDEX idx_milestones_project ON milestones(project_id);

-- ============================================
-- PROJECT SHARES (View-only invites)
-- ============================================
CREATE TABLE project_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view', 'collaborate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, shared_with_email)
);

CREATE INDEX idx_project_shares_email ON project_shares(shared_with_email);

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  is_trusted BOOLEAN DEFAULT FALSE,
  scrape_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATERIALS TABLE (Dual Currency)
-- ============================================
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  price_zwg NUMERIC NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_supplier ON materials(supplier_id);

-- ============================================
-- ESTIMATE ITEMS (Budgeted vs Actual)
-- ============================================
CREATE TABLE estimate_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity_budgeted NUMERIC NOT NULL,
  quantity_actual NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_estimate_items_project ON estimate_items(project_id);
CREATE INDEX idx_estimate_items_milestone ON estimate_items(milestone_id);

-- ============================================
-- EXCHANGE RATES (Daily ZWG/USD)
-- ============================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  usd_to_zwg NUMERIC NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exchange_rates_date ON exchange_rates(date DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Projects: Owner has full access, shared users can view
CREATE POLICY "Owners can manage projects" ON projects
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Shared users can view projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_shares 
      WHERE project_id = projects.id 
      AND shared_with_email = (SELECT email FROM users WHERE id = auth.uid())
    )
  );

-- Milestones: Access follows project access
CREATE POLICY "Milestone access follows project" ON milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = milestones.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Materials: Public read, admin write (implement via service role)
CREATE POLICY "Anyone can read materials" ON materials
  FOR SELECT USING (true);

-- Exchange rates: Public read
CREATE POLICY "Anyone can read exchange rates" ON exchange_rates
  FOR SELECT USING (true);

-- Suppliers: Public read
CREATE POLICY "Anyone can read suppliers" ON suppliers
  FOR SELECT USING (true);

-- Estimate items: Project owner access
CREATE POLICY "Estimate items follow project access" ON estimate_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = estimate_items.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Project shares: Owner can manage
CREATE POLICY "Owners can manage shares" ON project_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_shares.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- ============================================
-- SEED DATA: Material Categories (Zimbabwe)
-- ============================================
INSERT INTO suppliers (name, website, is_trusted) VALUES
  ('Sino Zimbabwe', 'https://sinozim.co.zw', true),
  ('Halsteds', 'https://halsteds.co.zw', true),
  ('Fedmech', 'https://fedmech.co.zw', true);

-- Sample materials with dual pricing
INSERT INTO materials (category, name, unit, price_usd, price_zwg, supplier_id) VALUES
  ('Bricks', 'Common Clay Brick', 'per 1000', 85.00, 2550.00, (SELECT id FROM suppliers WHERE name = 'Sino Zimbabwe')),
  ('Bricks', 'Common Cement Brick', 'per 1000', 75.00, 2250.00, (SELECT id FROM suppliers WHERE name = 'Sino Zimbabwe')),
  ('Bricks', 'Face Brick Wire-cut', 'per 1000', 150.00, 4500.00, (SELECT id FROM suppliers WHERE name = 'Halsteds')),
  ('Bricks', 'Farm Brick', 'per 1000', 45.00, 1350.00, NULL),
  ('Sands', 'Pit Sand (Plastering)', 'per cube', 35.00, 1050.00, NULL),
  ('Sands', 'River Sand (Concrete)', 'per cube', 45.00, 1350.00, NULL),
  ('Sands', 'Washed River Sand', 'per cube', 55.00, 1650.00, NULL),
  ('Cement', 'Masonry Cement 22.5X', 'per 50kg bag', 8.50, 255.00, (SELECT id FROM suppliers WHERE name = 'Halsteds')),
  ('Cement', 'Standard Cement 32.5N', 'per 50kg bag', 10.00, 300.00, (SELECT id FROM suppliers WHERE name = 'Halsteds')),
  ('Cement', 'Rapid Setting 42.5R', 'per 50kg bag', 12.50, 375.00, (SELECT id FROM suppliers WHERE name = 'Halsteds')),
  ('Electrical', 'Conduit Pipe 19mm', 'per 4m length', 2.50, 75.00, (SELECT id FROM suppliers WHERE name = 'Fedmech')),
  ('Electrical', '20 Round Box', 'each', 0.75, 22.50, (SELECT id FROM suppliers WHERE name = 'Fedmech')),
  ('Electrical', 'CAFCA 2.5mm Twin+Earth', 'per 100m', 85.00, 2550.00, (SELECT id FROM suppliers WHERE name = 'Fedmech'));

-- Sample exchange rate
INSERT INTO exchange_rates (date, usd_to_zwg, source) VALUES
  (CURRENT_DATE, 30.00, 'RBZ Official Rate');

-- ============================================
-- FUNCTION: Auto-create milestones on project
-- ============================================
CREATE OR REPLACE FUNCTION create_project_milestones()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO milestones (project_id, type) VALUES
    (NEW.id, 'substructure'),
    (NEW.id, 'superstructure'),
    (NEW.id, 'roofing'),
    (NEW.id, 'finishing'),
    (NEW.id, 'exterior');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_milestones
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_milestones();

-- ============================================
-- FUNCTION: Update project timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET updated_at = NOW() WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_on_milestone
  AFTER UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_project_timestamp();

CREATE TRIGGER trigger_update_project_on_estimate
  AFTER INSERT OR UPDATE OR DELETE ON estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION update_project_timestamp();
