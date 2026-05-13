# Email Template Overrides — Database Table — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** email-templates-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `email-templates`

## What this is
A new Supabase Postgres table `email_template_overrides` that stores per-template per-field copy overrides, so Owners and Admins can edit the safe-edit copy fields (greeting intro, footer contact line) without touching code.

## Why it's needed
The email-templates brief (§5, §10 Q2) requires a persistent store for editable template fields. Without this table, the "Save changes" Primary in the Editable fields panel has nowhere to write; the entire edit feature is non-functional.

## What it does (user story)
"As an Owner, I want to save a custom greeting line to the booking-confirmation email so that when the next booking fires, the email reads in our clinic's voice — without me having to ask a developer."

## What information it stores or retrieves
Schema (proposed):
```
email_template_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,          -- matches the key in templates.ts
  field_key   text NOT NULL,          -- e.g. 'greeting_intro', 'footer_contact'
  value       text NOT NULL,          -- the custom string (max 500 chars)
  updated_by  uuid REFERENCES staff_profiles(id),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (template_id, field_key)
)
```
Row-level security: only authenticated staff with `manage_email_templates` or `manage_settings` may INSERT/UPDATE. SELECT open to any authenticated staff for read-only preview.

## Who can use it
Write access: Owner + Admin/PM (via `manage_email_templates` or `manage_settings` permission). Read access: any authenticated admin session (needed to render previews with live overrides).

## What can go wrong
- **Override not found at email-send time:** the `render*Email()` function in `templates.ts` must look up overrides from this table and fall back to the hardcoded defaults when no override row exists. If the lookup throws (e.g. DB unreachable), it must fall back to defaults silently — never fail to send an email because of a missing override.
- **Override value contains script tags or HTML:** the `value` column stores plain text. The render function must treat the value as escaped user input, not trusted HTML. Use React's default JSX escaping.
- **Migration fails mid-deploy:** the table creation migration is a simple DDL statement; it's atomic. If it fails, the table doesn't exist and the page shows a controlled error rather than corrupted state.
- **UNIQUE constraint violation on upsert:** if two admins simultaneously save the same `(template_id, field_key)`, the second upsert wins. Use `INSERT ... ON CONFLICT (template_id, field_key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`.

## How to verify it works
1. Save a custom greeting for the booking-confirmation template → a row appears in `email_template_overrides` with the correct `template_id` and `field_key`.
2. Reload the email-templates page → the custom greeting pre-populates the editable field.
3. Send a booking confirmation email in dev → the email body contains the custom greeting, not the default one.
4. Delete the override row in Supabase Studio → email reverts to the hardcoded default on next send.

## Safe implementation order
1. Write and run the migration: `CREATE TABLE email_template_overrides ...` with RLS policies.
2. Confirm the table appears in Supabase Studio with the correct columns and constraints.
3. Write the `saveTemplateOverride` server action to upsert rows (see BUILD-email-templates-actions.md).
4. Modify the `render*Email()` functions (or a new wrapper) to look up overrides from this table and fall back to defaults.

## How to undo it if something breaks
Drop the table: `DROP TABLE email_template_overrides;`. The render functions fall back to hardcoded defaults. No application data is lost. Write a down-migration.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
