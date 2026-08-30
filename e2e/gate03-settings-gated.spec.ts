// ⛔ GATE 03 — THE CASES THAT CANNOT RUN WITHOUT CHANGING A LIVE SETTING.
//   Cases BR-01 · BR-02 · BR-21 · BR-22 · BR-24 · M-05 · PA-02 · PA-12 · RS-04.
//
// ⛔ AUTHORED, NOT RUN, AND DELIBERATELY OPT-IN. Gate 03 wrote this file and did
// NOT execute it.
//
// ── ⛔ WHY THIS FILE IS SEPARATE, AND WHY IT REFUSES TO RUN BY DEFAULT ────
//
// Every case here needs a row in a SYSTEM table changed for the duration of one
// assertion:
//
//   BR-01 · BR-02 · PA-02   business_settings.booking_status_enabled = false
//   BR-21 · BR-22           availability_rules widened to 00:00-23:59 for one day
//   BR-24                   services.gender_restrictions = 'female_only'
//   M-05  · PA-12           services.is_visible_on_frontend = false
//   RS-04                   services.allow_recurrence = false
//
// The whole programme's standing rule is that those six tables
// (`roles`, `permissions`, `role_permissions`, `services`, `business_settings`,
// `availability_rules`) are READ-ONLY on production. The PLAN's answer was a
// Supabase preview branch; ⛔ THAT BRANCH DOES NOT EXIST, and Owner decision D22
// moved the writing cases onto production.
//
// ⚠️ Turning online booking OFF — even for seconds — CLOSES THE CLINIC'S FRONT
// DOOR to every real customer on the site at that moment. Widening the opening
// hours makes the calendar sell 03:00. Hiding a service takes it off the booking
// form. These are not test-shaped changes; they are operational ones.
//
// ⛔ SO THIS FILE REQUIRES AN EXPLICIT, DELIBERATE OPT-IN:
//
//     GATE03_ALLOW_SETTINGS_MUTATION=1
//
// Without it every case SKIPS — visibly, as "skipped", never as a pass. Wave 3
// must not set it without the Owner saying so, and should prefer a quiet hour.
//
// ── ⛔ HOW EVERY MUTATION IS MADE SAFE ───────────────────────────────────
//
// 1. Snapshot the exact row FIRST, with `select("*")`.
// 2. Change ONE column, by primary key. ⛔ Never `save_availability_day`, which
//    REPLACES the week's rows and therefore cannot restore the same ids —
//    scenario E3 measured that, and the orphaned audit rows it leaves.
// 3. Restore in a `finally`, so an assertion failure still puts it back.
// 4. RE-READ and compare. ⛔ Do not trust the restore; that is the whole lesson.
// 5. `afterAll` restores again unconditionally — putting the same values back
//    twice is harmless, and the case where the test died half-way is exactly the
//    case that needs it.

import { expect, test } from "@playwright/test";
import { RUN_TAG, destroyScenarioFixtures, serviceClient } from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const ALLOWED = process.env.GATE03_ALLOW_SETTINGS_MUTATION === "1";
const SKIP_REASON =
  "⛔ These cases change a LIVE setting (online booking off / opening hours widened / a service " +
  "hidden or restricted). Set GATE03_ALLOW_SETTINGS_MUTATION=1 only with the Owner's agreement, " +
  "and prefer a quiet hour — turning booking off closes the clinic's front door while it runs.";

const clientIds: string[] = [];
/** Snapshots taken before any mutation, keyed for the unconditional restore. */
const restores: (() => Promise<string | null>)[] = [];

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

function firstWorkingDayFrom(offset: number) {
  for (let i = offset; i < offset + 10; i += 1) {
    if (weekdayOf(businessDate(i)) !== 0) return businessDate(i);
  }
  throw new Error("no working day found");
}

function bookingArgs(opts: {
  label: string;
  date: string;
  time: string;
  source?: string;
  slugs?: string[];
  genders?: ("male" | "female")[];
}) {
  const name = zz(opts.label);
  return {
    p_service_slugs: opts.slugs ?? ["massage-30"],
    p_contact_full_name: name,
    p_contact_email: `${name.toLowerCase()}@probe.invalid`,
    p_contact_phone: "07700900321",
    p_customer_notes: "",
    p_health_notes: "",
    p_consent_acknowledged: true,
    p_service_address_line1: "1 ZZTEST Street",
    p_service_city: "Luton",
    p_service_postcode: "LU1 1AA",
    p_access_notes: "",
    p_booking_date: opts.date,
    p_start_time: opts.time,
    p_participant_genders: opts.genders ?? ["female"],
    p_booking_source: opts.source ?? "website",
    p_override_availability: false,
  };
}

type Outcome = { bookingId: string | null; message: string | null };

async function callRpc(
  db: ReturnType<typeof serviceClient>,
  args: ReturnType<typeof bookingArgs>,
): Promise<Outcome> {
  const { data, error } = await db.rpc("create_booking_request", args);
  if (error) return { bookingId: null, message: error.message };
  const bookingId = String((data as { bookingId?: string })?.bookingId ?? "");
  if (bookingId) {
    const { data: row } = await db.from("bookings").select("client_id").eq("id", bookingId).single();
    const clientId = (row as { client_id?: string } | null)?.client_id;
    if (clientId) clientIds.push(clientId);
  }
  return { bookingId: bookingId || null, message: null };
}

/**
 * ⛔ Change one column on one row, run `body`, then put it back and PROVE it.
 *
 * The restore is registered for `afterAll` as well as run in the `finally`, so a
 * process that dies mid-assertion still gets a second chance.
 */
async function withColumn<T>(
  db: ReturnType<typeof serviceClient>,
  table: string,
  match: Record<string, unknown>,
  column: string,
  temporaryValue: unknown,
  body: () => Promise<T>,
): Promise<T> {
  let query = db.from(table).select("*");
  for (const [key, value] of Object.entries(match)) query = query.eq(key, value as never);
  const { data: before, error: readError } = await query.single();
  if (readError || !before) {
    throw new Error(`could not snapshot ${table} ${JSON.stringify(match)}: ${readError?.message}`);
  }
  const original = (before as Record<string, unknown>)[column];

  const restore = async (): Promise<string | null> => {
    let update = db.from(table).update({ [column]: original });
    for (const [key, value] of Object.entries(match)) update = update.eq(key, value as never);
    const { error } = await update;
    if (error) return `could not restore ${table}.${column}: ${error.message}`;
    let verify = db.from(table).select(column);
    for (const [key, value] of Object.entries(match)) verify = verify.eq(key, value as never);
    const { data: after } = await verify.single();
    const now = (after as Record<string, unknown> | null)?.[column];
    return JSON.stringify(now) === JSON.stringify(original)
      ? null
      : `⛔ ${table}.${column} was NOT restored — it now reads ${JSON.stringify(now)}, ` +
          `and should read ${JSON.stringify(original)}`;
  };
  restores.push(restore);

  let update = db.from(table).update({ [column]: temporaryValue });
  for (const [key, value] of Object.entries(match)) update = update.eq(key, value as never);
  const { error: writeError } = await update;
  if (writeError) throw new Error(`could not set ${table}.${column}: ${writeError.message}`);

  try {
    return await body();
  } finally {
    const problem = await restore();
    if (problem) throw new Error(problem);
  }
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ RESTORE FIRST, ALWAYS. A leftover `booking_status_enabled = false` is a
  // closed clinic; a leftover hidden service is lost revenue. Both matter more
  // than any fixture row.
  for (const restore of restores.reverse()) {
    try {
      const problem = await restore();
      if (problem) problems.push(problem);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    await destroyScenarioFixtures(db, clientIds, { prefix: `ZZTEST-G03-%-${RUN_TAG}` });
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(
      `⛔ GATE-03 SETTINGS TEARDOWN DID NOT PUT PRODUCTION BACK:\n  - ${problems.join("\n  - ")}\n` +
        `⛔ CHECK THE ADMIN SETTINGS SCREEN BY HAND BEFORE DOING ANYTHING ELSE.`,
    );
  }
});

test.describe("Gate 03 · the setting-dependent cases", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");
  test.skip(!ALLOWED, SKIP_REASON);

  test("BR-01 / BR-02 / PA-02 — the pause stops the public form and NOT staff intake", async () => {
    const db = serviceClient();
    const date = firstWorkingDayFrom(8);

    await withColumn(db, "business_settings", { id: 1 }, "booking_status_enabled", false, async () => {
      // BR-01 — the public source is blocked.
      const publicAttempt = await callRpc(
        db,
        bookingArgs({ label: "BR01", date, time: "12:00:00", source: "website" }),
      );
      expect(
        publicAttempt.bookingId,
        "⛔ online booking is PAUSED and the public path still took a booking",
      ).toBeNull();
      expect(publicAttempt.message ?? "").toContain("Online booking is currently paused.");

      // BR-02 / D6 — staff intake is NOT blocked. This is the half that matters
      // operationally: pausing the website must never stop the Owner answering
      // the phone.
      const staffAttempt = await callRpc(
        db,
        bookingArgs({ label: "BR02", date, time: "12:30:00", source: "phone" }),
      );
      expect(
        staffAttempt.message,
        `⛔ PAUSING THE WEBSITE ALSO STOPPED THE PHONE. Front desk could not record a booking ` +
          `while intake was paused: "${staffAttempt.message}"`,
      ).toBeNull();
      expect(staffAttempt.bookingId).toBeTruthy();
      console.log(`[BR-01/BR-02] paused: website refused, phone accepted`);
    });

    // ⛔ AND THE CONTROL, AFTER THE RESTORE: the same public request now works,
    // which proves the refusal above was the pause and not something else.
    const afterRestore = await callRpc(
      db,
      bookingArgs({ label: "BR01C", date, time: "13:00:00", source: "website" }),
    );
    expect(
      afterRestore.message,
      `⛔ online booking did not come back after the restore: "${afterRestore.message}"`,
    ).toBeNull();
    console.log(`[PA-02] control after restore: website accepted again`);
  });

  test("BR-21 / BR-22 — widening the hours proves the midnight wrap end to end", async () => {
    const db = serviceClient();
    const date = firstWorkingDayFrom(8);
    const dow = weekdayOf(date);

    // ⛔ Two columns, so two nested guards. Both restore independently.
    await withColumn(db, "availability_rules", { day_of_week: dow }, "start_time", "00:00:00", async () =>
      withColumn(db, "availability_rules", { day_of_week: dow }, "end_time", "23:59:00", async () => {
        // BR-21 — a 23:30-23:59 booking must not block midday.
        const { data: late, error: lateError } = await db
          .from("clients")
          .insert({
            full_name: zz("BR21-LATE"),
            email: `${zz("BR21-LATE").toLowerCase()}@probe.invalid`,
            phone: "07700900322",
            postcode: "LU1 1AA",
            client_source: "manual",
          })
          .select("id")
          .single();
        expect(lateError?.message ?? "", "could not create the late-booking client").toBe("");
        clientIds.push((late as { id: string }).id);

        const lateBooking = await callRpc(
          db,
          bookingArgs({ label: "BR21LATE", date, time: "23:30:00" }),
        );
        expect(
          lateBooking.message,
          `⛔ the widened hours did not take: a 23:30 booking was refused ("${lateBooking.message}")`,
        ).toBeNull();

        const midday = await callRpc(db, bookingArgs({ label: "BR21", date, time: "12:00:00" }));
        expect(
          midday.message,
          `⛔ THE MIDNIGHT WRAP IS BACK. A 23:30 booking blocked midday: "${midday.message}"`,
        ).toBeNull();
        console.log(`[BR-21] 23:30 booked, 12:00 still sellable on ${date}`);

        // BR-22 — the fix removed the WRAP, not the buffer. A genuine
        // midnight-adjacent conflict must still be refused.
        const early = await callRpc(db, bookingArgs({ label: "BR22A", date, time: "00:00:00" }));
        expect(early.message, `⛔ a 00:00 booking was refused: "${early.message}"`).toBeNull();
        console.log(`[BR-22] 00:00 booked; the buffer must now hold 00:30 out for whoever it named`);
      }),
    );
  });

  test("BR-24 — a gender-restricted service refuses the wrong participant", async () => {
    const db = serviceClient();
    const date = firstWorkingDayFrom(8);

    await withColumn(
      db,
      "services",
      { slug: "hijama-package" },
      "gender_restrictions",
      "female_only",
      async () => {
        const refused = await callRpc(
          db,
          bookingArgs({
            label: "BR24",
            date,
            time: "14:00:00",
            slugs: ["hijama-package"],
            genders: ["male"],
          }),
        );
        expect(
          refused.bookingId,
          "⛔ a female-only service was sold to a male participant",
        ).toBeNull();
        expect(refused.message ?? "").toContain(
          "Selected service is not suitable for every participant",
        );

        // ⛔ THE CONTROL. Without it this passes against a service that refuses
        // everybody.
        const allowed = await callRpc(
          db,
          bookingArgs({
            label: "BR24C",
            date,
            time: "14:30:00",
            slugs: ["hijama-package"],
            genders: ["female"],
          }),
        );
        expect(
          allowed.message,
          `⛔ the restricted service refused the ALLOWED gender too: "${allowed.message}"`,
        ).toBeNull();
        console.log(`[BR-24] female_only: male refused, female accepted`);
      },
    );
  });

  test("M-05 / PA-12 — a hidden service is charged for AND itemised (PR-011), and the app refuses it anyway", async () => {
    const db = serviceClient();
    const date = firstWorkingDayFrom(8);
    const { data: svc } = await db
      .from("services")
      .select("price, duration_mins")
      .eq("slug", "fire-package")
      .single();
    const service = svc as { price: number; duration_mins: number };

    await withColumn(
      db,
      "services",
      { slug: "fire-package" },
      "is_visible_on_frontend",
      false,
      async () => {
        // ⛔ THE RPC IS NOT THE ENFORCEMENT POINT — Owner ruling D-033/D-034.
        // `assertServicesBookable` in `createBookingTransaction.ts:157` refuses a
        // hidden slug before the RPC is ever called. What PR-011 fixed is that
        // whatever the RPC DOES charge for, it now RECORDS.
        const result = await callRpc(
          db,
          bookingArgs({ label: "M05", date, time: "15:00:00", slugs: ["fire-package"] }),
        );
        expect(
          result.message,
          `⛔ the RPC refused a hidden service; PR-011's premise has changed: "${result.message}"`,
        ).toBeNull();

        const { data: booking } = await db
          .from("bookings")
          .select("total_price")
          .eq("id", result.bookingId!)
          .single();
        const { data: items } = await db
          .from("booking_items")
          .select("service_price_snapshot")
          .eq("booking_id", result.bookingId!);
        const lines = (items ?? []) as { service_price_snapshot: number }[];
        const charged = Number((booking as { total_price: number }).total_price);
        const itemised = lines.reduce((total, l) => total + Number(l.service_price_snapshot), 0);

        console.log(
          `[M-05] hidden fire-package: charged £${charged} · ${lines.length} line item(s) · ` +
            `itemised £${itemised}`,
        );
        expect(charged).toBe(Number(service.price));
        expect(
          lines.length,
          `⛔ PR-011 HAS REGRESSED. The customer is charged £${charged} with NO record of what ` +
            `for — the two service filters have drifted apart again.`,
        ).toBe(1);
        expect(itemised).toBe(charged);
      },
    );
  });

  test("RS-04 — a series is refused when the service forbids recurrence", async () => {
    const db = serviceClient();
    // A client of our own to hang the attempt on. ⛔ Never an existing record.
    const { data: created, error } = await db
      .from("clients")
      .insert({
        full_name: zz("RS04"),
        email: `${zz("RS04").toLowerCase()}@probe.invalid`,
        phone: "07700900323",
        address: "1 ZZTEST Street",
        postcode: "LU1 1AA",
        city: "Luton",
        client_source: "manual",
      })
      .select("id")
      .single();
    expect(error?.message ?? "", "could not create the throwaway client").toBe("");
    const clientId = (created as { id: string }).id;
    clientIds.push(clientId);

    const { data: actor } = await db
      .from("staff_profiles")
      .select("id")
      .eq("id", "97310f6b-4e2f-4a9f-bec1-20224e57d8e6")
      .single();
    expect(actor, "the Test Admin staff profile must exist to act as").not.toBeNull();

    await withColumn(db, "services", { slug: "massage-30" }, "allow_recurrence", false, async () => {
      const { error: seriesError } = await db.rpc("create_recurring_booking_series", {
        p_client_id: clientId,
        p_service_slug: "massage-30",
        p_first_occurrence_date: firstWorkingDayFrom(10),
        p_anchor_start_time: "12:00:00",
        p_cadence: "weekly",
        p_end_type: "after_count",
        p_end_count: 2,
        p_participant_gender: "female",
        p_required_therapist_gender: "female",
        p_actor_staff_id: "97310f6b-4e2f-4a9f-bec1-20224e57d8e6",
        p_horizon_weeks: 4,
      });
      expect(
        seriesError,
        "⛔ a series was created for a service the Owner switched recurrence OFF for",
      ).not.toBeNull();
      expect(seriesError?.message ?? "").toContain("Recurring bookings are not enabled");
      console.log(`[RS-04] refused: "${seriesError?.message}"`);
    });
  });
});
