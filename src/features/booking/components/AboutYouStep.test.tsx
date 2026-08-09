// @vitest-environment jsdom
//
// C-20 Phase C, Step 6 — AboutYouStep address-autocomplete wiring.
//
// NEW FILE (plan finding C20-F7): no test file covered AboutYouStep before
// this one — the old LocationDetailsStep specs were deleted with the pre-merge
// flow, so "extend the existing test" was not possible.
//
// No live Google Places calls anywhere in this file: `window.google` is always
// a hand-built fake, and the no-key test only ever checks that NO
// <script src="...maps.googleapis.com..."> element appears.
//
// AddressAutocompleteField caches a module-level singleton loader promise, so
// — mirroring AddressAutocompleteField.test.tsx — every render goes through
// `vi.resetModules()` + a dynamic import of AboutYouStep. Vitest only resets
// inlined source modules, so react / react-hook-form keep their identity and
// the `control` object built here is the one the freshly-imported Controller
// consumes.
//
// No @testing-library/jest-dom in this repo (see AddressAutocompleteField.test.tsx
// / BookingSummary.test.tsx) — assert via plain DOM properties, not
// `toBeInTheDocument()`-style matchers.
//
// Fixtures are CONSTRUCTED to the documented `AddressComponent` shape and the
// expected field values below are hardcoded literals — nothing here is derived
// by calling the code under test.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTOCOMPLETE_DEBOUNCE_MS } from "@/components/address/AddressAutocompleteField";
import type { PlaceAddressComponent } from "@/lib/address/parse-place";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import { emptyBookingDetails } from "../types";

const TEST_KEY = "test-key-not-a-real-credential";

// Standard Luton terrace — every part present, city is a covered town.
const LUTON_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "12", shortText: "12", types: ["street_number"] },
  { longText: "Dunstable Road", shortText: "Dunstable Rd", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU1 1EY", shortText: "LU1 1EY", types: ["postal_code"] },
];

// No postal_town, no locality, no administrative_area_level_3 — so the parsed
// `city` is the empty string while the other three parts are present. This is
// the fixture the "never blank an existing value" guard exists for.
const NO_TOWN_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "8", shortText: "8", types: ["street_number"] },
  { longText: "Chapel Lane", shortText: "Chapel Ln", types: ["route"] },
  { longText: "Hertfordshire", shortText: "Hertfordshire", types: ["administrative_area_level_2"] },
  { longText: "AL3 4AA", shortText: "AL3 4AA", types: ["postal_code"] },
];

// Outside the five covered towns (Luton, Dunstable, Houghton Regis,
// Harpenden, St Albans).
const OUT_OF_AREA_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "5", shortText: "5", types: ["street_number"] },
  { longText: "Silbury Boulevard", shortText: "Silbury Blvd", types: ["route"] },
  { longText: "Milton Keynes", shortText: "Milton Keynes", types: ["postal_town"] },
  { longText: "Buckinghamshire", shortText: "Buckinghamshire", types: ["administrative_area_level_2"] },
  { longText: "MK9 3AA", shortText: "MK9 3AA", types: ["postal_code"] },
];

class FakeAutocompleteSessionToken {}

function makeSuggestion(
  placeId: string,
  text: string,
  components: PlaceAddressComponent[]
) {
  const fetchFields = vi.fn().mockResolvedValue({
    place: { addressComponents: components },
  });
  return {
    placePrediction: { placeId, text: { text }, toPlace: () => ({ fetchFields }) },
  };
}

interface TestGoogleWindow extends Window {
  google?: { maps?: { importLibrary: ReturnType<typeof vi.fn> } };
}

function seedGoogle(suggestions: ReturnType<typeof makeSuggestion>[]) {
  const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions });
  (window as unknown as TestGoogleWindow).google = {
    maps: {
      importLibrary: vi.fn().mockResolvedValue({
        AutocompleteSuggestion: { fetchAutocompleteSuggestions },
        AutocompleteSessionToken: FakeAutocompleteSessionToken,
      }),
    },
  };
  return fetchAutocompleteSuggestions;
}

async function renderStep(defaults: Partial<BookingDetailsFormValues> = {}) {
  vi.resetModules();
  const { AboutYouStep } = await import("./AboutYouStep");

  const formRef: { current: UseFormReturn<BookingDetailsFormValues> | null } = {
    current: null,
  };

  function Harness() {
    // Same shape BookingExperience builds the real form with: no resolver,
    // manual errors, validation on submit only.
    const form = useForm<BookingDetailsFormValues>({
      defaultValues: { ...emptyBookingDetails, ...defaults },
      mode: "onSubmit",
    });
    formRef.current = form;
    return <AboutYouStep form={form} />;
  }

  render(<Harness />);
  return { formRef };
}

function inputByName(name: string) {
  return document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

async function flush() {
  await act(async () => {});
}

async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS);
  });
  await flush(); // the remaining microtask hops in the component's fetch chain
}

/** Type into the address field and wait for the (faked) suggestion list. */
async function typeAddress(text: string) {
  const input = screen.getByRole("combobox") as HTMLInputElement;
  vi.useFakeTimers();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  await advanceDebounce();
  return input;
}

/** Click the first suggestion and let the place-details chain settle. */
async function selectFirstSuggestion() {
  const option = document.querySelector('[role="option"]') as HTMLElement;
  expect(option).not.toBeNull();
  fireEvent.mouseDown(option);
  fireEvent.click(option);
  await flush(); // fetchFields resolution -> onAddressSelected
  await flush(); // the setValue/validation state updates it schedules
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  delete (window as unknown as TestGoogleWindow).google;
  delete (window as unknown as { __rahmaGoogleMapsCallback?: unknown }).__rahmaGoogleMapsCallback;
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((el) => el.remove());
});

describe("AboutYouStep — address autocomplete fills the location fields", () => {
  it("fills address, city, area and postcode from one confirmed selection, and the covered-area notice follows", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
    seedGoogle([makeSuggestion("place-luton", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS)]);

    const { formRef } = await renderStep();

    // The markup around the input is unchanged: the wrapping <label> still
    // names the field, and the aria-invalid hook still reaches it.
    const combobox = screen.getByRole("combobox", { name: "Home visit address" });
    expect(combobox.getAttribute("aria-invalid")).toBe("false");

    // Nothing filled to begin with.
    expect(inputByName("city").value).toBe("");
    expect(inputByName("area").value).toBe("");
    expect(inputByName("postcode").value).toBe("");
    expect(document.querySelector("strong")?.textContent).not.toBe("Covered area:");

    await typeAddress("12 Dun");
    await selectFirstSuggestion();

    // What the customer sees.
    expect(inputByName("address").value).toBe("12 Dunstable Road");
    expect(inputByName("city").value).toBe("Luton");
    expect(inputByName("area").value).toBe("Bedfordshire");
    expect(inputByName("postcode").value).toBe("LU1 1EY");

    // What the About -> Time hard gate reads (bookingDetailsSchema.safeParse
    // runs against form.getValues() in BookingExperience).
    const values = formRef.current!.getValues();
    expect(values.address).toBe("12 Dunstable Road");
    expect(values.city).toBe("Luton");
    expect(values.area).toBe("Bedfordshire");
    expect(values.postcode).toBe("LU1 1EY");

    // The covered-area notice re-reads watch("city"), so it must have updated.
    expect(screen.getByText("Covered area:")).toBeTruthy();

    // The assist never replaces manual entry: all three sibling inputs stay
    // rendered and editable.
    for (const name of ["city", "area", "postcode"]) {
      const el = inputByName(name);
      expect(el.disabled).toBe(false);
      expect(el.readOnly).toBe(false);
    }
  });

  it("never blanks a value the customer already has when the selected place has no equivalent part", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
    seedGoogle([makeSuggestion("place-no-town", "8 Chapel Lane", NO_TOWN_COMPONENTS)]);

    // The customer already typed a city; the place they pick has no
    // postal_town / locality / administrative_area_level_3 at all, so the
    // parsed `city` is "".
    const { formRef } = await renderStep({ city: "Luton" });
    expect(inputByName("city").value).toBe("Luton");

    await typeAddress("8 Chapel");
    await selectFirstSuggestion();

    // The guard: an empty part is skipped, so the typed city survives.
    expect(inputByName("city").value).toBe("Luton");
    expect(formRef.current!.getValues().city).toBe("Luton");

    // ...while the parts that ARE present still fill.
    expect(inputByName("address").value).toBe("8 Chapel Lane");
    expect(inputByName("area").value).toBe("Hertfordshire");
    expect(inputByName("postcode").value).toBe("AL3 4AA");
  });

  it("leaves the other fields alone while the customer is only typing", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
    seedGoogle([makeSuggestion("place-luton", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS)]);

    const { formRef } = await renderStep({
      city: "Dunstable",
      area: "Bedfordshire",
      postcode: "LU5 4AA",
    });

    await typeAddress("12 Dun");

    // Suggestions ARE open — this is the moment a selection would fire.
    expect(document.querySelector('[role="option"]')).not.toBeNull();

    // ...but nothing was selected, so nothing was filled or cleared.
    expect(inputByName("address").value).toBe("12 Dun");
    expect(inputByName("city").value).toBe("Dunstable");
    expect(inputByName("area").value).toBe("Bedfordshire");
    expect(inputByName("postcode").value).toBe("LU5 4AA");

    const values = formRef.current!.getValues();
    expect(values.address).toBe("12 Dun");
    expect(values.city).toBe("Dunstable");
    expect(values.area).toBe("Bedfordshire");
    expect(values.postcode).toBe("LU5 4AA");
  });

  it("surfaces the outside-coverage notice when the selected address is out of area", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
    seedGoogle([
      makeSuggestion("place-mk", "5 Silbury Boulevard, Milton Keynes", OUT_OF_AREA_COMPONENTS),
    ]);

    const { formRef } = await renderStep();

    await typeAddress("5 Silbury");
    await selectFirstSuggestion();

    expect(inputByName("city").value).toBe("Milton Keynes");
    // The city that the About -> Time gate will reject is the one now in form
    // state — a selection reaches the gate exactly as typing does.
    expect(formRef.current!.getValues().city).toBe("Milton Keynes");
    expect(screen.getByText("Outside current home visit area:")).toBeTruthy();
    expect(screen.queryByText("Covered area:")).toBeNull();
  });

  it("is a plain, fully usable input when no API key is configured", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    seedGoogle([makeSuggestion("place-luton", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS)]);

    const { formRef } = await renderStep();

    const input = await typeAddress("22 Dunstable Road");

    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe("22 Dunstable Road");
    expect(formRef.current!.getValues().address).toBe("22 Dunstable Road");
  });
});
