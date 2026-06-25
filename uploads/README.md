# Lotus Zing Issues

Static GitHub Pages dashboard for the Lotus Zing resident issue log.

## What This Is

- A single-file public dashboard: `index.html`
- Free hosting target: GitHub Pages
- Source of truth for dashboard summaries: published Google Sheet CSV
- Intake form: Tally form, loaded only when a resident chooses to report

The public page shows aggregate summaries only. It must not render resident names, flat numbers, phone numbers, exact descriptions, uploads, submission IDs, or respondent IDs.

## Local Preview

```sh
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/
```

## Operating Rules

- Keep it static.
- Keep it free.
- Keep the frontend lean and resident-facing.
- Do not add build tooling, packages, paid APIs, databases, serverless functions, or new frameworks.
- Dashboard values must come from the published Sheet at runtime.
- Do not hardcode report counts, issue categories, urgency values, tower values, or dates.
- Keep the Tally iframe lazy-loaded so viewing the dashboard does not load the form.
- Keep public output aggregate-only.
- Prefer the smallest useful set of sections and explanations on the page.

## External Runtime Calls

The initial dashboard load should only need the published Google Sheet CSV.

The Tally form should load only after the resident clicks `Load form` or opens the separate Tally link.

## Quick Verification

```sh
git diff --check
```

Useful manual checks in the browser:

- Initial page shows current aggregate values.
- Initial page has no Tally iframe before clicking `Load form`.
- Clicking `Load form` mounts one Tally iframe.
- Public text does not expose personal respondent fields.

## Deployment

Commit and push to `main`. GitHub Pages serves `index.html`.
