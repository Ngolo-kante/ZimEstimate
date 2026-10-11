-- ─── Connecting Telegram without typing a chat ID ─────────────────────────
--
-- Telegram reminders needed profiles.telegram_chat_id, and the app told
-- people to "add your Telegram chat ID in Account Settings" — but Settings
-- had no such field, and nobody knows their chat ID anyway. So no Telegram
-- reminder could ever be scheduled.
--
-- Now Settings → Connect Telegram creates a one-time code and opens the bot
-- at t.me/<bot>?start=<code>. Pressing Start sends the code to our webhook
-- (/api/telegram/webhook), which stores the chat ID against the account the
-- code belongs to. Codes expire after 30 minutes and are cleared on use.
-- Only the server (service role) reads or writes these columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_link_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_link_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_token_key
  ON public.profiles (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;
