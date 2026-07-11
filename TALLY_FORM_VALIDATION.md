# Tally Form Validation Rules

Use these rules inside the Tally form so residents know what went wrong before they submit.

## Canonical Submit Link

Use this one portal link anywhere residents are asked to post a flat or request a flat:

```text
https://lotuszing.github.io/listings/?submit=1
```

Use this one portal home link for normal browsing:

```text
https://lotuszing.github.io/listings/
```

The slashless `/listings` route should redirect to `/listings/` on the live site.

Do not share the raw Tally link publicly unless necessary. The portal link shows the rejection checklist first, then sends users to the single Tally form.

## Listing Type

- Required.
- Use fixed options only:
  - `Flat available`
  - `Looking for flat`

## Shared Fields

- Contact name: required.
- Phone: required.
- Phone helper text: `Use a 10-digit Indian mobile number. +91 is fine. Invalid numbers will not appear on the board.`
- Phone validation: accept `9876543210`, `+919876543210`, or `91 98765 43210`.
- Phone regex: `^(?:\+?91[\s-]?)?[6-9]\d{9}$`
- BHK: required fixed option: `Studio`, `1 BHK`, `2 BHK`, `3 BHK`, `4+ BHK`.
- Free-text notes: optional, but tell users not to add private documents, OTPs, ID numbers, or payment details.

## Flat Available Fields

- Tower or unit: required.
- Flat/unit number: recommended, but not required.
- Tower helper text: `Add at least the tower, for example Tower 5. Add flat/unit number if you are comfortable sharing it publicly.`
- Tower regex: `(?i).*(tower|twr|t)?\s*(1[56]|[1-6]).*`
- Monthly rent: required number.
- Monthly rent min/max: `5000` to `150000`.
- Security deposit: required number.
- Security deposit min/max: `0` to `500000`.
- Available from: required date, or provide an `Immediate` option.
- Furnishing: required fixed option.
- Listed by: required fixed option: `Owner`, `Broker Agent`.
- Preferred tenant: required fixed option: `Any`, `Family`, `Bachelor`.
- Parking: required fixed option: `Yes`, `No`.

## Looking For Flat Fields

- Budget: required number.
- Budget min/max: `5000` to `150000`.
- Move-in: required date, or provide an `Immediate` option.
- Occupants: required number.
- Occupants min/max: `1` to `8`.
- Tenant type: required fixed option: `Family`, `Bachelor`, `Any`.
- Preferred tower or area: required short text or fixed multi-select.

## Confirmation Page Copy

Use this on the Tally thank-you screen:

```text
Submitted. Valid posts usually appear on the Lotus Zing board within seconds.

If your post does not appear, it likely failed one of these checks:
- phone number is not a valid 10-digit Indian mobile
- tower or unit number is missing
- rent/budget/deposit is outside the allowed range
- move-in or available date is invalid
- required fields were skipped

Please correct the form and submit again.
```

## Why This Exists

The Worker still validates every webhook submission. Tally validation is for user experience: people should know before submitting why a post will not go live.
