# Resume check — 4 October 2026

## Current state

Work remains local and uncommitted on `unified`. No deployment, database migration, production write, or real analytics event was performed during this check. The latest existing commit is `fb2d8f5` (18 August 2026).

The pre-existing unfinished work comprises:

- PostHog product events and an analytics consent banner.
- `/cost-to-build-a-house-in-zimbabwe`, with calculator links and search metadata.
- Mobile demo recordings, assembly scripts, and a Shona voiceover draft.

The July handovers are historical. Contractor registration, project RFQs, and later mobile/security changes already exist. CI now includes the `unified` branch, superseding the warning in `ARCHITECTURE.md`.

## Fixes made during the check

- PostHog previously contacted its configuration endpoints and persisted browser identifiers before acceptance. SDK initialization now waits for consent; automated tests verify zero PostHog requests and storage before acceptance and after declining.
- Consent changes propagate across tabs. Withdrawal stops capture and clears SDK persistence and first-landing attribution. A blocked storage write still honours the choice for the current page.
- Sign-out clears analytics identity through the authentication event listener, including sign-out from another tab, and restores the visitor's explicit consent after the SDK resets it.
- Analytics failures no longer interrupt application actions. URL query strings and fragments are removed from absolute, relative, and nested URL properties before event capture.
- The consent banner accurately describes account-ID-linked events. Privacy choices is hidden when analytics is not configured, and footer links use working styled-jsx selectors.
- The house-cost guide no longer claims a September 2026 price review; it explains that figures use the estimator's reference catalogue rather than live quotations.
- `.env.local.example` now includes `CRON_SECRET` and `GOOGLE_GEMINI_API_KEY`, with analytics disabled until a real project token is supplied. Environment documentation and the optional host warning match runtime behaviour.
- The documented demo recorder option `--only 2` now selects scene 2; invalid scene selections fail clearly.

## Verification

| Check | Result |
| --- | --- |
| `npm run check:env` | Passed; required variables present |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed, including TypeScript and 76 generated pages |
| `npm run test:unit` | 260 tests passed in 28 files |
| Public smoke tests plus disabled-analytics test | 9 passed |
| Configured analytics browser regression | Passed separately with a dummy key and intercepted ingestion |
| Local `/api/health` and `/api/ready` | Both HTTP 200; readiness checks configuration presence, not database connectivity |
| Mobile guide and calculator | 320px consent layout inspected; 390px plan navigation restored 80m² with no overflow or page errors |
| Demo scripts | Both pass `node --check`; recording was not rerun against production |

The final normal-configuration browser run skipped two cases: authenticated project creation (credentials unavailable), and configured analytics (successfully tested in the separate run). These are not two untested features.

To repeat the normal browser checks:

```sh
npx playwright test tests/public-pages-smoke.spec.ts tests/project-creation-smoke.spec.ts tests/product-analytics.spec.ts --workers=2
```

To repeat the configured analytics test, first stop any existing development server so Playwright starts one with the test configuration:

```sh
NEXT_PUBLIC_POSTHOG_KEY=phc_local_review NEXT_PUBLIC_POSTHOG_HOST=http://127.0.0.1:3000/ingest npx playwright test tests/product-analytics.spec.ts --workers=1
```

The test intercepts ingestion locally and accounts for the SDK's automated-browser filtering. Do not use a production project token for this test.

## Remaining work

1. Configure dedicated `PLAYWRIGHT_E2E_EMAIL` and `PLAYWRIGHT_E2E_PASSWORD` credentials, then verify signed-in project creation, save/reopen, and project workflows. None were exercised with a real account during this check.
2. Before enabling PostHog, choose its project/region and align the existing privacy policy with account-linked, consent-based analytics. The policy still contains generic anonymised-analytics wording and unresolved company-registration/address placeholders. This check did not certify its legal or operational claims.
3. Add the intended PostHog public token and host, then rebuild and verify actual event delivery. The local configuration currently leaves analytics disabled. Optional notification provider credentials are also absent.
4. Finish the demo voiceover. `output/demo-videos/zimestimate-demo-shona.mp4` is a 34.4-second, 1080×1920 H.264 video with no audio track. A voiceover script exists in `output/demo-assets/voiceover-shona.md`.
5. Review the combined uncommitted work before committing or deploying. Existing media outputs have been preserved.

Development emitted a CSP warning for Vercel's external debug analytics script. The public app remained functional; production Vercel analytics delivery was not checked.
