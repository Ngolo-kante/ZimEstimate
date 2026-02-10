-- Notification preferences + delivery tracking for Phase 6

-- ============================================
-- 1. ADD NOTIFICATION PREFERENCE COLUMNS
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notify_push BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notify_rfq BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_quote_updates BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_price_alerts BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_project_reminders BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill WhatsApp preference from legacy whatsapp_reminders
UPDATE profiles
SET notify_whatsapp = whatsapp_reminders
WHERE notify_whatsapp IS DISTINCT FROM whatsapp_reminders;

-- ============================================
-- 2. NOTIFICATION DELIVERY TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
    template_key TEXT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user
    ON notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
    ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created_at
    ON notification_deliveries(created_at DESC);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification deliveries"
    ON notification_deliveries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notification deliveries"
    ON notification_deliveries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification deliveries"
    ON notification_deliveries FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT,
    auth TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_unique
    ON push_subscriptions(user_id, endpoint);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);
