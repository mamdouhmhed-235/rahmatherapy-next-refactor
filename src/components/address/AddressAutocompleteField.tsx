"use client";

// C-20 Phase B — the shared Google Places address-autocomplete field.
//
// Shared by the public booking dialog (Phase C) and the admin create-booking
// form (Phase D) — neither caller exists yet; this file has no wiring.
//
// ARCHITECTURE (progress §0.2 / §0.2a — overrides the plan's Step 3 prose,
// which was written for the classic `google.maps.places.Autocomplete`):
//   - The classic widget is unavailable to this project (new Google Cloud
//     customers since 2025-03-01 cannot use it; this project's Cloud setup is
//     2026-07). We build our OWN input and OWN suggestion list, driven by the
//     new `AutocompleteSuggestion.fetchAutocompleteSuggestions` API — never
//     `PlaceAutocompleteElement`, which renders and owns its own <input> and
//     is incompatible with this component's `value`/`onChange`/`inputProps`
//     contract ("host owns the value", "styling is entirely the host's").
//   - Verified against Google's current published reference (not memory) at
//     dispatch time:
//     https://developers.google.com/maps/documentation/javascript/load-maps-js-api
//     https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data
//     https://developers.google.com/maps/documentation/javascript/reference/place
//     https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete-addressform
//   - `includedPrimaryTypes: ["street_address", "premise", "subpremise"]` —
//     broadened from the single value in Google's address-form example
//     because `street_address` alone excludes `premise`/`subpremise`
//     results (Google's own documented type for "an apartment, unit, or
//     suite"), which would silently drop UK flats from the suggestion list.
//     All three are confirmed Table B values, explicitly supported by
//     `includedPrimaryTypes` for Autocomplete (New) requests (verified live,
//     not from memory):
//     https://developers.google.com/maps/documentation/places/web-service/place-types
//     Still excludes businesses/POIs, matching the plan's address-only intent.
//
// COST-CRITICAL (plan §1 deviations table, progress §0.2): Place Details
// fields are `addressComponents` + `location` ONLY. NEVER `displayName` — it
// is the new API's name for the classic `name` field, and requesting it
// pushes every lookup into the Pro tier (free allowance 10,000 -> 5,000/mo,
// unit price $5 -> $17/1,000). See PLACE_DETAIL_FIELDS below.
//
// SESSION TOKENS are hand-managed (progress §0.2a point 1): one
// `AutocompleteSessionToken` per typing session, reused across every
// `fetchAutocompleteSuggestions` call in that session, consumed by
// `fetchFields()` on selection, then discarded so the next session gets a
// fresh one. Getting this wrong turns one billed Place Details event per
// booking into one billed request per keystroke.
//
// STYLING: `inputProps.className` is entirely the host's, per the plan's
// Step 3 contract ("styling is entirely the host's ... so the same
// component looks native in both trees"). The suggestion list itself is
// this component's own DOM (option B, progress §0.2a) and is SHARED by a
// `--rahma-*`-themed public form and an `--admin-*`-themed admin form — the
// two trees use disjoint colour systems, and admin defaults to DARK for any
// staff member with no saved preference (ThemeProvider.tsx), so this file
// must never hardcode a colour for the list either. Colour, border colour,
// and shadow for the list are REQUIRED host props (`listClassName`,
// `optionClassName`, `activeOptionClassName`) — no default, so a host that
// forgets to theme the list fails to compile instead of silently shipping a
// bright-white box into a dark form. Only structural chrome (position,
// z-index, sizing, border-radius, motion) is owned by this file.
//
// ACCESSIBILITY (progress §0.2a point 2 — ours to build; `PlaceAutocompleteElement`
// would have supplied this for free): WAI-ARIA 1.2 combobox pattern — input
// `role="combobox"` with `aria-expanded`/`aria-controls`/`aria-activedescendant`,
// a `role="listbox"` popup of `role="option"` items, arrow-key traversal,
// Enter to select, Escape to close ONLY the list (Phase C mounts this inside
// a Base UI modal dialog — Escape must never reach past the list to the
// dialog's own close handler while the list is open, and must NOT be
// intercepted at all while the list is closed, so the dialog's own Escape
// handling still works normally).

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import {
  parsePlaceToAddressParts,
  type AddressParts,
  type PlaceAddressComponent,
} from "@/lib/address/parse-place";

// ---------------------------------------------------------------------------
// Minimal structural types for the new Places API surface we use. Not the
// full `@types/google.maps` (not in the lockfile — no package added, per the
// dispatch's hard restriction on installs).

interface FormattableText {
  text: string;
}

interface GooglePlacePrediction {
  placeId: string;
  text: FormattableText;
  toPlace: () => GooglePlace;
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: GooglePlacePrediction | null;
}

// Opaque — never inspected, only created and passed through. `unknown` (not
// an empty interface, which TypeScript would widen to "any non-nullish
// value") since nothing here reads its shape.
type GoogleAutocompleteSessionToken = unknown;

interface GoogleAutocompleteSessionTokenCtor {
  new (): GoogleAutocompleteSessionToken;
}

interface GoogleAutocompleteRequest {
  input: string;
  sessionToken: GoogleAutocompleteSessionToken;
  includedRegionCodes: string[];
  includedPrimaryTypes?: string[];
  region?: string;
  language?: string;
}

interface GoogleAutocompleteSuggestionStatic {
  fetchAutocompleteSuggestions: (
    request: GoogleAutocompleteRequest
  ) => Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
}

interface GooglePlace {
  addressComponents?: PlaceAddressComponent[] | null;
  fetchFields: (options: { fields: string[] }) => Promise<{ place: GooglePlace }>;
}

interface GooglePlacesLibrary {
  AutocompleteSuggestion: GoogleAutocompleteSuggestionStatic;
  AutocompleteSessionToken: GoogleAutocompleteSessionTokenCtor;
}

interface WindowWithGoogleMaps extends Window {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
    };
  };
  __rahmaGoogleMapsCallback?: () => void;
}

// ---------------------------------------------------------------------------
// loadMapsApi() — module-level singleton loader (plan §2 Step 3 / progress
// §0.2a). Injects the Maps JS API lazily, ONLY when a caller actually asks
// for it (first input focus — never on mount/page load, for cost + privacy).
// A second field, or the second form, calls this again and gets the SAME
// cached promise back — never a second <script>.
//
// Resolves `null` (never rejects for a missing key) when
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is absent, so the component degrades to a
// plain, fully usable input with no user-visible error.
//
// Uses the `callback=` query-param + `google.maps.importLibrary("places")`
// pattern documented at
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api
// (the "Dynamic Library Import" bootstrap loader) rather than the classic
// synchronous `libraries=places` + global-callback-reads-window.google.maps.places
// style — deliberately simplified from Google's own generic multi-library
// accumulator snippet, since this file only ever needs exactly one library
// ("places") from exactly one call site.
let mapsApiPromise: Promise<GooglePlacesLibrary | null> | null = null;

function loadMapsApi(): Promise<GooglePlacesLibrary | null> {
  if (mapsApiPromise) return mapsApiPromise;

  // Next.js only inlines a NEXT_PUBLIC_* value at build time where this
  // exact literal member expression appears — never read it through a
  // variable, computed key, or destructure. Never log/print this value.
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    mapsApiPromise = Promise.resolve(null);
    return mapsApiPromise;
  }

  const w = window as WindowWithGoogleMaps;

  // Idempotent against the Maps script already being present (another field
  // on the page beat us to it in the same tick, or — in tests — it was
  // pre-seeded directly): skip injecting a second <script> entirely.
  if (w.google?.maps?.importLibrary) {
    mapsApiPromise = w.google.maps.importLibrary("places") as Promise<GooglePlacesLibrary>;
    return mapsApiPromise;
  }

  mapsApiPromise = new Promise<GooglePlacesLibrary | null>((resolve, reject) => {
    w.__rahmaGoogleMapsCallback = () => {
      const gw = window as WindowWithGoogleMaps;
      if (!gw.google?.maps?.importLibrary) {
        reject(new Error("Google Maps JS API loaded without importLibrary"));
        return;
      }
      gw.google.maps.importLibrary("places").then(
        (lib) => resolve(lib as GooglePlacesLibrary),
        reject
      );
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: "__rahmaGoogleMapsCallback",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      mapsApiPromise = null; // allow a later retry (e.g. a transient network failure)
      reject(new Error("Google Maps JS API failed to load"));
    };
    document.head.appendChild(script);
  });

  return mapsApiPromise;
}

// ~300ms — a cost control (plan §1: ~7,200 requests/month debounced vs
// ~14,400 undebounced, against a 10,000/month free Autocomplete Requests
// allowance), not merely a UX nicety. Rapid typing must not emit a request
// per keystroke.
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;

// COST-CRITICAL — exactly these two fields, nothing else. See the file-level
// comment above and plan §1's deviations table. Adding `displayName` (or any
// third field) moves every lookup to the Pro tier.
const PLACE_DETAIL_FIELDS = ["addressComponents", "location"];

export interface AddressAutocompleteFieldProps {
  /** Free typing — host owns the value. */
  value: string;
  onChange: (value: string) => void;
  /** Fired only on a genuine selection with usable address data — never on free text. */
  onAddressSelected: (parts: AddressParts) => void;
  /** id/name/aria/className etc. from the host — styling is entirely the host's. */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  /**
   * Host-owned colour, border colour, and shadow classes for the suggestion
   * `<ul>`. Required, no default: the list is shared by a `--rahma-*` public
   * tree and an `--admin-*` admin tree (which defaults to dark), so a host
   * that forgets to theme it must fail to compile, not ship a hardcoded
   * white box into a dark form. Structural chrome (position, sizing,
   * radius, motion) stays owned by this component.
   */
  listClassName: string;
  /** Host-owned colour classes for each `<li role="option">`, applied to every option. Required — see `listClassName`. */
  optionClassName: string;
  /** Host-owned colour classes applied on top of `optionClassName` for the active/highlighted option only. Required — see `listClassName`. */
  activeOptionClassName: string;
}

export function AddressAutocompleteField({
  value,
  onChange,
  onAddressSelected,
  inputProps,
  listClassName,
  optionClassName,
  activeOptionClassName,
}: AddressAutocompleteFieldProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GooglePlacePrediction[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const mountedRef = useRef(true);
  const librariesRef = useRef<GooglePlacesLibrary | null>(null);
  const sessionTokenRef = useRef<GoogleAutocompleteSessionToken | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    // Optional call, not just optional member access: jsdom (the test
    // environment) does not implement scrollIntoView at all.
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  function closeList() {
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function ensureSessionToken(lib: GooglePlacesLibrary): GoogleAutocompleteSessionToken {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new lib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }

  async function runFetch(query: string) {
    const lib = librariesRef.current ?? (await loadMapsApi());
    if (!mountedRef.current) return;
    librariesRef.current = lib;
    if (!lib) return; // no key, or the script failed to load — stay a plain input

    const seq = ++requestSeqRef.current;
    const token = ensureSessionToken(lib);

    let result: { suggestions: GoogleAutocompleteSuggestion[] };
    try {
      result = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: token,
        includedRegionCodes: ["gb"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        region: "gb",
        language: "en-GB",
      });
    } catch {
      return; // request failed — silently keep whatever the user typed, no alert
    }

    if (!mountedRef.current || seq !== requestSeqRef.current) return; // stale response

    const predictions = result.suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is GooglePlacePrediction => p != null);

    setSuggestions(predictions);
    setActiveIndex(-1);
    setOpen(predictions.length > 0);
  }

  function handleFocus() {
    void loadMapsApi().then((lib) => {
      if (!mountedRef.current) return;
      librariesRef.current = lib;
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    onChange(next);

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = next.trim();
    if (trimmed.length === 0) {
      closeList();
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runFetch(trimmed);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }

  async function selectSuggestion(prediction: GooglePlacePrediction) {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    closeList();

    try {
      const place = prediction.toPlace();
      const { place: fetched } = await place.fetchFields({ fields: PLACE_DETAIL_FIELDS });
      if (!mountedRef.current) return;

      // Consumed by fetchFields() above — a fresh token starts the next
      // typing session (progress §0.2a point 1).
      sessionTokenRef.current = null;

      const components = fetched.addressComponents;
      if (!components || components.length === 0) return; // no-op — keep typed text, no alert

      onAddressSelected(parsePlaceToAddressParts(components));
    } catch {
      // fetchFields failed — no-op, no alert (deliberate deviation #4).
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        // Dismiss ONLY the suggestion list. Phase C mounts this field inside
        // a Base UI modal dialog; stopPropagation here keeps Escape from
        // reaching the dialog's own close handler while the list is open.
        // When the list is already closed, this branch is skipped entirely
        // so Escape falls through to close the dialog as normal.
        e.preventDefault();
        e.stopPropagation();
        closeList();
      }
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        void selectSuggestion(suggestions[activeIndex]);
      }
      // Enter with nothing chosen: no-op, native behaviour proceeds — free
      // text the user typed is already valid input (deliberate deviation #4).
    }
  }

  return (
    <div className="relative">
      <input
        autoComplete="off"
        {...inputProps}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={closeList}
        onKeyDown={handleKeyDown}
      />
      {open && suggestions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md py-1 text-sm",
            "animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none",
            listClassName
          )}
        >
          {suggestions.map((prediction, index) => (
            <li
              key={prediction.placeId}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              onMouseDown={(e) => e.preventDefault()} // keep the input focused through the click
              onClick={() => void selectSuggestion(prediction)}
              className={cn(
                "cursor-pointer px-3 py-2",
                optionClassName,
                index === activeIndex ? activeOptionClassName : undefined
              )}
            >
              {prediction.text.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
