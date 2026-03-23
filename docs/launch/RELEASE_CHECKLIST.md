# Release Checklist

## Before Cutting a Release

- Confirm `npm run check:env` passes against the target environment.
- Confirm `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:unit` pass on the release commit.
- Run `npm run test:e2e:smoke` against preview or a clean release candidate.
- Review `docs/launch/ROUTE_MATRIX.md` and confirm each in-scope route has a named owner and verification result.
- Confirm Supabase migrations queued for release have rollback notes.
- Confirm notification, reminder, and scraping provider credentials are present and tested.

## Release Day

- Deploy from a clean commit that passed CI.
- Run a manual smoke pass:
  - Home page
  - Login and signup
  - Project creation
  - BOQ save/reopen
  - Marketplace browse
  - Supplier register or supplier dashboard access
  - Admin scraper access
- Verify cron/dispatch monitoring, error monitoring, and logs are live.
- Verify `/api/health` returns `200` and `/api/ready` returns `200` in the deployed environment.

## Rollback Triggers

- Production build mismatch or broken asset delivery
- Auth failures or redirect loops
- BOQ save/load corruption
- Scraper/admin route failures that affect public data freshness
- Reminder/notification misfires or duplicate sends
- Supabase migration issues or RLS regressions

## After Release

- Review analytics for acquisition, signup conversion, first project created, first BOQ saved, and AI tool usage.
- Review error logs and operator queues within the first hour and first day.
- Record incidents, mitigations, and follow-up fixes in the launch issue tracker.
