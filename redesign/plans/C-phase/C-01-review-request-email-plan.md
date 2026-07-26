# C-01 — Google review request email (2h after completion) — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard-blocking — C-01 is LIGHT-routed (admin-side, merge-untouched per factpack/CORE.md routing table). Shared-surface note: `worker-entrypoint.ts` / `wrangler.jsonc` cron dispatch is also touched by C-02 and C-04a — see the order-agnostic note at Step 15/16.
> Decisions: C-B-DECISIONS.md §2 Q4, §3 C-01. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-01-review-request-email-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-01-review-request-email-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight (verify before touching code)

1. **Branch + clean tree.** On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` (expect `master`) and `git merge-base --is-ancestor ea97932 HEAD` (expect exit 0). Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/lib/email/ src/app/api/cron/ src/app/admin/email-templates/ src/app/admin/emails/components/ src/app/admin/clients/ worker-entrypoint.ts wrangler.jsonc supabase/migrations/` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp/` logs) — NEVER stage broadly, NEVER stash/restore/checkout to 'clean' it. *(Was: "HEAD on `redesign/start-state`" — that branch merged into master at `ea97932`; C01-F1.)*
2. **Dev server reachable.** `curl -I http://localhost:3000/admin/login/` → `HTTP/1.1 200 OK`.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing — 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) preserved, not caused by this plan.
4. **Static gates green.** `npx tsc --noEmit` — 0 errors. `pnpm lint` — no NEW errors vs the 59-error baseline (55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`); this plan's gate is "no new errors," not "0 errors." *(C01-F2.)*
5. **DB schema verification:**

   ```sql
   -- (a) Confirm completed_at + review_email_sent_at don't exist yet
   SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='bookings'
     AND column_name IN ('completed_at', 'review_email_sent_at');
   -- Expected: 0 rows

   -- (b) Verify pg_cron is NOT installed (confirms Cloudflare Workers path)
   SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
   -- Expected: 0 rows. Plan locks Cloudflare Workers cron path.

   -- (c) Check email_delivery_events.event_type for CHECK constraint
   SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
   JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'email_delivery_events' AND c.contype = 'c';
   -- If no CHECK on event_type → no migration needed for the new value.
   -- If CHECK exists → migration ALTERs the constraint (1-line addition).

   -- (d) Sanity: 2 existing completed bookings present per W03 audit
   SELECT id, contact_email, updated_at FROM bookings WHERE status = 'completed' ORDER BY updated_at DESC;
   -- Expected: 2 rows. Backfill targets them.

   -- (e) Owner test account exposure check
   SELECT id, contact_email, status FROM bookings WHERE contact_email = 'rahmatherapy@outlook.com';
   -- Capture for §6 backfill suppression list.
   ```

6. **Cloudflare Workers cron infrastructure confirmed.** Verify:
   - `wrangler.jsonc` has the `triggers.crons` array with `["0 8 * * *"]` present — re-grep the live array first: if C-02 or C-04a landed first, additional cron entries may already be present; this plan appends its own entry rather than assuming a single-entry array.
   - `worker-entrypoint.ts`'s `scheduled()` handler dispatches to `fireBookingReminders` today (a single unconditional call, no switch). If an `event.cron`-keyed dispatch switch already exists (because C-02 or C-04a landed first), this plan adds one case to it instead of building a new switch — do not assume ownership of this file (D3; collision-map §4 — shared with C-02, C-04a).
   - `src/app/api/cron/booking-reminders/route.ts` exists and is the canonical pattern.
   - `process.env.CRON_SECRET` is set — verify by reading `.env.local` directly (confirm the key exists; do not print its value) or asking the user to confirm; do not proceed on an assumed value.

7. **Resend configuration confirmed.**
   - `RESEND_API_KEY` env var set.
   - `RESEND_FROM_ADDRESS` env var set (confirm via reading existing `sendTrackedEmail` usage).

8. **Capture pre-state baseline:**

   ```sql
   -- Email-event histogram (used in post-deploy comparison)
   SELECT event_type, COUNT(*) FROM email_delivery_events GROUP BY event_type ORDER BY event_type;
   -- Expected: 7 active types per W03 audit. Adding review_request_client = 8 post-C-01.

   -- Audit-log histogram for booking* action types
   SELECT action_type, COUNT(*) FROM audit_logs
   WHERE action_type LIKE 'booking%' OR action_type = 'review_email_sent'
   GROUP BY action_type ORDER BY action_type;
   ```

9. **Test fixture inventory:**
   - At least one test completed booking with a **fake-domain test email** for E2E sends. Verify: `SELECT id, contact_email FROM bookings WHERE status='completed' AND contact_email LIKE '%example.test'`.
   - If none, create via C-04a's `mark_complete` quick action against an `Audit Test Client *` booking (Zone-2 — explicit confirmation).

10. **DO-NOT-TRIGGER list:**
    - Badar's `9d55ce2a` (cancelled, won't qualify anyway).
    - **Owner account email `rahmatherapy@outlook.com`** — backfill suppresses this in §6.
    - Any non-test client.

> DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

If any pre-flight step fails, **stop** and surface to the user.

---

## 1 — Safe implementation order (5 phases, with verify-checkpoints)

### Phase A — Migration (Zone-2: explicit confirmation before applying)

**Step 1 — Author the migration file.**

New file: `supabase/migrations/<YYYYMMDDHHMMSS>_c01_review_email_infrastructure.sql`.

```sql
-- C-01 review email infrastructure — single migration
-- Adds completed_at + review_email_sent_at columns + completed_at trigger.
-- Adds review_request_client to email_event_type (if constrained).
-- Backfills the 2 existing completed bookings as "already handled".

BEGIN;

-- 1. New columns on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz;

-- 2. Trigger to set completed_at on transition INTO 'completed' status.
--    On reopen (completed → other), preserve historical completed_at so
--    audit forensics + sentinel stay consistent.
CREATE OR REPLACE FUNCTION public.bookings_set_completed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'completed' AND OLD.completed_at IS NOT NULL THEN
    NEW.completed_at = OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_completed_at_trigger ON public.bookings;
CREATE TRIGGER bookings_completed_at_trigger
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_completed_at();

-- 3. (conditional based on pre-flight Step 5c) email_event_type CHECK
-- Only included if the pre-flight detects a CHECK constraint on event_type:
-- ALTER TABLE public.email_delivery_events DROP CONSTRAINT <name>;
-- ALTER TABLE public.email_delivery_events ADD CONSTRAINT <name>
--   CHECK (event_type IN ('booking_confirmation', ..., 'review_request_client'));

-- 4. Backfill — 2 existing completed bookings get completed_at = updated_at
--    and review_email_sent_at = completed_at (marks them as "already handled")
UPDATE public.bookings
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

UPDATE public.bookings
SET review_email_sent_at = completed_at
WHERE status = 'completed' AND review_email_sent_at IS NULL;

-- 5. Defensive: suppress review email for the Owner test account
UPDATE public.bookings
SET review_email_sent_at = COALESCE(review_email_sent_at, now())
WHERE contact_email = 'rahmatherapy@outlook.com';

COMMIT;
```

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply the C-01 migration (Step 1 SQL above) to the production Supabase project via `mcp__supabase__apply_migration`.
> Exact SQL / change: the migration body in Step 1 above (adds `bookings.completed_at` + `bookings.review_email_sent_at`, the `bookings_set_completed_at` trigger, the conditional `email_delivery_events` CHECK update, and the backfill/suppression UPDATEs).
> Post-action verification: Step 4's 3 verification queries below (columns exist, trigger exists, 0 completed bookings with NULL sentinel columns).
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 2 — Apply migration via `mcp__supabase__apply_migration`.**

**Zone-2 — explicit user confirmation per migration.** Show the migration SQL to the user first; await approval. Capture the `migration_name` returned by the tool for the progress log.

**Step 3 — Regenerate TypeScript types.**

```
mcp__supabase__generate_typescript_types
```

Update any imports if type signatures changed (unlikely — new columns are additive). Verify `npx tsc --noEmit` still green.

**Step 4 — Post-migration verification.**

```sql
-- Verify columns exist
\d bookings
-- Or:
SELECT column_name FROM information_schema.columns
WHERE table_name='bookings' AND column_name IN ('completed_at', 'review_email_sent_at');
-- Expected: 2 rows

-- Verify trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'bookings_completed_at_trigger';
-- Expected: 1 row

-- Verify backfill — no completed booking should have NULL columns
SELECT COUNT(*) FROM bookings
WHERE status = 'completed' AND (completed_at IS NULL OR review_email_sent_at IS NULL);
-- Expected: 0
```

**Phase A verify checkpoint:**
- All 3 verification queries pass.
- `npx tsc --noEmit` green.
- Commit migration with `feat(redesign): C-01 Phase A — review email infrastructure migration`.

### Phase B — Renderer + variant picker (pure code, no integrations)

**Step 5 — Implement `pickReviewMessages` + `substituteCity` + `DEFAULT_REVIEW_VARIANTS`.**

Edit `src/lib/email/templates.ts`. Add near the top of the renderer section (search for the existing renderers to find a good insertion point — after `renderBookingCancellationEmail` is a reasonable spot):

```ts
// ─── Review request email (C-01) ──────────────────────────────────────────

const DEFAULT_REVIEW_VARIANTS = {
  massage: [
    "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
    // ... full 5 from brief §2.2
  ],
  cupping: [
    "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
    // ... full 5 from brief §2.2
  ],
} as const;

export interface ReviewMessageVariant {
  text: string;
  source: "override" | "default";
}

export interface PickReviewMessagesArgs {
  groupCategory: "massage" | "cupping" | null;
  city: string | null;
  overrides: Record<string, string>;
  random?: () => number;
}

export function pickReviewMessages(args: PickReviewMessagesArgs): ReviewMessageVariant[] {
  // Implementation per brief §2.2
}

function substituteCity(text: string, city: string | null): string {
  // Implementation per brief §2.2
}
```

**Step 6 — Vitest spec for the picker.**

New file `src/lib/email/__tests__/pickReviewMessages.test.ts`. Use vitest's standard pattern; mock `Math.random` via the `random` parameter for determinism. Test cases:

1. `groupCategory='massage'`, no overrides, `city='Luton'` → returns 3 variants from massage pool with `{city}` replaced by 'Luton'.
2. `groupCategory='cupping'`, no overrides, `city='Luton'` → returns 3 variants from cupping pool.
3. `groupCategory='massage'`, overrides `{ massage_variant_2: "custom override" }`, `city='Luton'` → if variant 2 is in the picked set, source='override' + custom text.
4. `groupCategory=null`, no overrides, `city='Luton'` → falls back to massage pool.
5. `groupCategory='massage'`, no overrides, `city=null` → variant text has " in {city}" stripped cleanly.
6. Deterministic random: `random: () => 0.5` → predictable shuffle. Assert the picked set against expected indices.

**Step 7 — Implement `renderReviewRequestEmail`.**

In `templates.ts`, after `pickReviewMessages`. Per brief §2.2. Uses `resolveTemplateOverrides`, `substituteVars`, `buildVarMap`, `renderLayout`, `escapeHtml` — all existing.

**Step 8 — Add `renderBookingPlainText` variant for review (if needed).**

The existing `renderBookingPlainText(label, input)` doesn't know about review variants. Two options:
- (a) Pass the 3 picked variants in `extras` and have `renderBookingPlainText` render them in plain text.
- (b) Create a separate `renderReviewRequestPlainText` for the review template.

**Decided:** (b) — cleaner separation. Quick function in `templates.ts`:

```ts
export function renderReviewRequestPlainText(
  input: ReviewRequestEmailInput,
  variants: ReviewMessageVariant[]
): string {
  return `Thank you for choosing Rahma Therapy

If you have a moment, we'd be grateful for an honest review on Google${input.city ? ` — it helps other people in ${input.city} find us.` : "."}.

Here are a few examples if you'd like a starting point, or write your own:
${variants.map((v) => `- ${v.text}`).join("\n")}

Leave a review: https://g.page/r/Ccfwk27JycKDEBM/review

Thank you again,
The Rahma Therapy team
`;
}
```

**Phase B verify checkpoint:**
- `pnpm lint` + `tsc` green.
- `pnpm vitest run` — new pickReviewMessages tests pass.
- Manually invoke `renderReviewRequestEmail` from a Node REPL or via the preview route (Phase E exercises this end-to-end).

### Phase C — Send fn + SUBJECTS + templates-data registration

**Step 9 — Implement `sendReviewRequestEmail` + `deriveGroupCategoryForBooking`.**

Edit `src/lib/email/notifications.ts`. Add after the existing review-adjacent send-fns (e.g., after `sendBookingReminderEmail` around line 520). Per brief §2.3.

Imports needed:
- `ReviewRequestEmailInput`, `pickReviewMessages`, `renderReviewRequestEmail`, `renderReviewRequestPlainText` from `templates.ts`
- Existing: `getBookingTemplateInput`, `sendTrackedEmail`

**Step 10 — Unit test for `sendReviewRequestEmail`.**

New file `src/lib/email/__tests__/sendReviewRequestEmail.test.ts`. Use vitest mocking pattern:
- Booking with email + status=completed + review_email_sent_at NULL → returns `{ sent: true }`, calls sendTrackedEmail.
- Booking already-sent → returns `{ sent: false, reason: "already_sent" }`, doesn't call sendTrackedEmail.
- Booking with no email → returns `{ sent: false, reason: "no_email" }`, marks sentinel.
- Booking with status='confirmed' → returns `{ sent: false, reason: "send_failed" }`.
- Booking not found → throws.
- Mixed-category booking (`deriveGroupCategoryForBooking` returns null) → falls back to massage pool (verify via spy on `pickReviewMessages` args).

**Step 11 — Add `review_request_client` to SUBJECTS map.**

Edit `src/app/admin/email-templates/actions.ts:68-78`. Add:

```ts
const SUBJECTS: Record<string, string> = {
  // existing entries...
  review_request_client: "Thank you for visiting Rahma Therapy",
};
```

**Step 12 — Register in `templates-data.ts`.**

> **Coordination (2026-07-16):** C-15 (email template studio) expands this registry with `defaultValue`/`tokens`/`subjectDefault`/`fixedParts`. If C-15 has already shipped when C-01 lands, register this template in the expanded shape (defaults in the registry, not inline in the renderer); if not, register as below and C-15's sweep picks it up. Either way this step's intent is unchanged.

> **Coordination (2026-07-26, rubric §10 shared-surface note — collision-map §7):** `templates-data.ts`'s `TemplateMeta`/`SafeFieldKind` schema is edited by C-01, C-02, C-08, C-13, and (primarily) C-15. `SafeFieldKind` is a closed union — do not invent new `kind` string literals ad hoc. If C-15 has landed, extend its post-refactor schema. If C-15 has not landed, coordinate with whichever of C-01/C-08 lands first before adding a second incompatible extension to the union. Any new field's `maxLength` must stay compatible with `email_template_overrides.value`'s DB CHECK (<=500 chars).

> **Premise correction (2026-07-26, C01-F3):** the current `TemplateMeta` interface (`templates-data.ts:25-32`) requires `{ id, audience, cardName, trigger, rendersAs: "html"|"plain_text", fields: SafeField[] }` — there is no `description` field, and `trigger`/`rendersAs` are required. `SafeFieldKind` (`templates-data.ts:8-13`) is the closed union `greeting_intro | footer_contact | group_copy | intro | wrapper_change_summary | plain_text_intro` — none of the `kind` values below exist in it yet. Per D7, extend `SafeFieldKind` minimally with the 16 literals this template needs (`subject`, `body_intro`, `body_ask`, `body_cta_label`, `body_cta_url`, `body_signoff`, `massage_variant_1`..`5`, `cupping_variant_1`..`5`) — C-15 owns the fuller registry rework later. Corrected shape:

Edit `src/app/admin/emails/components/templates-data.ts`. Add a new entry to the `TEMPLATES` array (after the existing 9):

```ts
{
  id: "review_request_client",
  cardName: "Review request (2h post-completion)",
  // Sent automatically 2 hours after a booking is marked completed. Asks for
  // a Google review with 3 randomly-picked sample messages the client can
  // copy or use as inspiration.
  audience: "customer", // verify the actual enum value used; might be 'client'
  trigger: "booking_status_completed_plus_2h",
  rendersAs: "html",
  fields: [
    { kind: "subject", label: "Subject", maxLength: 100 },
    { kind: "body_intro", label: "Intro paragraph", maxLength: 500 },
    { kind: "body_ask", label: "Ask paragraph", maxLength: 500 },
    { kind: "body_cta_label", label: "CTA button label", maxLength: 80 },
    { kind: "body_cta_url", label: "CTA URL", maxLength: 500 },
    { kind: "body_signoff", label: "Signoff", maxLength: 200 },
    { kind: "massage_variant_1", label: "Massage variant 1", maxLength: 400 },
    { kind: "massage_variant_2", label: "Massage variant 2", maxLength: 400 },
    { kind: "massage_variant_3", label: "Massage variant 3", maxLength: 400 },
    { kind: "massage_variant_4", label: "Massage variant 4", maxLength: 400 },
    { kind: "massage_variant_5", label: "Massage variant 5", maxLength: 400 },
    { kind: "cupping_variant_1", label: "Cupping variant 1", maxLength: 400 },
    { kind: "cupping_variant_2", label: "Cupping variant 2", maxLength: 400 },
    { kind: "cupping_variant_3", label: "Cupping variant 3", maxLength: 400 },
    { kind: "cupping_variant_4", label: "Cupping variant 4", maxLength: 400 },
    { kind: "cupping_variant_5", label: "Cupping variant 5", maxLength: 400 },
  ],
}
```

All `maxLength` values above stay ≤500 chars to match `email_template_overrides.value`'s DB CHECK constraint (D13) — do not raise any of them without a Zone-2 migration relaxing that CHECK, which this plan does not include.

The exact shape of `TemplateMeta.fields` (and the `kind` enum, once extended per above) must match the existing pattern — verify by reading the `TemplateMeta`/`SafeFieldKind` definitions at `templates-data.ts:8-32` before editing.

**Step 13 — Add to AUDIT_PHRASING.**

Edit `src/app/admin/clients/[clientId]/page.tsx:127-138`. Add:

```ts
review_email_sent: "Review request email sent",
```

(C-04a may also be editing this map — coordinate if both plans hit C-C in the same window. The two entries are independent.)

**Phase C verify checkpoint:**
- `pnpm lint` + `tsc` green.
- New + existing tests pass.
- Visit `/admin/emails` Templates tab → new "Review request" template appears in the list.
- Click the new template → 16 editable fields render (might need UI grouping per brief §4.2 — verify it doesn't look like an unstructured wall of inputs at this stage).

### Phase D — Cron route + worker dispatch + wrangler trigger

**Step 14 — Implement the cron route.**

New file: `src/app/api/cron/review-emails/route.ts`. Per brief §2.4. Mirror the structure of `booking-reminders/route.ts` exactly:
- Same X-Cron-Secret header check
- Same NEXT_PUBLIC_SITE_URL validation
- Same Sentry capture pattern
- New: quiet-hours guard returning early if outside 08:00–21:00 Europe/London
- New: SELECT query with `status='completed' AND review_email_sent_at IS NULL AND completed_at <= now() - 2h AND completed_at >= now() - 7 days LIMIT 50`
- Loop over candidates calling `sendReviewRequestEmail`
- Audit log row per successful send with `action_type='review_email_sent'`, `automated=true`, `cron_trigger='review-emails-15min'`

**Step 15 — Extend `worker-entrypoint.ts`.**

> **Coordination (2026-07-26, rubric §10 shared-surface note / D3 — collision-map §4):** `worker-entrypoint.ts`'s `scheduled()` handler and `wrangler.jsonc`'s `crons` array are shared with C-02, C-04a. Today there is exactly ONE cron trigger and NO dispatch mechanism — do not assume one exists. The first of these three plans to land must add an `event.cron`-keyed switch/dispatch in `scheduled()`; every plan after it adds exactly one case + one crons-array entry, and must verify (by reading the live file, not the plan's own cached sketch) that the switch structure from the prior plan is respected, not replaced.

Edit `worker-entrypoint.ts`. Add `fireReviewEmails(env)` helper:

```ts
async function fireReviewEmails(env: CronEnv): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error("[scheduled/review-emails] CRON_SECRET not set; aborting.");
    return;
  }
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      "https://internal.invalid/api/cron/review-emails",
      {
        method: "POST",
        headers: {
          "X-Cron-Secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
      }
    );
    const bodyText = await res.text().catch(() => "<no body>");
    if (!res.ok) {
      console.error(`[scheduled/review-emails] non-ok status=${res.status} body=${bodyText}`);
      return;
    }
    console.log(`[scheduled/review-emails] ok status=${res.status} body=${bodyText}`);
  } catch (error) {
    console.error("[scheduled/review-emails] threw:", error);
  }
}
```

**If `scheduled()` is still the pre-C-01 unconditional call to `fireBookingReminders(env)`** (no dispatch switch exists yet), replace it with an `event.cron`-keyed dispatch:

```ts
async scheduled(event, env, ctx): Promise<void> {
  if (event.cron === "0 8 * * *") {
    ctx.waitUntil(fireBookingReminders(env));
  } else if (event.cron === "*/15 * * * *") {
    ctx.waitUntil(fireReviewEmails(env));
  } else {
    console.warn(`[scheduled] unknown cron expression: ${event.cron}`);
  }
}
```

**If a dispatch switch already exists** (C-02 or C-04a landed first), instead add exactly one `else if (event.cron === "*/15 * * * *") { ctx.waitUntil(fireReviewEmails(env)); }` branch into their existing switch, preserving every other branch untouched.

**Step 16 — Update `wrangler.jsonc`.**

Append `"*/15 * * * *"` to the existing `triggers.crons` array — re-read the live file first; if C-02 or C-04a already added their own cron string(s), append alongside them rather than assuming the array only holds the original `"0 8 * * *"` entry:

```jsonc
"triggers": {
  "crons": [
    "0 8 * * *",
    // ...any entries C-02/C-04a already added, preserved as-is...
    "*/15 * * * *"
  ]
}
```

**Step 17 — Smoke test locally (no Resend send).**

Local dev server can invoke the cron route directly:

```bash
curl -X POST http://localhost:3000/api/cron/review-emails \
  -H "X-Cron-Secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

Expected return: `{ summary: { candidates: 0, sent: 0, ... } }` (no eligible bookings since backfill marked all existing completions as handled). If 401, env var missing.

To exercise the send path locally without firing real emails to real customers: temporarily set `RESEND_API_KEY` to an invalid value → `sendTrackedEmail` errors → audit row + delivery-failure row written but no email sent. Or use Resend's test domain. Decided at impl time. **Recommended default (executability):** use Resend's test/sandbox domain if configured; otherwise temporarily invalidate `RESEND_API_KEY` for this one curl, then verify via `SELECT event_type, delivery_status FROM email_delivery_events WHERE event_type='review_request_client' ORDER BY sent_at DESC LIMIT 1;` that a failed-delivery row was written (not a real send) — restore the real key immediately after.

**Step 18 — Vitest spec for the cron route.**

New file `src/app/api/cron/__tests__/review-emails.test.ts`. Mock the Supabase client + `sendReviewRequestEmail`:
- No CRON_SECRET → 500
- Wrong CRON_SECRET → 401
- Right secret, quiet hours → 200 with `skipped_reason: "quiet_hours"`
- Right secret, daytime, 0 candidates → 200 with 0 sent
- Right secret, daytime, 3 candidates all sendable → 200 with 3 sent, 3 audit rows asserted
- Right secret, 1 candidate already_sent → counts in skipped_already_sent

**Phase D verify checkpoint:**
- `pnpm lint` + `tsc` green.
- All cron-route tests pass.
- Local curl smoke test returns 200 with empty summary.
- `pnpm build` clean.

### Phase E — End-to-end verification

**Step 19 — Local end-to-end happy-path walk.**

Pre-requisite: at least one test client with a `*.example.test` email + at least one test booking that can be completed without affecting real data.

1. Owner signs in via Playwright. Navigate to a test booking detail.
2. Mark complete via C-04a's `quickUpdateBooking` (or pre-existing Status form). Verify `bookings.completed_at` is set by the trigger.
3. **Backdate `completed_at` via Zone-2 SQL** (explicit confirmation):

   > ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
   > An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
   > Action: backdate `completed_at` on a single test booking to force it into the review-email cron's candidate window.
   > Exact SQL / change: `UPDATE bookings SET completed_at = now() - interval '3 hours' WHERE id = '<test-booking>';` — target must be a `*.example.test` booking per §6's DO-NOT-TRIGGER guidance.
   > Post-action verification: `SELECT id, completed_at FROM bookings WHERE id = '<test-booking>';` shows the backdated timestamp.
   > Never auto-apply. Approval is per-action and does not carry forward.

   ```sql
   UPDATE bookings SET completed_at = now() - interval '3 hours' WHERE id = '<test-booking>';
   ```
4. Curl the cron route. Verify:
   - Summary shows `candidates: 1, sent: 1`
   - Audit log row `review_email_sent` written
   - Email delivery row with `event_type='review_request_client'` written
   - Booking's `review_email_sent_at` populated
5. Curl again immediately. Verify:
   - Summary shows `candidates: 0` (sentinel filter excluded the booking)

**Step 20 — Admin UI verification.**

1. Sign in as Owner → `/admin/emails` Templates tab.
2. Click "Review request (2h post-completion)" → 16 editable fields render.
3. Edit `body_intro` to a test override (e.g., "TEST OVERRIDE Thank you..."). Save.
4. Inspect `email_template_overrides` table → row inserted.
5. Trigger the cron again on a fresh test booking. Verify the test override appears in the rendered email (via Resend dashboard or local preview).
6. Edit `massage_variant_3` to a custom string. Trigger again. Verify (with deterministic random or repeated runs) that the override is sometimes picked.

**Step 21 — Preview-route check.**

If `/admin/email-templates/preview/[id]` works for the new template:
- Navigate to `/admin/email-templates/preview/review_request_client`.
- Verify it renders with default fields + sample variants.
- Pre-flight Step 5 of brief §11 references the preview route's existing BUILD-rbac-permission gate (per C-A.1 audit). The plan does NOT add new RBAC for this template — uses the existing `MANAGE_EMAIL_TEMPLATES` permission.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: run the production deploy (`wrangler deploy`) that activates the new `*/15 * * * *` cron trigger alongside the existing `0 8 * * *` trigger.
> Exact SQL / change: no SQL — this is the Cloudflare Workers config/deploy step described below (external-console/production-deploy class change).
> Post-action verification: Cloudflare dashboard → Workers → cron-events shows both cadences firing; first `*/15` fire returns `summary.candidates: 0` (backfill suppressed historical rows); no new Sentry exceptions from the review-emails route.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 22 — Cloudflare cron deployment (Zone-2).**

Once code is merged + production deploy is run, Cloudflare's cron trigger picks up the new `*/15 * * * *` schedule from the deployed `wrangler.jsonc`. Verify post-deploy via Cloudflare dashboard:
- Cron events show two cadences firing
- 15-min-cadence cron logs appear (initially returning 0 sent due to backfill)

If Cloudflare's per-Worker cron limit is hit (most paid plans support multiple), document the constraint. The current usage is 1 → 2 crons; well within the standard 5 cron limit.

---

## 2 — Files touched (final list)

### NEW (5 files)
| File | Purpose |
|---|---|
| `src/app/api/cron/review-emails/route.ts` | Cron handler — auth + quiet-hours + candidate loop + send |
| `src/lib/email/__tests__/pickReviewMessages.test.ts` | Variant-picker unit tests |
| `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` | Send-fn unit tests (idempotency, no-email, mixed-category) |
| `src/app/api/cron/__tests__/review-emails.test.ts` | Cron-route handler tests |
| `supabase/migrations/<ts>_c01_review_email_infrastructure.sql` | Migration |

### EDITED (~7 files)
| File | Change summary |
|---|---|
| `src/lib/email/templates.ts` | + `DEFAULT_REVIEW_VARIANTS`, `pickReviewMessages`, `substituteCity`, `renderReviewRequestEmail`, `renderReviewRequestPlainText`, types |
| `src/lib/email/notifications.ts` | + `sendReviewRequestEmail`, `deriveGroupCategoryForBooking` |
| `src/app/admin/email-templates/actions.ts` | + `review_request_client` to SUBJECTS map |
| `src/app/admin/emails/components/templates-data.ts` | + new TemplateMeta entry with 16 fields |
| `src/app/admin/clients/[clientId]/page.tsx` | + `review_email_sent` entry in AUDIT_PHRASING |
| `worker-entrypoint.ts` | + `fireReviewEmails(env)` helper; dispatch by `event.cron` |
| `wrangler.jsonc` | append `*/15 * * * *` to triggers.crons |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Existing `src/app/api/cron/booking-reminders/route.ts` — only the worker-entrypoint dispatch layer touches the new cron path.
- `quickUpdateBooking`, `updateBookingManagement` — the trigger handles `completed_at` automatically; no server-action changes needed.

---

## 3 — Verification gate (commands + pass criteria)

### 3.1 Static gates

```bash
pnpm lint                       # no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype/*.jsx + 4 pre-existing in src/features/booking/ — C01-F2, 2026-07-26)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline failures preserved (6 pre-existing in 3 files)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget for C-01:** new cron route (server-only, no client bundle impact), template renderer additions (~3 kB additive to the `templates.ts` server module — not shipped to client). Admin templates UI gets 16 new field rows for the new template (~1 kB client). **Plan ceiling: +5 kB across `/admin/emails/*` bundle.**

### 3.2 Database verification

```sql
-- Pre-/post-cron diff on the test booking
SELECT id, status, completed_at, review_email_sent_at FROM bookings WHERE id = '<test-booking>';

-- Audit log capture
SELECT action_type, after_state FROM audit_logs
WHERE action_type = 'review_email_sent' AND target_id = '<test-booking>';

-- Email delivery row
SELECT event_type, recipient_email, sent_at FROM email_delivery_events
WHERE booking_id = '<test-booking>' AND event_type = 'review_request_client';

-- Sentinel idempotency: re-trigger and confirm no duplicate
SELECT COUNT(*) FROM email_delivery_events
WHERE booking_id = '<test-booking>' AND event_type = 'review_request_client';
-- Expected: 1 (not 2)
```

### 3.3 Resend dashboard verification

After local E2E, check the Resend dashboard for:
- Test email sent to the `*.example.test` recipient
- Subject = "Thank you for visiting Rahma Therapy"
- HTML body contains the intro + ask + 3 sample variants + CTA button + signoff
- No bounces / no errors

### 3.4 Cloudflare cron deployment verification (post-deploy)

Once production-deployed via `wrangler deploy`:
- Cloudflare dashboard → Workers → cron-events → confirm 2 cadences (08:00 daily + */15)
- First */15 fire after deploy shows `summary.candidates: 0` (backfill suppressed historical rows)
- Production logs show no Sentry exceptions from the new cron route

### 3.5 Playwright role sweep (4 roles × 4 viewports)

Recipe per role:

1. Sign in.
2. Navigate to `/admin/emails` Templates tab. Verify visibility of "Review request" template per RBAC matrix (Owner / Admin only — needs `manage_email_templates`).
3. (Owner/Admin) Click into the template. Verify 16 editable fields render in grouped layout per brief §4.2.
4. (Owner/Admin) Edit `body_intro` to a test value → Save → verify `email_template_overrides` row appears.
5. (Coord/Therapist) Verify template tab access per existing RBAC (Coord likely sees the templates tab read-only; Therapist blocked at the surface entry).
6. Sign out.

### 3.6 Screenshot evidence

- 375 + 1280: Templates tab with new entry
- 375 + 1280: Edit form for review_request_client showing 16 fields (grouped)
- 1280: Resend dashboard send-event preview
- 1280: Audit log entry on `/admin/audit` showing `review_email_sent`

Store in `redesign/evidence/C-01/` (rubric §8 — `redesign/audits/**` is read-only historical record, not a write target).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Migration adds the trigger and a concurrent UPDATE on bookings is happening | low | medium | `BEFORE UPDATE OF status` trigger is per-row + lightweight. Concurrent writers are serialised by PG's row-level locking. |
| Backfill marks a booking as "already handled" that the user actually wanted a review email for | low | low | Documented in §6. Only the 2 pre-existing completed bookings + the Owner test account are affected. Acceptable. |
| Cloudflare Workers cron limit | very low | low | Standard plan supports 5 crons. C-01 takes us from 1 → 2. Within budget. |
| Cron runs but `RESEND_API_KEY` is misconfigured | low | medium | `sendTrackedEmail` catches the failure and writes a delivery-failure row. Sentry captures. The cron summary shows `failed > 0`. Manual intervention via Resend dashboard. |
| Quiet-hours guard timezone bug (DST transitions) | low | low | `Intl.DateTimeFormat` with `timeZone: "Europe/London"` handles DST automatically. Verified pattern. |
| Owner email accidentally receives a review email | low | low | §6 backfill suppresses. Future bookings via Owner would suppress via a code-level filter — but acceptable to not block (Owner can mark sentinel manually). |
| `pickReviewMessages` returns < 3 variants somehow | very low | low | Pool has 5 elements; slice(0,3) returns 3. Edge case impossible. |
| `email_template_overrides` row count growth | very low | low | One row per non-default field. Worst case: 16 rows for one template. Trivial. |
| Mixed-category booking gets the wrong pool | low | low | `deriveGroupCategoryForBooking` returns null → falls back to massage. Documented in brief §5.3. Alternative chosen at decision time. |
| Cron fires before code is deployed (race between wrangler.jsonc commit and route deploy) | low | low | Cron triggers activate on next Cloudflare deploy. Commit the wrangler change in the SAME deploy as the route. |

### 4.1 Real risk: production data leak via the cron

Once C-01 is deployed, every completed booking past the 2h mark and within 7 days gets an email. **If any production data has slipped past the backfill** (e.g., a future-completed booking whose `contact_email` is a real customer), the email goes out before the operator notices.

Mitigations:
- §6 backfill is conservative — anything currently `status='completed'` is marked handled.
- Future completions are intentional — the customer expects a follow-up.
- Per Q9.6, Owner test account specifically suppressed.

If the user wants a "dry-run mode" before going live, a feature flag `REVIEW_EMAIL_DRY_RUN=true` env var could skip the actual `sendTrackedEmail` while writing audit + delivery-pending rows. Out of C-01 scope (not in brief); flag for impl-time discussion if user requests it.

---

## 5 — Undo procedure

### 5.1 Undo code (5 phases)

Revert in reverse order:
1. `git revert <phase-E-cleanup>` (if any)
2. `git revert <phase-D-cron+wrangler>` — removes cron route + worker dispatch + wrangler trigger. Cloudflare's next deploy stops the cron.
3. `git revert <phase-C-send-fn+templates-data>` — removes the new TemplateMeta entry. Template no longer appears in the UI.
4. `git revert <phase-B-renderer>` — removes the renderer + picker. Pure code revert.
5. `git revert <phase-A-migration>` — Zone-2 reverse migration:
   ```sql
   BEGIN;
   DROP TRIGGER IF EXISTS bookings_completed_at_trigger ON public.bookings;
   DROP FUNCTION IF EXISTS public.bookings_set_completed_at();
   ALTER TABLE public.bookings DROP COLUMN IF EXISTS completed_at;
   ALTER TABLE public.bookings DROP COLUMN IF EXISTS review_email_sent_at;
   COMMIT;
   ```

### 5.2 Caveats

- Dropping columns is **destructive** — any audit log rows referencing `review_email_sent_at` lose their context. Acceptable if rollback happens quickly (within hours of C-01 ship).
- `email_template_overrides` rows for `template_id='review_request_client'` are preserved — orphaned but harmless. Optional cleanup:
  ```sql
  DELETE FROM email_template_overrides WHERE template_id = 'review_request_client';
  ```
- `audit_logs` rows with `action_type='review_email_sent'` are preserved. Orphaned but harmless.
- `email_delivery_events` rows with `event_type='review_request_client'` are preserved. Orphaned. If a CHECK constraint was added in migration, dropping the column might fail — revert the CHECK first.

### 5.3 Cloudflare cron rollback

Once the production deploy reverts `wrangler.jsonc`, the next deploy removes the */15 cron from Cloudflare's trigger config. Cron stops firing immediately. No DB cleanup needed.

---

## 6 — Test fixture guidance

**Safe for C-01 E2E:**
- Test clients (`Audit Test Client *`, `Phase10 *`, etc.) with `*.example.test` emails.
- Test bookings whose `contact_email` ends in `.example.test`.

**DO NOT trigger reviews against:**
- Owner test account (`rahmatherapy@outlook.com`) — backfill suppresses.
- Badar's `9d55ce2a` (cancelled, won't qualify anyway).
- Any client whose email pattern doesn't match `*.example.test`.

**Pre-trigger check:**

```sql
-- Confirm the booking's email pattern before triggering manual cron run
SELECT id, contact_email, clients.email FROM bookings b LEFT JOIN clients ON b.client_id = clients.id
WHERE b.id = '<id>';
```

Both `contact_email` and `clients.email` should match a test pattern.

**Backdating for E2E:**

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: backdate `completed_at` on a `*.example.test` test booking (same class of write as Step 19.3 above; use this form when re-running E2E outside the Step 19 walkthrough).
> Exact SQL / change: the UPDATE below.
> Post-action verification: `SELECT id, completed_at FROM bookings WHERE id = '<test-booking>';` shows the backdated timestamp.
> Never auto-apply. Approval is per-action and does not carry forward.

```sql
-- Zone-2: explicit user confirmation
UPDATE bookings SET completed_at = now() - interval '3 hours'
WHERE id = '<test-booking>' AND contact_email LIKE '%.example.test';
```

Restore after E2E:

```sql
UPDATE bookings SET completed_at = now() WHERE id = '<test-booking>';
-- Or leave as backdated; doesn't affect operational data.
```

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — Migration applied + types regenerated. Verify queries. |
| 2 | Phase B — Renderer + variant picker + tests |
| 3 | Phase C — Send fn + SUBJECTS + templates-data + AUDIT_PHRASING + tests |
| 4 | Phase D — Cron route + worker-entrypoint dispatch + wrangler trigger + tests + smoke curl |
| 5 | Phase E — Verification + Playwright screenshots + progress file + master plan checklist → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-01 {phase}` prefix. Migration commit uses `chore(supabase): C-01 review email migration applied {migration_name}` for the audit trail.

---

## 8 — Hand-off to C-C

1. Read brief + this plan end-to-end.
2. Run §0 Pre-flight in full. **Confirm with user before applying the migration** (Zone-2).
3. Execute Phase A → B → C → D → E in order.
4. Migration is Zone-2 — show SQL to user; await approval; capture migration_name in progress file.
5. Wrangler config + cron trigger is server-side production behaviour — coordinate the deploy timing with the user (the cron starts firing on the NEXT production deploy after the wrangler.jsonc change lands on main).
6. Verification gate (§3) non-negotiable.
7. Update `redesign/per-page-progress/C-01-review-request-email-progress.md` per phase.
8. Final commit updates master plan checklist C-01 row from `⏳` to `✅` with shipped date + commit SHA.

---

## 9 — Open questions remaining

1. **`pickReviewMessages.random` parameter in tests** — vitest pattern. Use seeded random for determinism. Document in test file.
2. **Quiet-hours configurability** — currently code constants. If user wants admin-UI configurability, that's a small follow-up (out of C-01 scope).
3. **Variant rotation analytics** — would be useful to know which variants get picked most. Out of scope; Resend dashboard provides per-send detail.
4. **Resend test domain handling** — for staging environments, may need separate API key. Flag at C-C impl time.
5. **`audience` enum value for the new TemplateMeta** — verify against existing entries during impl. Likely `"customer"` or `"client"` per existing convention.
6. **CHECK constraint migration conditional** — pre-flight Step 5c determines if needed.
7. **Dry-run mode env var** — if user wants pre-launch safety, add `REVIEW_EMAIL_DRY_RUN=true` shortcircuit in the cron route before calling `sendReviewRequestEmail`. Speculative; impl-time decision.

---

*End of C-01 plan. Brief: `redesign/briefs/C-01-review-request-email-brief.md`. Progress: `redesign/per-page-progress/C-01-review-request-email-progress.md` (filled during C-C).*
