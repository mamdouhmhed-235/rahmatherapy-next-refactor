# C-22 — Public booking form abuse protection (honeypot + per-IP rate limiting)

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Scope discipline (user-locked):** the **public customer booking form only** (`POST /api/bookings`). **Not** the admin create-booking form, not enquiries, not any other endpoint. Two mechanisms only: a honeypot field and per-IP rate limiting.
**Predecessors:**
- Gap analysis 2026-07-16: verified **zero** rate limiting, CAPTCHA, honeypot or throttling anywhere in `src/` (`grep` across the tree). `POST /api/bookings` is fully open.
- Code audit: the endpoint validates with zod then calls `create_booking_request` (DB write: booking + client + participants) and triggers **two emails per submission** (customer confirmation + internal admin notification) via Resend.
- Runtime audit: Cloudflare Workers (`wrangler.jsonc`). No KV namespace, no custom Durable Object, no rate-limit binding configured today. The three existing DO classes (`DOQueueHandler`, `DOShardedTagCache`, `BucketCachePurge`) are OpenNext internals — **not** to be reused for application state.
**Companion files:**
- Plan: `redesign/plans/C-phase/C-22-booking-form-abuse-protection-plan.md`
- Progress: `redesign/per-page-progress/C-22-booking-form-abuse-protection-progress.md` (filled during C-C)

---

## 1 — Why

An open public endpoint that writes database rows **and sends two emails per call** is a standing liability. A trivial script can, without any sophistication: fill the bookings table with junk, burn Resend send quota, damage the sending domain's reputation (which then lands *real* booking confirmations in spam — see the deliverability gap flagged 2026-07-16), and bury genuine bookings under noise the owner must clear by hand.

Two cheap, complementary defences: a honeypot stops naive bots (most of them) at zero cost to real users; per-IP rate limiting bounds anything that gets past it.

---

## 2 — Scope

### 2.1 Honeypot field

- A decoy input rendered in the public booking form, named plausibly (e.g. `company_website` / `fax`) — never a name the real schema uses.
- **Hidden from humans AND assistive tech**: visually hidden via CSS positioning (not `display:none`, which some bots detect and skip), plus `tabIndex={-1}`, `aria-hidden="true"`, `autoComplete="off"`. *This is the classic honeypot accessibility bug — a field visible to screen readers becomes a trap that blocks blind users from booking. Non-negotiable.*
- **Server behaviour on a filled honeypot: silently drop and return a normal-looking success response.** No booking created, no emails sent, no error surfaced. Returning a 400 teaches a bot operator exactly what tripped it; a fake success wastes their time. The attempt is logged server-side (counter/console) so real volume is visible.
- Zero friction for real users: no puzzle, no third-party script, no cookie, nothing to consent to (relevant given C-18).

### 2.2 Per-IP rate limiting

- Applied at `POST /api/bookings` **before** validation, DB access, or email dispatch — the whole point is to reject cheaply.
- **Client IP from `CF-Connecting-IP`** (Cloudflare's trusted header). `X-Forwarded-For` is spoofable and must not be trusted as the identity source.
- **Limits (starting values, tunable constants):** a **burst** limit (e.g. 3 submissions / 10 minutes per IP) and a **sustained** limit (e.g. 10 / 24 hours per IP).
- **Deliberately generous**, because shared IPs are normal: a family, an office, a hotel, or a mobile-carrier NAT can legitimately share one address. The limits above still allow a household to book several appointments while stopping scripted floods. **A real customer must never be blocked on a first booking attempt** — that is the design constraint, and a false positive here costs the business a customer.
- **Response when limited:** HTTP 429 with a plain, non-technical message ("Too many booking attempts. Please try again in a few minutes, or call us on {phone}.") — always offering the phone route so a genuinely rate-limited customer isn't stranded.
- **Implementation preference (decided at impl, plan carries the decision matrix):** Cloudflare's native rate-limiting binding is the best fit (edge-enforced, free, no state to manage, rejects before the Worker does real work). Fallbacks if unavailable: a Cloudflare dashboard WAF rate-limiting rule (zero code, free tier includes a rule) or a small Durable Object counter. **Not** a Supabase-table counter — that puts a database write in the path of the very traffic being blocked.

### 2.3 Explicitly NOT in scope (user-locked)

Admin booking form · enquiries · any other endpoint · CAPTCHA / Turnstile / any third-party challenge · submission-timing heuristics · IP blocklists or reputation services · account lockout. If honeypot + rate limiting prove insufficient in production, Turnstile is the documented next step — a later decision, not this plan.

---

## 3 — States & edge cases

- **3.1 Legitimate repeat booker** (books for self, then a family member, minutes apart): allowed — burst limit is 3.
- **3.2 Shared/NAT IP** (office, carrier): sustained limit is generous; if a real block is ever reported, the constants are one-line tunable and the 429 copy always offers the phone.
- **3.3 Missing `CF-Connecting-IP`** (local dev, unexpected proxy): **fail open** — allow the request. Rate limiting is a nuisance-reducer, not a security boundary; breaking bookings because a header is absent would be a worse outcome than letting a request through.
- **3.4 Browser autofill fills the honeypot** — mitigated by `autoComplete="off"` and a name no autofill heuristic recognises as a real field; verified during testing with browser autofill enabled.
- **3.5 Honeypot tripped by a real user with an unusual assistive setup** — the hidden-from-AT requirements (§2.1) make this near-impossible; the logged counter would reveal it if it ever happened.
- **3.6 Admin form unaffected** — staff submit through a different path; no rate limit, no honeypot there.
- **3.7 Interaction with C-20** (address autocomplete) — none; autocomplete is a client-side Google call, unrelated to this endpoint.

---

## 4 — Migration / dependencies

**No database migration. No new package.** Possibly one `wrangler.jsonc` binding addition (rate-limit binding) — a deploy-config change, called out at impl. Independent of every other plan; can ship anytime. Small.

---

## 5 — Acceptance criteria

1. Submitting the public booking form normally still works end-to-end (booking created, both emails sent) — the primary regression check.
2. A submission with the honeypot filled creates **no booking**, sends **no email**, and returns a success-shaped response; the attempt is logged.
3. The honeypot field is invisible on screen at 375/1280, unreachable by keyboard tabbing, and not announced by a screen reader.
4. Browser autofill does not populate the honeypot.
5. Exceeding the burst limit returns 429 with the friendly phone-inclusive message; a normal single booking never triggers it.
6. Rate limiting rejects **before** any database or email work occurs (verified by absence of a DB row / email event on a limited request).
7. Missing `CF-Connecting-IP` fails open (dev environment still works).
8. Admin create-booking flow is entirely unaffected.
9. Static gates pass; no new package; limits are named constants in one place.

---

*End of C-22 brief. Plan: `redesign/plans/C-phase/C-22-booking-form-abuse-protection-plan.md`.*
