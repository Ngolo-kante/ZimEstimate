# Security Runbook

## Launch Baseline

- All privileged routes must require authenticated access and the correct role boundary.
- `CSRF_SECRET` must be explicitly configured; do not rely on fallback values.
- Public launch should not depend on process-local rate limiting as the only protection. Use platform throttling or a shared store for production traffic.
- Service-role Supabase usage must stay server-side only.

## Secrets

- Store all provider secrets in the deployment platform and GitHub repository secrets only.
- Rotate immediately after any supplier/admin compromise, exposed logs, or leaked preview environment.
- Keep a dated secret inventory for:
  - Supabase anon and service-role credentials
  - Gemini
  - Firecrawl
  - WhatsApp / Twilio / Telegram / Resend
  - Reminder dispatch secret
  - CSRF secret

## API Route Review Targets

- `/api/scraper/*`
- `/api/reminders/dispatch`
- `/api/notifications/dispatch`
- `/api/vision/analyze`
- `/api/admin/*`

For each target, verify:

- Authentication requirement
- Role requirement
- Rate limiting strategy
- Secret/config dependency
- Logging behavior
- Failure path safety

## Incident Response

- Disable or isolate the affected provider or route.
- Rotate relevant secrets.
- Review logs, affected records, and queued operations.
- Re-run smoke checks for auth, BOQ, supplier/admin, and messaging flows before reopening access.
