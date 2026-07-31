// C-15 Phase C, Step 12 — TokenTextField specs.
//
// Directed decision (Q9.1): textarea + cursor-insert chips. These specs
// prove the fallback is "genuinely good rather than grudging" per the
// dispatch — insert-at-cursor (not append), focus/caret restoration,
// maxLength enforcement (including the paste path the native `maxlength`
// attribute can't catch), canonical `{token}` storage, chip a11y, and
// read-only rendering (no editable inputs, no chips, no reveal affordance).

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TokenTextField } from "../components/TokenTextField";
import type { TemplateToken } from "@/app/admin/emails/components/templates-data";

const CLIENT_NAME_TOKEN: TemplateToken = {
  token: "{clientName}",
  label: "Client name",
  sample: "Aisha Khan",
};
const BOOKING_DATE_TOKEN: TemplateToken = {
  token: "{bookingDate}",
  label: "Booking date",
  sample: "12 June 2026",
};

function Harness({
  initialValue = "",
  maxLength = 50,
  tokens = [CLIENT_NAME_TOKEN],
  defaultValue = "The real default sentence.",
  readOnly = false,
}: {
  initialValue?: string;
  maxLength?: number;
  tokens?: TemplateToken[];
  defaultValue?: string;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <TokenTextField
      kind="greeting_intro"
      label="Greeting intro"
      helper="Helper text"
      placeholder="placeholder"
      maxLength={maxLength}
      value={value}
      onChange={setValue}
      tokens={tokens}
      defaultValue={defaultValue}
      onUseDefault={() => setValue("")}
      readOnly={readOnly}
    />
  );
}

describe("TokenTextField — chip insertion (caret-aware)", () => {
  it("inserts the token at the caret, not appended to the end", () => {
    render(<Harness initialValue="Hi , welcome!" />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    field.focus();
    field.setSelectionRange(3, 3); // right after "Hi "
    fireEvent.click(screen.getByRole("button", { name: "Insert Client name" }));
    expect(field.value).toBe("Hi {clientName}, welcome!");
  });

  it("replaces the current selection rather than inserting alongside it", () => {
    render(<Harness initialValue="Hi NAME, welcome!" />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    field.focus();
    field.setSelectionRange(3, 7); // selects "NAME"
    fireEvent.click(screen.getByRole("button", { name: "Insert Client name" }));
    expect(field.value).toBe("Hi {clientName}, welcome!");
  });

  it("restores focus and places the caret immediately after the inserted token", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="Hi , welcome!" />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    field.focus();
    field.setSelectionRange(3, 3);

    // userEvent.click (not fireEvent.click) genuinely moves focus to the
    // button first, the way a real click does — so this proves the
    // component moves focus BACK to the field, rather than the field
    // merely never having lost it.
    await user.click(screen.getByRole("button", { name: "Insert Client name" }));

    expect(document.activeElement).toBe(field);
    const expectedCaret = 3 + "{clientName}".length;
    expect(field.selectionStart).toBe(expectedCaret);
    expect(field.selectionEnd).toBe(expectedCaret);
  });

  it("stores the canonical {token} string verbatim — no special encoding", () => {
    render(<Harness initialValue="" />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Insert Client name" }));
    expect(field.value).toBe("{clientName}");
  });

  it("clamps an insertion that would exceed maxLength rather than overflowing it", () => {
    render(<Harness initialValue={"x".repeat(45)} maxLength={50} />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    field.focus();
    field.setSelectionRange(45, 45);
    // "{clientName}" is 13 chars; 45 + 13 = 58 > 50.
    fireEvent.click(screen.getByRole("button", { name: "Insert Client name" }));
    expect(field.value.length).toBe(50);
  });
});

describe("TokenTextField — maxLength enforcement", () => {
  it("clamps a value that arrives via a programmatic change/paste, which the native maxlength attribute alone would not catch", () => {
    render(<Harness initialValue="" maxLength={5} />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "abcdefghij" } });
    expect(field.value).toBe("abcde");
  });

  it("carries the maxLength attribute so ordinary typing is also stopped at the limit", () => {
    render(<Harness initialValue="" maxLength={5} />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    expect(field.maxLength).toBe(5);
  });
});

describe("TokenTextField — chip accessibility", () => {
  it("gives every chip a real, distinguishing aria-label", () => {
    render(<Harness tokens={[CLIENT_NAME_TOKEN, BOOKING_DATE_TOKEN]} />);
    expect(screen.getByRole("button", { name: "Insert Client name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Insert Booking date" })).toBeTruthy();
  });

  it("chips are real <button type=\"button\"> elements — keyboard-operable by construction", () => {
    render(<Harness />);
    const chip = screen.getByRole("button", { name: "Insert Client name" });
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("type")).toBe("button");
  });
});

describe("TokenTextField — per-field default reveal", () => {
  it("shows no 'Use default' affordance while the field is empty (not overridden)", () => {
    render(<Harness initialValue="" />);
    expect(screen.queryByRole("button", { name: /Edited — Use default/i })).toBeNull();
  });

  it("reveals the default text without committing, then only clears the field on explicit confirm", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialValue="Something the operator typed."
        defaultValue="The real default sentence."
      />
    );
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    expect(field.value).toBe("Something the operator typed.");

    await user.click(screen.getByRole("button", { name: /Edited — Use default/i }));
    expect(screen.getByText("The real default sentence.")).toBeTruthy();
    // Revealing the default must not itself change the field.
    expect(field.value).toBe("Something the operator typed.");

    await user.click(screen.getByRole("button", { name: /Use default text/i }));
    // "Use default" clears the field (canonical "use the built-in default"
    // signal end-to-end) rather than writing the illustrative defaultValue
    // text back verbatim — several registry defaults are conditional
    // (group_copy, footer_contact, booking_restored's greeting_intro) and
    // only clearing preserves that runtime behaviour.
    expect(field.value).toBe("");
  });
});

describe("TokenTextField — read-only rendering", () => {
  it("renders the field read-only, with no chips, no counter, and no default-reveal affordance", () => {
    render(<Harness initialValue="Saved override text." readOnly />);
    const field = screen.getByLabelText("Greeting intro") as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe("Saved override text.");
    expect(screen.queryByRole("button", { name: "Insert Client name" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edited — Use default/i })).toBeNull();
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
  });
});
