# ZimEstimate

ZimEstimate is a Next.js + Supabase application for Zimbabwe construction estimating, procurement, supplier discovery, AI-assisted takeoff, and project tracking.

## Core Commands

Use Node 20 for local development and CI. The repo includes `.nvmrc` and CI is pinned to Node 20.

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm run test:e2e:smoke
npm run check:env
```

## Release Gate

Every release candidate must pass:

```bash
npm run check:env
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

For release branches or `main`, also run:

```bash
npm run test:e2e:smoke
```

## Launch Docs

- `docs/launch/README.md`
- `docs/launch/ENV_CONTRACT.md`
- `docs/launch/ROUTE_MATRIX.md`
- `docs/launch/RELEASE_CHECKLIST.md`
- `docs/launch/SECURITY_RUNBOOK.md`
- `docs/launch/OPERATOR_RUNBOOK.md`

## Deployment Notes

- Stack: Next.js App Router + Supabase
- Hosting assumption: Vercel + Supabase
- Public site URL should be set via `NEXT_PUBLIC_SITE_URL`
- Run `npm run check:env` before any preview or production deployment
- Liveness endpoint: `/api/health`
- Readiness endpoint: `/api/ready`
