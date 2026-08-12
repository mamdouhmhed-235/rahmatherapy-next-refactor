# B2 — Test precedents and mailer-mock safety discipline (item 1, Batch B)

READ-ONLY derivation. HEAD `530d154` on `master`, tree dirty at exactly
`M src/lib/maintenance.ts` (confirmed: `git status --porcelain` shows only
that line touching `src/`). No file was written outside this directory. No
test file was created; all counts below come from the vitest binary actually
running against the files as they exist in the working tree right now.

Supersedes the pre-Batch-A snapshot in `C-tests-and-mocks.md` (same
directory) for `sendReviewRequestEmail.test.ts` and `review-emails.test.ts`
— that file's 12/6 counts were correct for its "before Batch A" write time;
Batch A (commit `0863573`) has since landed and both files grew. Nothing in
this file contradicts `C-tests-and-mocks.md`'s counts for the other five
files (`resendEmail.test.ts` 25, `sendManualBookingReminder.test.ts` 2,
`emails-data.test.ts` 31) — independently re-derived here and they match.

---

## 0. The highest-risk claim: does `sendEmail` have an environment guard?

`src/lib/email/client.ts`, quoted in full (73 lines, the whole file):

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

**Claim CONFIRMED.** `sendEmail` is a thin, unconditional wrapper: the only
guard is "is `RESEND_API_KEY` present" (`EmailConfigurationError` if not) —
there is no `NODE_ENV`/`VITEST`/test-mode check anywhere in this file, no
domain allowlist, no dry-run flag. If the key is present, the function
reaches `resend.emails.send(...)` for real, unconditionally.

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` **are both set** in this
environment — verified by `grep -E "RESEND_API_KEY|RESEND_FROM_EMAIL" .env`
(values not reproduced here; only confirmed present/non-empty). This makes
the mailer-mock discipline the only thing standing between any test run and
a real outbound email through the Owner's live Resend account.

---

## 1. `src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts`

This file is 121 lines total — quoted here in full since the mock block
*is* effectively the whole setup section of the file.

```ts
import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminderEmail } from "@/lib/email/notifications";
import { sendManualBookingReminder } from "../actions";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. sendManualBookingReminder
 * had no dedicated spec at all. Asserts the pre-existing emails + audit tag
 * invalidation (this function is not itself part of the fix — resendEmail
 * in the same file already carries the correct pair).
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendBookingReminderEmail: vi.fn(),
  sendAssignedStaffBookingChangeEmails: vi.fn(),
  sendBookingCancellationEmails: vi.fn(),
  sendBookingConfirmedClientEmail: vi.fn(),
  sendBookingCreatedEmails: vi.fn(),
  sendStaffAssignmentEmail: vi.fn(),
  sendStaffUnassignmentEmail: vi.fn(),
}));

function staff(name: string, permissions: string[]): StaffProfile {
  return {
    id: `staff-${name}`,
    auth_user_id: `auth-${name}`,
    name,
    email: `${name}@rahmatherapy.example.test`,
    role_id: `role-${name}`,
    role_name: name,
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  } as StaffProfile;
}

const owner = staff("Owner", [
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ALL,
]);

const BOOKING_ID = "booking-1";

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs" || table === "operational_events") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in sendManualBookingReminder test: ${table}`);
  });

  return { client: { from }, audits };
}

function formData() {
  const data = new FormData();
  data.set("booking_id", BOOKING_ID);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
  vi.mocked(sendBookingReminderEmail).mockResolvedValue(undefined);
});

describe("sendManualBookingReminder — cache tag invalidation", () => {
  it("invalidates the emails and audit cache tags on a successful send", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendManualBookingReminder(formData());

    expect(sendBookingReminderEmail).toHaveBeenCalledWith(BOOKING_ID, stub.client);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "emails",
      "audit",
    ]);
  });

  it("never calls updateTag when the send fails", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(sendBookingReminderEmail).mockRejectedValue(new Error("Resend is down."));

    await sendManualBookingReminder(formData());

    expect(updateTag).not.toHaveBeenCalled();
  });
});
```

**Test count: 2.** Both under one `describe("sendManualBookingReminder —
cache tag invalidation")` block:
1. `"invalidates the emails and audit cache tags on a successful send"`
2. `"never calls updateTag when the send fails"`

**Shape of the Supabase stub** (`stubAdminClient`): a `from` mock that only
recognizes two table names, `audit_logs` and `operational_events` — both
routed to the same trivial `{ insert: vi.fn(async (row) => { audits.push(row); return { error: null }; }) }`
shape. Any other table name throws synchronously
(`Unexpected table in sendManualBookingReminder test: ${table}`) — this is
the "fail loudly on an unmodeled query" discipline this repo's stubs share
(same pattern appears in `resendEmail.test.ts` and
`sendReviewRequestEmail.test.ts`'s stub, see below). No `select`/`eq`/chain
methods at all — this file's production code path never queries, only
inserts.

**Mailer mock:** `@/lib/email/notifications` is fully replaced (no
`importOriginal` spread) by an object literal with exactly 7 keys, all
`vi.fn()`. `sendReviewRequestEmail` is **not** one of them — see §3.

---

## 2. `src/app/admin/emails/__tests__/resendEmail.test.ts`

542 lines total. The mock block at the top:

```ts
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission + scope helpers stay
// real so the action is gated exactly as it is in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

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

Note this file's `@/lib/email/notifications` mock also omits
`sendReviewRequestEmail` — but that is harmless *here* because `resendEmail`
(the production action under test) has no dispatch branch for any
`review_request_client` event type at all (the `it.each(["claim",
"client_assigned_therapist"])` test proves unhandled event types return a
structured error rather than calling anything) — so the gap never gets
exercised by this file's own tests. It only becomes live risk in a *new*
file that copies this shape and *does* wire up `sendReviewRequestEmail`.

**The Supabase stub builder, verbatim** (`makeChain` + `stubAdminClient`):

```ts
// Thenable chain stub: every filter method returns itself so any call
// sequence (`.eq().eq()`, `.select().eq().gte().limit()`, ...) resolves to
// the same configured result, whether the caller terminates with
// `.maybeSingle()` or awaits the chain directly (the real Supabase query
// builder supports both, and `resendEmail` uses each style at different
// points).
function makeChain(
  resolve: () => unknown,
  record?: (call: TrackedCall) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const track =
    (method: string) =>
    (...args: unknown[]) => {
      record?.({ method, args });
      return chain;
    };
  chain.select = track("select");
  chain.eq = track("eq");
  chain.is = track("is");
  chain.gte = track("gte");
  chain.order = track("order");
  chain.limit = track("limit");
  chain.update = track("update");
  chain.maybeSingle = vi.fn(async () => resolve());
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return chain;
}

function stubAdminClient(opts: {
  original?: Record<string, unknown> | null;
  assignmentCount?: number;
  recentMatch?: Record<string, unknown> | null;
  newest?: Record<string, unknown> | null;
}) {
  const original = opts.original === undefined ? ORIGINAL_EVENT : opts.original;
  const inserts: Insert[] = [];
  const deliveryCalls: TrackedCall[][] = [];
  let deliveryCallIndex = 0;

  const from = vi.fn((table: string) => {
    if (table === "email_delivery_events") {
      deliveryCallIndex += 1;
      const callIndex = deliveryCallIndex;
      const calls: TrackedCall[] = [];
      deliveryCalls.push(calls);
      return makeChain(() => {
        if (callIndex === 1) return { data: original, error: null };
        if (callIndex === 2) return { data: opts.recentMatch ?? null, error: null };
        return { data: opts.newest ?? null, error: null };
      }, (call) => calls.push(call));
    }
    if (table === "booking_assignments") {
      return makeChain(() => ({
        count: opts.assignmentCount ?? 0,
        data: null,
        error: null,
      }));
    }
    if (table === "audit_logs" || table === "operational_events") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table in resendEmail test: ${table}`);
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  return { inserts, deliveryCalls, client };
}
```

**The Therapist-no-assignment scope-check test, verbatim** (lines 243–255 —
the plan's `HANDOFF`/plan reference said "around `:243-256`"; actual span is
243–255, one line shorter — negligible drift, already hedged by "around"):

```ts
describe("resendEmail — booking_assignments scope check (H11 middle path)", () => {
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

**Plan §1.12 claim verified TRUE.** The only assertion touching the
`operational_events` write is
`expect(stub.inserts.some((i) => i.table === "operational_events")).toBe(true)`
— that is purely an existence check on the table name. Nothing in this test
inspects `row` content: no assertion on event type, severity, `bookingId`,
or `staffId`. (The plan's own §1.12 text already carries this correction —
an earlier draft is on record as having claimed no precedent existed at
all; the plan file itself now states the accurate, narrower gap. Re-reading
the test file independently confirms the plan's corrected text is right.)

**Full test count: 25** — 23 literal `it(` call sites, plus 2 extra runtime
cases from two `it.each([...])` blocks (`it.each(["booking_cancellation_customer",
"booking_cancellation_admin"])` and `it.each(["claim",
"client_assigned_therapist"])`, each with a 2-element array). Verified both
by static count (`rg -n "^\s*it\("` → 23) and by the actual vitest run (§6
below), which lists all 25 test names individually.

---

## 3. The mock-completeness hazard — verified definitively from `@vitest/mocker@4.1.5` source

**Claim to verify:** `sendManualBookingReminder.test.ts`'s
`vi.mock("@/lib/email/notifications", () => ({ ... }))` factory (quoted in
§1) does not list `sendReviewRequestEmail` among its 7 keys. Confirmed by
direct inspection — it is not there.

**Installed version:** `node_modules/vitest/package.json` → `"version": "4.1.5"`.
The mock-factory runtime lives in a separate package,
`node_modules/.pnpm/@vitest+mocker@4.1.5_msw@2._c9df3f909676ba40cb632305282a590d/node_modules/@vitest/mocker`
(also 4.1.5).

**What happens when a factory omits an export the code under test imports —
read from `dist/chunk-registry.js`:**

```js
class ManualMockedModule {
	...
	resolve() {
		if (this.cache) {
			return this.cache;
		}
		let exports$1;
		try {
			exports$1 = this.factory();
		} catch (err) {
			throw createHelpfulError(err);
		}
		if (typeof exports$1 === "object" && typeof exports$1?.then === "function") {
			return exports$1.then((result) => {
				assertValidExports(this.raw, result);
				return this.cache = result;
			}, (error) => {
				throw createHelpfulError(error);
			});
		}
		assertValidExports(this.raw, exports$1);
		return this.cache = exports$1;
	}
	...
}
...
function assertValidExports(raw, exports$1) {
	if (exports$1 === null || typeof exports$1 !== "object" || Array.isArray(exports$1)) {
		throw new TypeError(`[vitest] vi.mock("${raw}", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?`);
	}
}
```

`assertValidExports` checks exactly one thing: that the factory returned a
non-null, non-array object. **It does not check the returned object's keys
against the real module's actual exports in any way.** The factory's return
value becomes the mocked module's namespace object verbatim — nothing
merges it with, or diffs it against, the real `notifications.ts` exports
(no `importOriginal` is called anywhere in this code path for a plain
`vi.mock(path, factory)` call — that only happens if the *test file's own
factory* explicitly calls the `importOriginal` callback it's handed, which
`sendManualBookingReminder.test.ts`'s notifications mock does not).

**Consequence, stated definitively:** if a new test file copies this
7-key factory unmodified, and the server action under test then calls
`sendReviewRequestEmail(...)`, that name resolves to `undefined` on the
mocked module object (ordinary JS property access on an object literal —
missing keys are `undefined`, not a thrown error at property-read time).
Vite's SSR import transform compiles each named-import usage to a property
access at the call site (e.g. `(0, __vite_ssr_import_N__.sendReviewRequestEmail)(...)`)
— so the read of `undefined` only turns into a **synchronous `TypeError`
("... is not a function") at the moment the code tries to *call* it**, not
earlier. Two things follow from this, both favorable to safety:

1. **No real send is possible through this path.** The entire
   `@/lib/email/notifications` module is replaced by the incomplete factory
   object (not partially — the factory has no `importOriginal` spread), so
   the *real* `sendReviewRequestEmail` implementation — the one that
   actually calls `sendEmail` from `client.ts` — is never loaded into the
   call graph at all for that binding. The transport (`client.ts`) is
   simply unreachable via this specific call, regardless of whether
   `RESEND_API_KEY` is set.
2. **The failure is loud, not silent** — a thrown `TypeError` inside the
   server action. Whether the *test* then reports as a crash or as a caught
   "ok: false" result depends on whether the production action wraps its
   call in a `try/catch` (as `resendEmail` does, per its structured-error
   dispatch pattern in §2) — but either way, the observable symptom is a
   broken/failing assertion in CI, never a leaked email.

**Confidence: high.** This is read directly from the installed package's
compiled source for the exact version in `node_modules`, not inferred from
general ESM knowledge or Vitest's public docs. The one thing not directly
re-derived here (would require actually running a throwaway test file,
which this task's write constraints forbid) is the exact wording of the
`TypeError` message and the precise generated variable name at the call
site — those are cosmetic and don't change the safety conclusion.

**Actionable for the Batch B implementer:** the plan's own §1.13 already
states the fix — the new manual-send action's test must add
`sendReviewRequestEmail: vi.fn()` to whatever notifications mock factory it
uses (model it on `sendManualBookingReminder.test.ts`'s shape per §1.12's
explicit instruction, not `resendEmail.test.ts`'s scope-check style). This
derivation confirms *why* that instruction is correct and *what the actual
runtime failure mode is* if it's skipped (a failing/crashing test, not a
live email) — the real hazard is a red herring in disguise: the far more
dangerous mistake per §1.14 stop-condition 3 is weakening or removing an
existing `vi.mock("@/lib/email/client", ...)` block, not merely omitting an
export from a `notifications.ts` mock.

---

## 4. `src/lib/email/__tests__/sendReviewRequestEmail.test.ts`

**Current test count: 23** (static `rg -n "^\s*it\("` count; no `it.each`
in this file — confirmed by the vitest run in §6, which lists exactly 23
test names for this file).

All 23 test names, in file order:

`describe("sendReviewRequestEmail")` — 13 tests:
1. `"sends the review email and marks the sentinel on a happy-path completed booking"`
2. `"does not send and reports already_sent when the sentinel is already set"`
3. `"marks the sentinel and reports no_email when the booking has no email anywhere"`
4. `"reports send_failed without sending when the booking is no longer completed"`
5. `"throws when the booking does not exist"`
6. `"falls back to the massage pool for a mixed-category booking"`
7. `"propagates admin-configured override text into the plain-text leg, not just the HTML leg"`
8. `"picks the review samples once and shares them identically between the HTML and plain-text legs (F-6 regression guard)"`
9. `"suppresses a send inside the 6-month cooldown window and returns reason: client_recently_asked"`
10. `"permits a send once the cooldown window has elapsed"`
11. `"does not write review_email_sent_at when suppressed for cooldown"`
12. `"queries the cooldown scoped to this client, the review event type and accepted sends only"`
13. `"ignoreClientCooldown bypasses the cooldown but still honours the per-booking sentinel"`

`describe("renderReviewRequestPlainText")` — 4 tests:
14. `"falls back to the same shared defaults the HTML leg uses when no overrides exist"`
15. `"honours all five admin-configured body fields, not the hardcoded defaults"`
16. `"falls back to the default CTA URL when the stored override isn't https:// (defence-in-depth)"`
17. `"never leaks a {city} or {service_name} placeholder into the sent body"`

`describe("classifyReviewClient")` — 3 tests:
18. `"classifies as series when recurring_template_id is set, regardless of completed-booking count"`
19. `"classifies as first_time when the client's completed-booking count, including this booking, is 1"`
20. `"classifies as returning when the client's completed-booking count, including this booking, is 2 or more"`

`describe("reviewCooldownStart")` — 1 test:
21. `"returns an instant exactly the cooldown's worth of calendar months back"`

`describe("getClientsAskedForReviewSince")` — 2 tests:
22. `"returns an empty set without querying when the client list is empty"`
23. `"reads the client id out of the embed whether it arrives as an object or an array"`

**The cooldown tests, quoted verbatim** (these are what Batch B's
`ignoreClientCooldown` tests in the new `sendManualReviewRequest.test.ts`
must mirror in style):

```ts
  it("suppresses a send inside the 6-month cooldown window and returns reason: client_recently_asked", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      reviewAskRows: [{ bookings: { client_id: "client-1" } }],
    });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: false, reason: "client_recently_asked" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("permits a send once the cooldown window has elapsed", async () => {
    // The window is enforced server-side by the gte filter; an empty result
    // set is what "the last ask is older than the window" looks like here.
    const stub = stubClient({ booking: baseBooking(), reviewAskRows: [] });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not write review_email_sent_at when suppressed for cooldown", async () => {
    // The named easiest-mistake in this item: writing the sentinel on a
    // cooldown skip would permanently retire a booking a later manual send
    // may legitimately want.
    const stub = stubClient({
      booking: baseBooking(),
      reviewAskRows: [{ bookings: { client_id: "client-1" } }],
    });

    await sendReviewRequestEmail("booking-1", stub.client);

    expect(stub.state?.review_email_sent_at).toBeNull();
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("queries the cooldown scoped to this client, the review event type and accepted sends only", async () => {
    const stub = stubClient({ booking: baseBooking(), reviewAskRows: [] });

    await sendReviewRequestEmail("booking-1", stub.client);

    const lookup = stub.find("email_delivery_events", "select").at(-1)!;
    expect(lookup.filters).toEqual([
      "eq:event_type=review_request_client",
      "eq:delivery_status=accepted",
      expect.stringMatching(/^gte:created_at=/),
      "in:bookings.client_id=client-1",
    ]);
  });

  it("ignoreClientCooldown bypasses the cooldown but still honours the per-booking sentinel", async () => {
    // Bypass sends when no sentinel exists...
    const fresh = stubClient({
      booking: baseBooking(),
      reviewAskRows: [{ bookings: { client_id: "client-1" } }],
    });

    const bypassed = await sendReviewRequestEmail("booking-1", fresh.client, {
      ignoreClientCooldown: true,
    });

    expect(bypassed).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // ...and the cooldown lookup is skipped entirely, not just ignored.
    expect(fresh.find("email_delivery_events", "select")).toHaveLength(0);

    // ...but the per-booking sentinel still wins. One review request per
    // booking, always.
    vi.mocked(sendEmail).mockClear();
    const alreadySent = stubClient({
      booking: baseBooking({ review_email_sent_at: "2026-07-20T12:00:00.000Z" }),
      reviewAskRows: [{ bookings: { client_id: "client-1" } }],
    });

    const blocked = await sendReviewRequestEmail("booking-1", alreadySent.client, {
      ignoreClientCooldown: true,
    });

    expect(blocked).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
```

Note this last test (`ignoreClientCooldown bypasses...`) is itself the
direct precedent for Batch B's own `ignoreClientCooldown` bypass test — it
already proves both halves (bypass-when-no-sentinel,
still-blocked-by-sentinel) in one `it`, a shape Batch B's manual-send test
should mirror rather than split into two.

This file's own mailer mock (top of file, for reference — not re-quoted in
full since it's identical in shape to the pattern documented in the plan's
§1.13):
```ts
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));
```

---

## 5. `src/app/api/cron/__tests__/review-emails.test.ts`

**Current test count: 11** (static `rg -n "^\s*it\("` count; no `it.each`;
confirmed against the vitest run).

All 11 test names, in file order, all under one
`describe("POST /api/cron/review-emails")` block:
1. `"fails loudly when CRON_SECRET is unset rather than accepting anything"`
2. `"rejects a request whose X-Cron-Secret does not match"`
3. `"skips without touching the DB during quiet hours"`
4. `"returns 0 sent when there are no daytime candidates"`
5. `"sends every sendable candidate and writes one audit row per send"`
6. `"counts an already-sent candidate in skipped_already_sent, not sent"`
7. `"counts a cooldown-suppressed candidate into skipped_client_cooldown, not sent"`
8. `"calls the cooldown batch helper once per tick regardless of candidate count"`
9. `"computes the classification count in the same batched query as the cooldown lookup, not once per candidate"`
10. `"widens the candidate select to include client_id and recurring_template_id"`
11. `"records the client class in the audit row's after_state alongside automated: true"`

This file's mailer-mock comment (worth mirroring verbatim in spirit for any
new file that mocks `notifications.ts` while spreading the real module):

```ts
// Defence in depth. Nothing in this file should reach the transport — the
// sender itself is mocked below — but the notifications mock now spreads the
// real module, which pulls client.ts into the graph. sendEmail there is an
// unguarded wrapper over the real Resend SDK, so it is stubbed outright
// rather than left one mistake away from a live send.
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

// Spread the real module so the PURE helpers (classifyReviewClient,
// reviewCooldownStart) actually run — the same reasoning as the RBAC mocks
// elsewhere in this repo, where the real logic runs and only the inputs are
// fixtures. Only the sender and the two DB-touching batch helpers are stubbed.
vi.mock("@/lib/email/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/notifications")>()),
  sendReviewRequestEmail: vi.fn(),
  getClientsAskedForReviewSince: vi.fn(),
  getCompletedBookingCountsByClient: vi.fn(),
}));
```

This is the *other* established mailer-mock shape in this codebase (§1.13's
point 2 in the plan) — spread the real module via `importOriginal` and
override only the DB-touching/sending functions, keeping pure helpers real.
This is the safer template to copy for a new file if the new code needs any
of `notifications.ts`'s pure exports (e.g. `classifyReviewClient`) alongside
mocking `sendReviewRequestEmail` — spreading `importOriginal` structurally
prevents the §3 hazard, because every export not explicitly overridden still
resolves to its real implementation rather than `undefined`. (Caution: that
real implementation for anything DB-touching would still need its own
Supabase stub wired up, or it fails for a different reason — spreading
`importOriginal` is not a free pass, just immune to the specific "missing
key → undefined → TypeError" failure mode in §3.)

---

## 6. Actual vitest run — exact counts

Command run from repo root (no test files created or modified; nothing
under `src/`, `scripts/`, `e2e/`, or `supabase/` touched):

```
npx vitest run src/app/admin/emails src/lib/email/__tests__/sendReviewRequestEmail.test.ts src/app/api/cron/__tests__/review-emails.test.ts
```

Output:
```
 RUN  v4.1.5 C:/Users/mamdo/Desktop/rahmatherapy - Copy/rahmatherapy-next-refactor

Not implemented: navigation to another Document

 Test Files  8 passed (8)
      Tests  123 passed (123)
   Start at  10:35:11
   Duration  2.97s (transform 863ms, setup 0ms, import 2.42s, tests 1.30s, environment 10.62s)
```

("Not implemented: navigation to another Document" is a pre-existing jsdom
console warning unrelated to this item — not a failure, exit code was 0,
all 123 tests passed.)

Per-file breakdown (re-run with `--reporter=verbose` and counted from the
individual `✓` lines; sums to the 123 total above):

| file | tests |
|---|---|
| `src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts` | 2 |
| `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` | 23 |
| `src/app/admin/emails/__tests__/resendEmail.test.ts` | 25 |
| `src/app/admin/emails/__tests__/emails-data.test.ts` | 31 |
| `src/app/api/cron/__tests__/review-emails.test.ts` | 11 |
| `src/app/admin/emails/templates/__tests__/TokenTextField.test.tsx` | 12 |
| `src/app/admin/emails/templates/__tests__/LivePreview.test.tsx` | 5 |
| `src/app/admin/emails/templates/__tests__/TemplateEditor.test.tsx` | 14 |
| **Total** | **123** |

`2 + 23 + 25 + 31 + 11 + 12 + 5 + 14 = 123`. Checked by arithmetic, not just
trusted from the summary line.

---

## 7. Safety audit — recipient addresses in fixtures outside `*.example.test`/`*.test`

Command (repo-wide, `src/` scoped for the fixture-glob pass, then a second
unscoped pass over `src`, `e2e`, `scripts`, `supabase`):

```
rg -no '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' --glob '**/__tests__/**' src
```
→ 221 matching lines across the whole `src/**/__tests__/**` tree. Every
single one resolves to either `*.example.test`, `*.test` (bare, e.g.
`attacker@evil.test`, `staff-a@example.test`), or the two-part
`*.staff.example.test`/`*.client.example.test`/`*.trio.example.test`
subdomain pattern — all under the IANA/RFC 2606-reserved `.test` TLD, none
resolvable on the real internet, matching this repo's own convention
(confirmed independently in
`redesign/evidence/post-band-c-impl/item-1/*` and this session's own read of
every hit).

**Exactly one exception**, and it is not a mailer-send risk:

```
src/content/site/__tests__/canonical-domain.test.ts:53:    expect(contactLinks.email.value).toBe("rahmatherapy@outlook.com");
src/content/site/__tests__/canonical-domain.test.ts:54:    expect(contactLinks.email.href).toBe("mailto:rahmatherapy@outlook.com");
```

Read the whole file (57 lines) to confirm context: this is a content-drift
guard (`describe("canonical domain")`, test
`"publishes the clinic's live contact address"`) that walks every `.ts`/
`.tsx`/`.css` file under `src/` and asserts on `contactLinks.email.value`
from `src/content/site/contact.ts` — the real, published business contact
address that legitimately appears on the live site's public "Contact us"
page. This file **imports nothing from `@/lib/email/notifications` or
`@/lib/email/client`, mocks nothing, and never calls `sendEmail`** — it's a
static string-equality assertion against site copy, unrelated to any
mailer/Resend code path. `rahmatherapy@outlook.com` is real content (also
found, expectedly, in production source at
`src/components/shared/MaintenanceBanner.tsx:22,25`,
`src/components/shared/MaintenanceModal.tsx:58,62`, and
`src/content/site/contact.ts:22,23` — none of those are test fixtures, they
are the actual site copy this test guards).

`e2e/` was also grepped for email-like strings — **zero matches** across
`e2e/admin-contrast-helpers.ts`, `e2e/admin-contrast.spec.ts`,
`e2e/admin-roles.spec.ts`, `e2e/admin-settings.spec.ts`,
`e2e/booking-claiming.spec.ts`, `e2e/booking-public.spec.ts`,
`e2e/helpers.ts`.

**Conclusion: no fixture anywhere in this repo puts a real, deliverable
recipient address in a position where a test (mocked or not) could send to
it.** The one real address that appears anywhere near a test is asserted as
literal site content, not used as an email `to`/recipient value.

---

## Facts an implementer needs (source-cited)

- `src/lib/email/client.ts:57-72` (`sendEmail`) has no environment guard;
  only a "key present" check. `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are both
  set in `.env` in this environment. Every test touching any code path that
  can reach `sendEmail` must mock either `@/lib/email/client` or the whole
  of `@/lib/email/notifications` — no third option.
- `src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts`
  (121 lines total) is the model to copy for the new
  `sendManualReviewRequest.test.ts` per the plan's own §1.12 instruction —
  its `@/lib/email/notifications` mock factory (lines 33-41) lists 7 keys,
  none of them `sendReviewRequestEmail`; a new test copying this factory
  **must add `sendReviewRequestEmail: vi.fn()`** or any call through that
  binding throws `TypeError: ... is not a function` at the call site
  (verified from `@vitest/mocker@4.1.5`'s `ManualMockedModule.resolve()` +
  `assertValidExports()` in `chunk-registry.js` — no completeness check
  against the real module's exports, confidence: high). This failure mode
  is loud/test-breaking, not a silent real send — the real transport is
  categorically unreachable through an `undefined` binding.
- `src/app/admin/emails/__tests__/resendEmail.test.ts:243-255` — the
  Therapist-no-assignment test — asserts only
  `stub.inserts.some((i) => i.table === "operational_events")` is `true`;
  no content assertion (type/severity/`bookingId`/`staffId`). Plan §1.12's
  claim about this gap is accurate as currently written in the plan file.
- `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` now has 23 tests
  (not the plan's pre-Batch-A "12 tests today" baseline — Batch A already
  landed and added the cooldown/classification tests quoted in full above).
- `src/app/api/cron/__tests__/review-emails.test.ts` now has 11 tests (not
  the plan's pre-Batch-A "6 tests today" baseline).
- Full-scope run (`npx vitest run src/app/admin/emails
  src/lib/email/__tests__/sendReviewRequestEmail.test.ts
  src/app/api/cron/__tests__/review-emails.test.ts`): **8 files / 123
  tests, all passing**, exit 0.
- Two established, safe mailer-mocking templates exist side by side in this
  codebase: (a) full-replacement factory listing every needed export
  explicitly (`sendManualBookingReminder.test.ts`,
  `resendEmail.test.ts`) — safe only if the list is complete; (b)
  `importOriginal`-spread factory overriding only the sending/DB-touching
  exports (`review-emails.test.ts`) — structurally immune to the §3
  omission hazard, at the cost of needing real Supabase stubs for whatever
  DB calls the un-overridden real exports make.
- No fixture in `src/`, `e2e/`, `scripts/`, or `supabase/` contains a real,
  deliverable email address used as a test recipient; the sole real address
  found near tests (`rahmatherapy@outlook.com`) is asserted as literal
  published site content in a content-drift guard, not passed to any mailer
  code path.
