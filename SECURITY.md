# Security Notes

## Data flow

- Public users load `listings/listings.json` by default.
- Raw Google Sheet CSV access must stay out of the frontend.
- The scheduled GitHub Action reads the Sheet through the `SHEET_CSV_URL` repository secret.
- Rejected rows are logged in the Action output only; they are not written to public JSON.

## Required GitHub Secret

Create this repository secret before running the sync workflow:

```text
SHEET_CSV_URL
```

If the secret is missing, `scripts/update-listings-json.js` fails closed and does not generate a cache.

## Known Product Risk

Published listings may include names and phone numbers. That is expected for this noticeboard, but it means the public page can be scraped. Keep the Tally privacy note visible and only collect details residents are comfortable publishing.
