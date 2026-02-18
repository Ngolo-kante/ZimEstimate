-- Project site/compliance metadata for manual builder persistence

alter table public.projects
  add column if not exists soil_type text,
  add column if not exists site_slope text,
  add column if not exists geotech_report_uploaded boolean not null default false,
  add column if not exists geotech_report_uploaded_at timestamptz,
  add column if not exists geotech_report_document_id uuid,
  add column if not exists geotech_analysis_mode text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_soil_type_check'
  ) then
    alter table public.projects
      add constraint projects_soil_type_check
      check (
        soil_type is null
        or soil_type in ('sandy', 'clay_black_mountain', 'loam', 'rock')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_site_slope_check'
  ) then
    alter table public.projects
      add constraint projects_site_slope_check
      check (
        site_slope is null
        or site_slope in ('flat', 'gentle', 'moderate', 'steep')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_geotech_analysis_mode_check'
  ) then
    alter table public.projects
      add constraint projects_geotech_analysis_mode_check
      check (geotech_analysis_mode in ('manual', 'pro_available', 'pro_applied'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_geotech_report_document_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_geotech_report_document_id_fkey
      foreign key (geotech_report_document_id)
      references public.project_documents(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_projects_geotech_document_id
  on public.projects(geotech_report_document_id);
