-- ─── A project's savings target survives leaving the Budget page ───────────
--
-- The Budget Planner kept "what are you saving for" (the remaining amount,
-- the critical items, or a custom amount) in component state. Opening
-- reminder settings unmounted it, and a custom $15,000 target came back as
-- the full remaining balance. Stored on the project, like the target date
-- (target_purchase_date) already was.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS savings_target_mode TEXT NOT NULL DEFAULT 'remaining',
  ADD COLUMN IF NOT EXISTS savings_target_usd NUMERIC(14,2);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_savings_target_mode_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_savings_target_mode_check
  CHECK (savings_target_mode IN ('remaining', 'critical', 'custom'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_savings_target_usd_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_savings_target_usd_check
  CHECK (savings_target_usd IS NULL OR savings_target_usd >= 0);
