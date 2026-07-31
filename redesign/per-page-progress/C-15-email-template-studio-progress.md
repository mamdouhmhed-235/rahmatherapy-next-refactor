# C-15 — Email template studio — PROGRESS

**Plan:** `redesign/plans/C-phase/C-15-email-template-studio-plan.md`
**Brief:** `redesign/briefs/C-15-email-template-studio-brief.md`
**Programme:** Band C, C-C implementation — plan **#10 of 22** (§4 order).
**Model routing:** `sonnet` — §5 routes C-15 to Sonnet. Opus only via the §5 twice-failed-phase escalation.

> ## ⏳ STATUS: NOT STARTED — read-ahead pre-flight only.
>
> **This file currently contains protocol §2.8(c) read-ahead preparation ONLY, captured at HEAD `5e8fa2f` while the orchestrator was blocked at C-08 Phase D's ⛔ HARD-STOP. No C-15 implementation has begun and none may begin until C-08's closeout gate passes and its progress file is written (protocol §1.1 — sequence is law).**
>
> Re-run the pre-flight for real at plan start: the checks below are read-only and were performed before C-08 Phase D landed, so anything touching `staff_profiles` or `email_delivery_events` will have moved.

---

## 0 — Read-ahead pre-flight (read-only, HEAD `5e8fa2f`, 2026-07-31)

| # | Check | Result |
|---|---|---|
| 1 | Branch + path-scoped tree | **PASS** — `master`; `merge-base --is-ancestor ea97932 HEAD` exit 0; path-scoped status empty across `admin/emails`, `admin/email-templates`, `lib/email` |
| 2 | Dev server | **NOT RUN** — belongs to the real plan-start pre-flight |
| 3 | C-08 landed? | **CAVEAT** — Phase A/B/C landed; **Phase D pending**. `staff_profiles.notification_email` + `business_notification_prefs` both absent, so C-15's "Send me a test" would fall back to `email` if built today. The plan's own signal for this check (`grep -c "enquiry_logged" templates-data.ts`) is a **bad anchor** — `enquiry_logged` is a C-08 Phase D *event type* that never lives in `templates-data.ts`. Use the anchored template count instead. |
| 4 | Static baselines | **NOT RE-RUN** — orchestrator holds them at `dc742d0` (tsc 0 · lint 59E/7W six files · vitest 5 failed / 948 passed · build clean). `5e8fa2f` is docs-only on top. Re-confirm at plan start rather than assuming. |
| 5 | Registry + override inventory | **PASS with correction** — anchored `grep -c "^    id:"` → **14** (as the plan anticipated post-C-08). The plan's *unanchored* count of 15 is stale: now **20**. **`email_template_overrides` is EMPTY (0 rows)** — C-08's Zone-2 deletion cleared the one stale row. That empty state is the baseline C-15's render-parity gate must diff against. |
| 6 | Preview route shape | **PASS** — `src/app/admin/email-templates/preview/[id]/route.ts`, single `[id]` segment, `GET` with `ctx.params: Promise<{ id: string }>` — matches the plan exactly |
| 7 | Old-component import graph | **PASS** — sole chain is `emails/page.tsx` → `TemplatesTab` → {`TemplateBrowser`, `TemplatePreviewPanel` (+`PreviewDummyDataNote`), `TemplateEditForm`, `ManualSendSheet`}. Every other grep hit is a comment or a false positive on `recurringTemplatesTable`. Retirement blast radius is exactly as scoped — no hidden consumers. |
| 8 | Migration claim | **HOLDS** — DDL-keyword scan of the full plan text finds only the historical `20260519120000` reference and three explicit "no migration" statements |
| 9 | ⛔/⏸ marker inventory | **ZERO** in both plan and brief. C-15 genuinely has no in-plan Zone-2 gate. |
| 10 | Dependency marker | **PASS** — `git log --oneline --grep="feat(redesign): C-08"` → 7 matches (A ×4, B ×2, C ×1). Note this grep does **not** prove C-08 is closed out; that is a §4 ordering gate, checked separately. |

**Anchor drift (re-locate by symbol, never by the plan's line numbers):** `escapeHtml` 34→**49** · `substituteVars` 46→**61** · `resolveTemplateOverrides` 430→**468** · `SUBJECTS` 68→**69** · `saveTemplateOverride` 80→**86**. All drift is C-08's own insertions.

**14 registered ids:** `booking_confirmation`, `booking_cancellation_client`, `booking_reminder`, `booking_plain_text`, `staff_assignment`, `staff_booking_change`, `admin_booking_notification`, `admin_booking_cancellation`, `admin_reschedule_request`, `review_request_client`, `booking_confirmed_client`, `staff_unassignment`, `claim`, `client_assigned_therapist`.

---

## 0.1 — ⚠️ The finding that reshapes Phase B: renderers are split sync/async

**Not mentioned anywhere in C-15's plan or brief, and it directly threatens the live-draft-preview feature for 5 of 14 templates.**

- The **9 legacy renderers** are **synchronous** and take `overrides: Record<string,string> = {}` as an explicit parameter (`templates.ts:209,246,270,287,310,337,364,381,402,419`).
- The **5 newer HTML renderers** from C-01/C-08 (`renderReviewRequestEmail`, `renderBookingConfirmedClientEmail`, `renderStaffUnassignmentEmail`, `renderClaimNotificationEmail`, `renderClientAssignedTherapistEmail`) are **`async` and call `resolveTemplateOverrides(templateId)` internally** — they accept no overrides parameter at all.
- Their **plain-text siblings are synchronous and DO take an overrides parameter** — so for those 5 templates, HTML and plain text use two different injection mechanisms.

**Consequence.** Plan Step 7 says the POST preview handler "merges draft over saved overrides → renders through the real render function". For the 9 legacy templates that is a one-line parameter pass. For the 5 async ones **there is no parameter to inject an unsaved draft into** — they always re-read the DB. Draft preview for those templates is therefore impossible as specified, and any workaround risks exactly what the plan's own risk table forbids ("draft preview drifts from real sends… no parallel renderer exists by construction").

**Recommended fix — small, backward-compatible, belongs in Phase A Step 3 explicitly:** give the 5 async HTML renderers an **optional** overrides parameter that defaults to the current internal `resolveTemplateOverrides` call when omitted. Existing `notifications.ts` call sites pass nothing and change behaviour zero; the plain-text siblings need no change.

## 0.2 — The GET preview route is narrower than the brief claims

`preview/[id]/route.ts`'s `renderById` switch has cases for **only the original 9 ids** — any of the 5 newer ids throws through to `renderPlaceholder`. Separately, every call passes `DUMMY_INPUT` **with no overrides argument**, so today's GET preview always renders hardcoded defaults and never shows saved customisations — which contradicts brief §1.2's description of it as "server-rendered from SAVED overrides".

The plan says "GET unchanged", which reads like a scope limiter but is a trap: leave GET alone and the LivePreview's initial paint (brief §2.4) shows the FAKE placeholder for 5 templates until the debounced POST fires. **Extending GET's switch is very likely required work, not scope creep.**

## 0.3 — Editable subjects: what C-15 opens that C-08 deliberately kept closed

C-08 Phase B decided **not** to wire the subject override into real subjects, on the reasoning that header injection is currently *unreachable* precisely because subjects are hardcoded literals and Resend is a JSON API. **C-15 proposes editable subjects — that is the decision being reversed, and it must be reversed deliberately, not incidentally.**

- `saveTemplateOverride` runs `stripHtmlTags` and (for `body_cta_url` only) a scheme check. It does **not** strip control characters. Resend's JSON layer very probably encodes `\r\n` safely — but that must not be the only defence.
- **A safe implementation must:** strip/reject C0 control characters (`\r`, `\n`) from subject overrides **at save time AND with a render-time fallback**, mirroring the two-sided precedent `body_cta_url` already set (`actions.ts:125-130` + the render-time guard in `templates.ts`).
- **Keep subject `maxLength` tight (~100), not D13's blanket ≤500.** `REVIEW_SUBJECT` is already capped at 100 for inbox-rendering reasons; an implementer copying the general cap onto every new subject field would regress that.
- **`REVIEW_SUBJECT`'s helper text becomes false the moment this ships.** It currently tells the admin the field is inert ("only sets the hidden page title inside the email's HTML source"). Correct it in the Phase A copy-lift audit.
- **Re-check `email_template_overrides` is still empty immediately before the subject-wiring step ships.** It is empty today. C-08 §1.1 is the precedent: a stale test override sat dormant for 15 months purely because the wiring was broken, and nearly went live the instant it was fixed. Same shape of risk, same mitigation.

## 0.4 — `booking_restored_client` registration gap: confirmed open, and cheap

`sendBookingRestoredClientEmail` (`notifications.ts:569`) resolves overrides for `booking_restored_client`, and `renderBookingRestoredEmail` (`templates.ts:287`) is a normal **synchronous** renderer that already accepts `overrides.greeting_intro` plus `footer_contact` via `renderFooter`. Only the `TEMPLATES` entry is missing.

**Fix scope: one `TemplateMeta` entry** (audience `customer`, fields `[GREETING_INTRO variant, FOOTER_CONTACT]`). No renderer change, no `SafeFieldKind` widening — both kinds already exist. This closes the one customer-facing email the Templates tab cannot reach (tracked in `OWNER-ACTION-BACKLOG.md`).

## 0.5 — Logged, informational

- **`ALLOWED_VARIABLES` in `TemplateEditForm.tsx:27-37` is already stale** — missing `therapistName`, `service_name`, `city`, `booking_id`, `requested_date`, `requested_time`, `change_summary`. The comment at `templates.ts:72-73` claiming it "mirrors" `buildVarMap` no longer holds. The component is retired in Phase F anyway, but the dangling comment should be corrected or removed while `templates.ts` is open for the copy-lift.
- **`templates-data.ts`'s header comment still says "9 templates"** (actually 14). Pre-existing stale text C-08 left under rule 6a; C-15's Phase A registry rework touches this file's header anyway.
- **Dropping sessionStorage drafts is intentional.** `TemplateEditForm.tsx` has live draft persistence (`DRAFT_KEY_PREFIX`, `readDraft`, `admin.email-templates.draft.*`); brief §5.1 deliberately drops it ("draft lives in component state only"). A minor accepted UX regression, not an oversight — recorded so nobody "restores" it as a bug fix.

---

*Read-ahead prep only. C-15 has not started. Next action when C-08 closes: re-run the §0 pre-flight for real against the then-current HEAD, then Phase A.*
