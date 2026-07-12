# Reporting Setup

The same Google Sheet is prepared for reports with these columns:

- `Status`
- `Report Count`
- `Report Reasons`
- `Reporter Keys`
- `Last Reported At`

Deploy `scripts/google-sheet-moderation.gs` as a Google Apps Script Web App.

Use:

- Execute as: `Me`
- Who has access: `Anyone`

After deployment, paste the Web App URL into `REPORT_ENDPOINT_URL` in `listings/index.html`.

Reports do not hide listings automatically. They increment `Report Count`. The frontend downranks listings after multiple distinct browser reports and shows `Verify details` at 3+ reports.
