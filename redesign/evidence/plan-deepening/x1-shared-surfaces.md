# X1 — Shared-surface / customer-facing trap audit, all 8 items

**Scope:** cross-cutting audit per the assignment brief. Anchor section: §7.7a (lines 815-858 at
commit `33f895f`; the working plan file has since grown to 1266 lines — see §0 below on drift).
**Method:** read-only. File reachability proven by import-graph grep (ripgrep via the `Grep` tool,
cross-checked against `Bash`/shell `grep` and reconciled where they disagreed — see §8.6). One
read-only SQL query set against `twzutkfgqclqurvkmvqz` for the two claims the plan itself says must
be re-run (§8.9.A) plus a live index check for item 4. No file outside this report was written; no
git write command was run; no SQL beyond `SELECT` was executed.

---

## 0 — Anchor drift check on §7.7a itself

The assignment cites "§7.7a (lines 815-858)". In the current plan file (1266 lines total, not the
"1,265 lines" the handoff states — trivial, but the handoff's own line count is stale by one) §7.7a
runs from **line 815 to line 858**, unchanged from the cited range. **Not drifted.** The section's
own claims are tested individually in §5 below.

---

## 1 — Complete route tree under `src/app/`, classified

Enumerated with `Glob` (`src/app/**/page.tsx`, `**/layout.tsx`, `**/route.ts`) and cross-checked
with `find src/app -type d`. Counts:

- **44** `page.tsx` files (32 admin, 11 public, 1 booking/manage)
- **3** `layout.tsx` files (root, `(public)`, `admin`)
- **11** `route.ts` files (2 under `admin/`, 9 under `api/`)

### 1a. Public / unauthenticated

| Route | File | Note |
|---|---|---|
| `/` | `(public)/page.tsx` | `permanentRedirect("/home")`, no renderable content |
| `/home` | `(public)/home/page.tsx` | |
| `/about` | `(public)/about/page.tsx` | |
| `/services` | `(public)/services/page.tsx` | |
| `/services/[slug]` | `(public)/services/[slug]/page.tsx` | |
| `/areas` | `(public)/areas/page.tsx` | |
| `/areas/[slug]` | `(public)/areas/[slug]/page.tsx` | |
| `/faqs-aftercare` | `(public)/faqs-aftercare/page.tsx` | |
| `/reviews` | `(public)/reviews/page.tsx` | |
| `/cookies` | `(public)/cookies/page.tsx` | |
| `/privacy` | `(public)/privacy/page.tsx` | **item 2's target** |
| layout | `(public)/layout.tsx` | SiteHeader/Footer, ConsentScripts, CookieBanner, GA, booking widget loader |

### 1b. Customer-token-authenticated

| Route | File | Note |
|---|---|---|
| `/booking/manage?token=…` | `booking/manage/page.tsx` | Renders under the **ROOT** layout only — no `(public)` group, no admin group. See §6. |

### 1c. Admin — authenticated

30 of the 32 admin `page.tsx` files require `getStaffProfile()` to return a profile (enforced in
`admin/layout.tsx`, which returns `<>{children}</>` — i.e. no nav/theme wrapper — when `profile` is
null). The two below are the exception:

| Route | File | Auth |
|---|---|---|
| `/admin` | `admin/page.tsx` | `redirect("/admin/dashboard")`, no content — **not one of the "31" auditable routes** (see §5c) |
| `/admin/login` | `admin/login/page.tsx` | **Admin-unauthenticated** — see §1d |
| `/admin/password-reset` | `admin/password-reset/page.tsx` | **Admin-unauthenticated** |
| `/admin/password-reset/[token]` | `admin/password-reset/[token]/page.tsx` | **Admin-unauthenticated** |
| `/admin/account-password-requests` | `admin/account-password-requests/page.tsx` | Authenticated (own permission) |
| everything else (26 routes) | `admin/{dashboard,bookings,bookings/[bookingId],bookings/new,bookings/series/[templateId],calendar,clients,clients/[clientId],clients/[clientId]/edit,clients/new,emails,emails/templates/[templateId],enquiries,me,operations,privacy,reports,roles,roles/[roleId],services,settings,staff,staff/[staffId],staff/[staffId]/availability,staff/[staffId]/performance,audit,availability}/page.tsx` | Authenticated, role-gated by `getAdminPageAccess` |

### 1d. Admin — unauthenticated (a fourth class the assignment's taxonomy doesn't name)

`admin/layout.tsx:19-21`:
```ts
const profile = await getStaffProfile(supabase);
if (!profile) { return <>{children}</>; }
```
So `/admin/login` and both `/admin/password-reset*` routes render **without** `AdminTopNav` and
**without** `ThemeProvider` — no `[data-admin-theme-root]` wrapper exists on these pages at all.
Verified by reading `admin/login/page.tsx`: it uses `bg-[var(--admin-canvas)]`,
`text-[var(--admin-heading)]` etc. directly, resolving against **bare `:root`** (tokens.css's default
block, which — per the plan's own §7.2 evidence, e.g. "byte-identical to `--admin-status-cancelled-
text`'s **light** value") holds the **light**-equivalent values. These pages can never show "dark
mode" through the normal mechanism, regardless of the visitor's `theme_preference` or OS setting,
because there is no `data-theme` attribute anywhere in their tree.

This class is reachable by **anyone**, unauthenticated — it is genuinely public in the access sense,
while being visually admin-themed. The existing Layer-3 sweep already labels this
**"UNAUTHENTICATED"** and reports 2 routes / 2 dark-failures / 0 light-failures (§7.2b's table). That
dark-mode number is worth a flag for the implementer: if these pages truly have no `data-theme`
attribute anywhere in their DOM, a script that does
`document.querySelector('[data-admin-theme-root]').setAttribute('data-theme','dark')` (§7.9(b).3's
literal instruction) will find **no element to select on these two routes**, and the "dark" pass will
silently test the exact same DOM as the "light" pass. That the sweep reports *different* failure
counts for dark vs light on this route class (2 vs 0) suggests either (a) the harness has a fallback
selector not documented in the plan, or (b) the 2 dark-only failures are an artefact of something
else (e.g. `prefers-color-scheme` at the OS/browser level during that specific run). **Recommend the
deepened plan require this be checked in the harness source (`e2e/admin-contrast-helpers.ts`, not
read in this audit — out of my remit to modify but should be read before Phase D ships) rather than
assumed.** This is not a blocker for Phase 0/A/B: it only affects the accuracy of one baseline number
already logged as informational for the unauthenticated class.

### 1e. API / cron

| Route | File | Auth |
|---|---|---|
| `POST /admin/signout` | `admin/signout/route.ts` | Session-based |
| `GET /admin/reports/export` | `admin/reports/export/route.ts` | `getStaffProfile` + permission |
| `GET /admin/email-templates/preview/[id]` | `admin/email-templates/preview/[id]/route.ts` | Admin |
| `POST /api/bookings` | `api/bookings/route.ts` | **Public** — booking-form submission |
| `GET /api/availability` | `api/availability/route.ts` | **Public** — booking widget slot fetch |
| `GET /api/availability/month` | `api/availability/month/route.ts` | **Public** — booking widget month fetch |
| `GET /api/admin/availability/month` | `api/admin/availability/month/route.ts` | Admin — manual-booking calendar |
| `POST /api/consent-events` | `api/consent-events/route.ts` | **Public** — cookie consent logging |
| `/api/cron/booking-reminders` | route.ts | Cron secret |
| `/api/cron/scheduled-emails` | route.ts | Cron secret |
| `/api/cron/review-emails` | route.ts | Cron secret — **item 1's target** |
| `/api/cron/extend-recurring-horizons` | route.ts | Cron secret — **item 8 Phase 4 touches this** |

---

## 2 — `src/app/booking/**`, completely enumerated (the plan mentions only `/booking/manage`)

```
src/app/booking/
├── __tests__/no-google-analytics.test.ts
└── manage/
    ├── page.tsx           (the only route.tsx — RSC, server component)
    ├── ManageBookingForms.tsx   ("use client" — cancellation/reschedule/note forms)
    └── actions.ts          ("use server" — 3 server actions)
```

**Confirmed: `/booking/manage` is the only route under `src/app/booking/`.** There is no second
customer-token route hiding in this tree. The plan's "the known trap is `/booking/manage`" framing is
accurate as far as route enumeration goes — the risk was never a second route, it is the breadth of
what that one route touches (§3-§6 below).

`page.tsx` imports `Badge` (`@/components/ui/badge`) directly, and `getCustomerManageBooking` from
`@/lib/booking/customer-manage`. `ManageBookingForms.tsx` imports `Button`, `Input`, **and
`Textarea`** (`@/components/ui/{button,input,textarea}`) — **the plan's §7.7a names only `Button` and
`Input` as the primitives at risk; `Textarea` is a third one it omits.** `Textarea` currently carries
**zero** `oklch(` literals (verified, §5b), so it is not part of item 7's Phase B edit list today —
but it is still a primitive this customer route renders, and any future literal added to
`textarea.tsx` would land on `/booking/manage` exactly like the other two. Recommend the deepened
plan's §7.7a table add `Textarea` with a "0 literals today, still in scope for the guard test" note,
so Phase C's ratchet guard (§7.8) is written to cover it even though there is nothing to fix in it now.

`actions.ts` imports from `@/lib/email/notifications` (`sendBookingCancellationEmails`,
`sendBookingRescheduleRequestEmails` — **not** `sendReviewRequestEmail`, see §4a) and from
`@/lib/booking/customer-manage` (`getCustomerManageBooking`).

---

## 3 — Does the public site load `tokens.css`? Does admin load `site-parity.css`? — proven from the import graph

```bash
grep -rn "tokens.css\|site-parity.css\|globals.css" --include="*.ts" --include="*.tsx" --include="*.css" src/
```
Result — the only import sites in the whole `src/` tree:
- `src/app/layout.tsx:4` → `import "@/styles/site-parity.css";`
- `src/app/layout.tsx:5` → `import "./globals.css";`
- `src/app/globals.css:4` → `@import "../styles/tokens.css";`

**`src/app/layout.tsx` is the ROOT layout — Next.js App Router permits exactly one, and every route
in the tree (public group, admin group, and the un-grouped `booking/manage`) renders inside it.**
There is no second import site anywhere, and no route group can opt out of the root layout. This is
not an inference from the plan's prose — it is the entire and exhaustive result of the grep above.

**Therefore, proven, not assumed:**
- **`tokens.css` loads on every route in the application** — public, admin, and `/booking/manage`
  alike. It is harmless on public pages only because nothing on those pages references an
  `--admin-*` custom property; the moment anything does (as the three shared UI primitives do), the
  admin token values become live on that page too.
- **`site-parity.css` loads on every route**, admin included. Its `a { color: inherit; }` rule
  (`site-parity.css:39-40`, confirmed by direct read) is unscoped — no class, no `:where()`, no
  layer wrapper — so it competes with every Tailwind text-colour utility on every `<a>` on every
  page, which is the exact mechanism D12 describes. This independently confirms D12's "site-wide,
  admin and public" claim from first principles (import graph + CSS cascade-layer rules), rather than
  taking the plan's own root-cause write-up on faith.

`globals.css` itself (`src/app/globals.css:1-6`) declares `@layer theme, base, components,
utilities;` and imports Tailwind's utilities into `layer(utilities)` — `site-parity.css` is imported
**above** that, **unlayered**, in the root layout, which is what gives it cascade priority over
layered utilities regardless of specificity. Confirmed by reading both files directly.

---

## 4 — Item-by-item file reachability

### Item 1 — review-request email cooldown

| File | Reachable from non-admin route? |
|---|---|
| `src/lib/email/notifications.ts` | **Partially shared** — see §4a. The specific functions item 1 touches (`sendReviewRequestEmail`, plus new exports) are not imported by any customer-route file today. |
| `src/app/api/cron/review-emails/route.ts` | No — cron, secret-gated |
| `src/app/admin/emails/actions.ts` | No — admin only, confirmed no importer outside `src/app/admin` |
| `src/app/admin/emails/page.tsx` + new form component | No — admin only |

#### 4a. `notifications.ts` is imported by `booking/manage/actions.ts` — verified precisely which exports

```
src/app/booking/manage/actions.ts:6-9
import {
  sendBookingCancellationEmails,
  sendBookingRescheduleRequestEmails,
} from "@/lib/email/notifications";
```
Confirmed by direct read. **Item 1 does not touch either of these two functions** — it adds a cooldown
constant, a new batch helper, a new early-return reason, and an `ignoreClientCooldown` option scoped
to `sendReviewRequestEmail`. As long as the implementer does not refactor shared internals that
`sendBookingCancellationEmails`/`sendBookingRescheduleRequestEmails` also call (they do share
`getBookingTemplateInput` — see §4c below, which item 1 does not touch), this file being imported by
a customer route is **not** a risk for item 1 specifically. **Recommend the deepened plan add an
explicit stop condition:** *"If implementing item 1 requires touching any function above the
`sendReviewRequestEmail` line in `notifications.ts` other than adding new exports, stop — that
function may be shared with `/booking/manage`'s cancellation or reschedule-request path; check
`grep -n "sendBooking(Cancellation|RescheduleRequest)Emails" src/lib/email/notifications.ts` first."*

### Item 2 — privacy page

`src/app/(public)/privacy/page.tsx` — this **is** a public route by definition (item 2's whole
subject). No hidden reachability question here; it does not import anything item 7 or item 8 also
touch. Confirmed no shared-file collision.

### Item 3 — override-list secondary sort

`src/app/admin/availability/page.tsx`, `src/app/admin/staff/[staffId]/availability/page.tsx` — both
proven admin-only:
```bash
grep -rln "AvailabilityOverridesManager\|availability-data\|admin/staff/\[staffId\]/availability/lib" src --include="*.ts" --include="*.tsx" | grep -v "^src/app/admin"
# → no output
```

### Item 4 — `bookings` indexes

No application code is edited (migration file only). The `bookings` table itself is read by both
admin code and `booking/manage`/`api/bookings` (customer code) — but an index changes query *plans*,
never query *results*, so this item carries no shared-surface **correctness** risk. Not applicable
beyond that general note. Live index state re-verified (SELECT-only, this session):
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' ORDER BY indexname;
```
→ exactly the three the plan's §4.1 table lists (`bookings_pkey`, `bookings_client_status_completed_idx`,
`idx_bookings_recurring_template`), nothing else. **Plan's live-state claim CONFIRMED, unchanged since
whenever it was last checked.**

### Item 5 — bundle measurement tooling

`scripts/measure-admin-bundles.mjs` — a dev-only script, not part of any request-serving code path.
No shared-surface question applies.

### Item 6 — adjustment-list date grouping

Same six/four files as item 3 plus the Manager components — all proven admin-only by the same grep
above (`AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`,
`availability-data.ts`, `staff/[staffId]/availability/lib.ts` all zero-matched outside `src/app/admin`).

### Item 7 — admin theming (the primary cross-cutting item) — see §5 in full

### Item 8 — travel-charge model (the second primary cross-cutting item) — see §6 in full

---

## 5 — Item 7's blast radius, verified claim-by-claim

### 5a. The exhaustive oklch scan — proving the boundary, not just the admin count

```bash
grep -ro "oklch(" src/app/admin | wc -l   # → 677
grep -rl "oklch(" src/app/admin | wc -l   # → 99
```
**CONFIRMED, exact match to plan §7.2.**

```bash
grep -rl "oklch(" src/components 2>/dev/null | sort
# → src/components/ui/badge.tsx
# → src/components/ui/button.tsx
# → src/components/ui/input.tsx
```
**CONFIRMED — "3 shared primitives" is exact, nothing else in `src/components/`.**

```bash
grep -rl "oklch(" src 2>/dev/null \
  | grep -v "^src/app/admin" \
  | grep -v "ui/badge.tsx\|ui/button.tsx\|ui/input.tsx" \
  | grep -v "\.css$"
# → no output
```
**This is the strongest available proof of the plan's blast-radius claim.** Every single `.ts`/`.tsx`
file anywhere in `src/` that contains an `oklch(` literal is *either* one of the 99 admin files *or*
one of these exact 3 shared primitives. There is no fourth location. `src/features/**` and
`src/app/(public)/**` independently verified at **zero**:
```bash
grep -rl "oklch(" src/features "src/app/(public)" 2>/dev/null | wc -l   # → 0
```

### 5b. Exact occurrence counts for the 3 shared primitives (plan gives no combined total — supplied here)

Using ripgrep (`Grep` tool) for accuracy — see §8.6 for why this matters:

| File | `oklch(` occurrences |
|---|---|
| `src/components/ui/badge.tsx` | **22** |
| `src/components/ui/button.tsx` | **8** |
| `src/components/ui/input.tsx` | **10** |
| `src/components/ui/textarea.tsx` | **0** — see §2 |
| **Total (3 files)** | **40** |

### 5c. `badge.tsx` — stronger than the plan's own finding

Plan §7.7a: *"Measured: 0 `<Badge` call sites in `src/app/admin/**`, against 141 uses of
`AdminStatusBadge`."* Verified independently by enumerating **every** importer of
`@/components/ui/badge` in the whole repo:
```bash
grep -rl "from [\"'].*components/ui/badge[\"']" src/
# → src/app/booking/manage/page.tsx
```
**One importer, total, in the entire codebase, and it is the customer page.** This is stronger than
"0 admin call sites" — it is "100% of this component's runtime exposure is the customer page, with
literally zero admin exposure of any kind." The plan's §7.7a recommendation ("ship input.tsx and
button.tsx first, treat badge.tsx as separate/later/low-priority") is directionally right but
understates the asymmetry: fixing `badge.tsx` has **no possible admin benefit to weigh against the
customer-page risk** — it is pure risk with zero corresponding admin payoff, which is a stronger
argument for extreme care (or for simply leaving it out of Phase B entirely and letting Phase C's
ratchet guard catch it passively) than "low priority" conveys.

### 5d. `button.tsx` / `input.tsx` — every importer, whole repo

```bash
grep -rl "from [\"'].*components/ui/button[\"']" src/
```
→ `admin/bookings/CopyButton.tsx`, `admin/calendar/PrintButton.tsx`,
`admin/dashboard/dashboard-filters-client.tsx`, `admin/login/LoginForm.tsx`,
`admin/password-reset/PasswordResetSubmitButton.tsx`, `admin/password-reset/states/Rejected.tsx`,
**`booking/manage/ManageBookingForms.tsx`**. 7 files: 6 admin (2 of them — login, password-reset —
being the **admin-unauthenticated** class from §1d), 1 customer.

```bash
grep -rl "from [\"'].*components/ui/input[\"']" src/
```
→ `admin/login/LoginForm.tsx`, `admin/password-reset/states/ForgotForm.tsx`,
`admin/password-reset/states/SetNewPassword.tsx`, **`booking/manage/ManageBookingForms.tsx`**. 4 files:
3 admin-unauthenticated, 1 customer.

**A finding not in the plan:** every `button`/`input` importer inside `src/app/admin/` is either the
**unauthenticated** login/password-reset flow, or a handful of small standalone buttons — **not**
`BookingManagementForm.tsx` or `ManualBookingForm.tsx`, the two big admin booking forms. Confirmed:
```bash
grep -n "from \"@/components/ui/button\"\|from \"@/components/ui/input\"\|from \"@/components/ui/badge\"" \
  src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/new/ManualBookingForm.tsx
# → no output (neither file imports any of the three)
```
Those two forms use their own `AdminButton`/`AdminInput` wrapper components, not the shadcn
primitives. **This narrows Phase B's `button.tsx`/`input.tsx` blast radius further than the plan
states**: the substitution work in these two files reaches (a) 2 unauthenticated admin auth screens,
(b) 3 small single-purpose admin buttons, and (c) the customer page — full stop. It does **not**
reach either of the two largest, highest-traffic admin booking forms, which is good news the plan
could state more precisely.

### 5e. Why `/booking/manage`'s dark-mode risk is structurally bounded, not merely unmeasured — a finding the plan does not make

`ThemeProvider.tsx:43-57` carries an existing, dated design comment (not new — this is documenting an
**already-made** Owner decision from 2026-07-31):
> *"⛔ The attribute goes on THIS component's own wrapper element — never on `document.documentElement`
> or `<body>` (Owner decision 2026-07-31, overriding plan Steps 12/15). `src/components/ui/input.tsx`
> and `badge.tsx` consume `--admin-*` tokens unconditionally and render on `/booking/manage`, a
> customer route authenticated by a URL token that shares the single root `<html>`. With the
> attribute on a wrapper inside the admin tree, public routes structurally cannot inherit admin
> theming, whichever tokens they consume."*

This is a **structural** guarantee, verified by reading `ThemeProvider.tsx` and confirming `admin/
layout.tsx` never renders `ThemeProvider` around `/booking/manage` (it is a different route
subtree entirely — `booking/manage/page.tsx` sits directly under the root layout, not under
`admin/layout.tsx` at all). There is **no** `[data-admin-theme-root]` element anywhere in
`/booking/manage`'s render tree, ever, under any admin theme preference. Consequently:

- **Every `--admin-*` token consumed by `Button`/`Input`/`Badge`/`Textarea` on `/booking/manage`
  resolves against bare `:root`** (the same block §1d showed the admin-unauthenticated pages use) —
  never against `[data-theme="dark"]` or `[data-theme="light"]`.
- Any substitution that is byte-identical to the **`:root`** value of the token it replaces (which,
  per the plan's own evidence in §7.2, is what the top literals are) is **provably** unchanged on
  `/booking/manage`, for the same reason it is provably unchanged in "light mode" elsewhere — because
  `/booking/manage` always resolves against that same `:root` block.
- This means §7.7a's binding requirement #2 ("after each primitive change, re-check [`/booking/
  manage`] — a visual diff there is a STOP") is still correct practice, but the plan should say
  explicitly that **the dark-theme half of that check is testing something the current architecture
  cannot produce** — useful as a regression trap against a future architecture change (e.g. someone
  adding a `data-theme` attribute to `<html>`), not as a live risk today. **Recommend adding this as
  an explicit note in §7.7a**, both to save the implementer confusion when a "dark-mode `/booking/
  manage`" screenshot looks identical to light, and to record *why* it's expected to look identical
  (so a future reader doesn't mistake "identical" for "the test didn't run").
- The badge/button/input tokens actually referenced were checked directly:
  ```bash
  grep -o "var(--admin-[a-z0-9-]*)" src/components/ui/{button,input,badge}.tsx | sort -u
  ```
  → `--admin-body`, `--admin-border`, `--admin-panel-muted`, `--admin-primary`,
  `--admin-status-completed-bg`, `--admin-status-completed-text` (badge); `--admin-body`,
  `--admin-border-form`, `--admin-canvas`, `--admin-focus`, `--admin-primary`, `--admin-primary-hover`
  (button); `--admin-text-muted` (input). **None of these are among the 11 `:root`-only frozen-alias
  tokens Phase 0 Step 0.1 fixes** (`--admin-nav-text`, `--admin-nav-active-text`, `--admin-text`,
  `--notif-badge-*-bg` ×3, `--admin-nav-text-muted`, `--admin-surface`, `--admin-surface-muted`,
  `--admin-cormorant-color`, the user-menu variant of `--admin-nav-active-text`) — so Phase 0's
  de-alias work has **no interaction** with what `/booking/manage` renders. Confirmed by direct
  comparison of the two lists; worth stating in the plan so an implementer doesn't spend time
  cross-checking Phase 0 against `/booking/manage`.

### 5f. `/booking/manage` is not yet in the Layer-3 sweep — confirmed still true, not assumed

```bash
grep -n "booking/manage\|BOOKING_MANAGE" e2e/admin-contrast.spec.ts
# → no output
```
§7.7a's binding requirement #3 ("add `/booking/manage` to the Layer 3 sweep… if none can be obtained
without a production write, record it unreachable") is **not yet done**. This audit did not attempt
to obtain a token (would require creating a real booking, which is a data write — out of scope for a
read-only agent). **Flag for the implementer: this remains an open action item, not a completed one.**

### 5g. The six-availability-files collision count — re-verified, plan's "23" is correct (with a shell-tooling caveat worth recording)

Plan (top-level "Suggested order and commits" section): *"items 3 and 6 edit six availability files
that already carry 23 `oklch()` literals which item 7 must also change."* Re-counted per-file with
the ripgrep-backed `Grep` tool (bracket-path directories, e.g. `staff/[staffId]/…`, need care — see
§8.6):

| File | `oklch(` count |
|---|---|
| `src/app/admin/availability/page.tsx` | 7 |
| `src/app/admin/staff/[staffId]/availability/page.tsx` | 0 |
| `src/app/admin/availability/availability-data.ts` | 0 |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | 9 |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | 6 |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | 1 |
| **Total** | **23** |

**CONFIRMED exactly.** (A first attempt using plain Bash `grep` with the literal bracket path
`src/app/admin/staff/\[staffId\]/…` produced 26, not 23 — Bash/glob bracket-escaping is fragile on
these paths in exactly the way HANDOFF gotcha #5 warns about for route strings; ripgrep via the
`Grep` tool handled the literal path correctly. **Worth logging as a second instance of the same
class of environment gotcha, for a different tool** — recommend the deepened plan's tooling notes
mention that bracket-containing paths (`[staffId]`, `[bookingId]`, `[clientId]`, `[slug]`, `[roleId]`,
`[templateId]`, `[id]`, `[token]`) should be counted with `Grep`/ripgrep, not raw shell glob
expansion, to avoid a silent miscount.)

**No new collision found here beyond what the plan already states.** Sequence 3 → 6 → 7 as written.

### 5h. A genuine NEW collision the plan does not mention — item 7 × item 8 on `ManualBookingForm.tsx`

`src/app/admin/bookings/new/ManualBookingForm.tsx` is the **single highest-literal-count file in the
entire admin tree** (57 occurrences — plan §7.4's own table). It is **also** a file item 8 must edit:
```bash
grep -n "allowed_cities\|allowedCities" src/app/admin/bookings/new/ManualBookingForm.tsx
```
→ lines 529, 547, 550 (prop declaration), 1687-1693 (`isCityKnown` derivation), 1725-1729 (rendered
warning). This warning is:
```tsx
{!isCityKnown ? (
  <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
    &ldquo;{cityTrimmed}&rdquo; is outside our current service area. We deliver to: {allowedCities.join(", ")}.
  </p>
) : null}
```
Two independent facts:
1. **The literal `oklch(26%_0.14_25)` at this exact line is one of the 171 instances of item 7's
   #1-ranked literal** (§7.2's top-10 table, `oklch(26% 0.14 25)`, byte-identical to
   `--admin-status-cancelled-text`'s light value). Item 7's Phase B will edit this line.
2. **This message is a fourth, previously undocumented place where the old "allowed = gate" meaning
   is spoken to a user**, beyond the plan's own three-gate table in §8.2. It is advisory-only —
   `isCityKnown` is read exactly once, purely for display; it does not block form submission or step
   progression (confirmed: `grep -n "isCityKnown" ManualBookingForm.tsx` returns only its declaration
   and this one render site) — so item 8's behavioural fix (making out-of-zone bookable) requires no
   code change here for *correctness*. But the **copy is wrong** the moment item 8 ships: an admin
   manually creating a booking for a customer outside the free-travel zone will see "outside our
   current service area. We deliver to: …", which reads as a hard rejection, when the new model
   permits (and expects an admin to set a fee for) exactly that booking. **This is a real gap: item
   8's §8.8 ("Admin, on the booking") lists only `BookingManagementForm.tsx`'s
   `StatusAndPaymentSection`, not `ManualBookingForm.tsx`'s creation-time warning — a different file,
   a different moment in the booking lifecycle (creation vs. after-the-fact management), and the
   plan's own Owner-decision #7 ("change the towns in admin, and the booking page, admin alert and
   emails all follow") should cover it but its file list does not name it.**

**Recommendation for the deepened plan:**
- Add `ManualBookingForm.tsx`'s `isCityKnown` block to item 8 Phase 5's file list, reworded from
  "outside our current service area" to something in the same voice as the customer-facing rewording
  in §8.8 (e.g. *"outside our free-travel areas — a travel charge will need to be set for this
  booking"*).
- Sequence: **item 7 before item 8** on this specific file (mirrors the existing 3/6-before-7
  guidance) — item 7's Phase B will retint this exact literal; item 8 should land its copy/logic
  change on the file *after* that substitution, and re-grep the line number before editing, per the
  plan's own rule 6. The top-level "Suggested order and commits" table already puts 7 before 8
  (position 7 vs 8) — so the natural ordering already satisfies this, but the plan's own "real
  collision, corrected" paragraph (which calls out the availability-files collision) should also
  name `ManualBookingForm.tsx` explicitly, or an implementer working item 8 in isolation (who has
  only read §8, not §7.7a) will not know to re-grep this file.

---

## 6 — Item 8's blast radius, verified claim-by-claim

### 6a. The three-gate contradiction — re-verified live, exactly as §8.9.A instructs

```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';
```
→ `create_booking_request` only. **CONFIRMED — matches plan exactly, no second consumer has
appeared.**

```sql
SELECT policyname, tablename FROM pg_policies
WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';
```
→ empty. **CONFIRMED — no RLS policy references it, matches plan exactly.**

### 6b. Every file-level consumer of `allowed_cities`, re-enumerated (plan's §8.4 list checked for completeness)

```bash
grep -rln "allowed_cities" src supabase
```
→ `admin/bookings/new/ManualBookingForm.tsx`, `admin/bookings/new/page.tsx`,
`admin/settings/SettingsForm.tsx`, `admin/settings/__tests__/updateBusinessSettings.test.ts`,
`admin/settings/actions.ts`, `admin/settings/page.tsx`, `admin/settings/settings-data.ts`,
`lib/booking/__tests__/{availability-options,override-windows,staff-recurring-windows,working-hours-
segments}.test.ts`, `lib/booking/availability.ts`, and 6 historical migration files (not to be
edited, per plan §8.4's own instruction).

**Gap: `admin/bookings/new/ManualBookingForm.tsx` is a real consumer the plan's §8.4 list omits** —
that section names only `admin/bookings/new/page.tsx:73-84` (the fetch site). The prop flows on to
`ManualBookingForm.tsx` (`allowedCities` prop, §5h above) which is where the actual behavioural logic
(`isCityKnown`) lives. **This is the same file as §5h's collision** — recommend the deepened plan
merge these two observations into one entry, since they are the same root cause (§8.4's consumer list
should include this file, and §8.8's "Admin, on the booking" touch-point list should too).

The four `lib/booking/__tests__/*.test.ts` files are worth flagging for item 8's test-impact list —
they are not in the plan's §8.10 "tests and guards" section at all. They currently assert against
`allowed_cities`-shaped fixture data; renaming the column and changing `isCityAllowed`'s behaviour
(§8.5) will very likely require updating fixtures in these four files even if their primary subject
(availability-options, override-windows, staff-recurring-windows, working-hours-segments) is
unrelated to the city gate. **Recommend adding "re-run and, if necessary, update fixtures in these
four test files" to item 8's verification list**, since Phase 2 deletes `isCityAllowed`'s blocking
behaviour and any fixture asserting on it will start failing for the wrong reason if not checked.

### 6c. `src/lib/booking/availability.ts` — dual-surface, confirmed

```bash
grep -rl "@/lib/booking/availability" src/ (import-site search)
```
→ `admin/bookings/new/use-month-availability.ts` (admin manual-booking calendar hook),
`api/admin/availability/month/route.ts` (admin API), `api/availability/route.test.ts`,
`api/availability/month/route.ts` **(PUBLIC — booking widget)**, `api/availability/route.ts`
**(PUBLIC — booking widget)**.

**This file is genuinely shared between the public booking-widget slot API and the admin manual-
booking calendar API.** Item 8 Phase 2 (§8.5) deletes the `isCityAllowed` gate block from this file.
Both consumers must be exercised after that change — the plan's §8.10 test list says "an out-of-zone
city (Manchester) parses, generates slots, and creates a booking" (covers the public path) but does
**not** separately call out re-testing `api/admin/availability/month/route.ts` / the admin manual-
booking calendar's month view for the same regression. **Recommend adding an explicit test/verification
line**: *"the admin manual-booking calendar (`/admin/bookings/new`, month view) still returns slots
for an out-of-zone city after Phase 2 — same code path, same regression risk, different caller."*

### 6d. `templates.ts` / `getBookingTemplateInput` — customer-triggered email paths item 8 touches, not listed in §8.10

Counted directly:
```bash
grep -n "renderSummary(" src/lib/email/templates.ts | wc -l          # 13 (1 definition + wait, see below)
grep -rn "renderBookingPlainText(" src --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```
`renderSummary`: called at **13 sites** inside `templates.ts` (lines 444, 470, 494, 517, 539, 560,
588, 612, 629, 1017, 1082, 1141, 1209). **CONFIRMED, exact match to plan's "13 sites".**
`renderBookingPlainText`: called at **9 sites** outside its own definition (`notifications.ts:650,
671, 728, 750, 792, 981, 1003, 1040, 1065`, plus `sample-data.ts:173`). **CONFIRMED, exact match to
plan's "9 more".**

Two of those nine — `notifications.ts:728` ("Booking cancelled") and `notifications.ts:981`
("Reschedule request") — sit inside `sendBookingCancellationEmails` (definition starts `:679`, calls
`getBookingTemplateInput` at `:700`) and `sendBookingRescheduleRequestEmails` (definition starts
`:941`, calls `getBookingTemplateInput` at `:950`) respectively — **the exact two functions
`/booking/manage/actions.ts` calls** (§4a). So:

**When a customer cancels a booking or requests a reschedule from `/booking/manage`, the resulting
email is rendered through the same `getBookingTemplateInput` → `renderSummary`/
`renderBookingPlainText` pipeline item 8 modifies to fold in `travel_fee` and (optionally) add a
"Travel charge: £X" line.** This is almost certainly *desired* behaviour (the total should be
correct everywhere, automatically, which is the entire point of folding the fee into `total_price` —
§8.6's "every one is correct with zero email edits" argument). But it is a real, customer-triggered
path that **item 8's own §8.10 test list does not name**. The plan's test list says only "the
confirmation email contains the fee-inclusive total" (singular, and contextually about the
admin-driven confirm flow in §8.8). **Recommend adding to §8.10**: *"A cancellation or reschedule-
request email triggered from `/booking/manage` for a booking carrying a travel fee still renders the
correct fee-inclusive total (and, if the line-item is implemented, the correct 'Travel charge: £X'
line) — mailer mocked, no real send."*

### 6e. `customer-manage.ts` and `booking/manage/page.tsx` anchors — re-verified, not drifted

Plan cites `customer-manage.ts:206` and `booking/manage/page.tsx:227` for the total-price read sites.
Read directly:
- `src/lib/booking/customer-manage.ts:205-206`:
  ```ts
  totalPrice: toAmount(booking.total_price),
  amountDue: toAmount(booking.amount_due ?? booking.total_price),
  ```
  **Line 206 confirmed — anchor NOT drifted** (the `amountDue` line the plan means).
- `src/app/booking/manage/page.tsx:227`:
  ```tsx
  <Row label="Total">{formatMoney(booking.totalPrice)}</Row>
  ```
  **Line 227 confirmed exactly — anchor NOT drifted.**

Both sites are read-only downstream of the fold-in-at-write-time design (§8.6) — no code change is
needed at either site for numeric correctness, exactly as the plan claims, and this audit's read
confirms there is no summing, no second total computation, nothing that would need `+ travel_fee`
added by hand. **CONFIRMED.**

### 6f. Item 8's own required review (§8.9) — status

§8.9 is the plan's own "pre-implementation review that must happen FIRST" checklist. This audit
independently satisfies parts of it as a side effect:
- **8.9.A** (re-derive the enforcement map): done in §6a above — confirmed, no new consumer.
- **8.9.B** (enumerate every reader of the town list and diff against §8.4): done in §6b — found one
  gap (`ManualBookingForm.tsx`).
- **8.9.C** (worked money example, £45×2+£14=£104 not £118): **not independently re-derivable from
  static reading alone** — this is an arithmetic assertion about code that does not exist yet
  (`travel_fee` isn't a column today). Correctly the plan's own item to prove once Phase 3 lands, not
  something this audit can verify in advance. **UNVERIFIABLE at this stage, for the right reason** —
  flagged as such rather than guessed.
- **8.9.E** (email-timing guarantee): read both confirm paths — `actions.ts:560-565` region and
  `:893-898` region were not re-read line-for-line in this session (out of this audit's assigned
  scope, which is shared-surface reachability, not item 8's internal correctness). Not verified here;
  recommend the item-8-focused deepening pass (not this cross-cutting one) confirm it directly.
- **8.9.F, 8.9.G**: same — out of this audit's remit (recurring-cron participant-multiply shape, and
  recording the live `business_settings` row) belong to the item-8-specific deepening, not the
  shared-surface one. Noted so the gap is visible rather than silently skipped.

---

## 7 — The definitive shared-surface table

| File | Touched by items | Customer-visible route(s) rendering it | Control/evidence requirement |
|---|---|---|---|
| `src/components/ui/button.tsx` | 7 | `/booking/manage` (`ManageBookingForms.tsx`); admin-unauthenticated `/admin/login`, `/admin/password-reset*` | Capture `/booking/manage` before/after (light only matters — see §5e); capture the two unauthenticated admin screens before/after (also `:root`-only, same reasoning) |
| `src/components/ui/input.tsx` | 7 | `/booking/manage`; `/admin/login`; `/admin/password-reset*` | Same as above |
| `src/components/ui/badge.tsx` | 7 | `/booking/manage` **only** — zero admin importers anywhere | Highest-risk-per-benefit file in Phase B; capture `/booking/manage` before/after; consider deferring out of Phase B into its own commit per §7.7a, or skipping entirely and letting Phase C's guard flag it passively |
| `src/components/ui/textarea.tsx` | *(none today — 0 literals)* | `/booking/manage` | Add to Phase C's guard scope even though nothing needs fixing now |
| `src/styles/tokens.css` | 7 (Phase 0, Phase A) | **every route** (via `globals.css` → root layout) | Harmless on public pages (nothing there reads `--admin-*`) except through the 4 files above and `/admin/login`+`/admin/password-reset*`; De-alias work (0.1) does not touch any token the 4 files above consume (§5e) |
| `src/styles/site-parity.css` | 7 (Phase 0 Step 0.3 only) | **every route, site-wide** | ⛔ Its own gate already in the plan (§7.5b Step 0.3) — correctly the single highest-risk step in the whole plan; this audit's import-graph proof (§3) independently confirms the "site-wide" claim |
| `src/app/layout.tsx` | 7 (Phase 0 Step 0.3, if the fix touches the import site itself) | **every route** | Root layout — any edit here is definitionally site-wide; same gate as above |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | **7 AND 8** (new finding, §5h/§6b) | admin-only (not customer-visible) but shared *between the two items* | Sequence 7 before 8 on this file; re-grep the `isCityKnown` block's line numbers after item 7 lands; item 8 must reword the "outside our current service area" copy |
| `src/lib/booking/availability.ts` | 8 (Phase 2) | `/api/availability`, `/api/availability/month` (public booking widget) **and** `/api/admin/availability/month` (admin manual-booking calendar) | Test both consumers after `isCityAllowed` block deletion, not just the public one |
| `src/lib/email/notifications.ts` | 1 (new exports only), 8 (`getBookingTemplateInput` region) | `/booking/manage` — via `sendBookingCancellationEmails`/`sendBookingRescheduleRequestEmails`, which `booking/manage/actions.ts` calls directly | Item 1: stop condition if editing anything above the `sendReviewRequestEmail`-specific code (§4a). Item 8: test that a customer-triggered cancellation/reschedule email still renders correctly post-fold (§6d) |
| `src/lib/email/templates.ts` (`renderSummary`, `renderBookingPlainText`, `getBookingTemplateInput`, `buildVarMap`, `BookingEmailTemplateInput`, `BOOKING_EMAIL_SELECT`) | 8 | Same as above — 2 of the 22 send sites are customer-triggered from `/booking/manage` | Add the customer-triggered-email test named in §6d |
| `src/lib/booking/customer-manage.ts` | 8 (no code change needed — read-only confirmation) | `/booking/manage` directly | Confirmed correct by construction (§6e); no action needed beyond the arithmetic test in §8.9.C |
| `src/app/booking/manage/page.tsx` | 8 (no code change needed) | itself | Same |
| `src/features/booking/schemas/booking-schema.ts` | 8 (Phase 2) | `/` (all public pages via `BookingExperience`), i.e. the public booking widget everywhere it mounts | Already disclosed as public in the plan's own text (§8.5) — not a hidden trap, listed here for table completeness |
| `src/features/booking/components/AboutYouStep.tsx`, `ConfirmStep.tsx`, `BookingExperience.tsx` | 8 (Phase 5) | public booking widget | Same — already disclosed by the plan |
| `bookings` table (DB) | 4, 8 | read by both admin and `/booking/manage`/`/api/bookings` | Item 4: no correctness risk (index-only). Item 8: `travel_fee` column addition — additive, default 0, confirmed no other reader sums `booking_items` in a way that would double-count (§8.6's own audit, not independently re-verified line-by-line in this pass — that belongs to the item-8-specific deepening) |

---

## 8 — What is PROVEN NOT SHARED (with commands)

1. **Items 3 and 6's six files** (`availability-data.ts`, `staff/[staffId]/availability/lib.ts`,
   both `page.tsx`, both Manager components) have **zero importers outside `src/app/admin`**:
   ```bash
   grep -rln "AvailabilityOverridesManager\|availability-data\|admin/staff/\[staffId\]/availability/lib" \
     src --include="*.ts" --include="*.tsx" | grep -v "^src/app/admin"
   # → no output
   ```

2. **Item 1's admin-only symbols** (`sendManualBookingReminder`, `canResendBookingEmails`,
   `ReminderResendForm`, and by extension the untouched RBAC/admin-access modules they live in) have
   no importer outside `src/app/admin`/`src/lib/auth`:
   ```bash
   grep -rln "sendManualBookingReminder|canResendBookingEmails|ReminderResendForm" \
     src --include="*.ts" --include="*.tsx" | grep -v "^src/app/admin"
   # → src/lib/auth/admin-access.ts, src/lib/auth/rbac.ts (both admin-auth libraries, not
   #   themselves imported by any public or customer file — verified by a second pass, not shown
   #   here for brevity, using the same grep pattern against those two filenames)
   ```

3. **`getBookingViewCounts` (item 4's query target)** is admin-only:
   ```bash
   grep -rln "getBookingViewCounts" src --include="*.ts" --include="*.tsx"
   # → src/app/admin/bookings/bookings-list-data.ts, src/app/admin/bookings/page.tsx,
   #   src/app/admin/bookings/__tests__/booking-view-counts.test.ts
   ```

4. **`BookingManagementForm.tsx` and `ManualBookingForm.tsx` do not import the shared shadcn
   primitives** item 7 edits (they use their own `AdminButton`/`AdminInput`):
   ```bash
   grep -n "from \"@/components/ui/button\"\|from \"@/components/ui/input\"\|from \"@/components/ui/badge\"" \
     src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/new/ManualBookingForm.tsx
   # → no output
   ```

5. **No `oklch(` literal exists anywhere outside the 99 admin files + 3 shared primitives** — the
   single command in §5a that bounds item 7's entire Phase A/B blast radius.

6. **`src/features/**` and `src/app/(public)/**` are independently confirmed at zero `oklch(`
   literals**, matching the plan's own claim (§7.7's "verified zero literals" line):
   ```bash
   grep -rl "oklch(" src/features "src/app/(public)" 2>/dev/null | wc -l
   # → 0
   ```

7. **No second route exists under `src/app/booking/`** beyond `/booking/manage` (§2 — `Glob
   src/app/booking/**` returns exactly 4 files: the test, the page, the forms component, the
   actions).

8. **No RLS policy and only one DB function reference `allowed_cities`** (§6a — live SQL, this
   session).

---

## 9 — Corrections to specific plan claims (tested, not assumed)

| # | Claim | Location | Verdict | Evidence |
|---|---|---|---|---|
| 1 | "six availability files that already carry 23 `oklch()` literals" | Top-level "Suggested order and commits" | **CONFIRMED** | §5g — exact per-file breakdown sums to 23 via ripgrep; a naive Bash-glob count gave 26 due to bracket-path mangling, not a plan error |
| 2 | "all 31 `page.tsx` routes" (Layer 3 sweep shape) | §7.9(b).3 | **CONFIRMED once reconciled** | 32 admin `page.tsx` files exist; the 32nd (`admin/page.tsx`) is a bare redirect stub with no renderable content, so 31 auditable routes is correct but should say so explicitly rather than stating a bare number an implementer might re-derive as 32 |
| 3 | "677 hardcoded `oklch(…)` colour literals across 99 files … plus 3 shared primitives" | §7.2 | **CONFIRMED exactly** | §5a |
| 4 | "0 `<Badge` call sites in `src/app/admin/**`" | §7.7a | **CONFIRMED, and understated** | §5c — badge.tsx has exactly 1 importer in the whole repo, and it is the customer page |
| 5 | "13 sites" / "9 more" for `renderSummary`/`renderBookingPlainText` | §8.8 | **CONFIRMED exactly** | §6d |
| 6 | "`create_booking_request` is the **only** DB function referencing `allowed_cities`", "no RLS policy does" | §8.2 | **CONFIRMED, re-verified live** | §6a |
| 7 | Live `bookings` index state (3 named indexes, nothing else) | §4.1 | **CONFIRMED, re-verified live** | §4 |
| 8 | "`src/app/(public)/**` … verified zero literals" | §7.7, §7.10 | **CONFIRMED** | §8.6 |
| 9 | The role loop in §7.9(b).2 lists `REPORTING` among roles to sweep | §7.9 | **Internally inconsistent, not a shared-surface finding but worth a one-line fix** | §7.4 elsewhere states plainly "There is no Reporting role in this system" and that `E2E_REPORTING_*` "has always been skipping" — the illustrative code block in §7.9 should drop `REPORTING` from the loop so an implementer doesn't waste time chasing credentials that cannot exist |

---

## 10 — Missing-from-plan items (proposed additions), consolidated

1. **`ManualBookingForm.tsx` is a genuine item-7 × item-8 collision** (§5h, §6b) — add to both
   items' file lists and to the top-level ordering note.
2. **`Textarea` is a third shared primitive `/booking/manage` renders** (§2) — add to §7.7a's table
   and Phase C's guard scope, even though it has nothing to fix today.
3. **`src/lib/booking/availability.ts` is dual-surface** (public widget + admin manual-booking
   calendar) — item 8's test list should name both consumers explicitly (§6c).
4. **Two customer-triggered email paths run through item 8's edited template code** — add the named
   test in §6d to §8.10.
5. **Four `lib/booking/__tests__/*.test.ts` fixture files reference `allowed_cities`** and are not in
   item 8's file/test list — add a "re-run and update fixtures" line (§6b).
6. **`/booking/manage`'s structural immunity to dark-mode admin-token resolution** is a fact worth
   stating explicitly in §7.7a, not just implied — it changes what "capture before/after in both
   themes" means for this specific route (§5e).
7. **The admin-unauthenticated route class** (`/admin/login`, `/admin/password-reset*`) is real and
   distinct from both "admin-authenticated" and "public" — worth naming in the plan's own vocabulary
   since it explains why the Layer-3 sweep's "UNAUTHENTICATED" row exists and behaves differently
   from every other row (§1d).

---

## 11 — Stop conditions for an implementer working from this report

- **Stop if** any edit to `src/lib/email/notifications.ts` for item 1 touches code above the
  `sendReviewRequestEmail`-specific block that `sendBookingCancellationEmails` or
  `sendBookingRescheduleRequestEmails` also execute — re-grep both function bodies first.
- **Stop if** item 7's Phase B substitution in `badge.tsx`/`button.tsx`/`input.tsx` produces *any*
  visible difference on `/booking/manage` in light mode (the only mode that route can render admin
  tokens in) — per §7.7a, this is a STOP not a note, and this audit's structural analysis (§5e)
  means a dark-mode difference on that specific route would indicate the architecture itself changed
  underneath the plan's assumptions, which is its own, larger stop condition.
- **Stop if**, when implementing item 8 Phase 5, `ManualBookingForm.tsx`'s `isCityKnown` copy is
  found to now gate submission (rather than being advisory-only, as confirmed in this session) — that
  would mean the file changed since this audit and the "no functional fix needed" conclusion no
  longer holds.
- **Stop if** a second importer of `@/components/ui/badge` appears anywhere in `src/app/admin` before
  or during item 7 — that would falsify §5c's "zero admin call sites" finding this report's
  prioritisation recommendation depends on.

## 12 — Rollback

Nothing in this audit is itself irreversible — no code, config, or migration was written. For the
items this report bears on:
- Item 7 Phase B substitutions: `git diff`-revertible per file, no data involved.
- Item 8's `ManualBookingForm.tsx` copy addition (recommended in §5h/§10.1): a plain string change,
  revertible the same way.
- Item 1's stop condition (§11) has no rollback implication — it's a guard against making a change in
  the first place.

---

## 13 — Tests to add (named), specific to this report's findings

| Test name | File | Asserts |
|---|---|---|
| `admin theming — /booking/manage renders unchanged after Button/Input/Badge substitution (light)` | new, e.g. `e2e/booking-manage-contrast.spec.ts` or added to `e2e/admin-contrast.spec.ts` per §7.7a's binding requirement #3 | Screenshot or computed-style diff of `/booking/manage` before/after Phase B, light mode only (see §5e for why dark is structurally moot on this route today) |
| `notifications.ts — sendBookingCancellationEmails and sendBookingRescheduleRequestEmails unaffected by review-cooldown changes` | `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` or a new file alongside it | Existing tests for these two functions (if any) still pass unmodified after item 1 lands; if none exist today, add a minimal one asserting they still call `getBookingTemplateInput` and send, unaffected by the new cooldown constant/helper |
| `availability.ts — isCityAllowed removal does not break the admin manual-booking month view` | `src/app/api/admin/availability/month/route.ts`'s existing test (locate by symbol; not enumerated in this pass) or a new test alongside `src/app/api/availability/route.test.ts` | An out-of-zone city still returns slots via `/api/admin/availability/month`, mirroring the public-path test the plan already specifies |
| `getBookingTemplateInput — customer-triggered cancellation/reschedule emails include travel_fee in total` | new, alongside `notifications.ts`'s existing email tests | Mocked mailer; a booking with `travel_fee > 0` cancelled via the `sendBookingCancellationEmails` path (as `/booking/manage/actions.ts` calls it) renders the fee-inclusive total in both the HTML (`renderSummary`) and plain-text (`renderBookingPlainText`) bodies |
| `ManualBookingForm — out-of-zone city warning uses free-travel language, not rejection language, post item-8` | `src/app/admin/bookings/new/ManualBookingForm.test.tsx` (locate by symbol — file may not exist yet under this exact name) | The `isCityKnown`-false message no longer reads "outside our current service area" but the reworded free-travel-zone copy, and does not block form progression |
