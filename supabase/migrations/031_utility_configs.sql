-- ============================================
-- Migration 023: Project Utility Configs
-- Adds utility system configuration storage
-- ============================================

CREATE TABLE IF NOT EXISTS project_utility_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Solar System Config
    solar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    solar_system_type TEXT,
    solar_daily_usage TEXT,
    solar_appliances TEXT[],
    solar_roof_type TEXT,

    -- Water Supply Config
    water_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    water_source TEXT,
    borehole_exists BOOLEAN,
    borehole_depth_m INTEGER,
    pump_type TEXT,
    tank_count INTEGER DEFAULT 0,
    tank_size_litres INTEGER,
    tank_stand_required BOOLEAN DEFAULT FALSE,

    -- Wastewater Config
    wastewater_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sanitation_type TEXT,
    bathroom_count INTEGER,
    occupant_count INTEGER,
    septic_tank_type TEXT,
    soakaway_type TEXT,

    -- Rainwater Harvesting Config
    rainwater_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    roof_area_m2 DECIMAL(8,2),
    rainwater_gutter_type TEXT,
    rainwater_tank_size_litres INTEGER,
    rainwater_first_flush BOOLEAN DEFAULT FALSE,
    rainwater_sand_filter BOOLEAN DEFAULT FALSE,

    -- Greywater Recycling Config
    greywater_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    greywater_sources TEXT[],
    greywater_use TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_utility_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project utility configs"
    ON project_utility_configs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_utility_configs.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create utility configs for own projects"
    ON project_utility_configs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_utility_configs.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update utility configs for own projects"
    ON project_utility_configs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_utility_configs.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete utility configs for own projects"
    ON project_utility_configs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_utility_configs.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_project_utility_configs_project_id
    ON project_utility_configs(project_id);

CREATE TRIGGER update_project_utility_configs_updated_at
    BEFORE UPDATE ON project_utility_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
