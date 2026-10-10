# Environment Contract

## Required Runtime Variables

These are required before preview or production deployment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_GEMINI_API_KEY`
- `CSRF_SECRET`
- `REMINDER_DISPATCH_SECRET`
- `CRON_SECRET`

## Optional Reminder / Notification Variables

Configure these only for the channels you intend to operate:

- `WHATSAPP_API_URL`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_TOKEN`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `RESEND_API_KEY`
- `REMINDER_EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`
- `TELEGRAM_BOT_TOKEN`

## Optional Product Analytics

- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog project token. Leave empty to disable product analytics and its consent controls.
- `NEXT_PUBLIC_POSTHOG_HOST`: ingestion host for that project; defaults to `https://us.i.posthog.com`.

The SDK initializes only after analytics consent is granted. Page views and selected product actions are recorded; signed-in users are linked by account ID. Session recording and automatic interaction capture are disabled. URLs have query strings and fragments removed, and budget events use ranges. The footer's Privacy choices button allows withdrawal.

These are build-time public variables: restart development or rebuild a deployment after changing them.

## Optional Pricing Tools

- `FIRECRAWL_API_KEY`: required only for workflows that use Firecrawl.

## CI / Release Secrets

The GitHub Actions workflow expects the following repository secrets for baseline CI and smoke E2E:

- All required runtime variables above
- `PLAYWRIGHT_E2E_EMAIL`
- `PLAYWRIGHT_E2E_PASSWORD`

## Rules

- Do not ship with placeholder or fallback CSRF secrets.
- Keep preview and production secrets separate.
- Rotate provider secrets after any incident involving supplier/admin flows, scraping, or outbound messaging.
- Run `npm run check:env` before every deployment.
