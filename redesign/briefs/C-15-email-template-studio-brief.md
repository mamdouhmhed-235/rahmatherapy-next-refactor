# C-15 — Email template studio (gallery + live preview + chip variables + reset-to-default + test send)

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: templates section overhaul)
**Predecessors:**
- User direction 2026-07-16: the templates section is "terrible… incomplete and not easy to use at all"; wants per-template reset-to-default at one click, crystal-clear editable vs fixed content, no hand-typed variable codes, and a preview that shows changes **live**.
- `redesign/briefs/C-08-email-automation-expansion-brief.md` §2.7–§2.9 (2026-07-16 amendment — companion bundle: notification email powers C-15's test send)
- `redesign/audits/C-A/19-emails-audit.md` (PE-51 called the existing editor "exemplary" **relative to other admin surfaces** — the owner's verdict supersedes: it is not good enough in absolute terms)
- Code verified 2026-07-16: `templates-data.ts` (9 templates, 1–3 safe fields each, admin templates expose only the footer line), `email-templates/actions.ts` (SUBJECTS hardcoded — subjects not editable), `TemplatePreviewPanel.tsx` (iframe of SAVED state only, `data-redesign-backend="FAKE"`), reset-to-default exists only as "clear the field and save".
**Companion files:**
- Plan: `redesign/plans/C-phase/C-15-email-template-studio-plan.md`
- Progress: `redesign/per-page-progress/C-15-email-template-studio-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-15 replaces the Templates tab's editing experience end-to-end while keeping the storage layer (`email_template_overrides`, per-template+field rows) unchanged. **Zero migrations.**

Six deliverables:

1. **Registry expansion** — every template's *default copy* moves out of the renderer bodies into a single defaults registry; **subject lines become editable everywhere**; each renderer's hardcoded body copy is audited and lifted into editable fields where safe. The registry is the single source for editor fields, defaults, reset, and preview.
2. **Template gallery** — cards grouped by audience with plain-English name, "Sent when…" trigger line, and a **Default / Customised** badge (who edited, when).
3. **Editor page per template** (`/admin/emails/templates/[templateId]`) — fields on one side, preview on the other (stacked at 375). **Variables are inserted via chips** ("Client name", "Booking date") — no hand-typed `{clientName}` codes. A "Filled automatically" legend lists every fixed part and its source ("Clinic phone — from Settings").
4. **Live preview** — re-renders as the user types, **before saving**, through the exact same render functions used for real sends. Sample data clearly labelled.
5. **Reset to default** — per-template button (confirm dialog, audited, deletes all override rows) + per-field "Use default" affordance that shows the default text first.
6. **Send me a test** — one click sends the current **draft** to the viewer's `notification_email ?? email` (C-08 Phase D column). Replaces the ManualSendSheet, which is **retired**.

**Sequencing:** immediately after C-08 (its 5 new templates and the notification-email column land first). Before C-13/C-02, so their template work lands inside the finished studio. Registry stays backward-compatible — C-01/C-02/C-13 register templates the same way and inherit the studio automatically.

---

## 1 — Why this plan exists

### 1.1 The owner's verdict (2026-07-16)

Direct user feedback on `/admin/emails` Templates tab:

- "doesn't work properly and it's also incomplete and not easy to use at all"
- "not even clear how to make changes"
- "the variables that are fixed and those that aren't isn't clear"
- "it seems to expect a user to write down the variable code" — correct: `SafeField.helper` literally says *"Variables in curly braces are filled automatically"* and placeholders show `{clientName}` for the user to type.
- "every template [should have] a default that it can be changed back to very easily… at the click of a button"
- "the preview should show the exact changes as well and show the changes live!!"

### 1.2 What code inspection confirms (2026-07-16)

| Complaint | Code reality |
|---|---|
| Editing surface incomplete | 9 templates × 1–3 `SafeField`s each; the 3 admin_internal templates expose ONLY `footer_contact`. Subjects hardcoded in `SUBJECTS` (`email-templates/actions.ts:68`) — not editable at all. |
| Preview not live | `TemplatePreviewPanel` iframes `GET /admin/email-templates/preview/[id]` — server-rendered from SAVED overrides. Unsaved edits invisible until save + reload. The iframe carries `data-redesign-backend="FAKE"`. |
| Reset undiscoverable | Clearing a field and saving deletes the override row (`saveTemplateOverride` empty-value branch) — functional but invisible; no button, no "Customised" indicator anywhere. |
| Variable codes | Users type `{clientName}` by hand; nothing lists which tokens a template supports; fixed vs editable is implicit. |

### 1.3 Why now (and not C-12+)

Five plans (C-01, C-04a, C-08, C-02, C-13) are about to grow the template count from 9 to ~16 and the field count several-fold (C-01 alone registers 16 fields). Shipping them into the current editor multiplies the pain; shipping the studio right after C-08 means every subsequent template lands into good UX once.

---

## 2 — Scope

### 2.1 Registry expansion (defaults + subjects + variables catalogue)

`templates-data.ts`'s `TemplateMeta`/`SafeField` gain (backward-compatible — existing entries keep working before their sweep):

```ts
export interface SafeField {
  kind: string;              // widened from the SafeFieldKind union — per-template keys allowed
  label: string;
  helper: string;
  maxLength: number;
  multiline?: boolean;
  defaultValue: string;      // NEW — the canonical default (single source for reset + preview + render)
  tokens?: TemplateToken[];  // NEW — which variables this field may embed (chip list)
}

export interface TemplateToken {
  token: string;             // canonical stored form, e.g. "{clientName}"
  label: string;             // chip label, e.g. "Client name"
  sample: string;            // sample-data value used in preview, e.g. "Aisha Khan"
}

export interface TemplateMeta {
  // ...existing...
  subjectDefault: string;    // NEW — lifts SUBJECTS map into the registry
  fixedParts: FixedPart[];   // NEW — "Filled automatically" legend entries
}

export interface FixedPart {
  label: string;             // "Booking summary table"
  source: string;            // "Built from the booking's date, time, services and price"
}
```

- **Subject becomes an override field** (`field_key = 'subject'`) on every template. `SUBJECTS` in `email-templates/actions.ts` becomes a thin read of the registry (or is deleted where redundant).
- **Renderer copy-lift audit:** each of the ~14 render functions in `templates.ts` is walked; every hardcoded user-facing sentence is either (a) lifted into a `SafeField` with `defaultValue`, or (b) declared a `FixedPart` with a reason (auto-generated summaries, legal footer, layout scaffolding). The admin_internal templates gain real fields (intro line, detail-ordering sentence) instead of footer-only.
- **Render functions read defaults from the registry** (`overrides[key] ?? field.defaultValue`) so editor, preview, reset, and real sends can never disagree.
- **Length cap (D13, 2026-07-26):** `email_template_overrides.value` has a DB `CHECK (<=500 chars)` (migration 20260519120000). Every new/expanded field keeps `maxLength` ≤ 500 and every lifted `defaultValue` is validated ≤ 500 chars pre-ship. NO migration to relax the CHECK.
- File-size guard: if `templates-data.ts` grows unwieldy, split into `templates-data/` per-audience modules re-exported from an index (registry API unchanged).

### 2.2 Template gallery

Replaces `TemplateBrowser` list UX at the Templates tab:

- Cards grouped by audience (Customer / Staff / Internal alerts), each: plain-English `cardName`, trigger sentence ("Sent when a booking request is submitted"), and a status badge — **Default** (neutral) or **Customised** (accent) with `updated_by` name + relative date from the newest override row.
- Card click → editor page (§2.3).
- Badge data: one grouped query over `email_template_overrides` (template_id → max(updated_at), updated_by).

### 2.3 Editor page — `/admin/emails/templates/[templateId]`

Full-page editor (the cramped in-tab form retires):

- **Two-pane ≥768:** fields left (~40%), live preview right. **Stacked at 375:** fields, then sticky "Preview" toggle/anchor.
- **Fields:** subject first, then body fields in render order. Each field: label, helper, character counter, **chip row** of its `tokens` — click/tap inserts the token at the cursor. Tokens render as visually distinct pills inside the input (token-aware editor component; graceful fallback: plain textarea + chips insert `{token}` text — impl-time call, both store identical canonical strings).
- **Per-field default affordance:** when a field is overridden, a subtle "Edited — Use default" link under it; hover/tap reveals the default text before committing.
- **"Filled automatically" panel:** collapsible legend rendered from `fixedParts` — each entry: what it is + where it comes from. In the preview, fixed regions get a faint outline + "auto" tag toggled by a "Show what's editable" switch.
- **Save / discard:** save persists via the existing `saveTemplateOverride` action (extended for `subject` + new field keys); unsaved-changes guard on navigation.
- Read-only mode for viewers lacking `MANAGE_EMAIL_TEMPLATES` mirrors the current read-only notice.

### 2.4 Live preview

- New handler: `POST /admin/email-templates/preview/[id]` *(segment corrected 2026-07-26 — the existing route folder is `preview/[id]/`, not `[templateId]/`)* accepting `{ draftValues: Record<string,string> }` → merges draft over saved overrides → renders through the real render function with canonical **sample data** → returns HTML. Debounced ~300 ms from the editor; response swapped into the preview iframe via `srcdoc`.
- `GET` behaviour preserved for the initial paint.
- Sample data: one canonical `SAMPLE_TEMPLATE_INPUT` module (fictional client "Aisha Khan", `.example.test` address, fixed date) shared by preview + test send. A persistent "Preview uses sample data" note stays.
- Plain-text templates preview in the existing `<pre>` style, same draft-merge path.
- Removes both `data-redesign-backend="FAKE"` markers on the preview components (they become real).

### 2.5 Reset to default

- **Per-template:** "Reset to default" button on the editor page (and on the gallery card's overflow menu). Confirm dialog: *"Reset '{cardName}' to its default wording? Your customisations to this template will be removed. Emails already sent are not affected."* → server action deletes ALL override rows for the template_id → one audit row `email_template_reset` (before_state = deleted rows) → badge flips to Default.
- **Per-field:** the §2.3 "Use default" link clears just that field's override (existing empty-value delete path, now discoverable).

### 2.6 Send me a test

- Button on the editor page: **"Send me a test"** → sends the current **draft** (unsaved edits included — what you see is what you get) to the viewer's `notification_email ?? email` (C-08 Phase D column; falls back cleanly pre-C-08-Phase-D).
- Subject prefixed `[Test] `. Sent via `sendEmail` directly (NOT `sendTrackedEmail` — test sends don't pollute the delivery log); audit row `email_template_test_sent` (mirrors the existing `email_template_sent_manually` pattern). 60s per-template rate limit.
- **ManualSendSheet retires** (§2.7).

### 2.7 Retirement: ManualSendSheet + old editor components

- `ManualSendSheet.tsx` (438 lines, hand-typed fake variables, FAKE-marked booking picker) is **removed**, with `sendTemplateManually` action. Superseded by: test send (§2.6) for "see it in my inbox", C-08's per-row Resend for "send a real one again". Audit history rows for `email_template_sent_manually` remain (harmless).
- `TemplateBrowser.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx` are replaced by the gallery + editor page; delete after the swap (no orphans).

---

## 3 — RBAC matrix

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| See gallery + open editor read-only | per existing Templates-tab visibility | same | read-only if visible today | read-only if visible today |
| Edit fields / save | ✅ `MANAGE_EMAIL_TEMPLATES` | ✅ | ❌ | ❌ |
| Reset template / field to default | ✅ same permission | ✅ | ❌ | ❌ |
| Send me a test | ✅ same permission (to own address only) | ✅ | ❌ | ❌ |

No new permissions. Test send always targets the **actor's own** address — never an arbitrary recipient (that was ManualSendSheet's job; deliberately dropped).

---

## 4 — Layout strategy

### 4.1 Gallery (Templates tab)

```
CUSTOMER
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ Booking confirmation         │ │ Booking confirmed - client   │
│ Sent when a booking request  │ │ Sent when a pending booking  │
│ is submitted                 │ │ is confirmed                 │
│ ● Customised · Owner · 2d ago│ │ ○ Default                    │
└──────────────────────────────┘ └──────────────────────────────┘
```

### 4.2 Editor (≥768)

```
┌ Booking confirmation ─────────── [Reset to default] [Send me a test] ┐
│ ┌ Fields ──────────────┐  ┌ Preview (sample data) ────────────────┐ │
│ │ Subject              │  │                                        │ │
│ │ [Booking request re…]│  │   (re-renders ~300ms after each        │ │
│ │ Greeting intro       │  │    keystroke — exact send rendering)   │ │
│ │ [Hi ⦅Client name⦆ …] │  │                                        │ │
│ │  + Client name chip  │  │   fixed parts outlined faintly when    │ │
│ │  + Booking date chip │  │   "Show what's editable" is on         │ │
│ │ ▸ Filled automatically│ │                                        │ │
│ │ [Save changes]       │  │                                        │ │
│ └──────────────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

At 375: fields stack above preview; save bar sticky above the mobile nav (`bottom-14`, C-10 pattern); chips wrap; `min-h-11` targets.

---

## 5 — States & edge cases

- **5.1 Unsaved draft + navigation:** unsaved-changes confirm guard. Draft lives in component state only (no localStorage — templates are short-form).
- **5.2 Concurrent editors:** last-write-wins per field (existing upsert behaviour). The gallery badge's `updated_by` gives after-the-fact visibility. Acceptable at this team size.
- **5.3 Token in a field that doesn't support it:** hand-typed `{unknownToken}` renders literally (existing `substituteVars` behaviour). The chip row only offers supported tokens; helper says *"Insert names and dates with the buttons above."* No hard validation — matches current behaviour.
- **5.4 Reset with zero overrides:** button disabled when the badge is Default.
- **5.5 Test send with an invalid draft (over maxLength):** same validation as save runs first; structured error toast, nothing sent.
- **5.6 Test send failure (Resend outage/misconfig):** structured error toast from the existing `EmailConfigurationError`/`EmailDeliveryError` mapping; audit row only on success.
- **5.7 Live-preview request racing:** debounce + abort-controller; last response wins; stale responses discarded.
- **5.8 Preview endpoint abuse:** POST handler requires the same auth as the page; draft values are render-time only, never stored; `escapeHtml` at render time is the existing final defence.
- **5.9 New templates added by later plans (C-01/C-02/C-13):** register a `TemplateMeta` with `defaultValue`s → appear in gallery + editor automatically. Zero studio changes needed.
- **5.10 Templates whose renderer takes extra context** (change summary, booking id): the sample-data module supplies canonical extras per template — same dispatch shape as the retired ManualSendSheet's `renderForTemplate`, now driven by the registry.

---

## 6 — Migration footprint

**None.** Subject + new field overrides are new `field_key` values in the existing `email_template_overrides` table (free-text `field_key`, verified). New audit action_types (`email_template_reset`, `email_template_test_sent`) are code constants. Test send reads C-08's `notification_email` column (soft dependency — falls back to login email if C-08 Phase D hasn't shipped).

---

## 7 — Files touched (preview — full list in plan)

### NEW (~10)
- `src/app/admin/emails/templates/[templateId]/page.tsx` — editor page
- `src/app/admin/emails/templates/components/TemplateEditor.tsx` — fields + save/reset/test toolbar
- `src/app/admin/emails/templates/components/TokenTextField.tsx` — chip-token input
- `src/app/admin/emails/templates/components/LivePreview.tsx` — debounced draft preview
- `src/app/admin/emails/components/TemplateGallery.tsx` — gallery cards + badges
- `src/lib/email/sample-data.ts` — canonical `SAMPLE_TEMPLATE_INPUT` + per-template extras
- `src/app/admin/email-templates/preview/[id]/route.ts` — extended for POST draft rendering (exists as GET — extended, not new; segment verified `[id]` 2026-07-26)
- Tests: registry defaults round-trip, reset action, test-send action, TokenTextField behaviour

### EDITED (~8)
- `templates-data.ts` — registry expansion (defaults, tokens, fixedParts, subjectDefault) across all templates
- `templates.ts` — renderers read defaults from the registry; copy-lift per §2.1
- `email-templates/actions.ts` — `saveTemplateOverride` accepts new field keys incl. `subject`; + `resetTemplateToDefault`; + `sendTestEmail`; − `sendTemplateManually`
- `emails/page.tsx` — Templates tab mounts `TemplateGallery`
- `clients/[clientId]/page.tsx` — AUDIT_PHRASING + 2 entries

### REMOVED (~5)
- `ManualSendSheet.tsx`, `TemplateBrowser.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx` (after swap)

---

## 8 — Sequencing and dependencies

- **After C-08** — its 5 templates register first; its `notification_email` column feeds test send (soft — login-email fallback).
- **Before C-13 + C-02** — their template additions/extensions land inside the studio. C-13's group-context block plugs into the post-copy-lift renderers (registry-driven; C-13's steps remain valid as written).
- **C-01** — independent either way; its 16-field template benefits automatically whenever it ships.
- **C-04a** — its queued-email machinery is orthogonal (stored payloads, not templates).
- **C-09** — C-15 removes 3 non-filter FAKE markers (preview iframe, plain-text preview, ManualSendSheet booking picker); C-09's C-12+ FAKE inventory should list them as "owned by C-15".
- **C-11** — all new components use admin CSS variables (dark-mode-safe by construction).
- Recommended order becomes: … → C-08 → **C-15** → C-13 → C-02 → …

---

## 9 — Open questions

**Q9.1 — Token pills: contenteditable or textarea+insert?** Preferred: token-aware contenteditable storing canonical `{token}` strings. Fallback (locked as acceptable): plain textarea + chip inserts the literal token text at cursor. Decide at impl after a spike; both persist identical data.

**Q9.2 — Live preview transport: srcdoc swap vs iframe reload?** Locked: fetch POST → `srcdoc` swap (no full iframe reload flicker); GET remains for initial load.

**Q9.3 — Should reset also clear the subject?** Locked: yes — reset means the whole template, subject included. Per-field "Use default" covers subject-only reverts.

**Q9.4 — Keep any "send to arbitrary address" capability?** Locked: no (user-aligned: simplicity). Test send goes to self; real re-delivery is C-08's Resend. Revisit in C-12+ only on demand.

**Q9.5 — Copy-lift depth for admin_internal templates?** Target: subject + intro line + footer minimum; auto-generated detail tables stay fixed. Exact per-template field list finalised during the Phase A audit with a documented table in the progress file.

---

## 10 — Acceptance criteria (what "done" looks like)

1. Every template (9 existing + C-08's 5) shows in the gallery with correct Default/Customised badge.
2. Subject editable on every template; saved as `field_key='subject'`; real sends use it.
3. Every editable field carries a `defaultValue` in the registry; renderers read defaults from the registry (grep: no user-facing default strings left inline in `templates.ts` bodies except declared FixedParts).
4. Chip insertion works for every token on every field that supports one; no helper text tells users to type curly braces.
5. Live preview reflects an unsaved edit within ~500 ms, rendered by the real render function with sample data.
6. "Filled automatically" legend present per template; preview outline toggle works.
7. Per-template Reset deletes all override rows, writes `email_template_reset` audit, flips badge; per-field Use-default works.
8. "Send me a test" delivers the draft to the actor's notification/login email with `[Test] ` subject prefix; audit row written; rate-limited.
9. ManualSendSheet + 4 old editor components deleted; zero imports remain; the 3 FAKE markers gone.
10. Read-only viewers see gallery + preview but no save/reset/test controls.
11. Static gates pass; bundle delta within ceiling; Playwright sweep across 4 roles × 4 viewports; screenshots stored.
12. No change to `email_template_overrides` schema; existing saved overrides still honoured after the registry sweep (field keys preserved).

---

## 11 — References

| Source | What it gives |
|---|---|
| User direction 2026-07-16 | The six wants: complete, intuitive, clear fixed-vs-editable, no variable codes, one-click default restore, live preview |
| `emails/components/templates-data.ts` | Current registry shape (SafeField/TemplateMeta) — extension base |
| `email-templates/actions.ts:80-210` | `saveTemplateOverride` per-field upsert/delete + audit pattern — reset + subject extend this |
| `email-templates/actions.ts:212-360` | `sendTemplateManually` — pattern donor for `sendTestEmail`, then retired |
| `emails/components/TemplatePreviewPanel.tsx` | Current saved-state-only preview (FAKE-marked) — replaced by LivePreview |
| `lib/email/templates.ts` | Render functions + `resolveTemplateOverrides` + `substituteVars` — copy-lift target |
| C-08 brief §2.8 (2026-07-16) | `notification_email` column — test-send recipient |
| `19-emails-audit.md` PE-51 | Prior audit context (superseded verdict) |

---

## 12 — Out of scope (explicit non-goals)

- **Free-form HTML editing / rich-text (bold, colours, layout).** Structured fields only — safety and email-client compatibility. C-12+ if ever.
- **Template versioning / history browser.** Audit rows record changes; a browsable diff UI is C-12+.
- **New template creation from the UI.** Templates are code-defined (renderer + registry); the studio edits copy, not structure.
- **Per-template CC/recipient overrides.** C-08 Q9.7 posture unchanged.
- **Multi-language variants.** English-only.
- **Changing email visual design/layout.** Existing HTML layout scaffolding untouched.
- **Delivery-log or Reminders-tab changes.** C-08 owns those surfaces.

---

*End of C-15 brief. Plan file follows: `redesign/plans/C-phase/C-15-email-template-studio-plan.md`.*
