# Security Notes

## Data flow

- Public users load `listings/listings.json` by default.
- When `LIVE_API_URL` is configured, public users load the Cloudflare Worker listings API first, then fall back to `listings/listings.json`.
- Raw Google Sheet CSV access must stay out of the frontend.
- The scheduled GitHub Action reads the Sheet through the `SHEET_CSV_URL` repository secret.
- Rejected rows are logged in the Action output only; they are not written to public JSON.
- The Cloudflare Worker webhook path validates Tally submissions before updating its public cache.
- Webhook writes are serialized through a Durable Object writer before publishing to KV, avoiding lost updates under simultaneous submissions.

## Required GitHub Secret

Create this repository secret before running the sync workflow:

```text
SHEET_CSV_URL
```

If the secret is missing, `scripts/update-listings-json.js` fails closed and does not generate a cache.

## Known Product Risk

Published listings may include names and phone numbers. That is expected for this noticeboard, but it means the public page can be scraped. Keep the Tally privacy note visible and only collect details residents are comfortable publishing.

## Fast Update Path

Use `workers/listings-api` when updates need to appear in seconds instead of waiting for GitHub Actions cron.

Required Worker secret:

```text
WEBHOOK_SECRET
```

Tally should send that value in the `X-LZ-Webhook-Secret` header when calling `/webhooks/tally`.
