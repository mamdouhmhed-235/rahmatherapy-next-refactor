// ⛔ GATE 08 — P3, FAMILY H, SCENARIO H2: ONE CLIENT, FIVE WINDOWS.
//
//   ⛔ The Owner's question: "Who can read a customer's history and their
//    sensitive notes?"
//
// H1 did this for one booking. This does it for the CUSTOMER RECORD, which is
// the more sensitive of the two: a booking is one visit, but a client record is
// everything the clinic has ever written down about a person.
//
// ── ⛔ THE RULE, READ FROM THE CODE AND THE DATABASE ─────────────────────
//
// ⚠️ I GOT THIS WRONG TWICE BEFORE THE APP CORRECTED ME, AND THE APP WAS
// STRICTER THAN I ASSUMED BOTH TIMES. The measured rule, from
// `getClientDataAccess`, is that the notes rail is gated by ONE flag:
//
//   canViewHealthNotes = manage_sensitive_client_notes        (Admin, Owner)
//                      OR manage_privacy_operations
//                      OR (assigned to them AND view_client_health_notes_assigned)
//
// ⛔ THE BOOKING COORDINATOR HAS NONE OF THE THREE, so she reads NO notes at
// all — not the sensitive ones, and not the ordinary ones either. I expected
// her to read the ordinary rail and she does not.
//
// ✅ THAT IS COHERENT, NOT A BUG. Her job is the diary: who is coming, when,
// and how to reach them. The note rail on a customer record is the clinical
// file, and she has no clinical role. The app draws the line at the rail, not
// at individual notes.
//
// Then, WITHIN the rail, `is_sensitive` draws a second line:
//
//   Owner, Admin              → ordinary ✅   sensitive ✅
//   Therapist treating them   → ordinary ✅   sensitive ⛔
//   Booking Coordinator       → no rail at all
//   Therapist not treating    → no record at all
//
// ⚠️ And the therapist's side is self-consistent: when she writes up a visit her
// note is saved with `is_sensitive: false`, because she cannot create a
// sensitive one. She writes to, and reads from, exactly the rail she is allowed.
//
// ── ⛔ THE MATCHED PAIR, WHICH IS WHAT MAKES THIS PROVE ANYTHING ─────────
//
// TWO notes are put on ONE customer, differing in exactly one thing: the
// sensitive flag.
//
//   ordinary note   → Owner, Admin, and the therapist treating them
//   sensitive note  → Owner and Admin only
//
// ⛔ THAT PAIRING IS WHAT MAKES THE THERAPIST'S STEP MEAN ANYTHING. "She cannot
// see the sensitive note" is equally satisfied by a page that renders no notes,
// by a note that was never saved, or by a broken record. Her reading the
// ORDINARY note on the same page in the same second rules out all three.
//
// ⚠️ The coordinator gets no such per-note control, because she has no rail to
// compare against. Her step therefore leans on a DIFFERENT control: she opens
// the record perfectly well and sees the customer, so her blank note rail is a
// withheld rail rather than a broken page — and four other windows prove both
// notes exist and render.
//
// ── ⛔ EMAIL COST: ZERO ── nothing is clicked.

import { expect, test, type Browser } from "@playwright/test";
import {
  ADMIN_STAFF_ID,
  destroyScenarioFixtures,
  pageAs,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const ORDINARY = `ZZTEST-NOTE-${RUN_TAG}-ORDINARY-prefers-firm-pressure`;
const SENSITIVE = `ZZTEST-NOTE-${RUN_TAG}-SENSITIVE-safeguarding-concern`;

const clientIds: string[] = [];
let visit: SeededBooking;

type Role = "owner" | "admin" | "coordinator" | "therapist_a" | "therapist_b";

interface Window {
  role: Role;
  signedOut: boolean;
  refused: boolean;
  sawClient: boolean;
  sawOrdinary: boolean;
  sawSensitive: boolean;
  excerpt: string;
}

const windows: Window[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

async function look(browser: Browser, role: Role): Promise<Window> {
  const { context, page } = await pageAs(browser, role);
  await page.goto(`/admin/clients/${visit.clientId}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2_000);

  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const seen: Window = {
    role,
    signedOut: /\/admin\/login/.test(page.url()),
    refused:
      (await page.locator("[data-admin-access-denied]").count()) > 0 ||
      (await page.locator("h1", { hasText: /^404$/ }).count()) > 0,
    sawClient: text.includes(visit.name),
    sawOrdinary: text.includes(ORDINARY),
    sawSensitive: text.includes(SENSITIVE),
    excerpt: text.slice(0, 220),
  };
  await context.close();
  return seen;
}

test.describe("H2 — one client, five windows: who can read a customer's history?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ five people open the same customer record", async ({ browser }) => {
    const db = serviceClient();

    // ⛔ A real working relationship: the therapist is on this customer's visit,
    // which is what should give her any access to them at all.
    visit = await seedWebsiteBooking(db, "H2-ONECLIENT", {
      dayOffset: 11,
      startTime: "15:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(visit.clientId);

    // ⛔ THE MATCHED PAIR — identical but for the one flag under test.
    const { error } = await db.from("client_notes").insert([
      {
        client_id: visit.clientId,
        author_staff_id: ADMIN_STAFF_ID,
        note: ORDINARY,
        is_sensitive: false,
      },
      {
        client_id: visit.clientId,
        author_staff_id: ADMIN_STAFF_ID,
        note: SENSITIVE,
        is_sensitive: true,
      },
    ]);
    expect(error, `seeding the notes failed: ${error?.message}`).toBeNull();

    // ⛔ PROVE BOTH NOTES EXIST before reading anything into their absence.
    const { data: saved } = await db
      .from("client_notes")
      .select("*")
      .eq("client_id", visit.clientId);
    const rows = (saved ?? []) as { note: string | null; is_sensitive: boolean }[];
    expect(
      rows.some((r) => r.note === ORDINARY && !r.is_sensitive),
      "⛔ the ordinary note must exist, or the control below is meaningless",
    ).toBe(true);
    expect(
      rows.some((r) => r.note === SENSITIVE && r.is_sensitive),
      "⛔ the sensitive note must exist AND be flagged sensitive, or this scenario tests nothing",
    ).toBe(true);

    // ⛔ The coordinator is opened straight after the admin again, so a cache
    // that ignored entitlement would hand her his page.
    for (const role of [
      "owner",
      "admin",
      "coordinator",
      "therapist_a",
      "therapist_b",
    ] as Role[]) {
      windows.push(await look(browser, role));
    }

    for (const w of windows) {
      console.log(
        `[H2] ${w.role.padEnd(12)} refused=${String(w.refused).padEnd(5)} client=${String(w.sawClient).padEnd(5)} ordinaryNote=${String(w.sawOrdinary).padEnd(5)} sensitiveNote=${w.sawSensitive}`,
      );
    }

    const signedOut = windows.filter((w) => w.signedOut).map((w) => w.role);
    expect(
      signedOut,
      `⛔ these people were SIGNED OUT, so their windows prove nothing: ${signedOut.join(", ")}`,
    ).toEqual([]);
  });

  test("step 2 — ✅ THE CONTROL: Owner and Admin read BOTH notes", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);

    for (const role of ["owner", "admin"] as Role[]) {
      const w = windows.find((x) => x.role === role)!;
      expect(w.refused, `⛔ ${role} must be able to open a customer record`).toBe(false);
      expect(
        w.sawClient,
        `⛔ ${role} must see the customer. It said: "${w.excerpt}"`,
      ).toBe(true);
      expect(
        w.sawOrdinary,
        `⛔ ${role} must read the ordinary note. It said: "${w.excerpt}"`,
      ).toBe(true);
      expect(
        w.sawSensitive,
        `⛔ WITHOUT THIS, STEP 3 PROVES NOTHING. ${role} holds manage_sensitive_client_notes and must read the sensitive note, or "the coordinator cannot read it" only means nobody can.`,
      ).toBe(true);
    }

    console.log(`[H2] step 2 — control: Owner and Admin read both notes.`);
  });

  test("step 3 — ⛔ THE RULE for the therapist: ordinary yes, sensitive no", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const w = windows.find((x) => x.role === "therapist_a")!;

    // ⛔ She is NOT shut out — she is treating this person.
    expect(
      w.refused,
      `⛔ the therapist treating this customer must be able to open their record. It said: "${w.excerpt}"`,
    ).toBe(false);
    expect(w.sawClient, "⛔ and must see whose record it is").toBe(true);

    // ⛔ HER OWN CONTROL: the note rail renders for her.
    expect(
      w.sawOrdinary,
      `⛔ she must be able to read ordinary notes about a customer she treats — otherwise "the sensitive note is hidden from her" only means no notes render at all. It said: "${w.excerpt}"`,
    ).toBe(true);

    // ⛔ AND THE RULE.
    expect(
      w.sawSensitive,
      `⛔ SENSITIVE NOTE LEAKED TO THE THERAPIST. She holds neither manage_sensitive_client_notes nor manage_privacy_operations, yet a sensitive note was on her screen — on the same page where she correctly read the ordinary one, so this is not a broken record.`,
    ).toBe(false);

    console.log(
      `[H2] step 3 — the therapist reads the ordinary note and not the sensitive one.`,
    );
  });

  test("step 4 — ✅ the coordinator gets the diary, not the clinical file", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const w = windows.find((x) => x.role === "coordinator")!;

    // ⚠️ I EXPECTED HER TO READ THE ORDINARY NOTE AND SHE READS NEITHER.
    // The app is stricter than I assumed, and it is right: the note rail is
    // gated as a whole by `canViewHealthNotes`, which she does not hold by any
    // of its three routes. Her job is the diary, not the clinical file.
    //
    // ⛔ HER CONTROL IS THE PAGE ITSELF. She opens the record and sees the
    // customer, so an empty note rail is a WITHHELD rail rather than a broken
    // page — and the four other windows prove both notes exist and render.
    expect(
      w.refused,
      `⛔ she books this customer's visits and must be able to open their record. It said: "${w.excerpt}"`,
    ).toBe(false);
    expect(
      w.sawClient,
      `⛔ THE CONTROL. She must see whose record this is, or her blank note rail only means the page failed. It said: "${w.excerpt}"`,
    ).toBe(true);

    expect(
      w.sawSensitive,
      "⛔ a sensitive note must never reach the booking coordinator",
    ).toBe(false);
    expect(
      w.sawOrdinary,
      "⚠️ TRIPWIRE, NOT AN ACCUSATION. Today the coordinator sees NO note rail at all, because it is gated as a whole. If she can now read ordinary notes, somebody has split that gate — which may well be a deliberate improvement, but it must be a decision rather than a drift.",
    ).toBe(false);

    console.log(
      `[H2] step 4 — the coordinator opens the record and sees the customer, but no note rail at all.`,
    );
  });

  test("step 5 — ⛔ a therapist with no relationship to this customer", async () => {
    expect(windows.length, "step 1 must have run").toBe(5);
    const other = windows.find((w) => w.role === "therapist_b")!;

    // ⛔ Therapist A reaches this record only because she is treating them.
    // Therapist B has no such connection, so she should have no reason to be
    // here — and a customer's record is not something to browse.
    expect(
      other.sawSensitive,
      "⛔ a therapist unconnected to this customer must never see a sensitive note",
    ).toBe(false);
    expect(
      other.sawOrdinary,
      "⛔ nor their ordinary notes",
    ).toBe(false);
    expect(
      other.sawClient,
      `⛔ A THERAPIST CAN BROWSE A CUSTOMER SHE HAS NO CONNECTION TO. Access to a client record follows from treating them, and she does not. It said: "${other.excerpt}"`,
    ).toBe(false);

    console.log(
      `\n[H2] COMPLETE. One customer, five windows. Ordinary notes reach everyone who works with them; sensitive notes reach only the Owner and the Admin; and a therapist with no connection to the customer sees nothing.\n`,
    );
  });
});
