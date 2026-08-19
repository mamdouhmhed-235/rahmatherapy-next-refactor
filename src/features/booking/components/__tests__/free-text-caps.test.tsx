// @vitest-environment jsdom
//
// A1 (2026-08-19) — the five free-text booking fields that have NO error surface.
//
// A previous pass added `.max(FREE_TEXT_MAX)` to five fields in
// booking-schema.ts. Those five are precisely the ones rendered through `Field`
// WITHOUT an `error` prop and without `aria-invalid`, so a rejected value made
// react-hook-form block the step transition while showing the customer nothing
// at all: "Continue" / "Confirm booking" simply stopped working, on the core
// revenue path, with no way to discover why.
//
// The fix caps the inputs with `maxLength` so the schema limit is unreachable
// from the UI. These tests assert the two halves of that guarantee together —
// the input truncates, AND the truncated value is one the schema accepts — so
// neither half can be removed without a failure here.
//
// No @testing-library/jest-dom in this repo (see AboutYouStep.test.tsx): assert
// via plain DOM properties, not `toBeInTheDocument()`-style matchers.

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it } from "vitest";
import { AboutYouStep } from "../AboutYouStep";
import { ConfirmStep } from "../ConfirmStep";
import {
  bookingDetailsSchema,
  FREE_TEXT_MAX,
  type BookingDetailsFormValues,
} from "../../schemas/booking-schema";
import { emptyBookingDetails } from "../../types";

/** The five fields the caps landed on, and the textarea name each renders as. */
const CAPPED_FIELDS = [
  { name: "notes", step: "confirm" },
  { name: "healthNotes", step: "confirm" },
  { name: "accessNotes", step: "about" },
  { name: "parkingNotes", step: "about" },
  { name: "participantNotes.0", step: "about" },
] as const;

function textareaByName(name: string) {
  return document.querySelector(
    `textarea[name="${name}"]`
  ) as HTMLTextAreaElement | null;
}

// ⚠️ StepDisclosure UNMOUNTS its children when closed, and each of these five
// fields lives inside one whose `defaultOpen` is driven by the field already
// having a value. So every fixture below seeds the field — otherwise the
// textarea is simply absent and a test would "pass" against nothing.
const ABOUT_YOU_DEFAULTS: Partial<BookingDetailsFormValues> = {
  bookingFor: "group",
  numberOfPeople: 2,
  participantGenders: ["", ""],
  participantNames: ["", ""],
  participantNotes: ["seed", ""],
  accessNotes: "seed",
  parkingNotes: "seed",
};

const CONFIRM_DEFAULTS: Partial<BookingDetailsFormValues> = {
  notes: "seed",
  healthNotes: "seed",
};

function renderAboutYou() {
  function Harness() {
    const form = useForm<BookingDetailsFormValues>({
      defaultValues: { ...emptyBookingDetails, ...ABOUT_YOU_DEFAULTS },
      mode: "onSubmit",
    });
    return <AboutYouStep form={form} freeTravelCities={["Luton", "Dunstable"]} />;
  }
  render(<Harness />);
}

function renderConfirm() {
  const formRef: { current: UseFormReturn<BookingDetailsFormValues> | null } = {
    current: null,
  };
  function Harness() {
    const form = useForm<BookingDetailsFormValues>({
      defaultValues: { ...emptyBookingDetails, ...CONFIRM_DEFAULTS },
      mode: "onSubmit",
    });
    formRef.current = form;
    return (
      <ConfirmStep
        form={form}
        details={{ ...emptyBookingDetails, ...CONFIRM_DEFAULTS }}
        selectedPackages={[]}
        perPersonTotal={0}
        total={0}
        preferredDate={null}
        preferredTime={null}
        onEditStep={() => {}}
      />
    );
  }
  render(<Harness />);
  return formRef;
}

beforeEach(() => {
  // AboutYouStep mounts AddressAutocompleteField; with no key it stays a plain
  // input and never reaches for Google Maps.
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
});

describe("A1 — free-text fields with no error surface cannot dead-end the form", () => {
  it("caps every one of the five fields at the schema limit", () => {
    renderConfirm();
    for (const field of CAPPED_FIELDS.filter((f) => f.step === "confirm")) {
      const el = textareaByName(field.name);
      expect(el, `${field.name} textarea should render`).not.toBeNull();
      expect(el!.maxLength, `${field.name} maxLength`).toBe(FREE_TEXT_MAX);
    }

    document.body.innerHTML = "";
    renderAboutYou();
    for (const field of CAPPED_FIELDS.filter((f) => f.step === "about")) {
      const el = textareaByName(field.name);
      expect(el, `${field.name} textarea should render`).not.toBeNull();
      expect(el!.maxLength, `${field.name} maxLength`).toBe(FREE_TEXT_MAX);
    }
  });

  it("truncates an over-long paste into `notes` instead of silently blocking", async () => {
    const user = userEvent.setup();
    const formRef = renderConfirm();

    const el = textareaByName("notes")!;
    await user.clear(el); // the fixture seeds a value to keep the disclosure open
    await user.paste("x".repeat(FREE_TEXT_MAX + 500));

    // The browser stopped at the cap...
    expect(el.value.length).toBe(FREE_TEXT_MAX);

    // ...and what survived is a value the schema ACCEPTS, so the step can
    // proceed. This is the half that makes it a fix rather than a nicer failure.
    const parsed = bookingDetailsSchema.safeParse({
      ...formRef.current!.getValues(),
      notes: el.value,
    });
    const notesRejected =
      parsed.error?.issues.some((issue) => issue.path[0] === "notes") ?? false;
    expect(notesRejected).toBe(false);
  });

  it("truncates an over-long paste into `healthNotes` instead of silently blocking", async () => {
    const user = userEvent.setup();
    const formRef = renderConfirm();

    const el = textareaByName("healthNotes")!;
    await user.clear(el); // the fixture seeds a value to keep the disclosure open
    await user.paste("y".repeat(FREE_TEXT_MAX + 500));

    expect(el.value.length).toBe(FREE_TEXT_MAX);

    const parsed = bookingDetailsSchema.safeParse({
      ...formRef.current!.getValues(),
      healthNotes: el.value,
    });
    const rejected =
      parsed.error?.issues.some((issue) => issue.path[0] === "healthNotes") ??
      false;
    expect(rejected).toBe(false);
  });

  it("control: the schema really does reject an over-long value, so the cap is load-bearing", () => {
    // Without this the tests above could pass because nothing was ever
    // enforced, rather than because the cap works (gotcha 109).
    const parsed = bookingDetailsSchema.safeParse({
      ...emptyBookingDetails,
      notes: "x".repeat(FREE_TEXT_MAX + 1),
    });
    const rejected =
      parsed.error?.issues.some((issue) => issue.path[0] === "notes") ?? false;
    expect(rejected).toBe(true);
  });
});
