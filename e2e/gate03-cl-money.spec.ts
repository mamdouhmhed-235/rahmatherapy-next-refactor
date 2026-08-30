// ⛔ GATE 03 — LANE CL (client resolution) AND LANE M (money derivation).
//   Cases CL-01 · CL-02 · CL-03 · CL-04 · CL-05 · CL-06,
//   M-01 · M-02 · M-03, and the creation half of M-10.
//
// ⛔ AUTHORED, NOT RUN. Gate 03 wrote this file and did NOT execute it. Every
// case here WRITES. Wave 3 owns execution (Owner decision D22).
//
// ── ⛔ CL-01 IS THE ONE THAT ALREADY DAMAGED REAL RECORDS ─────────────────
//
// The `on conflict (email) do update` this function used to carry silently
// rewrote a returning customer's stored name, phone and address from whatever
// the new form said (B-110/B-131). CL-01 is the regression guard: a second
// booking under the SAME email with DIFFERENT details must leave the client row
// byte-identical and put the new values on the BOOKING instead.
//
// ⛔ THE DEDUP KEY IS THE EMAIL. Both bookings must carry the IDENTICAL address
// or the case silently tests nothing — it would simply create two clients and
// pass. `sharedEmail` below is computed once, for exactly that reason.
//
// ── ⛔ COST ──────────────────────────────────────────────────────────────
//
// Zero emails: these call the RPC directly and the send path lives above it in
// `src/app/api/bookings/route.ts`. The addresses still resolve to the Owner's
// test inbox (plus-addressed, run-tagged) so that (a) they are real and
// deliverable if a future edit ever does route through the HTTP layer, and
// (b) `destroyScenarioFixtures` can sweep any `email_delivery_events` by
// recipient.

import { expect, test } from "@playwright/test";
import {
  RUN_TAG,
  destroyScenarioFixtures,
  serviceClient,
  testInbox,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let day = "";
/** ⛔ ONE address, shared by every booking in the CL lane. See the header. */
const sharedEmail = testInbox("g03cl");
let returningClientId = "";

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

type Args = Record<string, unknown>;

function bookingArgs(opts: {
  label: string;
  date: string;
  time: string;
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  city?: string;
  slugs?: string[];
  genders?: ("male" | "female")[];
  source?: string;
  clientId?: string | null;
  raiseOnDuplicate?: boolean;
  confirmDuplicate?: boolean;
}): Args {
  const name = zz(opts.label);
  return {
    p_service_slugs: opts.slugs ?? ["massage-30"],
    p_contact_full_name: name,
    p_contact_email: opts.email ?? sharedEmail,
    p_contact_phone: opts.phone ?? "07700900311",
    p_customer_notes: "",
    p_health_notes: "",
    p_consent_acknowledged: true,
    p_service_address_line1: opts.address ?? "1 ZZTEST Street",
    p_service_city: opts.city ?? "Luton",
    p_service_postcode: opts.postcode ?? "LU1 1AA",
    p_access_notes: "",
    p_booking_date: opts.date,
    p_start_time: opts.time,
    p_participant_genders: opts.genders ?? ["female"],
    p_booking_source: opts.source ?? "website",
    p_override_availability: false,
    p_client_id: opts.clientId ?? null,
    p_raise_on_duplicate: opts.raiseOnDuplicate ?? false,
    p_confirm_duplicate: opts.confirmDuplicate ?? false,
  };
}

type Outcome = { bookingId: string | null; message: string | null; hint: string | null };

async function callRpc(db: ReturnType<typeof serviceClient>, args: Args): Promise<Outcome> {
  const { data, error } = await db.rpc("create_booking_request", args);
  if (error) {
    return { bookingId: null, message: error.message, hint: error.hint ?? null };
  }
  const bookingId = String((data as { bookingId?: string })?.bookingId ?? "");
  if (bookingId) {
    const { data: row } = await db.from("bookings").select("client_id").eq("id", bookingId).single();
    const clientId = (row as { client_id?: string } | null)?.client_id;
    if (clientId && !clientIds.includes(clientId)) clientIds.push(clientId);
  }
  return { bookingId: bookingId || null, message: null, hint: null };
}

async function readClient(db: ReturnType<typeof serviceClient>, id: string) {
  const { data, error } = await db.from("clients").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`could not read client ${id}: ${error?.message}`);
  return data as unknown as Record<string, unknown>;
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ A SOFT-DELETED CLIENT IS STILL A ROW. CL-04 sets `deleted_at`, and the
  // sweep deletes by id, so it is covered — but only if the id was collected.
  // The name-prefix sweep inside `destroyScenarioFixtures` finds it either way.
  try {
    await destroyScenarioFixtures(db, clientIds, { prefix: `ZZTEST-G03-%-${RUN_TAG}` });
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ GATE-03 CL/M TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

test.describe("Gate 03 · CL — a returning customer's record is never overwritten", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");

  test("step 0 — pick a working day and create the returning customer", async () => {
    const db = serviceClient();
    for (let offset = 8; offset <= 20 && !day; offset += 1) {
      const candidate = businessDate(offset);
      if (weekdayOf(candidate) !== 0) day = candidate;
    }
    expect(day, "there must be a working day in the next three weeks").not.toBe("");

    const first = await callRpc(
      db,
      bookingArgs({
        label: "CL-RETURNING",
        date: day,
        time: "09:00:00",
        phone: "07700900311",
        address: "1 ZZTEST Street",
        postcode: "LU1 1AA",
      }),
    );
    expect(first.message, `⛔ the first booking was refused: "${first.message}"`).toBeNull();
    expect(first.bookingId).toBeTruthy();

    const { data: row } = await db
      .from("bookings")
      .select("client_id")
      .eq("id", first.bookingId!)
      .single();
    returningClientId = (row as { client_id: string }).client_id;
    expect(returningClientId).toBeTruthy();
    console.log(`[CL step 0] returning client ${returningClientId} on ${sharedEmail}`);
  });

  test("CL-01 — a second booking with DIFFERENT details changes nothing on the client row", async () => {
    const db = serviceClient();
    expect(returningClientId, "step 0 must have created the client").not.toBe("");
    const before = await readClient(db, returningClientId);

    const second = await callRpc(
      db,
      bookingArgs({
        label: "CL01",
        date: day,
        time: "09:30:00",
        // ⛔ SAME EMAIL — the dedup key. Everything else deliberately different.
        email: sharedEmail,
        phone: "07700900999",
        address: "99 DIFFERENT Road",
        postcode: "LU4 9ZZ",
        city: "Dunstable",
      }),
    );
    expect(second.message, `⛔ the returning customer's booking was refused: "${second.message}"`).toBeNull();
    expect(second.bookingId).toBeTruthy();

    const after = await readClient(db, returningClientId);
    for (const field of ["full_name", "phone", "address", "postcode", "city", "email"]) {
      expect(
        after[field],
        `⛔ THE DESTRUCTIVE OVERWRITE IS BACK. clients.${field} changed from ` +
          `${JSON.stringify(before[field])} to ${JSON.stringify(after[field])} because a ` +
          `returning customer typed something different into a booking form. RELEASE BLOCKER.`,
      ).toEqual(before[field]);
    }

    // …and the new details ARE recorded, on the booking.
    const { data: booking } = await db
      .from("bookings")
      .select("client_id, contact_phone, service_address_line1, service_postcode, service_city")
      .eq("id", second.bookingId!)
      .single();
    const b = booking as {
      client_id: string; contact_phone: string; service_address_line1: string;
      service_postcode: string; service_city: string;
    };
    expect(b.client_id, "the booking links to the EXISTING client").toBe(returningClientId);
    expect(b.contact_phone).toBe("07700900999");
    expect(b.service_address_line1).toBe("99 DIFFERENT Road");
    expect(b.service_city).toBe("Dunstable");
    console.log(`[CL-01] client row unchanged; the new details landed on the booking`);
  });

  test("CL-02 — the admin flow gets its duplicate warning", async () => {
    const db = serviceClient();
    const result = await callRpc(
      db,
      bookingArgs({
        label: "CL02",
        date: day,
        time: "10:00:00",
        source: "phone",
        raiseOnDuplicate: true,
        confirmDuplicate: false,
      }),
    );
    expect(
      result.bookingId,
      "⛔ front desk was allowed to create a second record for someone the clinic already has",
    ).toBeNull();
    expect(result.message ?? "").toContain("duplicate_client_exists");
    expect(result.message ?? "").toContain(returningClientId);
    expect(
      result.hint,
      "the warning must name the person, or the operator cannot decide",
    ).toBeTruthy();
    console.log(`[CL-02] refused with "${result.message}" · hint "${result.hint}"`);
  });

  test("CL-03 — …and can proceed once acknowledged, still without overwriting", async () => {
    const db = serviceClient();
    const before = await readClient(db, returningClientId);

    const result = await callRpc(
      db,
      bookingArgs({
        label: "CL03",
        date: day,
        time: "10:30:00",
        source: "phone",
        phone: "07700900888",
        raiseOnDuplicate: true,
        confirmDuplicate: true,
      }),
    );
    expect(result.message, `⛔ the acknowledged duplicate was still refused: "${result.message}"`).toBeNull();
    expect(result.bookingId).toBeTruthy();

    const after = await readClient(db, returningClientId);
    expect(after, "acknowledging a duplicate must not rewrite the record either").toEqual(before);
    console.log(`[CL-03] acknowledged duplicate accepted, client row still unchanged`);
  });

  test("CL-05 — with no email, the phone becomes the dedup key", async () => {
    const db = serviceClient();
    // The admin branch: no email at all. The RPC's own comment says the public
    // flow can never reach here because its Zod requires an email.
    const result = await callRpc(
      db,
      bookingArgs({
        label: "CL05",
        date: day,
        time: "11:00:00",
        source: "phone",
        email: "",
        // ⛔ Matches the returning client's phone, which is the key here.
        phone: "07700900311",
        confirmDuplicate: false,
      }),
    );
    expect(
      result.bookingId,
      "⛔ the no-email admin branch created a second record for a phone the clinic already has",
    ).toBeNull();
    expect(result.message ?? "").toContain("duplicate_client_exists");
    console.log(`[CL-05] phone-keyed duplicate refused: "${result.message}"`);
  });

  test("CL-06 — an explicit client id pointing at a REMOVED client is refused", async () => {
    const db = serviceClient();
    // A throwaway client of our own, soft-deleted. ⛔ Never an existing record.
    const { data: created, error } = await db
      .from("clients")
      .insert({
        full_name: zz("CL06-DELETED"),
        email: testInbox("g03cl06"),
        phone: "07700900312",
        postcode: "LU1 1AA",
        client_source: "manual",
      })
      .select("id")
      .single();
    expect(error?.message ?? "", "could not create the throwaway client").toBe("");
    const deletedId = (created as { id: string }).id;
    clientIds.push(deletedId);
    await db.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", deletedId);

    const result = await callRpc(
      db,
      bookingArgs({
        label: "CL06",
        date: day,
        time: "11:30:00",
        source: "phone",
        email: testInbox("g03cl06b"),
        clientId: deletedId,
      }),
    );
    expect(result.bookingId, "a removed client must not be bookable by id").toBeNull();
    expect(result.message ?? "").toContain("Specified client does not exist or has been deleted");
    console.log(`[CL-06] refused: "${result.message}"`);
  });

  test("CL-04 — an email held by a REMOVED client raises, and writes no booking", async () => {
    const db = serviceClient();
    const orphanEmail = testInbox("g03cl04");
    const { data: created, error } = await db
      .from("clients")
      .insert({
        full_name: zz("CL04-DELETED"),
        email: orphanEmail,
        phone: "07700900313",
        postcode: "LU1 1AA",
        client_source: "manual",
      })
      .select("id")
      .single();
    expect(error?.message ?? "", "could not create the throwaway client").toBe("");
    const deletedId = (created as { id: string }).id;
    clientIds.push(deletedId);
    await db.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", deletedId);

    const { count: before } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_date", day);

    const result = await callRpc(
      db,
      bookingArgs({ label: "CL04", date: day, time: "12:00:00", email: orphanEmail }),
    );
    expect(result.bookingId, "no booking may be created for a removed client's address").toBeNull();
    expect(result.message ?? "").toContain("client_record_removed");

    // ⛔ G-27 — assert what the DATABASE did. A refusal that still wrote a row,
    // or wrote one with a null client_id, is the worst of both.
    const { count: after } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_date", day);
    expect(after ?? 0, "a refused booking must leave nothing behind").toBe(before ?? 0);
    console.log(`[CL-04] refused: "${result.message}" · bookings on ${day} unchanged at ${after}`);
  });
});

test.describe("Gate 03 · M — the money is derived server-side, to the penny", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");

  test("M-01 — one participant, one service: 45.00 / 60 mins / one snapshot row", async () => {
    const db = serviceClient();
    expect(day, "the CL block's step 0 must have chosen a day").not.toBe("");

    // ⛔ THE EXPECTED NUMBERS ARE READ FROM `services`, NOT HARD-CODED. If the
    // Owner changes a price this must keep testing the real rule, and
    // `pnpm verify:prices` is what notices the change.
    const { data: svc, error } = await db
      .from("services")
      .select("name, price, duration_mins")
      .eq("slug", "hijama-package")
      .single();
    expect(error?.message ?? "", "could not read the service").toBe("");
    const service = svc as { name: string; price: number; duration_mins: number };

    const result = await callRpc(
      db,
      bookingArgs({
        label: "M01",
        date: day,
        time: "14:00:00",
        email: testInbox("g03m01"),
        slugs: ["hijama-package"],
      }),
    );
    expect(result.message, `⛔ the single-service booking was refused: "${result.message}"`).toBeNull();

    const { data: booking } = await db
      .from("bookings")
      .select("total_price, amount_due, amount_paid, payment_status, total_duration_mins, end_time, travel_fee")
      .eq("id", result.bookingId!)
      .single();
    const row = booking as {
      total_price: number; amount_due: number; amount_paid: number; payment_status: string;
      total_duration_mins: number; end_time: string; travel_fee: number | null;
    };
    expect(Number(row.total_price)).toBe(Number(service.price));
    expect(Number(row.amount_due)).toBe(Number(service.price));
    expect(Number(row.amount_paid)).toBe(0);
    expect(row.payment_status).toBe("unpaid");
    expect(row.total_duration_mins).toBe(service.duration_mins);
    expect(row.end_time.slice(0, 5)).toBe("15:00");
    // ⛔ M-10's creation half: the RPC never sets a travel fee. It arrives later,
    // through the admin delta path, and only ever there.
    expect(
      Number(row.travel_fee ?? 0),
      "a freshly created booking carries no travel fee",
    ).toBe(0);

    const { data: items } = await db
      .from("booking_items")
      .select("service_name_snapshot, service_price_snapshot, service_duration_snapshot")
      .eq("booking_id", result.bookingId!);
    const lines = (items ?? []) as {
      service_name_snapshot: string; service_price_snapshot: number; service_duration_snapshot: number;
    }[];
    expect(lines.length, "one line item per participant per service").toBe(1);
    expect(lines[0].service_name_snapshot).toBe(service.name);
    expect(Number(lines[0].service_price_snapshot)).toBe(Number(service.price));
    expect(Number(lines[0].service_duration_snapshot)).toBe(service.duration_mins);
    console.log(`[M-01] £${row.total_price} / ${row.total_duration_mins} mins / ends ${row.end_time}`);
  });

  test("M-02 — the price multiplies by PARTICIPANTS, and the duration does not", async () => {
    const db = serviceClient();
    const { data: svc } = await db
      .from("services")
      .select("price, duration_mins")
      .eq("slug", "hijama-package")
      .single();
    const service = svc as { price: number; duration_mins: number };

    const result = await callRpc(
      db,
      bookingArgs({
        label: "M02",
        date: day,
        time: "15:30:00",
        email: testInbox("g03m02"),
        slugs: ["hijama-package"],
        genders: ["female", "female"],
      }),
    );
    if (result.message?.includes("Not enough")) {
      test.skip(true, `the clinic could not staff two therapists at 15:30 on ${day}: ${result.message}`);
    }
    expect(result.message, `⛔ the two-person booking was refused: "${result.message}"`).toBeNull();

    const { data: booking } = await db
      .from("bookings")
      .select("total_price, amount_due, total_duration_mins, group_booking")
      .eq("id", result.bookingId!)
      .single();
    const row = booking as {
      total_price: number; amount_due: number; total_duration_mins: number; group_booking: boolean;
    };
    expect(Number(row.total_price)).toBe(Number(service.price) * 2);
    expect(Number(row.amount_due)).toBe(Number(service.price) * 2);
    expect(
      row.total_duration_mins,
      "two people are treated at the same time; the visit is not twice as long",
    ).toBe(service.duration_mins);
    expect(row.group_booking).toBe(true);

    const { count: items } = await db
      .from("booking_items")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", result.bookingId!);
    const { count: participants } = await db
      .from("booking_participants")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", result.bookingId!);
    const { count: assignments } = await db
      .from("booking_assignments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", result.bookingId!);
    expect(items).toBe(2);
    expect(participants).toBe(2);
    expect(assignments).toBe(2);
    console.log(`[M-02] £${row.total_price} · ${participants} people · ${items} items`);
  });

  test("M-03 — two services sum BOTH dimensions", async () => {
    const db = serviceClient();
    const { data: rows } = await db
      .from("services")
      .select("slug, price, duration_mins")
      .in("slug", ["massage-30", "fire-package"]);
    const svc = (rows ?? []) as { slug: string; price: number; duration_mins: number }[];
    const expectedPrice = svc.reduce((total, s) => total + Number(s.price), 0);
    const expectedMins = svc.reduce((total, s) => total + Number(s.duration_mins), 0);
    expect(svc.length, "both services must exist").toBe(2);

    const result = await callRpc(
      db,
      bookingArgs({
        label: "M03",
        date: day,
        time: "17:00:00",
        email: testInbox("g03m03"),
        slugs: ["massage-30", "fire-package"],
      }),
    );
    expect(result.message, `⛔ the multi-service booking was refused: "${result.message}"`).toBeNull();

    const { data: booking } = await db
      .from("bookings")
      .select("total_price, amount_due, total_duration_mins, end_time")
      .eq("id", result.bookingId!)
      .single();
    const row = booking as {
      total_price: number; amount_due: number; total_duration_mins: number; end_time: string;
    };
    expect(Number(row.total_price)).toBe(expectedPrice);
    expect(Number(row.amount_due)).toBe(expectedPrice);
    expect(row.total_duration_mins).toBe(expectedMins);

    const { count: items } = await db
      .from("booking_items")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", result.bookingId!);
    expect(items, "one line item per service").toBe(2);
    console.log(
      `[M-03] £${row.total_price} · ${row.total_duration_mins} mins · ends ${row.end_time} · ${items} items`,
    );
  });
});
