# RBAC Permission: manage_email_templates — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** email-templates-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `email-templates`

## What this is
A new RBAC permission entry `manage_email_templates` granting Owner and Admin/Practice Manager the ability to edit template copy fields, independently of the broader `manage_settings` gate.

## Why it's needed
The email-templates brief (§10 Q4) recommends a dedicated permission so Admin/PM can edit email copy without needing full settings authority. Without it, only Owner can edit templates (falling back to `manage_settings`), which limits Admin/PM to read-only preview — an unnecessary operational restriction for a clinic where the Admin manages day-to-day communications.

## What it does (user story)
"As an Admin/Practice Manager, I want to correct a greeting line in the booking-confirmation email without asking the Owner for settings access, so I can keep the clinic's communication voice consistent on my own schedule."

## What information it stores or retrieves
Permission catalogue row: `{ name: 'manage_email_templates', display_label: 'Edit email template copy', category: 'communications', risk_level: 'low', scope: 'all' }`. Grant rows for Owner role and Admin/Practice Manager role.

## Who can use it
Owner + Admin/PM by default. Any custom role that receives an explicit grant.

## What can go wrong
- **Fallback to `manage_settings` leaves Admin/PM read-only:** if the permission is not seeded and the check falls back to `manage_settings`, Admin/PM sees read-only preview without the Editable fields panel. The page is still functional — just restrictive.
- **Duplicate seeding:** use upsert / `ON CONFLICT DO NOTHING`.

## How to verify it works
1. Sign in as Admin/PM → navigate to email-templates → Editable fields panel visible and Save button interactive.
2. Sign in as Coordinator → Editable fields panel absent; read-only preview renders.

## Safe implementation order
1. Add the permission constant to `src/lib/auth/rbac.ts`.
2. Seed the permission and grants via migration or seed script.
3. Wire the permission check in `saveTemplateOverride` and `sendTemplateManually` actions (allow either `manage_email_templates` OR `manage_settings`).

## How to undo it if something breaks
Remove the grant rows and permission catalogue entry. Admin/PM falls back to read-only (governed by `manage_settings` absence). No data loss.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
