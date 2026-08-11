# C — Test baseline and mocking discipline for item 1

READ-ONLY derivation. No vitest run. All counts/quotes taken directly from the
repo at time of writing (current worktree state, not necessarily commit
33f895f — every number below was re-derived, not trusted from the plan).

## 0. File existence

All seven files exist at the exact paths given. Verified with `Glob` before
reading.

## 1. Per-file `it(` counts

Command used per file:
```
rg -n "^\s*it\(" <file>
```
(counted with `output_mode: count`; full line listings pulled separately to
sanity-check no double count).

| file | `it(` count (literal, excludes `it.each`) | `it.each(` blocks | runtime test cases |
|---|---|---|---|
| `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` | **12** | 0 | 12 |
| `src/app/api/cron/__tests__/review-emails.test.ts` | **6** | 0 | 6 |
| `src/app/admin/emails/__tests__/resendEmail.test.ts` | **21** | 2 (line 354: 2 params; line 462: 2 params) | 21 + 4 = **25** |
| `src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts` | **2** | 0 | 2 |
| `src/app/admin/emails/__tests__/emails-data.test.ts` | **28** | 1 (line 311: 3 params) | 28 + 3 = **31** |
| `src/lib/email/__tests__/pickReviewMessages.test.ts` | **6** | 0 | 6 |
| `src/app/admin/audit/__tests__/format.test.ts` | **2** | 0 | 2 |

`it.each(` does not match `^\s*it\(` (the `.each` sits between `it` and `(`),
so the literal ripgrep count under-reports runtime test cases for the two
files that use it. Confirmed with a separate `rg -n "it\.each\("` per file —
only `resendEmail.test.ts` (2 blocks) and `emails-data.test.ts` (1 block) use
it; the other five files have zero `it.each` occurrences.

No `test(`/`test.each(` alias usage anywhere in these seven files (checked
directory-wide with `rg "\btest(\.\w+)?\("` over each `__tests__` dir — 0
hits in all four directories).

## 2. Verifying the plan's two totals

**Claim A — first two files total 18 (12+6):** CONFIRMED exactly.
`sendReviewRequestEmail.test.ts` = 12, `review-emails.test.ts` = 6, both by
literal `it(` count (neither file uses `it.each`), sum = 18.

**Claim B — next four files (resendEmail, sendManualBookingReminder,
emails-data, pickReviewMessages) total 64:**

- By literal `it(` count: 21 + 2 + 28 + 6 = **57**, not 64. A naive
  `rg "^\s*it\("` count across these four files gives 57 and would make the
  plan's claim look wrong.
- By runtime test-case count (the number vitest would actually execute,
  counting each `it.each` parameter as its own case): 25 + 2 + 31 + 6 =
  **64**. This matches the plan exactly.

**Verdict: the "64" claim is correct, but only under the runtime-execution
reading, not the literal-`it(`-occurrence reading it says to count with
ripgrep.** The gap is exactly the 7 cases contributed by the three
`it.each` blocks (2+2 in resendEmail.test.ts, 3 in emails-data.test.ts).
Anyone re-verifying this with a bare `rg "^\s*it\("` will get 57 and
wrongly flag the plan as off by 7 — the reconciliation is `it.each` fan-out,
not drift.

## 3. Mock blocks, verbatim

### `vi.mock("@/lib/email/client", ...)` — `sendReviewRequestEmail.test.ts` (lines 35–39)
```ts
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));
```
This file does NOT mock `@/lib/email/notifications` — it's the one file that
tests the notifications.ts functions directly (unmocked), so the client-level
wrapper is what's stubbed instead.

### `vi.mock("@/lib/email/notifications", ...)` — `review-emails.test.ts` (lines 15–17)
```ts
vi.mock("@/lib/email/notifications", () => ({
  sendReviewRequestEmail: vi.fn(),
}));
```
Exports listed: **`sendReviewRequestEmail`** only (the route imports nothing
else from that module).

### `vi.mock("@/lib/email/notifications", ...)` — `sendManualBookingReminder.test.ts` (lines 33–41)
```ts
vi.mock("@/lib/email/notifications", () => ({
  sendBookingReminderEmail: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendBookingCreatedEmails: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendStaffUnassignmentEmail: vi.fn(),
}));
```
Exports listed (7): `sendBookingReminderEmail`, `sendAssignedStaffBookingChangeEmails`,
`sendBookingCancellationEmails`, `sendBookingConfirmedClientEmail`,
`sendBookingCreatedEmails`, `sendStaffAssignmentEmail`,
`sendStaffUnassignmentEmail`. **`sendReviewRequestEmail` is NOT in this
list** — confirmed by direct inspection, matching the plan's warning.

`resendEmail.test.ts`'s own `@/lib/email/notifications` mock (lines 42–50)
is the same shape, also 7 exports, also missing `sendReviewRequestEmail`:
```ts
vi.mock("@/lib/email/notifications", () => ({
  sendBookingCreatedEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendStaffUnassignmentEmail: vi.fn(),
}));
```

**Mechanism — why "copy-pasting without adding the export" is dangerous,
precisely:** Both notifications.ts mocks above are *bare* factories — plain
object literals with no `importOriginal` spread. `notifications.ts` itself
exports 17 functions (verified via `rg "^export (async function|function|const)"
src/lib/email/notifications.ts` — see full list below); each of these two
test files mocks the whole module down to only 7 of them. Under a bare
factory, any export not listed resolves to `undefined` on the mocked module —
so *as these two files stand today*, calling the unlisted
`sendReviewRequestEmail` would throw `TypeError: ... is not a function`, not
send a real email. The real hazard is for whoever extends item 1: this
codebase's `@/lib/auth/rbac` mock (same two files, e.g. lines 28–31 of
`sendManualBookingReminder.test.ts`) uses the *other* pattern —
`importOriginal` + spread + override:
```ts
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));
```
If a new test for item 1's manual-send/cooldown feature copies *this*
spread-style pattern onto `@/lib/email/notifications` instead of the bare
style, and forgets to add `sendReviewRequestEmail: vi.fn()` to the override
list, the unlisted export would resolve to the **real**
`sendReviewRequestEmail` — which calls the real (unless separately mocked)
`sendEmail` in `client.ts`. That is the concrete escape path the plan is
warning about; it is not present in the two files as they exist now, but the
pattern to avoid it (bare factory, explicit full list; or spread + explicit
override of every function actually reachable) needs to be followed
deliberately in whatever new test file item 1 adds.

`notifications.ts` full export list (17), for reference:
`resolveBusinessNotificationRecipients`, `sendBookingCreatedEmails`,
`sendBookingCancellationEmails`, `sendBookingRestoredClientEmail`,
`sendRecurringSeriesCreatedEmail`, `sendRecurringSeriesCancelledEmail`,
`sendBookingCancellationEmail`, `sendBookingRescheduleRequestEmails`,
`sendStaffAssignmentEmail`, `sendAssignedStaffBookingChangeEmails`,
`sendBookingReminderEmail`, `sendBookingConfirmedClientEmail`,
`sendStaffUnassignmentEmail`, `sendClaimNotificationEmail`,
`sendClientAssignedTherapistEmail`, `sendEnquiryLoggedEmail`,
`sendReviewRequestEmail`.

## 4. `src/lib/email/client.ts` — full quote and confirmation

```ts
// SERVER ONLY - do not import from client components.
import { Resend } from "resend";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailConfigurationError("Missing RESEND_API_KEY.");
  }

  return new Resend(apiKey);
}

export function getFromEmail() {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new EmailConfigurationError("Missing RESEND_FROM_EMAIL.");
  }

  return fromEmail;
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new EmailConfigurationError("Missing NEXT_PUBLIC_SITE_URL.");
  }

  return siteUrl.replace(/\/+$/, "");
}

export function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

export async function sendEmail(input: SendEmailInput) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new EmailDeliveryError(error.message);
  }

  return data;
}
```

**CONFIRMED.** `sendEmail` is a thin, unconditional wrapper over the real
Resend SDK. There is no environment guard beyond throwing
`EmailConfigurationError` if `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are unset
(a config check, not a safety gate — once the keys exist, the call goes
straight through). There is no test-mode short-circuit (no check of
`NODE_ENV`, `VITEST`, or any flag) and no domain/recipient allowlist of any
kind on `input.to`. Any caller that reaches `sendEmail()` unmocked, with a
real `RESEND_API_KEY` present in the environment, sends a real email via
`resend.emails.send(...)`.

## 5. Global test setup / env-read timing

`vitest.config.ts`, in full:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```
**Confirmed: no `setupFiles` key at all** — there is no global setup file of
any kind, so nothing in this config neutralises an unmocked `sendEmail`
(there's no automatic `vi.mock`, no global `RESEND_API_KEY` stub, nothing).

**`RESEND_API_KEY` is read at CALL time, not module load.** Confirmed by the
quote in §4: the only place `process.env.RESEND_API_KEY` appears is inside
the body of `getResendClient()`, and `getResendClient()` is only invoked from
inside `sendEmail()`. Nothing at the top level of `client.ts` touches
`process.env`. Consequence: merely *importing* `client.ts` unmocked (e.g. a
transitive import in a test that doesn't call `sendEmail`) is inert — no env
read, no SDK construction, no request. The danger is strictly in an unmocked
*call* to `sendEmail` (or, transitively, to `getFromEmail`, which does read
`RESEND_FROM_EMAIL` at call time too) actually executing.

## 6. `already_sent` test — verbatim, `sendReviewRequestEmail.test.ts` lines 251–261

```ts
  it("does not send and reports already_sent when the sentinel is already set", async () => {
    const stub = stubClient({
      booking: baseBooking({ review_email_sent_at: "2026-07-20T12:00:00.000Z" }),
    });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });
```
Assertion style to mirror for the new "does not write `review_email_sent_at`
when suppressed for cooldown" test: (1) assert the structured `{ sent:
false, reason: "..." }` result shape, (2) assert `sendEmail` was never
called, (3) assert no `bookings` update was recorded via
`stub.find("bookings", "update")` — the same `find(table, op)` idiom the stub
factory exposes (see §7).

## 7. Therapist-no-assignment `operational_events` assertion — verbatim, `resendEmail.test.ts` lines 243–255

```ts
  it("refuses a Therapist-class actor with no assignment on the booking", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(therapist);
    const stub = stubAdminClient({ assignmentCount: 0 });

    const result = await resendEmail(formData());

    expect(result).toEqual({
      ok: false,
      error: "You can only resend emails for bookings assigned to you.",
    });
    expect(stub.inserts.some((i) => i.table === "operational_events")).toBe(true);
    expect(sendBookingReminderEmail).not.toHaveBeenCalled();
  });
```

**CONFIRMED precisely as the plan states.** The only assertion touching the
`operational_events` insert is
`expect(stub.inserts.some((i) => i.table === "operational_events")).toBe(true)`
— a `.some()` over the recorded inserts checking that *a* row with
`table === "operational_events"` exists. It does not inspect `i.row` (the
insert payload) at all — no assertion on `action_type`, `actor_staff_id`, or
any other field of that operational-events row. Existence only, no content.

## 8. Supabase stub factories

Two distinct idioms are in use across these files, both built by hand (no
shared test-utility import for the `sendReviewRequestEmail.test.ts` /
`resendEmail.test.ts` style — `emails-data.test.ts` is the exception, see
below).

### Full stub factory, verbatim — `stubClient` in `sendReviewRequestEmail.test.ts` (lines 131–221)

```ts
function stubClient({
  booking,
  bookingItemsRows = [{ services: { group_category: "massage" } }],
  settings = SETTINGS,
}: {
  booking: Record<string, unknown> | null;
  bookingItemsRows?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
}) {
  const state: Record<string, unknown> | null = booking ? { ...booking } : null;
  const ops: RecordedOp[] = [];

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, filters: [] };
    ops.push(entry);
    let projected: "single" | "array" = "array";

    function resolve() {
      if (table === "bookings") {
        if (op === "update") {
          // The final sentinel-marking update carries `.is(...)`; only the
          // real predicate — "still NULL" — should let the write through.
          const guardedByNull = entry.filters.includes(
            "is:review_email_sent_at=null"
          );
          if (guardedByNull && state && state.review_email_sent_at != null) {
            return { data: null, error: null }; // lost the race
          }
          if (state) Object.assign(state, payload);
        }
        if (!state) return { data: null, error: null };
        return projected === "single"
          ? { data: { ...state }, error: null }
          : { data: [{ ...state }], error: null };
      }
      if (table === "business_settings") {
        return { data: settings, error: null };
      }
      if (table === "booking_items") {
        return { data: bookingItemsRows, error: null };
      }
      return { data: null, error: null };
    }

    const settle = () => Promise.resolve(resolve());
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      is: (column: string, value: unknown) => {
        entry.filters.push(`is:${column}=${value === null ? "null" : String(value)}`);
        return chain;
      },
      select: () => chain,
      returns: () => chain,
      single: () => {
        projected = "single";
        return settle();
      },
      maybeSingle: () => {
        projected = "single";
        return settle();
      },
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => settle().then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    insert: (payload: Record<string, unknown>) => {
      ops.push({ table, op: "insert", payload, filters: [] });
      return Promise.resolve({ data: null, error: null });
    },
  }));

  const client = { from } as unknown as SupabaseClient;
  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);

  return { client, state, ops, find };
}
```

This records every `select`/`update`/`insert` in a flat `ops[]` array
(fields: `table`, `op`, `payload`, `filters`), and exposes both the raw `ops`
array and a `find(table, op)` filter helper on the returned object — a new
test can assert on inserts directly via `stub.find("bookings", "insert")` or
`stub.ops.filter(...)`, exactly the "stub.inserts"-style idiom the task asks
about, just named `ops`/`find` here rather than `inserts`.

The literal `stub.inserts` name is used by the **other** idiom, in
`resendEmail.test.ts`'s `stubAdminClient` (lines 130–175): it keeps a plain
`const inserts: Insert[] = []`, pushes `{ table, row }` on every
`audit_logs`/`operational_events` `.insert()` call, and returns
`{ inserts, deliveryCalls, client }` — so tests assert with
`stub.inserts.some(...)` / `stub.inserts.find(...)` directly (as seen in §7).
`sendManualBookingReminder.test.ts`'s `stubAdminClient` (lines 66–82) uses
the same `audits: Record<string, unknown>[]` push-array pattern, returned as
`{ client, audits }`.

**Chain-assertion idiom used throughout:** rather than asserting on Supabase
SDK call arguments directly (`.mock.calls`), these stubs record a flat list
of `{method, args}` or `{table, op, filters}` entries as the chain is walked,
then assert with `toEqual`/`toContainEqual`/`.some(...)` against that
recorded list — e.g. `expect(rateLimitCalls).toContainEqual({ method: "is",
args: ["booking_id", null] })` in `resendEmail.test.ts`, or
`expect(sentinelUpdate.filters).toEqual(["eq:id=booking-1",
"is:review_email_sent_at=null"])` in `sendReviewRequestEmail.test.ts`. This
sidesteps having to model the full chainable Supabase query-builder type and
lets a test assert on exactly which filters/methods were applied, in order,
regardless of whether the real call terminates via `.single()`,
`.maybeSingle()`, or a bare `await`.

`emails-data.test.ts` is the one file among these seven that instead imports
shared fixtures — `createFakeAdminClient` from
`@/lib/cache/__tests__/fake-supabase-admin` and `createFakeUnstableCache`
from `@/lib/cache/__tests__/fake-unstable-cache` — rather than defining its
own inline stub factory; those two files were not in the requested list and
were not opened for this report.
