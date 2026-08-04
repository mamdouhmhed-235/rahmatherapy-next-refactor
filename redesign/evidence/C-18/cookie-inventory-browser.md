# C-18 pre-flight #4 — cookie / client-storage inventory (BROWSER-DERIVED)

**Scope:** live observation only, via Playwright MCP against the Owner's warm `pnpm dev` server
at `http://localhost:3000` (`localhost`, never `127.0.0.1`). Repo `master` @ `2cb2949`. This
document settles what the source-derived pass (`redesign/evidence/C-18/cookie-inventory-source.md`,
repo @ `70e2103`) could not resolve from static reading alone. No source edits were made; the only
write is this file. `src/lib/maintenance.ts` was read-only checked, never modified. No server was
started or stopped.

The browser profile used by this Playwright MCP session had **leftover storage from an earlier,
unrelated session** on first inspection (`rahmatherapy-notification-state-migrated-v1` — a
staff/admin-only key already catalogued in the source doc's §5 — plus a stray
`zam-therapy-booking-draft-v3`). This was cleared (`localStorage.clear()`, `sessionStorage.clear()`,
all cookies expired) before any checkpoint below was recorded, to guarantee genuine first-visit
behaviour. Noted here for transparency, not as a finding — it is not a newly-discovered mechanism,
just contamination from prior use of the same browser context.

---

## 1 — Per-checkpoint observed state

| # | Checkpoint | Nav type | Cookies | localStorage | sessionStorage |
|---|---|---|---|---|---|
| 1 | `/home/`, clean state | full load (post-clear) | none | empty | `sentryReplaySession` — `{id,started,lastActivity,segmentId,sampled,dirty}`, `sampled:"buffer"` |
| 2 | `/services/`, via in-app link click | **client-side nav** (`getByRole('link').click()`, confirmed not a `goto`) | none | empty | `sentryReplaySession` (same session, carried over) |
| 3a | Booking dialog, step 1 → package selected | client-side (dialog state) | none | `zam-therapy-booking-draft-v3` = `{"state":{"selectedPackageIds":["hijama-package"]},"version":0}` | `sentryReplaySession` |
| 3b | Booking dialog, step 2 (About you), mid-fill, pre-submit | client-side | none | unchanged (still only the package-id draft) | unchanged |
| 3c | Booking dialog, step 4 (Confirm), **not submitted** | client-side | none | unchanged | unchanged |
| 4a | `/booking/manage?token=invalid-test-token`, arrived via full nav from a tab with an active Replay session | full load | none | empty (booking draft was cleared before this leg) | `sentryReplaySession` present but **stale/frozen** — see §3 |
| 4b | `/booking/manage?token=invalid-test-token`, **fresh tab, first-ever load, storage cleared beforehand** | full load, cold start | **none** | **empty (0 keys)** | **empty (0 keys)** |
| 5 | `/home/` re-visit after all of the above | full load | none | empty | fresh `sentryReplaySession` (new session — expected, new page load in a context where storage had been cleared before the manage-route tests) |

Checkpoint 3 detail: the booking dialog was walked Service → About you → Time → Confirm using
fake data (name `C18 Browser Test`, phone `07700000000`, email `c18-browser-test@example.test`,
address `1 Example Test Street, Luton, Bedfordshire, LU1 1AA`). The dialog was closed via its
"Close booking form" button at step 4 without touching any submit/confirm control. No booking was
created; no email was sent.

Also checked at checkpoint 5 (`/home/`): `indexedDB.databases()` → `[]`, `caches.keys()` → `[]`,
`navigator.serviceWorker.getRegistrations()` → `[]`. No IndexedDB, Cache Storage, or Service
Worker activity on the dev server.

Also checked: response headers for `/home/` and for the Sentry tunnel's `/monitoring` POST (see §3)
— **no `Set-Cookie` header on either**, so nothing HttpOnly is being set that `document.cookie`
would have hidden from the earlier checks.

`.env` (key presence only, values not read/printed): `NEXT_PUBLIC_SENTRY_DSN` is **present with a
non-empty value**. `NEXT_PUBLIC_GA_MEASUREMENT_ID` is **absent** from the local `.env`.

---

## 2 — Source inventory: confirmed / corrected / newly discovered

**Confirmed exactly as described:**
- `zam-therapy-booking-draft-v3` — localStorage, written only on package-selection interaction,
  persisted shape is exactly `{selectedPackageIds: [...]}` (verified raw value — package IDs only,
  no PII, matches the `partialize` claim), survives dialog close, no expiry observed.
- `rahma-booking-contact-v1` — **not written at any point I observed**, including mid-form with
  every contact/address field filled in at step 2 and again at the unsubmitted step-4 Confirm
  screen. This is consistent with the source doc's claim that it writes only on a *successful*
  submission (`BookingExperience.tsx:494`, after `submitBookingRequest` resolves) — I did not
  submit, per instructions, so I cannot directly observe the write itself, only confirm it does
  **not** fire prematurely.
- `maintenance-modal-seen` — never appeared at any checkpoint, consistent with `MAINTENANCE_MODE`
  still reading `false` (`src/lib/maintenance.ts:2`, read-only check, unmodified, still false as of
  this pass — settles source open item §6.7).
- No `document.cookie` value was ever non-empty at any checkpoint — consistent with the source
  doc's repo-wide grep finding zero `document.cookie` read/write sites in `src/**`.
- No IndexedDB, Cache Storage, or Service Worker activity — consistent with source's grep finding
  no such references in `src/**` (settles source open item §6.6, for the dev server at least — see
  §4 below for the production-build caveat).

**Corrected / refined relative to the source doc's framing:**
- The source doc left `sentryReplaySession`'s trigger timing as an open question (§6.3: "does it
  write on every page load, or only for the sampled fraction?"). **Answer: every page load,
  immediately, regardless of the 10% session-sample outcome.** Two separate fresh page loads were
  observed: one landed in `sampled:"buffer"` mode (the 90% case — `replaysOnErrorSampleRate: 1.0`),
  the other in `sampled:"session"` mode (the 10% case). Both wrote the `sentryReplaySession` key to
  sessionStorage immediately on mount, before any user interaction and before any error occurred.
  So the sessionStorage write itself is unconditional on every page load once the DSN is
  configured — only the *content* (full recording vs. error-triggered buffering) depends on the
  sample outcome.
- The source doc's §3 conclusion — that `/booking/manage` "receives the Sentry Session Replay
  sessionStorage write... because SentryProvider is mounted unconditionally at the root layout with
  no route exclusion" — describes the **pre-fix** state. It explicitly flagged commit `09b2e26` as
  "just-landed." That commit **is now on `master`** (confirmed: `git log` shows `09b2e26` as the
  direct parent of HEAD `2cb2949`), and browser observation confirms the fix works: see §3 below for
  the precise, current answer, which supersedes the source doc's §3 on this point.

**Newly discovered, not in the source inventory:**
- Nothing new was found in storage. The one genuinely new observation is not a storage item but a
  network one: Sentry ships events through a same-origin tunnel route, `POST /monitoring?o=...&p=...`
  (a 308 redirect to `/monitoring/` then 200), which is Next.js's standard `tunnelRoute` pattern for
  bypassing ad-blockers. This confirms the DSN is live and functioning end-to-end in this dev
  environment (events are actually being accepted by Sentry's ingest, `server: nginx`,
  `via: 1.1 google`), which corroborates the `.env` key-presence check. It sets no cookies (checked
  its response headers directly — no `Set-Cookie`) and is not a storage mechanism, so it does not
  become a registry entry, but it is worth the Owner knowing it exists on every page as a network
  side-effect of the DSN being configured.

---

## 3 — `/booking/manage?token=…` — precise, current answer

Two distinct scenarios were tested, because they give different answers and the source doc's
static read couldn't distinguish them:

**Scenario A — fresh landing (the realistic case: a customer clicking their booking-management
link from a confirmation email, in a browser tab with no prior storage).** Storage was fully
cleared, then `/booking/manage?token=invalid-test-token` was loaded as the very first page. Result:
**zero cookies, zero localStorage keys, zero sessionStorage keys.** `sentryReplaySession` is not
created at all. This is the clean confirmation the source doc's §3 could not give with certainty:
`09b2e26`'s fix works as designed — `Sentry.init`'s `integrations` array is empty
(`sentry.client.config.ts:46`), so nothing ever calls `Sentry.replayIntegration()` on this route,
and `syncSessionReplay()`'s early-return for a blocked path (`sentry.client.config.ts:84-92`) means
`Sentry.getReplay()` is `undefined` there and nothing is started.

**Scenario B — same-tab arrival from a page where Replay had already started (e.g. a visitor who
browsed the public site first, then in the same tab typed or pasted the manage-link URL and hit
enter — a full page navigation, not a client-side one).** Here a **stale, frozen
`sentryReplaySession` entry persists** into `/booking/manage`, carried over because sessionStorage
is scoped to the browser tab, not to the document. Its `segmentId` counter was observed to
increment by exactly one at the moment of navigating away from the prior page, then verified to
stay completely unchanged (`lastActivity` frozen, `segmentId` frozen) over 3+ further seconds spent
sitting on `/booking/manage`. This is best explained by the Replay SDK's own built-in
pagehide/unload flush on the *old* page finishing its write to the shared sessionStorage bucket
during the navigation handoff — not by anything active running on the new document. I could not
instrument the exact internal trigger without modifying source (out of scope for a read-only pass),
but the behavioural evidence is unambiguous: nothing writes to this key again after the page has
settled on `/booking/manage`, and `Scenario A` proves the mechanism never *initiates* there.

**So the honest, current statement for the registry:** a booking-management link opened the way
customers actually receive it — a fresh click from an email, a fresh tab — delivers **no cookies
and no client-side storage whatsoever.** The only residue possible is a frozen leftover
sessionStorage entry from a *prior* page in the same tab, which is inert on this route (no further
writes, and per the source doc's own analysis, masked/non-PII in content even when active). This
fully resolves the source doc's most consequential open question: **`/booking/manage` needs no
consent UI** — there is nothing on that route for a fresh visitor to consent to, and the fix already
prevents Replay from ever starting there. The Owner does not need to make the
essential-vs-non-essential call for Replay on this specific route; it only matters for the
`(public)` route group, where Replay does run (see §2).

---

## 4 — What remains observable only in production

Per the task's explicit instruction, the following are **not** evidenced as absent — they are
architecturally unobservable from a local dev server, and their absence here must not be read as
"confirmed not present":

- **`_ga` / `_ga_*` cookies.** `GoogleAnalytics.tsx` is gated `production` + env-var
  (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, confirmed absent from local `.env`), so `gtag.js` never loads on
  this dev server. Their absence in every checkpoint above is expected and correct, not evidence
  they don't exist in production. Source doc's open items §6.1 and §6.4 (whether the env var is set
  in the Cloudflare production build, and what exact cookies/attributes `gtag.js` sets on this
  domain) remain outstanding — only a production check settles them.
- **Cloudflare platform cookies** (e.g. `__cf*`, bot-management/WAF cookies). These are set by the
  production edge, not by the local dev server (which isn't behind Cloudflare at all). Source doc's
  open item §6.5 remains outstanding — only a production check settles it.
- **Whether `NEXT_PUBLIC_SENTRY_DSN` is set in the actual Cloudflare production runtime env**
  (source doc's open item §6.2). This pass confirms the DSN key is present in the **local** `.env`
  and that the client-side wiring works correctly when it is present (Sentry initialises, tunnels
  events, writes `sentryReplaySession` on every page per §2/§3 above) — but that only proves the
  mechanism works when configured, not that Cloudflare's production environment actually has the
  variable set. That remains an Owner/production-config question this pass cannot reach.
- **OpenNext-Cloudflare build-specific storage** (service worker, cache manifest, or any storage
  emitted by the Cloudflare adapter's build pipeline rather than by application source). The plain
  `pnpm dev` server used here is not an OpenNext-Cloudflare build, so a clean
  Service-Worker/Cache-Storage/IndexedDB sweep here (all empty, §1) says nothing about what an
  actual `opennextjs-cloudflare build` output might add. Source doc's open item §6.6 is only
  partially addressed — the *application-code* half is settled (no explicit storage code found by
  source grep, none observed live), the *build-pipeline* half needs a check against a real
  Cloudflare deploy or preview build, which this pass had no access to and was not asked to produce.

---

*Browser-derived confirmation only, against the local `pnpm dev` server the Owner had running.
Repo `master` @ `2cb2949`. No source files were modified. No server was started or stopped. The
booking flow was walked to the Confirm step and closed without submitting; no booking was created,
no email was sent, no real personal data was entered anywhere.*
