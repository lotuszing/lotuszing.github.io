# Security Notes

## Data flow

- Public users load sanitized listing JSON from the Cloudflare Worker when configured, with `listings/listings.json` as a fallback.
- Raw Google Sheet CSV access must stay out of the frontend.
- There is no scheduled GitHub Action sync. The Worker reads the private Sheet CSV URL from Cloudflare secrets.
- Rejected rows should stay out of public JSON.

## Private Sync Input

If the sync script is run manually or the Worker is deployed, provide the private Sheet CSV URL as:

```text
SHEET_CSV_URL
```

If the value is missing, `scripts/update-listings-json.js` and the Worker fail closed.

## Known Product Risk

Published listings may include names and phone numbers. That is expected for this noticeboard, but it means the public page can be scraped. Keep the Tally privacy note visible and only collect details residents are comfortable publishing.
