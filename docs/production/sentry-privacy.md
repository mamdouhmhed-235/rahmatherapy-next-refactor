# Sentry Privacy Policy

Rahma Therapy handles customer contact details, addresses, booking context, health notes, consent notes, treatment notes, admin notes, staff data, and operational payment status. Sentry must remain useful without collecting avoidable sensitive data.

## Production Defaults

Production Sentry configuration must use:

- `sendDefaultPii: false` in client, server, and edge configs.
- `includeLocalVariables: false` outside development.
- `beforeSend` scrubbing through `src/lib/observability/sentry-scrubbing.ts`.

## Scrubbed Data

The Sentry scrubber redacts sensitive keys and common sensitive string patterns, including:

- names
- emails
- phone numbers
- addresses
- postcodes
- health notes
- consent notes
- customer notes
- admin notes
- treatment notes
- manage tokens
- Supabase keys
- Resend keys
- Sentry auth tokens
- authorization headers and cookies

## Preserved Operational Context

The scrubber preserves safe operational context where available:

- route
- error class
- status code
- safe booking id
- safe staff id

Do not add raw request bodies, full email bodies, health-note text, treatment-note text, or secrets to Sentry tags, contexts, breadcrumbs, or exception messages.

## Review Rule

Any future Sentry field that may contain customer, staff, health, consent, location, payment, token, or secret data requires a documented privacy decision before production use.
