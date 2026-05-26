# C-03 — Enquiry → booking one-click conversion (narrow polish + bug bundle)

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §3 C-03 (narrow scope ~half-day fix + cross-page bug bundle from W01)
- `redesign/audits/C-A/W01-enquiry-to-booking-flow.md` (the source for 7 of the 8 sub-items below)
- `redesign/audits/C-A/03-bookings-new-audit.md` V-08 (service-not-prefilled — the headline)
- `redesign/audits/C-A/R01-owner-day.md` B-157 (no return-to-enquiries after Convert)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-03-enquiry-to-booking-conversion-plan.md`
- Progress: `redesign/per-page-progress/C-03-enquiry-to-booking-conversion-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-03 is **the smallest C-B plan after C-05** — narrow polish on an already-working flow. The decisions doc framed it as "~half-day fix" per master plan §3 C-03; brief confirms.

The convert path is structurally well-built (per W01): Convert button on enquiry rows works, URL routing works, prefill works, audit logging works, cache invalidation works. C-03 closes **8 specific edge cases** that surfaced during W01:

1. **Service fuzzy-match (HEADLINE)** — `service_interest` text from the enquiry doesn't pre-select the matching package option on the conversion form. The only outstanding C-03 gap per decisions doc.
2. **B-104** — toast copy says "client details" when the prefill failure is for an enquiry. One-line conditional fix.
3. **B-106** — no re-conversion guard. Stale URL → submitting again overwrites `enquiries.converted_booking_id` and orphans the previous booking's link.
4. **B-107** — partial-state hazard. Enquiry update happens AFTER booking creation outside any transaction. If the enquiry update fails mid-flight, booking exists + enquiry unmarked + user re-submits → duplicate booking.
5. **B-108** — booking → enquiry reverse-link. Once converted, no path back from `/admin/bookings/[id]` to the originating enquiry.
6. **W01-E-2** — sessionStorage draft carries across different enquiry conversions. Wrong client details on Y when starting from X-draft.
7. **W01-V-1** — Cancel button routes to `/admin/bookings/` (generic list), not back to the originating enquiry.
8. **B-157 (R01)** — after Convert succeeds, no "return to enquiries" affordance. Owner reviewing the new booking has to navigate via the global nav to get back to the queue.

**No new permissions, no schema changes** (B-108's reverse-lookup uses an existing query, not a new column). Each item is a small targeted fix. Ships as a single plan.

---

## 1 — Why this plan exists

### 1.1 The convert path is otherwise structurally solid

W01 §1 walked the full conversion + verified the strong scaffolding:
- Convert button rendering is correctly conditional (status ∈ {new, contacted} + `converted_booking_id IS NULL`).
- Hard navigation to `/admin/bookings/new?enquiryId=<id>` works.
- Form step-1 prefill (name / phone / source / customer_notes / participant_name) works.
- Server-side stale-id handling clears the hidden `enquiry_id` input (no bogus side-effect).
- `enquiry_converted_to_booking` audit_log row captures full state.
- Cache invalidation invalidates `report-data` + `dashboard-data` + `/admin/enquiries`.

The 8 edge cases above are the rough edges. C-03 sands them.

### 1.2 Why service fuzzy-match is the HEADLINE

The enquiry form's `service_interest` is free-text or a service-name dropdown. When the user lands on the conversion form, the package radio buttons are unset. They have to manually re-select the same service the enquiry already mentioned.

**Fuzzy-match logic** is straightforward:
- Trim + lowercase the enquiry's `service_interest`.
- For each service in the active list, compute a similarity score (substring match → exact match → token-based match).
- If the top score is above a threshold (e.g., 0.8), pre-select that service's radio button on step 2.
- If ambiguous (multiple services match at similar scores), leave unselected + show a small hint: *"Closest match: {top}. Confirm or pick another."*

### 1.3 Why B-106 (re-conversion guard) needs server-side defense

UI gate at `EnquiryList.tsx:485` hides the Convert button for already-converted rows. **But stale URLs bypass this** — bookmarked, browser-back navigation, hand-constructed links. The form fetches the enquiry by id without checking `converted_booking_id`. On submit, `enquiries.converted_booking_id` is OVERWRITTEN → previous booking's link to source enquiry is orphaned.

C-03 adds server-side defense in `bookings/new/page.tsx`: if `enquiry.converted_booking_id IS NOT NULL`, redirect to `/admin/bookings/<converted_booking_id>` with a toast explaining the redirect.

### 1.4 Why B-107 (partial-state hazard) is a real but narrow race

`createManualBooking` (`bookings/actions.ts:897-926`) creates the booking via `createBookingTransaction`, THEN updates the enquiry row outside any transaction. If the enquiry UPDATE fails (network blip, row-locked), the error re-throws. User sees a generic error and may re-submit → duplicate booking.

**Two options:**
- (a) Wrap the booking + enquiry-update in a Postgres function (transactional). Heavier — touches `createBookingTransaction` interface.
- (b) Catch the enquiry-update error inside the action; log via Sentry; redirect to the booking detail anyway. User sees success; enquiry stays unmarked; admin manually marks it later via the existing Status form.

**Locked decision (Open Q resolved):** **(b) graceful-catch**. Simpler. The data-integrity outcome is the same: in the worst case, an unmarked enquiry shows up in the queue with no `converted_booking_id` — admin sees the duplicate via the booking list + manually closes the enquiry. Acceptable.

### 1.5 Why B-108 (reverse-link) uses reverse-lookup, not a schema change

W01 §10 raised two options:
- (a) Add `bookings.enquiry_id` forward pointer column + index.
- (b) Reverse-lookup query: `SELECT id FROM enquiries WHERE converted_booking_id = $booking_id`.

**Locked decision (Open Q resolved):** **(b) reverse-lookup**. Reasoning:
- The relationship is conceptually reverse anyway (enquiry → booking; the booking didn't "know" about the enquiry at creation time in many cases).
- `enquiries.converted_booking_id` has implicit index potential (verify in pre-flight; add if missing).
- No schema migration needed — cheaper, ships with the plan as-is.
- Performance: one extra row-lookup per booking detail render. Trivial.

### 1.6 Why W01-E-2 (sessionStorage) is a real bug

User opens `/admin/bookings/new?enquiryId=X` → starts filling the form → abandons → later opens `/admin/bookings/new?enquiryId=Y` → form restores X's draft. The hidden `enquiry_id` switches to Y, but visible fields show X's data. User submits → booking attached to enquiry Y but with X's contact details. Mislabeled record.

**Fix:** scope the draft cache key by `enquiryId` (and `clientId` for the `?clientId=` path). When opening a different source, the draft for that specific source is restored; cross-source drafts don't bleed.

### 1.7 Why the Cancel + return-to-enquiries gaps matter

The Convert workflow is "open enquiry → fill form → save → see booking → return to enquiry queue". The middle step's Cancel button drops the user on a generic bookings list. The end step has no path back to enquiries (W01-V-1 + B-157).

**Fix:**
- Cancel button reads `enquiryId` from URL. If present, routes to `/admin/enquiries`.
- After successful conversion + redirect to `/admin/bookings/[bookingId]`, the booking detail page (per B-108 fix) shows "Converted from enquiry — ↗ Back to enquiries" link.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-03)

### 2.1 Service fuzzy-match (item 1 — HEADLINE)

**Location:** `bookings/new/page.tsx` (server-side enquiry fetch + service list resolution) + `ManualBookingForm.tsx` (initial state for `participants[].selectedServices`).

**Approach:**

Server-side in `bookings/new/page.tsx`:

```ts
// After fetching enquiry + services
const matchedServiceSlug = enquiry?.service_interest
  ? fuzzyMatchService(enquiry.service_interest, services)
  : null;
```

Helper in `src/lib/booking/service-fuzzy-match.ts` (new file):

```ts
export function fuzzyMatchService(
  interest: string,
  services: { slug: string; name: string; group_category: string | null }[]
): string | null {
  const normalised = interest.trim().toLowerCase();
  if (!normalised) return null;

  // Score each service: exact match (1.0) > substring (0.8-0.95) > token-overlap (0.5-0.79)
  const scored = services.map((svc) => ({
    slug: svc.slug,
    score: scoreMatch(normalised, svc.name.toLowerCase(), svc.group_category?.toLowerCase()),
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const runnerUp = scored[1];

  // Only return a match if top is high enough AND clearly ahead of runner-up
  if (top.score >= 0.8 && (top.score - runnerUp.score) >= 0.15) {
    return top.slug;
  }
  return null;
}

function scoreMatch(needle: string, haystackName: string, haystackCategory?: string): number {
  if (haystackName === needle) return 1.0;
  if (haystackName.includes(needle) || needle.includes(haystackName)) return 0.9;
  if (haystackCategory && (haystackCategory === needle || needle.includes(haystackCategory))) return 0.75;

  // Token overlap
  const needleTokens = new Set(needle.split(/\s+/).filter(Boolean));
  const haystackTokens = new Set(haystackName.split(/\s+/).filter(Boolean));
  const intersection = [...needleTokens].filter((t) => haystackTokens.has(t)).length;
  const union = needleTokens.size + haystackTokens.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}
```

Pass `matchedServiceSlug` to `ManualBookingForm` as a new prop. Form uses it to seed the initial state's first participant's selected services.

**Surface fallback:** if `matchedServiceSlug` is null (no good match), the form renders unset radios + an inline hint above step 2: *"Pick the service that matches the enquiry's interest: '{enquiry.service_interest}'."* (Visible only when prefilling from an enquiry AND no match found.)

### 2.2 B-104 toast copy fix (item 2)

`ManualBookingForm.tsx:786` currently:

```ts
toast.warning("Couldn't load client details. Fill in manually.", { ... });
```

Make conditional on prefill source:

```ts
const message = prefillSource === "enquiry"
  ? "Couldn't load enquiry details. Fill in manually."
  : "Couldn't load client details. Fill in manually.";
toast.warning(message, { ... });
```

`prefillSource` already exists in the component state (line 637 derives `prefillSource = prefillClient ? "client" : enquiry ? "enquiry" : null`). Re-use.

### 2.3 B-106 re-conversion guard (item 3)

`bookings/new/page.tsx` after the enquiry fetch (currently line 54-60), add:

```ts
const enquiry = enquiryResult.data ?? null;
if (enquiry?.converted_booking_id) {
  // Already converted — redirect with toast hint
  redirect(`/admin/bookings/${enquiry.converted_booking_id}?from_enquiry=already_converted`);
}
```

Then booking detail page reads `?from_enquiry=already_converted` and surfaces a toast: "This enquiry was already converted. Showing the existing booking."

### 2.4 B-107 graceful-catch (item 4)

`bookings/actions.ts:897-926` — the enquiry update block. Wrap in try/catch:

```ts
if (enquiryId) {
  try {
    // existing SELECT + UPDATE + audit_log INSERT
    // ...
    updateTag("report-data");
    updateTag("dashboard-data");
    revalidatePath("/admin/enquiries");
  } catch (enquiryUpdateError) {
    console.error(
      `Booking ${result.bookingId} created but enquiry ${enquiryId} update failed. Admin must mark manually.`,
      enquiryUpdateError
    );
    // Continue — booking is already created; redirect to booking detail anyway.
  }
}
```

The user sees success (redirect to `/admin/bookings/[bookingId]`). The orphaned enquiry stays in the queue with `status="new"` (admin manually marks it via the Status form). Sentry (if configured) captures the error for ops visibility.

### 2.5 B-108 booking → enquiry reverse-link (item 5)

`bookings/[bookingId]/page.tsx` — add to the server-side data fetch (or to a colocated helper):

```ts
const { data: sourceEnquiry } = await adminClient
  .from("enquiries")
  .select("id, full_name, created_at")
  .eq("converted_booking_id", booking.id)
  .maybeSingle();
```

Render in the booking detail's next-action area OR sidebar:

```
┌─ Origin ───────────────────────────────────────┐
│ Converted from enquiry: {sourceEnquiry.full_name}│
│ {formatDate(sourceEnquiry.created_at)}          │
│ ↗ View enquiry                                  │
└─────────────────────────────────────────────────┘
```

`↗ View enquiry` links to `/admin/enquiries?focus=<enquiryId>` — the enquiries list with the relevant row highlighted/scrolled-to (existing `focus` URL param pattern, OR add one if it doesn't exist).

**Index check (pre-flight):** verify `enquiries.converted_booking_id` has an index. If not, the reverse-lookup is a full table scan. Currently 3 enquiry rows in production — trivial. At scale, index needed:

```sql
CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking ON enquiries (converted_booking_id) WHERE converted_booking_id IS NOT NULL;
```

C-03 plan §6 documents — if index missing, add via the plan's migration.

### 2.6 W01-E-2 sessionStorage carryover (item 6)

`ManualBookingForm.tsx` — the existing draft-save logic (per #03 audit reference E-09) uses sessionStorage with a fixed key. Scope the key by source:

```ts
const draftKey = enquiryId
  ? `bookings-new-draft:enquiry:${enquiryId}`
  : prefillClient
  ? `bookings-new-draft:client:${prefillClient.id}`
  : "bookings-new-draft:scratch";
```

When the page loads with a NEW source (different enquiryId or clientId), the corresponding draft is loaded. Other-source drafts don't bleed. The `scratch` draft (no-prefill path) stays as-is.

Cleanup: when the page successfully submits (or admin clicks Cancel), the matching draft key is cleared. Existing draft-clear pattern in the form — extend to use the new keys.

### 2.7 W01-V-1 Cancel routing (item 7)

`ManualBookingForm.tsx` — the Cancel button currently has `href="/admin/bookings/"`. Update:

```tsx
const cancelHref = enquiryId
  ? `/admin/enquiries`
  : prefillClient
  ? `/admin/clients/${prefillClient.id}`
  : "/admin/bookings";

<Link href={cancelHref}>Cancel</Link>
```

If the user came from a specific enquiry, Cancel goes back to the enquiries list. If they came from a client, back to that client's detail. Otherwise the generic bookings list.

### 2.8 B-157 (R01) return-to-enquiries affordance (item 8)

After successful conversion, the existing flow redirects to `/admin/bookings/[bookingId]`. The booking detail page already gets the reverse-link from item 5 (B-108) — Owner can return to enquiries from there.

**Plus:** when `?from_enquiry=just_converted` (passed by the redirect from createManualBooking), show a one-time success toast: *"Booking created from enquiry. ↗ Back to enquiries."*

Actually — simpler: the redirect URL becomes `/admin/bookings/[bookingId]?just_converted=1`. The detail page reads `searchParams.just_converted` and shows the toast + the persistent "Origin" panel from B-108. Two affordances for the same return path: ephemeral toast (auto-dismiss) + persistent panel (always there).

---

## 3 — RBAC matrix

No changes. Existing `canManageAllBookings` gates `/admin/bookings/new`; existing enquiry RBAC gates Convert button visibility. C-03 doesn't introduce new permissions.

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Click Convert from enquiry list | ✅ | ✅ | ✅ | ❌ (route blocked) |
| Reach conversion form | ✅ | ✅ | ✅ | ❌ (AdminAccessDenied) |
| See service fuzzy-match pre-selection | ✅ | ✅ | ✅ | n/a |
| See "Origin" reverse-link on booking detail | ✅ | ✅ | ✅ | ✅ if has assignment access |
| Click "↗ View enquiry" | ✅ | ✅ | ✅ | ❌ (enquiries blocked) |

---

## 4 — Layout strategy

C-03 is mostly invisible polish. Small UI touches:

### 4.1 Inline hint for unmatched service interest

Above step 2's package selector (when prefilling from enquiry AND no fuzzy-match):

```
┌─ Service ──────────────────────────────────────────────┐
│ ℹ️  Enquiry mentioned: "stress relief massage 60 min". │
│    Pick the closest match:                             │
│                                                         │
│ ⚪ 1-Hour Massage Therapy · £80 · 60 min                │
│ ⚪ 30-Min Massage Therapy · £45 · 30 min                │
│ ⚪ Supreme Combo Package · £140 · 90 min                │
└─────────────────────────────────────────────────────────┘
```

When fuzzy-match HIT (e.g., enquiry mentioned "Supreme Combo"):

```
┌─ Service ──────────────────────────────────────────────┐
│ ✅ Matched from enquiry: Supreme Combo Package         │
│                                                         │
│ ⚪ 1-Hour Massage Therapy · £80 · 60 min                │
│ ⚪ 30-Min Massage Therapy · £45 · 30 min                │
│ 🔘 Supreme Combo Package · £140 · 90 min  ← selected   │
└─────────────────────────────────────────────────────────┘
```

Banner has dismiss button (close X) so admin can fully control the selection.

### 4.2 Booking detail Origin panel (B-108)

Compact card in the sidebar (above existing Summary card):

```
┌─ Origin ───────────────────┐
│ Converted from enquiry     │
│ Fatima Ahmed · 22 May      │
│ ↗ View enquiry             │
└────────────────────────────┘
```

Mobile (375): the sidebar appears below the main content (per C-FIELDWORK practitioner-view dual-mode); Origin card flows in the same sidebar block.

### 4.3 Just-converted toast on booking detail

Sonner toast at top-right:

```
[ ✓ Booking created from enquiry. ↗ Back to enquiries ]
```

Auto-dismisses after 5s. Click the link → `/admin/enquiries`. Toast fires once per page load (idempotent via search-param strip after first render).

### 4.4 Cancel link behaviour

No visual change — just the `href` updates per §2.7. Hover tooltip optional: *"Cancel and return to enquiries"* (when enquiry context active).

---

## 5 — States & edge cases

### 5.1 Service fuzzy-match — no good match

Falls back to unset radios + the inline hint (per §4.1). Admin manually picks. Banner shows the enquiry text for context.

### 5.2 Service fuzzy-match — multiple equally-good matches

The threshold logic (top ≥ 0.8 AND top - runnerUp ≥ 0.15) prevents auto-selection in ambiguous cases. Admin sees the unset state + "Closest match: X" hint. Acceptable.

### 5.3 Re-conversion via stale URL

Per §2.3 fix: page-level redirect to existing booking. User sees the toast explaining redirect. No silent double-conversion.

### 5.4 Re-conversion via direct API hit (bypass UI)

Hypothetical: user with admin RBAC POSTs to `createManualBooking` with `enquiryId` of an already-converted enquiry. The action's enquiry UPDATE will overwrite `converted_booking_id`. **Not addressed by C-03** — the UI-layer + page-layer guards are sufficient defense in practice. Server-side guard could be added in `actions.ts` but adds complexity. Documented as known limitation; C-12+ if needed.

### 5.5 Partial-state hazard with the graceful-catch path

Per §2.4: booking exists, enquiry unmarked. Admin sees:
- Booking on `/admin/bookings` ✅
- Original enquiry still on `/admin/enquiries` with status="new" + no Convert button hidden (because `converted_booking_id` is still null) — wait, that means the Convert button IS still rendered (per EnquiryList.tsx:485 condition). So admin could re-Convert + create another booking.

**Mitigation:** the §2.3 page-level guard checks `converted_booking_id` — but if the enquiry update failed, `converted_booking_id` is null in DB. So §2.3's guard doesn't fire. Re-Convert would succeed + create a duplicate.

**Worst-case scenario:**
1. Booking A created.
2. Enquiry update failed (caught by §2.4 graceful catch).
3. Admin re-Converts the same enquiry.
4. Booking B created from same enquiry, since `converted_booking_id` is still null.
5. Both bookings exist; only B's link captured.

This is the same outcome as if the user had pressed Convert twice in rapid succession with no intervening failure. **Acceptable degraded behaviour** — admin sees both bookings in the list, manually cancels one. Real-world frequency: very low (requires transient enquiry-update failure + admin re-trying without checking).

If observed in production, future iteration adds a server-side `WHERE converted_booking_id IS NULL` guard to `createManualBooking`'s enquiry UPDATE. C-12+.

### 5.6 SessionStorage draft when user clears browser data mid-session

Draft is lost. User restarts fresh. Acceptable.

### 5.7 SessionStorage draft for `?enquiryId=X` after the enquiry is converted

Per §2.3 redirect: the user is bounced to the existing booking. SessionStorage draft for that enquiry remains in storage but is never restored (the form never re-renders for that enquiry).

**Optional cleanup:** when the §2.3 redirect fires, also clear the corresponding sessionStorage key. Plan §1 documents.

### 5.8 Cancel button when both enquiryId AND clientId are in URL

Unusual but possible (e.g., admin creates a manual prefill URL). §2.7 logic: enquiryId takes precedence. Cancel goes to enquiries list.

### 5.9 Just-converted toast on a non-fresh booking detail load

The toast is gated by `?just_converted=1`. If admin navigates back to the same booking later (without the param), no toast. Idempotent.

The Origin panel (persistent) is always there regardless.

### 5.10 Service fuzzy-match for group bookings

Currently the conversion form fills participant 0's services. For group bookings, the admin selects per-participant services in step 2. C-03 only fuzzy-matches the FIRST participant. Multi-participant matching is over-engineering for the typical enquiry-conversion case (single-person enquiry).

---

## 6 — Migration footprint

**Likely none.** Verify in pre-flight:

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'enquiries' AND indexdef LIKE '%converted_booking_id%';
```

If 0 rows, add (single-line migration):

```sql
CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking
  ON enquiries (converted_booking_id) WHERE converted_booking_id IS NOT NULL;
```

Production has 3 enquiries today — even a full table scan is trivial. The index is forward-looking for scale.

**No new permissions, no new audit_log action_types** (existing `enquiry_converted_to_booking` covers the conversion path).

---

## 7 — Files touched (preview — full list in plan)

### NEW (2 files)
- `src/lib/booking/service-fuzzy-match.ts` — fuzzy-match helper + scoring function
- `src/lib/booking/__tests__/service-fuzzy-match.test.ts` — coverage matrix

### EDITED (~7 files)
| File | Change |
|---|---|
| `src/app/admin/bookings/new/page.tsx` | Add B-106 re-conversion guard; call `fuzzyMatchService`; pass `matchedServiceSlug` to ManualBookingForm |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | Use `matchedServiceSlug` for initial state; conditional toast copy (B-104); sessionStorage scoped key (W01-E-2); Cancel href routing (W01-V-1); fuzzy-match hint banner |
| `src/app/admin/bookings/actions.ts` | Wrap enquiry-update block in try/catch (B-107); redirect URL appends `?just_converted=1` when enquiryId path |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Fetch source enquiry via reverse lookup; render Origin panel (B-108); read `?just_converted=1` and `?from_enquiry=already_converted` search params + show toasts |
| (conditional) `supabase/migrations/<ts>_c03_enquiries_converted_booking_index.sql` | If pre-flight finds index missing |

### UNCHANGED
- RBAC matrix, middleware, reporting.ts, dashboard-helpers.ts, B-1 primitives.
- Enquiry list code (`EnquiryList.tsx`) — Convert button rendering is correct.
- `createBookingTransaction` interface — graceful-catch is INSIDE the calling action, not inside the transaction.

---

## 8 — Sequencing and dependencies

**No hard dependencies on prior C-NN plans.** C-03 ships independently.

**Cross-plan synergies:**
- **C-06 (clients edit)** — C-03's `?clientId=` Cancel routing routes back to `/admin/clients/[id]`. If C-06's edit page exists, the Cancel could also route to the edit page if the user came from there. C-03 doesn't track that level of referer; locked at clients-detail.
- **C-08 (email automation)** — no overlap. Conversion path doesn't add new email events; existing flow already fires booking confirmation.
- **C-FIELDWORK + C-11** — Origin panel renders inside the booking detail sidebar. Per C-FIELDWORK's mobile reorder, sidebar appears above main panels for assigned-practitioner view. Origin panel positions naturally.

**No coordination conflicts.**

---

## 9 — Open questions

**Q9.1 — Fuzzy-match threshold tuning**

Default thresholds (top ≥ 0.8, top - runnerUp ≥ 0.15) chosen heuristically. Production data has 5 services (3 cupping + 2 massage). Word overlap between names is high (all contain "massage" or "package"). May need tuning. Plan §1 includes a quick iteration step during impl to evaluate on the 3 existing test enquiries.

**Q9.2 — Reverse-link approach (forward column vs reverse lookup)**

Locked at **reverse lookup**. Schema decision documented in brief §1.5. Future revisit if reverse lookup becomes hot.

**Q9.3 — Index addition (Zone-2)**

Plan §0 pre-flight verifies. If missing, single-line migration. Otherwise no migration needed.

**Q9.4 — Cancel routing when both enquiryId AND clientId present**

Locked: enquiryId wins (§5.8). Rare combo.

**Q9.5 — B-107 graceful-catch vs RPC wrap**

Locked: graceful-catch (§1.4). Simpler, acceptable degradation.

**Q9.6 — Server-side re-conversion guard in `createManualBooking`**

Not added (§5.4 / §5.5). Acceptable known limitation. Future C-12+ if observed.

**Q9.7 — Just-converted toast persistence**

Locked: toast auto-dismisses after 5s. Origin panel stays permanently. Two affordances for return path.

**Q9.8 — Group bookings + fuzzy-match**

Only matches first participant (§5.10). Multi-participant matching not in C-03.

**Q9.9 — sessionStorage draft cleanup post-conversion**

Locked: clear the matching key on successful submit AND on Cancel click. Plus optional cleanup when §2.3 redirect fires for an already-converted enquiry.

**Q9.10 — B-105 duplicate toast — fix in C-03 or defer?**

Audit listed B-105 (duplicate toast fires on stale-id) as C-12+ in W01 §9. Decisions doc didn't explicitly include it in C-03 scope. **Locked: defer to C-12+** — small noise, not blocking.

---

## 10 — Acceptance criteria

A C-03 implementation is complete when:

1. **Service fuzzy-match works** — enquiry with `service_interest="Supreme Combo Package"` pre-selects the matching radio. Enquiry with vague text ("massage please") leaves unset + shows hint.
2. **B-104 fix** — stale `?enquiryId=` URL → toast reads "Couldn't load enquiry details. Fill in manually." (not "client details").
3. **B-106 fix** — visiting `/admin/bookings/new?enquiryId=<already-converted>` redirects to the existing booking with a toast.
4. **B-107 fix** — simulating enquiry-update failure (via mocked Supabase) → booking still created + redirect succeeds + Sentry log captured.
5. **B-108 fix** — converted booking's detail page shows Origin panel with "Converted from enquiry: <name>" + working link.
6. **W01-E-2 fix** — starting two conversions in sequence (enquiry X, then enquiry Y in a new tab/session) — Y's form does NOT show X's draft.
7. **W01-V-1 fix** — Cancel button on the conversion form routes to `/admin/enquiries` when enquiryId is present.
8. **B-157 fix** — successful conversion → toast on the new booking detail with "Back to enquiries" link.
9. **Index added** if missing — `enquiries.converted_booking_id`.
10. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
11. **Playwright role × scenario sweep** — Owner + Admin + Coord can complete a conversion end-to-end with fuzzy-match + Origin panel verified.
12. **No regressions** — existing manual booking flow (no enquiry) unchanged. Existing `?clientId=` prefill flow unchanged.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §3 C-03 | 8-item scope |
| `W01-enquiry-to-booking-flow.md` §1-§9 | Full flow walk + 6 of the 8 sub-items |
| `R01-owner-day.md` B-157 | Return-to-enquiries gap |
| `03-bookings-new-audit.md` V-08 | Service-not-prefilled root finding |
| `bookings/new/page.tsx:54-60` | Enquiry fetch site (B-106 fix lives here) |
| `bookings/new/ManualBookingForm.tsx:786` | B-104 toast string |
| `bookings/actions.ts:897-926` | Enquiry update block (B-107 wrap) |
| `bookings/[bookingId]/page.tsx` | Origin panel mount site (B-108) |
| `EnquiryList.tsx:485, 522` | Convert button rendering (already correct) |

---

## 12 — Out of scope (explicit non-goals)

- **B-105 duplicate toast on prefill failure** — Q9.10, C-12+.
- **B-109 Reopen-as-new no-op** — orthogonal to conversion path; C-12+ or fold into a separate enquiry-lifecycle plan.
- **W01-V-2 customer_notes brittle joining** — C-12+ trivial.
- **W01-E-3 status vocabulary split** (booked vs Converted) — data-model cleanup, C-12+.
- **Multi-participant fuzzy-match** — §5.10, C-12+.
- **Server-side double-Convert guard in `createManualBooking`** — §5.4-§5.5, C-12+.
- **Forward `bookings.enquiry_id` column** — Q9.2 locked at reverse-lookup.
- **Enquiry-list focus-on-load behaviour** — if `?focus=<id>` URL doesn't currently exist on the enquiries list, the "↗ View enquiry" link just goes to the generic list with the row reachable via scroll/search. Adding the focus param is C-12+ polish.
- **Per-participant `customer_notes` interpolation polish** — out of scope.

---

*End of C-03 brief. Plan file follows: `redesign/plans/C-phase/C-03-enquiry-to-booking-conversion-plan.md`.*
