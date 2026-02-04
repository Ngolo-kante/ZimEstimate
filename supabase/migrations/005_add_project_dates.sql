-- Migration: Add start_date and target_purchase_date to projects table
-- Description: Adds fields for project timeline tracking

-- Add start_date column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Add target_purchase_date column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS target_purchase_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN projects.start_date IS 'The date when the project construction started or is planned to start';
COMMENT ON COLUMN projects.target_purchase_date IS 'The target date by which all materials should be purchased';

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_target_purchase_date ON projects(target_purchase_date) WHERE target_purchase_date IS NOT NULL;
