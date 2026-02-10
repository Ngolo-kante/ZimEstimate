-- Remove legacy milestone tables now replaced by project_stages

DROP TABLE IF EXISTS milestone_tasks;
DROP TABLE IF EXISTS project_milestones;
