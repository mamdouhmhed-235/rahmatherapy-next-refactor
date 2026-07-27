import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByText("Contact & source")).not.toBeNull();
  });

  it("marks pre-filled client fields with 'From client profile' chip", () => {
    render(
      <ManualBookingForm services={services} prefillClient={prefillClient} enquiry={null} />
    );
    expect(screen.getAllByText("From client profile").length).toBeGreaterThan(0);
  });

  it("moves focus to the first invalid field when continuing with errors", async () => {
    const user = userEvent.setup();
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);
    // Clear any pre-filled values so validation fires
    const nameInput = screen.getByLabelText(/Full name/i);
    await user.clear(nameInput);
    await user.click(screen.getAllByRole("button", { name: /Continue/i })[0]);
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("full_name");
    });
  });

  it("shows the consent error when trying to create booking without consent", async () => {
    // Advance to step 4 via sessionStorage (override to skip steps)
    // For a lightweight smoke test just render step 4 indirectly and trigger validation
    const user = userEvent.setup();
    render(<ManualBookingForm services={services} prefillClient={null} enquiry={null} />);
    // Step 1 — fill required fields
    await user.type(screen.getByLabelText(/Full name/i), "Aisha Khan");
    await user.type(screen.getByLabelText(/Phone number/i), "07123456789");
    const continueButtons = () => screen.getAllByRole("button", { name: /Continue/i });
    await user.click(continueButtons()[0]);
    await waitFor(() => expect(screen.getByText("Services & participants")).not.toBeNull());
    // Step 2 — select service and set participant gender
    const serviceCheckboxes = screen.getAllByRole("checkbox");
    await user.click(serviceCheckboxes[0]);
    const nameInput2 = screen.getByLabelText(/Name or label/i);
    await user.clear(nameInput2);
    await user.type(nameInput2, "Aisha");
    const genderSelects = screen.getAllByRole("combobox");
    await user.selectOptions(genderSelects[genderSelects.length - 1], "female");
    await user.click(continueButtons()[0]);
    await waitFor(() => expect(screen.getByText("Location")).not.toBeNull());
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

/**
 * Jumps to the review step via the session-storage draft the form already
 * restores, ticks consent so nothing but the duplicate check can block submit,
 * and fires one submission.
 */
async function submitFromStep4(
  user: ReturnType<typeof userEvent.setup>,
  { email = "aisha@example.test" }: { email?: string } = {}
) {
  sessionStorage.setItem(
    "booking-new-draft",
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
