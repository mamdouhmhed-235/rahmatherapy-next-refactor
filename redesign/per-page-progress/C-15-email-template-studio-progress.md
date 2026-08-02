# C-15 — Email template studio — PROGRESS

**Plan:** `redesign/plans/C-phase/C-15-email-template-studio-plan.md`
**Brief:** `redesign/briefs/C-15-email-template-studio-brief.md`
**Programme:** Band C, C-C implementation — plan **#10 of 22** (§4 order).
**Model routing:** `sonnet` — §5 routes C-15 to Sonnet. Opus only via the §5 twice-failed-phase escalation.

> ## ✅ STATUS: SHIPPED 2026-08-01 — C-C plan #10 of 22. All six phases independently verified; closeout review FAILed on AC2 and two fix rounds closed it, each re-verified.
>
> Phase A `0d0a26d` · empty-string fix `3ab469b` · Phase B `b84dd11` · Phase C `caec3f1` · Phase D `84f10fc` · Phase E `ee37aa3` · Phase F `10ca7db` · closeout fixes `289bdcb` + `8851e8c`. Baseline handed on: **5 failed / 1107 passed (1112)**, the five inherited by identity.
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

## 1.9 — Phase A verify: PASS, with one finding Phase B must close first

Independent verifier (`sonnet`, read-only) — **PASS**. It reconstructed `git show 9215cf1:src/lib/email/templates.ts` and compared **every** lifted `defaultValue` against its pre-change literal by hand, plus all 16 `subjectDefault`s against the deleted `SUBJECTS` map. Copy-lift confirmed byte-neutral. The `enquiry_logged` subject divergence was confirmed **correct**: the map's `"New enquiry: {clientName}"` was dead code (`renderForTemplate` had no case for it, so it always threw), while the renderer's real `<title>` has always been `"New enquiry logged"`. Real inbox subjects are untouched — every `Subject:` header still lives as a hardcoded literal in `notifications.ts`, which this diff does not modify at all.

**FINDING (non-blocking at Phase A, but it must not survive Phase B) — empty-string override no longer falls back to the default.**

Five sync-renderer override reads were rewritten from `overrides.x ? f(overrides.x) : hardcoded` to `f(overrides.x ?? fieldDefault(...))`:
`templates.ts:257` (`booking_confirmation.greeting_intro`) · `:321` (`booking_cancellation_client.greeting_intro`) · `:417` (`staff_assignment.intro`) · `:439` (`staff_booking_change.wrapper_change_summary`) · `:458` (`booking_reminder.intro`).

`??` only falls back on `null`/`undefined`, so an override of `""` now **wins** and renders a blank paragraph where the sentence should be. The old ternary treated `""` as falsy and fell back. The DB `CHECK` permits `''` (it caps length; it does not forbid empty).

**Why it is latent today:** `email_template_overrides` has 0 rows, and the only write path — `saveTemplateOverride` — *deletes* the row on an empty value rather than storing `""`. So "empty means default" is the established semantic everywhere else in this system.

**Why Phase B makes it live:** Step 7's POST draft-preview merges `draftValues` that have never been through `saveTemplateOverride`. The instant a user clears a field in the editor, the draft carries `""` — and the preview would render blank while a real send renders the default. That is precisely the "draft preview drifts from real sends" failure the plan's own risk table calls high-severity, arriving through a side door.

**Directed fix, first task of Phase B:** restore the empty-means-default semantic at all five sites and cover it with a spec that asserts `""` falls back — for both the direct render path and the draft-merge path.

---

---

## 2 — Phase B: sample data + live preview endpoint (`3ab469b` + `b84dd11`)

Verified independently — **PASS, zero findings.** Baseline after: **5 failed / 1026 passed (1031)**, same five names. Phase A's render-parity spec re-run and still green, and the verifier confirmed **the fixture itself was not edited** in this range (`git diff … -- '*render-parity-baseline.json'` empty) — a quietly-regenerated fixture would have voided the plan's load-bearing gate silently.

### 2.1 — The empty-string fix was three times bigger than the finding

§1.9 named five sites. The implementer swept rather than patching the list and found **17**: the 5 direct sync-renderer reads plus 12 more inside the six `resolve*Fields()` helpers Phase A also touched (`review_request_client` ×4, `booking_confirmed_client` ×3, `client_assigned_therapist` ×2, `staff_unassignment`, `claim`, `enquiry_logged`). All now read `overrides.x || fieldDefault(...)`. The verifier independently grepped the repo for `?? fieldDefault(` and every sibling pattern → **0 remaining**.

`||` is safe here because every one of the 17 is a registry `SafeField` typed `string`, so `""` is the only falsy value in play — no `0`/`false` can be wrongly discarded. Two adjacent patterns were correctly left alone because they already handled `""`: `resolveSubject()` (`if (value && !hasControlChars(value))`) and the `body_cta_url` scheme guard.

Covered by two specs that each fail on revert: byte-equality of an `""` override against no override on the direct-render path, and a draft-merge spec that posts a saved override plus an `""` draft and asserts the saved text does **not** appear.

### 2.2 — Two structural problems the plan never mentioned, both fixed here

**The sync/async renderer split.** Six HTML renderers were `async` with overrides resolved *internally* and no parameter to inject a draft into — so Step 7's "merge draft → render through the real render function" was impossible for them as written. Each gained an **optional** `providedOverrides?: Record<string, string>`, falling back to `providedOverrides ?? (await resolveTemplateOverrides(id))`. The verifier specifically checked this is **not** `providedOverrides ?? {}` — that shape would have silently stopped resolving overrides for real sends and regressed C-08 Phase B's entire fix. `git diff` on `notifications.ts` is **empty**: every existing call site passes one argument and is behaviourally unchanged.

**GET covered 9 of 16 ids and ignored saved overrides.** The plan said "GET unchanged", which reads as a scope limiter but is a trap: brief §2.4 relies on GET for LivePreview's initial paint, so seven templates would have shown a placeholder until the debounced POST fired — and GET passed `DUMMY_INPUT` with no overrides, so it never showed saved customisations at all, contradicting brief §1.2. GET now covers all 16 and resolves saved overrides, **sharing one dispatch table (`SAMPLE_RENDERERS`) with POST** rather than two switches that could drift. Auth is byte-identical to before, just factored out. Zero live behaviour change today (the override table is still empty, and GET's only current consumers are the three FAKE-marked components Phase F deletes).

### 2.3 — The POST handler

Auth identical to GET (401 unauthenticated / 403 unpermitted). Validation runs **before** render: unknown template → 404 · unknown field key → 400 · value over **that field's own** `maxLength` → 400, never a truncated render · non-object `draftValues` → 400. Draft values are never persisted — the verifier traced it rather than trusting the spec, and noted the test's stub exposes no write method at all, so an accidental write would 500 rather than pass. `escapeHtml(substituteVars(...))` order untouched. Sample data is fictional throughout (`Aisha Khan`, `aisha.khan@example.test`); grepped clean of `9d55ce2a` and the Owner's real address.

---

---

## 3 — Phase C: token fields + live preview + editor page (`caec3f1`)

Verified independently — **PASS**, two non-blocking findings. Baseline after: **5 failed / 1050 passed (1055)**, same five names. +24 specs. Phase A's parity spec re-run green, and `git diff` confirms **`templates.ts`, `sample-data.ts` and the parity fixture were not touched at all** in this phase — the render path is untouched by the entire editor build.

### 3.1 — Q9.1 decided: textarea + chip-insert, not contenteditable

The plan preferred contenteditable pill-spans with the textarea fallback "locked as acceptable". **Directed to the fallback**, deliberately: contenteditable is a known accessibility and mobile-IME liability (caret placement, screen-reader announcement, Android composition events), the plan's own §4 risk table rates that path medium/medium while the fallback carries no such risk, and both persist byte-identical canonical `{token}` strings so nothing downstream can distinguish them.

Built properly rather than grudgingly: caret-aware insertion (reads `selectionStart`/`selectionEnd` at click time, splices, restores focus and caret), `maxLength` enforced natively **and** with a JS clamp that catches paste, chips as real keyboard-operable buttons with `aria-label`s, `min-h-11`, wrapping cleanly at 375. The spec proves insertion lands **at the caret mid-string**, not appended, and a separate spec covers selection-replace.

### 3.2 — Fixed-part outlining is client-side, and that was the right trade

Step 10 wanted renderers to emit `data-fixed-part` spans under a `?annotate=1` flag — i.e. a render-path code branch emitting extra markup, one mistake away from leaking into a real customer email. Implemented instead as `injectFixedPartOutline()`, a pure browser-side string transform over HTML the preview endpoint already returned. It never imports `templates.ts` and never runs server-side, so it is **structurally incapable** of reaching a send rather than merely unlikely to. Verified: zero diff to the render path, and toggling the switch changes the iframe `srcdoc` with **no additional fetch**.

**Finding (non-blocking) — legend and outline disagree on one field.** The transform targets two inline-style signatures (`background:#f7f3ec`, `padding-left:18px`). The verifier cross-referenced every one against the declared `fixedParts`: 5 of 6 categories match exactly, but `admin_booking_cancellation`'s "Cancellation note" (`templates-data.ts:572-578`) renders as a plain `<p style="margin:18px 0 0;…">` (`templates.ts:383-387`) and carries neither signature. So the legend lists it as fixed while the outline never highlights it. Admin-internal template, no data risk, purely inconsistent messaging.

**Finding (non-blocking) — the heuristic has no test coupling to real renderer output.** `LivePreview.test.tsx` exercises the transform against a hand-authored string containing the exact signatures. If a renderer ever changes `#f7f3ec`, the toggle silently stops outlining and **no test fails**. This is the accepted cost of keeping the transform decoupled from the render path (which is what protects the parity gate), but it is a genuine silent-failure mode.

### 3.3 — The eslint-disable was challenged and upheld

Phase C added one `eslint-disable-next-line react-hooks/set-state-in-effect` in `LivePreview.tsx`. Lint stayed at 59/7 — but *because of* the suppression, so the number proved nothing, and suppressing a rule to keep a baseline green is precisely the erosion baseline-by-identity exists to catch. The verifier was asked to judge it on merits and did: it stripped the comment and re-ran the rule to confirm the violation is real (not a stale no-op), read the effect (a reset-then-fetch keyed on `[templateId, reloadTick]` — data-fetching lifecycle, not state derivable during render), and found the **same suppression on the same rule in ~30 other locations**, mostly in files with no deletion scheduled. The implementer's own cited precedent (`TemplateEditForm.tsx`) was weak since Phase F deletes it — but the idiom is the codebase's, not C-15's invention. **Upheld.**

### 3.4 — Read-only enforcement traced, including the direct-URL case

The editor route is reachable by URL and cannot inherit the Templates tab's gate, so it carries its **own** server-side gate: `canViewEmailLogs || canResendBookingEmails`, else `AdminAccessDenied` before any template data renders — byte-identical to `emails/page.tsx`'s tab gate. `canEdit = canManageEmailTemplates` is computed separately and passed down; client-side hiding is the visual half only, and `saveTemplateOverride` re-checks the permission independently. A Therapist without view permission hitting the URL directly is turned away at the server.

**"Use default" never persists an illustrative default.** It clears to `""` — the empty-means-default signal Phase B established — and never writes `defaultValue` back. That matters specifically for the three fields Phase A marked "illustrative only" (`group_copy`, `footer_contact`, `booking_restored_client.greeting_intro`), whose true runtime default is conditional; persisting the illustrative string would have been wrong for one branch. Asserted in two specs.

---

---

## 4 — Phase D: reset to default + send me a test (`84f10fc`)

Verified independently — **PASS**, one non-blocking finding. Baseline after: **5 failed / 1079 passed (1084)**, same five names. Parity gate untouched and green.

**The recipient cannot be influenced by user input.** Brief §4 rates "test send reaches a non-self recipient" as this plan's highest-severity risk. `sendTestEmail` derives `to` from `actor.notification_email ?? actor.email`, where `actor` is the profile `requirePermission()` resolved from the session. The verifier actively tried to subvert it — a planted `recipient_email` FormData key, email-like strings in `field:*` draft values, a bogus `template_id` — and found no path reaching `to`. A spec plants `attacker@evil.test` and asserts the actual `sendEmail` call argument.

**Test sends use `sendEmail`, never `sendTrackedEmail`** — so they write no `email_delivery_events` row, keeping the delivery log clean, keeping C-08's Resend tooling from acting on them, and keeping the §3.2 event-type histogram honest. The spec's stub throws on any unexpected table, so a regression fails loudly rather than silently.

**Rate limit and audit interact correctly.** The 60 s limit reads the latest `email_template_test_sent` audit row and is checked *before* rendering and sending; the audit row is written *only* after a successful send. So a failed send writes nothing and cannot consume the window — spec'd both ways.

**Reset is recoverable and correctly scoped.** Rows are captured *before* the DELETE, and `before_state.overrides` stores `field_key` + `value` + `updated_by` + `updated_at` per row — enough for a human to retype the exact prior wording. The delete filters on `.eq("template_id", …)` alone: every row for that template, nothing belonging to another.

**One refactor happened that wasn't asked for**, and it was checked rather than waved through: the field-validation loop was extracted out of `saveTemplateOverride` into a shared `validateTemplateFields` so the test-send path can't drift from the save path. The verifier hand-diffed it against `git show 6c9b8fb:…/actions.ts` — the entire loop body appears as unchanged context lines, only the function boundary moved. Behaviour-preserving, and it removes a real drift risk.

**Finding (non-blocking):** `TemplateEditor.tsx` gained two more `eslint-disable` comments (2 → 4) on the same rules Phase C's verifier already investigated and upheld across ~30 codebase locations. Not vacuous suppression, no correctness impact — but if a future cleanup pass strips them, this file enters the lint-error count and breaks the "no C-15 file in lint output" gate.

**Production untouched, confirmed by SQL:** `email_template_overrides` still 0 rows, and zero `email_template_reset` / `email_template_test_sent` audit rows — no subagent ran either new path against production.

---

## 5 — Phase E: gallery + Templates-tab swap (`ee37aa3`)

Implemented; independent verification not yet run (queued as this plan's next step, per protocol §2.3).

**Files touched — all on plan §2's list:**

| File | §2 status | Change |
|---|---|---|
| `src/app/admin/emails/components/TemplateGallery.tsx` | NEW (listed) | Gallery: cards grouped by `AUDIENCE_GROUPS`, each a stretched-link to the Phase C editor route, badge, and (editors only) an overflow menu wired to Phase D's `resetTemplateToDefault` |
| `src/lib/email/templates.ts` | EDITED (listed) | + `getTemplateOverrideSummaries()` — one grouped query over `email_template_overrides` (`template_id, updated_at, updated_by`, ordered `updated_at DESC`), grouped in one pass in code (first row seen per `template_id` = newest) |
| `src/app/admin/emails/page.tsx` | EDITED (listed) | Templates tab now mounts `TemplateGallery` instead of `TemplatesTab`; fetches badge summaries + one companion `staff_profiles` name lookup instead of `getAllTemplateOverrides()`; old `?tab=templates&templateId=…` deep links now `redirect()` to the editor route |

No file outside §2's list touched. `src/lib/maintenance.ts` left exactly as found (deliberately dirty, never staged — confirmed via `git status --porcelain -- src/lib/maintenance.ts` before and after).

### 5.1 — The badge query is one grouped query, not sixteen

```ts
export async function getTemplateOverrideSummaries(): Promise<
  Record<string, TemplateOverrideSummary>
> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("email_template_overrides")
    .select("template_id, updated_at, updated_by")
    .order("updated_at", { ascending: false });
  // ...
  const map: Record<string, TemplateOverrideSummary> = {};
  for (const row of data ?? []) {
    if (!map[row.template_id]) {
      map[row.template_id] = { updatedAt: row.updated_at, updatedBy: row.updated_by };
    }
  }
  return map;
}
```

One `SELECT` against `email_template_overrides`, ordered newest-first; the loop keeps only the first (= most recent) row per `template_id` — group-by-max done in code, in one pass over one result set. `page.tsx` runs this alongside ONE companion `staff_profiles` (`id, name`) query (both inside the page's existing `Promise.all`), then joins `updated_by` → display name in a single `Map` lookup — the exact two-query shape `admin/audit/page.tsx` already uses for the same actor-name-resolution problem. `email_template_overrides` is still empty in production (re-confirmed: no override rows exist as of this phase), so the map is empty and every card shows "Default" today — verified functionally instead via the render-parity/registry test suite's existing coverage of the table shape, since there's no live data to exercise the "Customised" path against without writing to production (forbidden — SELECT-only).

### 5.2 — Badge state and Reset's disabled state share one derived value

The gallery never computes a second "has overrides" boolean. `TemplateCard` passes `hasOverrides={Boolean(badge)}` into `TemplateCardMenu`, where `badge` is exactly the presence-or-absence of an entry in the `badges` map returned by `getTemplateOverrideSummaries()` — the same map that decides whether the card renders "Customised" or "Default". The Reset button's `disabled={!hasOverrides || isPending}` is the client-side mirror of Phase D's own server-side gate (`resetTemplateToDefault` returns `"This template is already using its defaults."` when `existingRows.length === 0`), so all three — badge text, Reset's disabled attribute, and the server's own refusal — read the identical "≥1 row for this `template_id`" fact, just at three different distances from the DB.

### 5.3 — Step 18 deep-link grep result

`grep -rn "templateId" src` (re-run at Phase E implementation time) found no external reference to the old `?tab=templates&templateId=<id>` shape anywhere in the codebase outside `TemplatesTab.tsx`'s own retired URL-mirroring effect (which wrote that param to match its own `sessionStorage` selection state — a self-referential loop, not a deep link anyone else points at). No test, doc, or other component links to it. Implemented the redirect anyway (`page.tsx`, before any data fetching): `?tab=templates&templateId=<known id>` now `redirect()`s straight to `/admin/emails/templates/<id>` (the Phase C editor route) — this is forward cover for any Owner/staff browser bookmark or back-button history entry still carrying the old shape, at negligible cost. An unknown/stale `templateId` value falls through silently to the ordinary gallery render (`findTemplate` returns `undefined` → no redirect).

### 5.4 — RBAC: overflow menu never implies write access it doesn't have

The gallery's own visibility gate is unchanged — `page.tsx`'s pre-existing `canSeeDelivery || canResend` check, untouched by this diff. `TemplateGallery` receives `canEdit={canManageEmailTemplates(profile)}` and uses it as a single, total gate: `{canEdit ? <TemplateCardMenu .../> : null}`. A viewer without `MANAGE_EMAIL_TEMPLATES` never renders an overflow menu at all — there is no disabled-but-visible Reset control that could mislead them about their own access. The server-side gate is unchanged from Phase D: `resetTemplateToDefault` re-runs `requirePermission(PERMISSIONS.MANAGE_EMAIL_TEMPLATES)` itself regardless of what the client renders, so a bypassed client still can't reset anything.

### 5.5 — Theming / a11y

CSS-variables-only throughout (no hex, no raw Tailwind palette classes) — every colour, border, radius, and shadow value is a `var(--admin-*)` token, matching the surrounding files' existing convention. No `border-l-4` anywhere. The Default/Customised distinction is not colour-only: `AdminStatusBadge`'s `tone="default"` renders a `CheckCircle` icon (Customised) versus `tone="muted"`'s no-icon treatment (Default) — icon presence plus the differing text label (`"Customised · {name} · {time}"` vs `"Default"`) both survive a colour-blind or grayscale read. Touch targets: the overflow-menu trigger and the Reset button are both `min-h-11 min-w-11` / `min-h-11`; the card itself is a stretched full-card link (`position:absolute inset-0`), so its effective hit area is the whole card, far exceeding 44px. Reduced motion: the card hover transform carries `motion-reduce:transform-none motion-reduce:transition-none`, matching `AdminEntityRow`'s existing pattern verbatim. Layout is mobile-first (`grid gap-3 sm:grid-cols-2 xl:grid-cols-3` — single column below `sm`, i.e. clean at 375) with no viewport-specific rework needed. Confirmed via `curl` that `/admin/emails?tab=templates` still resolves (redirects to login, no 500) with the dev server running; full 375px/interactive verification requires an authenticated session — see the Owner checklist below.

### 5.6 — Deviation: one `eslint-disable` added

`TemplateGallery.tsx` needed `// eslint-disable-next-line react-hooks/set-state-in-effect` for a single `setOpen(false)` call inside the Reset-result effect (closes the overflow menu after a reset completes). This is the identical rule, identical shape (a `setState` call reacting to a `useActionState` result inside a `useEffect`), and identical justification as the ~30 pre-existing suppressions Phase C's verifier explicitly investigated and upheld codebase-wide — including the near-identical case one file over, `TemplateEditor.tsx`'s own `resetState` effect. `pnpm lint` before and after this addition is identical: 59 errors / 7 warnings in exactly the six inherited baseline files (confirmed by file-list diff, not just the totals) — `TemplateGallery.tsx` does not appear in lint output at all, because the disable comment suppresses the one line that would have added it.

### 5.7 — Verification run (this phase)

- `npx tsc --noEmit` → **0 errors** (matches inherited baseline: 0).
- `npx vitest run` → **5 failed / 1079 passed (1084 total)** — identical to the Phase D baseline, same five names: `admin-access.test.ts` > "gives Owner broad access while keeping owner-only role actions permission-gated" · `admin-access.test.ts` > "gives Admin broad operational access without role template management" · `ManualBookingForm.test.tsx` > "renders step 1 on first load" · `ManualBookingForm.test.tsx` > "moves focus to the first invalid field when continuing with errors" · `ManualBookingForm.test.tsx` > "shows the consent error when trying to create booking without consent". Phase E added no new test files (none were in scope for Steps 17–18), so the total is unchanged from Phase D.
- `registry-defaults.test.ts` (Phase A's load-bearing render-parity spec) re-run in isolation → **13/13 passed**; `git diff` on `render-parity-baseline.json` → empty (fixture not touched).
- `pnpm lint` → **59 errors / 7 warnings**, file list identical to the inherited baseline (`design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx`, `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`). `TemplateGallery.tsx` does not appear.
- `pnpm build` — skipped per dispatch instructions (verifier's job).
- `git status --porcelain -- "src/app/admin/emails" "src/app/admin/email-templates" "src/lib/email"` before commit showed exactly the 2 edited + 1 new file; no other path touched.

### 5.8 — Confirmations

- The five old components (`ManualSendSheet.tsx`, `TemplateBrowser.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx`) are present, byte-unchanged (not in this commit's diff), and now genuinely orphaned — `grep -rln "TemplatesTab" src` after the swap shows only `TemplatesTab.tsx` itself, `TemplateEditForm.tsx` (a stale code comment, not an import), and this now-removed `page.tsx` mount (confirmed gone in the diff). Nothing deleted, per instruction — Phase F's job.
- Delivery and Reminders tabs (`DeliveryTab`, `RemindersTab`, `applyDeliveryFilters`, `countFailedRecent`, and all their supporting functions in `page.tsx`) are untouched — the diff touches only imports, the `PageProps` search-params type, the new redirect block, the badge-data fetch, and the Templates-tab render branch.
- No SQL beyond the read-only `SELECT count(*) FROM email_template_overrides` style checks already run in earlier phases; no new SQL was needed for this phase (no production data exists to query against for badge verification, and the query itself was verified via the codebase's existing test/type coverage plus a dev-server `curl` smoke check, not by hitting production).
- No email was sent — this phase adds no send path; it only reads override metadata and renders a `<form action={resetTemplateToDefault}>`, which was not invoked against production during implementation.

### 5.9 — Owner-performed checklist (cannot be run by an agent — password entry prohibited)

Sign in as each role per Part 0's credentials table and check:

1. **Owner/Admin, `/admin/emails?tab=templates`:** gallery renders, grouped into Customer / Staff / Internal alerts headings, 16 cards total. Every card shows "Default".
2. **Seed one Customised template** (e.g. open `booking_reminder`'s editor, change the intro field, save) → return to the gallery → that card now shows "Customised · {your name} · a few seconds ago" with a checkmark-style badge; all others still show "Default".
3. **Card click** anywhere on a card (not just the title) navigates to that template's editor.
4. **Overflow menu (Owner/Admin only):** the `⋯` button in the top-right corner of the Customised card opens a small menu with "Reset to default" enabled; on the still-Default cards, the same button is present but "Reset to default" is disabled (greyed, with a tooltip on hover/focus).
5. **Reset from the gallery:** click Reset on the Customised card → confirm dialog → confirm → toast "reset to its default wording" → card flips back to "Default" without a manual page reload.
6. **Booking Coordinator / Therapist** (whichever currently has Templates-tab visibility per the existing `canSeeDelivery || canResend` rule): gallery is visible, cards are visible, but no overflow-menu button appears on any card at all.
7. **375px width:** cards stack to one column; badge text wraps without overflowing the card; the overflow-menu button remains tappable and its dropdown doesn't get clipped or run off-screen.
8. **Old deep link:** manually visit `/admin/emails?tab=templates&templateId=booking_confirmation` → should land directly on `/admin/emails/templates/booking_confirmation` (the editor), not the gallery.
9. **Reduced motion:** with "prefers reduced motion" enabled in OS/browser settings, card hover has no slide/shadow animation (appears instantly).

### 5.10 — Noticed but not fixed

- Nothing new noticed in this phase beyond what §0.5/§1.8 already logged (stale `buildVarMap()` docstring, `TemplateEditForm.tsx`'s stale `ALLOWED_VARIABLES` list) — both already tracked, both inside files Phase F deletes.

---

**Phase E verify: PASS.** Badge query confirmed one grouped `SELECT` plus one companion staff-name query — and the "unbounded fetch" concern is answered by the schema: `email_template_overrides` carries `unique (template_id, field_key)` (migration `20260519120000`), so saves upsert in place and no history accumulates — a fixed ceiling of ~56 rows across all 16 templates, ever. Badge and Reset share one derived value (`hasOverrides={Boolean(badge)}`), and the server action independently re-checks. The deep-link redirect fires only when `templateId` is present, so a bare `?tab=templates` still renders the gallery. Zero new specs is plan-conformant (Steps 17–18 define no test step) but was named as the one coverage gap in an otherwise well-specced plan.

---

## 6 — Phase F: retirement (`10ca7db`)

Verified independently — **PASS**, one non-blocking protocol finding. **2184 lines deleted.** `ManualSendSheet.tsx`, `TemplateBrowser.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx` gone, along with `sendTemplateManually`, `requiredVarsFor`, `addHourClamped` and `renderForTemplate`. `plainTextFallback` correctly **kept** — still used by `sendTestEmail`. Import graph re-run by the verifier: zero real imports remain, only retrospective comments and the known `recurringTemplatesTable` substring false-positive.

All three C-15-owned FAKE markers left with their files. The two still in `src/app/admin/emails/` (`DeliveryFilterStrip.tsx:132`, `page.tsx:676`) belong to the **Delivery tab** — C-08/C-09/C-16 territory, not C-15's.

**Finding (non-blocking, protocol not correctness):** the implementer added an `email_template_sent_manually` AUDIT_PHRASING entry. My dispatch asked them to *confirm it survives*; they found via `git log --all -S` that **it had never existed** — historical rows were rendering through a bare lowercase `formatLabel()` fallback — and added it. Correctly implemented, zero risk, honestly flagged. But the verifier's judgement is right: brief §2.7 already pre-classified those rows as "harmless", nothing in Phase F depended on the label, so under rule 6a this should have been *logged* rather than fixed. **Kept deliberately** — reverting a correct one-line improvement to make a point would be worse than the deviation. Recorded as an Owner-visible scope note.

---

## 7 — Closeout (2026-08-01)

### 7.1 — The adversarial whole-plan review returned REVIEW FAIL, and it was right

Sweeping `9215cf1..10ca7db` against all 20 steps and brief §10's twelve acceptance criteria, the reviewer found every step present, all 15 override call sites correct, escaping intact, no cross-phase regression — **but AC2 unmet.**

Brief §2.1 promises "subject lines become editable everywhere"; AC2 requires **"real sends use it"**. Phase A had built exactly the safety needed — subject `maxLength` 100 plus C0 control-character rejection at *both* save and render time, specifically so C-08's deliberate decision to keep subjects hardcoded could be reversed. **The guard shipped; the wiring never did.** `git diff 9215cf1..10ca7db -- src/lib/email/notifications.ts` was **empty**: all ~17 real `Subject:` headers were still hardcoded literals.

An admin could edit a subject, watch it round-trip through save → preview → reset, and customers would receive the old one forever. The helper text disclosed it, so nobody was actively deceived — but the plan's own definition of done was unmet, and no phase B–F had been assigned to close it. Fix round rather than a checklist flip.

### 7.2 — The fix round found something the review could not have (`289bdcb`)

Wiring subjects turned out to be dangerous in a way nobody anticipated. Phase A had lifted `subjectDefault` from the **`SUBJECTS` map** — which only the now-deleted manual-send path ever used. **Real sends carry their own separate literals, and 12 of 16 disagreed.**

| | registry `subjectDefault` (pre-fix) | what customers actually receive |
|---|---|---|
| `booking_confirmation` | "Booking request received" | **"{companyName} booking request received"** |
| `admin_booking_cancellation` | "Booking cancellation" | **"Booking cancelled - {clientName}"** |
| `enquiry_logged` | "New enquiry logged" | **"New enquiry: {clientName}"** |
| `claim` | "Slot claimed" | **"Slot claimed: {therapistName} → {bookingDate}"** |

…and eight more. **A naive wiring would have silently rewritten 12 customer-facing subject lines** on the very commit that made subjects editable. The rule applied: the live literal always wins, the registry is corrected to match — never the reverse.

The re-verifier reconstructed every pre-fix literal from `git show 10ca7db:…` and compared byte-for-byte against the new zero-override output, including `od`-level checks on the em dash in `booking_restored_client` and the arrow in `claim`. **All 15 real-send sites plus the test-send site: byte-identical.** It also traced every token in a corrected default against the var map that site actually passes — an unresolved token renders *literally* (brief §5.3), so one name mismatch would have put a raw `{clientName}` into a real inbox. None found.

Also closed here: `resolveTestSubject` — a hand-duplicated copy the reviewer flagged as a drift risk — deleted, with `notifications.ts` and `sendTestEmail` now sharing one exported helper. And six `SafeField.helper` strings still carried *"Variables in curly braces are filled automatically."* — the exact sentence brief §1.1 quotes as evidence of the broken UX C-15 was funded to fix. Phase A's copy-lift had rewritten those field objects and left that string on all six.

**Security:** the render-time `hasControlChars` guard sits on the path every real subject now takes, with an end-to-end spec planting `"Injected\r\nBcc: attacker@example.test"` as a stored override, running it through `sendBookingCreatedEmails`, and asserting `sendEmail`'s actual `subject` argument is clean.

### 7.3 — A second, smaller fix (`8851e8c`)

The first fix left `SafeField.defaultValue` alone — correctly, since it feeds the `<title>` tag the parity fixture freezes. But the editor UI reads *that* value, so for 12 templates it displayed a default that was not what real sends emit: open `booking_confirmation`, see "Booking request received", clear the override, customer gets "Rahma Therapy booking request received". A narrower re-run of the exact editor-says-one-thing-sends-another defect C-15 exists to eliminate. The editor now reads `TemplateMeta.subjectDefault` for the subject field only; `<title>` and the parity gate untouched.

### 7.4 — Final gate

- `npx tsc --noEmit` → **0**
- `pnpm lint` → **59 errors / 7 warnings**, exactly the six inherited files
- `pnpm vitest run` → **5 failed / 1107 passed (1112)**, the five inherited by identity
- `pnpm build` → clean
- **Render-parity gate:** green throughout, and `render-parity-baseline.json` has **exactly one commit in its entire history** (`0d0a26d`) — captured once from unmodified code, never regenerated. Every phase's byte-identical assertion was therefore always measured against real pre-C-15 output, never against itself.
- **§3.2 override-row diff:** `email_template_overrides` was 0 rows at pre-flight and is 0 rows now — no stored customisation lost by the registry sweep.

**Bundle (§3.1) — measured, but the delta is unobtainable.** `scripts/measure-admin-bundles.mjs` has a hardcoded six-route list covering neither `/admin/emails` nor the new editor route, and this Next version prints no per-route sizes. A scratchpad copy of the script pointed at C-15's routes (no repo file touched) gives `/admin/emails/templates/[templateId]` **341.23 kB** and `/admin/emails` **346.84 kB** gzip first-load JS — both in the same band as the lightest existing admin routes (338.57 / 341.00), far below the heaviest (480.95 / 473.71). No pre-C-15 snapshot exists for either route and checking out an earlier commit is forbidden on a shared tree, so **the plan's named ceilings (+10 kB / +2 kB) were never checked by anyone** — stated plainly rather than ticked.

### 7.5 — INHERITED BASELINE FOR THE NEXT PLAN

**tsc 0 · lint 59E/7W in those six files · vitest 5 failed / 1107 passed (1112) with exactly those five names · build clean.** Use this, never a plan's hardcoded text (protocol §0 precedence).

**Expected shrinkage: none applicable** — C-15 named no baseline entry it expected to fix, and none was fixed.

### 7.6 — Deferred, logged, not fixed

1. **`admin_booking_cancellation`'s "Cancellation note" fixed part** is declared in the legend but never outlined by the "Show what's editable" toggle — its markup carries neither CSS signature the client-side transform targets. Cosmetic, admin-internal.
2. **The outline transform has no test coupling to real renderer output.** Specced against a hand-authored string; if a renderer ever changes `#f7f3ec`, outlining silently stops with no test failure. Accepted cost of keeping it decoupled from the render path — which is what protects the parity gate.
3. **Four `eslint-disable` sites** across `LivePreview.tsx`, `TemplateEditor.tsx`, `TemplateGallery.tsx`. Each independently investigated and upheld (the same `useActionState`-result idiom appears ~30× in the codebase), but they sit in permanent files: a future lint cleanup would surface four new errors inside C-15's own surface.
4. **Bundle ceilings unverified** (§7.4).
5. **§3.3 Playwright sweep and §3.4 screenshots** — Owner-performed by necessity; `redesign/evidence/C-15/` does not exist yet.

### 7.7 — Owner-performed checklist

1. `/admin/emails` → Templates tab: 16 cards grouped by audience, badges read **Default**.
2. Open `booking_confirmation` → subject placeholder/default now reads **"Rahma Therapy booking request received"** — the real one.
3. Type in a body field → preview updates within ~500 ms, no iframe reload. Insert a chip mid-sentence → token lands **at the cursor**.
4. Toggle "Show what's editable" → dashed outlines on summary/participant blocks, no network request.
5. **Edit a subject, save, then trigger a real send on a `*.example.test` fixture → the customer subject reflects the edit.** This is the AC2 fix and the one thing most worth checking end to end.
6. "Send me a test" → `[Test] …` at your notification address. Click again within 60 s → rate-limit error.
7. Reset → confirm dialog → badge flips to Default, fields show defaults.
8. Coordinator + Therapist → gallery/editor visible read-only, **no** Save, chips, Reset or Send-test.
9. 375 px: stacked layout, sticky save bar clear of the mobile nav, chips tappable. Dark and light both clean.

---

*C-15 SHIPPED 2026-08-01 — plan #10 of 22. Phases A–F each independently verified; adversarial closeout review FAILed on AC2, two fix rounds followed, each re-verified. Zero migrations, zero Zone-2 actions. 16 templates registered (incl. `booking_restored_client`, C-04a's gap). Next plan: **C-13**.*
