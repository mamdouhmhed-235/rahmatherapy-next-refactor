# C-18 pre-flight #4 — cookie / client-storage inventory (SOURCE-DERIVED)

**Scope:** static read of `src/**` (plus the repo-root Sentry config files and the installed
`@sentry-internal/replay` / `@supabase/ssr` packages, since both are configured *from* source and
write storage the registry must account for). **No dev server was run, no browser was opened, no
production site was checked.** Every line below was produced by reading source files and grepping
text — nothing here is a live/DevTools observation. Repo `master` @ `70e21034d90a89f7584f797a528ad6840197b997`.

**Headline count: 12 distinct client-side storage mechanisms found — 5 reach an anonymous public/
booking visitor (the C-18 registry's actual scope), 7 are staff-only inside the authenticated
`/admin` tree (enumerated for the "per route group" requirement, out of scope for the public
consent banner).**

One of the 5 visitor-facing items — **Sentry Session Replay's `sentryReplaySession` sessionStorage
key** — is **not in the plan's or brief's expected list** and is mounted at the **ROOT layout**, so
it reaches `/booking/manage` too. This is the pre-flight's most consequential finding; see §3 and
§5.

---

## 1 — Visitor-facing inventory (feeds the C-18 registry)

| Name / key | Type | Set by (`file:line`) | When set | Purpose | Duration | PII-adjacent? | Proposed classification |
|---|---|---|---|---|---|---|---|
| `zam-therapy-booking-draft-v3` | localStorage (zustand `persist`, `createJSONStorage(() => localStorage)`) | `src/features/booking/store/booking-store.ts:75-76` (persist config); writes triggered by `togglePackage`/`setSelectedPackageIds`/`clearPackages` at `:43-64`; only `selectedPackageIds` is persisted (`partialize`, `:77-79`) | Any package-selection interaction inside the booking dialog (`PackageSelectionStep`), which only mounts via `BookingExperienceLoader` inside `src/app/(public)/layout.tsx:29` | Remembers which service package(s) a visitor picked so closing/reopening the booking dialog, or an accidental reload, doesn't lose the in-progress selection | No expiry set by the persist middleware — survives indefinitely until `resetDraft()` clears it or the user clears browser storage | No — persists package IDs only (e.g. `"cupping-full-back"`), never health notes, contact details, or participant data (deliberate — see `returning-customer.ts:4-6` comment for the sibling file's explicit statement of this design intent, which this store's `partialize` also honours) | **Essential** (reasoning §2) |
| `rahma-booking-contact-v1` | localStorage | `src/features/booking/utils/returning-customer.ts:7,39` (write in `saveReturningCustomer`); read in `loadReturningCustomer:45-72`; cleared in `clearReturningCustomer:74-80` | **Write:** on successful booking submission — `BookingExperience.tsx:494` (`saveReturningCustomer(values...)` right after `submitBookingRequest` resolves). **Read:** once per booking-dialog session, only while the form is still pristine — `BookingExperience.tsx:277-301`. **Clear:** user-triggered "clear prefill" action — `BookingExperience.tsx:303-304` — or auto-expiry on next read past 180 days (`returning-customer.ts:56-57`) | Pre-fills contact + address fields for a *returning* customer's *next* booking so they don't retype them | 180 days (`MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000`, `returning-customer.ts:8`), self-expiring on next read | **Yes — directly.** Stores `fullName`, `phone`, `email`, `clientGender`, `city`, `area`, `postcode`, `address`, `accessNotes`, `parkingNotes` (`returning-customer.ts:10-22`) | **Contested — my view is NOT essential.** See §2 for full reasoning; this is the classification decision that most needs explicit Owner sign-off before Phase A locks the registry. |
| `_ga` / `_ga_*` | Cookie (set by Google's externally-loaded `gtag.js`, not by this repo's code) | Loaded by `src/components/GoogleAnalytics.tsx:9-12` (`<Script src="https://www.googletagmanager.com/gtag/js?id=...">`), gated `if (!GA_ID \|\| process.env.NODE_ENV !== "production") return null;` (`:6`); mounted `src/app/(public)/layout.tsx:32` | Every page load under `(public)/layout.tsx`, in production, only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set at build time | Google Analytics 4 visit/session tracking | Not settable from this repo — Google's default `gtag.js` behaviour applies (commonly documented as ~13 months for `_ga`/`_ga_*`; **not verified here**, see §4) | Pseudonymous client/session identifiers — analytics tracking data, not name/contact PII | **Analytics** (matches the plan's existing classification — no correction) |
| `maintenance-modal-seen` | sessionStorage | `src/components/shared/MaintenanceModal.tsx:14` (`SESSION_KEY`), write `:20-21` | Only when `MaintenanceModal` mounts, which is gated `{MAINTENANCE_MODE && <MaintenanceModal />}` in `src/app/(public)/layout.tsx:30`. **`MAINTENANCE_MODE` is currently `false`** (`src/lib/maintenance.ts:2`, read-only check — not modified), so **this key is not being written on any live page right now** | Shows the "site not ready" interstitial once per browser session instead of on every page | Session (cleared when the tab/browser session ends) | No — stores the literal string `"1"` | **Essential** (a "don't show this dialog again this session" flag, functionally a dismiss-state — standard strictly-necessary pattern) — currently dormant, register anyway since flipping the flag needs no C-18 involvement |
| `sentryReplaySession` | sessionStorage — **not in the plan's/brief's expected list** | Written by `@sentry-internal/replay` (installed at `node_modules/.pnpm/@sentry-internal+replay@10.51.0/node_modules/@sentry-internal/replay/build/npm/esm/index.js`; key constant `REPLAY_SESSION_KEY = 'sentryReplaySession'` at `:10`, write at `:6110`). Configured by `sentry.client.config.ts:1-15` (`Sentry.init({ replaysSessionSampleRate: 0.1, replaysOnErrorSampleRate: 1.0, integrations: [Sentry.replayIntegration()] })`), loaded by `src/components/SentryProvider.tsx:6` (`import("../../sentry.client.config")` in a `useEffect`), mounted by `src/app/layout.tsx:68` — **the ROOT layout, not `(public)`** | On client mount of every page in the app — root layout wraps `(public)`, `admin`, **and `/booking/manage`** (no narrower mount point exists) | Sentry Session Replay — records (masked) user interaction for the site operator's error-monitoring/debugging use, not for anything the visitor asked for | Session (sessionStorage) | Not directly (masked recording by Sentry's privacy-first defaults — text/inputs masked, media blocked, unless overridden; not overridden here), but it is *behavioural recording*, a materially different privacy posture than a plain flag | **Not essential, my view — needs an Owner decision.** This is a correction to the plan's premise, not a straightforward classification. See §3 and §5. |

## 2 — Essential-classification reasoning (per the task's instruction: state the specific user-requested function, don't default)

**`zam-therapy-booking-draft-v3` — essential.** The function it enables is exactly the one the
visitor invoked: filling out a multi-step booking form. Losing the in-progress package selection
on an accidental reload or a closed-then-reopened dialog would break that in-progress task. It
persists only the selection itself (package IDs), not identity or health data — the persisted
shape is `{ selectedPackageIds }` only, enforced by `partialize` at `booking-store.ts:77-79`. This
is the same category as an e-commerce cart cookie, which PECR/ICO guidance treats as strictly
necessary. One caveat worth flagging to the Owner: it has no expiry and is written to `localStorage`
rather than `sessionStorage`, so a "necessary for this visit" justification is a slightly generous
read of "necessary" once the visit is long over — still defensible, but worth a conscious decision
rather than an assumption.

**`rahma-booking-contact-v1` — contested, my view is NOT essential.** The function it enables is
pre-filling the contact/address fields on a *future* visit. Nothing about *completing the current
booking* depends on it — the code comment at `returning-customer.ts:4-6` itself frames this as
"nothing sensitive should sit in browser storage" (true for health data) but that framing doesn't
make the stored data non-personal: full name, phone, email, and home address is squarely personal
data, stored on the system's own initiative the moment a booking succeeds, for up to 180 days,
without the visitor being asked. This is the same shape as a "remember me" convenience cookie,
which ICO guidance treats as requiring consent precisely because it improves the experience *across
visits* rather than serving the visit in progress. I'd classify this as a non-essential, consent-
gated item — but the registry's current `CookiePurpose` type (brief §2.1) only has `"essential" |
"analytics"`, and this item is neither in the ordinary sense (it isn't tracking). The brief's own
plan text may need a third purpose bucket (e.g. `"functional"`/`"preferences"`) for this single
item, or the Owner may decide the convenience is worth classifying essential anyway — either way,
this should be a recorded decision, not a default.

**`maintenance-modal-seen` — essential (when active).** A one-time-per-session dismiss flag with no
personal data, gating a single interstitial. Standard strictly-necessary UX pattern. Currently
inert because `MAINTENANCE_MODE = false`.

**`_ga` / `_ga_*` — analytics**, matching the plan's own classification; no correction offered here.

**`sentryReplaySession` — not essential, my view, but genuinely undecided.** The function it serves
is the *site operator's* error-monitoring and QA workflow, not a function the visitor asked for or
that booking/browsing depends on. ICO guidance's "strictly necessary to deliver the service the
user requested" test is the same test that makes analytics non-essential, and Session Replay fails
it for the same reason analytics does — arguably more so, since it captures behavioural recording
rather than aggregate counts. It was not in the plan's or brief's expected inventory at all. I'm not
picking a side on whether to keep Replay running — that's an Owner call — but the registry cannot
be complete without a decision here, and the decision changes the answer to the `/booking/manage`
question in §3 below.

## 3 — `/booking/manage?token=…` — precise answer

**Layout chain:** `src/app/booking/manage/page.tsx` is a plain route under `src/app/booking/` — it
is outside the `(public)` route group, and `src/app/booking/layout.tsx` does not exist on `master`
(`Glob` of `src/app/booking/**`: only `manage/ManageBookingForms.tsx`, `manage/actions.ts`,
`manage/page.tsx`, `__tests__/no-google-analytics.test.ts` — confirmed, matches the task context
that C-17's leak fix deleted the booking layout). So `/booking/manage` renders under the **ROOT
layout only** (`src/app/layout.tsx:60-73`), which mounts `<SentryProvider />` and nothing else
storage-relevant.

**What it does NOT receive:**
- **No GA / `_ga` cookies** — `GoogleAnalytics` is only imported and mounted in `(public)/layout.tsx:32`; a dedicated regression test (`src/app/booking/__tests__/no-google-analytics.test.ts`) asserts no file under `src/app/booking/` ever imports `GoogleAnalytics`, specifically because the manage token is a bearer credential in the URL query string and GA4's `page_location` would exfiltrate it.
- **No `zam-therapy-booking-draft-v3` / `rahma-booking-contact-v1`** — both only run inside `BookingExperience`, which is only reachable via `BookingExperienceLoader`, which is only mounted in `(public)/layout.tsx:29`. `/booking/manage/page.tsx` and `ManageBookingForms.tsx` (read in full) contain zero storage code.
- **No Supabase auth cookies.** `booking/manage/actions.ts` and `src/lib/booking/customer-manage.ts` use only `createSupabaseAdminClient()` (`src/lib/supabase/admin.ts:11-27`) — service-role key, `persistSession: false`, `autoRefreshToken: false`, and critically **no `cookies()` import from `next/headers` anywhere in that call chain**. `createSupabaseServerClient()` (the only function in this repo that reads/writes cookies via `cookies()`, `src/lib/supabase/server.ts:12,26-40`) is called exclusively from `src/app/admin/**` (grepped every call site — 100+ hits, all under `src/app/admin/`). The middleware that refreshes Supabase session cookies (`src/middleware.ts`) has `matcher: ["/admin/:path*"]` (`:74`) — it never runs on `/booking/manage`.
- No `SiteFooter`, no `SiteHeader`, no `MaintenanceModal`.

**What it DOES receive:** the Sentry Session Replay `sentryReplaySession` sessionStorage write
described in §1, because `SentryProvider` is mounted unconditionally at the root layout with no
route exclusion. This is the one item standing between "/booking/manage receives nothing beyond
strictly-essential" and the actual answer.

**So the plain statement the brief asked for:** `/booking/manage` receives **no cookies and no
localStorage at all** — the honest, best-case reading. But it is **not** the case that it receives
"nothing beyond strictly-essential" full stop, because it does receive Sentry Replay's sessionStorage
write, and that item's essential-vs-not classification is unresolved (§2). If the Owner decides
Replay is essential (defensible: session-scoped, masked, no cookies, operator-only), the original
"nothing to consent to on this route" conclusion holds and no consent UI is needed on
`/booking/manage`. If the Owner decides Replay is non-essential like GA, then `/booking/manage`
does have something to consent to, which the plan's Phase F assumption ("mounts the banner
component" is a `(public)`/`booking-layout` concern, not a root-layout one) does not currently
cover — the root layout is DO-NOT-TOUCH, so gating Replay itself (not adding UI there) would be the
only lever available on that route.

## 4 — Third-party scripts

Only one external script exists anywhere in the codebase: Google's `gtag.js`, loaded conditionally
by `src/components/GoogleAnalytics.tsx:9-12`, confirmed env-gated (`NEXT_PUBLIC_GA_MEASUREMENT_ID`)
and production-only (`process.env.NODE_ENV !== "production"` early-return, `:6`). A repo-wide grep
for `next/script` and literal `<script` tags found no other hits outside: `GoogleAnalytics.tsx`
itself, its test file, and JSON-LD `<script type="application/ld+json">` structured-data blocks on
several `(public)` pages (e.g. `src/app/(public)/services/page.tsx:35-37`) — those are inert data
blocks (`dangerouslySetInnerHTML` of a JSON string), not executable, and set no storage.

No `document.cookie` read/write exists anywhere in `src/**` (repo-wide grep, zero matches). No
`indexedDB`, `caches.open`, or `serviceWorker` reference exists anywhere in `src/**` (repo-wide
grep, zero matches) — the only IndexedDB-capable code path found anywhere is inside the Sentry
Replay dependency, and that package does not use IndexedDB (checked; it uses sessionStorage only,
key `sentryReplaySession`, per §1).

`@tanstack/react-query` is installed but no persistence plugin
(`@tanstack/react-query-persist-client` or similar) is in `package.json` — React Query's cache is
in-memory only, no storage adapter configured.

## 5 — Staff-only inventory (`/admin/**`, out of scope for the public consent banner)

All items below are behind `src/middleware.ts` (`matcher: ["/admin/:path*"]`), which requires a
valid Supabase session and an active `staff_profiles` row (`:40-68`) before any admin page renders.
None of these reach an anonymous public or booking visitor. Listed per the task's "per route group"
instruction, not as C-18 registry candidates — an internal tool session for an authenticated
employee is conventionally outside PECR's visitor-consent scope, and the plan's own DO-NOT-TOUCH
list already excludes the admin tree.

| Name / key | Type | Set by (`file:line`) | Purpose |
|---|---|---|---|
| `sb-<project-ref>-auth-token` (default `@supabase/ssr` naming; exact chunked form not enumerated) | Cookie | `src/lib/supabase/server.ts:12,26-40` via `createSupabaseServerClient()` (called from `src/app/admin/layout.tsx:16` and 100+ admin pages/actions); refreshed by `src/middleware.ts:19-38`; also settable client-side via `createSupabaseBrowserClient()` (`src/lib/supabase/client.ts:8-13`), used only in `src/app/admin/components/use-notification-state.ts:46` | Staff authentication session. `@supabase/ssr` default cookie options: `path: "/"`, `sameSite: "lax"`, `httpOnly: false`, `maxAge: 400 days` (`node_modules/.pnpm/@supabase+ssr@0.10.2.../utils/constants.js`) |
| `rahma-admin-theme` | localStorage | `src/app/admin/components/ThemeProvider.tsx:40` (key), write `:97` | Staff dark/light/system UI theme preference |
| `rahma:enquiries:lastFilters` | localStorage | `src/app/admin/enquiries/EnquiryFilterPersistence.tsx:7` (key), write `:48`, read `:53` | Staff enquiries-list filter persistence |
| `rahma.admin.bookings.saved-views.v1` (legacy, purged) + per-staff `storageKeyFor(staffId)` | localStorage | `src/app/admin/bookings/BookingsChrome.tsx:80,99,144,149,168` | Staff-scoped saved views for the bookings list |
| `rahmatherapy-business-overview-expanded-{staffId}` (+ `coordinator-`/`therapist-week-` variants) | localStorage | `src/app/admin/dashboard/dashboard-filters-client.tsx:635,661,671,690`; cleanup helper `src/app/admin/dashboard/dashboard-helpers-b5.ts:350-360`; mount-time trigger `src/app/admin/dashboard/LegacyDisclosureCleanup.tsx` | Staff dashboard disclosure (expand/collapse) UI state |
| `rahmatherapy-notification-read-{staffId}` / `rahmatherapy-notification-dismissed-{staffId}` / `rahmatherapy-notification-state-migrated-v1` | localStorage | `src/app/admin/components/notification-bell.tsx:171,175-177,194,198` | Legacy notification read/dismiss state, one-time-migrated server-side by `src/app/admin/components/notification-state-actions.ts` |
| Manual-booking draft (`draftKey`, source-scoped) + `CREATED_KEY`/`CREATED_TOAST_KEY`/`DRAFT_KEY` | sessionStorage | `src/app/admin/bookings/new/ManualBookingForm.tsx:704-706,812,836-838,973-977`; consumed by `src/app/admin/bookings/[bookingId]/BookingCreatedToast.tsx:52-56` | Staff in-progress manual-booking form draft, scoped per source tab so two enquiry conversions in two tabs don't clobber each other |

`src/app/admin/emails/templates/components/TemplateEditor.tsx` matched an earlier grep for
`localStorage` but on inspection (`:205-208`) it is a comment stating the editor **deliberately does
not** persist to storage — a false positive, not a real item.

## 6 — Needs browser/production confirmation (source reading cannot resolve these)

1. **Is `NEXT_PUBLIC_GA_MEASUREMENT_ID` actually set in the current Cloudflare production build?**
   `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md:33` lists setting it as still-outstanding
   Owner action as of that doc's last edit; that doc may be stale by now. Only a live check (or the
   Owner confirming directly) settles whether `_ga`/`_ga_*` are actually being written today.
2. **Is `NEXT_PUBLIC_SENTRY_DSN` actually set in the current Cloudflare production build, and does
   it apply to the client bundle specifically?** `redesign/FOUNDATION-FLOOR.md:40` documents it as
   "Outstanding — must be set in Cloudflare runtime env at deploy." A separate smoke test
   (`redesign/backend-smoke-tests/sentry-roundtrip-2026-05-20.txt`) shows a passing **server-side**
   roundtrip in an earlier session, which does not prove the client-side (`NEXT_PUBLIC_*`, inlined
   at build time) path is wired. This is the single most important open question — it determines
   whether `sentryReplaySession` is actually being written on any route today, including
   `/booking/manage`.
3. **Does Sentry Replay write `sentryReplaySession` on every page load, or only for the sampled
   fraction?** Source shows the mechanism and key name but not the exact trigger timing across
   `replaysSessionSampleRate: 0.1` (session mode) vs `replaysOnErrorSampleRate: 1.0` (buffer mode,
   which may write the session-tracking entry immediately or defer it until an error fires). A live
   Application-tab check on a public page and on `/booking/manage`, both with a cleared
   sessionStorage, is the only way to confirm.
4. **Does Google's `gtag.js` set anything beyond `_ga`/`_ga_*`** (e.g. `_gid`, an Ads-linked
   `_gac_*`, or any Topics/FLoC-adjacent storage), **and what are its actual `Expires`/`SameSite`
   attributes on this domain?** This script is loaded from `googletagmanager.com` at runtime and is
   not part of this repo — nothing in source constrains its cookie behaviour beyond the absence of a
   `cookie_expires` override (so Google's own defaults apply, unverified here).
5. **Does the Cloudflare edge/CDN layer itself set any platform cookie** (e.g. a bot-management or
   WAF cookie) **on any route?** These would be set by the hosting platform, not by anything in
   `src/**`, and are invisible to a source read.
6. **Is there any dynamically-constructed storage key, or an emitted service-worker/manifest file
   from the OpenNext-Cloudflare build pipeline, that a text grep of source wouldn't surface?** A
   live Application-tab sweep (Local Storage / Session Storage / IndexedDB / Cache Storage) across
   home, a service page, an open booking dialog through Confirm, and `/booking/manage?token=…` is
   the only way to close this gap with certainty.
7. **Is `MAINTENANCE_MODE` still `false` at the moment the registry is finalized?** Source shows
   `false` as of this read (`src/lib/maintenance.ts:2`) — it is a one-line, non-C-18 change that
   could flip independently and reactivate `maintenance-modal-seen`.

---

*Source-derived inventory only. No dev server, browser, or production site was accessed to produce
this document — every claim above traces to a specific file or package path cited inline. Items in
§6 are exactly the ones the Owner's dev-server / production pass should check.*
