# C-22 — Public booking form abuse protection — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-22 is independent (brief §4). Coordination only: C-23 Phase B works on the same availability route files as Step 4a — before editing `/api/availability*`, check whether C-23 has landed (`git log --oneline --grep="C-23"`) and re-grep anchors.
> Decisions: C-B-DECISIONS.md contains no C-22 entries; checkpoint decisions D23 + D24 (2026-07-26, Owner-approved) applied. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-22-booking-form-abuse-protection-brief.md` (companion — read first; carries the user-locked scope: public booking form only, honeypot + per-IP rate limiting only)
**Progress (filled in C-C):** `redesign/per-page-progress/C-22-booking-form-abuse-protection-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (public tree + one API route). **Amended 2026-07-26 (C22-F5):** work on `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD` (hard assertion, not conversational context). Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/features/booking src/app/api wrangler.jsonc src/lib` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. Dev server → 200; baseline tests + static gates green. **Baseline caveats (verified 2026-07-20, C22-F4):** vitest = 485/491 with 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1 — the last sits in the exact suite this plan extends); `pnpm lint` = 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/). "Green" = no NEW failures/errors vs these baselines; tsc + build clean.
3. **Re-verify the endpoint shape** (2026-07-16 line numbers): `src/app/api/bookings/route.ts:42` `POST`, zod parse → `createSupabaseAdminClient()` (`:66`, `:96`) → RPC → `sendBookingCreatedEmails`. Confirm nothing already guards it (`grep -in "rate\|limit\|captcha\|honeypot" src/app/api/bookings/route.ts` → expect empty).
4. **Rate-limit mechanism decision (blocking — decide with the user, §1 Step 3 matrix):** Cloudflare rate-limiting binding (preferred) vs dashboard WAF rule vs Durable Object counter. Check current Cloudflare account/plan support before committing to one. **Concrete check (added 2026-07-26):** before the Phase B session, verify rate-limiting-binding availability on this account/plan — inspect the Cloudflare dashboard (Workers & Pages plan) and the current wrangler docs for the rate-limiting binding; record the yes/no answer in the progress file so Step 3's matrix resolves without mid-implementation discovery.
5. **Form field-name check:** confirm the chosen honeypot name collides with nothing in the zod schema or the form state (`src/app/api/bookings/route.ts:14-40`, `DetailsConsentStep`/`LocationDetailsStep`). **Amended 2026-07-26 (C22-F1):** `DetailsConsentStep`/`LocationDetailsStep` were DELETED by the `ea97932` merge. Check instead against the current form surfaces: `src/features/booking/schemas/booking-schema.ts` (client schemas), `src/features/booking/types.ts` (`BookingDetails`), and `src/app/api/bookings/route.ts:14-40` (server zod). Verify: `grep -rin "company_website" src/` → expect empty (confirmed empty 2026-07-26).
6. **DO-NOT-TOUCH:** admin booking path, enquiries, every other endpoint; RECON §5 untouchables. **Amended 2026-07-26 (D23, Owner-approved):** `POST /api/availability` and `POST /api/availability/month` are now IN scope for rate limiting only (Step 4a) — every other endpoint remains untouchable. C-23's authenticated admin month route is NOT rate-limited by this plan.
7. **DO-NOT-TOUCH (live data):** booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

---

## 1 — Implementation (2 phases, 5 steps)

### Phase A — Honeypot

**Step 1 — Field in the public form.** Add the decoy input to the customer booking form (final step component, alongside the real fields). Reference shape:

> **Re-anchored 2026-07-26 (C22-F1, D24):** the pre-merge step components are gone; the final step is now `src/features/booking/components/ConfirmStep.tsx` (receives `form: UseFormReturn<BookingDetailsFormValues>`, L13-14). Wire the honeypot end-to-end: add the field to `BookingDetails` + `emptyBookingDetails` in `src/features/booking/types.ts` (RHF defaults — `useForm` at `BookingExperience.tsx:86-87` uses `emptyBookingDetails`); render the decoy input in `ConfirmStep.tsx` via the `form` prop (adapt the snippet's `value`/`onChange` to `{...form.register("company_website")}` — no local `useState`); and add it to `src/features/booking/schemas/booking-schema.ts` as a plain `z.string()` pass-through so client validation never flags it. The SERVER schema in `route.ts` must NOT gain the key (Step 2).

```tsx
{/* Honeypot — invisible to humans and assistive tech. Bots that fill every
    input trip it. Do NOT use display:none (some bots skip those). */}
<div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
  <label htmlFor="company_website">Leave this field empty</label>
  <input
    type="text"
    id="company_website"
    name="company_website"
    tabIndex={-1}
    autoComplete="off"
    value={honeypot}
    onChange={(e) => setHoneypot(e.target.value)}
  />
</div>
```

Include the value in the POST payload. **Payload hoist (2026-07-26, C22-F2 — mandatory or the protection is silently inert):** the client serializes exactly `{selectedPackageIds, details, preferredDate, preferredTime}` (`src/features/booking/actions.ts:40-51`) with all RHF values nested under `details` — a top-level `body?.company_website` check would never fire. Hoist explicitly: add `company_website` to `BookingRequestPayload` in `src/features/booking/types.ts`, pass it from `handleConfirmSubmit` (`BookingExperience.tsx:440-507`, submit call at :483), and add it as a TOP-LEVEL key in the `JSON.stringify` body in `submitBookingRequest` (`src/features/booking/actions.ts`). Verify: devtools network tab shows `company_website` at the top level of the POSTed JSON. **Accessibility is a hard requirement** — `aria-hidden` + `tabIndex={-1}` together mean a screen-reader user never encounters it (brief §2.1).

**Step 2 — Server-side silent drop.** In `POST /api/bookings`, **before** zod validation of the real payload:

```ts
// C-22: honeypot. A filled decoy means a bot. Return a success-shaped response so
// the operator learns nothing, but do no work: no booking, no emails.
// Identifier + narrowing corrected 2026-07-26 (final sweep): the route's parsed-JSON
// variable is `payload` (declared `let payload: unknown;` at route.ts:43, assigned :46) —
// there is no `body` identifier in this file, and `unknown` needs an explicit narrow or tsc fails.
const rawPayload = payload as Record<string, unknown> | null;
if (typeof rawPayload?.company_website === "string" && rawPayload.company_website.trim() !== "") {
  console.warn("[C-22] honeypot tripped", { at: new Date().toISOString() });
  return Response.json({ ok: true }, { status: 200 }); // placeholder — use the verified shape below (C22-F3), incl. a fabricated bookingId
}
```

Match the real success payload shape exactly (inspect it at impl) — a differently-shaped 200 is itself a tell. Keep the honeypot key out of the zod schema so a filled value can never reach the RPC.

> **Verified shape (2026-07-26, C22-F3):** the real success body is `{ status: "submitted", message, bookingId, manageUrl }` (`src/app/api/bookings/route.ts:89-94`), and the client THROWS unless `bookingId` is a string (`src/features/booking/actions.ts:58-61` — "Booking request was submitted without a booking reference."). The fake 200 MUST fabricate a plausible `bookingId` (e.g. `crypto.randomUUID()`; `manageUrl: null` is fine) or the drop errors client-side — itself a tell. Verify: a honeypot-tripped submission reaches the SuccessScreen in the browser with no console error.

### Phase B — Per-IP rate limiting

**Step 3 — Choose the mechanism** (pre-flight #4). Decision matrix:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloudflare rate-limiting binding** | Edge-enforced before the Worker does real work; free; no state to manage or expire | Requires a `wrangler.jsonc` binding + account support | **Preferred** |
| Cloudflare dashboard WAF rate-limit rule | Zero code; free tier includes a rule; instantly tunable | Config lives outside the repo (invisible to future readers — document it in the progress file) | Good fallback |
| Durable Object counter | Precise; in-repo | New DO class + wrangler migration; more moving parts for a nuisance-level problem | Only if the above are unavailable |
| Supabase-table counter | No new infra | **Rejected** — puts a DB write in the path of the traffic being blocked |  ✗ |

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: applies ONLY if Step 3 selected the Cloudflare dashboard WAF rate-limit rule — an external console change. If the wrangler-binding (or DO) option was selected, no Zone-2 action exists here; skip this stop.
> Exact SQL / change: create the dashboard rate-limiting rule scoped to `POST /api/bookings` (+ `POST /api/availability` and `POST /api/availability/month` per Step 4a) with the Step 4 thresholds; record the exact rule (path, thresholds, action) in the progress file.
> Post-action verification: from one IP, exceed the burst threshold → 429; a single normal request → normal response.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 4 — Apply the limit** at the very top of `POST` (before body parsing):

```ts
const RATE_LIMIT_BURST = { limit: 3, windowSeconds: 600 };    // 3 per 10 min
const RATE_LIMIT_SUSTAINED = { limit: 10, windowSeconds: 86_400 }; // 10 per day

const ip = request.headers.get("CF-Connecting-IP"); // trusted; never X-Forwarded-For
if (ip) {
  const allowed = await checkRateLimit(ip, RATE_LIMIT_BURST, RATE_LIMIT_SUSTAINED);
  if (!allowed) {
    return Response.json(
      { ok: false, error: `Too many booking attempts. Please try again in a few minutes, or call us on ${CLINIC_PHONE}.` },
      { status: 429 }
    );
  }
}
// ip == null (local dev / unexpected proxy) → fail open, per brief §3.3
```

Constants live together at the top of the route (or a small `src/lib/rate-limit.ts`) so tuning is one edit. The phone number comes from the existing site-contact module — a rate-limited real customer must always have a way through. **Anchor (2026-07-26):** `src/content/site/contact.ts` — `contactLinks.phone.value` (`"07798897222"`); a plain const module, importable server-side.

**Step 4a — Extend the limiter to the two public availability endpoints (added 2026-07-26, D23 — Owner-approved scope extension).** The `ea97932` merge added two more public, unauthenticated POST endpoints on the service-role client with zero rate limiting, called repeatedly by the live booking dialog: `src/app/api/availability/route.ts` (POST at :13, `createSupabaseAdminClient` at :36) and `src/app/api/availability/month/route.ts` (POST at :23, admin client at :47). Apply the same per-IP mechanism to both, with HIGHER thresholds than the booking POST — they are read-only and the dialog legitimately calls them per-month-switch and per-day-pick, so start well above observed legitimate use and tune from the shared constants. Same `CF-Connecting-IP` keying; fail open when the header is absent. No honeypot on these routes (read-only — nothing to fake-submit).

- **Coordination (C-23):** C-23 Phase B modifies these same route files (availability engine options bag) — re-grep for the current anchors before editing; expect C-23's edits in this region if it has landed. C-23's admin month route is authenticated and is NOT rate-limited by this plan.
- **Verification:** normal browsing of the booking calendar (month switches + day picks) never trips the limit; a scripted burst past the threshold → 429; use `.example.test` fixtures only.

**Step 5 — Tests.**
- Honeypot filled → no booking row, no email send call, 200-shaped response (mock the RPC + mailer, assert neither called).
- Honeypot empty → normal path proceeds.
- Rate limit exceeded → 429, and **neither** the Supabase client nor the mailer is invoked (proves rejection happens before real work).
- Missing `CF-Connecting-IP` → request proceeds (fail-open).
- Existing booking-route tests still pass unchanged. **Baseline caveat (2026-07-26, C22-F4):** run `npx vitest run src/app/api/bookings` — expect the 1 pre-existing failure in `src/app/api/bookings/createBookingTransaction.test.ts` PRESERVED (it predates this plan; full-suite baseline is 485/491 with 6 pre-existing failures in 3 files). "Unchanged" = no NEW failures.

---

## 2 — Files touched

**NEW (0–2):** `src/lib/rate-limit.ts` (if not using a pure dashboard rule); route test additions.
**EDITED (2–3):** the public booking form's final step component (honeypot field + payload), `src/app/api/bookings/route.ts` (both guards), `wrangler.jsonc` (only if the binding option is chosen).
**EDITED — corrected list (2026-07-26, C22-F1/C22-F2/D24/D23; supersedes the line above):** `src/features/booking/components/ConfirmStep.tsx` (decoy render), `src/features/booking/types.ts` (`BookingDetails` + `emptyBookingDetails` + `BookingRequestPayload`), `src/features/booking/schemas/booking-schema.ts` (pass-through field), `src/features/booking/BookingExperience.tsx` (submit call passes the field), `src/features/booking/actions.ts` (top-level payload hoist), `src/app/api/bookings/route.ts` (both guards), `src/app/api/availability/route.ts` + `src/app/api/availability/month/route.ts` (Step 4a rate limit), `wrangler.jsonc` (only if the binding option is chosen). The pre-merge "final step component" no longer exists.
**UNCHANGED:** admin booking path, enquiries, every other route, DB schema.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (new specs + untouched baseline), build. **Baselines (2026-07-26, C22-F4):** vitest = no NEW failures vs 485/491 (6 pre-existing in 3 files, incl. createBookingTransaction ×1); lint = no NEW errors vs the 59-error baseline; tsc + build clean.
2. **Happy path first (the regression that matters):** complete a real public booking end-to-end → booking row created, both emails sent. If this breaks, nothing else matters. **Observation mechanism (2026-07-26):** verify "both emails sent" via `email_delivery_events` rows for the `.example.test` fixture booking (customer + admin legs) — not real inboxes.
3. **Honeypot:** submit with the decoy filled (via devtools) → no row, no email, success-shaped 200, warning logged.
4. **Honeypot invisibility:** at 375 + 1280 the field is not visible; keyboard-tab through the whole form never lands on it; a screen-reader pass (VoiceOver/NVDA or the accessibility tree) never announces it; browser autofill with a saved profile does not populate it.
5. **Rate limit:** exceed the burst limit → 429 with the phone-inclusive message; verify **no** DB row and **no** email event for the rejected attempts; wait out the window → next attempt succeeds.
   - **5a — availability endpoints (added 2026-07-26, D23):** normal calendar browsing in the booking dialog (month switches + day picks) never rate-limited; a scripted burst against `POST /api/availability/month` past its (higher) threshold → 429; same for `POST /api/availability`; fail-open without `CF-Connecting-IP`.
6. **Fail-open:** local dev (no `CF-Connecting-IP`) works normally.
7. **Admin untouched:** create a booking via the admin form → unaffected, no honeypot, no limit.
8. Screenshots (375 + 1280 showing no visible artifact; the 429 message) in `redesign/evidence/C-22/` (evidence convention 2026-07-26 — never write into `redesign/audits/**`).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **A real customer gets rate-limited and gives up** | low | high | Deliberately generous limits (3/10min, 10/day); 429 copy always offers the phone number; constants tunable in one place; monitor for reports post-ship. |
| Honeypot traps a screen-reader user (classic bug) | low | high | `aria-hidden` + `tabIndex={-1}` + off-screen positioning, verified by an explicit AT check (gate item 4) — not assumed. |
| Browser autofill fills the honeypot → silent lost booking | low | high | `autoComplete="off"` + a field name no autofill heuristic recognises; tested with a saved autofill profile (gate item 4). |
| Silent drop hides a real failure from the owner | medium | low | Every trip is logged; if genuine bookings ever go missing, the log is the first place to look. |
| Shared/NAT IP blocks a household | low | medium | Sustained limit 10/day; phone fallback; tunable. |
| Dashboard-WAF option leaves config invisible to future readers | medium | low | If chosen, document the exact rule (path, thresholds) in the progress file so it isn't a mystery later. |
| Fail-open means a determined attacker spoofing away the header bypasses the limit | low | low | Accepted: `CF-Connecting-IP` is set by Cloudflare and not client-controllable in production; fail-open only affects non-Cloudflare paths (dev). |

---

## 5 — Undo

Single git revert (+ removing the wrangler binding or dashboard rule if added). No migration, no data, no user-visible change on the happy path.

---

## 6 — Test fixture guidance

Use the standard `.example.test` booking fixtures; clean up rows created during rate-limit testing. Never trip these paths against a real customer's booking. Badar's `9d55ce2a` untouched.

---

## 7 — Commit cadence

| Commit | Coverage |
|---|---|
| 1 | Phase A — honeypot field + server drop + tests |
| 2 | Phase B — rate limiting (+ binding/config) + tests |
| 3 | Verification — evidence + progress file + master plan row → ✅ |

`feat(redesign): C-22 {phase}` prefixes.

Commit 2 also carries the Step 4a availability-route extension (D23, 2026-07-26).

---

## 8 — Hand-off to C-C

1. Read brief + plan; run pre-flight — **#4 (mechanism decision) is blocking**.
2. Phase A → verify → Phase B → verify. Gate item 2 (happy path) runs first and last.
3. No migrations; no Zone-2 actions. **Caveat (2026-07-26):** if Step 3 selects the dashboard-WAF fallback, that external console change IS Zone-2 — the HARD-STOP before Step 4 applies.
4. If the dashboard-WAF option is used, record the rule details in the progress file.
5. Final commit flips the master-plan C-22 row → ✅.
6. **Escalation path if abuse continues after ship:** Cloudflare Turnstile — documented as the next step, explicitly out of this plan's scope.

---

*End of C-22 plan.*
