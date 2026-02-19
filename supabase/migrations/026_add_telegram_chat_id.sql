-- Add Telegram chat id for per-user Telegram reminder delivery
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Optional uniqueness guard when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id_unique
    ON profiles(telegram_chat_id)
    WHERE telegram_chat_id IS NOT NULL;
