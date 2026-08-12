# B2 — `src/lib/email/notifications.ts` as it stands today (post Batch A + item 8)

Verified by reading the live file end-to-end (1654 lines) plus its two direct
consumers (`src/app/api/cron/review-emails/route.ts`,
`src/app/admin/emails/actions.ts`). Every line number below is what `Read`
reported for that exact symbol today, not a plan figure.

---

## 1. `sendReviewRequestEmail`

**File:line: `src/lib/email/notifications.ts:1518-1630`** (113 lines, own function
body only — `deriveGroupCategoryForBooking` starts fresh at 1632).

Current full signature, verbatim:

```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { ignoreClientCooldown?: boolean } = {}
): Promise<{
  sent: boolean;
  reason?: "no_email" | "already_sent" | "send_failed" | "client_recently_asked";
}> {
```

**This already matches what the task brief says Batch A "was supposed to add."**
Batch A shipped it exactly: a third `options` param, object-typed, with a single
optional `ignoreClientCooldown?: boolean` field, default `{}`; the reason union
grew a fourth member `"client_recently_asked"` appended after `"send_failed"`.
No drift — parameter names, order, optionality and the reason union all match.

Full body, verbatim (1518-1630):

```ts
export async function sendReviewRequestEmail(
  bookingId: string,
  supabase: SupabaseClient,
  options: { ignoreClientCooldown?: boolean } = {}
): Promise<{
  sent: boolean;
  reason?: "no_email" | "already_sent" | "send_failed" | "client_recently_asked";
}> {
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, client_id, contact_email, completed_at, review_email_sent_at, status, clients(email, city)"
    )
    .eq("id", bookingId)
    .maybeSingle<ReviewEmailBookingRow>();

  if (bookingErr || !booking) {
    throw new Error(`sendReviewRequestEmail: booking ${bookingId} not found.`);
  }
  if (booking.status !== "completed") {
    return { sent: false, reason: "send_failed" }; // status flipped between cron read and now
  }
  if (booking.review_email_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    // Mark as "handled" — don't keep retrying a no-email booking.
    await supabase
      .from("bookings")
      .update({ review_email_sent_at: new Date().toISOString() })
      .eq("id", bookingId);
    return { sent: false, reason: "no_email" };
  }

  // Ordered after `no_email` deliberately: a booking with no address can never
  // bother anyone, so retiring it is right regardless of the cooldown, and
  // leaving it un-retired would keep it in the candidate set for months.
  if (!options.ignoreClientCooldown && booking.client_id) {
    const asked = await getClientsAskedForReviewSince(
      [booking.client_id],
      reviewCooldownStart(),
      supabase
    );
    if (asked.has(booking.client_id)) {
      // ⛔ Do NOT write the review_email_sent_at sentinel here. This booking
      // has not been handled, it has been skipped for now — writing the
      // sentinel would permanently retire a booking a later manual send may
      // legitimately want.
      return { sent: false, reason: "client_recently_asked" };
    }
  }

  const { input } = await getBookingTemplateInput(bookingId, supabase);
  const groupCategory = await deriveGroupCategoryForBooking(bookingId, supabase);
  const city = booking.clients?.city ?? null;

  const reviewInput: ReviewRequestEmailInput = {
    ...input,
    groupCategory,
    city,
  };

  // C-C fix round (F-6) — resolve overrides and pick the 3-of-5 review
  // samples ONCE, then pass the same selection into both legs. Previously
  // each leg independently called resolveTemplateOverrides + Math.random-based
  // pickReviewMessages, so on ~90% of sends the HTML part listed three
  // review samples and the plain-text part listed a different three in the
  // same email — and because resolveTemplateOverrides swallows errors and
  // returns {}, a first-read success paired with a second-read failure (or
  // vice versa) could show edited copy in one leg but factory defaults in
  // the other.
  const overrides = await resolveTemplateOverrides("review_request_client");
  const variants = pickReviewMessages({ groupCategory, city, overrides });
  const html = await renderReviewRequestEmail(reviewInput, overrides, variants);
  const text = renderReviewRequestPlainText(reviewInput, variants, overrides);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "review_request_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: resolveSubject(
      "review_request_client",
      overrides,
      buildVarMap(reviewInput, {
        city: city ?? "",
        service_name: input.participants[0]?.services?.[0] ?? "appointment",
      })
    ),
    html,
    text,
  });

  // Mark sentinel — guarded by WHERE review_email_sent_at IS NULL as defense
  // against a parallel cron tick sending twice.
  const { data: marked } = await supabase
    .from("bookings")
    .update({ review_email_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .is("review_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!marked) {
    // Parallel cron tick already marked the sentinel first. The email may
    // have been double-sent; log for monitoring but don't fail the request.
    console.warn(`sendReviewRequestEmail: sentinel race for booking ${bookingId}`);
  }

  return { sent: true };
}
```

Note the booking select at the top (`"id, client_id, contact_email, completed_at, review_email_sent_at, status, clients(email, city)"`)
does **not** include `recurring_template_id` — relevant to Q5/Q6 below.

---

## 2. `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS`

**Exists. Exported. `notifications.ts:1367`. Value: `6`.**

```ts
export const REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS = 6;
```

Immediately preceded by a comment block (1352-1366) explaining the cooldown is
derived from `email_delivery_events`, not a new `clients` column or
`bookings.review_email_sent_at` (that column doubles as a "no email, handled"
marker, so it would false-suppress a client who later added an email).

---

## 3. `getClientsAskedForReviewSince`

**Exact name confirmed** (task brief's "or whatever Batch A actually named it" —
it is literally this name, no rename). **Exported. `notifications.ts:1413-1446`.**

Signature:

```ts
export async function getClientsAskedForReviewSince(
  clientIds: string[],
  since: string,
  supabase: SupabaseClient
): Promise<Set<string>>
```

Query issued, verbatim (1423-1429):

```ts
const { data, error } = await supabase
    .from("email_delivery_events")
    .select("bookings!inner(client_id)")
    .eq("event_type", "review_request_client")
    .eq("delivery_status", "accepted")
    .gte("created_at", since)
    .in("bookings.client_id", clientIds);
```

Guard: `clientIds.length === 0` short-circuits to `new Set()` before the query
(1421). Only `delivery_status = 'accepted'` counts as "asked" — the function's
own comment (1405-1411) flags this as correct *only* because
`sendReviewRequestEmail` never passes `delaySeconds`, so a review request can
never sit in `queued`; if that ever changes this filter must widen to include
`sent` or a real send becomes invisible to the cooldown check.

---

## 4. `classifyReviewClient` + its batch helper

**Exact name confirmed. Exported. `notifications.ts:1491-1497`.**

```ts
export function classifyReviewClient(input: {
  recurringTemplateId: string | null;
  completedBookingCount: number;
}): ReviewClientClass {
  if (input.recurringTemplateId) return "series";
  return input.completedBookingCount >= 2 ? "returning" : "first_time";
}
```

Return type `ReviewClientClass` is defined and exported at
**`notifications.ts:1369`**: `export type ReviewClientClass = "series" | "returning" | "first_time";`

Batch helper that feeds it (`completedBookingCount`) — **`getCompletedBookingCountsByClient`,
exported, `notifications.ts:1457-1479`**, one GROUP-BY-in-JS query per tick over
`bookings` where `status = 'completed'`:

```ts
export async function getCompletedBookingCountsByClient(
  clientIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  if (clientIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("bookings")
    .select("client_id")
    .eq("status", "completed")
    .in("client_id", clientIds);

  if (error) {
    throw new Error(`getCompletedBookingCountsByClient: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { client_id: string | null }[]) {
    if (!row.client_id) continue;
    counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
  }
  return counts;
}
```

`recurringTemplateId` (the other classifier input) is **not** fetched by any
helper in `notifications.ts` — the cron route selects it directly off its own
`bookings` candidate query (see Q5).

---

## 5. Does `sendReviewRequestEmail` compute the class itself, or only the cron route?

**Only the cron route computes it. Confirmed by reading both files.**

- `sendReviewRequestEmail`'s body (quoted in full above) never calls
  `classifyReviewClient`, `getCompletedBookingCountsByClient`, or references
  `recurring_template_id` anywhere. `Grep "classifyReviewClient" src/`
  (measured this session) returns **10 matching lines across 4 files**: the
  definition in `notifications.ts:1491` (1 line — no second, internal call
  site), one call site in `route.ts` (import at line 29, call at line 159),
  and 8 lines across the two test files (`review-emails.test.ts` and
  `sendReviewRequestEmail.test.ts`, which exercises `classifyReviewClient` as
  a standalone pure-function unit test, not through `sendReviewRequestEmail`).
  Inside `notifications.ts` itself the symbol appears exactly once — its own
  `export function` line — confirming `sendReviewRequestEmail` never calls it.
- In `src/app/api/cron/review-emails/route.ts:154-166`, the cron computes
  `clientClass` from its own already-batched `completedCounts` map and the
  candidate row's own `recurring_template_id` (selected at route.ts:128,
  `"id, client_id, recurring_template_id"`), **then calls
  `sendReviewRequestEmail(candidate.id, supabase)` with no class argument at
  all** (route.ts:166). The class is used only to stamp
  `audit_logs.after_state.client_class` (route.ts:180) — it never reaches the
  render/copy path.

**Consequence for Step 1e:** the seam cannot be "free" inside
`sendReviewRequestEmail` today. Two ways to close the gap, both requiring real
plumbing:
1. Compute the class inside `sendReviewRequestEmail` itself — but its own
   booking select (line ~1528-1532 above) does not fetch
   `recurring_template_id`, so that column must be added to the select, and
   `completedBookingCount` would need either a new single-client scalar query
   or a call to `getCompletedBookingCountsByClient([booking.client_id!])` (a
   one-element batch call is wasteful but reuses the existing helper without a
   new function).
2. Accept the class as a parameter passed in by the caller (the cron already
   computes it — it would just need to also pass it through) — cheaper for
   the cron path, but the manual admin send (Batch B) would then need to
   compute it too before calling `sendReviewRequestEmail`, duplicating the
   query the cron already does per-tick.

Either way, `classifyReviewClient`'s result is not visible to
`pickReviewMessages` today — see Q6.

---

## 6. `pickReviewMessages`

**File:line: `src/lib/email/templates.ts:833-858`** (not in `notifications.ts` —
imported into it via the `./templates` barrel import at
`notifications.ts:45`).

Exact current signature:

```ts
export function pickReviewMessages(
  args: PickReviewMessagesArgs
): ReviewMessageVariant[] {
```

Where `PickReviewMessagesArgs` (templates.ts:818-823) is:

```ts
interface PickReviewMessagesArgs {
  groupCategory: "massage" | "cupping" | null;
  city: string | null;
  overrides: Record<string, string>;
  random?: () => number;
}
```

**Its options object today accepts exactly four fields: `groupCategory`, `city`,
`overrides`, and an optional `random` (test-injection seam for the shuffle).
There is no client-class field of any kind.** This is Step 1e's seam — adding
class-based variation means widening this args object (or branching before the
call), plus deciding which of the 5-pooled `{category}_variant_{1..5}` keys
(or a new key namespace) map to which class.

Full body, verbatim (833-858):

```ts
export function pickReviewMessages(
  args: PickReviewMessagesArgs
): ReviewMessageVariant[] {
  const { groupCategory, city, overrides, random = Math.random } = args;
  const category = groupCategory ?? "massage";

  const pool: ReviewMessageVariant[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `${category}_variant_${i}`;
    const overrideValue = overrides[key];
    if (overrideValue) {
      pool.push({ text: overrideValue, source: "override" });
    } else {
      pool.push({ text: fieldDefault("review_request_client", key), source: "default" });
    }
  }

  // Shuffle and pick 3.
  const shuffled = [...pool].sort(() => random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return picked.map((variant) => ({
    ...variant,
    text: substituteCity(variant.text, city),
  }));
}
```

Return type: `ReviewMessageVariant[]`, where `ReviewMessageVariant`
(templates.ts:813-816) is `{ text: string; source: "override" | "default" }`.

The handoff doc's own note (`redesign/HANDOFF-2026-08-12-IMPLEMENTATION-3.md:279`)
— *"The seam is `pickReviewMessages({ groupCategory, city, overrides })`;
`classifyReviewClient` already exists and its result is already in the audit
trail"* — checks out exactly as written: no drift on that claim.

---

## 7. `resolveTemplateOverrides` / `renderReviewRequestEmail` / `renderReviewRequestPlainText`

All three live in `src/lib/email/templates.ts`, not `notifications.ts`.

**`resolveTemplateOverrides` — `templates.ts:708-730`:**

```ts
export async function resolveTemplateOverrides(
  templateId: string
): Promise<Record<string, string>> {
```

Generic — not review-specific. Reads `email_template_overrides` filtered by
`template_id`, swallows any DB error/throw and returns `{}` (logged via
`console.error`), so a lookup failure degrades to factory-default copy rather
than failing the send.

**`renderReviewRequestEmail` — `templates.ts:905-946`:**

```ts
export async function renderReviewRequestEmail(
  input: ReviewRequestEmailInput,
  providedOverrides?: Record<string, string>,
  providedVariants?: ReviewMessageVariant[]
): Promise<string> {
```

`providedOverrides`/`providedVariants` are both optional — when omitted it
independently calls `resolveTemplateOverrides("review_request_client")` and
`pickReviewMessages(...)` itself. `sendReviewRequestEmail` always supplies
both (see body in Q1) specifically so the HTML and plain-text legs of one send
can never disagree on which 3 of 5 samples they show (C-C fix round F-6, per
the comment at templates.ts:898-904).

**`renderReviewRequestPlainText` — `templates.ts:956-961+`** (signature only
shown; body continues past the read window):

```ts
export function renderReviewRequestPlainText(
  input: ReviewRequestEmailInput,
  variants: ReviewMessageVariant[],
  overrides: Record<string, string> = {}
): string {
```

Synchronous (not async, unlike its HTML sibling) — `variants` is a required
positional param here (not optional), `overrides` defaults to `{}`.

---

## 8. Is a new server-action caller of `sendReviewRequestEmail` safe?

**Yes — and this exact import chain is already proven safe by an existing
caller, not just inspected in isolation.**

`notifications.ts`'s own import list (lines 1-55) pulls in, beyond
`@supabase/supabase-js` types:
- `@/lib/booking/manage-token` (`ensureBookingManageUrl`,
  `getExistingBookingManageUrl`) — this file uses Node's built-in `crypto`
  (`createHash`, `randomUUID`, `manage-token.ts:2`), which is Node-runtime-only,
  not Edge-Runtime-safe. It is pulled in transitively by
  `getBookingTemplateInput`, which `sendReviewRequestEmail` calls.
- `./client` (`extractEmailAddress`, `getFromEmail`, `getSiteUrl`,
  `sendEmail`) — wraps the `resend` SDK (`client.ts:2`).
- `./templates` (`resolveTemplateOverrides`, `renderReviewRequestEmail`,
  `renderReviewRequestPlainText`, `pickReviewMessages`, plus the other
  render*/build* helpers) — this module itself imports
  `createSupabaseAdminClient` (`@/lib/supabase/admin`) and
  `findTemplate` from `@/app/admin/emails/components/templates-data`, which
  that file's own header comment (templates-data.ts:1-4) marks
  "SAFE TO IMPORT FROM CLIENT COMPONENTS: metadata only". `createSupabaseAdminClient`
  (`src/lib/supabase/admin.ts:2,4`) itself pulls in `getServerEnv` from
  `@/lib/env/server`, which imports `getCloudflareContext` from
  `@opennextjs/cloudflare` (`env/server.ts:1`) — a Cloudflare-Workers-specific
  API, not a Next.js Edge Runtime API, but this is the deployment target for
  the whole app already, not something new introduced by this call chain.
- `@/lib/ops/operational-events` (`recordOperationalEvent`) — plain Supabase
  insert wrapper, no special runtime requirement.

None of these are gated behind `"server-only"` package imports or
`next/headers` (checked each file's import list directly — no matches). So
nothing in the chain is *server-component*-only in the RSC sense; the `crypto`
usage is Node-runtime-only, which matters if this were ever called from an
Edge Runtime route, but is a non-issue for a Server Action (Next.js Server
Actions default to the Node.js runtime).

More importantly: this import chain is **already exercised today** by
`src/app/admin/emails/actions.ts` (a `"use server"` file, line 1), which
already imports and calls `sendBookingReminderEmail`,
`sendBookingCreatedEmails`, `sendBookingCancellationEmails`,
`sendStaffAssignmentEmail`, `sendStaffUnassignmentEmail`, and
`sendAssignedStaffBookingChangeEmails` from this exact `notifications.ts`
(`actions.ts:13-21`) — every one of those goes through the same
`getBookingTemplateInput` → `manage-token.ts` → `crypto` path, and the same
`templates.ts` → `createSupabaseAdminClient` path, from inside a live Server
Action, successfully. Adding `sendReviewRequestEmail` to that same import list
introduces no new dependency shape versus what's already proven there.

One adjacent fact worth flagging for whoever builds Batch B (not asked, but
directly relevant since it lives in the same file that would host the new
action): `actions.ts`'s `dispatchResend` switch (`actions.ts:311-364`) has no
`case "review_request_client":` — the per-row Resend button on `/admin/emails`
would currently fall through to its `default: throw new Error(...)` for any
review-request delivery row, until a case is added.

---

## Summary — what's already done vs. what Step 1e still needs

| Piece | Status |
|---|---|
| `sendReviewRequestEmail(bookingId, supabase, { ignoreClientCooldown? })` + `"client_recently_asked"` reason | **Done** (Batch A, `0863573`) — matches spec exactly |
| `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS = 6`, exported | **Done** |
| `getClientsAskedForReviewSince` (name, signature, batched query) | **Done** |
| `classifyReviewClient` + `getCompletedBookingCountsByClient` (name, signature, batched query) | **Done** |
| Class computed inside `sendReviewRequestEmail` | **Not done** — only the cron route computes it, for the audit log only; `sendReviewRequestEmail`'s own booking select lacks `recurring_template_id` |
| `pickReviewMessages` accepting/branching on class | **Not done** — its args object has no class field today |
| Server-action caller safety | **Safe** — identical import chain already proven by `admin/emails/actions.ts`'s existing senders |
