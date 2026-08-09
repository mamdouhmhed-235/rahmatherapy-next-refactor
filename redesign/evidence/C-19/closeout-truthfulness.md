# C-19 — Truthfulness closeout review

**Commit under review:** `e70bef8` — "feat(redesign): C-19 privacy policy page" (parent `425556b`)
**File under review:** `src/app/(public)/privacy/page.tsx`
**Reviewer role:** read-only verification subagent, TRUTHFULNESS dimension
**Method:** every factual assertion on the page traced to the code that makes it true, or reported unsupported. Git limited to `log`/`diff`/`show`/`status`; no writes outside this report; `src/lib/maintenance.ts` untouched and excluded.

Confirmed scope via `git show e70bef8 --stat`: adds only `src/app/(public)/privacy/page.tsx` (220 lines) and the two evidence screenshots. No other source file changed.

---

## 1. "What we collect" vs the real booking payload

Traced the schema by symbol in `src/app/api/bookings/route.ts:19-45` (`bookingRequestSchema`, not by stale line numbers) and cross-checked the corresponding form fields in `src/features/booking/components/AboutYouStep.tsx` and `ConfirmStep.tsx`.

Fields actually collected: `bookingFor`, `fullName`, `phone`, `email`, `notes`, `healthNotes`, `clientGender`, `numberOfPeople`, `participantGenders`, `participantNames`, `participantNotes`, `postcode`, `address`, `city`, `area`, `accessNotes`, `parkingNotes`, `selectedPackageIds`, `preferredDate`, `preferredTime` (plus three boolean acknowledgement flags, not personal data).

### FINDING A — BLOCKING: "City / Town" is collected but never disclosed
`route.ts:38` requires `city: z.string().trim().min(3 chars... )` — actually `.min(2)` — as a distinct field. `AboutYouStep.tsx:497-509` renders it as its own required input, labelled **"City / Town"** (`autoComplete="address-level2"`), separate from `area` ("Area / County", `address-level1`) and `postcode`. The page's "What we collect" bullet (`page.tsx:78-81`) reads: *"Your postcode, address and area, plus any access or parking notes, so we can find and reach you."* Town/City is a real, required, distinct field the code collects and the page never names. This is a category the page must disclose under UK GDPR Art. 13(1)(c) and it is silently missing.

### FINDING B — BLOCKING: the booker's own gender is collected, but the page scopes gender collection to "anyone else"
`AboutYouStep.tsx:294-328`: for non-group bookings, the fieldset's legend is **"Your gender"** when `bookingFor === "self"` and **"Participant gender"** when `"someone_else"` — i.e. `clientGender` (`route.ts:28`) captures the *primary booker's own* gender when they book for themselves, not only a third party's. The page's bullet (`page.tsx:82-85`) reads: *"Whether the booking is for yourself, someone else, or a group, plus the names and genders of anyone else included."* Read plainly, this scopes gender (and name) collection to people *other than* the person filling in the form. It omits that the enquirer's own gender is asked and stored whenever they book for themselves. Same defect class as Finding A: a field the code genuinely collects, absent from the disclosure.

No fields were found on the page that the code does *not* actually collect — the reverse direction (over-claiming) turned up nothing.

---

## 2. Processors named in section 4

| Processor named on page | Verified in code |
|---|---|
| Supabase | `createSupabaseAdminClient` used throughout `src/app/api/bookings/route.ts` and elsewhere — confirmed. |
| Resend | `src/lib/email/client.ts:2` — `import { Resend } from "resend"`; used by `sendBookingCreatedEmails` (`route.ts:9`). Confirmed. |
| Cloudflare | `wrangler.jsonc` at repo root (OpenNext Cloudflare deploy target); `checkRateLimit` (`route.ts:51`, `src/lib/rate-limit`) reads `CF-Connecting-IP` / a Durable Object binding — supports "protects it from abuse." Confirmed. |
| Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all present and initialised. Confirmed as a processor; scrubbing claim assessed separately below. |
| Google | `src/components/GoogleAnalytics.tsx` — confirmed, gating assessed below. |

No processor is named on the page that isn't genuinely present, and none of the five in active use is omitted.

### FINDING C — NON-BLOCKING (documented gap, no demonstrated live leak): Sentry scrubbing is keyword/pattern-based and does not cover every field the page itself describes as sensitive
Page copy (`page.tsx:143-146`): *"Sentry — reports technical errors so we can fix problems; personal information is scrubbed before it reaches Sentry."*

`src/lib/observability/sentry-scrubbing.ts:3-4`:
```
const SENSITIVE_KEY_PATTERN =
  /(address|admin.*note|anon.*key|authorization|city|consent|cookie|customer.*note|email|full.*name|health|manage.*token|name|phone|postcode|postal|resend|secret|sentry.*auth|service.*role|supabase.*key|token|treatment)/i;
```
This filters an event **by key name** (e.g. `healthNotes` matches via `health`) and, separately, redacts **structured content patterns** (email/UK postcode/phone/long-token regexes) inside any string value regardless of key (`redactText`, lines 44-50).

Two booking-payload keys the page's own "What we collect" section names are not caught by either mechanism:
- `notes` (treatment notes) and `participantNotes` (notes about someone else, which section 2 of the same page explicitly says "may include information about that person's health too") — neither key matches `SENSITIVE_KEY_PATTERN` (it only catches `admin.*note` / `customer.*note`, not a bare `note(s)` or `participant...notes`), and free-text health prose inside those strings (e.g. "has asthma, uses an inhaler") will not match the email/postcode/phone/token content patterns either. It would pass through `beforeSend` unredacted.
- `clientGender` / `participantGenders` — `gender` is not in the key pattern either, though gender values carry lower sensitivity than health notes.

Verified test coverage (`src/lib/observability/sentry-scrubbing.test.ts:6-39`) only exercises `contact_email`, `phone`, `postcode`, `health_notes`, `manage_token` — it does not exercise `notes` or `participantNotes`, so this gap is untested as well as unfixed.

**Why this is NON-BLOCKING rather than a proven false statement today:** I searched for every `Sentry.captureException` / `captureMessage` / `setContext` call in `src/` (8 files, list below) and none of them attach booking-body fields (`notes`, `healthNotes`, `participantNotes`, etc.) as context or extra data. `src/app/api/bookings/route.ts` has no direct Sentry call at all; error capture there is via `onRequestError = Sentry.captureRequestError` (`src/instrumentation.ts:13`), and all three `Sentry.init` calls set `sendDefaultPii: false`, so the SDK does not attach the parsed request body by default. I could not find a live path today that actually sends `notes`/`participantNotes` content to Sentry. So the page's claim is not currently contradicted by observed behaviour, but the scrubbing mechanism it describes as blanket ("personal information is scrubbed") has a real, demonstrable coverage gap for exactly the free-text fields section 2 discloses as potentially containing health information about a third party, should any future code path (or an as-yet-unaudited automatic SDK capture) include them. Recording this per the dimension's explicit instruction to "note anything it does NOT scrub."

Session Replay (`sentry.client.config.ts`) is a separate mechanism worth flagging as a documentation note, not a defect: its own file comments state Replay "bypasses the client's event pipeline entirely" and does not go through `beforeSend`/`scrubSentryEvent` (lines 9-17, 108-109). It relies on Sentry's default DOM text/input masking instead (referenced at line 49, "text is masked by default"), is consent-gated for all non-admin routes, and is switched off entirely on `/admin` and `/booking/manage`. The page's single sentence about Sentry doesn't distinguish error-event scrubbing from Replay's separate masking regime — not inaccurate, but a simplification the page glosses over silently.

Sentry.capture call sites checked (all pass only an `Error`/message, no booking data): `src/app/global-error.tsx:13`; `src/app/api/cron/scheduled-emails/route.ts:46,72,124,157`; `src/app/api/cron/review-emails/route.ts:74,117,142,153`; `src/app/api/cron/extend-recurring-horizons/route.ts:156,186,230,532,573`; `src/app/api/cron/booking-reminders/route.ts:55,75,99,119,162,166`; `src/app/admin/reports/reports-data.ts:110`.

---

## 3. Analytics gating claim

Page (`page.tsx:118-125`, `148-150`): analytics "only once you've given us your consent through the cookie banner"; Google "only runs once you've given cookie consent for it."

`src/components/GoogleAnalytics.tsx:44-48`:
```
if (!GA_ID || process.env.NODE_ENV !== "production") return null;
if (consent?.choices.analytics !== true) return null;
```
Fail-closed confirmed: the component returns `null` unless the stored consent snapshot's `choices.analytics` is the literal boolean `true`; `undefined` (not yet read) and `null` (no grant) both fall through to the deny branch (component doc-comment, lines 18-21, matches the code). Server render emits nothing for anyone (comment lines 22-28, and no `document.cookie` read happens at render time — consistent). This matches the page's claim exactly. No finding.

---

## 4. `/cookies/` link

Route exists: `src/app/(public)/cookies/page.tsx`. `next.config.ts:43` sets `trailingSlash: true`. The page's link (`page.tsx:121`, `<Link href="/cookies/">`) uses the trailing slash consistent with that config. Not a dead link. No finding.

---

## 5. Contact details

`page.tsx` imports `contactLinks` from `@/content/site/contact` and renders `contactLinks.email.href`/`.value` and `contactLinks.phone.href`/`.value` directly (`page.tsx:59-66`) — not retyped literals. `src/content/site/contact.ts:9-25` defines `email: "rahmatherapy@outlook.com"` / `phone: "07798897222"`, matching the Owner's answer (a) exactly. Because the page references the shared constant rather than duplicating the string, future drift in `contact.ts` propagates automatically rather than silently diverging. No finding.

---

## 6. Rights claims (operational, not code-verifiable per se)

Section 7 lists access/rectification/erasure/restriction/objection/portability/withdraw-consent, and directs the user to "contact us using the details in 'Who we are'" (`page.tsx:188-191`) — no self-service delete button, form, or portal is implied anywhere on the page. Checked `src/app/admin/clients/actions.ts:625-630` for the deletion mechanism that would actually fulfil an erasure request: it is a **hard delete** performed via an admin server action (staff-triggered, not customer-facing), consistent with "contact us" rather than an in-app self-service flow. No finding — the page does not promise a mechanism the site lacks.

---

## 7. Retention — no automated pruning job

Searched `src/app/api/cron/**` (the only scheduled-job surface) and all `.delete()` call sites repo-wide for anything resembling scheduled retention enforcement. Confirmed, matching the per-page-progress note (§1.1(b) caveat 2): the only booking `.delete()` in any cron route is the rollback path in `src/app/api/cron/extend-recurring-horizons/route.ts:569-572`, which fires when a recurring-series creation fails partway through — not a retention/age-based purge. Every other `.delete()` found (`grep` across `src/`) is admin CRUD on availability, staff, services, templates, roles, or the manual client-notes hard-delete in `admin/clients/actions.ts` discussed above. Section 6's wording ("Our policy is to keep... for 7 years...") states a policy, not an automated technical guarantee, and does not claim code enforcement it doesn't have. No finding — consistent with "manually enforced."

---

## Summary of findings

| # | Severity | Claim |
|---|---|---|
| A | BLOCKING | "What we collect" omits the required, distinct "City / Town" field that the booking form actually collects (`AboutYouStep.tsx:497-509`, schema `route.ts:38`). |
| B | BLOCKING | "What we collect" scopes gender/name collection to "anyone else included," but the code also collects the primary booker's own gender ("Your gender", `AboutYouStep.tsx:296-301`) when they book for themselves. |
| C | NON-BLOCKING | Sentry's `beforeSend` scrubber (`sentry-scrubbing.ts`) does not key-match `notes`/`participantNotes`/gender fields, and its content-pattern redaction only catches structured PII (email/postcode/phone/token), not free-text health prose — a real coverage gap relative to the page's blanket "personal information is scrubbed" claim, though no current code path was found that actually routes booking-note content to Sentry. |

All other checked claims (processors present, GA fail-closed consent gate, `/cookies/` link validity, contact details sourced from the shared constant, no promised self-service rights mechanism, no automated retention job) were verified against the code and found accurate.

## Checks not run
- Did not run the app or exercise the booking form end-to-end (no build/dev-server restart permitted; relied on static code reading of the schema and form components).
- Did not audit every historical Sentry event in the live project for actual leaked content — assessed only the scrubbing code's coverage and the call sites that could route data to it.
