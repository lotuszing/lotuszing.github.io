# Lotus Zing Issues

Static GitHub Pages dashboard for the Lotus Zing resident issue log.

## What This Is

- A single-file public dashboard: `index.html`
- Free hosting target: GitHub Pages
- Source of truth for dashboard summaries: published Google Sheet CSV
- Intake form: Tally form, loaded only when a resident chooses to report

The public page shows aggregate summaries only. It must not render resident names, flat numbers, phone numbers, exact descriptions, uploads, submission IDs, or respondent IDs.

## Design Definition

This frontend is not a marketing site and not a generic landing page.

It should behave like a light civic operations dashboard:

- Public, trustworthy, and easy to scan
- Data-first, not copy-first
- Compact and efficient with screen space
- Calm administrative UI, not dramatic or decorative
- Useful on first view even before scrolling

### Target Experience

- First viewport should prioritize live issue signal, not oversized storytelling
- Key metrics should read as one compact command strip
- Patterns section should be main analytical surface
- Charts should explain relationships, not decorate the page
- Reporting flow should stay obvious but secondary to current issue picture

### Visual Direction

- Light theme by default for demo exploration
- Normal sans-serif typography, not stylized display-heavy type
- Clean civic/admin surfaces with restrained borders and shadows
- High information density without feeling cramped
- Color used semantically for urgency, trend, and concentration

### Layout Priorities

1. Compact header and primary action
2. Dense top summary strip
3. Pattern board as main body content
4. Reporting form below analysis

### Avoid

- Hero-page composition that wastes vertical space
- Dark cinematic styling as default direction
- Decorative gradients or visual effects that weaken readability
- Card soup
- Explanatory filler text
- Any frontend data that does not come from the allowed source

### Demo Mode

Local demo mode exists only to stress-test layout and chart behavior.

- URL: `http://127.0.0.1:4173/?demo=1`
- Demo mode may use generated fake rows
- Demo mode may expose UI exploration controls
- Demo mode must never redefine production data rules

Production mode remains sheet-driven and aggregate-only.

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
- Keep the frontend lean, resident-facing, and dashboard-first.
- Do not add build tooling, packages, paid APIs, databases, serverless functions, or new frameworks.
- Dashboard values must come from the published Sheet at runtime.
- Do not hardcode report counts, issue categories, urgency values, tower values, or dates.
- Keep the Tally iframe lazy-loaded so viewing the dashboard does not load the form.
- Keep public output aggregate-only.
- Prefer the smallest useful set of sections and explanations on the page.
- Treat charts and pattern views as primary product surface, not optional decoration.
- Use demo-only experimentation for layout or density tests; do not let demo logic leak into production behavior.

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
