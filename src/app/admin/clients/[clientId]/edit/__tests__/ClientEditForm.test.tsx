import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateClient } from "../../../actions";
import { ClientEditForm, type ClientEditRecord } from "../ClientEditForm";

vi.mock("../../../actions", () => ({
  updateClient: vi.fn(),
}));

const client: ClientEditRecord = {
  id: "client-1",
  full_name: "Sara Mohamed",
  phone: "07100 000 000",
  email: "sara@example.test",
  gender_preference: "no_preference",
  address: "1 Test Street",
  postcode: "LU1 1AA",
  city: "Luton",
  area: "Bury Park",
  client_source: "website",
  source_detail: null,
  notes: "Prefers mornings.",
  updated_at: "2026-07-01T09:00:00.000Z",
};

const IDENTITY_HELPER =
  "Only Owner and Admin can change identity fields. Contact one of them if this needs updating.";

function saveButton() {
  return screen.getByRole("button", { name: /Save changes/i });
}

describe("ClientEditForm", () => {
  beforeEach(() => {
    vi.mocked(updateClient).mockReset();
    vi.mocked(updateClient).mockResolvedValue({});
  });

  it("pre-fills every field and leaves them editable for an identity-field manager", () => {
    const { container } = render(
      <ClientEditForm client={client} canEditIdentityFields />
    );

    const fullName = screen.getByLabelText(/Full name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/^Email/i) as HTMLInputElement;
    const genderPreference = screen.getByLabelText(
      /Therapist gender preference/i
    ) as HTMLSelectElement;

    expect(fullName.value).toBe("Sara Mohamed");
    expect(fullName.disabled).toBe(false);
    expect(email.value).toBe("sara@example.test");
    expect(email.disabled).toBe(false);
    expect(genderPreference.value).toBe("no_preference");
    expect(genderPreference.disabled).toBe(false);
    expect((screen.getByLabelText(/^Phone/i) as HTMLInputElement).value).toBe(
      "07100 000 000"
    );
    expect(screen.queryByText(IDENTITY_HELPER)).toBeNull();

    // Concurrency + identity plumbing the server action depends on.
    expect(
      container.querySelector<HTMLInputElement>('input[name="client_id"]')?.value
    ).toBe("client-1");
    expect(
      container.querySelector<HTMLInputElement>('input[name="client_updated_at"]')
        ?.value
    ).toBe("2026-07-01T09:00:00.000Z");
  });

  it("locks identity fields with an explainer when the actor lacks the permission", () => {
    const { container } = render(
      <ClientEditForm client={client} canEditIdentityFields={false} />
    );

    expect((screen.getByLabelText(/Full name/i) as HTMLInputElement).disabled).toBe(
      true
    );
    expect((screen.getByLabelText(/^Email/i) as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByLabelText(/Therapist gender preference/i) as HTMLSelectElement)
        .disabled
    ).toBe(true);
    expect(screen.getAllByText(IDENTITY_HELPER)).toHaveLength(3);

    // Operational fields stay editable.
    expect((screen.getByLabelText(/^Phone/i) as HTMLInputElement).disabled).toBe(
      false
    );

    // A disabled control submits nothing, so a hidden twin carries the current
    // value through — the server drops identity keys for this actor regardless.
    expect(
      container.querySelector<HTMLInputElement>('input[type="hidden"][name="full_name"]')
        ?.value
    ).toBe("Sara Mohamed");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[type="hidden"][name="gender_preference"]'
      )?.value
    ).toBe("no_preference");
  });

  it("submits the edited values to updateClient", async () => {
    const user = userEvent.setup();
    render(<ClientEditForm client={client} canEditIdentityFields />);

    const phone = screen.getByLabelText(/^Phone/i);
    await user.clear(phone);
    await user.type(phone, "07999 888 777");
    await user.click(saveButton());

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updateClient).mock.calls[0][1];
    expect(submitted.get("client_id")).toBe("client-1");
    expect(submitted.get("client_updated_at")).toBe("2026-07-01T09:00:00.000Z");
    expect(submitted.get("phone")).toBe("07999 888 777");
    expect(submitted.get("full_name")).toBe("Sara Mohamed");
  });

  it("shows the collision error the server returns instead of merging silently", async () => {
    const user = userEvent.setup();
    vi.mocked(updateClient).mockResolvedValue({
      error: "Email already in use by Fatima Ahmed. Resolve manually.",
    });
    render(<ClientEditForm client={client} canEditIdentityFields />);

    await user.click(saveButton());

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain(
      "Email already in use by Fatima Ahmed. Resolve manually."
    );
  });
});
