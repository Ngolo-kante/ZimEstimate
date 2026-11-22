-- Serialize total recalculations for the same project. The SUM runs after
-- the lock is acquired, so a second insert sees the first committed insert.
CREATE OR REPLACE FUNCTION public.update_project_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  pid uuid := coalesce(NEW.project_id, OLD.project_id);
BEGIN
  PERFORM 1 FROM public.projects WHERE id = pid FOR NO KEY UPDATE;
  UPDATE public.projects
     SET (total_usd, total_zwg) = (
       SELECT coalesce(sum(b.total_usd), 0), coalesce(sum(b.total_zwg), 0)
         FROM public.boq_items b WHERE b.project_id = pid
     ), updated_at = now()
   WHERE id = pid;
  RETURN coalesce(NEW, OLD);
END;
$$;

-- Replace a draft and its priced lines in a single PostgREST transaction.
-- The caller's existing project and BOQ row policies apply throughout.
CREATE OR REPLACE FUNCTION public.save_project_boq(p_project_id uuid, p_changes jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  draft public.projects;
  saved_items jsonb;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Expected project changes and a list of BOQ items';
  END IF;

  SELECT * INTO STRICT draft FROM public.projects WHERE id = p_project_id FOR UPDATE;
  draft := jsonb_populate_record(draft, p_changes);
  UPDATE public.projects SET
    name = draft.name, location = draft.location, scope = draft.scope,
    labor_preference = draft.labor_preference, selected_stages = draft.selected_stages,
    status = draft.status, soil_type = draft.soil_type, site_slope = draft.site_slope,
    geotech_report_uploaded = draft.geotech_report_uploaded,
    geotech_report_uploaded_at = draft.geotech_report_uploaded_at,
    geotech_report_document_id = draft.geotech_report_document_id,
    geotech_analysis_mode = draft.geotech_analysis_mode, house_extras = draft.house_extras,
    total_usd = 0, total_zwg = 0
  WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project is unavailable for editing'; END IF;

  DELETE FROM public.boq_items WHERE project_id = p_project_id;
  INSERT INTO public.boq_items
    (project_id, material_id, material_name, category, quantity, unit, unit_price_usd, unit_price_zwg, notes, sort_order)
  SELECT p_project_id, line.material_id, line.material_name, line.category, line.quantity,
         line.unit, line.unit_price_usd, line.unit_price_zwg, line.notes, line.sort_order
  FROM jsonb_to_recordset(p_items) AS line(material_id text, material_name text, category text,
    quantity numeric, unit text, unit_price_usd numeric, unit_price_zwg numeric, notes text, sort_order integer);

  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order, b.id), '[]'::jsonb)
    INTO saved_items FROM public.boq_items b WHERE b.project_id = p_project_id;
  SELECT * INTO STRICT draft FROM public.projects WHERE id = p_project_id;
  RETURN jsonb_build_object('project', to_jsonb(draft), 'items', saved_items);
END;
$$;
REVOKE ALL ON FUNCTION public.save_project_boq(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_boq(uuid, jsonb, jsonb) TO authenticated;
