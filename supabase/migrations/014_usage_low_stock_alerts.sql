-- Low stock alert settings on projects

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS usage_low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS usage_low_stock_threshold NUMERIC(5,2) NOT NULL DEFAULT 20;

