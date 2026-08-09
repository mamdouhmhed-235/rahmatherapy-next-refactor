import { describe, expect, it } from "vitest";
import { parsePlaceToAddressParts, type PlaceAddressComponent } from "./parse-place";

// Fixtures below are CONSTRUCTED to the documented `AddressComponent` shape
// (`{ longText, shortText, types[] }`) and modelled on real UK addresses —
// they are NOT captured from a live Places API call (Phase A must not call
// the live, billed API; see plan §3.2 for the later real-address matrix that
// does). Do not treat these as evidence of live API behaviour.

const lutonTerrace: PlaceAddressComponent[] = [
  { longText: "12", shortText: "12", types: ["street_number"] },
  { longText: "Dunstable Road", shortText: "Dunstable Rd", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "England", shortText: "England", types: ["administrative_area_level_1"] },
  { longText: "LU1 1EY", shortText: "LU1 1EY", types: ["postal_code"] },
  { longText: "United Kingdom", shortText: "GB", types: ["country"] },
];

const flatWithSubpremise: PlaceAddressComponent[] = [
  { longText: "Flat 3", shortText: "Flat 3", types: ["subpremise"] },
  { longText: "45", shortText: "45", types: ["street_number"] },
  { longText: "Church Street", shortText: "Church St", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU1 3JF", shortText: "LU1 3JF", types: ["postal_code"] },
];

const newBuildNoPostalTown: PlaceAddressComponent[] = [
  { longText: "1", shortText: "1", types: ["street_number"] },
  { longText: "Meadow Rise", shortText: "Meadow Rise", types: ["route"] },
  { longText: "Houghton Regis", shortText: "Houghton Regis", types: ["locality"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU5 5XX", shortText: "LU5 5XX", types: ["postal_code"] },
];

const postcodeLess: PlaceAddressComponent[] = [
  { longText: "7", shortText: "7", types: ["street_number"] },
  { longText: "Park Street", shortText: "Park St", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  // No postal_code component at all.
];

const londonNoLevel2: PlaceAddressComponent[] = [
  { longText: "10", shortText: "10", types: ["street_number"] },
  { longText: "Baker Street", shortText: "Baker St", types: ["route"] },
  { longText: "London", shortText: "London", types: ["postal_town"] },
  // No administrative_area_level_2 for London — falls back to level_1.
  { longText: "England", shortText: "England", types: ["administrative_area_level_1"] },
  { longText: "NW1 6XE", shortText: "NW1 6XE", types: ["postal_code"] },
];

// Both postal_town AND locality present, with DIFFERENT values — a realistic
// Luton case (Leagrave is a locality/ward within the town of Luton). Proves
// the fallback chain actually prefers postal_town; every other fixture in
// this file has at most one of the two candidates present, which left the
// chain's ORDER unproven (mutation testing: swapping the chain to
// `locality || postal_town` left 7/7 tests passing before this fixture).
const lutonWithLocalityAndPostalTown: PlaceAddressComponent[] = [
  { longText: "22", shortText: "22", types: ["street_number"] },
  { longText: "Leagrave High Street", shortText: "Leagrave High St", types: ["route"] },
  { longText: "Leagrave", shortText: "Leagrave", types: ["locality"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "LU4 0QA", shortText: "LU4 0QA", types: ["postal_code"] },
];

// postal_code longText and shortText DIFFER — every other fixture in this
// file uses an identical string for both, which left the short-vs-long
// choice unproven (mutation testing: switching `pick("postal_code", true)`
// to `pick("postal_code")` left 7/7 tests passing before this fixture).
// Google's shortText for a UK postcode is the compact form; longText can
// carry a fuller/expanded rendering. Values below are illustrative, not a
// literal live API capture (this file's fixtures are constructed, not
// captured — see the file-level comment above).
const postcodeShortLongDiffer: PlaceAddressComponent[] = [
  { longText: "5", shortText: "5", types: ["street_number"] },
  { longText: "Wardown Park Road", shortText: "Wardown Park Rd", types: ["route"] },
  { longText: "Luton", shortText: "Luton", types: ["postal_town"] },
  { longText: "Bedfordshire", shortText: "Bedfordshire", types: ["administrative_area_level_2"] },
  { longText: "Luton LU2 7HA", shortText: "LU2 7HA", types: ["postal_code"] },
];

describe("parsePlaceToAddressParts", () => {
  it("parses a standard Luton terrace: all four fields populate", () => {
    expect(parsePlaceToAddressParts(lutonTerrace)).toEqual({
      address: "12 Dunstable Road",
      city: "Luton",
      area: "Bedfordshire",
      postcode: "LU1 1EY",
    });
  });

  it("parses a flat/apartment: street fills, subpremise (flat detail) is not the parser's job", () => {
    expect(parsePlaceToAddressParts(flatWithSubpremise)).toEqual({
      address: "45 Church Street",
      city: "Luton",
      area: "Bedfordshire",
      postcode: "LU1 3JF",
    });
  });

  it("falls back to locality when a new-build result has no postal_town", () => {
    expect(parsePlaceToAddressParts(newBuildNoPostalTown)).toEqual({
      address: "1 Meadow Rise",
      city: "Houghton Regis",
      area: "Bedfordshire",
      postcode: "LU5 5XX",
    });
  });

  it("leaves postcode empty when the result has no postal_code, without blanking the rest", () => {
    expect(parsePlaceToAddressParts(postcodeLess)).toEqual({
      address: "7 Park Street",
      city: "Luton",
      area: "Bedfordshire",
      postcode: "",
    });
  });

  it("falls back area to administrative_area_level_1 for a London address (no level_2)", () => {
    expect(parsePlaceToAddressParts(londonNoLevel2)).toEqual({
      address: "10 Baker Street",
      city: "London",
      area: "England",
      postcode: "NW1 6XE",
    });
  });

  it("prefers postal_town over locality when both are present and differ (Leagrave/Luton)", () => {
    expect(parsePlaceToAddressParts(lutonWithLocalityAndPostalTown)).toEqual({
      address: "22 Leagrave High Street",
      city: "Luton",
      area: "Bedfordshire",
      postcode: "LU4 0QA",
    });
  });

  it("takes the short postcode text, not the long text, when they differ", () => {
    expect(parsePlaceToAddressParts(postcodeShortLongDiffer)).toEqual({
      address: "5 Wardown Park Road",
      city: "Luton",
      area: "Bedfordshire",
      postcode: "LU2 7HA",
    });
  });

  it("returns all empty strings for an empty component array", () => {
    expect(parsePlaceToAddressParts([])).toEqual({
      address: "",
      city: "",
      area: "",
      postcode: "",
    });
  });

  it("never returns undefined for any key", () => {
    const cases = [lutonTerrace, flatWithSubpremise, newBuildNoPostalTown, postcodeLess, londonNoLevel2, []];
    for (const components of cases) {
      const parts = parsePlaceToAddressParts(components);
      expect(parts.address).not.toBeUndefined();
      expect(parts.city).not.toBeUndefined();
      expect(parts.area).not.toBeUndefined();
      expect(parts.postcode).not.toBeUndefined();
    }
  });
});
