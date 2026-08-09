// @vitest-environment jsdom
//
// C-20 Phase B — AddressAutocompleteField specs.
//
// No live Google Places calls anywhere in this file: `window.google` is
// always a hand-built fake, and the lazy script-loading tests only ever
// check that a <script src="...maps.googleapis.com..."> element appears —
// nothing here waits for it to actually fetch or execute.
//
// The component reads NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and caches a
// module-level singleton promise (`loadMapsApi`), so — mirroring the
// GoogleAnalytics.test.tsx precedent for the same shape of problem — every
// test gets a FRESH module via `vi.resetModules()` + a dynamic import.
// Without that, the singleton would (by design) leak across tests and make
// later assertions silently vacuous.
//
// No @testing-library/jest-dom in this repo (see AvailabilityCalendarField.test.tsx
// / BookingRowActions.test.tsx for the established convention) — assert via
// plain DOM properties/attributes, not `toBeDisabled()`-style matchers.
//
// Fixtures below are CONSTRUCTED to the documented `AddressComponent` shape
// and reuse the exact component lists + expected-parts literals already
// proven correct by src/lib/address/parse-place.test.ts's Phase A fixtures
// (lutonTerrace, newBuildNoPostalTown) — this file never calls
// `parsePlaceToAddressParts` itself, so no expectation here is derived from
// the code under test.

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressAutocompleteFieldProps } from "./AddressAutocompleteField";
import type { PlaceAddressComponent } from "@/lib/address/parse-place";

const TEST_KEY = "test-key-not-a-real-credential";

// Fix-round (Phase B blocking finding 1): listClassName/optionClassName/
// activeOptionClassName are now required props with no default — every
// render call below must supply them, and the styling-plumbing test further
// down asserts these exact literals actually reach the rendered elements.
const TEST_LIST_CLASS_NAME = "test-list-class";
const TEST_OPTION_CLASS_NAME = "test-option-class";
const TEST_ACTIVE_OPTION_CLASS_NAME = "test-active-option-class";

async function setup() {
  vi.resetModules();
  const mod = await import("./AddressAutocompleteField");
  return {
    AddressAutocompleteField: mod.AddressAutocompleteField,
    AUTOCOMPLETE_DEBOUNCE_MS: mod.AUTOCOMPLETE_DEBOUNCE_MS,
    onChange: vi.fn() as (v: string) => void,
    onAddressSelected: vi.fn() as AddressAutocompleteFieldProps["onAddressSelected"],
  };
}

function setApiKeyPresent() {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = TEST_KEY;
}

function clearApiKey() {
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

const LUTON_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "12", shortText: "12", types: ["street_number"] },
  { longText: "Dunstable Road", shortText: "Dunstable Rd", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU1 1EY", shortText: "LU1 1EY", types: ["postal_code"] },
];
const LUTON_EXPECTED_PARTS = {
  address: "12 Dunstable Road",
  city: "Luton",
  area: "Bedfordshire",
  postcode: "LU1 1EY",
};

const NEWBUILD_COMPONENTS: PlaceAddressComponent[] = [
  { longText: "1", shortText: "1", types: ["street_number"] },
  { longText: "Meadow Rise", shortText: "Meadow Rise", types: ["route"] },
  { longText: "Houghton Regis", shortText: "Houghton Regis", types: ["locality"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU5 5XX", shortText: "LU5 5XX", types: ["postal_code"] },
];
const NEWBUILD_EXPECTED_PARTS = {
  address: "1 Meadow Rise",
  city: "Houghton Regis",
  area: "Bedfordshire",
  postcode: "LU5 5XX",
};

let tokenCounter = 0;
class FakeAutocompleteSessionToken {
  readonly id: number;
  constructor() {
    tokenCounter += 1;
    this.id = tokenCounter;
  }
}

function makeSuggestion(placeId: string, text: string, components: PlaceAddressComponent[] | null) {
  const fetchFields = vi.fn().mockResolvedValue({
    place: { addressComponents: components },
  });
  const toPlace = vi.fn().mockReturnValue({ fetchFields });
  return {
    placePrediction: { placeId, text: { text }, toPlace },
    __fetchFields: fetchFields,
    __toPlace: toPlace,
  };
}

interface TestGoogleWindow extends Window {
  google?: { maps?: { importLibrary: ReturnType<typeof vi.fn> } };
}

function seedGoogle(fetchAutocompleteSuggestions: ReturnType<typeof vi.fn>) {
  (window as unknown as TestGoogleWindow).google = {
    maps: {
      importLibrary: vi.fn().mockResolvedValue({
        AutocompleteSuggestion: { fetchAutocompleteSuggestions },
        AutocompleteSessionToken: FakeAutocompleteSessionToken,
      }),
    },
  };
}

async function advanceDebounce(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {}); // flush the remaining microtask hops in runFetch's await chain
}

beforeEach(() => {
  tokenCounter = 0;
});

afterEach(() => {
  clearApiKey();
  delete (window as unknown as TestGoogleWindow).google;
  delete (window as unknown as { __rahmaGoogleMapsCallback?: unknown }).__rahmaGoogleMapsCallback;
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((el) => el.remove());
  vi.useRealTimers();
});

describe("AddressAutocompleteField — no API key: fallback", () => {
  it("renders as a plain input, injects no script, stays fully usable, and logs nothing", async () => {
    clearApiKey();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { AddressAutocompleteField, onChange, onAddressSelected } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "22 Dunstable Road" } });

    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
    expect(onChange).toHaveBeenCalledWith("22 Dunstable Road");
    expect(onAddressSelected).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("AddressAutocompleteField — lazy script loading (cost + privacy)", () => {
  it("requests nothing on mount, requests the script on first focus, and a second field reuses the cached load", async () => {
    setApiKeyPresent();
    const { AddressAutocompleteField, onChange, onAddressSelected } = await setup();

    const { getByRole: getByRoleA, unmount: unmountA } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address A" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const inputA = getByRoleA("combobox") as HTMLInputElement;

    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]').length).toBe(0);

    fireEvent.focus(inputA);
    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]').length).toBe(1);
    unmountA();

    // A second field instance in the same module graph — the singleton must
    // be reused, not re-injected.
    const { getByRole: getByRoleB } = render(
      <AddressAutocompleteField
        value=""
        onChange={vi.fn()}
        onAddressSelected={vi.fn()}
        inputProps={{ "aria-label": "Address B" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const inputB = getByRoleB("combobox") as HTMLInputElement;
    fireEvent.focus(inputB);

    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]').length).toBe(1);
  });
});

describe("AddressAutocompleteField — debounce (cost control)", () => {
  it("collapses rapid keystrokes into exactly one request, for the final value", async () => {
    setApiKeyPresent();
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    for (const partial of ["L", "Lu", "Lut", "Luto", "Luton"]) {
      fireEvent.change(input, { target: { value: partial } });
    }
    expect(fetchAutocompleteSuggestions).not.toHaveBeenCalled();

    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    expect(fetchAutocompleteSuggestions).toHaveBeenCalledTimes(1);
    // Also pins the UK-flat fix-round: includedPrimaryTypes must cover
    // premise/subpremise (not just street_address), or a flat/apartment
    // suggestion would never surface (plan gate §3.2 case 2). toMatchObject
    // requires an array value to match exactly (same length + elements), so
    // reverting to ["street_address"] alone fails this assertion.
    expect(fetchAutocompleteSuggestions.mock.calls[0][0]).toMatchObject({
      input: "Luton",
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    });
  });
});

describe("AddressAutocompleteField — session tokens (cost-critical)", () => {
  it("reuses one token across a typing session and mints a fresh one after selection", async () => {
    setApiKeyPresent();
    const suggestion = makeSuggestion("place-1", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: "12 Dun" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    fireEvent.change(input, { target: { value: "12 Dunstable" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    expect(fetchAutocompleteSuggestions).toHaveBeenCalledTimes(2);
    const tokenCall1 = fetchAutocompleteSuggestions.mock.calls[0][0].sessionToken;
    const tokenCall2 = fetchAutocompleteSuggestions.mock.calls[1][0].sessionToken;
    expect(tokenCall1).toBe(tokenCall2); // same typing session -> same token instance

    const option = document.querySelector('[role="option"]') as HTMLElement;
    expect(option).not.toBeNull();
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    await act(async () => {});

    expect(onAddressSelected).toHaveBeenCalledWith(LUTON_EXPECTED_PARTS);

    // A new typing session after the selection must get a NEW token.
    fireEvent.change(input, { target: { value: "9 New Street" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    expect(fetchAutocompleteSuggestions).toHaveBeenCalledTimes(3);
    const tokenCall3 = fetchAutocompleteSuggestions.mock.calls[2][0].sessionToken;
    expect(tokenCall3).not.toBe(tokenCall1);
  });
});

describe("AddressAutocompleteField — selecting a suggestion", () => {
  it("parses the selected place's addressComponents and calls onAddressSelected with them, requesting exactly the two Essentials fields", async () => {
    setApiKeyPresent();
    const suggestion = makeSuggestion("place-nb", "1 Meadow Rise, Houghton Regis", NEWBUILD_COMPONENTS);
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole, getByText } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1 Meadow" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    const option = getByText("1 Meadow Rise, Houghton Regis");
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    await act(async () => {});

    expect(onAddressSelected).toHaveBeenCalledTimes(1);
    expect(onAddressSelected).toHaveBeenCalledWith(NEWBUILD_EXPECTED_PARTS);
    // COST-CRITICAL mechanical guard: exactly these two fields, never `displayName`.
    expect(suggestion.__fetchFields).toHaveBeenCalledWith({
      fields: ["addressComponents", "location"],
    });
  });

  it("no-ops — keeps typed text, no alert, no callback — when the selected place has no addressComponents", async () => {
    setApiKeyPresent();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const suggestion = makeSuggestion("place-empty", "Somewhere Unknown", null);
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole, getByText } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Somewhere" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    const option = getByText("Somewhere Unknown");
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    await act(async () => {});

    expect(onAddressSelected).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe("AddressAutocompleteField — free typing", () => {
  it("never calls onAddressSelected while the user is only typing, even with suggestions open, even on a bare Enter", async () => {
    setApiKeyPresent();
    const suggestion = makeSuggestion("place-1", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12 Dun" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    expect(document.querySelector('[role="option"]')).not.toBeNull(); // suggestions ARE showing
    expect(onAddressSelected).not.toHaveBeenCalled();

    // Enter with nothing chosen (activeIndex still -1): free text stands.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddressSelected).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("12 Dun");
  });
});

describe("AddressAutocompleteField — keyboard navigation", () => {
  it("ArrowDown/ArrowUp move the active option; Enter selects the active one", async () => {
    setApiKeyPresent();
    const suggestionA = makeSuggestion("place-a", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    const suggestionB = makeSuggestion("place-b", "1 Meadow Rise, Houghton Regis", NEWBUILD_COMPONENTS);
    const fetchAutocompleteSuggestions = vi
      .fn()
      .mockResolvedValue({ suggestions: [suggestionA, suggestionB] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("false");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    expect(onAddressSelected).toHaveBeenCalledWith(NEWBUILD_EXPECTED_PARTS);
    expect(document.querySelector('[role="listbox"]')).toBeNull(); // closed after selection
  });
});

describe("AddressAutocompleteField — host-supplied list/option classes (theming contract)", () => {
  // Fix-round (Phase B blocking finding 1): the suggestion list must never
  // hardcode colour — listClassName/optionClassName/activeOptionClassName
  // are REQUIRED props with no default specifically so a host that forgets
  // to theme the list fails to compile. This test proves the plumbing is
  // non-vacuous: the host-supplied literals must actually land on the
  // rendered <ul> and <li> elements, with activeOptionClassName applied only
  // to the currently-active option.
  it("applies listClassName to the listbox and optionClassName/activeOptionClassName to the right options", async () => {
    setApiKeyPresent();
    const suggestionA = makeSuggestion("place-a", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    const suggestionB = makeSuggestion("place-b", "1 Meadow Rise, Houghton Regis", NEWBUILD_COMPONENTS);
    const fetchAutocompleteSuggestions = vi
      .fn()
      .mockResolvedValue({ suggestions: [suggestionA, suggestionB] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox).not.toBeNull();
    expect(listbox.className.split(" ")).toContain(TEST_LIST_CLASS_NAME);

    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    // Neither option is active yet: both carry the base class, neither carries the active one.
    expect(options[0].className.split(" ")).toContain(TEST_OPTION_CLASS_NAME);
    expect(options[0].className.split(" ")).not.toContain(TEST_ACTIVE_OPTION_CLASS_NAME);
    expect(options[1].className.split(" ")).toContain(TEST_OPTION_CLASS_NAME);
    expect(options[1].className.split(" ")).not.toContain(TEST_ACTIVE_OPTION_CLASS_NAME);

    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Now option 0 is active: base class stays, active class is added ONLY there.
    expect(options[0].className.split(" ")).toContain(TEST_OPTION_CLASS_NAME);
    expect(options[0].className.split(" ")).toContain(TEST_ACTIVE_OPTION_CLASS_NAME);
    expect(options[1].className.split(" ")).toContain(TEST_OPTION_CLASS_NAME);
    expect(options[1].className.split(" ")).not.toContain(TEST_ACTIVE_OPTION_CLASS_NAME);
  });
});

describe("AddressAutocompleteField — Escape", () => {
  it("dismisses only the suggestion list; once already closed, Escape propagates to an ancestor (the future dialog)", async () => {
    setApiKeyPresent();
    const suggestion = makeSuggestion("place-1", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const parentKeyDown = vi.fn();
    // A plain wrapping <div> stands in for Phase C's Base UI dialog: only
    // its onKeyDown handler matters here (whether Escape reaches it).
    const { getByRole } = render(
      <div onKeyDown={parentKeyDown}>
        <AddressAutocompleteField
          value=""
          onChange={onChange}
          onAddressSelected={onAddressSelected}
          inputProps={{ "aria-label": "Address" }}
          listClassName={TEST_LIST_CLASS_NAME}
          optionClassName={TEST_OPTION_CLASS_NAME}
          activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
        />
      </div>
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12 Dun" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(parentKeyDown).not.toHaveBeenCalled(); // swallowed — must not reach a wrapping dialog's handler

    fireEvent.keyDown(input, { key: "Escape" }); // list already closed this time
    expect(parentKeyDown).toHaveBeenCalledTimes(1); // now propagates normally
  });
});

describe("AddressAutocompleteField — unmount safety", () => {
  // React 18+ silently no-ops a hook's own setState after unmount (the old
  // "Can't perform a React state update on an unmounted component" warning
  // was deliberately removed), so a suggestions-list update resolving late
  // is not independently observable from outside the component. The
  // meaningfully testable half of "no state update after unmount" is the
  // HOST-owned side effect this component drives via a prop callback: if a
  // place-details fetch resolves after unmount, onAddressSelected — which a
  // caller wires straight into its own form state (Phase C/D) — must never
  // fire for a field that is no longer in the tree.
  it("does not call onAddressSelected, and does not throw, when a place-details fetch resolves after unmount", async () => {
    setApiKeyPresent();
    const suggestion = makeSuggestion("place-1", "12 Dunstable Road, Luton, UK", LUTON_COMPONENTS);
    let resolveFetchFields: (value: { place: { addressComponents: PlaceAddressComponent[] } }) => void =
      () => {};
    suggestion.__fetchFields.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetchFields = resolve;
        })
    );
    const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({ suggestions: [suggestion] });
    seedGoogle(fetchAutocompleteSuggestions);
    const { AddressAutocompleteField, onChange, onAddressSelected, AUTOCOMPLETE_DEBOUNCE_MS } = await setup();

    const { getByRole, getByText, unmount } = render(
      <AddressAutocompleteField
        value=""
        onChange={onChange}
        onAddressSelected={onAddressSelected}
        inputProps={{ "aria-label": "Address" }}
        listClassName={TEST_LIST_CLASS_NAME}
        optionClassName={TEST_OPTION_CLASS_NAME}
        activeOptionClassName={TEST_ACTIVE_OPTION_CLASS_NAME}
      />
    );
    const input = getByRole("combobox") as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12 Dun" } });
    await advanceDebounce(AUTOCOMPLETE_DEBOUNCE_MS);

    const option = getByText("12 Dunstable Road, Luton, UK");
    fireEvent.mouseDown(option);
    fireEvent.click(option); // kicks off toPlace().fetchFields() — left pending

    unmount();

    await act(async () => {
      resolveFetchFields({ place: { addressComponents: LUTON_COMPONENTS } });
    });

    expect(onAddressSelected).not.toHaveBeenCalled();
  });
});
