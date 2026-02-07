-- ============================================
-- 011: Recurring Reminders, Usage Notifications, Procurement Requests
-- ============================================

-- 1) Extend reminder_type enum for usage reminders
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'usage';

-- 2) Recurring reminders (one per project/user/type)
CREATE TABLE IF NOT EXISTS project_recurring_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reminder_type reminder_type NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    channel TEXT NOT NULL,
    amount_usd DECIMAL(12,2),
    target_date DATE,
    next_run_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id, reminder_type)
);

ALTER TABLE project_recurring_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or owned project reminders"
    ON project_recurring_reminders FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own reminders for owned/shared projects"
    ON project_recurring_reminders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.shared_with_user_id = auth.uid()
                    AND ps.access_level = 'edit'
                )
            )
        )
    );

CREATE POLICY "Users can update own reminders"
    ON project_recurring_reminders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
    ON project_recurring_reminders FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_recurring_reminders_project
    ON project_recurring_reminders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_recurring_reminders_user
    ON project_recurring_reminders(user_id);

CREATE TRIGGER update_project_recurring_reminders_updated_at
    BEFORE UPDATE ON project_recurring_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) Project notifications (for owner updates)
CREATE TABLE IF NOT EXISTS project_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON project_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Project members can create owner notifications"
    ON project_notifications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND p.owner_id = user_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.shared_with_user_id = auth.uid()
                    AND ps.access_level = 'edit'
                )
            )
        )
    );

CREATE POLICY "Users can update own notifications"
    ON project_notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON project_notifications FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_notifications_user
    ON project_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_project
    ON project_notifications(project_id);

-- 4) Procurement requests (RFQs)
CREATE TABLE IF NOT EXISTS procurement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    supplier_id TEXT,
    supplier_name TEXT NOT NULL,
    supplier_email TEXT,
    supplier_phone TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'requested', 'received', 'approved', 'ordered', 'cancelled')),
    notes TEXT,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view procurement requests"
    ON procurement_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.shared_with_user_id = auth.uid()
                    AND ps.access_level = 'edit'
                )
            )
        )
    );

CREATE POLICY "Project members can create procurement requests"
    ON procurement_requests FOR INSERT
    WITH CHECK (
        requested_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.shared_with_user_id = auth.uid()
                    AND ps.access_level = 'edit'
                )
            )
        )
    );

CREATE POLICY "Project members can update procurement requests"
    ON procurement_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_shares ps
                    WHERE ps.project_id = p.id
                    AND ps.shared_with_user_id = auth.uid()
                    AND ps.access_level = 'edit'
                )
            )
        )
    );

CREATE INDEX IF NOT EXISTS idx_procurement_requests_project
    ON procurement_requests(project_id);

CREATE TRIGGER update_procurement_requests_updated_at
    BEFORE UPDATE ON procurement_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5) Helper function to enqueue due recurring reminders
CREATE OR REPLACE FUNCTION enqueue_due_project_reminders()
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER := 0;
BEGIN
    WITH due AS (
        SELECT r.*
        FROM project_recurring_reminders r
        WHERE r.is_active = TRUE
          AND r.next_run_at <= NOW()
          AND (r.target_date IS NULL OR r.next_run_at::date <= r.target_date)
    ),
    ins AS (
        INSERT INTO reminders (
            user_id,
            project_id,
            reminder_type,
            message,
            scheduled_date,
            phone_number,
            is_sent
        )
        SELECT
            d.user_id,
            d.project_id,
            d.reminder_type,
            CASE
                WHEN d.reminder_type = 'savings' THEN
                    '[' || UPPER(d.channel) || '] Savings reminder: set aside '
                    || COALESCE(TO_CHAR(d.amount_usd, 'FM999,999,999.00'), 'your planned amount')
                    || ' for this project.'
                WHEN d.reminder_type = 'usage' THEN
                    '[' || UPPER(d.channel) || '] Usage reminder: log today''s materials usage for your project.'
                ELSE
                    '[' || UPPER(d.channel) || '] Project reminder.'
            END AS message,
            d.next_run_at,
            COALESCE(pr.phone_number, '0000000000') AS phone_number,
            FALSE
        FROM due d
        JOIN profiles pr ON pr.id = d.user_id
        RETURNING 1
    ),
    upd AS (
        UPDATE project_recurring_reminders r
        SET next_run_at = CASE
            WHEN r.frequency = 'daily' THEN r.next_run_at + INTERVAL '1 day'
            WHEN r.frequency = 'weekly' THEN r.next_run_at + INTERVAL '7 days'
            WHEN r.frequency = 'monthly' THEN r.next_run_at + INTERVAL '30 days'
            ELSE r.next_run_at + INTERVAL '7 days'
        END
        FROM due d
        WHERE r.id = d.id
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM ins;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
