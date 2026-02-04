-- Add multi-stage selection and usage tracking toggle

ALTER TABLE projects ADD COLUMN IF NOT EXISTS selected_stages TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS usage_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Update create_default_stages to respect selected_stages when present
CREATE OR REPLACE FUNCTION create_default_stages(p_project_id UUID, p_scope TEXT)
RETURNS void AS $$
DECLARE
    stage_config RECORD;
    new_stage_id UUID;
    task_item JSONB;
    task_sort INTEGER;
    selected_stages TEXT[];
BEGIN
    SELECT selected_stages INTO selected_stages
    FROM projects
    WHERE id = p_project_id;

    -- Loop through each default stage configuration
    FOR stage_config IN
        SELECT * FROM default_stage_config ORDER BY sort_order
    LOOP
        INSERT INTO project_stages (
            project_id,
            boq_category,
            name,
            description,
            sort_order,
            is_applicable,
            status
        ) VALUES (
            p_project_id,
            stage_config.boq_category,
            stage_config.name,
            stage_config.description,
            stage_config.sort_order,
            CASE
                WHEN selected_stages IS NULL OR array_length(selected_stages, 1) IS NULL THEN
                    CASE
                        WHEN p_scope = 'entire_house' THEN TRUE
                        WHEN p_scope = stage_config.boq_category THEN TRUE
                        ELSE FALSE
                    END
                ELSE stage_config.boq_category = ANY(selected_stages)
            END,
            'planning'
        )
        RETURNING id INTO new_stage_id;

        -- Create default tasks for this stage
        task_sort := 0;
        FOR task_item IN SELECT * FROM jsonb_array_elements(stage_config.default_tasks)
        LOOP
            INSERT INTO stage_tasks (
                stage_id,
                title,
                description,
                sort_order,
                is_default,
                is_completed
            ) VALUES (
                new_stage_id,
                task_item->>'title',
                task_item->>'description',
                task_sort,
                TRUE,
                FALSE
            );
            task_sort := task_sort + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update existing stages to respect selected_stages (if already set)
UPDATE project_stages ps
SET is_applicable = (ps.boq_category = ANY(p.selected_stages))
FROM projects p
WHERE ps.project_id = p.id
AND p.selected_stages IS NOT NULL
AND array_length(p.selected_stages, 1) > 0;
