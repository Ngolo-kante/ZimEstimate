# Route Matrix

## Public / Indexable

| Route | Purpose | Audience | Launch Expectation |
| --- | --- | --- | --- |
| `/home` | Main marketing and product entry | Public | Must be polished, responsive, and indexable |
| `/marketplace` | Material discovery and price exploration | Public | Must load without auth and show credible data states |
| `/marketplace/suppliers` | Supplier directory | Public | Must support browse and detail navigation |
| `/market-insights` | Market reports / pricing context | Public | Must be indexable and current |
| `/quick-projects` | Public quick calculator entry | Public | Must be stable on mobile and desktop |
| `/privacy` | Trust / legal | Public | Must be accessible from footer |
| `/terms` | Trust / legal | Public | Must be accessible from footer |
| `/support` | Support entry | Public | Must be accessible from footer |

## Public but Non-Indexable / Utility

| Route | Purpose | Audience | Launch Expectation |
| --- | --- | --- | --- |
| `/auth/login` | Account access | Public | Must support redirect continuation |
| `/auth/signup` | Account creation | Public | Must support redirect continuation |
| `/auth/callback` | OAuth / confirmation handling | Public utility | Must be reliable and observable |
| `/upgrade` | Commercial / plan messaging | Public utility | Must match current pricing policy |
| `/offline` | PWA offline state | Public utility | Must not strand users in stale state |

## Authenticated User

| Route Group | Audience | Launch Expectation |
| --- | --- | --- |
| `/dashboard`, `/projects`, `/projects/dashboard`, `/projects/new`, `/projects/[id]`, `/projects/quick` | Signed-in builders | Must support create, reopen, edit, archive, procurement, and budget workflows |
| `/boq/new`, `/export`, `/analytics`, `/notifications`, `/settings` | Signed-in builders | Must be stable across happy path and empty/error states |
| `/ai`, `/ai/vision-takeoff`, `/ai/quote-scanner`, `/ai/inflation-engine` | Signed-in builders | Must degrade safely when provider or file inputs fail |

## Supplier / Partner

| Route Group | Audience | Launch Expectation |
| --- | --- | --- |
| `/supplier/register`, `/supplier/dashboard`, `/supplier/profile/edit`, `/supplier/products/add`, `/supplier/products/edit/[id]`, `/supplier/analytics` | Suppliers | Must enforce access control and clear onboarding/error states |

## Admin / Internal

| Route Group | Audience | Launch Expectation |
| --- | --- | --- |
| `/admin/suppliers`, `/admin/scraper-review`, `/scraper` | Admin only | Must require admin access, log failures, and have operator runbooks |
| `/api/admin/*`, `/api/scraper/*`, `/api/reminders/dispatch`, `/api/notifications/dispatch` | Operational / privileged | Must have explicit auth, rate limiting, and secrets configured |
| `/api/health`, `/api/ready` | Operators / uptime checks | Must stay unauthenticated, no-store, and accurately reflect runtime readiness |

## Test Coverage Status

- Automated now: BOQ wizard smoke, public pages smoke, authenticated project creation smoke, unit tests for core pricing and security helpers.
- Manual still required before launch: supplier workflows, admin workflows, reminder dispatch, notification dispatch, marketplace procurement, AI degraded paths, and full mobile Safari QA.
