# Security review — 16 October 2026

Scope: repository-level review of the Next.js 16 application, API handlers, Supabase access boundaries and migrations. This was not a live penetration test or a verification of the production database configuration. The site handles account data, project budgets, floor plans, contact details and supplier enquiries.

## Changes made

| Risk | Change |
| --- | --- |
| Suspended accounts could still use server APIs and sign in | Admin suspension now bans the Supabase Auth identity; reactivation unbans it. Server authorization and both private-photo routes reject suspended profiles. An admin cannot suspend their own account. |
| Admin scraper DNS rebinding | The HTTP connection now pins the DNS address that passed public-IP validation. Every redirect is resolved and checked afresh; response size and redirect limits remain in place. |
| Public AI route allowed cross-origin preflight | Removed the wildcard `OPTIONS` response from the plan-reading endpoint. Production origin checks reject requests when the configured allow-list is absent. |
| Public readiness endpoint exposed deployment configuration | `/api/ready` now returns only readiness status and service name. |
| Revoked shared-estimate preview could remain cached | Saved-estimate OG images now use `Cache-Control: private, no-store`. |

## OWASP Top 10 assessment

| Category | Status | Assessment |
| --- | --- | --- |
| A01 Broken access control | Partially verified | Admin routes call `requireAdmin`; project/quick-estimate photo routes check access via `site_access`/`quick_site_access`. Supabase RLS migrations exist, but their production deployment and every policy were not verified. Existing access tokens can still reach Supabase directly until expiry after an account is suspended. |
| A02 Cryptographic failures | Partially verified | HSTS and HTTPS upgrade headers are configured; service-role credentials are server-side in reviewed code. Production secret storage, rotation and TLS configuration were not inspected. |
| A03 Injection | No confirmed flaw in reviewed paths | React escapes rendered text; reviewed database calls use Supabase query methods; email templates escape user input. This is not a complete payload-level test of every page or document parser. |
| A04 Insecure design | Open follow-up | Public AI endpoints intentionally allow anonymous use and use distributed IP limits. Automated abuse across many IPs can still incur provider cost; add account quotas or a challenge if abuse appears. |
| A05 Security misconfiguration | Improved | Removed public configuration details and wildcard CORS preflight. CSP, HSTS, frame and MIME protections are present. Production CSP still permits inline scripts and styles, so an XSS would have less containment than a nonce-based policy. |
| A06 Vulnerable components | Not verified | Lockfile reviewed and the production build passes. The registry advisory endpoint was unavailable here, so a fresh dependency vulnerability scan must run in CI or a networked environment. |
| A07 Identification/authentication failures | Improved, residual risk | Suspension now blocks new Auth sessions and guarded server endpoints. Supabase documents that existing JWT access tokens remain valid until expiry; direct client-to-Supabase data paths require a database-level suspension policy for immediate cutoff. |
| A08 Software/data integrity failures | Partially verified | Lockfile is present; no untrusted executable download path was found in reviewed routes. CI provenance and deployment permissions were not inspected. |
| A09 Logging/monitoring failures | Partially verified | Admin suspension/reactivation records audit events, and API failures log server-side. Alerting, log retention and incident-response drills were not verified. |
| A10 Server-side request forgery | Improved | Admin scraper already rejected private IPs and limited redirects, but it performed an unchecked second DNS resolution. Connections now use the validated address. |

## Deployment checks still needed

1. Verify that security migrations `047_security_hardening.sql` and `049_harden_privileged_database_interfaces.sql` are applied in production, including profile role update grants and rate-limit RPC permissions.
2. Add database-level checks for suspended users on sensitive RLS policies or shorten JWT lifetime; an Auth ban does not immediately invalidate existing access tokens used directly against Supabase.
3. Confirm production origin environment values and test the plan reader, support and enquiry forms from the real domain after deploying the fail-closed origin change.
4. Run a fresh dependency advisory scan in a networked CI job, review results, and verify alerting on failed rate limits and unusual AI usage.
5. Check the privacy retention job and access controls for stored floor-plan samples against the published privacy policy.

Validation here: TypeScript, ESLint, Vitest and `npm run build` passed. No production accounts or data were changed.
