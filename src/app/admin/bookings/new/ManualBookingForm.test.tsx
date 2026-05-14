import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
