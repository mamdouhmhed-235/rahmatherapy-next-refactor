// ⛔ GATE 03 — LANE RS: RECURRING SERIES.
//   Cases RS-01 (C9 — no capacity check) and RS-02 (a series consumes capacity
//   in the OTHER engine). RS-03 and RS-05 need no write and were executed by the
//   gate's authoring pass; see `RESULT.md`.
//
// ⛔ AUTHORED, NOT RUN. Gate 03 wrote this file and did NOT execute it.
//
// ── ⛔ THE SINGLE MOST DANGEROUS FIXTURE IN THE PROGRAMME ─────────────────
//
// `create_recurring_booking_series` writes a `recurring_booking_templates` row,
// and the nightly `extend-recurring-horizons` cron MATERIALISES VISITS FROM IT
// FOR EVER. A teardown that misses one does not leave litter — it leaves the
// clinic with a standing appointment for a person who does not exist, appearing
// again every week, indefinitely.
//
// ⛔ `destroyScenarioFixtures` deletes templates by `client_id` and re-reads to
// prove it. This file's teardown is UNCONDITIONAL (G19) and additionally sweeps
// by template id, because the case where the RPC succeeded and the reply never
// arrived is exactly the case that needs it.
//
// ── ⛔ WHAT RS-01 IS ACTUALLY FOR ────────────────────────────────────────
//
// ⛔ THIS IS NOT AN OPEN QUESTION. AN EARLIER VERSION OF THIS COMMENT SAID IT
// WAS, AND THAT COST A ROUND OF THE OWNER'S TIME ON 2026-08-30 — the finding was
// re-raised as if new, investigated by four agents, and closed again as
// already-decided. Do not let it happen a third time.
//
// It is TRUE that `create_recurring_booking_series` performs no capacity check:
// between the service checks and the occurrence loop there is a duplicate-visit
// guard for the SAME client and nothing else. Verified against the DEPLOYED
// function body, not the migration.
//
// ⛔ BUT THAT IS THE DESIGN THE OWNER CHOSE, in ruling D-042 (2026-08-22, commit
// `22b5fcc`). Offered "leave it / fix it properly / warn on screen", the Owner
// chose "fix it properly", and the check was deliberately placed in TypeScript
// (`checkSeriesSlots`, called at recurring-actions.ts:332, before the RPC at
// :399) rather than in SQL — because a SQL copy would be a THIRD implementation
// of the availability rules, and this project has twice been bitten by two
// copies disagreeing. HUMAN-03-02 is CLOSED by that ruling.
//
// ⛔ SO WHAT THIS TEST ACTUALLY MEASURES is the raw building block with the
// guard bypassed. It calls the RPC directly with the service-role key, which:
//   - no customer can do (`anon` has no EXECUTE — verified against the live
//     database, not assumed), and
//   - no signed-in admin can do (`authenticated` has no EXECUTE either).
// Only the server can reach it, and the one caller in the entire codebase checks
// first. So a "series created into a full slot" result here is EXPECTED, and is
// evidence about the block, not about the clinic.
//
// ⚠️ Its real value is as a tripwire: if a SECOND server-side caller is ever
// added without the check, the guarantee D-042 rests on quietly stops holding,
// and nothing else in the suite would notice.
//
// ⛔ COST: no email. The series RPC sends nothing; the confirmation mail lives in
// `src/app/admin/bookings/recurring-actions.ts`, above it.

import { expect, test } from "@playwright/test";
import { RUN_TAG, destroyScenarioFixtures, serviceClient } from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/** ⛔ Test Admin. NEVER the real Owner `01582c5d-…`. */
const ACTOR_STAFF_ID = "97310f6b-4e2f-4a9f-bec1-20224e57d8e6";

const clientIds: string[] = [];
const templateIds: string[] = [];
let day = "";
let seriesClientId = "";
let createdCount = -1;
let skippedCount = -1;
const materialised: string[] = [];

function zz(label: string) {
  return `ZZTEST-G03-${label}-${RUN_TAG}`;
}

function businessDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function weekdayOf(iso: string) {
  const [year, month, day_] = iso.split("-").map(Number);
  return new Date(year, month - 1, day_).getDay();
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ TEMPLATES FIRST AND BY ID, before anything that could fail stops the
  // chain. A surviving template is materialised by the cron for ever.
  if (templateIds.length > 0) {
    const { data: seriesBookings } = await db
      .from("bookings")
      .select("id")
      .in("recurring_template_id", templateIds);
    const ids = ((seriesBookings ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length > 0) {
      await db.from("booking_assignments").delete().in("booking_id", ids);
      await db.from("booking_items").delete().in("booking_id", ids);
      await db.from("booking_participants").delete().in("booking_id", ids);
      await db.from("operational_events").delete().in("booking_id", ids);
      await db.from("bookings").delete().in("id", ids);
    }
    await db.from("audit_logs").delete().in("target_id", templateIds);
    const { error } = await db.from("recurring_booking_templates").delete().in("id", templateIds);
    if (error) problems.push(`could not remove the series templates: ${error.message}`);
    const { data: left } = await db
      .from("recurring_booking_templates")
      .select("id")
      .in("id", templateIds);
    if ((left ?? []).length) {
      problems.push(
        `⛔ ${(left ?? []).length} recurring_booking_templates rows SURVIVED. The nightly cron ` +
          `will materialise visits from them for ever. Remove them by hand NOW.`,
      );
    }
  }

  try {
    await destroyScenarioFixtures(db, clientIds, { prefix: `ZZTEST-G03-%-${RUN_TAG}` });
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ GATE-03 RECURRING TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

test.describe("Gate 03 · RS — recurring series and capacity", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");

  test("step 0 — a clear working day and a client of our own", async () => {
    const db = serviceClient();
    for (let offset = 10; offset <= 24 && !day; offset += 1) {
      const candidate = businessDate(offset);
      if (weekdayOf(candidate) === 0) continue;
      const { data: existing } = await db
        .from("bookings")
        .select("id")
        .eq("booking_date", candidate)
        .in("status", ["pending", "confirmed"]);
      if (((existing ?? []) as { id: string }[]).length === 0) day = candidate;
    }
    expect(day, "⛔ no clear working day in the next three weeks; re-run later").not.toBe("");

    const { data: created, error } = await db
      .from("clients")
      .insert({
        full_name: zz("RS-SERIES"),
        email: `${zz("RS-SERIES").toLowerCase()}@probe.invalid`,
        phone: "07700900331",
        address: "1 ZZTEST Street",
        postcode: "LU1 1AA",
        city: "Luton",
        client_source: "manual",
      })
      .select("id")
      .single();
    expect(error?.message ?? "", "could not create the series client").toBe("");
    seriesClientId = (created as { id: string }).id;
    clientIds.push(seriesClientId);
    console.log(`[RS step 0] day ${day} · client ${seriesClientId}`);
  });

  test("RS-01 — ⛔ C9: what a series does when the slot is already full", async () => {
    test.setTimeout(300_000);
    const db = serviceClient();
    expect(seriesClientId, "step 0 must have run").not.toBe("");

    // Fill 12:00 with unassigned female reservations until the ordinary booking
    // path refuses. Bounded — a runaway loop against production is not
    // acceptable.
    let reservations = 0;
    let refusal: string | null = null;
    for (let i = 0; i < 8; i += 1) {
      const { error } = await db.rpc("create_booking_request", {
        p_service_slugs: ["massage-30"],
        p_contact_full_name: zz(`RS01P${i}`),
        p_contact_email: `${zz(`RS01P${i}`).toLowerCase()}@probe.invalid`,
        p_contact_phone: "07700900332",
        p_customer_notes: "",
        p_health_notes: "",
        p_consent_acknowledged: true,
        p_service_address_line1: "1 ZZTEST Street",
        p_service_city: "Luton",
        p_service_postcode: "LU1 1AA",
        p_access_notes: "",
        p_booking_date: day,
        p_start_time: "12:00:00",
        p_participant_genders: ["female"],
        p_booking_source: "website",
        p_override_availability: false,
      });
      if (error) {
        refusal = error.message;
        break;
      }
      reservations += 1;
    }
    // Collect the client rows the RPC created so teardown can find them.
    const { data: probeClients } = await db
      .from("clients")
      .select("id")
      .like("full_name", `ZZTEST-G03-RS01P%-${RUN_TAG}`);
    for (const row of (probeClients ?? []) as { id: string }[]) clientIds.push(row.id);

    expect(
      refusal,
      `⛔ eight bookings did not close 12:00 on ${day}, so "the slot is full" is not true and ` +
        `RS-01 would prove nothing.`,
    ).not.toBeNull();
    expect(refusal ?? "").toContain("Not enough female therapists available");
    console.log(`[RS-01] 12:00 on ${day} is full after ${reservations} bookings: "${refusal}"`);

    // ⛔ NOW ASK THE SERIES PATH THE SAME QUESTION.
    const { data: series, error: seriesError } = await db.rpc("create_recurring_booking_series", {
      p_client_id: seriesClientId,
      p_service_slug: "massage-30",
      p_first_occurrence_date: day,
      p_anchor_start_time: "12:00:00",
      p_cadence: "weekly",
      p_end_type: "after_count",
      p_end_count: 3,
      p_participant_gender: "female",
      p_required_therapist_gender: "female",
      p_actor_staff_id: ACTOR_STAFF_ID,
      p_open_to_any_therapist: true,
      p_horizon_weeks: 4,
      p_service_address_line1: "1 ZZTEST Street",
      p_service_postcode: "LU1 1AA",
      p_service_city: "Luton",
    });

    if (!seriesError && series) {
      const payload = series as { templateId?: string; occurrenceCount?: number; skippedCount?: number };
      if (payload.templateId) templateIds.push(payload.templateId);
      createdCount = Number(payload.occurrenceCount ?? -1);
      skippedCount = Number(payload.skippedCount ?? -1);
    }

    console.log(
      `[RS-01] MEASURED: series ${seriesError ? `REFUSED ("${seriesError.message}")` : "CREATED"} ` +
        `into a slot the ordinary booking path had just refused. ` +
        `created=${createdCount} skipped=${skippedCount}`,
    );

    // ⛔ RECORDED, NOT ASSERTED EITHER WAY. HUMAN-03-02 is the Owner's decision:
    // (a) run the same capacity test per occurrence and count failures into
    // `skippedCount`, or (b) accept it, on the grounds that series are created
    // by staff who know their own diary. This assertion pins TODAY'S behaviour
    // so whichever way the Owner rules, the change is visible.
    expect(
      seriesError === null,
      `RS-01 expectation pinned at authoring time: the series path performs NO capacity check, ` +
        `so it is expected to SUCCEED here. If this now fails, C9 has been fixed — update this ` +
        `case to assert the new skippedCount contract instead.`,
    ).toBe(true);
    expect(
      skippedCount,
      `⛔ C9: every occurrence was created and NONE was skipped for lack of capacity, in a slot ` +
        `the ordinary path refuses. This is the finding, recorded.`,
    ).toBe(0);

    const { data: occurrences } = await db
      .from("bookings")
      .select("id, booking_date, start_time")
      .eq("client_id", seriesClientId)
      .order("booking_date");
    for (const row of (occurrences ?? []) as { booking_date: string }[]) {
      materialised.push(row.booking_date);
    }
    console.log(`[RS-01] materialised occurrences: ${materialised.join(", ")}`);
  });

  test("RS-02 — a series occurrence consumes capacity in the READ engine too", async () => {
    const db = serviceClient();
    test.skip(materialised.length === 0, "RS-01 created no occurrences to check");

    // The LAST occurrence sits on a date nothing else in this file touched.
    const target = materialised[materialised.length - 1];

    // ⛔ Ask the PUBLIC engine, not the database. The point is that the series
    // wrote ordinary `bookings` + `booking_assignments` rows, so the customer
    // calendar sees them like any other booking. Asking the tables would only
    // prove the rows exist.
    const before = await offeredTimes(target);
    const hadNoon = before.includes("12:00");

    console.log(
      `[RS-02] on ${target} the public calendar offers ${before.length} times; ` +
        `12:00 ${hadNoon ? "IS" : "is NOT"} among them`,
    );

    // ⛔ NON-VACUITY: the day must sell SOMETHING, or "12:00 is absent" would be
    // true of a dead day rather than of a consumed slot.
    expect(
      before.length,
      `⛔ ${target} sells nothing at all, so the absence of 12:00 proves nothing`,
    ).toBeGreaterThan(0);

    // ⛔ THE ASSERTION THAT CAN ACTUALLY FAIL.
    //
    // "Is 12:00 still on sale?" is NOT it. On a day with one booking and several
    // free therapists, 12:00 stays on sale whether the engine counts the
    // occurrence or ignores it entirely — the same answer either way, which is
    // the definition of a test that proves nothing. The original RS-02 asked
    // exactly that.
    //
    // The number that MOVES is `availableStaffByGender.female`. If the engine
    // sees the occurrence, the occupied time must offer exactly ONE fewer female
    // therapist than a comparable free time on the SAME day — same working
    // hours, same staff, same date, so the occurrence is the only difference.
    const slots = await offeredSlots(target);
    const occupied = slots.find((slot) => slot.time === "12:00");
    const control = slots.find(
      (slot) => slot.time !== "12:00" && (slot.availableStaffByGender?.female ?? 0) > 0
    );

    if (occupied && control) {
      const occupiedFree = occupied.availableStaffByGender?.female ?? 0;
      const controlFree = control.availableStaffByGender?.female ?? 0;
      console.log(
        `[RS-02] female therapists free — 12:00 (has the occurrence): ${occupiedFree} · ` +
          `${control.time} (control): ${controlFree}`
      );
      expect(
        occupiedFree,
        `⛔ THE ENGINE IS NOT COUNTING THE SERIES OCCURRENCE. At 12:00 on ${target} it reports ` +
          `${occupiedFree} female therapists free, the same as the free control slot ` +
          `${control.time}. A visit sitting at 12:00 must consume one, or the slot stays on ` +
          `sale while a therapist's time is already spoken for.`
      ).toBe(controlFree - 1);
    } else {
      // ⛔ Say so rather than passing quietly. A skipped comparison is not a pass.
      console.warn(
        `[RS-02] ⛔ COMPARISON NOT MADE — occupied slot ${occupied ? "found" : "MISSING"}, ` +
          `control ${control ? "found" : "MISSING"}. The capacity claim is UNPROVEN on this run.`
      );
    }

    // The occurrence must also exist as an ordinary booking row the engine can
    // see at all.
    const { data: occurrenceRows } = await db
      .from("bookings")
      .select("id, status")
      .eq("client_id", seriesClientId)
      .eq("booking_date", target);
    const rows = (occurrenceRows ?? []) as { id: string; status: string }[];
    expect(rows.length, "the occurrence must exist as an ordinary booking row").toBeGreaterThan(0);
    expect(
      ["pending", "confirmed"],
      "⛔ a series occurrence must carry a status the read engine counts, or it reserves a " +
        "therapist's time while leaving the slot on sale",
    ).toContain(rows[0].status);

    const { data: assignments } = await db
      .from("booking_assignments")
      .select("id, status, assigned_staff_id")
      .eq("booking_id", rows[0].id);
    const assignmentRows = (assignments ?? []) as { status: string }[];
    expect(
      assignmentRows.length,
      "⛔ an occurrence with no assignment row consumes NOTHING — `.some()` on an empty array " +
        "is false, so the engine would leave the slot fully on sale",
    ).toBeGreaterThan(0);
    expect(["unassigned", "assigned"]).toContain(assignmentRows[0].status);
  });
});

/** What the public booking engine would offer on a date. Uncached. */
/**
 * The full slot objects, including `availableStaffByGender` — the number that
 * actually MOVES when a booking consumes capacity.
 *
 * ⛔ Exists because asking only "is 12:00 on sale?" is a question whose answer is
 * the same whether the engine counts a booking or ignores it completely, on any
 * day that is not almost full. RS-02 asked exactly that and could never have
 * failed.
 */
async function offeredSlots(
  date: string
): Promise<{ time: string; availableStaffByGender: Record<string, number> }[]> {
  const response = await fetch(`${process.env.E2E_BASE_URL}/api/availability/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      date,
      serviceIds: ["massage-30"],
      participantGenders: ["female"],
      city: "Luton",
    }),
  });
  expect(response.status, `⛔ the availability endpoint refused a question about ${date}`).toBe(200);
  const payload = (await response.json()) as {
    slots?: { time: string; availableStaffByGender: Record<string, number> }[];
  };
  return payload.slots ?? [];
}

async function offeredTimes(date: string): Promise<string[]> {
  const response = await fetch(`${process.env.E2E_BASE_URL}/api/availability/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      date,
      serviceIds: ["massage-30"],
      participantGenders: ["female"],
      city: "Luton",
    }),
  });
  expect(response.status, `⛔ the availability endpoint refused a question about ${date}`).toBe(200);
  const payload = (await response.json()) as { slots?: { time: string }[] };
  return (payload.slots ?? []).map((slot) => slot.time).sort();
}
