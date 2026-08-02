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

import { render, screen, waitFor } from "@testing-library/react";
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
const resetTemplateToDefaultMock = vi.fn();
const sendTestEmailMock = vi.fn();
vi.mock("@/app/admin/email-templates/actions", () => ({
  saveTemplateOverride: (...args: unknown[]) => saveTemplateOverrideMock(...args),
  resetTemplateToDefault: (...args: unknown[]) => resetTemplateToDefaultMock(...args),
  sendTestEmail: (...args: unknown[]) => sendTestEmailMock(...args),
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
  resetTemplateToDefaultMock.mockResolvedValue({ ok: true });
  sendTestEmailMock.mockResolvedValue({ ok: true });
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

describe("TemplateEditor — reset to default (C-15 Phase D, Step 13)", () => {
  it("is disabled when the template has zero saved overrides", () => {
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);
    const resetButton = screen.getByRole("button", { name: /Reset to default/i }) as HTMLButtonElement;
    expect(resetButton.disabled).toBe(true);
  });

  it("is enabled when the template has a saved override, and asks for confirmation with the exact brief §2.5 copy before calling the action", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <TemplateEditor
        template={TEMPLATE}
        canEdit
        initialValues={{ greeting_intro: "Salaam {clientName}, saved override." }}
      />
    );

    const resetButton = screen.getByRole("button", { name: /Reset to default/i }) as HTMLButtonElement;
    expect(resetButton.disabled).toBe(false);

    await user.click(resetButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      `Reset '${TEMPLATE.cardName}' to its default wording? Your customisations to this template will be removed. Emails already sent are not affected.`
    );
    // Cancelled — the destructive action must not have run.
    expect(resetTemplateToDefaultMock).not.toHaveBeenCalled();
  });

  it("calls resetTemplateToDefault and clears every field back to its default once confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <TemplateEditor
        template={TEMPLATE}
        canEdit
        initialValues={{ greeting_intro: "Salaam {clientName}, saved override." }}
      />
    );

    const field = screen.getByLabelText("Greeting intro sentence") as HTMLTextAreaElement;
    expect(field.value).toBe("Salaam {clientName}, saved override.");

    await user.click(screen.getByRole("button", { name: /Reset to default/i }));

    expect(resetTemplateToDefaultMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(field.value).toBe(""));
    // The reset button is disabled again — no overrides left to reset.
    expect(
      (screen.getByRole("button", { name: /Reset to default/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});

describe("TemplateEditor — send me a test (C-15 Phase D, Step 14)", () => {
  it("calls sendTestEmail when clicked", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor template={TEMPLATE} canEdit initialValues={{}} />);

    const testButton = screen.getByRole("button", { name: /Send me a test/i }) as HTMLButtonElement;
    expect(testButton.disabled).toBe(false);

    await user.click(testButton);
    expect(sendTestEmailMock).toHaveBeenCalledTimes(1);
  });

  it("is disabled while a field is over its length limit, same gate as Save (fieldErrors)", () => {
    // TokenTextField clamps every onChange to maxLength (Phase C — even a
    // simulated paste never lands an over-limit value through user input),
    // so the only way this component's own fieldErrors can be non-empty is
    // a value that was already over-limit before the user touched anything
    // — seeded here via initialValues, exactly like Save's own disabled
    // gate is proven in this same file's dirty-state tests.
    render(
      <TemplateEditor
        template={TEMPLATE}
        canEdit
        initialValues={{ subject: "x".repeat(150) }}
      />
    );

    const testButton = screen.getByRole("button", { name: /Send me a test/i }) as HTMLButtonElement;
    const saveButton = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(testButton.disabled).toBe(true);
    expect(saveButton.disabled).toBe(true);
  });
});

describe("TemplateEditor — subject field shows the real send default (C-15 closeout, round 2)", () => {
  // subjectDefault (what resolveSubject / real sends actually use) is
  // deliberately made to differ here from the subject field's own
  // defaultValue/placeholder (which still feeds <title> and stays frozen
  // for the render-parity fixture) — the exact shape of the finding this
  // fix closes: the editor must surface subjectDefault, never the stale
  // SafeField-level string, so "Use default" can't hand an admin text a
  // real send would never emit.
  const TEMPLATE_WITH_DIVERGENT_SUBJECT: TemplateMeta = {
    ...TEMPLATE,
    subjectDefault: "{companyName} booking request received",
  };

  it("shows subjectDefault, not the subject field's own defaultValue, as the placeholder when unedited", () => {
    render(
      <TemplateEditor template={TEMPLATE_WITH_DIVERGENT_SUBJECT} canEdit initialValues={{}} />
    );
    const subjectInput = screen.getByLabelText("Subject line") as HTMLInputElement;
    expect(subjectInput.placeholder).toBe("{companyName} booking request received");
  });

  it("shows subjectDefault, not the subject field's own defaultValue, in the 'Use default' hover preview", async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        template={TEMPLATE_WITH_DIVERGENT_SUBJECT}
        canEdit
        initialValues={{ subject: "A saved override" }}
      />
    );

    await user.click(screen.getByRole("button", { name: /Edited — Use default/i }));

    expect(screen.getByText("{companyName} booking request received")).toBeTruthy();
    expect(screen.queryByText("Booking request received")).toBeNull();
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
    expect(screen.queryByRole("button", { name: /Reset to default/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Send me a test/i })).toBeNull();
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
