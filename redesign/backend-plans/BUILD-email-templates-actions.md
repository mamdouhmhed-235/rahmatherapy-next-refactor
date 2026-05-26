# Email Templates — Save Override and Manual-Send Server Actions — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** email-templates-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `email-templates`

## What this is
Two new server actions in `src/app/admin/email-templates/actions.ts`: `saveTemplateOverride(templateId, fieldKey, value)` that upserts a row in `email_template_overrides`, and `sendTemplateManually(templateId, recipientEmail, contextData)` that sends a specific template to a specified recipient via Resend.

## Why it's needed
The "Save changes" Primary (§5, §6) and the manual-send `AdminSheet` (§5) in the email-templates brief both require server-side handlers. Without these, the edit feature is non-functional and the manual-send sheet has no wired action.

## What it does (user story)
"As an Owner, I want to save a custom footer line to all templates in one action, and separately send a test copy of the assignment-notification email to my own address before the next therapist is assigned."

## What information it stores or retrieves
`saveTemplateOverride`: upserts `{ template_id, field_key, value, updated_by, updated_at }` in `email_template_overrides`. Validates `value` length (max 500 chars), strips HTML tags, and writes an `email_template_override_saved` audit log row.

`sendTemplateManually`: validates `recipientEmail` format and `templateId` existence, looks up any saved overrides for the template from `email_template_overrides`, calls the matching `render*Email()` function with the provided `contextData` merged with overrides, sends via Resend, and writes an `email_template_sent_manually` audit log row.

## Who can use it
Authenticated staff holding `manage_email_templates` or `manage_settings`. Each action checks the permission at entry.

## What can go wrong
- **`saveTemplateOverride` called with value exceeding 500 chars:** return `{ error: "value_too_long" }` before touching the DB. Never truncate silently.
- **`saveTemplateOverride` called with an HTML tag in the value:** strip the tags server-side and save the plain-text value. Return `{ warning: "html_stripped", savedValue: plainText }` so the UI can show the cleaned value.
- **`sendTemplateManually` — template ID not found:** return `{ error: "template_not_found" }` without sending anything.
- **`sendTemplateManually` — Resend failure:** return `{ error: "email_failed", details: resendError.message }`. Do NOT write the audit row on failure.
- **`sendTemplateManually` — recipient email is an internal staff member:** no restriction — manual sends can go to any address the reviewer specifies. The audit log records who sent what to whom.
- **Missing audit log writes:** if the audit write fails after a successful email send or override save, the action should still return success (the primary operation succeeded). Log the audit failure to Sentry but do not surface it to the user.

## How to verify it works
1. Save a custom greeting for `booking_confirmation` → row appears in `email_template_overrides`; an `email_template_override_saved` audit row exists; reloading the page pre-fills the editable field with the saved value.
2. Save a value containing `<b>bold</b>` → saved value is `bold` (tags stripped); UI shows the cleaned value.
3. Send `booking_confirmation` to a dev email address → email arrives; `email_template_sent_manually` audit row written.
4. Call `sendTemplateManually` with an invalid template ID → returns `{ error: "template_not_found" }`; no Resend call made; no audit row written.

## Safe implementation order
1. Create `src/app/admin/email-templates/actions.ts` with both action stubs returning `{ error: "not_implemented" }`.
2. Implement `saveTemplateOverride`: permission check → value validation (length, HTML strip) → upsert → audit write. Test with the existing `email_template_overrides` table (must exist first — see BUILD-email-template-overrides-table.md).
3. Implement `sendTemplateManually`: permission check → template validation → override lookup → render → Resend send → audit write.
4. Wire `saveTemplateOverride` to the "Save changes" Primary in `TemplateEditForm.tsx`.
5. Wire `sendTemplateManually` to "Send now" in `ManualSendSheet.tsx`.

## How to undo it if something breaks
Delete `src/app/admin/email-templates/actions.ts`. The "Save changes" Primary and the manual-send sheet become non-functional; the UI shows error states. No permanent data loss beyond the override rows already written (which can be deleted from `email_template_overrides`).

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
