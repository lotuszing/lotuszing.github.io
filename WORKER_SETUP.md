# Lotus Zing Listings API

Cloudflare Worker endpoint for fast, private listing reads.

## Secrets

Set this Worker secret:

```text
SHEET_CSV_URL
```

Use the private Google Sheet CSV export URL. Do not commit it.

## Deploy

```bash
npx wrangler secret put SHEET_CSV_URL
npx wrangler deploy
```

Deployed Worker:

```text
https://lotus-zing-listings-read-api.lotus-zing.workers.dev/listings
```

Use the Worker URL ending in `/listings` as `LIVE_API_URL` in `listings/index.html`.

## Security

- The private Sheet URL stays inside Cloudflare secrets.
- CORS is limited to `https://lotuszing.github.io` plus `null` for local file testing.
- The Worker returns only sanitized listing JSON.
- Edge cache TTL is 1 second to keep the Sheet protected during traffic bursts.
