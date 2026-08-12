# B2 — `src/app/admin/emails/page.tsx` current state (post Batch A / post item 8)

Read-only derivation. HEAD `530d154`. File read in full (all 962 lines); every symbol below was
relocated by name, not trusted from any prior document. Commands are given verbatim so they can be
re-run.

```
wc -l src/app/admin/emails/page.tsx
962
```
(The file has a trailing newline, so `Read` shows a phantom empty "line 963"; `wc -l` — the count
that matters — is 962.)

---

## 1. Components defined in this file, with line ranges

Nine functions return JSX (components). One more (`resolveTab`) returns a plain `TabKey` and is
not a component; four more are boolean/number predicates used as local helpers.

| # | Symbol | Kind | Lines |
|---|---|---|---|
| 1 | `EmailsPage` (default export) | async server component | `114–334` |
| 2 | `TabStrip` | component | `344–398` |
| 3 | `DeliveryTab` | component | `402–492` |
| 4 | `DeliveryEmpty` | component | `494–554` |
| 5 | `DayGroupedFeed` | component | `556–643` |
| 6 | `DeliveryEventRow` | component | `647–791` |
| 7 | `RecipientFallback` | component | `793–813` |
| 8 | `RemindersTab` | component | `817–854` |
| 9 | `ReminderRow` | component | `856–933` |

Non-component helpers in the same file (for completeness, since Batch B will likely add one of
each kind):

| Symbol | Lines |
|---|---|
| `resolveTab` (plain function, `TabKey` return) | `80–88` |
| `isEventType` | `937–939` |
| `isDeliveryStatus` | `941–943` |
| `isRecipientRole` | `945–947` |
| `countFailedRecent` | `950–961` |

Types/interfaces: `TabKey` (`78`), `PageProps` (`93–112`), `BadgeDescriptor` (`338–342`).

Section-comment dividers already present (for the new tab's own section, mirror the style):
`// ─── Tab strip ──…` (`336`), `// ─── Delivery tab ──…` (`400`), `// ─── Delivery event row ──…`
(`645`), `// ─── Reminders tab ──…` (`815`), `// ─── Local helpers ──…` (`935`).

---

## 2. `TabKey`, `resolveTab`, `tabs` array — relocated, verbatim

All three plan-stated locations (`:78`, `:80-88`, `:263-291`) were verified against the file as
read today and **matched exactly — no drift**.

`TabKey`, line `78`:
```ts
type TabKey = "delivery" | "reminders" | "templates";
```

`resolveTab`, lines `80–88`:
```ts
function resolveTab(
  raw: string | undefined,
  canSeeDelivery: boolean
): TabKey {
  if (raw === "delivery" && canSeeDelivery) return "delivery";
  if (raw === "reminders") return "reminders";
  if (raw === "templates") return "templates";
  return canSeeDelivery ? "delivery" : "reminders";
}
```

`tabs` array, lines `263–291`:
```ts
  const tabs: { key: TabKey; label: string; badge?: BadgeDescriptor; visible: boolean }[] = [
    {
      key: "delivery",
      label: "Delivery",
      visible: canSeeDelivery,
      badge:
        failedRecent > 0
          ? { value: failedRecent, tone: "danger", title: `${failedRecent} failed in the last 24 hours` }
          : undefined,
    },
    {
      key: "reminders",
      label: "Reminders",
      visible: canResend,
      badge:
        canResend && upcomingBookings.length > 0
          ? {
              value: upcomingBookings.length,
              tone: "muted",
              title: `${upcomingBookings.length} upcoming bookings without a reminder yet`,
            }
          : undefined,
    },
    {
      key: "templates",
      label: "Templates",
      visible: true,
    },
  ];
```

---

## 3. `activeTab`, `TabStrip`, and how a tab switches

`activeTab` is computed once, right after `searchParams` is awaited:
```ts
// line 130
  const params = await searchParams;
// line 131
  const activeTab = resolveTab(params.tab, canSeeDelivery);
```
`PageProps.searchParams` (`93–112`) types `tab` as `tab?: string` — an ordinary URL query string,
not a route param.

`TabStrip` — `src/app/admin/emails/page.tsx:344–350` (props are an inline object type, not a named
interface):
```ts
function TabStrip({
  tabs,
  activeTab,
}: {
  tabs: { key: TabKey; label: string; badge?: BadgeDescriptor; visible: boolean }[];
  activeTab: TabKey;
}) {
```
Called once, at line `300`:
```tsx
      <TabStrip tabs={tabs.filter((t) => t.visible)} activeTab={activeTab} />
```

The switch mechanism (inside `TabStrip`, lines `362–363`):
```tsx
              <Link
                href={`/admin/emails?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
```
This is a plain Next.js `<Link>` to a new `?tab=` URL — **a full server round-trip through
`searchParams`, not client React state.** There is no `"use client"` directive anywhere in
`page.tsx` (confirmed: line 1 is `import type { Metadata } from "next";` with nothing before it),
no `useState`/`useTransition` for tab selection, and no client wrapper around `TabStrip`. Every
tab's content is gated server-side by `activeTab === "<key>" && <permission>` (lines `302`, `319`,
`326`).

**Conclusion for the plan's stop condition (§1.10 line 439 of `POST-BAND-C-FOLLOWUP-plan.md`):**
adding a tab does **not** require restructuring how `searchParams` flow. It is additive in the
same shape as the existing three: extend the `TabKey` union (`78`), extend `resolveTab` (`80–88`)
with one more `if`, push one more object onto `tabs` (`263–291`), fetch whatever data the tab
needs (either add a field to `getEmailsPageData`'s return, gated by a new param the way
`includeTemplates` gates the Templates-only queries at line `171`, or call a sibling fetcher
awaited alongside it at `159–173`), and add one more `{activeTab === "<key>" && <permission> ? (…)
: null}` block after line `331`, reusing the `AdminPageHeader`/`TabStrip` wrapper already rendered
at `295–300` rather than duplicating it. No STOP condition triggered.

---

## 4. Permission booleans — exact expressions and lines

```ts
// line 119
  const canSeeDelivery = canViewEmailLogs(profile);
// line 120
  const canResend = canResendBookingEmails(profile);
```
```ts
// line 157
  const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);
```
All three are computed from `profile` (`getStaffProfile(supabase)`, awaited at line `116`) and
never recomputed later in the function. `canSeeAllBookings` is the odd one out: it ORs two RBAC
checks and is used only inside the `getEmailsPageData({...})` call (line `168`), not for any tab's
`visible` flag. (Not asked for, but adjacent and worth flagging: `canManageEmailTemplates(profile)`
is called inline at the Templates tab's JSX, line `328` — it is **not** hoisted to a named
boolean the way the other three are.)

---

## 5. `RemindersTab` and `ReminderRow` — verbatim, with every class string

`RemindersTab`, lines `817–854`:
```tsx
function RemindersTab({
  bookings,
  lastReminderByBooking,
}: {
  bookings: ReminderBooking[];
  lastReminderByBooking: Map<string, string>;
}) {
  if (bookings.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <EmptyState
          icon={CalendarClock}
          illustrationSrc="/images/admin/empty-states/reminders-empty.svg"
          title="No upcoming bookings need a reminder"
          message="Everyone's confirmed."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-[720px] gap-4 text-left">
      <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
        Sends the existing reminder template. No private email bodies are stored.
      </p>
      <ul className="grid list-none gap-3 [&>li]:list-none">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <ReminderRow
              booking={booking}
              lastReminderAt={lastReminderByBooking.get(booking.id) ?? null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`ReminderRow`, lines `856–933`:
```tsx
function ReminderRow({
  booking,
  lastReminderAt,
}: {
  booking: ReminderBooking;
  lastReminderAt: string | null;
}) {
  const hasRecipient = Boolean(booking.contact_email);
  const lastReminder = lastReminderLine(lastReminderAt);

  return (
    <article
      className={cn(
        "grid grid-cols-[auto_1fr] gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors duration-150 hover:border-[var(--admin-primary)]/30 hover:shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]",
        "sm:grid-cols-[auto_1fr_auto] sm:items-center"
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(96%_0.012_88)] font-semibold text-[var(--admin-primary)]"
      >
        {initialsFromName(booking.contact_full_name)}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="min-w-0 break-words text-sm font-semibold text-[var(--admin-heading)] underline-offset-4 outline-none transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
          >
            {booking.contact_full_name ?? "Unknown contact"}
          </Link>
          {!hasRecipient ? (
            <span title="This booking has no email address — fix on the booking detail page.">
              <AdminStatusBadge
                tone="warning"
                compact
                value="No recipient on file"
              />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-[var(--admin-body)] [font-variant-numeric:tabular-nums]">
          {formatReminderDateTime(booking.booking_date, booking.start_time)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--admin-text-muted)]">
          {hasRecipient ? (
            <span className="min-w-0 truncate">{booking.contact_email}</span>
          ) : (
            <Link
              href={`/admin/bookings/${booking.id}`}
              className="text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:underline"
              title="This booking has no email address — fix on the booking detail page."
            >
              Add an email on the booking
            </Link>
          )}
          {lastReminder ? (
            <>
              <span aria-hidden="true">·</span>
              <span title={lastReminder.absolute}>
                Last reminder: {lastReminder.display}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="col-span-2 justify-self-stretch sm:col-span-1 sm:justify-self-end">
        <ReminderResendForm
          bookingId={booking.id}
          contactFullName={booking.contact_full_name}
          hasRecipient={hasRecipient}
        />
      </div>
    </article>
  );
}
```

Notes for mirroring the visual language exactly:
- Row shell: `grid grid-cols-[auto_1fr] gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors duration-150 hover:border-[var(--admin-primary)]/30 hover:shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]` plus `sm:grid-cols-[auto_1fr_auto] sm:items-center` — **this shadow value is one of the file's 17 raw-`oklch(` lines**, so a new row that copies it verbatim is copying a literal item 7 will later tokenize; see §6.
- Avatar chip: `inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(96%_0.012_88)] font-semibold text-[var(--admin-primary)]` — the background here (`oklch(96%_0.012_88)`) is **also** a raw literal, reused identically at `DeliveryEventRow` line `682` for its default icon chip.
- Missing-recipient state uses `AdminStatusBadge tone="warning"`, not a hand-rolled badge — this is the existing pattern to copy for any new tab badge (see §6).
- List wrapper: `<section className="mx-auto grid w-full max-w-[720px] gap-4 text-left">` — every `RemindersTab`-family tab is capped at `max-w-[720px]` and centered; `DeliveryTab`/`TemplateGallery` are not (they use the full `AdminPanel` width). A new tab styled like Reminders should reuse this cap.
- Empty state: `<section className="mx-auto w-full max-w-[720px]">` wrapping `<EmptyState icon={...} illustrationSrc="/images/admin/empty-states/<name>.svg" title="…" message="…" />` — a new tab needs its own `illustrationSrc` asset or should omit the prop (`EmptyState` presumably tolerates its absence; not verified here as out of scope).

---

## 6. Item 7 constraint — raw `oklch(` count and the `--admin-*` token vocabulary already in this file

Exact commands run against `src/app/admin/emails/page.tsx` today:
```
$ grep -o 'oklch(' src/app/admin/emails/page.tsx | wc -l
29
$ grep -c 'oklch(' src/app/admin/emails/page.tsx
17
```
**29 raw `oklch(` occurrences across 17 lines.** This matches the plan's own current figure
(`POST-BAND-C-FOLLOWUP-plan.md` line 2259: *"`emails/page.tsx` (29 occurrences today … a prior
review dated 2026-08-10 recorded 17, genuine drift since"*) — so today's 29/17 is itself confirmed,
not stale.

`var(--admin-*)` tokens already referenced in this file today (`grep -o -- '--admin-[a-zA-Z0-9-]*' src/app/admin/emails/page.tsx | sort -u`), 12 unique names:
```
--admin-body
--admin-border
--admin-border-form
--admin-focus
--admin-heading
--admin-on-primary
--admin-panel
--admin-panel-muted
--admin-primary
--admin-radius-card
--admin-radius-control
--admin-text-muted
```
(Separately, `--font-admin-serif` and `--font-admin-mono` also appear, lines `609/612` and
`764/806` — a different, font-family namespace, not a color/surface token.)

Categorized for the new tab:

| Category | Token(s) available **in this file today** |
|---|---|
| Surface | `--admin-panel` (default card bg), `--admin-panel-muted` (secondary/muted bg — used for inactive tab pills and muted badge bg) |
| Border | `--admin-border` (default), `--admin-border-form` (inputs, used by `DeliveryFilterStrip`'s wrapper) |
| Text (heading/body) | `--admin-heading` (names, headings), `--admin-body` (body copy, e.g. the reminder date/time line) |
| Muted text | `--admin-text-muted` |
| Primary button / accent | `--admin-primary` (bg/text/border accent), `--admin-on-primary` (text color painted on top of a `--admin-primary` background, e.g. the active tab pill) |
| Focus ring | `--admin-focus` (not asked for, but present — every interactive element's `focus-visible:ring-[var(--admin-focus)]/55`) |
| Radius | `--admin-radius-card`, `--admin-radius-control` (layout tokens, not color, but part of the same discipline) |
| **Badge tones** | **None** — see below |

**Badge tones are the one category with no `var(--admin-*)` name of its own inside `page.tsx`.**
Two different patterns coexist in the file today, and only one of them is tokenized:
1. **Tokenized, via the component:** `<AdminStatusBadge tone="muted" | "warning" | "danger" | …>`
   (used at lines `622`, `693`, `700`, `705`, `890`). The `tone` prop's color resolution lives
   entirely in `src/app/admin/components/admin-ui.tsx` (not this file) — `statusBgClasses` /
   `statusTextClasses` (lines `29–49`) and `panelBorderClasses` (`51–60`), keyed by the shared
   `AdminTone` union (`"default" | "muted" | "warning" | "danger" | "success" | "info" |
   "restricted" | "gold"`, `admin-ui.tsx:15–23`). Those maps already resolve to
   `--admin-status-confirmed-bg/-text/-border`, `--admin-status-attention-bg/-text/-border`,
   `--admin-status-cancelled-bg/-text/-border`, `--admin-status-pending-bg/-text/-border`,
   `--admin-status-restricted-bg/-text/-border` (plus `--rahma-gold` for the `gold` tone) — a
   full token vocabulary that already exists, just not inside `page.tsx` itself.
2. **Not tokenized, raw literals in `page.tsx` itself:** the "failed" tab-badge in `TabStrip`
   (`bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]`, lines `382`), the `failedInGroup`
   badge in `DayGroupedFeed` (same two literals, lines `607`), the delivery-error banner
   (`oklch(85%_0.06_25)` / `oklch(95.5%_0.028_20)` / `oklch(26%_0.14_25)` / `oklch(70%_0.10_25)` /
   `oklch(92%_0.045_20)`, lines `442–452`), the failed/missing-recipient icon chip in
   `DeliveryEventRow` (`oklch(95.5%_0.028_20)` / `oklch(26%_0.14_25)` / `oklch(95.0%_0.050_65)` /
   `oklch(26%_0.130_55)` / `oklch(96%_0.012_88)`, lines `679–682`), and the provider-error
   `<details>` block (five more `oklch(88%_0.045_20)` / `oklch(95.5%_0.028_20)` /
   `oklch(26%_0.14_25)` occurrences, lines `747–770`). These bypass `AdminStatusBadge` entirely and
   are exactly the literals item 7 is scoped to replace — most map 1:1 onto the *already-existing*
   `--admin-status-cancelled-*` (danger/failed) and `--admin-status-attention-*`
   (warning/missing-recipient) tokens from point 1 above, they just aren't wired to them yet.

**Implication for Batch B:** the new tab should express any status/tone coloring through
`<AdminStatusBadge tone="...">` (reusing the `AdminTone` values that already exist — `"success"`
maps to `--admin-status-confirmed-*` and reads naturally as "sent"; `"warning"` maps to
`--admin-status-attention-*` for "no recipient" / "cooling down", matching the existing pattern at
`ReminderRow` line `889`) rather than either (a) hand-writing new `oklch(...)` literals as pattern
2 above does, or (b) inventing a new `--admin-badge-*` custom property that doesn't exist anywhere
in the codebase today. For plain surfaces/borders/text, use the 12 tokens already in this file
(table above) rather than the file's own raw-`oklch(` shadow/avatar-chip literals noted in §5.

---

## 7. Existing test file(s) for this page

**No test file imports or renders `src/app/admin/emails/page.tsx` itself** — confirmed by
`grep -rn "emails/page" src` (two hits, both prose comments in unrelated files
`operations/page.tsx:80` and `operations-data.ts:36`, not imports) and by grepping the three test
files below for `EmailsPage`/`resolveTab`/`TabStrip` (zero matches). `TabKey`, `resolveTab`, the
`tabs` array, `TabStrip`, `DeliveryTab`, `RemindersTab`, and `ReminderRow` all have **zero existing
automated coverage** — any verification of the new tab's rendering/wiring will be manual
(dev-server smoke test), not a passing/failing suite.

Three test files exist in `src/app/admin/emails/__tests__/`, but all three test the *data/action
layer* `page.tsx` calls into, not the page component itself:

| File | Lines | `it`/`it.each` blocks (counted via `grep -oE '  it\(|it\.each' <file> \| wc -l`) | What it asserts |
|---|---|---|---|
| `emails-data.test.ts` | 467 | 29 | `getEmailsPageData`'s cache-key behavior (per permission scope, business date, limit/offset, templates-only gating, JSON-safe return shape), `getFilteredDeliveryEvents`'s filter-wiring and cache keys, the `q`-filter's `or()` string quoting, `resolveDeliveryDateBounds`'s date-math stability/correctness under a fixed clock, `countEmailDeliveryEvents`'s query parity with the row query, and `getEmailDeliveryPage`'s page-clamping. |
| `resendEmail.test.ts` | 541 | 23 | The `resendEmail` server action's RBAC (permission + active-profile checks), event lookup/skipped-event refusal, the `booking_assignments` scope check for Therapist-class actors, rate limiting, `null` vs present `booking_id` query semantics, per-event-type dispatch (confirmation/cancellation/staff assignment/etc.), and the happy-path audit-log write. |
| `sendManualBookingReminder.test.ts` | 120 | 2 | Cache-tag invalidation (`emails` + `audit`) on a successful send, and that `updateTag` is never called when the send fails. |

---

## 8. Server component confirmation and top-of-function await block

`page.tsx` has no `"use client"` directive (line 1 is the first import, nothing precedes it), and
the default export is declared `async function` (line `114`) — this is an **async React Server
Component**, consistent with Next's App Router `page.tsx` default.

Top-of-function await block, verbatim, lines `114–131`:
```ts
export default async function EmailsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const canSeeDelivery = canViewEmailLogs(profile);
  const canResend = canResendBookingEmails(profile);
  if (!canSeeDelivery && !canResend) {
    return (
      <AdminAccessDenied
        title="Email access limited"
        message="You need email or booking-management access to see delivery status. Ask the practice owner."
      />
    );
  }

  const params = await searchParams;
  const activeTab = resolveTab(params.tab, canSeeDelivery);
```
Two further awaits happen later, not at the top:
- The main data read, lines `159–173` — `const { events: allEvents, deliveryError, reminderBookings: upcomingBookings, templateOverrideSummaries, templateStaff } = await getEmailsPageData({ canSeeDelivery, canResend, canSeeAllBookings, staffId: profile.id, businessDate: getBusinessDate(), includeTemplates: activeTab === "templates", limit: PAGE_SIZE });`
- A conditional second fetch, lines `233–239` — `const deliveryPage = canSeeDelivery ? await getEmailDeliveryPage({ canSeeDelivery, filters: deliveryFilters, page: params.page }) : { rows: [] as EmailEvent[], total: 0, page: 1, pageCount: 1, deliveryError: null };` (only runs the query when `canSeeDelivery` is true; otherwise a static empty shape, no await).

A Batch B data fetch (e.g. "bookings eligible for a manual review-request send") would most
naturally join the `159–173` block (as a new field on `getEmailsPageData`'s return, gated by a new
boolean param the way `includeTemplates` gates the Templates-only reads) rather than adding a
third top-level `await`, per the existing convention.
