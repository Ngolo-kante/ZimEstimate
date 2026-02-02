-- ZimEstimate Database Schema Update
-- Purchase Tracking & Reminders Features
-- Run this AFTER 001_initial_schema.sql

-- ============================================
-- 1. ADD NEW COLUMNS TO PROFILES
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_reminders BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- 2. ADD NEW COLUMNS TO PROJECTS
-- ============================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS budget_target_usd DECIMAL(12,2);

-- ============================================
-- 3. ADD NEW COLUMNS TO BOQ_ITEMS
-- ============================================

ALTER TABLE boq_items
ADD COLUMN IF NOT EXISTS actual_quantity DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS actual_price_usd DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS purchased_date TIMESTAMPTZ;

-- Index for filtering purchased items
CREATE INDEX IF NOT EXISTS idx_boq_items_is_purchased ON boq_items(is_purchased);

-- ============================================
-- 4. CREATE REMINDER TYPE ENUM
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_type') THEN
        CREATE TYPE reminder_type AS ENUM ('material', 'savings', 'deadline');
    END IF;
END $$;

-- ============================================
-- 5. CREATE REMINDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_id UUID REFERENCES boq_items(id) ON DELETE CASCADE,
    reminder_type reminder_type NOT NULL,
    message TEXT NOT NULL,
    scheduled_date TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN NOT NULL DEFAULT FALSE,
    phone_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminders
CREATE POLICY "Users can view own reminders"
    ON reminders FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create reminders for their own projects
CREATE POLICY "Users can create reminders for own projects"
    ON reminders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = reminders.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Users can update their own reminders
CREATE POLICY "Users can update own reminders"
    ON reminders FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY "Users can delete own reminders"
    ON reminders FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 6. INDEXES FOR REMINDERS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_project_id ON reminders(project_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_date ON reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_reminders_is_sent ON reminders(is_sent);

-- Composite index for finding unsent reminders to process
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(scheduled_date, is_sent) WHERE is_sent = FALSE;

-- ============================================
-- 7. HELPER FUNCTION FOR PURCHASE STATS
-- ============================================

CREATE OR REPLACE FUNCTION get_project_purchase_stats(p_project_id UUID)
RETURNS TABLE (
    total_items INTEGER,
    purchased_items INTEGER,
    estimated_total DECIMAL(12,2),
    actual_spent DECIMAL(12,2),
    remaining_budget DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_items,
        COUNT(*) FILTER (WHERE is_purchased = TRUE)::INTEGER as purchased_items,
        COALESCE(SUM(quantity * unit_price_usd), 0) as estimated_total,
        COALESCE(SUM(
            CASE WHEN is_purchased = TRUE THEN
                COALESCE(actual_quantity, quantity) * COALESCE(actual_price_usd, unit_price_usd)
            ELSE 0 END
        ), 0) as actual_spent,
        COALESCE(SUM(quantity * unit_price_usd), 0) -
        COALESCE(SUM(
            CASE WHEN is_purchased = TRUE THEN
                COALESCE(actual_quantity, quantity) * COALESCE(actual_price_usd, unit_price_usd)
            ELSE 0 END
        ), 0) as remaining_budget
    FROM boq_items
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION TO GET PENDING REMINDERS
-- ============================================

CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    project_id UUID,
    item_id UUID,
    reminder_type reminder_type,
    message TEXT,
    scheduled_date TIMESTAMPTZ,
    phone_number TEXT,
    project_name TEXT,
    user_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.user_id,
        r.project_id,
        r.item_id,
        r.reminder_type,
        r.message,
        r.scheduled_date,
        r.phone_number,
        p.name as project_name,
        pr.email as user_email
    FROM reminders r
    JOIN projects p ON p.id = r.project_id
    JOIN profiles pr ON pr.id = r.user_id
    WHERE r.is_sent = FALSE
    AND r.scheduled_date <= NOW()
    ORDER BY r.scheduled_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCTION TO MARK REMINDER AS SENT
-- ============================================

CREATE OR REPLACE FUNCTION mark_reminder_sent(reminder_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE reminders
    SET is_sent = TRUE
    WHERE id = reminder_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Purchase tracking and reminders ready.
-- ============================================
