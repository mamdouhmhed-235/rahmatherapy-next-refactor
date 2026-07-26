# C-15 — Email template studio — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: C-08 Phase A (5 new templates — verify `git log --oneline --grep="C-08" | grep -q "feat(redesign): C-08"`; template-id check in pre-flight #3). C-08 Phase D (`staff_profiles.notification_email`) is SOFT — test send falls back to login email.
> Decisions: C-B-DECISIONS.md carries no C-15 entries (post-handoff addition); Owner decisions D13/D14 (2026-07-26) applied. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: templates section overhaul)
**Brief:** `redesign/briefs/C-15-email-template-studio-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-15-email-template-studio-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** *(Amended 2026-07-26)* On `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- "src/app/admin/emails" "src/app/admin/email-templates" "src/lib/email"` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server reachable.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **C-08 landed?** `git log --oneline | grep "C-08"` — Phase A templates expected (registry sweep covers them); Phase D (`notification_email`) preferred but soft (test send falls back to login email). Record which.
   *(Added 2026-07-26 — distinguish the two states explicitly.)* Phase A landed ⇔ `grep -c "enquiry_logged" src/app/admin/emails/components/templates-data.ts` ≥ 1 (0 at refinement time). If 0, C-08 Phase A has NOT landed: the Step 2 sweep covers 9 templates only — record and surface to user (sequencing expects C-08 first). Phase D landed ⇔ read-only `SELECT column_name FROM information_schema.columns WHERE table_name='staff_profiles' AND column_name='notification_email';` returns a row. If empty, Phase D is absent: Step 14's recipient falls back to login email (soft — proceed).
4. **Baseline tests + static gates green.** *(Amended 2026-07-26)* Baselines: `pnpm vitest run` — 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) are the accepted baseline; `pnpm lint` — no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/); `npx tsc --noEmit` clean.
5. **Registry + override inventory:**

   ```bash
   grep -c "^    id:" src/app/admin/emails/components/templates-data.ts
   # Template count baseline (9, or 14 post-C-08; earlier-landing Band C plans, e.g.
   # C-01, may add more — record the actual count).
   # NOTE (2026-07-26): the anchored pattern is required — unanchored `grep -c "id:"`
   # returns 15 (also matches interface fields like `id: string`); anchored returns 9.
   grep -n "resolveTemplateOverrides\|substituteVars\|escapeHtml" src/lib/email/templates.ts | head -20
   ```

   ```sql
   -- Existing override rows (must survive the registry sweep untouched)
   SELECT template_id, field_key, LEFT(value, 40), updated_at
   FROM email_template_overrides ORDER BY template_id, field_key;
   -- Capture verbatim — §3.6 asserts identical rows post-ship.
   ```

6. **Preview route shape.** `ls src/app/admin/email-templates/preview/` — confirm the GET handler location; POST extends the same route file. *(Verified 2026-07-26)* Expected: a single `[id]/` dynamic segment — Step 7 extends `preview/[id]/route.ts`. Never create a sibling `[templateId]/` folder (duplicate slug names at the same route level break the Next.js build).
7. **Old-component import graph** (retirement blast radius):

   ```bash
   grep -rn "ManualSendSheet\|TemplateBrowser\|TemplateEditForm\|TemplatePreviewPanel\|TemplatesTab" src --include=*.tsx --include=*.ts
   ```

8. **DO-NOT-TOUCH:** Badar's `9d55ce2a`; real client rows; test sends only to the actor's own address (design guarantees this).

   DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

If pre-flight shows the preview route missing or override rows with unexpected field_keys, surface to user before proceeding.

---

## 1 — Safe implementation order (6 phases)

Phases A→B→C→D→E ship strictly in order (each builds on the last); Phase F is the retirement + swap.

### Phase A — Registry expansion + renderer copy-lift (foundation; no UI change yet)

**Step 1 — Extend the registry types.**

In `templates-data.ts`: add `defaultValue` + `tokens` to `SafeField`; add `subjectDefault` + `fixedParts` to `TemplateMeta`; widen `SafeFieldKind` to `string` (per-template keys). Add `TemplateToken` + `FixedPart` interfaces per brief §2.1. Keep the file client-safe (strings only, no render imports).

> **Shared-surface note (2026-07-26, rubric §10):** `templates-data.ts` is a Band C collision surface — re-grep for the current anchor before editing; prior Band C plans may have shifted line positions; expect C-01 and C-08's edits in this region. Per D7, C-01/C-08 extend `SafeFieldKind` minimally (reusing shared `SafeField` consts); C-15 owns the fuller registry rework — the widened `kind: string` supersedes their union additions.

**Step 2 — Per-template copy-lift audit + registry fill.**

For each template (9 existing + C-08's 5): walk its render function; classify every user-facing string as **liftable field** (gets a `SafeField` with `defaultValue` = the current hardcoded string, verbatim) or **FixedPart** (auto-generated summaries, layout scaffolding — gets a legend entry with source description). Fill `subjectDefault` from the SUBJECTS map verbatim. Record the classification table in the progress file (brief Q9.5).

Deliverable: every template has ≥ subject + intro + footer editable; admin_internal templates gain real fields.

> **Length cap (D13, 2026-07-26):** `email_template_overrides.value` carries a DB `CHECK (<=500 chars)` (migration 20260519120000). Every new/expanded field's `maxLength` MUST be ≤ 500, and every `defaultValue` lifted here MUST be validated ≤ 500 chars before Phase A ships (Step 5's registry completeness spec asserts both). Existing 5 fields (maxLength 200–300) are safely under. NO migration to relax the CHECK.

**Step 3 — Renderers read defaults from the registry.**

In `templates.ts`: replace inline defaults (`overrides.subject ?? "Your booking is confirmed"`) with registry reads (`overrides[key] ?? fieldDefault(templateId, key)`). One shared helper `fieldDefault(templateId, fieldKind)` sourced from `templates-data.ts` (server-importable — metadata only). `SUBJECTS` in `email-templates/actions.ts` becomes a registry read; delete the map.

Anchors (verified 2026-07-26): `escapeHtml` (src/lib/email/templates.ts:34), `substituteVars` (templates.ts:46), `resolveTemplateOverrides` (templates.ts:430), `SUBJECTS` (src/app/admin/email-templates/actions.ts:68) — re-grep before editing. Verify: post-change `grep -n "SUBJECTS" src/app/admin/email-templates/actions.ts` shows only the registry read (hardcoded map gone).

**Step 4 — `saveTemplateOverride` accepts the widened field set.**

The action already iterates `template.fields` — widening is mostly free; verify `subject` round-trips (save → resolve → render). Keep the HTML-strip + maxLength validation unchanged.

Anchor (verified 2026-07-26): `saveTemplateOverride` (src/app/admin/email-templates/actions.ts:80) — re-grep before editing. Verification: the Step 5 specs cover the save → resolve → render round-trip.

**Step 5 — Phase A tests.**

- Registry completeness spec: every template has `subjectDefault`, every field a non-empty `defaultValue`.
- Length-cap spec (D13, 2026-07-26): every field's `maxLength` ≤ 500 and every `defaultValue.length` ≤ its field's `maxLength` — guards the `email_template_overrides.value` DB CHECK.
- Render-parity spec (load-bearing): for each template, render with zero overrides BEFORE the sweep (fixture captured pre-change) and AFTER — byte-identical HTML. Proves the copy-lift changed no live email.
- Existing override rows still honoured (mock rows → rendered output contains them).

**Phase A verify checkpoint:** static gates green; render-parity spec passes; production sends unchanged (no UI shipped yet).

### Phase B — Sample data + live preview endpoint

**Step 6 — `src/lib/email/sample-data.ts`.**

Canonical `SAMPLE_TEMPLATE_INPUT` (fictional "Aisha Khan", `.example.test` email, fixed date/time/price, 1 participant) + per-template extras (change_summary, booking_id, requested_date…) keyed by template id — the registry-driven successor to ManualSendSheet's `renderForTemplate` dispatch. Unit-test that every registered template renders non-throwing with its sample input.

**Step 7 — POST draft-preview handler.**

Extend `src/app/admin/email-templates/preview/[id]/route.ts`: `POST { draftValues }` → auth check (same as GET) → validate keys against the registry + maxLength → merge draft over saved overrides → render with sample data → return HTML (or text for plain_text templates). No persistence. GET unchanged.

*(Path corrected 2026-07-26 — the dynamic segment is `[id]`, not `[templateId]`; params typed `Promise<{ id: string }>` at route.ts:80. Do NOT create a sibling `[templateId]/` folder — duplicate slug names at the same route level break the Next.js build.)*

**Step 8 — Phase B tests.** Handler spec: auth, unknown template 404, oversize value 400, draft merge wins over saved override, output contains sample data.

### Phase C — Editor page + token fields

**Step 9 — `TokenTextField.tsx`.**

Chip-token input per brief Q9.1: spike contenteditable-with-pill-spans (canonical `{token}` strings in the stored value); fallback textarea + cursor-insert chips if the spike shows mobile/a11y fragility. Either way: char counter, maxLength enforcement, chip row from `field.tokens`, `min-h-11` targets, keyboard operable, `aria-label`s.

**Step 10 — `LivePreview.tsx`.**

Debounced (300 ms) POST of current draft → `srcdoc` swap; abort-controller cancels stale requests; "Preview uses sample data" note persistent; "Show what's editable" toggle adds faint outlines to FixedPart regions (renderer wraps fixed regions in `data-fixed-part` spans when a `?annotate=1` draft flag is set — annotation stripped in real sends).

**Step 11 — `TemplateEditor.tsx` + editor page.**

`/admin/emails/templates/[templateId]/page.tsx` (server: profile, template meta, saved overrides, badge data) → `TemplateEditor` (client): subject + fields in render order, per-field "Edited — Use default" affordance, "Filled automatically" collapsible legend, save via `saveTemplateOverride`, unsaved-changes guard, read-only mode without `MANAGE_EMAIL_TEMPLATES`. Two-pane ≥768 / stacked at 375 with sticky save bar (`bottom-14 md:bottom-0`, C-10 pattern).

**Step 12 — Phase C tests.** TokenTextField: insert-at-cursor, maxLength, canonical storage. Editor: dirty-state guard, per-field default reveal, read-only rendering.

### Phase D — Reset + test send

**Step 13 — `resetTemplateToDefault` server action.**

In `email-templates/actions.ts`: permission gate → delete all `email_template_overrides` rows for template_id → audit `email_template_reset` (before_state = the deleted rows) → `revalidatePath`. Editor + gallery-card confirm dialog per brief §2.5 copy. Disabled when zero overrides.

**Step 14 — `sendTestEmail` server action.**

Permission gate → validate draft (same rules as save) → render draft + sample data via the Phase B merge path → recipient = actor's `notification_email ?? email` (never a form value) → subject `[Test] ` prefix → `sendEmail` direct (NOT tracked — no delivery-log row) → audit `email_template_test_sent` → 60 s per-template rate limit (in-action timestamp check against latest audit row). Structured errors per brief §5.5–5.6.

**Step 15 — AUDIT_PHRASING** + `email_template_reset: "Email template reset to default"` + `email_template_test_sent: "Test email sent"`.

**Step 16 — Phase D tests.** Reset: permission, delete-all, audit, zero-override disable. Test send: recipient locked to self, draft validation, rate limit, audit-on-success-only.

### Phase E — Gallery + swap

**Step 17 — `TemplateGallery.tsx`.**

Cards grouped by audience; badge query (one grouped select over `email_template_overrides` joined to staff names); card → editor route; overflow menu with Reset (Step 13). Replaces `TemplateBrowser` + `TemplatesTab` mount in `emails/page.tsx`.

**Step 18 — Swap + navigation polish.** Templates tab renders the gallery; editor back-link returns to the tab; deep links to old in-tab editing states (if any query params existed) redirect sensibly.

### Phase F — Retirement + cleanup

**Step 19 — Delete** `ManualSendSheet.tsx`, `TemplateBrowser.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx`, `sendTemplateManually` (+ its helpers `requiredVarsFor` / `addHourClamped` / `renderForTemplate` — the sample-data module superseded them). Grep-verify zero imports remain (pre-flight #7 list re-run → empty).

**Step 20 — FAKE-marker sweep.** Confirm the 3 markers (preview iframe, plain-text preview, ManualSendSheet picker) are gone; note in C-09's inventory coordination (plan §8 there).

---

## 2 — Files touched (final list)

### NEW (~11)
| File | Purpose |
|---|---|
| `src/app/admin/emails/templates/[templateId]/page.tsx` | Editor page (server) |
| `src/app/admin/emails/templates/components/TemplateEditor.tsx` | Editor client shell |
| `src/app/admin/emails/templates/components/TokenTextField.tsx` | Chip-token input |
| `src/app/admin/emails/templates/components/LivePreview.tsx` | Debounced draft preview |
| `src/app/admin/emails/components/TemplateGallery.tsx` | Gallery cards + badges |
| `src/lib/email/sample-data.ts` | Canonical sample input + per-template extras |
| `src/lib/email/__tests__/sample-data.test.ts` | Every template renders with sample input |
| `src/lib/email/__tests__/registry-defaults.test.ts` | Registry completeness + render parity |
| `src/app/admin/email-templates/__tests__/resetTemplateToDefault.test.ts` | Reset coverage |
| `src/app/admin/email-templates/__tests__/sendTestEmail.test.ts` | Test-send coverage |
| `src/app/admin/emails/templates/__tests__/TokenTextField.test.tsx` | Token input behaviour |

### EDITED (~7)
| File | Change |
|---|---|
| `emails/components/templates-data.ts` | Registry expansion — all templates gain defaults/tokens/fixedParts/subjectDefault (may split into per-audience modules) |
| `lib/email/templates.ts` | Renderers read registry defaults; `data-fixed-part` annotation mode; copy-lift |
| `email-templates/actions.ts` | Widened `saveTemplateOverride`; + `resetTemplateToDefault` + `sendTestEmail`; − `sendTemplateManually`; SUBJECTS map → registry read |
| `email-templates/preview/[id]/route.ts` | + POST draft rendering |
| `emails/page.tsx` | Templates tab mounts `TemplateGallery` |
| `clients/[clientId]/page.tsx` | + 2 AUDIT_PHRASING entries |
| `lib/email/notifications.ts` | Only if `resolveTemplateOverrides` needs a draft-merge variant export (else untouched) |

### REMOVED (5)
`ManualSendSheet.tsx` · `TemplateBrowser.tsx` · `TemplateEditForm.tsx` · `TemplatePreviewPanel.tsx` · `TemplatesTab.tsx`

### UNCHANGED (do NOT touch)
- `email_template_overrides` schema + existing rows.
- Delivery + Reminders tabs (C-08 territory).
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint && npx tsc --noEmit && pnpm vitest run && pnpm build
node scripts/measure-admin-bundles.mjs
```

*(Baselines 2026-07-26)* `pnpm lint`: no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/) — a literal 0-error expectation will misfire. `pnpm vitest run`: 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) preserved.

**Bundle budget:** editor page is a NEW route (own chunk, ~8-10 kB: editor + token field + preview). Gallery replaces heavier in-tab editor code on `/admin/emails` — expect ~net-zero there. **Ceiling: +10 kB on the new `/admin/emails/templates/[id]` route; +2 kB max on `/admin/emails`.**

### 3.2 Render-parity assertion (the plan's load-bearing check)

Zero-override renders byte-identical before/after the registry sweep (Phase A Step 5 fixture spec) AND `email_template_overrides` rows byte-identical to the pre-flight capture (SQL diff). Proves no live email changed and no stored customisation was lost.

### 3.3 Playwright sweep (4 roles × 4 viewports)

- Gallery: badges correct (seed one Customised template first); Coord/Therapist read-only or hidden per existing visibility.
- Editor (Owner): type in intro → preview updates without saving; insert chip → token appears + renders as sample value in preview; "Show what's editable" outlines fixed parts; save → reload → persisted; per-field Use-default reveals + reverts.
- Reset: customise 2 fields → Reset → confirm → badge Default, fields show defaults, override rows gone (SQL), audit row present.
- Test send: click → email at actor's notification/login address with `[Test] ` prefix (Resend dashboard evidence); rate-limit second click.
- 375: stacked layout, sticky save bar clears mobile nav (C-10 measurement snippet), chips tappable.
- Regression: trigger one real send (test booking confirmation) → delivery row + received email use edited copy where overridden, defaults elsewhere.

### 3.4 Screenshot evidence

Gallery (1280 + 375) · editor two-pane (1280) · editor stacked (375) · chip insertion mid-edit · live preview showing an unsaved edit · fixed-part outlines on · reset confirm dialog · `[Test]` email in inbox. Store in `redesign/evidence/C-15/` *(evidence convention 2026-07-26, replaces the former `redesign/audits/C-A/screenshots-19-emails/c-15-after/` target — never write into `redesign/audits/**`)*.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Copy-lift silently changes a live email's wording | medium | high | Render-parity fixture spec (§3.2) — byte-identical zero-override output is a hard gate. |
| Registry sweep breaks an existing saved override | low | high | field_keys preserved verbatim; pre-flight SQL capture diffed post-ship. |
| Contenteditable token field fragile on mobile/screen readers | medium | medium | Spike first (Q9.1); locked-acceptable fallback: textarea + insert chips. Both store identical data. |
| Live-preview POST becomes a render-cost hotspot | low | low | Debounce 300 ms + abort stale; renders are cheap string templates. |
| Draft preview drifts from real sends | low | high | Same render functions, same merge helper — no parallel renderer exists by construction. |
| Deleting ManualSendSheet breaks a hidden consumer | low | medium | Pre-flight #7 import graph; Phase F re-grep must be empty. |
| `templates-data.ts` balloons past maintainability | medium | low | Split into per-audience modules behind the same index export (registry API stable). |
| Test send reaches a non-self recipient | low | high | Recipient derived server-side from the actor's profile only; never a form value; spec asserts it. |
| C-13/C-02 template steps collide with the reworked renderers | low | medium | They extend renderers additively; registry API unchanged; sequencing puts C-15 before both. |
| C-01 registry overlap (`templates-data.ts` / `email-templates/actions.ts`) — coordination was one-directional | low | low | Reciprocal note (D14, 2026-07-26): C-01's plan already carries a forward-compat note for C-15. If C-01 ships first (recommended order), its review-email templates join the Step 2 sweep; templates registered post-studio inherit the registry API — gallery/editor/preview automatically (brief §5.9). |

---

## 5 — Undo procedure

No migration → pure git reverts, phase-by-phase in reverse (F→A). Mid-flight partial undo is safe at any phase boundary: Phases A–B ship no UI change (parity-gated), so reverting C–F alone restores the old editor components (revert the deletion commit first). Override rows are never mutated by C-15 except through user-driven saves/resets — no data restoration needed.

---

## 6 — Test fixture guidance

- Customise a throwaway field on `booking_reminder` (test-safe template) for badge/reset walks; reset it before sign-off.
- Test sends target the actor's own address — use the Owner test account with its notification_email set to a `.example.test`-style inbox where possible; Resend dashboard is the delivery evidence either way.
- Real-send regression (§3.3 last item) uses a `.example.test` client booking only.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — registry types + copy-lift + renderer default reads + parity tests |
| 2 | Phase B — sample-data module + POST preview handler + tests |
| 3 | Phase C — TokenTextField + LivePreview + editor page + tests |
| 4 | Phase D — reset + test send + AUDIT_PHRASING + tests |
| 5 | Phase E — gallery + Templates-tab swap |
| 6 | Phase F — retire old components + FAKE sweep |
| 7 | Verification — screenshots + progress file + master plan checklist → ✅ |

`feat(redesign): C-15 {phase}` prefixes. No migration commits.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end; confirm C-08 landing state (pre-flight #3).
2. Phases strictly A→F; the §3.2 parity gate blocks Phase C until green.
3. No migrations; no Zone-2 actions.
4. Update progress file per commit; final commit flips the master-plan C-15 row → ✅.

---

## 9 — Open questions remaining

1. **Token field implementation** (Q9.1) — spike decides; fallback locked.
2. **Per-template copy-lift depth** (Q9.5) — finalised during Phase A audit; table in progress file.
3. **Old deep-link params on the Templates tab** — Step 18 handles; verify none exist in the wild (audit screenshots suggest none).
4. **`templates-data.ts` split threshold** — split when >~600 lines; implementer's call.

---

*End of C-15 plan. Brief: `redesign/briefs/C-15-email-template-studio-brief.md`. Progress: `redesign/per-page-progress/C-15-email-template-studio-progress.md` (filled during C-C).*
