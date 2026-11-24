# Weekly price collection (cron-job.org)

ZimEstimate collects ZBMS prices once a week through `https://zimestimate.com/api/cron/prices`.
Vercel's free plan only allows two scheduled jobs and both are taken, so a free
cron-job.org job calls this address instead.

## What a run does

1. Reads the ZBMS product matches you have confirmed at **/admin/price-matches**.
   Only confirmed matches are priced; with none confirmed, nothing is written.
2. Reads those products' current prices from the ZBMS shop.
3. Writes one price per material. A price within 15% of the current one is
   approved automatically. Anything else waits for you at **/admin/scraper-review**.
4. Emails support@zimestimate.com only when something needs review or went wrong.

## One-time setup (about 5 minutes)

### 1. Pick the secret

The address only runs when it is sent a secret, so no stranger can trigger it.

- **Easiest:** use the `CRON_SECRET` that is already in Vercel.
  Vercel → zimestimate project → Settings → Environment Variables → `CRON_SECRET` → reveal and copy it.
- **If `CRON_SECRET` is not there**, add a new variable `PRICE_COLLECT_SECRET` (Production) with a
  long random value, for example the output of `openssl rand -hex 32`, then redeploy once
  (Deployments → latest → Redeploy) so it takes effect.

### 2. Create the job on cron-job.org

1. Sign up for free at https://cron-job.org and confirm your email.
2. **Create cronjob**:
   - Title: `ZimEstimate weekly prices`
   - URL: `https://zimestimate.com/api/cron/prices`
   - Schedule: **Every week**, Monday, 05:17 (any quiet time works)
   - Timezone: Africa/Harare
3. Open **Advanced**:
   - Request method: `GET`
   - Headers → add `Authorization` with value `Bearer <your secret>`
     (the word Bearer, one space, then the secret)
   - Timeout: the longest allowed (the run takes about 10–30 seconds)
   - Optional: tick "Save responses" so you can read each run's result.
4. Save, then press **Test run**. A good result is HTTP 200 with JSON such as
   `"mapped": 12, "priced": 12, "written": 12`.
   - `401 Unauthorized` means the header is wrong or the secret does not match.
   - `"mapped": 0` means no matches are confirmed yet: confirm some at /admin/price-matches.

## Checking without writing anything

Add `?dry=1` to the URL (same header). It shows what would be written, writes
nothing and sends no email.

## By hand

`npm run collect:prices` runs the same collection from a computer
(needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; `DRY_RUN=1` to only look).
