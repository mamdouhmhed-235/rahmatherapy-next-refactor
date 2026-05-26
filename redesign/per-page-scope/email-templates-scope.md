# Scope — email-templates

## Files to edit

- `src/app/admin/emails/page.tsx` — **LIMITED SCOPE: swap-in only.** Import `<TemplatesTab />` from `./components` and replace the stub JSX block marked `Templates tab body — populated by the email-templates session` (line 874). Two lines maximum. The tab shell, Delivery body, and Reminders body were laid by the `emails` session and must NOT be re-styled or re-structured by THIS session.
- `src/app/admin/emails/components/TemplateBrowser.tsx` *(create)* — Accordion groups (Customer / Staff / Admin internal) + template cards; each card carries name + trigger description + "Last sent" mono timestamp + Ghost `Send` button. Active card: `surface-selected` tint + full `border-default` border (NOT `border-l-4`).
- `src/app/admin/emails/components/TemplatePreviewPanel.tsx` *(create)* — Right-panel container: sandboxed iframe (`sandbox="allow-same-origin"`, no `allow-scripts`, pointer-events disabled) + admin-internal banner + plain-text companion block for `renderBookingPlainText` (IBM Plex Mono on `surface-card`, NOT in an iframe).
- `src/app/admin/emails/components/TemplateEditForm.tsx` *(create)* — Safe-field inputs ("Greeting intro", "Footer contact line", "Group-copy sentence", "Wrapper sentence around changes") per template; Save Primary; `role="alert" aria-live="polite" aria-atomic="true"` error region; required `*` markers; unsaved-changes guard; "Saved just now" Soft Slate label.
- `src/app/admin/emails/components/ManualSendSheet.tsx` *(create)* — `AdminSheet` from right with template header + "Send to" email input + booking-context picker + Primary "Send now" + Secondary "Cancel".
- `src/app/admin/emails/components/TemplatesTab.tsx` *(create)* — Composite container: TemplateBrowser (left) + TemplatePreviewPanel + TemplateEditForm (right) + ManualSendSheet (overlay), with two-panel split ≥768px, single-column mobile, AdminMobileActionBar for Save/Send.
- `src/app/admin/emails/components/templates-data.ts` *(create)* — Static catalogue mapping the 9 `templates.ts` template IDs to UI metadata (audience group, card name, trigger description, editable-field schema). Server-only data; not a `templates.ts` re-export.
- `src/app/admin/email-templates/preview/[id]/route.ts` *(create)* — Server route handler: receives template id + dummy-data context, calls the relevant `render*Email()` function from `src/lib/email/templates.ts` SERVER-SIDE, returns rendered HTML for the iframe `src`. No client-side `templates.ts` import.
- `src/app/admin/email-templates/actions.ts` *(create)* — New server actions file (parallel to `emails/actions.ts`): `saveTemplateOverride(templateId, field, value)` + `sendTemplateManually(templateId, recipientEmail, contextData)`. Both marked `// FAKE: BUILD-email-template-overrides-table` / `// FAKE: BUILD-email-templates-actions` / `// FAKE: BUILD-email-templates-preview-route` / `// FAKE: BUILD-rbac-permission-email-templates`. Save stub returns the documented "couldn't save the override — table not yet provisioned" sentinel; manual-send stub returns the documented Cancelled toast.

## Files to NEVER touch

- `src/lib/email/templates.ts` — SERVER ONLY; the `render*Email()` functions are canonical. The override layer reads from a future DB table; this file remains the fallback.
- `src/lib/email/**` — all Resend sender helpers.
- `src/app/admin/emails/actions.ts` — `sendManualBookingReminder`; extend via the NEW `src/app/admin/email-templates/actions.ts`, never by editing this one.
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — RECON §5 untouchables.
- `supabase/migrations/**` — Phase 6 adds the `email_template_overrides` migration via the BUILD plan, not via this recipe.
- All build/config files.
- The existing Delivery body and Reminders body rendered by `emails/page.tsx` — the `emails` session already shaped them; this session leaves them alone.

## Scope-violation guardrails

- No edit to existing styles in `emails/page.tsx` beyond the literal 2-line swap.
- No new DESIGN.md tokens.
- No client-side import of `src/lib/email/templates.ts`.
- No use of `git add .` or `git add -A`; no commits until user types "approved".
