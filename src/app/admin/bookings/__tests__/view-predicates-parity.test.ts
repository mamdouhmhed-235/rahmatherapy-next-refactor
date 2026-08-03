// C-16 Phase C Step 5 / plan §3.4 — SQL-vs-`filterBookings` parity.
//
// `filterBookings` (page.tsx) is the ORACLE. Every case below runs ONE query
// object down BOTH paths:
//
//   in-memory : filterBookings(fixtures, query, profile, view)
//   SQL       : bookingListFiltersFromQuery(query, view)
//                 -> buildBookingPredicatePlan(ctx)
//                 -> applyBookingPredicates(recordingBuilder, plan.steps)
//                 -> replay the recorded PostgREST filters over the fixtures
//
// and asserts the two select the same rows, and that both match a hand-derived
// expectation. The SQL side deliberately goes through the PRODUCTION plan
// builder and the PRODUCTION replayer — only the last hop (interpreting the
// recorded PostgREST filters against fixture rows instead of sending them to
// Postgres) is test-only, and it is a generic interpreter of the filter
// grammar, not a second copy of the view semantics.
//
// The recorded filters' acceptance by the real PostgREST instance was verified
// separately with read-only `count: "exact", head: true` probes before this
// spec was written (aliased `!inner` filter embeds, conjunctive filters on one
// alias, repeated `.or(...)`, `not.is.null` and `client_id.in.(…)` inside
// `.or(...)`, `.in("id", [])`).
//
// 31 cases over 17 fixtures (plan §3.4 asks for 20), covering all 11 views,
// C-05's cancelled/no_show opt-ins, claimable's strictness, and search's
// joined-client and raw-id paths. Two further cases at the bottom PIN the two
// places SQL cannot reproduce the oracle, so neither can widen unnoticed.
//
// FIX ROUND (this revision): B15-B17 close three more corpus gaps where a
// view's predicate had a clause no fixture made the SOLE reason a row
// qualified — see each fixture's comment. Six existing expectations grew to
// include the new fixtures where they genuinely belong (attention, upcoming,
// unassigned, cancelled, series, and the assignment_status=unassigned
// filter); no existing assertion was narrowed or removed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { filterBookings } from "../page";
import {
  BOOKING_FILTER_EMBEDS,
  applyBookingPredicates,
  bookingListFiltersFromQuery,
  buildBookingPredicatePlan,
  type BookingFilterAlias,
  type BookingPredicateContext,
} from "../bookings-list-data";
import { getTodayIsoDate } from "../_helpers";
import type { BookingRecord } from "../types";
import type { BookingViewKey } from "../BookingsChrome";

// 2026-06-01 11:00 Europe/London (BST) — same anchor convention as
// filterBookings.test.ts, so `getTodayIsoDate()` inside the oracle resolves to
// the same "today" this spec hands the SQL plan.
const NOW = new Date("2026-06-01T10:00:00.000Z");
const TODAY = "2026-06-01";

const STAFF_A = "aaaaaaaa-0000-4000-8000-000000000001";
const STAFF_B = "bbbbbbbb-0000-4000-8000-000000000002";
const STAFF_C = "cccccccc-0000-4000-8000-000000000003";
const TEMPLATE_1 = "11111111-0000-4000-8000-00000000000a";
const TEMPLATE_2 = "22222222-0000-4000-8000-00000000000b";
const CLIENT_1 = "c1111111-0000-4000-8000-00000000000c";
const CLIENT_2 = "c2222222-0000-4000-8000-00000000000d";

/** Fixture ids are real UUIDs so the `search`-by-id arm is exercised honestly. */
const ID = {
  B1: "00000001-0000-4000-8000-000000000001",
  B2: "00000002-0000-4000-8000-000000000002",
  B3: "00000003-0000-4000-8000-000000000003",
  B4: "00000004-0000-4000-8000-000000000004",
  B5: "00000005-0000-4000-8000-000000000005",
  B6: "00000006-0000-4000-8000-000000000006",
  B7: "00000007-0000-4000-8000-000000000007",
  B8: "00000008-0000-4000-8000-000000000008",
  B9: "00000009-0000-4000-8000-000000000009",
  B10: "00000010-0000-4000-8000-000000000010",
  B11: "00000011-0000-4000-8000-000000000011",
  B12: "00000012-0000-4000-8000-000000000012",
  B13: "00000013-0000-4000-8000-000000000013",
  // Added after a deliberate sabotage run showed the corpus could not catch
  // `view=upcoming` losing its `status != completed` clause: every completed
  // fixture was also past-dated, so the date clause hid the missing one.
  B14: "00000014-0000-4000-8000-000000000014",
  // B15-B17: a FIX ROUND closing three more of the same class of hole — see
  // the comments on each fixture below.
  B15: "00000015-0000-4000-8000-000000000015",
  B16: "00000016-0000-4000-8000-000000000016",
  B17: "00000017-0000-4000-8000-000000000017",
} as const;

type FixtureRow = BookingRecord & { client_id: string | null };

const LABEL_BY_ID = new Map<string, string>(
  Object.entries(ID).map(([label, id]) => [id, label])
);
const labels = (rows: FixtureRow[]) =>
  rows.map((row) => LABEL_BY_ID.get(row.id) ?? row.id);

function assignment(
  overrides: Partial<BookingRecord["booking_assignments"][number]>
): BookingRecord["booking_assignments"][number] {
  return {
    id: `assignment-${Math.random().toString(16).slice(2)}`,
    participant_id: "participant-1",
    assigned_staff_id: null,
    required_therapist_gender: "female",
    status: "unassigned",
    staff_profiles: null,
    ...overrides,
  };
}

function item(serviceName: string): BookingRecord["booking_items"][number] {
  return {
    id: `item-${serviceName}`,
    booking_participant_id: null,
    service_name_snapshot: serviceName,
    service_price_snapshot: 0,
    service_duration_snapshot: 30,
  };
}

function booking(overrides: Partial<FixtureRow>): FixtureRow {
  return {
    id: ID.B1,
    booking_date: TODAY,
    start_time: "10:00",
    end_time: "11:00",
    total_duration_mins: 60,
    total_price: 0,
    contact_full_name: "",
    contact_email: "",
    contact_phone: "",
    booking_source: "admin",
    amount_due: null,
    amount_paid: null,
    paid_at: null,
    payment_note: null,
    status: "confirmed",
    payment_status: "unpaid",
    payment_method: null,
    assignment_status: "fully_assigned",
    group_booking: false,
    service_address_line1: null,
    service_address_line2: null,
    service_city: null,
    service_postcode: null,
    access_notes: null,
    consent_acknowledged: true,
    customer_notes: null,
    health_notes: null,
    customer_manage_notes: null,
    cancelled_at: null,
    customer_cancelled_at: null,
    customer_cancellation_note: null,
    last_customer_manage_action_at: null,
    reschedule_requested_at: null,
    reschedule_preferred_date: null,
    reschedule_preferred_time: null,
    reschedule_note: null,
    reschedule_status: "none",
    admin_notes: null,
    treatment_notes: null,
    created_at: "2026-05-01T00:00:00.000Z",
    recurring_template_id: null,
    client_id: null,
    clients: null,
    booking_participants: [],
    booking_items: [],
    booking_assignments: [],
    ...overrides,
  };
}

const FIXTURES: FixtureRow[] = [
  booking({
    id: ID.B1,
    booking_date: TODAY,
    status: "pending",
    assignment_status: "unassigned",
    contact_full_name: "Ahmed Ali",
    contact_phone: "07700900001",
  }),
  booking({
    id: ID.B2,
    booking_date: TODAY,
    contact_full_name: "Bilal Khan",
    booking_items: [item("Hijama")],
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_A, status: "assigned" }),
    ],
  }),
  booking({
    id: ID.B3,
    booking_date: "2026-06-15",
    assignment_status: "partially_assigned",
    service_city: "Luton",
    service_postcode: "LU1 3AB",
    booking_items: [item("Deep Tissue Massage")],
    booking_assignments: [
      assignment({
        assigned_staff_id: STAFF_B,
        required_therapist_gender: "male",
        status: "assigned",
      }),
    ],
  }),
  booking({
    id: ID.B4,
    booking_date: "2026-06-10",
    reschedule_status: "requested",
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_B, status: "assigned" }),
    ],
  }),
  booking({
    id: ID.B5,
    booking_date: "2026-06-20",
    customer_cancelled_at: "2026-05-30T09:00:00.000Z",
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_A, status: "assigned" }),
    ],
  }),
  booking({
    id: ID.B6,
    booking_date: "2026-06-05",
    assignment_status: "unassigned",
    booking_assignments: [assignment({})],
  }),
  booking({
    id: ID.B7,
    booking_date: "2026-06-06",
    assignment_status: "unassigned",
    booking_assignments: [assignment({ required_therapist_gender: "male" })],
  }),
  booking({
    id: ID.B8,
    booking_date: "2026-05-20",
    assignment_status: "unassigned",
    booking_assignments: [assignment({})],
  }),
  booking({
    id: ID.B9,
    booking_date: "2026-06-08",
    status: "cancelled",
    assignment_status: "unassigned",
    booking_assignments: [assignment({})],
  }),
  booking({
    id: ID.B10,
    booking_date: "2026-05-25",
    status: "no_show",
    assignment_status: "partially_assigned",
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_A, status: "assigned" }),
    ],
  }),
  booking({
    id: ID.B11,
    booking_date: "2026-05-28",
    status: "completed",
    payment_status: "paid",
    recurring_template_id: TEMPLATE_1,
    booking_items: [item("Hijama")],
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_A, status: "completed" }),
    ],
  }),
  // The two-assignment row. It is what proves each independent `.some(...)` in
  // the oracle needs its OWN PostgREST alias: `view=assigned` (staff A) plus
  // `assigned_staff=<staff B>` must match here, and would not if both filters
  // had to hold on the same joined assignment row.
  booking({
    id: ID.B12,
    booking_date: "2026-06-12",
    recurring_template_id: TEMPLATE_2,
    contact_full_name: "Zainab Iqbal",
    contact_email: "zainab@example.test",
    contact_phone: "07700900123",
    service_city: "Luton",
    service_postcode: "LU2 7XY",
    service_address_line1: "12 Mill Street",
    client_id: CLIENT_1,
    clients: {
      full_name: "Zainab Iqbal",
      email: "zainab@example.test",
      phone: "07700900123",
    },
    booking_items: [item("Hijama")],
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_A, status: "assigned" }),
      assignment({
        assigned_staff_id: STAFF_B,
        required_therapist_gender: "male",
        status: "assigned",
      }),
    ],
  }),
  // Matches a search only through its CLIENT row, never its own contact fields.
  booking({
    id: ID.B13,
    booking_date: "2026-06-19",
    contact_full_name: "Front Desk",
    contact_phone: "07000000000",
    service_address_line1: "5 Chapel Row",
    client_id: CLIENT_2,
    clients: {
      full_name: "Mariam Haddad",
      email: "mariam@example.test",
      phone: "07700900999",
    },
    booking_items: [item("Reflexology")],
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_C, status: "assigned" }),
    ],
  }),
  // A FUTURE-dated completed booking. Without it, `view=upcoming`'s
  // `status != completed` clause is unfalsifiable: the only other completed
  // row is past-dated, so the date clause excludes it either way.
  booking({
    id: ID.B14,
    booking_date: "2026-06-25",
    status: "completed",
    booking_items: [item("Reflexology")],
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_C, status: "completed" }),
    ],
  }),
  // Closes a parity gap: no earlier fixture makes `status.eq.pending` the
  // SOLE true `attention` clause — B1 is pending but also
  // `assignment_status: "unassigned"`, so deleting `status.eq.pending` from
  // the SQL predicate went uncaught (B1 still qualified through the other
  // clause). B15 is pending, fully assigned, has no pending reschedule and
  // was never customer-cancelled, so it can only qualify through that one
  // clause.
  booking({
    id: ID.B15,
    booking_date: "2026-06-22",
    status: "pending",
    assignment_status: "fully_assigned",
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_C, status: "assigned" }),
    ],
  }),
  // Closes a parity gap: every other row whose assignment is
  // `status: "unassigned"` also has `assigned_staff_id: null`, so deleting
  // the `isNull("fv.assigned_staff_id")` guard from `claimable` went uncaught
  // — the remaining `status`/gender/date conditions were enough on their own
  // for the whole corpus. B16's assignment is otherwise fully claimable
  // (unassigned status, gender-matched, future-dated, not cancelled) but
  // already carries a staff id — the exact shape the null check exists to
  // reject.
  booking({
    id: ID.B16,
    booking_date: "2026-06-18",
    assignment_status: "unassigned",
    booking_assignments: [assignment({ assigned_staff_id: STAFF_C })],
  }),
  // Closes a parity gap: the "series ... cancelled included" case's expected
  // set previously contained no cancelled or no_show row, so it asserted
  // nothing about the C-05 archive exemption its name claimed to pin. B17 is
  // cancelled AND belongs to a recurring template, so it only stays in
  // `view=series` because that view is archive-exempt.
  booking({
    id: ID.B17,
    booking_date: "2026-05-18",
    status: "cancelled",
    assignment_status: "fully_assigned",
    recurring_template_id: TEMPLATE_1,
    booking_assignments: [
      assignment({ assigned_staff_id: STAFF_C, status: "assigned" }),
    ],
  }),
];

const FIXTURE_CLIENTS = [
  {
    id: CLIENT_1,
    full_name: "Zainab Iqbal",
    email: "zainab@example.test",
    phone: "07700900123",
  },
  {
    id: CLIENT_2,
    full_name: "Mariam Haddad",
    email: "mariam@example.test",
    phone: "07700900999",
  },
];

/**
 * Stands in for `getSearchClientIds`, which runs
 * `.or(full_name.ilike, email.ilike, phone.ilike)` against `clients`.
 */
function resolveSearchClientIds(search: string | undefined): string[] {
  if (!search) return [];
  const needle = search.toLowerCase();
  return FIXTURE_CLIENTS.filter((client) =>
    [client.full_name, client.email, client.phone].some((value) =>
      value.toLowerCase().includes(needle)
    )
  ).map((client) => client.id);
}

function profile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: STAFF_A,
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set([PERMISSIONS.CLAIM_ASSIGNMENTS]),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The PostgREST-side evaluator: records what `applyBookingPredicates` emits,
// then interprets those filters over fixture rows. Generic — it knows the
// filter grammar, not the bookings views.
// ---------------------------------------------------------------------------

type Recorded =
  | { kind: "eq" | "neq" | "gte" | "lte"; column: string; value: unknown }
  | { kind: "in"; column: string; values: readonly string[] }
  | { kind: "is"; column: string }
  | { kind: "not"; column: string; operator: string; value: unknown }
  | { kind: "or"; filters: string };

function createRecordingBuilder() {
  const recorded: Recorded[] = [];
  const self = {
    recorded,
    eq(column: string, value: unknown) {
      recorded.push({ kind: "eq", column, value });
      return self;
    },
    neq(column: string, value: unknown) {
      recorded.push({ kind: "neq", column, value });
      return self;
    },
    gte(column: string, value: unknown) {
      recorded.push({ kind: "gte", column, value });
      return self;
    },
    lte(column: string, value: unknown) {
      recorded.push({ kind: "lte", column, value });
      return self;
    },
    in(column: string, values: readonly string[]) {
      recorded.push({ kind: "in", column, values });
      return self;
    },
    is(column: string) {
      recorded.push({ kind: "is", column });
      return self;
    },
    not(column: string, operator: string, value: unknown) {
      recorded.push({ kind: "not", column, operator, value });
      return self;
    },
    or(filters: string) {
      recorded.push({ kind: "or", filters });
      return self;
    },
  };
  return self;
}

type Cells = Record<string, unknown>;

/** `("cancelled","no_show")` -> ["cancelled", "no_show"] */
function parseInList(operand: string): string[] {
  return operand
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => part.trim().replace(/^"/, "").replace(/"$/, ""))
    .filter((part) => part.length > 0);
}

/** `"%zainab%"` (quoted, LIKE-escaped) -> `zainab` */
function parseIlikeNeedle(operand: string): string {
  let value = operand;
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value.startsWith("%")) value = value.slice(1);
  if (value.endsWith("%")) value = value.slice(0, -1);
  return value.replace(/\\(.)/g, "$1");
}

/** Splits a PostgREST logic tree's arms on top-level commas only. */
function splitArms(filters: string): string[] {
  const arms: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let i = 0; i < filters.length; i++) {
    const char = filters[i];
    if (quoted) {
      current += char;
      if (char === '"' && filters[i - 1] !== "\\") quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      current += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      arms.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0) arms.push(current);
  return arms;
}

function matchesArm(arm: string, cells: Cells): boolean {
  const dot = arm.indexOf(".");
  const column = arm.slice(0, dot);
  const rest = arm.slice(dot + 1);
  const cell = cells[column];

  if (rest === "not.is.null") return cell !== null && cell !== undefined;
  if (rest.startsWith("ilike.")) {
    const needle = parseIlikeNeedle(rest.slice("ilike.".length));
    return typeof cell === "string" && cell.toLowerCase().includes(needle.toLowerCase());
  }
  if (rest.startsWith("in.")) return parseInList(rest.slice(3)).includes(String(cell));
  if (rest.startsWith("neq.")) return String(cell) !== rest.slice(4);
  if (rest.startsWith("eq.")) return String(cell) === rest.slice(3);
  throw new Error(`parity evaluator: unsupported or() arm "${arm}"`);
}

function matchesScalar(step: Recorded, cells: Cells, column: string): boolean {
  const cell = cells[column];
  switch (step.kind) {
    case "eq":
      return cell === step.value;
    case "neq":
      return cell !== step.value;
    case "gte":
      return String(cell) >= String(step.value);
    case "lte":
      return String(cell) <= String(step.value);
    case "in":
      return step.values.includes(String(cell));
    case "is":
      return cell === null || cell === undefined;
    case "not":
      if (step.operator === "in") return !parseInList(String(step.value)).includes(String(cell));
      if (step.operator === "is") return cell !== null && cell !== undefined;
      throw new Error(`parity evaluator: unsupported not.${step.operator}`);
    case "or":
      return splitArms(step.filters).some((arm) => matchesArm(arm, cells));
  }
}

function embedRowsFor(row: FixtureRow, alias: BookingFilterAlias): Cells[] {
  const table = BOOKING_FILTER_EMBEDS[alias];
  return (row as unknown as Record<string, Cells[]>)[table] ?? [];
}

/** Runs the recorded PostgREST filters over fixture rows. */
function selectViaSql(ctx: BookingPredicateContext, rows: FixtureRow[]): FixtureRow[] {
  const plan = buildBookingPredicatePlan(ctx);
  const builder = applyBookingPredicates(createRecordingBuilder(), plan.steps);
  const recorded = builder.recorded;

  const topLevel = recorded.filter(
    (step) => step.kind === "or" || !step.column.includes(".")
  );
  const byAlias = new Map<BookingFilterAlias, Recorded[]>();
  for (const step of recorded) {
    if (step.kind === "or" || !step.column.includes(".")) continue;
    const alias = step.column.split(".")[0] as BookingFilterAlias;
    if (!(alias in BOOKING_FILTER_EMBEDS)) {
      throw new Error(`parity evaluator: unknown embed alias "${alias}"`);
    }
    // Declaring the alias without ever adding it to plan.embeds would emit a
    // filter on a table the select never joins — PostgREST would reject it.
    expect(plan.embeds).toContain(alias);
    const existing = byAlias.get(alias) ?? [];
    existing.push(step);
    byAlias.set(alias, existing);
  }

  return rows.filter((row) => {
    const cells = row as unknown as Cells;
    if (!topLevel.every((step) => matchesScalar(step, cells, step.kind === "or" ? "" : step.column))) {
      return false;
    }
    // `!inner` on one alias is a single join: every filter carrying that alias
    // must hold on the SAME embedded row.
    for (const [alias, steps] of byAlias) {
      const matched = embedRowsFor(row, alias).some((embedRow) =>
        steps.every((step) =>
          matchesScalar(step, embedRow, (step as { column: string }).column.split(".")[1])
        )
      );
      if (!matched) return false;
    }
    return true;
  });
}

interface ParityCase {
  name: string;
  view: BookingViewKey;
  query: Record<string, string | string[] | undefined>;
  expected: (keyof typeof ID)[];
  /** Defaults to the claim-capable Staff A. */
  staff?: StaffProfile;
  canClaim?: boolean;
  /** Set when an empty selection IS the assertion (an invariant, not a gap). */
  intentionallyEmpty?: true;
}

const ALL_LABELS = Object.keys(ID) as (keyof typeof ID)[];

const CASES: ParityCase[] = [
  { name: "view=all — no predicate", view: "all", query: { view: "all" }, expected: ALL_LABELS },
  {
    name: "view=attention — pending / not-fully-assigned / reschedule / customer-cancelled",
    view: "attention",
    query: { view: "attention" },
    expected: ["B1", "B3", "B4", "B5", "B6", "B7", "B8", "B15", "B16"],
  },
  {
    name: "view=attention + status=cancelled — C-05 opt-in suspends the archive rule",
    view: "attention",
    query: { view: "attention", status: "cancelled" },
    expected: ["B9"],
  },
  {
    name: "view=attention + status=no_show — same opt-in for no-shows",
    view: "attention",
    query: { view: "attention", status: "no_show" },
    expected: ["B10"],
  },
  { name: "view=today", view: "today", query: { view: "today" }, expected: ["B1", "B2"] },
  {
    name: "view=upcoming — today-or-later, not completed",
    view: "upcoming",
    query: { view: "upcoming" },
    expected: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B12", "B13", "B15", "B16"],
  },
  {
    name: "view=claimable — gender-matched, future-dated, unassigned only",
    view: "claimable",
    query: { view: "claimable" },
    expected: ["B6"],
  },
  {
    name: "view=claimable + status=cancelled — stays strict (C-05 lockdown invariant)",
    view: "claimable",
    query: { view: "claimable", status: "cancelled" },
    expected: [],
    intentionallyEmpty: true,
  },
  {
    name: "view=claimable without the claim permission — nothing is claimable",
    view: "claimable",
    query: { view: "claimable" },
    staff: profile({ permissions: new Set<string>() }),
    canClaim: false,
    expected: [],
    intentionallyEmpty: true,
  },
  {
    name: "view=assigned — bookings carrying one of my assignments",
    view: "assigned",
    query: { view: "assigned" },
    expected: ["B2", "B5", "B11", "B12"],
  },
  {
    name: "view=unassigned",
    view: "unassigned",
    query: { view: "unassigned" },
    expected: ["B1", "B6", "B7", "B8", "B16"],
  },
  {
    name: "view=partially_assigned",
    view: "partially_assigned",
    query: { view: "partially_assigned" },
    expected: ["B3"],
  },
  {
    name: "view=completed — past and future alike",
    view: "completed",
    query: { view: "completed" },
    expected: ["B11", "B14"],
  },
  {
    name: "view=cancelled — the archive view shows cancelled AND no_show",
    view: "cancelled",
    query: { view: "cancelled" },
    expected: ["B9", "B10", "B17"],
  },
  {
    name: "view=cancelled + status=no_show — the status filter narrows the archive",
    view: "cancelled",
    query: { view: "cancelled", status: "no_show" },
    expected: ["B10"],
  },
  {
    name: "view=series — every recurring occurrence, cancelled included",
    view: "series",
    query: { view: "series" },
    expected: ["B11", "B12", "B17"],
  },
  {
    name: "view=series + templateId — narrowed to one template",
    view: "series",
    query: { view: "series", templateId: TEMPLATE_2 },
    expected: ["B12"],
  },
  {
    name: "filter payment_status=paid (plain scalar column)",
    view: "all",
    query: { view: "all", payment_status: "paid" },
    expected: ["B11"],
  },
  {
    name: "filter assignment_status=unassigned",
    view: "all",
    query: { view: "all", assignment_status: "unassigned" },
    expected: ["B1", "B6", "B7", "B8", "B9", "B16"],
  },
  {
    name: "filter required_gender=male (EXISTS on booking_assignments)",
    view: "all",
    query: { view: "all", required_gender: "male" },
    expected: ["B3", "B7", "B12"],
  },
  {
    name: "filter service=Hijama (EXISTS on booking_items)",
    view: "all",
    query: { view: "all", service: "Hijama" },
    expected: ["B2", "B11", "B12"],
  },
  {
    name: "filter assigned_staff (EXISTS on booking_assignments)",
    view: "all",
    query: { view: "all", assigned_staff: STAFF_B },
    expected: ["B3", "B4", "B12"],
  },
  {
    name: "view=assigned + assigned_staff=<someone else> — two INDEPENDENT EXISTS",
    view: "assigned",
    query: { view: "assigned", assigned_staff: STAFF_B },
    expected: ["B12"],
  },
  {
    name: "filter from/to date window",
    view: "all",
    query: { view: "all", from: "2026-06-05", to: "2026-06-12" },
    expected: ["B4", "B6", "B7", "B9", "B12"],
  },
  {
    name: "filter location — matches the city",
    view: "all",
    query: { view: "all", location: "Luton" },
    expected: ["B3", "B12"],
  },
  {
    name: "filter location — matches address line 1 only",
    view: "all",
    query: { view: "all", location: "chapel" },
    expected: ["B13"],
  },
  {
    name: "search — booking's own contact fields",
    view: "all",
    query: { view: "all", search: "zainab" },
    expected: ["B12"],
  },
  {
    name: "search — the JOINED CLIENT path (booking's own fields never match)",
    view: "all",
    query: { view: "all", search: "mariam" },
    expected: ["B13"],
  },
  {
    name: "search — the RAW ID path (full UUID)",
    view: "all",
    query: { view: "all", search: ID.B12 },
    expected: ["B12"],
  },
  {
    name: "search — the postcode arm (note: search does NOT cover service_city)",
    view: "all",
    query: { view: "all", search: "lu1 3ab" },
    expected: ["B3"],
  },
  {
    name: "search + view + filter compose into one query",
    view: "upcoming",
    // view=upcoming + required_gender=male alone would select B3 and B12;
    // the search narrows it to the one whose postcode matches.
    query: { view: "upcoming", search: "lu2 7xy", required_gender: "male" },
    expected: ["B12"],
  },
];

function contextFor(parityCase: ParityCase): BookingPredicateContext {
  const staff = parityCase.staff ?? profile();
  const filters = bookingListFiltersFromQuery(parityCase.query, parityCase.view);
  return {
    ...filters,
    today: TODAY,
    staffId: staff.id,
    staffGender: staff.gender,
    canClaim: parityCase.canClaim ?? true,
    searchClientIds: resolveSearchClientIds(filters.search),
  };
}

describe("C-16 Step 5 — SQL view predicates vs filterBookings (the oracle)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pins the London date the oracle and the plan both resolve to", () => {
    expect(getTodayIsoDate()).toBe(TODAY);
  });

  it("covers all 11 view keys", () => {
    const covered = new Set(CASES.map((c) => c.view));
    expect([...covered].sort()).toEqual(
      [
        "all",
        "assigned",
        "attention",
        "cancelled",
        "claimable",
        "completed",
        "partially_assigned",
        "series",
        "today",
        "unassigned",
        "upcoming",
      ].sort()
    );
  });

  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, parityCase) => {
    const staff = parityCase.staff ?? profile();

    const fromOracle = filterBookings(
      FIXTURES,
      parityCase.query,
      staff,
      parityCase.view
    ) as FixtureRow[];
    const fromSql = selectViaSql(contextFor(parityCase), FIXTURES);

    // 1 — the gate: SQL selects exactly what the oracle selects.
    expect(labels(fromSql)).toEqual(labels(fromOracle));
    // 2 — and both match a hand-derived expectation, so a shared bug in the
    //     two paths cannot pass as agreement.
    expect(labels(fromOracle)).toEqual(parityCase.expected);
    // 3 — an empty selection has to be declared, never silently accepted.
    if (!parityCase.intentionallyEmpty) {
      expect(fromOracle.length).toBeGreaterThan(0);
    }
  });
});

describe("C-16 Step 5 — pinned divergences (SQL cannot reproduce these)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a PARTIAL booking id matches in memory but not in SQL", () => {
    // Postgres has no `uuid ILIKE text` operator and PostgREST has no cast
    // syntax in filter params (verified: `id::text` is rejected by the logic
    // tree parser). `audit/queries.ts:129-134` hit the same wall and answered
    // it the same way — full-UUID equality only.
    const query = { view: "all", search: ID.B12.slice(0, 8) };
    const fromOracle = filterBookings(FIXTURES, query, profile(), "all") as FixtureRow[];
    const fromSql = selectViaSql(
      contextFor({ name: "", view: "all", query, expected: [] }),
      FIXTURES
    );

    expect(labels(fromOracle)).toEqual(["B12"]);
    expect(labels(fromSql)).toEqual([]);
  });

  it("a search term straddling two fields matches in memory but not in SQL", () => {
    // The oracle tests `[...fields].join(" ").includes(term)`, so a term that
    // spans the join's whitespace matches a string no single column contains.
    const query = { view: "all", search: "zainab iqbal zainab@example.test" };
    const fromOracle = filterBookings(FIXTURES, query, profile(), "all") as FixtureRow[];
    const fromSql = selectViaSql(
      contextFor({ name: "", view: "all", query, expected: [] }),
      FIXTURES
    );

    expect(labels(fromOracle)).toEqual(["B12"]);
    expect(labels(fromSql)).toEqual([]);
  });
});
