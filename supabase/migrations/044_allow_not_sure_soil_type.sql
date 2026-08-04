-- ─── "Not sure" is an answer the database has to accept ──────────────────────
--
-- Saving a project failed outright with
--   new row for relation "projects" violates check constraint
--   "projects_soil_type_check"
-- for anyone who picked "Not Sure" on the site conditions step.
--
-- Three places disagreed. The site conditions step offers 'not_sure',
-- ProjectSoilType in database.types.ts declares it, and the write path does
-- `soil_type: projectDetails.soilType || null` — which passes 'not_sure'
-- through unchanged because it is a truthy string. Only migration 025's
-- constraint had never heard of it, so the insert was rejected and a finished
-- BOQ was lost at the last step.
--
-- Allowed rather than coerced to NULL. NULL means "never asked"; 'not_sure'
-- means the user was asked and said they did not know, which is what tells the
-- estimator to apply conservative foundation defaults and lets the review
-- screen say the assumption was ours. Collapsing the two would throw that away
-- and leave the same silent-default problem this app keeps running into.

alter table public.projects
  drop constraint if exists projects_soil_type_check;

alter table public.projects
  add constraint projects_soil_type_check
  check (
    soil_type is null
    or soil_type in ('sandy', 'clay_black_mountain', 'loam', 'rock', 'not_sure')
  );

comment on column public.projects.soil_type is
  'sandy | clay_black_mountain | loam | rock | not_sure. NULL means never asked; not_sure means asked and unknown.';
