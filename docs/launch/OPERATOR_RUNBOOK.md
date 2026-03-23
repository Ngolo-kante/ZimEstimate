# Operator Runbook

## Scraper Failures

- Check the weekly GitHub scrape workflow and admin scraper routes.
- Inspect `scraper_logs`, `price_observations`, and recent supplier/material changes.
- If a source selector breaks, disable the scraper config, fix selectors, and rerun a targeted test before bulk runs.

## Reminder / Notification Issues

- Verify the provider credentials and dispatch secret first.
- Inspect queued reminder and notification records for backlog, duplicates, and failure messages.
- Test one safe delivery to a sandbox or internal recipient before re-enabling bulk dispatch.

## Supplier / Marketplace Issues

- Confirm supplier onboarding, verification, and product records are consistent.
- Review public supplier visibility separately from supplier dashboard access.
- If pricing appears stale, correlate marketplace display with latest scrape timestamps.

## Core User Incidents

- For auth issues, test login, signup, callback, and protected-route access.
- For BOQ issues, test create, save, reopen, and export on a fresh project.
- For project dashboard issues, test project list load and direct project deep links.

## Emergency Controls

- Restrict or disable admin-only routes if abuse or provider instability appears.
- Pause scraping or outbound messaging before allowing repeated failed retries.
- Roll back to the last known-good deployment if build-safe but runtime-unsafe behavior appears after release.
