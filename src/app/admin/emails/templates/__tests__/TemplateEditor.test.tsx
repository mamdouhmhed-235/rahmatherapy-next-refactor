// C-15 Phase C, Step 12 — TemplateEditor specs.
//
// Scope, per the dispatch: dirty-state guard, per-field default reveal
// (wiring — TokenTextField.test.tsx already covers the reveal/commit
// mechanics in isolation), and read-only rendering. LivePreview is stubbed
// out (it owns its own fetch/debounce/abort machinery, covered by
// LivePreview.test.tsx) so these specs stay focused on TemplateEditor's own
// logic: draft state, the save action wiring, and the visibility gate.
//
// Server-side enforcement of read-only mode (canManageEmailTemplates +
// saveTemplateOverride's own requirePermission) is page.tsx's and
// actions.ts's job, not testable from this client component in isolation —
// see the C-15 progress file / dispatch report for how that's verified.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateEditor } from "../components/TemplateEditor";
import type { TemplateMeta } from "@/app/admin/emails/components/templates-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../components/LivePreview", () => ({
  LivePreview: () => <div data-testid="live-preview-stub" />,
}));

const saveTemplateOverrideMock = vi.fn();
vi.mock("@/app/admin/email-templates/actions", () => ({
  saveTemplateOverride: (...args: unknown[]) => saveTemplateOverrideMock(...args),
}));

const TEMPLATE: TemplateMeta = {
  id: "booking_confirmation",
  audience: "customer",
  cardName: "Booking confirmation",
  trigger: "Sent when a booking request is submitted",
  rendersAs: "html",
  subjectDefault: "Booking request received",
  fields: [
    {
      kind: "subject",
      label: "Subject line",
      placeholder: "Booking request received",
      helper: "Subject helper",
      maxLength: 100,
      defaultValue: "Booking request received",
    },
    {
      kind: "greeting_intro",
      label: "Greeting intro sentence",
      placeholder: "Hi {clientName}, we have received your booking request.",
      helper: "Variables in curly braces are filled automatically.",
      maxLength: 300,
      multiline: true,
      defaultValue: "Hi {clientName}, we have received your booking request.",
      tokens: [{ token: "{clientName}", label: "Client name", sample: "Aisha Khan" }],
    },
  ],
  fixedParts: [
    {
      label: "Booking summary",
      source: "Built from the booking's date, time, address and total price.",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  saveTemplateOverrideMock.mockResolvedValue({ ok: true, cleanedValues: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TemplateEditor — dirty-state guard", () => {
  it("starts clean (Save disabled) and marks dirty once a field is edited", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);

    const saveButton = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(screen.queryByText("Unsaved changes")).toBeNull();

    await user.type(screen.getByLabelText("Subject line"), "x");

    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(saveButton.disabled).toBe(false);
  });

  it("prompts a confirm dialog before leaving with unsaved changes, and only navigates away on confirm", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);

    await user.type(screen.getByLabelText("Subject line"), "x");
    await user.click(screen.getByRole("link", { name: /Templates/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain(TEMPLATE.cardName);
    expect(pushMock).toHaveBeenCalledWith("/admin/emails?tab=templates");
  });

  it("does not navigate away when the operator cancels the confirm dialog", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);

    await user.type(screen.getByLabelText("Subject line"), "x");
    await user.click(screen.getByRole("link", { name: /Templates/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("never prompts when there are no unsaved changes", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);

    await user.click(screen.getByRole("link", { name: /Templates/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("TemplateEditor — per-field default reveal wiring", () => {
  it("lets an operator reveal then commit a field back to its default, which clears dirty for that field", async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        template={TEMPLATE}
        canEdit
        initialValues={{ greeting_intro: "Salaam {clientName}, saved override." }}
      />
    );

    const field = screen.getByLabelText("Greeting intro sentence") as HTMLTextAreaElement;
    expect(field.value).toBe("Salaam {clientName}, saved override.");

    await user.click(screen.getByRole("button", { name: /Edited — Use default/i }));
    expect(screen.getByText("Hi {clientName}, we have received your booking request.")).toBeTruthy();
    // Still the saved text — revealing doesn't commit.
    expect(field.value).toBe("Salaam {clientName}, saved override.");

    await user.click(screen.getByRole("button", { name: /Use default text/i }));
    expect(field.value).toBe("");
    // Differs from the saved initial value ("Salaam...") — genuinely dirty now.
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });
});

describe("TemplateEditor — read-only rendering", () => {
  it("renders no save control and no editable inputs when canEdit is false", () => {
    render(
      <TemplateEditor
        template={TEMPLATE}
        canEdit={false}
        initialValues={{ greeting_intro: "Salaam {clientName}, saved override." }}
      />
    );

    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(
      screen.getByText("You can view but not edit this template. Contact the owner to make changes.")
    ).toBeTruthy();

    const field = screen.getByLabelText("Greeting intro sentence") as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe("Salaam {clientName}, saved override.");

    // No chip-insert controls and no "Use default" affordance either —
    // there is nothing to edit, so nothing offers to edit it.
    expect(screen.queryByRole("button", { name: "Insert Client name" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edited — Use default/i })).toBeNull();
  });

  it("still renders the live preview and the 'Filled automatically' legend for a read-only viewer", () => {
    render(<TemplateEditor template={TEMPLATE} canEdit={false} initialValues={{}} />);

    expect(screen.getByTestId("live-preview-stub")).toBeTruthy();
    expect(screen.getByText(/Filled automatically/)).toBeTruthy();
  });
});
