# Launch Docs

This folder contains the repo-owned launch package for ZimEstimate.

## Documents

- `ENV_CONTRACT.md`: required and optional runtime configuration, plus CI secrets.
- `ROUTE_MATRIX.md`: public, authenticated, supplier, admin, and operational route inventory.
- `RELEASE_CHECKLIST.md`: pre-release, release-day, and post-release checks.
- `SECURITY_RUNBOOK.md`: auth, secrets, API protection, and launch hardening expectations.
- `OPERATOR_RUNBOOK.md`: incident handling for scraping, reminders, notifications, and supplier/admin operations.

## Required Release Gate

Run these from a clean checkout:

```bash
npm run check:env
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

For `main` and release branches:

```bash
npm run test:e2e:smoke
```
