VERDICT: FAIL

# C-17 Phase A verification — commit `05f251e` (tier FULL)

Verifier: read-only subagent. Repo `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`, branch `master`, HEAD `05f251e`. `src/lib/maintenance.ts` not touched (confirmed standing `MAINTENANCE_MODE = false` uncommitted diff still present, untouched by me). All git commands used were `log`/`diff`/`show`/`status`; no `checkout`/`stash`/`switch`/`restore` run. No files written other than this one.

---

## CHECK 1 — the gate is the feature (adversarial read) — **BLOCKING FINDING**

**The gate logic itself is sound and does what it claims.** `src/components/GoogleAnalytics.tsx:3-6`:

```ts
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export function GoogleAnalytics() {
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
```

- The early return is genuinely before any JSX is constructed — no `<Script>`, preload, or `dataLayer` reference can be emitted on a code path where the `if` is true. There is no second code path.
- **Dead-branch question, answered by direct build inspection, not inference.** I ran `pnpm build` (Next 16.2.4, Turbopack) with `NEXT_PUBLIC_GA_MEASUREMENT_ID` **unset**, then `pnpm start` and curled `/`, `/services`, `/booking/manage`, `/admin/login` — zero occurrences of `googletagmanager`, `gtag`, or `dataLayer` in any response HTML. I then grepped the **compiled client JS** in `.next/static` for `ga-init` / `googletagmanager` — **zero matches** (`grep -rl "ga-init|googletagmanager" .next/static` → 0 files). This is stronger than "gated at runtime": when the var is absent at build time, `GA_ID` becomes a compile-time-constant `undefined`, `NEXT_PUBLIC_*` inlining makes the `if` unconditionally true, and the dead branch is eliminated — it does not ship to the client as inert/flippable code. There is no way to "turn it on" without a new build.
- **Mount-surface / import-graph trace.** `grep -rn "GoogleAnalytics" src/app/admin/` → empty (verified directly). Traced the graph, not just one directory: `src/app/admin/layout.tsx` (read in full) imports `AdminTopNav`, `AdminAccessDenied`, `resolveAdminShellVariant`, `getNavNotifications`, `ThemeProvider` — none of which touch `(public)/layout.tsx` or `src/app/booking/layout.tsx`. `src/app/layout.tsx` (root, untouched — confirmed by `git show 05f251e --stat` not listing it) imports only `SentryProvider` and font loaders. Next.js App Router segment layouts don't cross route-group/segment boundaries implicitly — `/admin/**` renders through root → `admin/layout.tsx` only; it never passes through `(public)/layout.tsx` or `booking/layout.tsx`. Full repo grep for `GoogleAnalytics` (`grep -rn "GoogleAnalytics" src`) returns exactly the 4 files in the commit's own diff (component, its test, the two mount layouts) — nothing else references it, so there is no transitive leak path. **Admin isolation holds.**

### `/booking/manage` token leak — this is the blocking finding

`/booking/manage` is reached via a tokenised link and the token is a **bearer-style access credential passed as a URL query parameter**, not an opaque page identifier:

- `src/app/booking/manage/page.tsx:17-19,46`: `searchParams: Promise<{ token?: string }>` → `const { token = "" } = await searchParams;`
- `src/lib/booking/customer-manage.ts:267-286`: the raw token is hashed (`getManageTokenHash`) and matched against `manage_token_hash` in the database with an expiry check (`manage_token_expires_at`) — i.e., it is exactly the credential that authorizes viewing/rescheduling/cancelling a specific real customer's booking, no login required.
- The codebase **already treats this exact field as sensitive**: `src/lib/observability/sentry-scrubbing.ts` redacts long tokens (`LONG_TOKEN_PATTERN`, line 49) before anything reaches Sentry, and `src/lib/observability/sentry-scrubbing.test.ts:22,37` has a dedicated test case scrubbing a field literally named `manage_token` to `"[Filtered]"`. The team has independently established that this token must never leave the browser toward a third party unredacted.
- `GoogleAnalytics` is mounted in `src/app/booking/layout.tsx` and wraps `{children}` — i.e., it mounts on the exact same page that renders with `?token=<value>` in the URL. GA4's `gtag('config', ...)` call (`GoogleAnalytics.tsx:21`, no `page_location` override) uses the **default `page_location` field, which is `window.location.href`, including the query string**. There is nothing in this component, `ManageBookingForms.tsx`, or the page itself that strips or overrides `page_location` before GA's config call fires.

**Concrete failure scenario:** a customer opens their manage-booking email link (`https://rahmatherapy.co.uk/booking/manage?token=<their-bearer-token>`) in a production build. `GoogleAnalytics` mounts, `gtag('config','G-...')` fires with the ambient `page_location` = the full URL including `token=...`. That token — the same string the codebase's own Sentry scrubbing treats as too sensitive to log — is now stored in Google's GA4 property (visible to anyone with GA access to that property, e.g. `page_location` reports, URL query parameter reports) and transmitted to Google's collection endpoint as a URL parameter. Anyone who can read that GA property (or intercepts the request before Google's TLS termination is irrelevant — the concern is server-side retention in GA, not transit) can reconstruct the live manage-booking link for that customer's real booking and use it to view or cancel/reschedule the appointment, with no further authentication. This is a genuine credential leak to a third party (Google), introduced specifically by Phase A's unconditional mount on `/booking/manage`, and it is **not mitigated anywhere in this commit**.

The plan and brief do not raise this — brief §2.2 lists `/booking/manage` as an in-scope mount with no caveat, and §3 ("RBAC / privacy posture") only discusses admin isolation and "no PII in payload," which addresses the Phase B conversion event's payload but not GA's own automatic `page_location` collection on this specific route. This is a real gap in the plan's threat model, not a coding-error deviation by the implementer — the implementer built exactly what brief §2.1/§2.2 specified. But per the dispatch instruction, it is reported here as a blocking finding regardless of which document originated it.

**Verdict driver:** this alone is sufficient for FAIL. Standard mitigations (not evaluated further here, out of scope for a read-only verifier) would include stripping the query string before the GA config call fires (e.g., `gtag('set', 'page_location', location.href.split('?')[0])` or a `page_view` override), or excluding `/booking/manage` from the mount until such a fix ships.

---

## CHECK 2 — reproduced independently

Reproduced via Git Bash, `localhost` (not `127.0.0.1`), `curl -L`.

**Build with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST` (`NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST pnpm build` then `pnpm start`, port 3000):**

| Path | Status | gtag present |
|---|---|---|
| `/` (no `-L`) | `308` → `Location: http://localhost:3000/home` | — |
| `/` (`-L`, final) | `200` | yes |
| `/services` | `200` | yes |
| `/booking/manage` | `200` | yes |
| `/admin/login` | `200` | **no** (0 matches for `googletagmanager\|gtag`) |

**Build with the var unset (`pnpm build` + `pnpm start`, port 3000, after freeing the port):**

| Path | Status | gtag/dataLayer trace |
|---|---|---|
| `/`, `/services`, `/booking/manage`, `/admin/login` | all `200` | **0 matches for `googletagmanager\|gtag\|dataLayer`** on every route |

**Dev server (`pnpm dev`, no env var; ran on port 3001 — 3000 was occupied by a leftover prod process at that moment):** all four paths (`/`, `/services`, `/booking/manage`, `/admin/login`) returned `200` with **0 matches** for `googletagmanager|gtag`.

**Confirming the implementer's "preload + flight payload, not literal `<script src>`" observation:** grepping the served HTML for `/` (GA-TEST build) around the match:

```
...async=""></script><link rel="preload" href="https://www.googletagmanager.com/gtag/js?id=G-TEST" as="script"/><meta name="next-size-adjust"...
```

and the RSC flight payload embedded later in the same document:

```
f:[["$","$L1a",null,{"src":"https://www.googletagmanager.com/gtag/js?id=G-TEST","strategy":"afterInteractive"}],["$","$L1a",null,{"id":"ga-init", ...
```

**Confirmed, not corrected.** Server-rendered HTML contains a `<link rel="preload">` for the gtag.js URL plus a serialized RSC flight payload describing both `<Script>` elements — there is no literal `<script src="https://www.googletagmanager.com/gtag/js...">` tag in the raw server HTML. The actual `<script>` tags are inserted client-side by Next's `next/script` runtime after hydration, consistent with `strategy="afterInteractive"`. This means "present in the HTML" for the gate assertion is correctly interpreted as "the flight payload/preload references the measurement ID," which only appears when the gate is open — the assertion still holds, just via a different DOM mechanism than a naive read would assume.

---

## CHECK 3 — the consent seam (C-18 dependency)

`GoogleAnalytics.tsx:18-22` (verified against `git show 05f251e` and the live RSC flight payload extracted above):

```
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
// C-18 consent insertion point: gtag('consent', 'default', { ... }) goes here
gtag('js', new Date());
gtag('config', 'G-TEST');
```

The comment sits between `function gtag(){...}` and `gtag('js', new Date())`. **This ordering does achieve what C-18 needs**: a `gtag('consent', 'default', {...})` call inserted at that exact point would execute after `gtag` is defined but before `gtag('js', ...)` and `gtag('config', ...)` — i.e., before the first hit is sent. Per Google's Consent Mode v2 contract, `consent` defaults must be set before `js`/`config` for the default to apply to the initial page_view; this insertion point satisfies that ordering. Confirmed directly from the live flight payload, not just the source text (both matched byte-for-byte).

`src/app/booking/layout.tsx` (full file, 10 lines):

```tsx
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GoogleAnalytics />
    </>
  );
}
```

Minimal passthrough + single mount, no logic of its own — trivially extendable by C-18 without needing to be recreated (it did not exist before this commit; C-18 must extend, per the plan's own coordination note, and there is nothing here that would obstruct that).

---

## CHECK 4 — the rest

- **`git show 05f251e --stat`** — exactly 5 files, 110 insertions, 0 deletions: `.env.example`, `src/app/(public)/layout.tsx`, `src/app/booking/layout.tsx` (new), `src/components/GoogleAnalytics.tsx` (new), `src/components/__tests__/GoogleAnalytics.test.tsx` (new). Nothing else. Matches Step 1-3 scope exactly.
- **`.env.example` diff** (lines 20-23): added `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` with a 3-line comment. Note: dispatch text says "no value" — technically the line carries the placeholder `G-XXXXXXXXXX`, not a bare `NEXT_PUBLIC_GA_MEASUREMENT_ID=`. This is **not a deviation**: every other var in the same file follows the identical placeholder-value convention (`your-anon-key`, `your-dsn@sentry.io/project-id`, `replace-with-long-random-string`, etc. — read in full at `.env.example:1-34`), `G-XXXXXXXXXX` is an obviously-fake measurement ID (matches GA4's public ID format, carries no secret), and no `.env` file was created or modified (`git status --porcelain -- .env` — confirmed no such file is tracked/staged; only `.env.example` appears in the commit). No `wrangler.jsonc` change (absent from the 5-file list). No Zone-2 action was attempted — the plan's Step 3 hard-stop (Cloudflare production env var) was correctly **not** executed by this commit; that remains a separate confirm-first action not covered by "Phase A code only."
- **Unit tests** (`src/components/__tests__/GoogleAnalytics.test.tsx`, 3 tests, all read and run):
  1. env unset + `NODE_ENV=production` → expects `document.querySelector("script[data-nscript]")` to be null.
  2. `NODE_ENV=development` + env set → same null assertion.
  3. both true → asserts the preload/loader `<script src=...>` and `#ga-init` element exist, with `gtag('config','G-TEST123')` in its text content.
  Ran in isolation: `npx vitest run src/components/__tests__/GoogleAnalytics.test.tsx` → **3 passed, 0 failed**.
  **Would they pass with the gate removed?** No. If the `if (!GA_ID || ...) return null;` line were deleted, tests 1 and 2 would still render the two `<Script>` elements (with `GA_ID` possibly `undefined` in test 1's case, but `next/script` still injects a `script[data-nscript]` element into `document.head`), so `document.querySelector("script[data-nscript]")` would no longer be null and both tests would fail. Test 3 would still pass regardless (it doesn't test the gate, only the positive case). So the negative-case tests do meaningfully enforce the gate; only the positive test wouldn't catch a gate removal on its own, but the suite as a whole would fail if the gate were stripped.
  Note on `vi.resetModules()` + dynamic `import("../GoogleAnalytics")` per test: this is necessary and correctly done, since `GA_ID` is read into a module-level `const` at import time (required for Next's static inlining) — without the reset, later tests would see the first test's frozen env snapshot. Read and confirmed this pattern is used consistently across all three tests (`GoogleAnalytics.test.tsx:14-18` `loadGoogleAnalytics()` helper, called at the top of each `it`).
- **Style rules:** `grep -n "border-l-4\|oklch(" ` across all 5 changed files → 0 matches. Mobile-first: not applicable — `GoogleAnalytics.tsx` and `booking/layout.tsx` contain no styled markup at all (pure logic/passthrough); the one-line `<GoogleAnalytics />` addition to `(public)/layout.tsx` matches the file's existing plain-mount pattern (`<PublicScrollbar />` immediately above it, same style — no new classes introduced).
- **Bundle ceiling (+1 kB on public first-load JS) — NOT VERIFIED, reporting the gap rather than guessing.** This Next.js 16.2.4 Turbopack `next build` does not emit a "First Load JS" route-size table at all in its console output (confirmed: `grep -n "First Load\|kB"` against the full captured build log returned nothing — the Turbopack output format for this version only prints the route-type table shown in Check 2, no size column). I also have no pre-C-17 build to diff against, since obtaining one would require checking out an ancestor commit, which is forbidden for a read-only verifier (`checkout`/`stash`/`switch`/`restore` are all off-limits). I did not attempt to approximate this via manual chunk-size arithmetic, since that risks a misleading number being reported as a verified gate. **This gate is unverified — treat it as open, not passing**, though qualitatively the change is consistent with the plan's own estimate (24-line component, no new dependency, `gtag.js` itself loaded from Google's CDN and never bundled — confirmed no new entries under `node_modules` and no `package.json`/lockfile changes in the 5-file diff).

---

## CHECK 5 — static gates

- **`npx tsc --noEmit`** → **0 errors** (empty output).
- **`npx vitest run`** → tail:
  ```
  Test Files  2 failed | 187 passed (189)
       Tests  5 failed | 1815 passed (1820)
  ```
  Failures by identity, confirmed via `grep "FAIL"`:
  ```
  FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
  FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
  FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
  FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
  FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
  ```
  **Exact identity match** to the inherited baseline (`admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3) — no new failures, no swapped-in failure. `GoogleAnalytics.test.tsx` is not among the failures (confirmed 3/3 passing above).
- **`npx eslint .`** → **59 errors / 7 warnings**, confirmed via JSON formatter for an exact per-file count:
  ```
  design_handoff_area_pages\prototype\area-page.jsx   errors: 48  warnings: 1
  design_handoff_area_pages\prototype\shared.jsx       errors: 2   warnings: 5
  design_handoff_area_pages\prototype\site-chrome.jsx  errors: 5   warnings: 0
  src\features\booking\BookingExperience.tsx           errors: 3   warnings: 0
  src\features\booking\BookingExperienceLoader.tsx     errors: 1   warnings: 0
  src\features\booking\utils\returning-customer.ts     errors: 0   warnings: 1
  TOTAL errors: 59  TOTAL warnings: 7
  ```
  **Exact identity match** to the inherited baseline (59/7, six files, same three `design_handoff_area_pages/prototype/*.jsx` + three `src/features/booking/*`). None of the five C-17 files appear in this list.

---

## Summary

Phase A's code is well-built to its own local spec: the gate is compile-time-eliminated (not just runtime-hidden) when the env var is absent, admin isolation is real and traced through the import graph rather than assumed, the C-18 consent insertion point is correctly ordered, the file scope is exactly the five files claimed, and all static gates (tsc/vitest/eslint) hold baseline identity with the new tests passing. The one bundle-size gate could not be verified with the tools available in a read-only session and is reported as open rather than guessed.

**The FAIL verdict rests entirely on Check 1's `/booking/manage` finding**: mounting `GoogleAnalytics` unconditionally on the customer manage-booking route causes GA's default `page_location` collection to capture the page's bearer-style `?token=` query parameter — the same value the codebase's own Sentry scrubbing (`sentry-scrubbing.ts`/`sentry-scrubbing.test.ts`) already treats as sensitive enough to redact before it reaches an internal error-tracking vendor. Sending it, unredacted, to Google as part of every page_view on that route is a real credential leak to a third party and was not addressed by the plan, brief, or this commit's implementation.
