# Security Notes

## Data flow

- Public users load `listings/listings.json` by default.
- Raw Google Sheet CSV access must stay out of the frontend.
- There is no scheduled GitHub Action sync. If `listings/listings.json` is regenerated, do it from a trusted private environment only.
- Rejected rows should stay out of public JSON.

## Private Sync Input

If the sync script is run manually or from a trusted backend, provide the private Sheet CSV URL as:

```text
SHEET_CSV_URL
```

If the value is missing, `scripts/update-listings-json.js` fails closed and does not generate a cache.

## Known Product Risk

Published listings may include names and phone numbers. That is expected for this noticeboard, but it means the public page can be scraped. Keep the Tally privacy note visible and only collect details residents are comfortable publishing.
