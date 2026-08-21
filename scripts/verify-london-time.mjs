// ⛔ TIMEZONE GATE — it now tests the APP's clock, not JavaScript's.
//
// ── Why this file was rewritten (finding PR-012) ──────────────────────────
//
// The previous version built its OWN `Intl.DateTimeFormat` and asserted that
// 12:00 UTC in July is 13:00 in London. That is true, and it was worthless: it
// imported NOTHING from `src/lib/time/london.ts`, so it was really asserting
// that Node ships a correct timezone database. Every helper the booking system
// actually uses to decide what day an appointment falls on could have been
// broken and this gate would still have printed "checks passed".
//
// ⛔ That is worse than having no gate, because the runbook lists it as
// timezone assurance and people trust it. This project has already shipped two
// timezone defects — a minimum-notice check that mis-compared across BST, and a
// date that rendered as the previous day on hosts east of London. Neither would
// have been caught here.
//
// ⛔ WHAT MAKES A GATE REAL: it must be able to FAIL. Every case below calls a
// function exported from the app and compares against a value derived by hand,
// so breaking any helper turns this red.
//
// ── Why it can import TypeScript ──────────────────────────────────────────
//
// Node 24 strips type annotations natively, so `import ... from "…/london.ts"`
// works with no build step, no ts-node, and nothing installed.
//
// ── Why a script AND unit tests ───────────────────────────────────────────
//
// `src/lib/time/london.test.ts` covers these helpers thoroughly under vitest.
// This gate is deliberately NOT a duplicate of it: it runs in a plain Node
// process against the real module, so it also proves the helpers behave
// correctly in the runtime that actually serves the site — including that the
// host's timezone database is present and current. A vitest run happens inside
// a configured environment; this does not.

import {
  BUSINESS_TIME_ZONE,
  addBusinessDays,
  formatBusinessDate,
  formatBusinessDateLong,
  getBookingDateBounds,
  getBusinessDate,
  getBusinessDayOfWeek,
  isDateInBusinessWindow,
  isOutsideMinimumNotice,
  toBusinessDateTime,
} from "../src/lib/time/london.ts";

let checks = 0;
const failures = [];

function check(name, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}\n     expected ${e}\n     got      ${a}`);
}

// ⛔ ANCHOR ASSERTION, FIRST. If a helper is renamed or dropped, the import
// above yields `undefined` and every check below would "pass" vacuously while
// comparing undefined to undefined. Prove the module arrived before trusting
// anything it says — the lesson from the migration guard that searched for an
// anchor it never found and then reported the wrong failure.
const REQUIRED = {
  BUSINESS_TIME_ZONE,
  addBusinessDays,
  formatBusinessDate,
  formatBusinessDateLong,
  getBookingDateBounds,
  getBusinessDate,
  getBusinessDayOfWeek,
  isDateInBusinessWindow,
  isOutsideMinimumNotice,
  toBusinessDateTime,
};
for (const [name, value] of Object.entries(REQUIRED)) {
  if (value === undefined) {
    console.error(
      `FAIL  src/lib/time/london.ts does not export ${name}. ` +
        "Every check below would pass vacuously, so this gate refuses to run."
    );
    process.exit(1);
  }
}

check("business timezone is London", BUSINESS_TIME_ZONE, "Europe/London");

// ── 1. The London calendar date, not the server's ────────────────────────────
// A booking taken at 00:30 London on 16 July is still 15 July in UTC. If the
// app used the server date, that appointment would be filed under the wrong day.
check(
  "23:30 UTC in summer is already TOMORROW in London",
  getBusinessDate(new Date("2026-07-15T23:30:00Z")),
  "2026-07-16"
);
check(
  "23:30 UTC in winter is still the SAME day in London",
  getBusinessDate(new Date("2026-01-15T23:30:00Z")),
  "2026-01-15"
);

// ── 2. Turning a booked date+time into a real instant ────────────────────────
// This is the core conversion. 09:00 on a summer morning is 08:00 UTC (BST),
// and 09:00 on a winter morning is 09:00 UTC (GMT). Getting this wrong shifts
// every appointment by an hour for half the year.
check(
  "09:00 on a BST date is 08:00 UTC",
  toBusinessDateTime("2026-07-15", "09:00").toISOString(),
  "2026-07-15T08:00:00.000Z"
);
check(
  "09:00 on a GMT date is 09:00 UTC",
  toBusinessDateTime("2026-01-15", "09:00").toISOString(),
  "2026-01-15T09:00:00.000Z"
);
// ⛔ The clocks go forward at 01:00 UTC on 29 March 2026 and back at 02:00
// London on 25 October 2026. A 12:00 appointment either side must stay 12:00
// to the customer.
check(
  "noon the day BEFORE the spring change",
  toBusinessDateTime("2026-03-28", "12:00").toISOString(),
  "2026-03-28T12:00:00.000Z"
);
check(
  "noon the day AFTER the spring change is an hour earlier in UTC",
  toBusinessDateTime("2026-03-30", "12:00").toISOString(),
  "2026-03-30T11:00:00.000Z"
);
check(
  "noon the day AFTER the autumn change is back to UTC",
  toBusinessDateTime("2026-10-26", "12:00").toISOString(),
  "2026-10-26T12:00:00.000Z"
);

// ── 3. Which weekday it is — this picks the availability rule ────────────────
// Sunday is 0. 2026-07-15 is a Wednesday; 2026-07-19 is a Sunday. If this
// slipped by one, the clinic would advertise Monday's hours on a Sunday.
check("a Wednesday is day 3", getBusinessDayOfWeek("2026-07-15"), 3);
check("a Sunday is day 0", getBusinessDayOfWeek("2026-07-19"), 0);
check(
  "the day of week does not slip across the spring clock change",
  getBusinessDayOfWeek("2026-03-29"),
  0
);

// ── 4. Counting days forward ─────────────────────────────────────────────────
// Must not lose or gain a day when it steps over a clock change.
check("plus one ordinary day", addBusinessDays("2026-07-15", 1), "2026-07-16");
check(
  "stepping over the spring clock change keeps one day as one day",
  addBusinessDays("2026-03-28", 2),
  "2026-03-30"
);
check(
  "stepping over the autumn clock change keeps one day as one day",
  addBusinessDays("2026-10-24", 2),
  "2026-10-26"
);
check("crossing a year boundary", addBusinessDays("2026-12-31", 1), "2027-01-01");

// ── 5. The minimum-notice rule — one of the two defects already shipped ──────
// "You must book at least N hours ahead." Compared as real instants, so the
// answer has to hold across a clock change too.
check(
  "a slot 3 hours away passes a 2-hour notice rule",
  isOutsideMinimumNotice({
    date: "2026-07-15",
    time: "12:00",
    now: new Date("2026-07-15T08:00:00Z"), // 09:00 London
    minimumNoticeHours: 2,
  }),
  true
);
check(
  "a slot 1 hour away FAILS a 2-hour notice rule",
  isOutsideMinimumNotice({
    date: "2026-07-15",
    time: "12:00",
    now: new Date("2026-07-15T10:00:00Z"), // 11:00 London
    minimumNoticeHours: 2,
  }),
  false
);
check(
  "a slot already in the past is refused",
  isOutsideMinimumNotice({
    date: "2026-07-15",
    time: "09:00",
    now: new Date("2026-07-15T12:00:00Z"),
    minimumNoticeHours: 0,
  }),
  false
);

// ── 6. The booking window the customer can pick from ─────────────────────────
check(
  "a 14-day window ends 14 days out, inclusive",
  getBookingDateBounds({
    now: new Date("2026-07-15T09:00:00Z"),
    bookingWindowDays: 14,
  }).latest,
  "2026-07-29"
);
check(
  "the window is counted from the LONDON date, not the server's",
  getBookingDateBounds({
    now: new Date("2026-07-15T23:30:00Z"), // already the 16th in London
    bookingWindowDays: 14,
  }).latest,
  "2026-07-30"
);
check(
  "a notice that crosses midnight pushes the first bookable day to tomorrow",
  getBookingDateBounds({
    now: new Date("2026-07-15T22:00:00Z"), // 23:00 London
    bookingWindowDays: 14,
    minimumNoticeHours: 4,
  }).earliest,
  "2026-07-16"
);
check(
  "today stays bookable while the notice still fits inside it",
  getBookingDateBounds({
    now: new Date("2026-07-15T08:00:00Z"), // 09:00 London
    bookingWindowDays: 14,
    minimumNoticeHours: 4,
  }).earliest,
  "2026-07-15"
);
check(
  "a date inside the window is accepted",
  isDateInBusinessWindow({
    date: "2026-07-20",
    now: new Date("2026-07-15T09:00:00Z"),
    bookingWindowDays: 14,
  }),
  true
);
check(
  "a date past the window is refused",
  isDateInBusinessWindow({
    date: "2026-08-20",
    now: new Date("2026-07-15T09:00:00Z"),
    bookingWindowDays: 14,
  }),
  false
);

// ── 7. What the customer actually reads ──────────────────────────────────────
// The shipped defect here rendered the PREVIOUS day on any host east of London,
// because the date was parsed at local midnight instead of UTC noon. A customer
// being told the wrong day for their appointment is the worst outcome in this
// whole file.
check("a date reads back as itself", formatBusinessDate("2026-07-15"), "15 Jul 2026");
check(
  "the spring clock-change day does not slip to the day before",
  formatBusinessDate("2026-03-29"),
  "29 Mar 2026"
);
check(
  "New Year's Day does not slip into the previous year",
  formatBusinessDate("2026-01-01"),
  "1 Jan 2026"
);
check(
  "the long form names the right weekday",
  formatBusinessDateLong("2026-07-15"),
  "Wednesday, 15 July 2026"
);
check(
  "the long form holds on the autumn clock-change day",
  formatBusinessDateLong("2026-10-25"),
  "Sunday, 25 October 2026"
);

// ── 8. ⛔ INDEPENDENCE FROM THE HOST'S OWN CLOCK ─────────────────────────────
//
// This is the shipped defect, reproduced as a guard. A date was parsed with
// `new Date(\`${value}T00:00:00\`)` — a LOCAL-time parse — so on any host east
// of London, local midnight is still the previous day in London and customers
// were shown the wrong date.
//
// The site does not run in London. It runs wherever the platform puts it, and
// that can change without anyone being told. So every helper is re-run with the
// process pretending to be on the far side of the world, and must not budge.
//
// ⚠️ `TZ=x node …` does NOT take effect on this machine, but assigning
// `process.env.TZ` at runtime DOES — measured. Hence this shape rather than an
// environment variable on the command line.
const realTz = process.env.TZ;
for (const hostTz of ["Pacific/Kiritimati", "Pacific/Midway", "UTC"]) {
  process.env.TZ = hostTz;
  check(
    `[host ${hostTz}] the date still reads as itself`,
    formatBusinessDate("2026-07-15"),
    "15 Jul 2026"
  );
  check(
    `[host ${hostTz}] the long form still names the right weekday`,
    formatBusinessDateLong("2026-07-15"),
    "Wednesday, 15 July 2026"
  );
  check(
    `[host ${hostTz}] 09:00 London is still 08:00 UTC in summer`,
    toBusinessDateTime("2026-07-15", "09:00").toISOString(),
    "2026-07-15T08:00:00.000Z"
  );
  check(
    `[host ${hostTz}] the weekday behind the availability rules is stable`,
    getBusinessDayOfWeek("2026-07-15"),
    3
  );
  check(
    `[host ${hostTz}] counting days forward is stable`,
    addBusinessDays("2026-03-28", 2),
    "2026-03-30"
  );
}
// ⛔ Put the host back, so anything after this point is not silently running in
// the wrong timezone.
if (realTz === undefined) delete process.env.TZ;
else process.env.TZ = realTz;

// ── Result ───────────────────────────────────────────────────────────────────
//
// ⛔ ASSERT THE COUNT, NEVER JUST THE EXIT CODE. A green exit at a lower count
// is a documented silent-failure mode in this repo: an early `return`, a
// swallowed error or a mangled import could leave most of the file unrun while
// the process still exits 0.
// ⚠️ 29, counted by running it — not by counting `check(` calls by eye, which
// is how this constant was first written wrong (26). The guard caught it on the
// very first run, which is the best evidence it works that this file can offer.
const EXPECTED_CHECKS = 44;

if (failures.length > 0) {
  console.error(`\nFAIL  ${failures.length} of ${checks} London-time checks failed:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

if (checks !== EXPECTED_CHECKS) {
  console.error(
    `FAIL  expected ${EXPECTED_CHECKS} checks to run, but ${checks} did. ` +
      "Either a check was added without updating EXPECTED_CHECKS, or part of " +
      "this gate silently did not execute."
  );
  process.exit(1);
}

console.log(
  `Europe/London checks passed — ${checks} assertions against the app's own ` +
    "time helpers (src/lib/time/london.ts), including both clock changes."
);
