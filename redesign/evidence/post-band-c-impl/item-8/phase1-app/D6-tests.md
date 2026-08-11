# D6 — Test-file inventory for item 8 Phase 1 (App half): six targets (read-only derivation)

Read-only pass. Repo: `rahmatherapy-next-refactor`. All line numbers re-derived by opening the
files fresh — none trusted from the task prompt without verification. Cross-checked against two
prior reports in this same evidence folder for consistency (not duplicated wholesale):
`D1a-settings-actions.md` (full read of `src/app/admin/settings/actions.ts` +
`src/lib/auth/rbac.ts`) and `D5-remaining-consumers.md` (four other `allowed_cities` consumer
files). Neither of those touched `src/lib/booking/availability.ts` or the fake-admin-client
mechanics — that is new ground covered here.

**Headline: every claimed anchor in the task prompt is ACCURATE. Zero drift across all 6
claims.** All five target test files currently PASS (57/57 tests, verified by running them).
The highest-value finding is in §3/§4 below: the four `lib/booking` fixtures will silently break
in bulk (not just cosmetically) if `availability.ts` switches to reading `free_travel_cities`
without the fixtures being updated in lockstep — this is a live landmine for whoever does that
half of Phase 1.

---

## 1. Anchor verification table

| # | File | Claimed anchor | Actual line | Drift |
|---|---|---|---|---|
| 1 | `updateBusinessSettings.test.ts` | `data.set("allowed_cities", ...)` at :83 | 83 | NONE |
| 2 | `availability-options.test.ts` | mock key at :49 | 49 | NONE |
| 3 | `working-hours-segments.test.ts` | mock key at :288 | 288 | NONE |
| 4 | `override-windows.test.ts` | mock key at :84 | 84 | NONE |
| 5 | `override-windows.test.ts` | mock key at :379 | 379 | NONE |
| 6 | `staff-recurring-windows.test.ts` | mock key at :70 | 70 | NONE |

Exact text at each claimed line (all six are the identical string, byte-for-byte, only
indentation/context differs — see §2 for full surrounding objects):

```
83  data.set("allowed_cities", overrides.allowed_cities ?? "Luton, Dunstable");
49        allowed_cities: ["Luton"],
288        allowed_cities: ["Luton"],
84        allowed_cities: ["Luton"],
379          allowed_cities: ["Luton"],
70        allowed_cities: ["Luton"],
```

Note line 379's indentation is 10 spaces (2 more than line 84's 8) because it sits inside an
inline object literal built directly in an `it()` body rather than inside a shared `engineClient`
helper function — see the full quote in §2.4.

---

## 2. Full surrounding mock objects — four `lib/booking` fixtures

### 2.1 `availability-options.test.ts` (business_settings block, lines 44–53)

```
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 15,
        minimum_notice_hours: 24,
        allowed_cities: ["Luton"],
        booking_status_enabled: options.bookingStatusEnabled,
      },
      error: null,
    },
```

One occurrence, inside the `tables(options)` helper (line 42–117). Note this one uses
`options.bookingStatusEnabled` (a variable) for the last field, not a literal — the only one of
the five occurrences that does.

### 2.2 `working-hours-segments.test.ts` (business_settings block, lines 283–292)

```
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 0,
        minimum_notice_hours: 0,
        allowed_cities: ["Luton"],
        booking_status_enabled: true,
      },
      error: null,
    },
```

One occurrence, inside the `engineClient(rules)` helper (line 281–325).

### 2.3 `override-windows.test.ts` — occurrence A (business_settings block, lines 79–88)

```
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 0,
        minimum_notice_hours: 0,
        allowed_cities: ["Luton"],
        booking_status_enabled: true,
      },
      error: null,
    },
```

Inside the shared `engineClient({...})` helper (line 65–152), used by every `it()` in this file
except the last one.

### 2.4 `override-windows.test.ts` — occurrence B (business_settings block, lines 374–383)

```
      business_settings: {
        data: {
          booking_window_days: 30,
          buffer_time_mins: 0,
          minimum_notice_hours: 0,
          allowed_cities: ["Luton"],
          booking_status_enabled: true,
        },
        error: null,
      },
```

Inline inside the single `it("control — a recurring day with its own break still works (Phase
A/B)", ...)` test body (line 372–438) — this test builds its own `createFakeAdminClient({...})`
call directly rather than going through `engineClient`, which is why the indentation differs by
2 spaces from occurrence A (6-space base indent here vs 4-space in the helper function).

### 2.5 `staff-recurring-windows.test.ts` (business_settings block, lines 65–74)

```
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 0,
        minimum_notice_hours: 0,
        allowed_cities: ["Luton"],
        booking_status_enabled: true,
      },
      error: null,
    },
```

One occurrence, inside the `engineClient({...})` helper (line 55–114).

**Total: 5 `allowed_cities` mock-key occurrences across 4 files** (override-windows.test.ts has
two). All five currently set `allowed_cities` only — **none of the four files sets a
`free_travel_cities` key anywhere.** Confirmed by grep: `free_travel_cities` and `mileage_origin`
have zero matches in any of the four `lib/booking/__tests__` files.

---

## 3. `updateBusinessSettings.test.ts` — full file, quoted in full (121 lines + trailing newline)

```
1   import { updateTag } from "next/cache";
2   import { beforeEach, describe, expect, it, vi } from "vitest";
3   import { requirePermission } from "@/lib/auth/rbac";
4   import { createSupabaseAdminClient } from "@/lib/supabase/admin";
5   import { updateBusinessSettings } from "../actions";
6   
7   /**
8    * C-09 Phase B fix round — Step 3 spec coverage. `updateBusinessSettings` is
9    * the B-149 fix the whole C-09 plan cites as its motivation and had zero
10   * regression coverage before this. Asserts the settings + audit resource
11   * tags it invalidates.
12   */
13  
14  vi.mock("next/cache", () => ({
15    revalidatePath: vi.fn(),
16    updateTag: vi.fn(),
17  }));
18  
19  vi.mock("@/lib/supabase/admin", () => ({
20    createSupabaseAdminClient: vi.fn(),
21  }));
22  
23  vi.mock("@/lib/supabase/server", () => ({
24    createSupabaseServerClient: vi.fn().mockResolvedValue({}),
25  }));
26  
27  vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
28    ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
29    requirePermission: vi.fn(),
30  }));
31  
32  const ACTOR = { id: "staff-owner", name: "Owner" };
33  
34  function stubAdminClient() {
35    const audits: Record<string, unknown>[] = [];
36    const upserts: Record<string, unknown>[] = [];
37  
38    const from = vi.fn((table: string) => {
39      if (table === "audit_logs") {
40        return {
41          insert: vi.fn(async (row: Record<string, unknown>) => {
42            audits.push(row);
43            return { error: null };
44          }),
45        };
46      }
47      // business_settings
48      return {
49        select: () => ({
50          eq: () => ({
51            single: async () => ({
52              data: { id: 1, company_name: "Rahma Therapy", booking_window_days: 14 },
53              error: null,
54            }),
55          }),
56        }),
57        upsert: (row: Record<string, unknown>) => {
58          upserts.push(row);
59          return {
60            select: () => ({
61              single: async () => ({ data: row, error: null }),
62            }),
63          };
64        },
65      };
66    });
67  
68    return { client: { from }, audits, upserts };
69  }
70  
71  function formData(overrides: Record<string, string> = {}) {
72    const data = new FormData();
73    data.set("company_name", overrides.company_name ?? "Rahma Therapy");
74    data.set("contact_email", overrides.contact_email ?? "owner@example.test");
75    data.set("contact_phone", overrides.contact_phone ?? "07000000000");
76    data.set("booking_window_days", overrides.booking_window_days ?? "30");
77    data.set("buffer_time_mins", overrides.buffer_time_mins ?? "15");
78    data.set("minimum_notice_hours", overrides.minimum_notice_hours ?? "2");
79    data.set(
80      "customer_cancellation_cutoff_hours",
81      overrides.customer_cancellation_cutoff_hours ?? "24"
82    );
83    data.set("allowed_cities", overrides.allowed_cities ?? "Luton, Dunstable");
84    data.set("booking_status_enabled", overrides.booking_status_enabled ?? "on");
85    return data;
86  }
87  
88  beforeEach(() => {
89    vi.clearAllMocks();
90    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
91  });
92  
93  describe("updateBusinessSettings — cache tag invalidation (B-149 fix)", () => {
94    it("invalidates the settings and audit resource tags", async () => {
95      const stub = stubAdminClient();
96      vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
97  
98      const result = await updateBusinessSettings({}, formData());
99  
100     expect(result).toEqual({ success: true });
101     expect(stub.upserts).toHaveLength(1);
102     expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
103       "settings",
104       "audit",
105     ]);
106   });
107 
108   it("never calls updateTag when validation fails", async () => {
109     const stub = stubAdminClient();
110     vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
111 
112     const result = await updateBusinessSettings(
113       {},
114       formData({ booking_window_days: "0" })
115     );
116 
117     expect(result.fieldErrors).toBeDefined();
118     expect(stub.upserts).toHaveLength(0);
119     expect(updateTag).not.toHaveBeenCalled();
120   });
121 });
```

(121 lines is the full body; the file ends with a trailing newline after the closing `});` on
line 121, which is what a line-count tool reports as "122".)

### 3a. Imports (lines 1–5)

Five imports: `updateTag` from `next/cache`; vitest primitives; `requirePermission` from
`@/lib/auth/rbac`; `createSupabaseAdminClient` from `@/lib/supabase/admin`; and the function under
test, `updateBusinessSettings`, from `../actions` (i.e. `src/app/admin/settings/actions.ts`).
`revalidatePath` is mocked (line 15) but never imported or asserted on in this file.

### 3b. `vi.mock` factories (lines 14–30) — four total

1. `next/cache` (14–17) — `revalidatePath` and `updateTag` both become bare `vi.fn()` mocks, no
   implementation.
2. `@/lib/supabase/admin` (19–21) — `createSupabaseAdminClient` becomes a bare `vi.fn()`; its
   return value is set per-test via `vi.mocked(createSupabaseAdminClient).mockReturnValue(...)`.
3. `@/lib/supabase/server` (23–25) — `createSupabaseServerClient` is mocked to always resolve an
   empty object `{}`. This exists only because `actions.ts`'s `requireSettingsManager()` calls
   `await createSupabaseServerClient()` before passing the result into `requirePermission(...)` —
   this file never inspects what that `{}` is used for, since `requirePermission` itself is
   separately mocked (next line) and ignores its second argument entirely in the test double.
4. `@/lib/auth/rbac` (27–30) — **partial mock**: `importOriginal` is spread first, so every real
   export of `rbac.ts` (including the real `PERMISSIONS` object, `getRoleDisplayName`,
   `hasAnyPermission`, etc.) passes through untouched; only `requirePermission` is overridden to
   a bare `vi.fn()`.

### 3c. `ACTOR` and the permission fake (line 32, line 90) — what exists, what's missing

```
32  const ACTOR = { id: "staff-owner", name: "Owner" };
```

This is the **entire** simulated actor. It has exactly two fields, `id` and `name`. It is **not**
a `StaffProfile` — it has no `permissions: Set<string>`, no `role_name`, no `active`, no
`auth_user_id`, etc. It is cast past the type system with `as never` at the point of use:

```
90    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
```

This single `mockResolvedValue` in the file-level `beforeEach` (lines 88–91) is applied
**unconditionally, for every test, regardless of which permission is passed to
`requirePermission`.** The mock has no `mockImplementation` that inspects its first argument
(the permission string) — it always just resolves to the same `ACTOR` object no matter whether
the real code asks for `PERMISSIONS.MANAGE_SETTINGS`, a hypothetical
`PERMISSIONS.MANAGE_TRAVEL_ORIGIN`, or anything else. There is currently **no way, using this
file's existing plumbing, to make `requirePermission` behave differently for an "Admin" actor
than for an "Owner" actor** — there is only one fake actor and one universal resolve.

**What already exists that the caller can reuse:**
- The `vi.mock("@/lib/auth/rbac", ...)` factory (27–30) already isolates `requirePermission` as
  an independently controllable `vi.fn()`, importable via `vi.mocked(requirePermission)`.
- `beforeEach` already calls `vi.clearAllMocks()` (line 89) before re-establishing the default
  mock, so any per-test override (e.g. inside a specific `it()`) that calls
  `vi.mocked(requirePermission).mockImplementation(...)` or
  `.mockResolvedValueOnce(...)`/`.mockRejectedValueOnce(...)` will not leak into other tests, and
  each `it()` already re-runs `beforeEach` first (vitest default), so the shared default (`ACTOR`,
  always-succeeds) is restored before every test unless a test overrides it.
- `requirePermission`'s real signature (confirmed in `src/lib/auth/rbac.ts:401-404`,
  cross-checked against `D1a-settings-actions.md` §2) is
  `(permission: Permission, supabase: SupabaseClient) => Promise<StaffProfile>`, so a
  differentiated mock can branch on the first argument (`permission`) — e.g.
  `mockImplementation(async (permission) => { if (permission === PERMISSIONS.MANAGE_TRAVEL_ORIGIN) throw new PermissionError(...); return ACTOR; })` —
  once `PermissionError` and the real `PERMISSIONS` constant are imported (the latter is already
  reachable through the partial-mock's `importOriginal` spread, so a plain
  `import { PERMISSIONS } from "@/lib/auth/rbac"` at the top of this test file would resolve to
  the **real, unmocked** `PERMISSIONS` object, since only `requirePermission` is overridden).

**What is missing / must be added by the caller, confirmed absent by inspecting `actions.ts` and
`rbac.ts` directly (also independently confirmed in `D1a-settings-actions.md` §2 and
`D5-remaining-consumers.md` §2, Gap 1):**
1. `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` (or any `travel_origin`-named key) **does not exist yet**
   in `src/lib/auth/rbac.ts`'s `PERMISSIONS` object (lines 6–50 there). The DB permission
   `manage_travel_origin` exists (per this task's own context), but the app-side constant that
   would let `actions.ts` call `requirePermission(PERMISSIONS.MANAGE_TRAVEL_ORIGIN, ...)` or let
   this test reference `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` does not. This is a dependency outside
   the six target test files (it lives in `rbac.ts`), not something this test file alone can work
   around except by using the raw string literal `"manage_travel_origin"`.
2. `actions.ts` (`updateBusinessSettings`, read in full — see `D1a-settings-actions.md` §1) today
   calls `requirePermission` exactly **once**, gating the whole action on
   `PERMISSIONS.MANAGE_SETTINGS` only (via `requireSettingsManager()`, actions.ts:22-25). There is
   no second, mileage-origin-specific permission check anywhere in the current action body. For
   the three new tests to be meaningful, `actions.ts` itself needs new logic (not requested of
   this report, but noted as a hard dependency): something that either (a) calls
   `requirePermission`/checks `actor.permissions.has(...)` a second time specifically when a
   `mileage_origin` form field is present and materially different from the current value, or (b)
   inspects `actor.permissions` directly (since `actor` — once it's a real `StaffProfile`, not the
   two-field `ACTOR` stub — already carries `.permissions: Set<string>` per rbac.ts:289, confirmed
   in `D1a-settings-actions.md` §2, "CONFIRMED" verdict there).
3. To make `ACTOR` distinguish Owner from Admin, the caller will most likely need to give `ACTOR`
   (or a second constant, e.g. `ADMIN_ACTOR`) a real `permissions: Set<string>` field, and/or
   parameterize `stubAdminClient`/`requirePermission`'s mock per test via
   `mockResolvedValueOnce`/`mockImplementationOnce`. Nothing in the file currently models "two
   different actors" — there is exactly one hardcoded `ACTOR`, used identically by both existing
   tests.

### 3d. `stubAdminClient()` — the Supabase double (lines 34–69), quoted in full above (§3, lines
34–69). Key points:

- `from` is a `vi.fn((table: string) => {...})` with a two-branch conditional: `table ===
  "audit_logs"` returns an object with only an `insert` method (captures pushed rows into the
  closure-scoped `audits` array, returns `{ error: null }`); the **fallback branch (everything
  else, including `"business_settings"`) returns an object with BOTH `select` and `upsert`.**
- This means the fallback branch is not literally keyed on the string `"business_settings"` — any
  table name other than `"audit_logs"` would hit it. The comment `// business_settings` (line 47)
  documents intent but the code does not enforce it. If the real action ever queries a third
  table (e.g. a lookup unrelated to settings), this stub would silently hand it the
  select/upsert-shaped object too. Not a problem for the current action (which only ever touches
  `business_settings` and `audit_logs`), but relevant if new logic queries anything else.
- `upserts` and `audits` are plain arrays closed over by both branches, returned alongside
  `client` from `stubAdminClient()`, and asserted on with `toHaveLength(N)` — see §3e.

### 3e. The existing idiom for asserting on the upsert payload

There is **no existing example of inspecting the *contents* of an upsert row** in this file —
only its count:

```
101   expect(stub.upserts).toHaveLength(1);
```

and, in the validation-failure test:

```
118   expect(stub.upserts).toHaveLength(0);
```

Nothing in this file today does `expect(stub.upserts[0]).toEqual(...)` or
`.toMatchObject(...)` or reads a specific key off `stub.upserts[0]`. A caller writing the three
new tests who wants to assert e.g. "the Admin's other edits were still saved" or "the mileage
origin key was/was not present in the written row" will need to introduce that idiom themselves —
the closest existing precedent is simply indexing `stub.upserts[0]` (it's a plain array, already
populated by `stubAdminClient`'s `upsert` closure) and asserting on it directly, e.g.
`expect(stub.upserts[0]).toMatchObject({ company_name: "New Co" })` or
`expect(stub.upserts[0].mileage_origin).toBeUndefined()` — there's no helper or custom matcher to
reuse, just the raw array.

### 3f. `formData()` helper (lines 71–86) — fields and defaults

| Field | Default (no override) |
|---|---|
| `company_name` | `"Rahma Therapy"` |
| `contact_email` | `"owner@example.test"` |
| `contact_phone` | `"07000000000"` |
| `booking_window_days` | `"30"` |
| `buffer_time_mins` | `"15"` |
| `minimum_notice_hours` | `"2"` |
| `customer_cancellation_cutoff_hours` | `"24"` |
| `allowed_cities` | `"Luton, Dunstable"` |
| `booking_status_enabled` | `"on"` |

Nine fields total, all strings (FormData is string-only). **No `mileage_origin` key is set by
this helper at all** — `formData.get("mileage_origin")` would return `null` for every existing
call site, since the key is never `.set()`. Every field accepts a single override via the
`overrides` parameter (a flat `Record<string, string>`), applied with `??` so an explicit
`overrides.<field>` always wins over the default, and any omitted key falls back to its default
verbatim. Adding a `mileage_origin` case would follow the exact same one-line idiom as any other
field (e.g. `data.set("mileage_origin", overrides.mileage_origin ?? "");` or similar), inserted
anywhere in the block — order does not matter since `FormData.set` is keyed by name, not
position.

### 3g. Existing `it()` titles (both `describe` blocks)

`describe("updateBusinessSettings — cache tag invalidation (B-149 fix)", ...)` (line 93) contains
exactly two:
1. `"invalidates the settings and audit resource tags"` (line 94)
2. `"never calls updateTag when validation fails"` (line 108)

There is only one `describe` block in the file — no second `describe` exists to nest new tests
under; the caller adding the three new tests will either add them to this same `describe` or open
a new one, both equally valid given vitest's flat `describe`/`it` model.

---

## 4. Does the stub support a `select().eq().single()` READ, and would existing tests break if the
   action gains a "read current row first" step?

**Definitive answer: the stub already supports it, and the action already does it today — so NO,
the existing two tests will not break from an action gaining (or already having) a pre-upsert
read.**

Evidence, in order:

1. **The stub's `business_settings` branch already implements the full chain**, quoted exactly
   from lines 48–56 of `updateBusinessSettings.test.ts`:
   ```
         return {
           select: () => ({
             eq: () => ({
               single: async () => ({
                 data: { id: 1, company_name: "Rahma Therapy", booking_window_days: 14 },
                 error: null,
               }),
             }),
           }),
   ```
   `select()` takes no arguments and ignores whatever is passed (there is no parameter in the
   arrow function), returns an object with `eq()` (same: no-arg, ignores arguments), which returns
   an object with `single()`, an `async` function resolving a fixed literal.

2. **`actions.ts` already calls exactly this chain, today, unconditionally**, at
   `src/app/admin/settings/actions.ts:77-81` (confirmed by direct read of the file, and
   independently corroborated by `D1a-settings-actions.md` §1e/§3):
   ```
     const { data: beforeState } = await adminClient
       .from("business_settings")
       .select("*")
       .eq("id", 1)
       .single();
   ```
   This runs **before** the upsert (line 96–100) and its result (`beforeState`) is consumed later
   at line 108 as `before_state` in the `audit_logs` insert. This is not a hypothetical future
   step — it is live code that both of the file's two current tests already exercise every time
   they run (and I confirmed both pass — see §6).

3. **Therefore**, any new "read current row first" step the caller might add for the
   mileage-origin permission gate does not need a *new* chain shape from the stub — the
   `select().eq().single()` chain the caller would call is byte-identical to the one already
   wired up and already passing. No change to `stubAdminClient`'s structure is required purely to
   support an additional read call.

**The caveat that *does* matter (this is the part worth flagging loudly):** the hardcoded literal
returned by that `single()` — `{ id: 1, company_name: "Rahma Therapy", booking_window_days: 14 }`
— has **only three keys**, none of which is `mileage_origin`, `allowed_cities`, or
`free_travel_cities`. If new logic in `actions.ts` reads `beforeState.mileage_origin` (e.g. to
compare against the submitted form value and decide whether a "mileage origin change" occurred,
which is exactly what the three new tests need to exercise), it will get `undefined` from every
one of the two *existing* tests' runs, plus from any *new* test that doesn't override this
literal. This is not test breakage by itself (`undefined` is a legal value, and depending on how
the caller writes the comparison — e.g. `String(formData.get("mileage_origin") ?? "") !==
(beforeState?.mileage_origin ?? "")` — `undefined` may coalesce harmlessly to `""` and match an
unset form field). But it does mean: **for the "resubmit unchanged" test
("allows an Admin to resubmit the form with the mileage origin unchanged") to be a faithful
simulation, the caller almost certainly needs to extend this literal (or build a
per-test-overridable version of `stubAdminClient`) so the read-back row's `mileage_origin`
matches what the test's `formData()` call submits** — otherwise "unchanged" isn't actually being
tested, it's coincidentally passing because both sides default to falsy. I recommend the caller
either (a) parameterize `stubAdminClient(businessSettingsRow?: Record<string, unknown>)` so each
new test can supply its own current-row shape, or (b) add `mileage_origin: null` (or a concrete
value) to the shared literal and override per-test where needed.

---

## 5. `src/lib/cache/__tests__/fake-supabase-admin.ts` — does the shared fake honour the select
   column list?

**No. It is a pure passthrough that ignores the select string entirely and always returns the
whole registered mock object for that table, regardless of what columns were asked for.**

Full relevant quote (lines 50–82, the `builder` function — the entire chainable mechanism):

```
  function builder(result: FakeQueryResult) {
    const chain: Record<string, unknown> = {};
    const passthrough = [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "or",
      "not",
      "gte",
      "gt",
      "lte",
      "lt",
      "ilike",
      "like",
      "order",
      "limit",
      "range",
      "returns",
      "overrideTypes",
    ];
    for (const method of passthrough) {
      chain[method] = () => chain;
    }
    chain.single = async () => result;
    chain.maybeSingle = async () => result;
    chain.then = (
      onFulfilled?: (value: FakeQueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  }
```

`"select"` is item 1 of the `passthrough` array (line 53). Every method in that array is given
the identical implementation, `() => chain` (lines 72–74) — **no parameter is even declared**, so
whatever string is passed to `.select(...)` (e.g. `"*"`, `"allowed_cities"`,
`"free_travel_cities"`, a multi-column list) is discarded unread. The only thing that determines
what data comes back is which **table name** was passed to `.from(table)` (line 85,
`resultFor(table)`, lines 39–48) — the registered `FakeQueryResult` for that table is returned
verbatim by `single()`/`maybeSingle()`/the thenable, regardless of any `select`/`eq`/`in`/etc.
call in between.

**Yes — all four `lib/booking` fixtures import this shared fake.** Confirmed by direct import
line in each file:
- `availability-options.test.ts:19` — `import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";`
- `working-hours-segments.test.ts:12` — same import
- `override-windows.test.ts:31` — same import
- `staff-recurring-windows.test.ts:31` — same import

### 5a. Why this matters — the highest-value finding in this report

The fake's column-blindness means the caller does **not** need to worry about matching a
`select("...")` string in these tests. But it means the **property name on the mock `data`
object is the only thing that matters**, and that name has to match whatever property the real
consuming code reads.

I traced the real consumer, `src/lib/booking/availability.ts` (not one of the D1a/D5 files, new
ground):

```
429 async function loadSettings(supabase: SupabaseClient) {
430   const settingsResult = await supabase
431     .from("business_settings")
432     .select(
433       "booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled"
434     )
435     .eq("id", 1)
436     .single<BusinessSettingsRecord>();
437 
438   return settingsResult.error || !settingsResult.data
439     ? null
440     : settingsResult.data;
441 }
```

and where the field is actually consumed:

```
454   if (!isCityAllowed(input.city, getAllowedCities(settings.allowed_cities))) {
455     return { reason: "Location is outside the service area.", durationMins: 0 };
456   }
```

`settings.allowed_cities` (line 454) is a **direct property access**, and `getAllowedCities`
(availability.ts:243-249) is:

```
243 function getAllowedCities(value: unknown) {
244   return Array.isArray(value)
245     ? value
246         .filter((city): city is string => typeof city === "string")
247         .map((city) => city.trim().toLowerCase())
248     : [];
249 }
```

— `Array.isArray(undefined)` is `false`, so `getAllowedCities(undefined)` returns `[]`, and
`isCityAllowed("Luton", [])` (availability.ts:251-257, `.some()` over an empty array) returns
`false`.

**Consequence, stated plainly:** if/when the Phase 1 app work changes `availability.ts` line 433
and line 454 to read `free_travel_cities` instead of `allowed_cities` (which Decision 9 in this
task's brief explicitly directs — "Application code must READ free_travel_cities"), then **every
one of the five mock objects quoted in §2 (all four `lib/booking` fixture files) will start
returning `settings.free_travel_cities === undefined`**, because none of them currently sets that
key — they only set `allowed_cities`. That collapses to an empty allowed-cities list, which fails
`isCityAllowed("Luton", ...)` for every single test in all four files that expects successful day
or slot computation for the input city `"Luton"` — which is nearly every test in
`working-hours-segments.test.ts`, `override-windows.test.ts`, and
`staff-recurring-windows.test.ts` (all of them route through `calculateAvailableSlots`/
`calculateAvailableDays` with `city: "Luton"`), plus most of `availability-options.test.ts`.

**This is not a hypothetical edge case — it is a guaranteed, repo-wide test failure the moment
someone edits `availability.ts`'s read side without editing these fixtures in the same change.**
The fix is mechanical but must happen everywhere at once: add (or rename to)
`free_travel_cities: ["Luton"]` alongside/instead of `allowed_cities: ["Luton"]` in all five
occurrences (§2.1–§2.5) the same commit that changes `availability.ts`. Per Decision 9 (dual-write
on the write path, read-new on the read path), and since these fixtures model a **read** path
(the availability engine only ever reads `business_settings`, never writes it), the fixtures only
need `free_travel_cities` added — they do not need to keep `allowed_cities` too, since the fake's
column-blindness (§5 above) means no code path in these four test files reads `allowed_cities` by
name once `availability.ts` stops asking for it. (Whether to keep both keys in the fixture for
belt-and-braces clarity is a style choice, not a correctness requirement, given the fake ignores
unused keys silently.)

---

## 6. Current pass/fail state

Ran (read-only, no `--update`, no mutation):

```
npx vitest run src/app/admin/settings/__tests__/updateBusinessSettings.test.ts src/lib/booking/__tests__/availability-options.test.ts src/lib/booking/__tests__/working-hours-segments.test.ts src/lib/booking/__tests__/override-windows.test.ts src/lib/booking/__tests__/staff-recurring-windows.test.ts
```

Result:

```
 RUN  v4.1.5 C:/Users/mamdo/Desktop/rahmatherapy - Copy/rahmatherapy-next-refactor

 Test Files  5 passed (5)
      Tests  57 passed (57)
```

All five target files pass in full today, with zero modification. This is expected and
consistent with the task's framing: the DATABASE half of Phase 1 (migration adding
`free_travel_cities`/`mileage_origin` columns and the `manage_travel_origin` permission) has
shipped, but the APP half (this item) has not — `actions.ts` still only reads/writes
`allowed_cities`, and `availability.ts` still only reads `allowed_cities`, so none of these tests
have anything new to trip over yet.

---

## Claims tested — summary table

| Claim | Verdict | Evidence |
|---|---|---|
| `updateBusinessSettings.test.ts` sets `allowed_cities` form field at line 83 | CONFIRMED | Direct read, line 83 |
| `availability-options.test.ts` mock key at line 49 | CONFIRMED | Direct read, line 49 |
| `working-hours-segments.test.ts` mock key at line 288 | CONFIRMED | Direct read, line 288 |
| `override-windows.test.ts` mock key at line 84 | CONFIRMED | Direct read, line 84 |
| `override-windows.test.ts` mock key at line 379 | CONFIRMED | Direct read, line 379 |
| `staff-recurring-windows.test.ts` mock key at line 70 | CONFIRMED | Direct read, line 70 |
| Stub supports a `select().eq().single()` read chain | CONFIRMED | `updateBusinessSettings.test.ts:48-56`; already exercised live by `actions.ts:77-81` |
| A read-first step would break the two existing tests | FAILED (i.e. it would NOT break them) | Chain already exists and is already exercised by both passing tests today |
| The shared fake (`fake-supabase-admin.ts`) honours the `select(...)` column string | FAILED (i.e. it does NOT honour it — pure passthrough) | `fake-supabase-admin.ts:50-74`, `select` is item 1 of the no-op `passthrough` array |
| All 4 `lib/booking` fixtures import the shared fake | CONFIRMED | Import lines: availability-options.test.ts:19, working-hours-segments.test.ts:12, override-windows.test.ts:31, staff-recurring-windows.test.ts:31 |
| All 5 target files currently pass | CONFIRMED | `npx vitest run` on all 5 files: 5 passed / 5, 57 passed / 57 |

## Anchors — claimed vs actual line numbers

| File | Symbol | Claimed line | Actual line | Drift |
|---|---|---|---|---|
| `updateBusinessSettings.test.ts` | `data.set("allowed_cities", ...)` | 83 | 83 | NONE |
| `availability-options.test.ts` | mock key `allowed_cities` | 49 | 49 | NONE |
| `working-hours-segments.test.ts` | mock key `allowed_cities` | 288 | 288 | NONE |
| `override-windows.test.ts` | mock key `allowed_cities` (occurrence A) | 84 | 84 | NONE |
| `override-windows.test.ts` | mock key `allowed_cities` (occurrence B) | 379 | 379 | NONE |
| `staff-recurring-windows.test.ts` | mock key `allowed_cities` | 70 | 70 | NONE |

Additional symbols located during this pass, not pre-claimed by the task prompt but needed to
answer §3–§5 (reported for the caller's use):

| File | Symbol | Actual line |
|---|---|---|
| `actions.ts` | `beforeState` read (`select("*").eq("id",1).single()`) | 77–81 |
| `actions.ts` | `updateBusinessSettings` export | 27 |
| `rbac.ts` | `requirePermission` | 401 |
| `rbac.ts` | `StaffProfile.permissions: Set<string>` | 289 |
| `rbac.ts` | `PERMISSIONS` object (no `MANAGE_TRAVEL_ORIGIN` key present) | 6–50 |
| `availability.ts` | `loadSettings` (select string) | 429–441 |
| `availability.ts` | `settings.allowed_cities` read | 454 |
| `availability.ts` | `getAllowedCities` | 243–249 |
| `availability.ts` | `BusinessSettingsRecord.allowed_cities: unknown` | 58 |
| `fake-supabase-admin.ts` | `builder` (passthrough mechanism) | 50–82 |
