# C-15 — Email template studio — PROGRESS

**Plan:** `redesign/plans/C-phase/C-15-email-template-studio-plan.md`
**Brief:** `redesign/briefs/C-15-email-template-studio-brief.md`
**Programme:** Band C, C-C implementation — plan **#10 of 22** (§4 order).
**Model routing:** `sonnet` — §5 routes C-15 to Sonnet. Opus only via the §5 twice-failed-phase escalation.

> ## 🟡 STATUS: Phase A shipped (commit below). Phases B–F not started.
>
> §0 below is the original read-ahead pre-flight, preserved as captured (HEAD `5e8fa2f`, pre-C-08-Phase-D). See §1 for what actually happened at Phase A implementation time (re-verified pre-flight, the render-parity fixture capture, the registry expansion, and the classification table).

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

## 1 — Phase A shipped (2026-07-31)

**Base commit:** `9215cf1` (docs(redesign): C-08 shipped — progress + checklist + Owner backlog) — C-08 fully landed by the time Phase A started; the plan's dependency gate is satisfied. Re-verified pre-flight against this HEAD (supersedes §0's stale numbers where they differ):

- `git branch --show-current` → `master`; `merge-base --is-ancestor ea97932 HEAD` → exit 0.
- `git status --porcelain -- "src/app/admin/emails" "src/app/admin/email-templates" "src/lib/email"` → empty (confirmed twice: once before touching anything, once before the fixture capture below).
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login/` → 200.
- Anchored `grep -c "^    id:" templates-data.ts` → **15** (confirms C-08 Phase D's `enquiry_logged` registration; `booking_restored_client` not yet registered — that's this phase's job).
- SQL (SELECT-only, project `twzutkfgqclqurvkmvqz`): `SELECT count(*) FROM email_template_overrides;` → **0 rows.** No production data at risk; the "existing override rows still honoured" spec (below) necessarily uses mock rows.
- Anchor drift confirmed exactly as §0 recorded: `escapeHtml` line 49, `substituteVars` line 61, `resolveTemplateOverrides` line 468, `SUBJECTS` line 69, `saveTemplateOverride` line 87 (off by one from §0's 86 — harmless, re-located by symbol not number as instructed).

### 1.1 — Sequencing: the fixture was captured from unmodified code, provably

Order actually followed, in one continuous pass (no separate commits per step — Phase A ships as one commit per plan §7):

1. Created `src/lib/email/__tests__/__fixtures__/parity-sample-inputs.ts` — pure data, zero imports from `templates.ts`/`templates-data.ts` internals. Safe to write before any change.
2. Ran `git status --porcelain -- <C-15 paths>` → only the two new untracked files above. **Zero modifications to any existing source file at this point** — this is the proof the next step's fixture is genuinely "before."
3. Wrote a throwaway spec `_THROWAWAY_capture_parity_fixture.test.ts` that mocks `@/lib/supabase/admin` to return empty override rows (deterministic, independent of the real DB's — also empty — state), stubs `Math.random` to make `pickReviewMessages`' shuffle deterministic (comparator always 0 → `Array.prototype.sort`'s ES2019+ stability guarantee keeps pool order, so the same 3 variants are picked every run), renders **every one of the 15 currently-registered templates** (both HTML and plain-text legs where the template has one) **plus `renderBookingRestoredEmail` directly** (both `fromStatus` branches — "cancelled" and "completed" — even though it isn't registered yet, since SIX THINGS item 3 requires registering it in this same phase and its behaviour needed protecting too), and writes the result to `render-parity-baseline.json`.
4. Ran `npx vitest run src/lib/email/__tests__/_THROWAWAY_capture_parity_fixture.test.ts` — passed. In-test assertions confirmed 17 keys (15 template ids + the 2 `booking_restored_client` branches), every leg a string >50 chars, and spot-checks of real content (`"Aisha Khan"` present, the cancelled-branch apology text present only on the cancelled branch).
5. Confirmed on disk: `render-parity-baseline.json` is 34,690 bytes; `node -e` dump showed all 23 leg entries with lengths from 142 to 2,396 chars — none empty, none boilerplate-only.
6. **Deleted** `_THROWAWAY_capture_parity_fixture.test.ts` (`rm`, never staged, never committed) — kept only the fixture JSON and the sample-inputs module.
7. **Only then** implemented Steps 1–4 (registry types + per-template fill + renderer reads + `saveTemplateOverride` widening).
8. Wrote the **permanent** `registry-defaults.test.ts` (Step 5), which imports the same sample-inputs module, re-renders everything through the now-modified `templates.ts`, and asserts deep-equality against the same committed JSON — this file is never allowed to regenerate the fixture (no `writeFileSync` anywhere in it), so it can never self-heal into a vacuous pass.
9. Ran the parity spec: **12/12 passed**, including byte-identical equality on every one of the 17 entries plus a symmetric key-set check (guards against a silently-dropped template).

This ordering means the fixture is provably a pre-change artifact: step 2's `git status` is the checkpoint proving no source edit existed yet, and the throwaway capture script never ran again afterward.

### 1.2 — Files touched (all on C-15's §2 list)

| File | §2 status | Change |
|---|---|---|
| `src/app/admin/emails/components/templates-data.ts` | EDITED (listed) | Registry expansion: `TemplateToken`/`FixedPart` interfaces; `SafeField.defaultValue`/`tokens`; `TemplateMeta.subjectDefault`/`fixedParts`; `SafeFieldKind` widened to `string`; `subjectField()` factory; every template gets a subject field + `subjectDefault` + `fixedParts`; new `booking_restored_client` entry (16th template) |
| `src/lib/email/templates.ts` | EDITED (listed) | `fieldDefault()`/`resolveSubject()`/`hasControlChars()` helpers; every legacy renderer's hardcoded default (where deterministic) replaced with a registry read; all 6 `resolve*Fields()` helpers gain `subject`; all `renderLayout()` title args now read the registry; `booking_restored_client`'s title wired; local `*_DEFAULT_FIELDS` consts and `DEFAULT_REVIEW_VARIANTS` deleted (single-sourced into the registry instead) |
| `src/app/admin/email-templates/actions.ts` | EDITED (listed) | `SUBJECTS` hardcoded map deleted; `sendTemplateManually` reads `template.subjectDefault`; `saveTemplateOverride` rejects C0 control characters on `kind === "subject"` fields |
| `redesign/per-page-progress/C-15-email-template-studio-progress.md` | progress file (required) | This section |

Two files created that are not literally on §2's file list, both scoped inside the exact test directory §2 already allocates for Phase A's Step 5 deliverable (`registry-defaults.test.ts`) and containing no application logic — treated as that test's fixture data, not new source surface:
- `src/lib/email/__tests__/__fixtures__/parity-sample-inputs.ts` — shared sample input data (before/after fixture parity).
- `src/lib/email/__tests__/__fixtures__/render-parity-baseline.json` — the captured "before" fixture itself.

`src/lib/email/__tests__/registry-defaults.test.ts` — new, exactly as named in plan §2's NEW files list.

No other files touched. `src/lib/maintenance.ts` not touched (irrelevant to this phase — no UI, no browser checkpoint needed).

### 1.3 — Verification (re-run after every edit; final run below)

- `npx tsc --noEmit` → **0 errors** (matches inherited baseline: 0).
- `npx vitest run` → **5 failed / 1003 passed (1008 total)**. The 5 failures are byte-identical to the inherited baseline list: `admin-access.test.ts` > "gives Owner broad access while keeping owner-only role actions permission-gated" · `admin-access.test.ts` > "gives Admin broad operational access without role template management" · `ManualBookingForm.test.tsx` > "renders step 1 on first load" · `ManualBookingForm.test.tsx` > "moves focus to the first invalid field when continuing with errors" · `ManualBookingForm.test.tsx` > "shows the consent error when trying to create booking without consent". 1008 = 996 baseline + 12 new tests in `registry-defaults.test.ts`, all passing. **No new failures.**
- `pnpm lint` → **59 errors / 7 warnings**, in exactly the inherited baseline files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx`, `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. **No new lint errors.**
- One self-caught regression during this run, fixed before the numbers above: my first draft of `SAMPLE.enquiryUrl` used `https://rahmatherapy.co.uk/...`, which the pre-existing `canonical-domain.test.ts` anti-drift guard correctly flagged (stale domain — the live origin is `rahmatherapy.uk`, verified via that test's own `WRONG_DOMAINS` list). Fixed to `https://admin.rahmatherapy.example.test/enquiries/example` (the sample-data convention used everywhere else in this fixture). Re-ran full suite after the fix — clean.
- `pnpm build` — skipped per dispatch instructions (verifier's job).

### 1.4 — Classification table (per-template lifted fields vs FixedParts)

Every template also gained a `subject` field (kind `subject`, maxLength 100) not listed per-row below since it's uniform — see §1.5.

| Template | Lifted (editable) fields | FixedParts (auto, not editable) |
|---|---|---|
| `booking_confirmation` | `greeting_intro` (wired to registry), `group_copy` (registry `defaultValue` added, **runtime default left conditional/inline** — see §1.6), `footer_contact` (registry `defaultValue` added, **runtime default left conditional/inline**) | Booking summary; Participant details |
| `booking_cancellation_client` | `greeting_intro` (wired), `footer_contact` (metadata only) | Booking summary; Participant details |
| `booking_reminder` | `intro` (wired), `footer_contact` (metadata only) | Booking summary; Participant details |
| `booking_plain_text` | `footer_contact` (metadata only) | Booking details block (plain-text summary) |
| `staff_assignment` | `intro` (wired), `footer_contact` (metadata only) | Booking summary; Participant details |
| `staff_booking_change` | `wrapper_change_summary` (wired via the `{changeSummary}` token trick) | Booking summary; Participant details |
| `admin_booking_notification` | `footer_contact` (metadata only) | Booking summary; Client contact block; Participant details |
| `admin_booking_cancellation` | `footer_contact` (metadata only) | Booking summary; Cancellation note; Participant details |
| `admin_reschedule_request` | `footer_contact` (metadata only) | Booking summary; Requested new time; Participant details |
| `review_request_client` | `body_intro`, `body_ask`, `body_cta_label`, `body_cta_url`, `body_signoff`, 5×`massage_variant_N`, 5×`cupping_variant_N` — all wired (registry is now the sole source, local `*_DEFAULT_FIELDS`/`DEFAULT_REVIEW_VARIANTS` consts deleted) | Which 3 review samples are shown (random selection) |
| `booking_confirmed_client` | `body_intro`, `body_cta_label`, `body_signoff` — all wired | Booking summary |
| `staff_unassignment` | `body_intro` — wired | Booking summary |
| `claim` | `body_intro` — wired | Booking summary |
| `client_assigned_therapist` | `body_intro`, `body_cta_label` — wired | Booking summary |
| `enquiry_logged` | `body_intro` — wired | (none — no booking to summarise) |
| `booking_restored_client` **(new registration)** | `greeting_intro` (registry `defaultValue` added, **runtime default left conditional** — branches on `fromStatus`), `footer_contact` (metadata only) | Booking summary; Participant details |

Every `footer_contact` field's registry `defaultValue` is metadata-only (illustrative "Use default" preview text) — the actual runtime default is settings-derived (business_settings contact email/phone), not a fixed string, and stays inline in `renderFooter()`.

### 1.5 — Subject-override safety implementation

- **Save-time:** `saveTemplateOverride` (`actions.ts`) rejects any `kind === "subject"` field whose cleaned value matches `/[\x00-\x1f]/` (the full C0 control range, not just `\r`/`\n`) with a clear error, before it ever reaches the DB.
- **Render-time:** `templates.ts` exports `hasControlChars()` (same regex, single source — `actions.ts` imports it rather than duplicating) and a new `resolveSubject(templateId, overrides)` helper used at every one of the 15 (of 16 — see below) call sites that build a real subject: `overrides.subject` is used only if present **and** control-character-free; otherwise falls back to the registry `subjectDefault`. This mirrors the `body_cta_url` precedent (`isHttpsUrl` save-time + render-time guard) exactly as instructed.
- **`maxLength`:** every subject field is capped at **100** (via the shared `subjectField()` factory), not D13's blanket 500 — matches the pre-existing `REVIEW_SUBJECT` convention (long subjects render badly in inboxes). Asserted by a dedicated spec in `registry-defaults.test.ts`.
- **`REVIEW_SUBJECT`'s helper text corrected** as part of the Step 2 audit — now reads: *"Sets the hidden page title inside the email's HTML source. The line shown as the subject in the recipient's inbox is fixed in code and not yet editable here."* This is accurate both before and after Phase A: subject overrides now reach every template's `<title>` tag (previously only `review_request_client`'s), but **do not** reach any real inbox `Subject:` header in this phase — those remain hardcoded literals in `notifications.ts`, untouched (see §1.7). The helper text change reflects the widened `<title>` scope, not a claim about inbox headers.
- **Re-checked `email_template_overrides` is empty immediately before shipping this** (§1's pre-flight SQL above) — 0 rows, so no stale/dormant override could suddenly take effect.

### 1.6 — Deviations from plan text (all six items from the dispatch, no others)

1. **Subject safety** (dispatch item 1) — implemented per §1.5 above.
2. **D13 length cap** (item 2) — every `maxLength` ≤ 500, every `defaultValue.length` ≤ its field's `maxLength`, subject capped at 100 — asserted by 3 dedicated specs.
3. **`booking_restored_client` registered** (item 3) — one `TemplateMeta` entry, no renderer/`SafeFieldKind` change, exactly as scoped.
4. **Async renderers' signatures untouched** (item 4) — confirmed: all 6 (`renderReviewRequestEmail`, `renderBookingConfirmedClientEmail`, `renderStaffUnassignmentEmail`, `renderClaimNotificationEmail`, `renderClientAssignedTherapistEmail`, `renderEnquiryLoggedEmail`) still take exactly one parameter (their `Input` type) and remain `async`, resolving overrides internally. Only their **bodies** changed (added `subject` to their `resolve*Fields()` return + used it in the `renderLayout()` call) — no caller in `notifications.ts` needed any change, confirmed by `tsc` staying clean and every `notifications.ts`-adjacent test still passing.
5. **`SafeFieldKind` widened to `string`** (item 5) — done; verified no other file relies on it as a closed union (grepped all 7 importers; the 6 old editor components already typed their own local `kind: string`, so nothing broke).
6. **Classification table in progress file** (item 6) — this section, appended after §0, nothing overwritten.

**One additional judgment call, not in the six-item list, made for safety and logged here rather than silently applied:** three fields' *true runtime default* is genuinely conditional/data-dependent, not a single deterministic string — `group_copy` (branches on participant count: "one participant" vs "N participants"), `footer_contact` (settings-derived: contact email/phone from `business_settings`, shared across every template), and `booking_restored_client`'s `greeting_intro` (branches on `fromStatus`: apology only when restoring from `cancelled`). For these three, the **runtime code in `templates.ts` was left completely unchanged** (still the original inline conditional logic) — only registry `defaultValue` metadata was added (a representative string, for the future editor's "Use default" preview). Collapsing these into a single `fieldDefault()` read would have either lost the conditional behaviour or required non-trivial restructuring, both of which risk exactly what the parity gate exists to catch. This is why the render-parity fixture is the load-bearing check rather than a line-count grep: it proves these three fields' (and every other field's) actual output is unchanged, regardless of which mechanism produces it. All other fields with a single deterministic default **are** now genuinely single-sourced from the registry (local `*_DEFAULT_FIELDS` consts and `DEFAULT_REVIEW_VARIANTS` deleted, not just duplicated).

**Second judgment call, logged:** `enquiry_logged`'s `subjectDefault` was set to `"New enquiry logged"` (matching the renderer's actual `<title>` literal) rather than the legacy `SUBJECTS` map's `"New enquiry: {clientName}"` value, which the render-parity fixture proved was already stale/unused dead code (that map entry was never reachable — `sendTemplateManually`'s `renderForTemplate` switch has no case for `enquiry_logged`, so it always threw before the subject value was ever used). Ground truth (the shipping renderer) was preferred over the stale map, per the dispatch's own instruction that the parity gate is load-bearing.

No deviations beyond these eight items (six assigned + two logged judgment calls).

### 1.7 — Confirmations requested by the dispatch

- **`SUBJECTS` is gone as a hardcoded map** — deleted from `actions.ts`; the file's only subject-related line now reads `template.subjectDefault ?? template.cardName` (a registry read), used solely by the legacy `sendTemplateManually` path (retired in Phase F).
- **Async renderers' signatures untouched** — see §1.6 item 4.
- **Real inbox `Subject:` headers unchanged** — every literal `subject: ...` string in `notifications.ts` (the actual value handed to `sendEmail`) was not touched; only `templates.ts`'s `renderLayout()` `<title>` argument and `actions.ts`'s legacy manual-send subject changed. Zero UI shipped, zero send-path behaviour changed — confirmed by the render-parity gate and by `notifications.ts` not appearing in `git status --porcelain` for this diff.
- **Total registered templates: 16** (confirmed via `TEMPLATES.length` spec in `registry-defaults.test.ts` and the anchored `grep -c "^    id:"` → 16 post-change). `booking_restored_client` is among them (dedicated spec asserts its audience, `greeting_intro`, and `footer_contact` fields).

### 1.8 — Noticed but not fixed (rule 6a)

- `templates.ts`'s `buildVarMap()` docstring ("Mirrors the ALLOWED_VARIABLES set in TemplateEditForm.tsx") is stale in the same way §0.5 already logged — `TemplateEditForm.tsx` itself is out of Phase A's file scope (retired whole in Phase F), so the comment was left as-is rather than partially fixed. Not re-logged as a new item; §0.5's existing entry already covers it.
- `templates-data.ts`'s header comment previously said "9 templates"; corrected to "16 templates" as part of this phase's own header (not a separate fix — the file's header is squarely inside what Phase A rewrote).
- No other new issues noticed during this phase.

### 1.9 — SQL run (all SELECT-only) and email-send confirmation

- `SELECT count(*) FROM email_template_overrides;` → `0`. No other SQL executed.
- **No email was sent.** Phase A ships no send-path change and no UI; nothing in this diff calls `sendEmail`/`sendTrackedEmail` differently, and no test in this phase exercises a real network call (all Supabase/Resend interactions in the new tests are mocked).

---

*Phase A shipped. Next: Phase B (sample-data module + POST draft-preview handler) — not started, not scoped into this dispatch.*
