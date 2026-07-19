# C-22 — Public booking form abuse protection — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-22-booking-form-abuse-protection-brief.md` (companion — read first; carries the user-locked scope: public booking form only, honeypot + per-IP rate limiting only)
**Progress (filled in C-C):** `redesign/per-page-progress/C-22-booking-form-abuse-protection-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (public tree + one API route).
2. Dev server → 200; baseline tests + static gates green.
3. **Re-verify the endpoint shape** (2026-07-16 line numbers): `src/app/api/bookings/route.ts:42` `POST`, zod parse → `createSupabaseAdminClient()` (`:66`, `:96`) → RPC → `sendBookingCreatedEmails`. Confirm nothing already guards it (`grep -in "rate\|limit\|captcha\|honeypot" src/app/api/bookings/route.ts` → expect empty).
4. **Rate-limit mechanism decision (blocking — decide with the user, §1 Step 3 matrix):** Cloudflare rate-limiting binding (preferred) vs dashboard WAF rule vs Durable Object counter. Check current Cloudflare account/plan support before committing to one.
5. **Form field-name check:** confirm the chosen honeypot name collides with nothing in the zod schema or the form state (`src/app/api/bookings/route.ts:14-40`, `DetailsConsentStep`/`LocationDetailsStep`).
6. **DO-NOT-TOUCH:** admin booking path, enquiries, every other endpoint; RECON §5 untouchables.

---

## 1 — Implementation (2 phases, 5 steps)

### Phase A — Honeypot

**Step 1 — Field in the public form.** Add the decoy input to the customer booking form (final step component, alongside the real fields). Reference shape:

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

Include the value in the POST payload. **Accessibility is a hard requirement** — `aria-hidden` + `tabIndex={-1}` together mean a screen-reader user never encounters it (brief §2.1).

**Step 2 — Server-side silent drop.** In `POST /api/bookings`, **before** zod validation of the real payload:

```ts
// C-22: honeypot. A filled decoy means a bot. Return a success-shaped response so
// the operator learns nothing, but do no work: no booking, no emails.
if (typeof body?.company_website === "string" && body.company_website.trim() !== "") {
  console.warn("[C-22] honeypot tripped", { at: new Date().toISOString() });
  return Response.json({ ok: true }, { status: 200 }); // shape must match the real success response
}
```

Match the real success payload shape exactly (inspect it at impl) — a differently-shaped 200 is itself a tell. Keep the honeypot key out of the zod schema so a filled value can never reach the RPC.

### Phase B — Per-IP rate limiting

**Step 3 — Choose the mechanism** (pre-flight #4). Decision matrix:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloudflare rate-limiting binding** | Edge-enforced before the Worker does real work; free; no state to manage or expire | Requires a `wrangler.jsonc` binding + account support | **Preferred** |
| Cloudflare dashboard WAF rate-limit rule | Zero code; free tier includes a rule; instantly tunable | Config lives outside the repo (invisible to future readers — document it in the progress file) | Good fallback |
| Durable Object counter | Precise; in-repo | New DO class + wrangler migration; more moving parts for a nuisance-level problem | Only if the above are unavailable |
| Supabase-table counter | No new infra | **Rejected** — puts a DB write in the path of the traffic being blocked |  ✗ |

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

Constants live together at the top of the route (or a small `src/lib/rate-limit.ts`) so tuning is one edit. The phone number comes from the existing site-contact module — a rate-limited real customer must always have a way through.

**Step 5 — Tests.**
- Honeypot filled → no booking row, no email send call, 200-shaped response (mock the RPC + mailer, assert neither called).
- Honeypot empty → normal path proceeds.
- Rate limit exceeded → 429, and **neither** the Supabase client nor the mailer is invoked (proves rejection happens before real work).
- Missing `CF-Connecting-IP` → request proceeds (fail-open).
- Existing booking-route tests still pass unchanged.

---

## 2 — Files touched

**NEW (0–2):** `src/lib/rate-limit.ts` (if not using a pure dashboard rule); route test additions.
**EDITED (2–3):** the public booking form's final step component (honeypot field + payload), `src/app/api/bookings/route.ts` (both guards), `wrangler.jsonc` (only if the binding option is chosen).
**UNCHANGED:** admin booking path, enquiries, every other route, DB schema.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (new specs + untouched baseline), build.
2. **Happy path first (the regression that matters):** complete a real public booking end-to-end → booking row created, both emails sent. If this breaks, nothing else matters.
3. **Honeypot:** submit with the decoy filled (via devtools) → no row, no email, success-shaped 200, warning logged.
4. **Honeypot invisibility:** at 375 + 1280 the field is not visible; keyboard-tab through the whole form never lands on it; a screen-reader pass (VoiceOver/NVDA or the accessibility tree) never announces it; browser autofill with a saved profile does not populate it.
5. **Rate limit:** exceed the burst limit → 429 with the phone-inclusive message; verify **no** DB row and **no** email event for the rejected attempts; wait out the window → next attempt succeeds.
6. **Fail-open:** local dev (no `CF-Connecting-IP`) works normally.
7. **Admin untouched:** create a booking via the admin form → unaffected, no honeypot, no limit.
8. Screenshots (375 + 1280 showing no visible artifact; the 429 message) in `redesign/audits/C-A/screenshots-c-22/`.

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

---

## 8 — Hand-off to C-C

1. Read brief + plan; run pre-flight — **#4 (mechanism decision) is blocking**.
2. Phase A → verify → Phase B → verify. Gate item 2 (happy path) runs first and last.
3. No migrations; no Zone-2 actions.
4. If the dashboard-WAF option is used, record the rule details in the progress file.
5. Final commit flips the master-plan C-22 row → ✅.
6. **Escalation path if abuse continues after ship:** Cloudflare Turnstile — documented as the next step, explicitly out of this plan's scope.

---

*End of C-22 plan.*
