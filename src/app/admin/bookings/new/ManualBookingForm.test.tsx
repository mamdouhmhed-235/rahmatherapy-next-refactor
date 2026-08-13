import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOCOMPLETE_DEBOUNCE_MS } from "@/components/address/AddressAutocompleteField";
import type { PlaceAddressComponent } from "@/lib/address/parse-place";
import { createManualBooking } from "../actions";
import { ManualBookingForm } from "./ManualBookingForm";

vi.mock("../actions", () => ({
  createManualBooking: vi.fn(),
}));

const services = [
  {
    slug: "hijama-package",
    name: "Hijama package",
    price: 65,
    duration_mins: 60,
    gender_restrictions: "any",
  },
];

const prefillClient = {
  id: "client-1",
  full_name: "Aisha Khan",
  email: "aisha@example.test",
  phone: "07123456789",
  address: "10 Test Street",
  postcode: "LU1 1AA",
  city: "Luton",
  area: "Bury Park",
};

describe("ManualBookingForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders step 1 on first load", () => {
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);
    // All four step panels stay mounted at once — only CSS and aria-hidden
    // decide which one shows — and step 4's summary card repeats step 1's
    // "Contact & source" title verbatim, because both render through
    // AdminPanel. getByText sees both and throws. getByRole skips aria-hidden
    // subtrees, so it matches the panel actually exposed to the operator:
    // a stronger assertion, since it proves step 1 is the visible step rather
    // than that the text exists somewhere in the DOM.
    expect(screen.getByRole("heading", { name: "Contact & source" })).not.toBeNull();
  });

  it("marks pre-filled client fields with 'From client profile' chip", () => {
    render(
      <ManualBookingForm services={services} prefillClient={prefillClient} enquiry={null} />
    );
    expect(screen.getAllByText("From client profile").length).toBeGreaterThan(0);
  });

  // This spec used to assert that clicking Continue on an invalid step moved
  // focus to the first bad field. That can never happen: Continue is
  // `disabled={!isStepReady}`, and isStepReady agrees with validateStep on
  // every step (booking_source, the one key validateStep checks and
  // isStepReady does not, defaults to "phone" and is never empty). So the
  // click was inert, handleContinue never ran, and focus stayed on <body> —
  // the old assertion was guarding unreachable code. What actually stops an
  // invalid step advancing is the disabled gate, so that is what is guarded
  // here. (handleContinue's focus branch is left in place as a safety net if
  // the two validity notions ever diverge.)
  it("keeps Continue disabled until step 1's required fields are filled", async () => {
    const user = userEvent.setup();
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);
    const continueButton = () =>
      screen.getAllByRole("button", { name: /Continue/i })[0] as HTMLButtonElement;

    expect(continueButton().disabled).toBe(true);

    await user.type(screen.getByLabelText(/Full name/i), "Aisha Khan");
    await user.type(screen.getByLabelText(/Phone number/i), "07123456789");

    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  // Despite its old name this spec never touched consent: it walked steps 1→3
  // and stopped at the "Location" heading, so the consent requirement it was
  // credited with guarding was never asserted at all. It also tripped over the
  // duplicated "Services & participants" heading (see the note above). The
  // step 1→2→3 walk it performed is already covered by continueToStep2 and the
  // step-2/3 specs below, so this now guards the consent gate the name always
  // promised. Consent blocks submission the same way Continue blocks an
  // invalid step — via the disabled attribute — so that is what is asserted.
  it("keeps submit disabled until the consent box is ticked", async () => {
    const user = userEvent.setup();
    // Jump to the review step through the draft the form restores on mount —
    // the same mechanism submitFromStep4 uses further down this file.
    sessionStorage.setItem(
      "bookings-new-draft:scratch",
      JSON.stringify({
        step: 4,
        fullName: "Aisha Khan",
        email: "aisha@example.test",
        phone: "07123456789",
        address: "10 Test Street",
        postcode: "LU1 1AA",
        city: "Luton",
      })
    );
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    const consent = () => container.querySelector<HTMLInputElement>("#consent_acknowledged")!;
    const submitButton = () =>
      screen.getAllByRole("button", { name: /Submit booking request/i })[0] as HTMLButtonElement;

    expect(consent().checked).toBe(false);
    expect(submitButton().disabled).toBe(true);

    await user.click(consent());

    await waitFor(() => expect(submitButton().disabled).toBe(false));
  }, 15000);

  it("required therapist gender is NOT a form field (auto-derived from participant gender)", () => {
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    // No input/select with label "Required therapist gender" should exist
    expect(container.querySelector('[name="required_therapist_gender"]')).toBeNull();
  });
});

describe("ManualBookingForm duplicate flow + client_id plumbing", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(createManualBooking).mockReset();
  });

  it("sends the prefilled client's id so the RPC links the booking instead of matching on email", () => {
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={prefillClient} enquiry={null} />
    );
    const hidden = container.querySelector<HTMLInputElement>('input[name="client_id"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.type).toBe("hidden");
    expect(hidden?.value).toBe(prefillClient.id);
  });

  it("omits client_id entirely when there is no prefilled client", () => {
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    expect(container.querySelector('input[name="client_id"]')).toBeNull();
  });

  it("blocks submit on a duplicate warning until the acknowledgement is ticked", async () => {
    const user = userEvent.setup();
    vi.mocked(createManualBooking).mockResolvedValue({
      duplicateWarning: "Sara Mohamed (sara@example.test)",
    });
    const { submitButton } = await submitFromStep4(user);

    // Server came back with a match: the shared banner renders and submit re-locks.
    await screen.findByText("Possible duplicate client");
    expect(screen.getByText("Sara Mohamed (sara@example.test)")).not.toBeNull();
    expect(submitButton().disabled).toBe(true);

    await user.click(screen.getByRole("checkbox", { name: /existing client record/i }));
    await waitFor(() => expect(submitButton().disabled).toBe(false));
  });

  it("acknowledging the duplicate says the booking links the existing client, not that a new profile is created", async () => {
    const user = userEvent.setup();
    vi.mocked(createManualBooking).mockResolvedValue({
      duplicateWarning: "Sara Mohamed (sara@example.test)",
    });
    await submitFromStep4(user);

    await screen.findByText("Use the existing client record for this booking.");
    // The shared component's create-a-separate-profile default would be a lie
    // here: this form always books against the matched client.
    expect(screen.queryByText("Create a separate client profile anyway.")).toBeNull();
  });
});

describe("ManualBookingForm optional email", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(createManualBooking).mockReset();
    // Earlier describes in this file leave their trees mounted, and a second
    // copy of the form would make the queries below ambiguous.
    cleanup();
  });

  const continueButton = () =>
    screen.getAllByRole("button", { name: /Continue/i })[0] as HTMLButtonElement;

  it("reaches step 2 with the email left empty", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );

    await user.type(screen.getByLabelText(/Full name/i), "Aisha Khan");
    await user.type(screen.getByLabelText(/Phone number/i), "07123456789");

    expect((screen.getByLabelText(/Email address/i) as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(continueButton().disabled).toBe(false));

    await user.click(continueButton());
    await waitFor(() =>
      expect(container.querySelector('[title="Step 2: current"]')).not.toBeNull()
    );
  });

  it("still rejects a malformed email, and stops rejecting it once cleared", async () => {
    const user = userEvent.setup();
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);

    await user.type(screen.getByLabelText(/Full name/i), "Aisha Khan");
    await user.type(screen.getByLabelText(/Phone number/i), "07123456789");
    const emailInput = screen.getByLabelText(/Email address/i);
    await user.type(emailInput, "sara-at-example");

    // Presence is optional; format is not. A typo'd address must not slip
    // through as if the admin had deliberately left the field blank.
    await waitFor(() => expect(continueButton().disabled).toBe(true));

    await user.clear(emailInput);
    await waitFor(() => expect(continueButton().disabled).toBe(false));

    await user.type(emailInput, "sara@example.test");
    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  it("hides the confirmation-email checkbox until there is an address to send to", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    const sendFlag = () =>
      container.querySelector<HTMLInputElement>('input[name="send_confirmation_email"]');

    expect(screen.queryByText("Send confirmation email to client")).toBeNull();
    expect(sendFlag()?.value).toBe("");

    await user.type(screen.getByLabelText(/Email address/i), "sara@example.test");

    await screen.findByText("Send confirmation email to client");
    await waitFor(() => expect(sendFlag()?.value).toBe("on"));
  });

  // Typing can't produce a padded address — `input[type="email"]` sanitises
  // leading/trailing whitespace away. The seeded paths (client prefill,
  // enquiry, restored draft) bypass that input entirely, so they are where a
  // padded value actually reaches the hidden field the server parses.
  it("submits a whitespace-only prefilled email as empty", () => {
    const { container } = render(
      <ManualBookingForm
        services={services}
        prefillClient={{ ...prefillClient, email: "   " }}
        enquiry={null}
      />
    );

    // Every gate in the form reads `email.trim()`. If the submitted value
    // isn't trimmed too, "   " matches neither branch of the server's
    // email/"" union and the admin gets a generic error with nothing
    // highlighted — an invisible dead end.
    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe("");
    expect(screen.queryByText("Send confirmation email to client")).toBeNull();
  });

  it("submits a prefilled address with a trailing space trimmed", () => {
    const { container } = render(
      <ManualBookingForm
        services={services}
        prefillClient={{ ...prefillClient, email: "sara@example.test " }}
        enquiry={null}
      />
    );

    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe(
      "sara@example.test"
    );
    // Step 1 lets it through, so nothing client-side would ever tell the admin
    // the trailing space was the problem.
    expect(continueButton().disabled).toBe(false);
  });

  it("says a phone-matched duplicate creates a separate profile, not a link", async () => {
    const user = userEvent.setup();
    vi.mocked(createManualBooking).mockResolvedValue({
      duplicateWarning: "Sara Mohamed (07700 900123)",
    });
    await submitFromStep4(user, { email: "" });

    // With no email the RPC dedups on phone, and acknowledging inserts a brand
    // new client with a null email. The email branch's "use the existing
    // record" wording would be the wrong promise here.
    await screen.findByText("Create a separate client profile anyway.");
    expect(
      screen.queryByText("Use the existing client record for this booking.")
    ).toBeNull();
  });
});

describe("ManualBookingForm service match hint (C-03 fix — live selection)", () => {
  const enquiryWithMatch = {
    id: "enquiry-1",
    full_name: "Sara Mohamed",
    email: "sara@example.test",
    phone: "07123456789",
    source: "phone",
    service_interest: "hijama package",
    notes: null,
  };

  beforeEach(() => {
    sessionStorage.clear();
    // Earlier describes in this file leave their trees mounted, and a second
    // copy of the form would make the queries below ambiguous.
    cleanup();
  });

  // Step 2's own heading text ("Services & participants") is ambiguous: the
  // review step's summary card (step 4, always mounted alongside the others —
  // only CSS + aria-hidden toggle which step shows) repeats the same title.
  // The step-rail's title attribute is the one thing that's unique per step.
  async function continueToStep2(
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement
  ) {
    const continueButtons = () => screen.getAllByRole("button", { name: /Continue/i });
    await user.click(continueButtons()[0]);
    await waitFor(() =>
      expect(container.querySelector('[title="Step 2: current"]')).not.toBeNull()
    );
  }

  it("stops claiming a match once the operator picks a different service for participant 1", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualBookingForm
        services={services}
        prefillClient={null}
        enquiry={enquiryWithMatch}
        matchedServiceSlug="hijama-package"
      />
    );
    await continueToStep2(user, container);

    // Pre-select honoured on arrival: the banner claims the match.
    expect(screen.getByRole("status").textContent).toContain("Matched from enquiry:");
    expect(screen.getByRole("status").textContent).toContain("Hijama Package");

    // Operator changes their mind and picks a different package.
    await user.click(screen.getByRole("radio", { name: /Fire Package/i }));

    // The banner must not go on asserting the old match now that the live
    // selection has moved away from it.
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).not.toContain("Matched from enquiry:");
    });
    expect(screen.getByRole("status").textContent).toContain("Enquiry mentioned:");
  });

  it("preserves the matched pre-select — and keeps the banner accurate — across the Themself to Someone else toggle", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManualBookingForm
        services={services}
        prefillClient={null}
        enquiry={enquiryWithMatch}
        matchedServiceSlug="hijama-package"
      />
    );

    // Switch "Booking for" away from the default before ever reaching step 2.
    await user.click(screen.getByRole("radio", { name: /Someone else/i }));
    await continueToStep2(user, container);

    // The pre-select survives the toggle (a changeable default, not erased) —
    // and the banner keeps agreeing with it.
    const hijamaRadio = screen.getByRole("radio", { name: /Hijama Package/i }) as HTMLInputElement;
    expect(hijamaRadio.checked).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Matched from enquiry:");
    expect(screen.getByRole("status").textContent).toContain("Hijama Package");
  });
});

/**
 * Jumps to the review step via the session-storage draft the form already
 * restores, ticks consent so nothing but the duplicate check can block submit,
 * and fires one submission.
 */
async function submitFromStep4(
  user: ReturnType<typeof userEvent.setup>,
  { email = "aisha@example.test" }: { email?: string } = {}
) {
  // C-03 Phase C Step 10 — draft key is now scoped by source; this helper
  // always renders with prefillClient={null} enquiry={null}, i.e. "scratch".
  sessionStorage.setItem(
    "bookings-new-draft:scratch",
    JSON.stringify({
      step: 4,
      fullName: "Aisha Khan",
      email,
      phone: "07123456789",
      address: "10 Test Street",
      postcode: "LU1 1AA",
      city: "Luton",
    })
  );
  const { container } = render(
    <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
  );
  const submitButton = () =>
    screen.getAllByRole("button", { name: /Submit booking request/i })[0] as HTMLButtonElement;

  await user.click(container.querySelector<HTMLInputElement>("#consent_acknowledged")!);
  await waitFor(() => expect(submitButton().disabled).toBe(false));

  await user.click(submitButton());
  await waitFor(() => expect(createManualBooking).toHaveBeenCalledTimes(1));
  return { submitButton };
}

// ─── C-23 Phase D — availability calendar wired into the date branches ────────
//
// The governing constraint is that the calendar changes how staff SEE dates,
// never what the form SUBMITS. These specs therefore assert on the hidden
// mirror inputs (`booking_date`, `start_time`, `override_availability`) — the
// literal payload — rather than on what the visible controls display.
//
// react-day-picker renders each day as `<td data-day="yyyy-MM-dd"><button>`
// (the convention AvailabilityCalendarField.test.tsx established); days are
// addressed through that attribute, never locale-formatted text.

const MONTH_ENDPOINT = "/api/admin/availability/month";
const DAY_ENDPOINT = "/api/availability";
/** Frozen "today" — `min` and the month key are both derived from `new Date()`. */
const TODAY = "2026-08-10";

function participant(gender: "male" | "female", name: string) {
  return {
    name,
    gender,
    packageSlug: "hijama-package",
    massageEnabled: false,
    massageSlug: "",
    differentAddress: false,
    overrideAddress: "",
    overridePostcode: "",
  };
}

function seedStep3Draft(draft: Record<string, unknown>) {
  sessionStorage.setItem(
    "bookings-new-draft:scratch",
    JSON.stringify({
      step: 3,
      fullName: "Aisha Khan",
      phone: "07123456789",
      address: "10 Test Street",
      postcode: "LU1 1AA",
      city: "Luton",
      bookingForMode: "self",
      participants: [participant("female", "Aisha")],
      ...draft,
    })
  );
}

/**
 * Month endpoint: the 12th of whichever month was asked for is servable by
 * female therapists only, the 13th by neither. With one cohort that reads
 * available / unmarked; with two it reads partial / unmarked — the two cases the
 * markers must distinguish. Answering per requested month is what lets the
 * month-navigation specs tell a stale answer from a fresh one.
 */
function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));

    if (url === MONTH_ENDPOINT) {
      const female = body.participantGenders.includes("female");
      return {
        ok: true,
        json: async () => ({
          month: body.month,
          days: [
            { date: `${body.month}-12`, hasSlots: female, slotCount: female ? 3 : 0 },
            { date: `${body.month}-13`, hasSlots: false, slotCount: 0 },
          ],
        }),
      } as unknown as Response;
    }

    if (url === DAY_ENDPOINT) {
      return {
        ok: true,
        json: async () => ({
          slots: [{ time: "10:00", availableStaffByGender: { male: 1, female: 2 } }],
        }),
      } as unknown as Response;
    }

    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubFetch>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url);
}

function bodiesOf(fetchMock: ReturnType<typeof stubFetch>, url: string) {
  return callsTo(fetchMock, url).map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
}

const hidden = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[name="${name}"]`);

const dayButton = (container: HTMLElement, isoDate: string) =>
  container.querySelector<HTMLButtonElement>(`[data-day="${isoDate}"] button`);

const nextMonthButton = () => screen.getByRole("button", { name: "Go to the Next Month" });

describe("ManualBookingForm availability calendar (C-23 Phase D)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(createManualBooking).mockReset();
    // Earlier describes leave their trees mounted; a second copy of the form
    // would double every [data-day] query below.
    cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TODAY}T09:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("branch 1 — keeps the native date input and adds a marked calendar, fetching the month from the admin endpoint", async () => {
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );

    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(1));
    // Reuses the existing canCheckAvailability inputs verbatim — no new
    // preconditions, and the month is the one the picker opens on.
    expect(bodiesOf(fetchMock, MONTH_ENDPOINT)[0]).toEqual({
      month: "2026-08",
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    });

    // Direct date entry survives alongside the calendar (brief §4.3): same id,
    // same type, same min floor, same inline error slot.
    const dateInput = container.querySelector<HTMLInputElement>("input#booking_date");
    expect(dateInput?.type).toBe("date");
    expect(dateInput?.min).toBe(TODAY);

    await waitFor(() =>
      expect(dayButton(container, "2026-08-12")?.getAttribute("aria-label")).toContain(
        "availability confirmed"
      )
    );
    // A day with no availability is marked differently but stays selectable —
    // the calendar informs, it never blocks.
    expect(dayButton(container, "2026-08-13")?.getAttribute("aria-label")).not.toContain(
      "availability confirmed"
    );
    expect(dayButton(container, "2026-08-13")?.disabled).toBe(false);
  });

  it("branch 1 — picking a day on the calendar runs the same handler body as the date input: sets the date, clears the start time, and re-checks availability", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(dayButton(container, "2026-08-12")).not.toBeNull());

    await user.click(dayButton(container, "2026-08-12")!);

    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-12"));
    expect(bodiesOf(fetchMock, DAY_ENDPOINT)[0]).toEqual({
      date: "2026-08-12",
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    });

    // Slot buttons still render with their slotLabel staff counts, and picking
    // one still fills the submitted start_time.
    const slot = await screen.findByRole("button", { name: /10:00/ });
    expect(slot.textContent).toContain("1 male therapist, 2 female therapists");
    await user.click(slot);
    await waitFor(() => expect(hidden(container, "start_time")?.value).toBe("10:00"));

    // Changing the date on the calendar must clear the chosen time exactly as
    // the native input does — otherwise a stale time is submitted against a
    // new date.
    await user.click(dayButton(container, "2026-08-13")!);
    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-13"));
    expect(hidden(container, "start_time")?.value).toBe("");
    expect(hidden(container, "override_availability")).toBeNull();
  });

  // Closeout fix regression coverage — the seam the adversarial review found:
  // no prior test drove the native input's onChange at all, so the calendar
  // silently kept showing the wrong month whenever staff typed a date instead
  // of clicking one.
  it("typing a date into a different month follows the calendar there and fetches that month", async () => {
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(1));

    const dateInput = container.querySelector<HTMLInputElement>("input#booking_date")!;
    fireEvent.change(dateInput, { target: { value: "2026-09-15" } });

    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));
    expect(bodiesOf(fetchMock, MONTH_ENDPOINT)[1]).toEqual({
      month: "2026-09",
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    });

    // The calendar now shows September — the typed date's month, not the one
    // it opened on — so the typed date is actually visible as selected.
    expect(dayButton(container, "2026-08-12")).toBeNull();
    await waitFor(() =>
      expect(dayButton(container, "2026-09-12")?.getAttribute("aria-label")).toContain(
        "availability confirmed"
      )
    );
  });

  it("typing a date within the already-displayed month does not trigger a redundant month refetch", async () => {
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(1));

    const dateInput = container.querySelector<HTMLInputElement>("input#booking_date")!;
    fireEvent.change(dateInput, { target: { value: "2026-08-20" } });

    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-20"));
    // Same month as already displayed — same cache key, no second fetch.
    expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(1);
  });

  it("branch 2 — mixed-gender renders ONE calendar with two cohorts' markers and one shared start time", async () => {
    const fetchMock = stubFetch();
    seedStep3Draft({
      bookingForMode: "group",
      participants: [participant("female", "Aisha"), participant("male", "Bilal")],
    });
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );

    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));
    const genderSets = bodiesOf(fetchMock, MONTH_ENDPOINT).map((b) => b.participantGenders);
    expect(genderSets).toContainEqual(["female"]);
    expect(genderSets).toContainEqual(["male"]);

    // One date, one calendar — a second would break the shared start_time
    // (brief finding 1).
    expect(container.querySelectorAll('[data-day="2026-08-12"]').length).toBe(1);
    expect(container.querySelectorAll("input#booking_date").length).toBe(1);
    expect(container.querySelectorAll('input[name="booking_date"]').length).toBe(1);

    // Female-only day reads "partial", not "available".
    await waitFor(() =>
      expect(dayButton(container, "2026-08-12")?.getAttribute("aria-label")).toContain(
        "availability for one participant group only"
      )
    );
    expect(dayButton(container, "2026-08-12")?.getAttribute("aria-label")).not.toContain(
      "availability confirmed"
    );

    // Both per-cohort slot sections are still the detailed answer below.
    expect(screen.getByText("Female participants (1)")).toBeTruthy();
    expect(screen.getByText("Male participants (1)")).toBeTruthy();
  });

  it("branch 3 — override keeps the plain date input, renders no calendar, and never clears the manually-typed start time", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(dayButton(container, "2026-08-12")).not.toBeNull());

    await user.click(screen.getByRole("button", { name: /Override availability/i }));
    await user.click(screen.getByRole("button", { name: /^Override$/ }));

    // Calendar gone with the branch; the plain date + time pair is what remains.
    await waitFor(() => expect(container.querySelectorAll("[data-day]").length).toBe(0));
    const dateInput = container.querySelector<HTMLInputElement>("input#booking_date");
    expect(dateInput?.type).toBe("date");
    expect(container.querySelector<HTMLInputElement>("input#start_time")?.type).toBe("time");
    expect(hidden(container, "override_availability")?.value).toBe("on");

    fireEvent.change(container.querySelector<HTMLInputElement>("input#start_time")!, {
      target: { value: "14:30" },
    });
    const dayCallsBefore = callsTo(fetchMock, DAY_ENDPOINT).length;
    fireEvent.change(dateInput!, { target: { value: "2026-08-11" } });

    // Branch 3's handler is only setBookingDate — no setStartTime(""), no
    // availability check. Copying branch 1's handler here would break both.
    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-11"));
    expect(hidden(container, "start_time")?.value).toBe("14:30");
    expect(callsTo(fetchMock, DAY_ENDPOINT).length).toBe(dayCallsBefore);
  });

  it("adds no new preconditions — with canCheckAvailability false there is no month fetch and no calendar", async () => {
    const fetchMock = stubFetch();
    seedStep3Draft({ city: "" });
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );

    await waitFor(() =>
      expect(screen.getByText(/Fill in the city, participant genders, and services/)).toBeTruthy()
    );
    expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(0);
    expect(container.querySelectorAll("[data-day]").length).toBe(0);
  });

  it("a failed month fetch leaves the calendar unmarked and every day still selectable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "nope" }) }) as unknown as Response)
    );
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );

    await waitFor(() => expect(dayButton(container, "2026-08-12")).not.toBeNull());
    expect(dayButton(container, "2026-08-12")?.getAttribute("aria-label")).not.toContain(
      "availability confirmed"
    );
    expect(dayButton(container, "2026-08-12")?.disabled).toBe(false);
  });

  it("paging to the next month fetches THAT month and marks it — the calendar keeps informing while the operator explores", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(1));

    await user.click(nextMonthButton());

    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));
    expect(bodiesOf(fetchMock, MONTH_ENDPOINT)[1]).toEqual({
      month: "2026-09",
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    });

    // September is displayed AND marked — before this, paging showed a
    // completely unmarked month until a date in it happened to be picked.
    await waitFor(() =>
      expect(dayButton(container, "2026-09-12")?.getAttribute("aria-label")).toContain(
        "availability confirmed"
      )
    );
    expect(dayButton(container, "2026-09-13")?.getAttribute("aria-label")).not.toContain(
      "availability confirmed"
    );
    expect(dayButton(container, "2026-09-13")?.disabled).toBe(false);
  });

  it("paging aborts the month request still in flight for the month left behind", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const signals: AbortSignal[] = [];
    const months: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(MONTH_ENDPOINT);
        months.push(JSON.parse(String(init?.body ?? "{}")).month);
        signals.push(init?.signal as AbortSignal);
        // Never resolves — the point is to observe the abort, not a response.
        return new Promise<Response>(() => {});
      })
    );
    seedStep3Draft({});
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);
    await waitFor(() => expect(signals.length).toBe(1));
    expect(signals[0].aborted).toBe(false);

    await user.click(nextMonthButton());

    await waitFor(() => expect(signals.length).toBe(2));
    expect(months).toEqual(["2026-08", "2026-09"]);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("paging the calendar never changes the selected date or the chosen start time", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(dayButton(container, "2026-08-12")).not.toBeNull());

    await user.click(dayButton(container, "2026-08-12")!);
    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-12"));
    await user.click(await screen.findByRole("button", { name: /10:00/ }));
    await waitFor(() => expect(hidden(container, "start_time")?.value).toBe("10:00"));
    const dayCallsBefore = callsTo(fetchMock, DAY_ENDPOINT).length;

    await user.click(nextMonthButton());
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));

    // The submitted payload is untouched by browsing — no auto-select, no
    // auto-clear, and no second per-day check (brief §4.5 / §5.5).
    expect(hidden(container, "booking_date")?.value).toBe("2026-08-12");
    expect(hidden(container, "start_time")?.value).toBe("10:00");
    expect(callsTo(fetchMock, DAY_ENDPOINT).length).toBe(dayCallsBefore);
  });

  // Closeout fix regression guard — the fix's main risk: syncing the calendar
  // to a TYPED date must not turn into syncing it to the SELECTED date on
  // every render, which would fight the operator by snapping paging back.
  it("paging away from the selected date's month does not snap the calendar back to it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({});
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(dayButton(container, "2026-08-12")).not.toBeNull());

    await user.click(dayButton(container, "2026-08-12")!);
    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe("2026-08-12"));

    await user.click(nextMonthButton());
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));

    // September must stay displayed. A wrong fix that also re-syncs whenever
    // `displayedMonth` changes would immediately fire again here, jump the
    // view straight back to August (the selected date's month), and issue a
    // THIRD month fetch.
    expect(dayButton(container, "2026-08-12")).toBeNull();
    expect(dayButton(container, "2026-09-12")).not.toBeNull();
    await waitFor(() =>
      expect(dayButton(container, "2026-09-12")?.getAttribute("aria-label")).toContain(
        "availability confirmed"
      )
    );
    expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2);
    expect(hidden(container, "booking_date")?.value).toBe("2026-08-12");
  });

  it("branch 2 — paging drives BOTH cohorts from the one displayed month", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = stubFetch();
    seedStep3Draft({
      bookingForMode: "group",
      participants: [participant("female", "Aisha"), participant("male", "Bilal")],
    });
    const { container } = render(
      <ManualBookingForm services={services} prefillClient={null} enquiry={null} />
    );
    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(2));

    await user.click(nextMonthButton());

    await waitFor(() => expect(callsTo(fetchMock, MONTH_ENDPOINT).length).toBe(4));
    const refetched = bodiesOf(fetchMock, MONTH_ENDPOINT).slice(2);
    expect(refetched.map((b) => b.month)).toEqual(["2026-09", "2026-09"]);
    expect(refetched.map((b) => b.participantGenders)).toContainEqual(["female"]);
    expect(refetched.map((b) => b.participantGenders)).toContainEqual(["male"]);

    // Still one calendar, and the female-only day in the NEW month reads partial.
    expect(container.querySelectorAll('[data-day="2026-09-12"]').length).toBe(1);
    await waitFor(() =>
      expect(dayButton(container, "2026-09-12")?.getAttribute("aria-label")).toContain(
        "availability for one participant group only"
      )
    );
  });
});

// ─── C-20 Phase D — address autocomplete on the Location step ─────────────────
//
// No live Google Places call happens anywhere below: `window.google` is always
// a hand-built fake, and the address components are CONSTRUCTED to the
// documented `AddressComponent` shape. Every expected value is a hardcoded
// literal — nothing is derived by calling the code under test.
//
// AddressAutocompleteField caches its Maps-loader promise in a module-level
// singleton, so — mirroring AboutYouStep.test.tsx — each render goes through
// `vi.resetModules()` + a dynamic import. That gives every test a clean loader
// and its own fake `google.maps` library instead of the first test's.
//
// The governing constraint is PARITY: a confirmed pick must leave the form in
// the same state typing the four values by hand would. The typed City handler
// clears SIX pieces of availability state, not the four the plan's C20-F6
// finding lists, so the reset specs below are split across a single-gender and
// a mixed-gender group — that is the only way all six are observable in the UI.

const ADDRESS_TEST_KEY = "test-key-not-a-real-credential";

/** Standard Luton terrace — the draft's own city, so a pick must NOT reset. */
const LUTON_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "12", shortText: "12", types: ["street_number"] },
  { longText: "Dunstable Road", shortText: "Dunstable Rd", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU1 1EY", shortText: "LU1 1EY", types: ["postal_code"] },
];

/** A different city — the pick that must reset availability. */
const MILTON_KEYNES_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "5", shortText: "5", types: ["street_number"] },
  { longText: "Silbury Boulevard", shortText: "Silbury Blvd", types: ["route"] },
  { longText: "Milton Keynes", shortText: "Milton Keynes", types: ["postal_town"] },
  { longText: "Buckinghamshire", shortText: "Buckinghamshire", types: ["administrative_area_level_2"] },
  { longText: "MK9 3AA", shortText: "MK9 3AA", types: ["postal_code"] },
];

/**
 * No postal_town, no locality, no administrative_area_level_3 — the parsed
 * `city` is "". This is the fixture the "never blank an existing value" guard
 * exists for.
 */
const NO_TOWN_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "8", shortText: "8", types: ["street_number"] },
  { longText: "Chapel Lane", shortText: "Chapel Ln", types: ["route"] },
  { longText: "Hertfordshire", shortText: "Hertfordshire", types: ["administrative_area_level_2"] },
  { longText: "AL3 4AA", shortText: "AL3 4AA", types: ["postal_code"] },
];

class FakeAutocompleteSessionToken {}

function makeSuggestion(placeId: string, text: string, components: PlaceAddressComponent[]) {
  const fetchFields = vi.fn().mockResolvedValue({ place: { addressComponents: components } });
  return { placePrediction: { placeId, text: { text }, toPlace: () => ({ fetchFields }) } };
}

interface TestGoogleWindow extends Window {
  google?: { maps?: { importLibrary: ReturnType<typeof vi.fn> } };
}

function seedGoogle(suggestions: ReturnType<typeof makeSuggestion>[]) {
  (window as unknown as TestGoogleWindow).google = {
    maps: {
      importLibrary: vi.fn().mockResolvedValue({
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: vi.fn().mockResolvedValue({ suggestions }),
        },
        AutocompleteSessionToken: FakeAutocompleteSessionToken,
      }),
    },
  };
}

async function renderFresh(
  props: Partial<React.ComponentProps<typeof ManualBookingForm>> = {}
) {
  vi.resetModules();
  const { ManualBookingForm: Fresh } = await import("./ManualBookingForm");
  return render(
    <Fresh services={services} prefillClient={null} enquiry={null} {...props} />
  );
}

const addressField = () => document.querySelector<HTMLInputElement>("#address")!;

/** A date the `min` floor always accepts, without freezing the clock. */
const FUTURE_DATE = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

/**
 * Types into the address field, waits out the debounce, then clicks the
 * suggestion whose label contains `optionText`. Fake timers cover only the
 * component's own debounce, exactly as AboutYouStep.test.tsx does.
 */
async function pickAddress(query: string, optionText: string) {
  const input = addressField();
  vi.useFakeTimers();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  await act(async () => {
    vi.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS);
  });
  await act(async () => {}); // fetchAutocompleteSuggestions resolution

  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (el) => el.textContent?.includes(optionText)
  );
  expect(option).toBeTruthy();
  fireEvent.mouseDown(option!); // keeps focus on the input, as a real click does
  fireEvent.click(option!);

  await act(async () => {}); // fetchFields -> onAddressSelected
  await act(async () => {}); // the setState calls it schedules
  vi.useRealTimers();
}

/** Picks a date, then the 10:00 slot the stub offers, on the single-cohort branch. */
async function chooseDateAndTime(container: HTMLElement) {
  fireEvent.change(container.querySelector<HTMLInputElement>("input#booking_date")!, {
    target: { value: FUTURE_DATE },
  });
  await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe(FUTURE_DATE));
  const slots = await screen.findAllByRole("button", { name: /10:00/ });
  fireEvent.click(slots[0]);
  await waitFor(() => expect(hidden(container, "start_time")?.value).toBe("10:00"));
}

describe("ManualBookingForm address autocomplete (C-20 Phase D)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(createManualBooking).mockReset();
    // Earlier describes leave their trees mounted; a second copy of the form
    // would double every #address query below.
    cleanup();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = ADDRESS_TEST_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete (window as unknown as TestGoogleWindow).google;
    delete (window as unknown as { __rahmaGoogleMapsCallback?: unknown }).__rahmaGoogleMapsCallback;
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((el) => el.remove());
  });

  it("fills all four Location fields from one confirmed pick", async () => {
    stubFetch();
    seedGoogle([makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", MILTON_KEYNES_COMPONENTS)]);
    seedStep3Draft({ address: "", postcode: "", city: "", area: "" });
    const { container } = await renderFresh();

    // The submitted payload is the hidden mirror, so that is what is asserted —
    // a pick that only moved the visible input would be a silent data bug.
    expect(hidden(container, "address")?.value).toBe("");
    expect(hidden(container, "postcode")?.value).toBe("");
    expect(hidden(container, "city")?.value).toBe("");
    expect(hidden(container, "area")?.value).toBe("");

    await pickAddress("5 Silbury", "Silbury Boulevard");

    expect(hidden(container, "address")?.value).toBe("5 Silbury Boulevard");
    expect(hidden(container, "postcode")?.value).toBe("MK9 3AA");
    expect(hidden(container, "city")?.value).toBe("Milton Keynes");
    expect(hidden(container, "area")?.value).toBe("Buckinghamshire");

    // The assist never replaces manual entry: the three sibling inputs stay
    // rendered and editable.
    for (const id of ["postcode", "city", "area"]) {
      const el = container.querySelector<HTMLInputElement>(`#${id}`)!;
      expect(el.disabled).toBe(false);
      expect(el.readOnly).toBe(false);
    }
  });

  it("marks every filled field as edited, so the pre-fill highlight clears exactly as typing clears it", async () => {
    stubFetch();
    seedGoogle([makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", MILTON_KEYNES_COMPONENTS)]);
    // A prefilled client suppresses draft restore entirely, so this test walks
    // the steps rather than seeding one — which also proves the field works
    // where operators actually meet it.
    const { container } = await renderFresh({ prefillClient });

    const continueButton = () =>
      screen.getAllByRole("button", { name: /Continue/i })[0] as HTMLButtonElement;
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());
    await waitFor(() =>
      expect(container.querySelector('[title="Step 2: current"]')).not.toBeNull()
    );
    fireEvent.change(container.querySelector<HTMLSelectElement>("#participant_gender_0")!, {
      target: { value: "female" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Hijama Package/i }));
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());
    await waitFor(() =>
      expect(container.querySelector('[title="Step 3: current"]')).not.toBeNull()
    );

    // `isPrefilled(field)` is only observable through the highlight class:
    // AdminInput carries it on the wrapper (`[&_input]:bg-…`), while the
    // address field — no longer an AdminInput — carries it on the input itself.
    const wrapperOf = (id: string) =>
      container.querySelector<HTMLInputElement>(`#${id}`)!.parentElement!.className;
    expect(addressField().className).toContain("admin-selected-sky");
    expect(wrapperOf("postcode")).toContain("admin-selected-sky");
    expect(wrapperOf("city")).toContain("admin-selected-sky");
    expect(wrapperOf("area")).toContain("admin-selected-sky");

    await pickAddress("5 Silbury", "Silbury Boulevard");

    // Every field the pick wrote is now the operator's value, not the client
    // profile's — so none of them may still claim to be pre-filled.
    expect(addressField().className).not.toContain("admin-selected-sky");
    expect(wrapperOf("postcode")).not.toContain("admin-selected-sky");
    expect(wrapperOf("city")).not.toContain("admin-selected-sky");
    expect(wrapperOf("area")).not.toContain("admin-selected-sky");
  });

  it("resets the single-cohort availability state when the picked city differs — and leaves it alone when it does not", async () => {
    stubFetch();
    seedGoogle([
      makeSuggestion("place-luton", "12 Dunstable Road, Luton", LUTON_COMPONENTS),
      makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", MILTON_KEYNES_COMPONENTS),
    ]);
    seedStep3Draft({}); // city: "Luton", one female participant
    const { container } = await renderFresh();

    await chooseDateAndTime(container);

    // Control: same city as the draft, so the typed handler's reset would not
    // have fired either. A pick that reset unconditionally would wipe a date
    // the operator had already chosen.
    await pickAddress("12 Dun", "Dunstable Road");
    expect(hidden(container, "city")?.value).toBe("Luton");
    expect(hidden(container, "booking_date")?.value).toBe(FUTURE_DATE);
    expect(hidden(container, "start_time")?.value).toBe("10:00");
    expect(screen.queryAllByRole("button", { name: /10:00/ }).length).toBeGreaterThan(0);

    // Now a genuinely different city: bookingDate, startTime, availChecked and
    // availSlots must all go.
    await pickAddress("5 Silbury", "Silbury Boulevard");

    expect(hidden(container, "city")?.value).toBe("Milton Keynes");
    expect(hidden(container, "booking_date")?.value).toBe("");
    expect(hidden(container, "start_time")?.value).toBe("");
    expect(screen.queryAllByRole("button", { name: /10:00/ }).length).toBe(0);
    // availChecked specifically: left true with availSlots emptied, the form
    // would assert "No therapists available" about a city nobody checked.
    expect(screen.queryByText(/No therapists available on this date/)).toBeNull();
  });

  it("resets BOTH mixed-gender availability flags too — six pieces of state, not four", async () => {
    stubFetch();
    seedGoogle([makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", MILTON_KEYNES_COMPONENTS)]);
    seedStep3Draft({
      bookingForMode: "group",
      participants: [participant("female", "Aisha"), participant("male", "Bilal")],
    });
    const { container } = await renderFresh();

    fireEvent.change(container.querySelector<HTMLInputElement>("input#booking_date")!, {
      target: { value: FUTURE_DATE },
    });
    await waitFor(() => expect(hidden(container, "booking_date")?.value).toBe(FUTURE_DATE));
    // One 10:00 button per cohort once both checks have come back.
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: /10:00/ }).length).toBe(2)
    );
    fireEvent.click(screen.getAllByRole("button", { name: /10:00/ })[0]);
    await waitFor(() => expect(hidden(container, "start_time")?.value).toBe("10:00"));

    await pickAddress("5 Silbury", "Silbury Boulevard");

    expect(hidden(container, "city")?.value).toBe("Milton Keynes");
    expect(hidden(container, "booking_date")?.value).toBe("");
    expect(hidden(container, "start_time")?.value).toBe("");
    // The C20-F6 trap. femaleAvailSlots/maleAvailSlots are NOT cleared by the
    // City handler — only the two `…Checked` flags are — so dropping either
    // flag leaves that cohort's slot buttons on screen, still offering times
    // computed for the previous city.
    expect(screen.queryAllByRole("button", { name: /10:00/ }).length).toBe(0);
    expect(screen.queryByText(/No female therapists available on this date/)).toBeNull();
    expect(screen.queryByText(/No male therapists available on this date/)).toBeNull();
  });

  it("clears a stale postcode-lookup message when it fills the postcode", async () => {
    // Every lookup fails, which is what puts the message on screen.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response)
    );
    seedGoogle([makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", MILTON_KEYNES_COMPONENTS)]);
    seedStep3Draft({ postcode: "ZZ99 9ZZ" });
    const { container } = await renderFresh();

    fireEvent.blur(container.querySelector<HTMLInputElement>("#postcode")!);
    await screen.findByText("Postcode not found. Fill in city and area manually.");

    await pickAddress("5 Silbury", "Silbury Boulevard");

    // The message described the old postcode; leaving it up would tell the
    // operator a postcode they never typed could not be found.
    expect(hidden(container, "postcode")?.value).toBe("MK9 3AA");
    expect(screen.queryByText("Postcode not found. Fill in city and area manually.")).toBeNull();
  });

  it("never blanks a value the operator already has when the picked place has no equivalent part", async () => {
    stubFetch();
    seedGoogle([makeSuggestion("place-no-town", "8 Chapel Lane", NO_TOWN_COMPONENTS)]);
    seedStep3Draft({ area: "Bury Park" }); // city "Luton" from the shared draft
    const { container } = await renderFresh();

    await chooseDateAndTime(container);

    await pickAddress("8 Chapel", "Chapel Lane");

    // The guard: an empty part is skipped, so the existing city survives...
    expect(hidden(container, "city")?.value).toBe("Luton");
    // ...and because the city never changed, neither did the availability state.
    expect(hidden(container, "booking_date")?.value).toBe(FUTURE_DATE);
    expect(hidden(container, "start_time")?.value).toBe("10:00");

    // ...while the parts that ARE present still fill.
    expect(hidden(container, "address")?.value).toBe("8 Chapel Lane");
    expect(hidden(container, "area")?.value).toBe("Hertfordshire");
    expect(hidden(container, "postcode")?.value).toBe("AL3 4AA");
  });
});
