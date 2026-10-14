-- Extras chosen for a full house BOQ (septic, borehole, solar, site setup…),
-- so reopening a saved project shows the same choices. The BOQ lines they
-- produce are saved in boq_items as usual; this keeps the inputs behind them.
-- Shape: lib/houseExtras.ts (HouseExtras). Null = none chosen.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS house_extras JSONB;
