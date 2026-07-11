# Lotus Zing Listings API

Cloudflare Worker for faster listing updates.

## Flow

```text
Tally webhook -> Cloudflare Durable Object writer -> KV cached listings -> frontend LIVE_API_URL
```

## Endpoints

- `GET https://lotus-zing-listings-api.lotus-zing.workers.dev/listings` returns sanitized active listings.
- `POST https://lotus-zing-listings-api.lotus-zing.workers.dev/webhooks/tally` accepts Tally submissions.
- `GET https://lotus-zing-listings-api.lotus-zing.workers.dev/health` returns a small health check.

## Required setup

1. Create a Cloudflare KV namespace.
2. Replace `replace-with-production-kv-id` in `wrangler.toml`.
3. Set a webhook secret:

```bash
wrangler secret put WEBHOOK_SECRET
```

4. Deploy:

```bash
wrangler deploy
```

5. In Tally, add webhook URL:

```text
https://<your-worker-subdomain>.workers.dev/webhooks/tally
```

Add this header:

```text
X-LZ-Webhook-Secret: <same secret>
```

6. Set `LIVE_API_URL` in `listings/index.html`:

```js
const LIVE_API_URL = "https://lotus-zing-listings-api.lotus-zing.workers.dev/listings";
```

Until `LIVE_API_URL` is set, the frontend keeps using `listings/listings.json`.

## Notes

- The Worker keeps only active 30-day listings in the public cache.
- Webhook writes are serialized through a Durable Object so simultaneous submissions do not overwrite each other.
- Known sensitive generic extra fields are ignored.
- Phone numbers are still included in approved listings because the current UI has direct Call/WhatsApp buttons.
- KV remains the public read cache, so normal visitors do not hit the write path.
