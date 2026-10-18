-- Plumbing & Electrical as a stage of its own (2026-10-18).
--
-- Plumbers and electricians are separate trades, quoted and paid separately,
-- so their materials and labour now sit in their own BOQ stage between
-- Finishing and Exterior instead of inside Finishing. BOQ lines use
-- boq_category 'services'.
--
-- create_default_stages (049) reads default_stage_config, so new projects get
-- the stage from the row added here. Existing projects get it too, applicable
-- wherever their Finishing stage is, with the default tasks.

UPDATE public.default_stage_config SET sort_order = 5 WHERE boq_category = 'exterior';

INSERT INTO public.default_stage_config (boq_category, name, description, sort_order, default_tasks) VALUES
('services', 'Plumbing & Electrical', 'Water supply, drainage, sanitaryware and wiring', 4, '[
    {"title": "Get plumbing and electrical quotes", "description": "These trades quote separately from the builder"},
    {"title": "First fix before plastering", "description": "Conduits, boxes and pipes chased into the walls before plaster"},
    {"title": "Book the ZESA and water connections", "description": "Apply early: connections can take weeks"}
]'::jsonb)
ON CONFLICT (boq_category) DO NOTHING;

UPDATE public.project_stages SET sort_order = 5 WHERE boq_category = 'exterior' AND sort_order = 4;

WITH added AS (
    INSERT INTO public.project_stages (project_id, boq_category, name, description, sort_order, is_applicable, status)
    SELECT ps.project_id, 'services', 'Plumbing & Electrical', 'Water supply, drainage, sanitaryware and wiring', 4, ps.is_applicable, 'planning'
    FROM public.project_stages ps
    WHERE ps.boq_category = 'finishing'
    ON CONFLICT (project_id, boq_category) DO NOTHING
    RETURNING id
)
INSERT INTO public.stage_tasks (stage_id, title, description, sort_order, is_default, is_completed)
SELECT added.id, task.value->>'title', task.value->>'description', (task.ordinality - 1)::int, TRUE, FALSE
FROM added
CROSS JOIN public.default_stage_config dsc
CROSS JOIN LATERAL jsonb_array_elements(dsc.default_tasks) WITH ORDINALITY AS task(value, ordinality)
WHERE dsc.boq_category = 'services';
