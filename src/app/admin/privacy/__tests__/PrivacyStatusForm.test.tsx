import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyStatusForm } from "../PrivacyStatusForm";

vi.mock("../actions", () => ({
  updatePrivacyRequestStatus: vi.fn(async () => ({ success: true })),
}));

vi.mock("../data-export", () => ({
  generateClientDataExport: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

/**
 * Drives the form to the completion confirmation and returns the modal's
 * description text — the copy this phase rewrote, read the way the privacy
 * manager reads it rather than from the module's internals.
 */
async function completionCopy(requestType: string) {
  const user = userEvent.setup();
  render(
    <PrivacyStatusForm
      requestId={REQUEST_ID}
      requestType={requestType}
      status="open"
    />
  );

  await user.selectOptions(screen.getByLabelText(/Status/i), "completed");
  await user.click(screen.getByRole("button", { name: /Save status/i }));

  const dialog = await screen.findByRole("dialog");
  const describedBy = dialog.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  return document.getElementById(describedBy as string)?.textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrivacyStatusForm completion copy", () => {
  it("names the whole cascade for a deletion_review", async () => {
    const copy = await completionCopy("deletion_review");

    expect(copy).toMatch(/hide this client's profile/i);
    expect(copy).toMatch(/cancel their open bookings/i);
    expect(copy).toMatch(/sensitive health notes/i);
    expect(copy).toMatch(/completed bookings stay/i);
    // Irreversibility is claimed for the notes alone, and the profile's real
    // fate is stated outright.
    expect(copy).toMatch(/unrecoverable/i);
    expect(copy).toMatch(/hidden, not erased/i);
  });

  it("does not overstate what a deletion_review erasure does", async () => {
    const copy = await completionCopy("deletion_review");

    // `deleteClient` on `gdpr_erasure` stamps `deleted_at` on the clients row
    // and nothing more — full_name, email, phone and address all survive, and
    // clearing the stamp restores the record. Only the sensitive notes are
    // hard-deleted. Copy that promises an erased profile, or a wholly
    // irreversible operation, is the same class of UI lie C-06 exists to kill,
    // pointing the other way.
    expect(copy).not.toMatch(
      /(delet|eras|wip|purg)\w*\s+(this\s+|the\s+|their\s+)?(client'?s?\s+)?(profile|record|account|details)/i
    );
    expect(copy).not.toMatch(
      /permanently\s+\w+\s+(this\s+|the\s+|their\s+)?(client|profile|record|account)\b/i
    );
    expect(copy).not.toMatch(/\b(this|it|that|all of this)\s+cannot be undone/i);
    expect(copy).not.toMatch(/\bpermanent(ly)?\s+and\s+irreversible/i);
  });

  it("tells the truth about a data_export: local download, client not emailed", async () => {
    const copy = await completionCopy("data_export");

    // Brief Q9.7 — emailing the client needs a template and delivery flow
    // (C-08). The copy this replaced said "The customer will get a
    // confirmation email", which was never true for any request type.
    expect(copy).toMatch(/not emailed/i);
    expect(copy).not.toMatch(/will get a confirmation email/i);
    expect(copy).not.toMatch(/(customer|client) will (get|receive|be sent)/i);
    expect(copy).toMatch(/downloads to this device/i);
    expect(copy).toMatch(/JSON file/i);
    // It must not borrow the deletion language either.
    expect(copy).not.toMatch(/cannot be undone/i);
  });

  it("says that a correction or note review changes nothing else", async () => {
    expect(await completionCopy("correction")).toMatch(/nothing else changes/i);
    cleanup();
    expect(await completionCopy("sensitive_note_review")).toMatch(
      /nothing else changes/i
    );
  });

  it("gives every request type its own copy", async () => {
    const types = [
      "deletion_review",
      "data_export",
      "correction",
      "sensitive_note_review",
    ];
    const copies: string[] = [];
    for (const type of types) {
      copies.push(await completionCopy(type));
      cleanup();
    }

    // A regression to one generic string — the shape of the lie this phase
    // removed — collapses this set.
    expect(new Set(copies).size).toBe(types.length);
    for (const copy of copies) expect(copy.length).toBeGreaterThan(0);
  });
});

describe("PrivacyStatusForm export reachability", () => {
  it("offers the export on an already-completed data_export request", () => {
    render(
      <PrivacyStatusForm
        requestId={REQUEST_ID}
        requestType="data_export"
        status="completed"
      />
    );

    // No dialog is open, and the modal's own copy of the button mounts through
    // a portal only once one is — so the button found here is the form's, the
    // direct path a fulfilled request previously lacked. Reaching the export
    // used to mean going through a "Mark request as completed?" confirmation
    // for a request that is already completed.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Download export now/i })
    ).toHaveLength(1);
  });

  it("does not offer an export on request types that have none", () => {
    render(
      <PrivacyStatusForm
        requestId={REQUEST_ID}
        requestType="deletion_review"
        status="completed"
      />
    );

    expect(screen.queryByRole("button", { name: /Download export now/i })).toBeNull();
  });
});
