-- Run against a migrated disposable database. All fixtures roll back.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('f943353f-ecea-43d0-a98f-a89ae7ce7d91', 'atomic-save@example.invalid');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'f943353f-ecea-43d0-a98f-a89ae7ce7d91';
INSERT INTO public.projects (id, owner_id, name) VALUES
  ('213472ae-d625-4997-bf75-79cb505e4a26', auth.uid(), 'Original draft');

DO $test$
DECLARE
  pid uuid := '213472ae-d625-4997-bf75-79cb505e4a26';
  line jsonb := '{"material_id":"brick","material_name":"Bricks","category":"Walls","quantity":100,"unit":"each","unit_price_usd":10,"unit_price_zwg":270,"sort_order":0}';
  result jsonb;
  original_item_id uuid;
BEGIN
  result := public.save_project_boq(pid, '{"name":"Saved draft"}', jsonb_build_array(line));
  original_item_id := (result->'items'->0->>'id')::uuid;
  IF (result->'project'->>'total_usd')::numeric IS DISTINCT FROM 1000 OR original_item_id IS NULL THEN
    RAISE EXCEPTION 'Save must return the committed project and its priced lines';
  END IF;

  BEGIN
    PERFORM public.save_project_boq(pid, '{"name":"Interrupted save"}', jsonb_build_array(line - 'unit'));
    RAISE EXCEPTION 'Expected an invalid line to fail';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT FROM public.projects WHERE id = pid AND name = 'Saved draft' AND total_usd = 1000)
     OR NOT EXISTS (SELECT FROM public.boq_items WHERE id = original_item_id AND project_id = pid) THEN
    RAISE EXCEPTION 'A failed replacement changed the last good estimate';
  END IF;

  -- Marketplace adds one row; the totals trigger is the single writer.
  INSERT INTO public.boq_items (project_id, material_id, material_name, category, quantity, unit, unit_price_usd, unit_price_zwg)
    VALUES (pid, 'cement', 'Cement', 'Walls', 10, 'bag', 10, 270);
  IF NOT EXISTS (SELECT FROM public.projects WHERE id = pid AND total_usd = 1100 AND total_zwg = 29700) THEN
    RAISE EXCEPTION 'The material should affect each currency total once';
  END IF;
  PERFORM public.save_project_boq(pid, '{}', jsonb_build_array(line));
  result := public.save_project_boq(pid, '{}', jsonb_build_array(line));
  IF jsonb_array_length(result->'items') <> 1 OR (result->'project'->>'total_usd')::numeric <> 1000 THEN
    RAISE EXCEPTION 'Retry duplicated the estimate';
  END IF;
  result := public.save_project_boq(pid, '{}', '[]');
  IF result->'items' <> '[]'::jsonb OR (result->'project'->>'total_usd')::numeric <> 0 THEN
    RAISE EXCEPTION 'Saving an intentionally empty estimate must clear its total';
  END IF;
END;
$test$;
SET LOCAL request.jwt.claim.sub = '0d0bea4b-e313-4f23-bb25-e328b0bfe56c';
DO $test$
BEGIN
  PERFORM public.save_project_boq('213472ae-d625-4997-bf75-79cb505e4a26', '{"name":"Other user"}', '[]');
  RAISE EXCEPTION 'A different user could replace the estimate';
EXCEPTION WHEN no_data_found OR insufficient_privilege THEN NULL;
END;
$test$;
ROLLBACK;
