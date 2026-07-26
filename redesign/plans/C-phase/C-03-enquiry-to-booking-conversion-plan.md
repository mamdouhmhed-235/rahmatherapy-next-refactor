# C-03 — Enquiry → booking one-click conversion — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-03 ships independently (per §0 Step 7).
> Decisions: C-B-DECISIONS.md §3 C-03. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-03-enquiry-to-booking-conversion-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-03-enquiry-to-booking-conversion-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/lib/booking/service-fuzzy-match.ts src/app/admin/bookings/new/page.tsx src/app/admin/bookings/new/ManualBookingForm.tsx src/app/admin/bookings/actions.ts "src/app/admin/bookings/[bookingId]/"` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp` logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests + static gates.** `pnpm vitest run` 485/491 (6 pre-existing failures in 3 files — ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1 — baseline, not regressions); `tsc` green; `pnpm lint` shows no NEW errors vs the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`).
4. **DB pre-flight:**

   ```sql
   -- (a) Index on enquiries.converted_booking_id?
   SELECT indexname, indexdef FROM pg_indexes
   WHERE tablename = 'enquiries' AND indexdef LIKE '%converted_booking_id%';
   -- If 0 rows → conditional migration in Phase A. If 1+ row → no migration.

   -- (b) Current enquiry state inventory for fuzzy-match testing
   SELECT id, full_name, service_interest, status, converted_booking_id
   FROM enquiries ORDER BY created_at DESC LIMIT 20;
   -- Capture for §3.2 fuzzy-match verification.

   -- (c) services list — fuzzy-match target set
   SELECT slug, name, group_category FROM services WHERE is_active = true ORDER BY name;
   ```

5. **Test fixture availability:**
   - At least 1 enquiry with `status='new'` + `converted_booking_id IS NULL` for happy-path conversion.
   - At least 1 enquiry with `converted_booking_id IS NOT NULL` for B-106 redirect test.
   - If neither exists, create via the existing flow or SQL (Zone-2 — explicit confirmation).

   > ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
   > An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
   > Action: create missing test-fixture enquiry row(s) via direct SQL (only if the existing UI flow cannot produce the needed fixture state)
   > Exact SQL / change: INSERT into `enquiries` with test-safe values (`*.example.test` email / `Phase10*`/`Audit Test*` name pattern per the DO-NOT-TOUCH convention below) — no production data
   > Post-action verification: re-run the pre-flight Step 4b enquiry inventory query — expect the new fixture row(s) present
   > Never auto-apply. Approval is per-action and does not carry forward.

6. **Code-surface inventory** (verify line numbers haven't drifted since plan-writing):

   ```bash
   git grep -n "Couldn't load client details" src/app/admin/bookings/new/
   # Expected: ManualBookingForm.tsx:786 — B-104 fix site

   git grep -n "if (enquiryId)" src/app/admin/bookings/actions.ts
   # Expected: actions.ts:897 — B-107 wrap site

   git grep -n "converted_booking_id" src/app/admin
   # Expected: EnquiryList.tsx + page.tsx hits — confirm no booking-detail reverse-link exists yet
   ```

7. **C-NN dependency check:** none. C-03 ships independently. If C-06 / C-FIELDWORK / C-11 are merged ahead, C-03's Cancel routing + Origin panel naturally compose with their UI. No blockers.

8. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, real customer data.

   > DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

---

## 1 — Safe implementation order (4 phases — narrow plan)

### Phase A — Migration + service-fuzzy-match helper

**Step 1 — (Conditional) index migration.**

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply conditional index migration `idx_enquiries_converted_booking` on `enquiries.converted_booking_id` (only if pre-flight Step 4a found 0 rows)
> Exact SQL / change: see migration body below — `CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking ON enquiries (converted_booking_id) WHERE converted_booking_id IS NOT NULL;`
> Post-action verification: re-run the pre-flight Step 4a query — expect 1 row for `idx_enquiries_converted_booking`
> Never auto-apply. Approval is per-action and does not carry forward.

If pre-flight Step 4a returns 0 rows:

```sql
-- supabase/migrations/<ts>_c03_enquiries_converted_booking_index.sql
BEGIN;
CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking
  ON enquiries (converted_booking_id) WHERE converted_booking_id IS NOT NULL;
COMMIT;
```

Apply via `mcp__supabase__apply_migration`. **Zone-2 — explicit user confirmation.** Capture migration_name.

If pre-flight Step 4a returns 1+ rows, skip this step.

**Step 2 — `service-fuzzy-match.ts` helper.**

New file `src/lib/booking/service-fuzzy-match.ts`. Implementation per brief §2.1:

```ts
export interface ServiceForMatching {
  slug: string;
  name: string;
  group_category: string | null;
}

export function fuzzyMatchService(
  interest: string,
  services: ServiceForMatching[]
): string | null {
  const normalised = interest.trim().toLowerCase();
  if (!normalised || services.length === 0) return null;

  const scored = services.map((svc) => ({
    slug: svc.slug,
    score: scoreMatch(normalised, svc.name.toLowerCase(), svc.group_category?.toLowerCase()),
  }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runnerUp = scored[1];
  const margin = runnerUp ? top.score - runnerUp.score : 1.0;

  if (top.score >= 0.8 && margin >= 0.15) {
    return top.slug;
  }
  return null;
}

function scoreMatch(needle: string, haystackName: string, haystackCategory?: string): number {
  if (haystackName === needle) return 1.0;
  if (haystackName.includes(needle) || needle.includes(haystackName)) return 0.9;
  if (haystackCategory && (haystackCategory === needle || needle.includes(haystackCategory))) return 0.75;

  const needleTokens = new Set(needle.split(/\s+/).filter(Boolean));
  const haystackTokens = new Set(haystackName.split(/\s+/).filter(Boolean));
  if (needleTokens.size === 0 || haystackTokens.size === 0) return 0;
  const intersection = [...needleTokens].filter((t) => haystackTokens.has(t)).length;
  const union = needleTokens.size + haystackTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
```

**Step 3 — Vitest spec for fuzzy-match.**

New file `src/lib/booking/__tests__/service-fuzzy-match.test.ts`:

Test matrix (use production services list from pre-flight Step 4c):
- `"Supreme Combo Package"` → returns `"supreme-combo"` slug (exact match).
- `"Supreme Combo"` → returns `"supreme-combo"` (substring match).
- `"supreme"` → returns `"supreme-combo"` (token match, runner-up scoring).
- `"hijama"` → returns one of the hijama services (`hijama-package` or `fire-package`) — accept either or assert specific based on token-overlap math.
- `"massage"` → ambiguous (2 massage services) → returns null.
- `"1 hour massage"` → returns `"massage-60"` slug.
- `""` → returns null.
- `"chocolate cake"` (no match) → returns null.
- Empty services list → returns null.

**Phase A verify checkpoint:**
- Migration applied (if needed) + types regenerated.
- Helper + tests pass.
- No other code changes yet.

### Phase B — Server + page integration

**Step 4 — Re-conversion guard (B-106) in `bookings/new/page.tsx`.**

> **Finding C-03-F1 correction (2026-07-26):** the enquiry Supabase select at `page.tsx:57` currently reads `"id, full_name, email, phone, source, service_interest, notes"` — `converted_booking_id` is NOT in that list, so the guard below would read `undefined`. Extend the select list to `"id, full_name, email, phone, source, service_interest, notes, converted_booking_id"` first.

Edit `src/app/admin/bookings/new/page.tsx`. After the Promise.all that loads enquiry (line 38-70):

```ts
const enquiry = enquiryResult.data ?? null;

// C-03 B-106: re-conversion guard — if enquiry already converted, redirect
if (enquiry?.converted_booking_id) {
  redirect(`/admin/bookings/${enquiry.converted_booking_id}?from_enquiry=already_converted`);
}
```

**Step 5 — Fuzzy-match call in `bookings/new/page.tsx`.**

In the same file, after the enquiry fetch + service fetch:

```ts
import { fuzzyMatchService } from "@/lib/booking/service-fuzzy-match";

// ...

const matchedServiceSlug = enquiry?.service_interest
  ? fuzzyMatchService(enquiry.service_interest, services)
  : null;
```

Pass `matchedServiceSlug` as a prop to `ManualBookingForm`.

**Step 6 — Source-aware redirect after successful conversion.**

Edit `src/app/admin/bookings/actions.ts`. In `createManualBooking`, the final redirect (line ~952):

```ts
// Before:
redirect(`/admin/bookings/${result.bookingId}`);

// After:
const redirectPath = enquiryId
  ? `/admin/bookings/${result.bookingId}?just_converted=1&enquiry_id=${enquiryId}`
  : `/admin/bookings/${result.bookingId}`;
redirect(redirectPath);
```

The `enquiry_id` query param is for forensic + UI display only; the source-of-truth linkage is `enquiries.converted_booking_id`.

**Step 7 — B-107 graceful-catch wrap.**

In the same file, wrap the enquiry-update block (line 897-926):

```ts
// C-03 B-107: graceful catch — if enquiry update fails, booking still succeeds.
if (enquiryId) {
  try {
    const { data: beforeEnquiry } = await adminClient
      .from("enquiries")
      .select("*")
      .eq("id", enquiryId)
      .single();

    const { data: updatedEnquiry } = await adminClient
      .from("enquiries")
      .update({
        status: "booked",
        converted_booking_id: result.bookingId,
      })
      .eq("id", enquiryId)
      .select()
      .single();

    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "enquiry_converted_to_booking",
      target_type: "enquiries",
      target_id: enquiryId,
      before_state: beforeEnquiry,
      after_state: updatedEnquiry,
    });

    updateTag("report-data");
    updateTag("dashboard-data");
    revalidatePath("/admin/enquiries");
  } catch (enquiryUpdateError) {
    console.error(
      `[createManualBooking] Booking ${result.bookingId} created but enquiry ${enquiryId} update failed. Admin must mark manually.`,
      enquiryUpdateError
    );
    // Optional: Sentry capture
    // Sentry.captureException(enquiryUpdateError, {
    //   tags: { booking_id: result.bookingId, enquiry_id: enquiryId },
    // });
    // Continue — booking is already created; redirect proceeds.
  }
}
```

**Phase B verify checkpoint:**
- `pnpm lint` + `tsc` green.
- Manual Playwright: visit a stale `?enquiryId=<already-converted>` URL → redirected to existing booking.
- Convert a fresh enquiry → form pre-selects matched service.
- Mock enquiry-update failure (temporarily) → booking succeeds + console error logged + redirect lands.

### Phase C — Form-level fixes

**Step 8 — B-104 toast copy fix.**

Edit `src/app/admin/bookings/new/ManualBookingForm.tsx:786`. Change:

```ts
// Before:
toast.warning("Couldn't load client details. Fill in manually.", { ... });

// After:
const messageBody = prefillSource === "enquiry"
  ? "Couldn't load enquiry details. Fill in manually."
  : "Couldn't load client details. Fill in manually.";
toast.warning(messageBody, { ... });
```

`prefillSource` is already in scope (derived at line 637).

**Step 9 — Service fuzzy-match wiring + hint UI.**

In `ManualBookingForm.tsx`. Add `matchedServiceSlug?: string | null` to props.

Initial state for first participant's selected services:

```ts
const [participants, setParticipants] = useState<Participant[]>([
  emptyParticipant(
    prefillClient?.full_name ?? enquiry?.full_name ?? "",
    matchedServiceSlug ? [matchedServiceSlug] : []  // pre-select if matched
  ),
]);
```

(Adjust `emptyParticipant` signature if it doesn't already accept a service-slugs array — likely needs extension.)

**Hint UI in step 2** — render conditionally:

```tsx
{enquiry?.service_interest ? (
  matchedServiceSlug ? (
    <div role="status" className="...success-tone-banner...">
      <CheckCircle className="size-4" aria-hidden="true" />
      <span>Matched from enquiry: <strong>{matchedServiceName}</strong></span>
      <button type="button" onClick={dismissHint}>×</button>
    </div>
  ) : (
    <div role="status" className="...info-tone-banner...">
      <Info className="size-4" aria-hidden="true" />
      <span>
        Enquiry mentioned: <strong>"{enquiry.service_interest}"</strong>.
        Pick the closest match below.
      </span>
    </div>
  )
) : null}
```

`matchedServiceName` derived from services list: `services.find(s => s.slug === matchedServiceSlug)?.name`.

**Step 10 — W01-E-2 sessionStorage scoped key.**

In `ManualBookingForm.tsx`, the existing draft-save logic (locate via grep `sessionStorage` or similar). Update the cache key:

```ts
const draftKey = enquiry?.id
  ? `bookings-new-draft:enquiry:${enquiry.id}`
  : prefillClient?.id
  ? `bookings-new-draft:client:${prefillClient.id}`
  : "bookings-new-draft:scratch";
```

All `sessionStorage.setItem` / `sessionStorage.getItem` calls use this scoped key. Existing cleanup on submit + Cancel uses the same key (idempotent).

**Step 11 — W01-V-1 Cancel routing.**

> **Finding C-03-F2 correction (2026-07-26):** `ManualBookingForm.tsx` has TWO independently hardcoded `href="/admin/bookings"` Cancel targets, not one — the desktop-nav Cancel `Link` (no-data path, currently `:1907`) AND the Leave-confirmation dialog's own "Leave" `Link` (shown when `formHasData` is true, currently `:1956`). Both must be updated, or Cancel-with-unsaved-data still routes to `/admin/bookings` regardless of enquiry/client prefill.

Re-grep before editing (line numbers drift once other Band-C plans land — see coordination note below):

```bash
git grep -n 'href="/admin/bookings"' src/app/admin/bookings/new/ManualBookingForm.tsx
```

Compute the shared destination once, then apply it at both sites:

```tsx
const cancelHref = enquiry?.id
  ? `/admin/enquiries`
  : prefillClient?.id
  ? `/admin/clients/${prefillClient.id}`
  : "/admin/bookings";

// Site 1 — desktop-nav Cancel Link (no-data path, currently navStrip ~:1907)
<Link href={cancelHref}>Cancel</Link>

// Site 2 — Leave-confirmation dialog's "Leave" Link (currently leaveDialog ~:1956)
<Link href={cancelHref}>Leave</Link>
```

**Optional polish:** add a `title` attribute matching the destination ("Cancel and return to enquiries" / "...to client profile" / "...to bookings").

> **Coordination (rubric §10):** `ManualBookingForm.tsx` is edited by C-02, C-03, C-06, C-20, and C-23 in this programme. Re-run this plan's own anchor greps before editing — a predecessor plan may have already shifted the `:1907`/`:1956` line numbers. If the target region overlaps a just-landed edit from another Band-C plan, stop and diff manually rather than applying a line-numbered patch.

**Verify:** `git grep -n 'href={cancelHref}' src/app/admin/bookings/new/ManualBookingForm.tsx` returns 2 matches (nav strip + leave dialog).

**Phase C verify checkpoint:**
- Lint + tsc + vitest green.
- Manual Playwright at 1280 + 375:
  - Stale enquiry URL → toast copy mentions "enquiry".
  - Fresh enquiry with `service_interest='Supreme Combo Package'` → matching radio pre-selected + success banner visible.
  - Fresh enquiry with vague service_interest → unmatched + info banner visible.
  - Two-tab test: open enquiry X → draft typed → open enquiry Y in new tab → Y form is clean (no X bleed).
  - Cancel from enquiry-prefilled form → lands at /admin/enquiries.

### Phase D — Booking detail Origin panel + just-converted toast

**Step 12 — Reverse-lookup query in `bookings/[bookingId]/page.tsx`.**

Add to the existing data fetch (or to a new `booking-detail-data.ts` helper if C-09 extracted one):

```ts
const { data: sourceEnquiry } = await adminClient
  .from("enquiries")
  .select("id, full_name, created_at, service_interest")
  .eq("converted_booking_id", booking.id)
  .maybeSingle();
```

Pass `sourceEnquiry` through the page render.

**Step 13 — Origin panel render.**

In `bookings/[bookingId]/page.tsx` — locate the sidebar section (`BookingDetailSidebar` rendering, around line 503 per the C-FIELDWORK pre-read). Add the Origin card BEFORE the existing SummaryCard:

```tsx
{sourceEnquiry ? (
  <AdminPanel>
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
        Origin
      </p>
      <p className="text-sm font-medium text-[var(--admin-body)]">
        Converted from enquiry
      </p>
      <p className="text-sm text-[var(--admin-heading)]">
        {sourceEnquiry.full_name} · {formatDate(sourceEnquiry.created_at.slice(0, 10))}
      </p>
      <Link
        href="/admin/enquiries"
        className="inline-flex h-9 sm:h-8 items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
        View enquiry
      </Link>
    </div>
  </AdminPanel>
) : null}
```

Best ergonomic location: this is a new card inside `BookingDetailSidebar.tsx`. Either:
- (a) Extend `BookingDetailSidebar` props to accept `sourceEnquiry?: { id, full_name, created_at }` and render the card.
- (b) Render the Origin card as a sibling above `<BookingDetailSidebar>` in `page.tsx`.

**Locked decision (Open Q resolved):** (a) — keeps the sidebar self-contained. Extend `BookingDetailSidebar` props.

**Step 14 — Just-converted toast on booking detail page.**

`bookings/[bookingId]/page.tsx` — read `searchParams.just_converted` + `searchParams.from_enquiry`:

```ts
const justConverted = params.just_converted === "1";
const fromEnquiry = params.from_enquiry === "already_converted";
```

Render a client component (e.g., `BookingDetailToasts.tsx` or extend the existing `BookingCreatedToast.tsx`) that fires the appropriate toast on mount:

```tsx
{justConverted ? (
  <BookingDetailToast
    type="just_converted"
    message="Booking created from enquiry."
    actionLabel="Back to enquiries"
    actionHref="/admin/enquiries"
  />
) : null}

{fromEnquiry ? (
  <BookingDetailToast
    type="from_enquiry_redirect"
    message="This enquiry was already converted. Showing the existing booking."
  />
) : null}
```

The toast strips the query params after firing (to prevent re-fire on refresh).

**Phase D verify checkpoint:**
- Convert a test enquiry → land on booking detail with `?just_converted=1` → toast fires + Origin panel visible.
- Visit a stale converted-enquiry URL → bounced to existing booking with `?from_enquiry=already_converted` → toast fires explaining redirect.
- Existing bookings (no source enquiry) → no Origin panel; no surprise toasts.

---

## 2 — Files touched (final list)

### NEW (3 files)
- `src/lib/booking/service-fuzzy-match.ts` — fuzzy-match helper
- `src/lib/booking/__tests__/service-fuzzy-match.test.ts` — coverage
- (conditional) `supabase/migrations/<ts>_c03_enquiries_converted_booking_index.sql`
- (conditional) `src/app/admin/bookings/[bookingId]/BookingDetailToasts.tsx` — if extending existing toast component isn't clean

### EDITED (~5 files)
| File | Change |
|---|---|
| `src/app/admin/bookings/new/page.tsx` | B-106 redirect guard + `fuzzyMatchService` call + pass matchedServiceSlug to form |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | B-104 conditional toast (line 786); matchedServiceSlug initial state; fuzzy-match hint banner UI; sessionStorage scoped key; Cancel href routing |
| `src/app/admin/bookings/actions.ts` | B-107 graceful-catch wrap (line 897-926); source-aware redirect URL (line 952) |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Reverse-lookup query; pass sourceEnquiry to sidebar; read just_converted + from_enquiry params; render toasts |
| `src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx` | + sourceEnquiry prop + Origin card render |
| (existing) `src/app/admin/bookings/[bookingId]/BookingCreatedToast.tsx` | Extend or wrap with new toast types |

### UNCHANGED
- `EnquiryList.tsx` — Convert button rendering already correct.
- RBAC matrix, middleware, reporting.ts.
- `createBookingTransaction` interface — graceful-catch lives in `createManualBooking`, not in the RPC.
- C-06 / C-04a / C-05 / C-01 / C-08 / C-FIELDWORK / C-11 / C-02 / C-09 code — orthogonal.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # no NEW errors vs 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; 6 pre-existing baseline failures preserved (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget:** new fuzzy-match helper (~1 kB server module — no client impact). New banner JSX in ManualBookingForm (~0.5 kB client). Origin card (~0.5 kB client). **Plan ceiling: +2 kB across `/admin/bookings/new` and `/admin/bookings/[id]` bundles.**

### 3.2 Fuzzy-match verification matrix

Run vitest suite with the production services list:

```bash
pnpm vitest run service-fuzzy-match
```

Plus a manual E2E:
1. Create test enquiry with `service_interest='Supreme Combo Package'` → Convert → form should pre-select `supreme-combo` radio.
2. Create test enquiry with `service_interest='hijama'` → Convert → form should pre-select one of the hijama services (verify via Playwright + check radio state).
3. Create test enquiry with `service_interest='massage'` → ambiguous → form should NOT pre-select; hint banner visible: "Pick the closest match below."
4. Empty `service_interest` → no banner, no pre-select.

### 3.3 Playwright role × scenario sweep

Per role × scenario × viewport (1280 minimum, plus 375 spot-checks):

**Owner / Admin / Coord:**
1. Convert a fresh test enquiry → land on booking detail with toast + Origin panel.
2. Click "Back to enquiries" link → /admin/enquiries loads.
3. Click "↗ View enquiry" in Origin card → /admin/enquiries loads.
4. Visit stale `?enquiryId=<already-converted>` → bounced to existing booking with redirect toast.
5. Visit stale `?enquiryId=00000000-0000-0000-0000-000000000000` → empty form + toast "Couldn't load enquiry details. Fill in manually."
6. Start a conversion (don't submit) → open a different enquiry's conversion in new tab → second form is clean.
7. Click Cancel from enquiry-prefilled form → /admin/enquiries.
8. Click Cancel from client-prefilled form (`?clientId=`) → /admin/clients/[id].
9. Click Cancel from no-prefill form → /admin/bookings.

**Therapist:**
- Cannot reach /admin/enquiries (middleware blocked).
- Cannot reach /admin/bookings/new (AdminAccessDenied).
- N/A for C-03 paths.

### 3.4 Pre/post DB queries

```sql
-- Pre-conversion baseline
SELECT id, status, converted_booking_id FROM enquiries WHERE id = '<test-enquiry-id>';

-- Post-conversion
SELECT id, status, converted_booking_id FROM enquiries WHERE id = '<test-enquiry-id>';
-- Expected: status='booked', converted_booking_id IS NOT NULL

-- Booking row check
SELECT id, contact_full_name FROM bookings WHERE id = '<resulting-booking-id>';

-- Audit log
SELECT action_type, before_state->>'status' AS before_status, after_state->>'converted_booking_id' AS after_converted
FROM audit_logs
WHERE target_id = '<test-enquiry-id>' AND action_type = 'enquiry_converted_to_booking';
-- Expected: 1 row with full state capture

-- B-107 graceful-catch verification — manually break the enquiry-update
-- via a temporary code-level mutation (e.g., wrong table name) + verify
-- booking still created + console error logged. Restore the code after test.
```

### 3.5 Screenshot evidence

- 1280 × converted-from-enquiry booking detail with Origin panel visible
- 1280 × just-converted toast on the booking detail
- 1280 × fuzzy-match success banner on the conversion form
- 1280 × fuzzy-match unmatched (info) banner
- 1280 × re-conversion redirect toast
- 375 × conversion form mobile view with matched banner
- 1280 × Cancel-from-enquiry → enquiries list landing

Store in `redesign/evidence/C-03/` (rubric §8 evidence convention — supersedes the prior `redesign/audits/**` target; that path is read-only historical record).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Fuzzy-match thresholds wrong for production services | medium | low | Verify on the 5 existing services during impl. Tunable code constants. |
| B-106 redirect with `from_enquiry=already_converted` confuses admin if they clicked Convert AGAIN expecting to re-link | low | low | Toast copy explains: "This enquiry was already converted. Showing the existing booking." Clear. |
| B-107 graceful-catch loses enquiry-update silently | low | medium | Console.error + (optional) Sentry capture. Admin sees the unmarked enquiry in the queue + manually closes. Acceptable degradation. |
| Origin panel reverse-lookup adds latency to booking detail | very low | low | Single indexed lookup. ~1ms. Trivial. |
| sessionStorage key migration loses existing drafts | low | low | One-time loss on first deployment. Acceptable — drafts are short-lived. |
| Cancel routing breaks an existing non-enquiry-non-client flow | low | low | Default case (`/admin/bookings`) preserves existing behaviour. |
| Just-converted toast fires on stale page-refresh | low | low | Toast component strips query params after fire. Idempotent. |
| Fuzzy-match auto-selects wrong service in a clinical edge case | low | medium | Threshold + margin guard prevents ambiguous auto-select. Admin can override via radio (form is not read-only). Inline hint banner has dismiss × so admin can disregard suggestion. |
| Two admins convert the same enquiry simultaneously | low | medium | Race window: enquiry update row-lock prevents both succeeding. Second action's update affects 0 rows (since `converted_booking_id` already set by first). Second booking is created but enquiry link captures first. **Discovered limitation** — not blocking. C-12+ adds `WHERE converted_booking_id IS NULL` guard on the UPDATE. Document. |
| Origin card mobile reorder conflicts with C-FIELDWORK sidebar reorder | low | low | C-FIELDWORK puts sidebar above main panels for assigned-practitioner view. Origin card flows naturally inside the sidebar in either order. Verify in Playwright. |

### 4.1 Real risk: fuzzy-match false positives at scale

If user adds many similar service names later (e.g., "Massage 1 Hour", "1 Hour Massage", "Therapeutic Massage 1 Hour"), the token-overlap scoring may pick wrongly. Plan §9 Open Q9.1 flags. Iteration during impl on the 5 current services.

### 4.2 Real risk: source-aware redirect URL grows long

The `?just_converted=1&enquiry_id=<uuid>` query string is ~50 chars. No issue.

---

## 5 — Undo procedure

### 5.1 Per-phase revert

Phases are independent commits. Revert in reverse order:
1. `git revert <phase-D-origin-panel>` — booking detail loses Origin panel + toasts.
2. `git revert <phase-C-form-fixes>` — toast copy, fuzzy-match wiring, sessionStorage scoping, Cancel routing all revert.
3. `git revert <phase-B-server>` — re-conversion guard removed; B-107 wrap removed; redirect reverts to no params.
4. `git revert <phase-A-helper>` — fuzzy-match helper file deleted.

### 5.2 Migration rollback (if applied)

```sql
DROP INDEX IF EXISTS idx_enquiries_converted_booking;
```

Trivial.

### 5.3 Test fixture cleanup

Any test enquiries created during E2E:

```sql
-- Identify
SELECT id, full_name, status, converted_booking_id FROM enquiries
WHERE created_at > '<C-03 E2E start>'
ORDER BY created_at DESC;

-- Cleanup (revert to original test state)
UPDATE enquiries SET status = 'new', converted_booking_id = NULL
WHERE id IN ('<test-enquiry-ids>');
```

---

## 6 — Test fixture guidance

**Safe for C-03 E2E:**
- Existing test enquiries (Audit Enquiry One/Two, Phase10 E2E Enquiry).
- Create new test enquiries via the existing flow (any test client + arbitrary `service_interest` text).

**DO NOT touch:**
- Badar's bookings/cancellations.
- Real customer enquiries.

**Pre-trigger check** before each E2E mutation:

```sql
SELECT id, full_name, service_interest, status, converted_booking_id FROM enquiries WHERE id = '<id>';
```

Cross-reference against the safe-fixture list.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — Migration (if needed) + fuzzy-match helper + tests |
| 2 | Phase B Steps 4-5 — Re-conversion guard + fuzzy-match wiring in page.tsx |
| 3 | Phase B Steps 6-7 — Source-aware redirect + B-107 graceful-catch in actions.ts |
| 4 | Phase C Steps 8-11 — Form-level fixes (toast copy + match wiring + hint banner + sessionStorage + Cancel routing) |
| 5 | Phase D Steps 12-14 — Booking detail Origin panel + just-converted toast |
| 6 | Verification — Playwright screenshots + progress + master plan checklist → ✅ |

Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Stage files explicitly.

`feat(redesign): C-03 {phase}` prefix during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end.
2. Run §0 Pre-flight in full. Capture index inventory + enquiry baseline.
3. Migration is conditional — only applied if pre-flight Step 4a shows missing index.
4. Execute Phase A → B → C → D in order.
5. Verification gate (§3) non-negotiable — especially the fuzzy-match matrix.
6. Update progress file per commit.
7. Final commit updates master plan checklist C-03 → ✅.

---

## 9 — Open questions remaining

1. **Fuzzy-match threshold tuning** — Q9.1 in brief. Iterate during impl on the 5 services.
2. **Origin panel — sidebar or main content** — locked at sidebar (extend BookingDetailSidebar). Reviewer may override during impl.
3. **B-105 duplicate toast** — explicitly deferred to C-12+ per brief Q9.10.
4. **Server-side double-Convert guard** — §4 risk, C-12+.
5. **Sentry capture for B-107 graceful-catch** — locked as optional in Step 7. Recommended if Sentry configured; otherwise plain console.error suffices.
6. **sessionStorage key migration impact** — minor. One-time loss on deployment.
7. **`?focus=<id>` URL param on enquiries list** — out of C-03 scope per brief §12; "↗ View enquiry" link goes to plain `/admin/enquiries`.
8. **Origin panel on mobile** — flows naturally inside the sidebar; verify in Playwright.

---

*End of C-03 plan. Brief: `redesign/briefs/C-03-enquiry-to-booking-conversion-brief.md`. Progress: `redesign/per-page-progress/C-03-enquiry-to-booking-conversion-progress.md` (filled during C-C).*
