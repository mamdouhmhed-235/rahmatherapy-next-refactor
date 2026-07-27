# C-22 — Public booking form abuse protection — PROGRESS

**Plan:** `redesign/plans/C-phase/C-22-booking-form-abuse-protection-plan.md`
**Brief:** `redesign/briefs/C-22-booking-form-abuse-protection-brief.md`
**Programme:** Band C, C-C implementation — plan **#2 of 22** in the C-C-EXECUTION-PROTOCOL §4 order.
**Executed:** 2026-07-27 · orchestrated session (implementer + independent verifier per phase, browser a11y gate, adversarial diff review, two fix rounds)
**Programme-start SHA:** `11553c7` · **Previous plan:** C-21 closed at `d180902`

---

## 1 — Commits

| # | SHA | Message | Files |
|---|---|---|---|
| 1 | `ceb028d` | `feat(redesign): C-22 Phase A — honeypot` | 7 |
| 2 | `a63de0b` | `feat(redesign): C-22 Phase B — rate limiting` | 10 |
| 3 | `ef1e201` | `test(redesign): C-22 — close verifier-found test gaps (DO contract, fail-open paths, window boundary)` | 2 |
| 4 | `e4544bb` | `fix(redesign): C-22 — burst limit 5, denied requests spare the daily budget, hung-DO fail-open` | 3 |

Plan §7 cadence specified 3 commits (Phase A / Phase B / verification). Shipped as 4 code commits + bookkeeping: the two extra are verifier- and Owner-driven fix rounds under protocol §2.5, not unplanned work. Not pushed.

---

## 2 — The mechanism decision (plan §1 Step 3 / pre-flight #4 — the blocking gate)

Pre-flight #4 required deciding the rate-limit mechanism **with the Owner** before implementing. Research against current Cloudflare documentation overturned the plan's ranking:

| Option | Plan's verdict | Verified reality |
|---|---|---|
| Workers rate-limiting binding | **"Preferred"** | `period` must be **10 or 60 seconds**. Cannot express 3/10min or 10/day. Also counts **per Cloudflare location**, not globally. |
| WAF dashboard rule | "Good fallback" | **Workers Free: 1 rule, 10s period only**, 10s mitigation, IP characteristic only. 10-minute periods need **Business**; 24h needs Enterprise. |
| **Durable Object counter** | "Only if the above are unavailable" | **CHOSEN.** Exact 600s/86400s windows, globally consistent per key, in-repo. SQLite-backed DOs are available on Workers Free. |
| Supabase-table counter | ✗ rejected | unchanged |

**Owner decisions, 2026-07-27, in chat:**
- Mechanism: **Durable Object counter**. The plan's own matrix permits it precisely when the other two are unavailable, which the evidence establishes.
- Cloudflare plan: **Workers Free** (recorded per pre-flight #4). This is why the migration uses **`new_sqlite_classes`**, never `new_classes` — KV-backed DOs are paid-only.
- **Files-touched list extended** to `worker-entrypoint.ts` + `wrangler.jsonc` (a DO class must be exported from the Worker's main module). Raised under protocol §1.6 rather than widened silently.

**The Step 3 ⛔ HARD-STOP did not fire** — by its own text it applies only to the dashboard-WAF option ("If the wrangler-binding (or DO) option was selected, no Zone-2 action exists here; skip this stop"). No external console action was taken at any point.

---

## 3 — Steps executed

| Step | Status | Notes |
|---|---|---|
| 1 — honeypot field, wired end to end | ✅ | `company_website` through `types.ts` (`BookingDetails`, `emptyBookingDetails`, `BookingRequestPayload`), client schema, `ConfirmStep.tsx` via `form.register` (no local state), and **hoisted to a TOP-LEVEL payload key** — without the hoist (C22-F2) the guard would have been silently inert. |
| 2 — server-side silent drop | ✅ | Guard sits after `request.json()` (it needs the parsed body) and before zod. Key deliberately absent from the server schema, so a filled value can never reach the RPC. |
| 3 — mechanism decision | ✅ | See §2. |
| 4 — booking rate limit | ✅ | First statement in `POST`, before `request.json()` and any DB/email work. `CF-Connecting-IP` only. |
| 4a — availability endpoints (D23) | ✅ | Both public routes limited at higher thresholds, separate counter scopes. |
| 5 — tests | ✅ | 28 new specs across `rate-limit.test.ts`, `bookings/route.test.ts`, `availability/route.test.ts`. |

### Shipped constants (deviates from plan §1 Step 4 — Owner-approved, see §5)

| Scope | Burst | Sustained |
|---|---|---|
| `POST /api/bookings` | **5 / 10 min** *(plan said 3)* | 10 / 24 h |
| `POST /api/availability` | 120 / 10 min | 1000 / 24 h |
| `POST /api/availability/month` | 120 / 10 min | 1000 / 24 h |

**Availability-threshold derivation** (from `ScheduleStep.tsx`, verified by an independent reviewer against the actual code): the month cache is a `useRef(new Map())` that dies on unmount — which happens on every step-back; `preferredTime` sits in the day-fetch effect's dependency array, so picking a time refires `/api/availability`; and a one-shot auto-jump-forward adds a month call. A thorough real session ≈ 30–40 calls per endpoint, giving ~3× headroom. Prop identity is stable (`useMemo`/`useCallback`), so there is no render-loop refetch, and a non-ok response stops rather than retrying — no retry storms. **This is a derivation, not a measurement**; no timing artifact was captured.

---

## 4 — Verification gate (plan §3)

| Gate | Result |
|---|---|
| §3.1 lint | **59 errors / 7 warnings — identity exact**, same 6 files, no swap-ins |
| §3.1 tsc | **0 errors** |
| §3.1 vitest | **6 failed / 519 passed / 525** — the 6 are exactly the inherited set |
| §3.1 build | `pnpm build` → **clean** (re-run at `e4544bb`) |
| §3.2 happy path (real booking) | ⛔ **NOT RUN** — Zone-2. Would write production rows + send 2 real emails. Owner approved §3.3 only. |
| §3.3 honeypot silent drop | ✅ **PASS — run against the live route with Owner approval.** See §4.1. |
| §3.4 honeypot invisibility / a11y | ✅ **PASS, 6/6.** See §4.2. |
| §3.5 rate limit → 429 | ⛔ **NOT RUN — structurally impossible pre-deploy.** See §4.3. |
| §3.5a availability 429 | ⛔ **NOT RUN** — same reason. |
| §3.6 fail-open in local dev | ✅ Verified by code path **and** empirically — the dev server serves bookings normally throughout (two independent fail-open paths: no `CF-Connecting-IP`, and `getCloudflareContext()` throws because `next.config.ts` never calls `initOpenNextCloudflareForDev()`). |
| §3.7 admin unaffected | ⚠️ **Qualified pass** — see §5.3. |
| §3.8 evidence | ✅ `redesign/evidence/C-22/` — a11y report + 1280/375 captures. The 429-message screenshot is deferred with §3.5. |

### 4.1 — §3.3 executed, with a zero-risk design

Because the honeypot guard runs **before** zod, a minimal body containing only the decoy distinguishes both outcomes with **no path to a booking**: guard fires → success-shaped 200; guard broken → zod 400. Both outcomes are safe.

- `POST /api/bookings/` with `{"company_website":"c22-honeypot-probe"}` → **200** with the full real 7-key body: `{status:"submitted", message, bookingId:"5e740a7c-…", participantCount:1, itemCount:1, assignmentCount:1, manageUrl:null}`
- **Negative control** — identical body, decoy empty → **400** from zod. This proves the 200 came from the guard specifically, not from any other path.
- **Zero footprint, confirmed by read-only SQL before and after:** bookings 14→14, clients 14→14, `email_delivery_events` 42→42, latest booking unchanged at 2026-07-20, and the fabricated `bookingId` exists nowhere in the database.
- Not verifiable from here: the `console.warn` trip log, which prints to the Owner's dev-server terminal.
- Note: `POST /api/bookings` (no trailing slash) 308-redirects to `/api/bookings/` because `next.config.ts` sets `trailingSlash: true`. 308 preserves method and body so the client works, but it costs a hop on every public booking submit.

### 4.2 — §3.4 honeypot accessibility, all six checks passed

Run in the real rendered Confirm step. **No submission occurred** — verified from the browser's own network log (zero `bookings` requests).

1. **Invisible** at 1280 and 375 — rect `{x: -9999, width: 173.14, height: 20.86}`, `elementFromPoint(centre)` = `null`, `intersectsViewport: false` measured with the dialog scrolled to where the decoy sits; `scrollWidth == clientWidth` at both widths (no horizontal-scroll side effect).
2. **Not keyboard reachable** — 40 real `Tab` and 22 real `Shift+Tab` presses across 2.2 full cycles of the 18-stop focus trap; focus never landed on it. Present in the focusable-candidate set, excluded from the tabbable set solely by `tabIndex: -1`.
3. **Not exposed to assistive tech** — Chrome's own 380-node accessibility tree via CDP contains no `company_website` and no "leave this field empty"; `exposedTextboxCount: 0`. `aria-hidden="true"` and `tabindex="-1"` both confirmed as real rendered attributes.
4. **Off-screen, not `display:none`** — computed `display: block`, `visibility: visible`, `position: absolute`, `left: -9999px`, `0×0`, `overflow: hidden`. The brief is explicit that `display:none` is wrong because some bots skip it.
5. **`autoComplete="off"` + autofill does not populate it** — a real saved address profile was installed via CDP and `Autofill.trigger` aimed at the decoy left it empty. **Positive control:** the identical trigger on `input[name="address"]` did fill it, so this is not a dead-harness false pass.
6. **`name` is `company_website`** in the real DOM; the `{...register(...)}` spread-order concern resolved empirically — `register` contributes no `tabIndex`/`autoComplete` key, so nothing was overridden.

**Registered, not orphaned** — proved by a state round-trip: the value survived `ConfirmStep` unmounting and remounting, so it lives in RHF's `_formValues`, which is what `handleConfirmSubmit` reads.

Not run: a real screen reader (NVDA/VoiceOver) — verified via the browser's accessibility tree instead; and native autofill-dropdown acceptance, which needs `Enter` on the Confirm step and would have submitted the form.

### 4.3 — §3.5 / §3.5a cannot fire on the dev server, by construction

Under `next dev` the limiter fails open **twice over** — no `CF-Connecting-IP` exists locally, and `getCloudflareContext()` throws because `next.config.ts` never calls `initOpenNextCloudflareForDev()`. There is no path from `pnpm dev` to a 429. Additionally `pnpm build` is `next build` only; the Cloudflare bundle (`cf:build`/`preview`/`deploy`) is what exercises the DO class, the binding and the migration — none of which has run.

**Owner decision 2026-07-27: record as post-deploy.** In their place the logic is covered by unit tests, including an **end-to-end contract spec** that wires the real `RateLimiter` to the real `checkRateLimit` with no hand-written JSON between them — demonstrated to fail if **either** side's payload shape drifts (proven by breaking each side in turn). That spec exists specifically because a shape drift would otherwise make rate limiting **silently inert in production with a fully green suite**.

### 4.4 — Independent re-verification of the limiter changes (`e4544bb`)

A fresh verifier re-checked the fix round per protocol §2.5 and returned **PASS**, with evidence beyond a code read:

- **Hand-walked requests 1–8 at limit 5**, old vs new. The stored burst counter now parks at exactly `limit` and every later request in the window recomputes `5 + 1 > 5` and is refused. The trap is avoided *structurally*: the verdict is computed from the **would-be** count, never from stored state, so a refusal can never lower the counter below the limit and "un-stick" the block.
- **Differential fuzz, 740,000 verdict pairs** — 20,000 timelines × 25 requests with gaps drawn from the exact window edges and their ±1 neighbours (`0, 1, 2, 599999, 600000, 600001, 86399999, 86400000, 86400001`), plus a broad random pass. **Zero cases where the new code denies a request the old code would have allowed.** All 7,122 divergences run the other way and are exactly the intended budget saving. This is the direction that matters: the restructure cannot wrongly block a customer.
- **Budget saving quantified:** 11 attempts in 50 s now leave the daily counter at **5/10**; the old code left it at **11/10** — the whole day burned.
- **Sustained still bites:** an abuser paced at exactly 5 per fresh burst window across 6 windows gets exactly 10 allowed, first denial on attempt 11.
- **Fixed anchor proven:** after 8 hammering requests the anchor is unmoved; DENY at `anchor+599999`, ALLOW at `anchor+600000`.
- **Alarm safety:** across 2,000 random timelines, zero violations of "alarm scheduled before a live window expires".
- **Atomicity safe** under Durable Object input/output gate semantics — the object is continuously gated from entry to exit, so the staged writes cannot interleave, and a partial write is not observable (the caller sees an error and fails open).
- **Timeout fail-open verified live** — the never-settling spec resolves in exactly 500 ms against a stub that both hangs *and* ignores the signal, so only the race can resolve it. No unhandled rejection on any of the three paths, confirmed with an `unhandledRejection` listener.
- **Mutation-tested the key spec:** `spares the daily budget…` fails under the pre-fix code *and* under the most plausible near-miss patch (skipping the put only for the over-limit window), so it isolates the sustained budget rather than passing incidentally.

---

## 5 — Deviations

### 5.1 — Client schema uses `z.string().optional()` (plan Step 1 said "plain `z.string()`")
Accepted; an independent verifier ruled it correct and ruled *against* reverting. A required key would fail an existing spec in `src/features/booking/schemas/booking-schema.test.ts` — a file outside the plan's files list, so amending it would have been a protocol §1.6(b) scope-widening STOP. It also strictly better serves the plan's stated purpose ("so client validation never flags it"). **Correction to the implementer's report:** the blast radius was **one** spec, not three.

### 5.2 — Burst limit 5, not 3 (Owner-approved)
The burst window counts **attempts**, not successful bookings. A customer whose submit fails server-side (e.g. `BookingCreationError` when the slot was just taken) and retries can plausibly reach 4 attempts in ten minutes and be wrongly blocked — brief §4's top risk row is "a real customer gets rate-limited and gives up". A flood is thousands of requests, so 5 stops one exactly as well as 3. **Plan §1 Step 4, plan §4's risk table, and brief §2.2/§3.1 still read `3` — the shipped value is 5.**

### 5.3 — Denied requests no longer consume the sustained budget (Owner-approved)
`consume()` originally incremented **every** window on **every** call, including calls the burst window had already denied — so ~11 requests inside one minute exhausted the entire 24-hour allowance. Against a carrier-NAT or office egress IP that is a cheap, silent denial-of-booking for everyone behind that address. Restructured from *increment-then-compare* to **stage-then-compare-then-commit**: per-window would-be state is staged and committed only when the request is allowed.

The subtle part, recorded because it is easy to get wrong later: refusal is computed from the **would-be** count, not the stored one. A naive "don't increment when denied" applied to a compare-*after*-increment scheme would leave the stored counter one below the limit and start allowing requests again. Fixed windows stay anchored at each window's first request, so a blocked IP is released exactly `windowMs` later no matter how hard it is hammered — and a sliding window would be strictly worse here, since a bot could then hold a NAT'd IP locked out indefinitely.

### 5.4 — Hung-DO fail-open added (reviewer-driven, both verifiers flagged it)
`checkRateLimit` awaited the DO round trip with no timeout, on the hot path of every public availability call and every booking submit. Fail-open covered *thrown* and *non-ok*, but not *slow* — so a degraded DO would have stalled the live customer calendar with no escape hatch, against brief §3.3's governing fail-open principle. Added `RATE_LIMITER_TIMEOUT_MS = 500` with both an attached `AbortSignal.timeout` (cancels the real round trip) and a race (guarantees the escape hatch even if a stub ignores signals).

### 5.5 — Files-touched list extended (Owner-approved)
`worker-entrypoint.ts` (+4 lines: comment + one re-export) and `wrangler.jsonc` (+19 lines). Also `src/lib/rate-limit-durable-object.ts`, a new module not literally enumerated anywhere — an unavoidable consequence of the Owner-chosen mechanism, recorded here rather than left to appear unannounced.

### 5.6 — §3.7 "admin unaffected" is qualified, not literal
`ManualBookingForm.tsx:677` calls `/api/availability`, so the admin create-booking form now shares the public per-IP `availability` counter from the clinic's IP. **The admin submit path is genuinely untouched** — it goes through the `createManualBooking` server action, with no limiter and no honeypot. Only the shared availability *lookup* is limited: 1 call per date checked, 2 for a mixed-gender group, so ~1–6 calls per booking against 120/10min. On a 429 the admin form shows its own generic copy, so the customer-facing "call us on…" string never reaches staff. Brief §3.6 and gate §3.7 were written before D23 brought these endpoints into scope; D23 knowingly limited an endpoint the admin form shares. **Recorded as a named, quantified deviation rather than ticked as "unaffected".**

---

## 6 — Deferred / flagged, not actioned (protocol §1.6a)

1. **The honeypot markup is the only Tailwind-utility `className` in the entire `src/features/booking` tree** (`ConfirmStep.tsx`); every other className there is a CSS-module class. Verified *not* a live defect — `globals.css` declares `@source "../**/*.{ts,tsx}"` and the built CSS contains `.left-\[-9999px\]{left:-9999px}`. **But the failure mode if that ever changes** (the `@source` glob narrowed, or the component moved) is severe: the decoy renders as a *visible* input labelled "Leave this field empty" on the final booking step, and any customer who types in it has their booking **silently dropped with a fake success**. The conforming fix is a dedicated `.honeypot` class in the module — note that `.srOnly` (already present at `BookingExperience.module.css:101`) is **not** a valid substitute, since it stays exposed to assistive tech, the exact bug brief §2.1 calls non-negotiable. The plan's own snippet specified these Tailwind classes verbatim, so this is a plan-vs-Part-0 conflict, not implementer improvisation.
2. **A month-endpoint 429 is swallowed** — `ScheduleStep.tsx:107-108` discards `data.error` and sets `monthDays = null`, so a rate-limited customer sees a calendar with no availability and no explanation; `RATE_LIMITED_AVAILABILITY_MESSAGE` is effectively dead copy for that endpoint (the day endpoint does surface it). Pre-existing handling, newly reachable. Fixing it would touch a file outside the plan's list.
3. **Every failure mode of the limiter is silent.** The no-header, no-binding and non-ok paths all fail open with no log; only the throw path logs. If the binding or the `v1` migration fails to take effect on the first deploy, rate limiting is 100% inert forever and the output is indistinguishable from "no abuse is happening". Mitigation is the post-deploy check in §7.
4. **`details.company_website` is sent twice** — top-level (the load-bearing copy) and nested inside `details` as a byproduct of `details: values`. Traced and proven inert: the server `details` schema has no such key and zod strips by default, and `createBookingTransaction` builds the RPC argument from a **closed `p_`-prefixed allow-list**, never a spread.
5. **Constant naming** — the booking limits are `RATE_LIMIT_BURST`/`RATE_LIMIT_SUSTAINED` (unprefixed) beside `AVAILABILITY_RATE_LIMIT_*`. Straight from the plan snippet; a third scope later would make this confusing.
6. **Logging is GDPR-clean** — verified, since an IP is personal data: the honeypot log carries only an ISO timestamp, and the limiter's error log carries a fixed string plus the caught error. The DO is addressed via an `.invalid` hostname, so no IP appears in any URL or error. Nothing personal is logged anywhere in the new code.
7. **Escalation path if abuse continues after ship:** Cloudflare Turnstile — documented in plan §8.6 as the next step, explicitly out of scope.
8. **The 500 ms timeout guards the headers phase only.** `await response.json()` sits outside the race, so a response with instant headers but a stalled body would still hang. Not reachable in practice — `RateLimiter.fetch` returns a fully buffered `new Response(JSON.stringify(...))` and the real runtime cancels the body stream on abort — but it is the one gap in the "a hung DO cannot stall the caller" claim.
9. **The 500 ms ceiling deserves post-deploy evidence.** The code comment claims a healthy limiter never trips it; that overstates the case. On a low-traffic clinic site **each IP gets its own Durable Object, so a cold object is the common case, not the rare one** — every first-time visitor's DO is cold, and a cold start with SQLite can reach the low hundreds of ms. A flood against one IP also serializes on that IP's DO via the input gate, so deep queueing could push past 500 ms (the harder the flood, the likelier it slips through). Both are acceptable — the honeypot is the primary bot defence and the JSDoc frames rate limiting as "a nuisance-reducer, not a security boundary" — but see the post-deploy log check in §7.
10. **Two storage writes are separately awaited** rather than a single multi-key `put({k1:v1, k2:v2})`, which DO storage supports and which would be a true single atomic write. The observable failure mode is benign; changing it would mean widening `DurableObjectStorageLike`. Note only.
11. **`workerd#1020`** — a historical bug where `AbortSignal.timeout` threw an uncatchable async `DOMException` under local `wrangler` (not `--remote`). Closed by PR #1177 in 2023, well before this project's `compatibility_date: 2025-03-25`. Recorded so that if an uncaught `DOMException` from the limiter ever appears under local wrangler, the cause is known.

---

## 7 — Outstanding Owner actions

| # | Action | Status |
|---|---|---|
| 1 | **Deploy required before any of C-22 Phase B is live.** The DO binding, the `v1` migration and the limiter are inert until a Cloudflare deploy. | ⏳ open |
| 2 | **Post-deploy: verify the limiter is actually active** — 6 rapid booking submissions from one IP should yield a 429 on the 6th. Given §6.3, this is the only thing distinguishing "working" from "silently inert". Closes gate §3.5. | ⏳ open |
| 3 | Post-deploy: confirm a burst against `POST /api/availability/month` yields 429, and that normal calendar browsing never does. Closes gate §3.5a. | ⏳ open |
| 4 | Decide whether to run gate §3.2 (real end-to-end booking) and §3.7 (admin booking) — both need production writes and real emails. | ⏳ open |
| 5 | Consider setting `business_settings.contact_email` (carried from C-21 — currently NULL, so booking emails carry no contact line and admin notifications go to the FROM address). | ⏳ open |
| 6 | **Post-deploy: check Workers logs for `[C-22] rate limiter unreachable or too slow`.** If it appears routinely rather than never, the 500 ms ceiling is too tight for cold-start latency and should be raised — see §6.9. The log line exists precisely to make this observable. | ⏳ open |

---

## 8 — ⚠️ Carry-forward for later Band C plans

**8.1 — The next `wrangler deploy` applies C-22's Durable Object migration as a side effect.** `wrangler.jsonc` now carries the binding and `migrations` tag `v1`, but no deploy has happened. The first candidate is **C-01 / C-04a cron-trigger activation**, which protocol §1.2 lists as its own ⛔ HARD-STOP. **That deploy's approval text must state that it also creates the `RateLimiter` Durable Object** — otherwise the Owner approves "activate a cron" and receives a DO as well.

**8.2 — Once `v1` is live, any future DO change must be a NEW `{"tag":"v2", …}` entry.** Editing `v1` in place is a deploy-time error.

**8.3 — Anchor shifts (protocol §1.9 shared surfaces).** `wrangler.jsonc` gained 19 lines between `images` and `observability`; `worker-entrypoint.ts` gained 4 lines after the `export { DOQueueHandler, … }` line. C-01 and C-04a both edit these for cron dispatch — re-locate by symbol, never by remembered line number. The existing `triggers.crons` block is untouched, so the dispatch-table work will not fight C-22's additions.

**8.4 — Any tooling that fills every input now trips the honeypot** and receives a fake 200 with no booking created — a green test that proved nothing. `e2e/booking-public.spec.ts` stops at the service step today, so nothing breaks now. **C-20, C-17 Phase B and C-14 Phase D all touch this form** and may add submit coverage: they must leave `company_website` empty. `autoComplete="off"` covers browser autofill but not password-manager extensions or generic fill-all helpers.

**8.5 — Availability-route coordination.** `src/app/api/availability/route.test.ts` mocks `@/lib/booking/availability`, so **C-23 Phase B** and **C-14 Phases C/D** will need to update that mock when they change the engine's signature. The limiter itself is a self-contained `if` block at the top of each POST and does not entangle with the options bag those plans add.

**8.6 — C-21's tripwire still binds.** `src/content/site/__tests__/canonical-domain.test.ts` scans all of `src/`: any new file containing `rahmatherapy.com`, `rahmatherapy.co.uk`, or a second `https://rahmatherapy.uk` literal fails it. Fixture emails stay on `*.example` / `*.example.test`.

**8.7 — `MAINTENANCE_MODE` is flipped locally.** `src/lib/maintenance.ts` reads `false` in the working copy (Owner-authorised, 2026-07-27) so the customer booking dialog mounts for browser verification across the programme. **It is never staged or committed, and must be restored to `true` before programme end / any deploy.**

---

## 9 — Baseline identity AFTER C-22 (inherited by plan #3, C-06)

**This supersedes the C-21 list and any baseline text hardcoded inside later plans.**

- **tsc:** `npx tsc --noEmit` → **0 errors, clean.**
- **build:** `pnpm build` → **clean.**
- **vitest: 6 failed / 519 passed / 525 total** *(C-21 left 6/488/494; C-22 added 31 passing specs — the failure set is unchanged)*:
  1. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Owner broad access while keeping owner-only role actions permission-gated
  2. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Admin broad operational access without role template management
  3. `src/app/api/bookings/createBookingTransaction.test.ts` :: createBookingTransaction normalizes a single public booking into the RPC payload
  4. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm renders step 1 on first load
  5. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm moves focus to the first invalid field when continuing with errors
  6. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm shows the consent error when trying to create booking without consent
- **lint: 59 errors / 7 warnings**, in exactly:
  - `design_handoff_area_pages/prototype/area-page.jsx` 48E 1W
  - `design_handoff_area_pages/prototype/shared.jsx` 2E 5W
  - `design_handoff_area_pages/prototype/site-chrome.jsx` 5E 0W
  - `src/features/booking/BookingExperience.tsx` 3E 0W
  - `src/features/booking/BookingExperienceLoader.tsx` 1E 0W
  - `src/features/booking/utils/returning-customer.ts` 0E 1W

**Expected shrinkage:** none was expected for C-22, and none occurred. **C-06 (plan #3) is the plan expected to remove failure #3 (`createBookingTransaction`)** — confirming that removal is an explicit exit-criterion of C-06's closeout.

---

*End of C-22 progress.*
