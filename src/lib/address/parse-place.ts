// Google Places address-component parser (C-20 Phase A).
//
// Targets the NEW Places API `google.maps.places.AddressComponent` shape —
// `{ longText, shortText, types[] }` — as returned via
// `place.addressComponents` after
// `place.fetchFields({ fields: ["addressComponents", "location"] })`.
//
// This is deliberately NOT the classic `google.maps.places.Autocomplete`
// component shape (`{ long_name, short_name, types[] }`, snake_case field
// names): that API has been unavailable to new customers since 2025-03-01,
// and this project's Google Cloud setup (2026-07) postdates the cutoff, so
// the classic shape would never arrive here. Do not "restore" a
// long_name/short_name version — it is dead code for this project.
//
// The `types` values themselves are unchanged from the classic API and
// remain snake_case strings (street_number, route, postal_town, locality,
// administrative_area_level_1/2/3, postal_code, country).
//
// UK component mapping (not the reference snippet's US locality/state/zip
// model — see brief §1 deviations table):
//   address  = street_number + route, space-joined, empties dropped
//   city     = postal_town -> locality -> administrative_area_level_3
//              (postal_town is the reliable UK town/city; locality is often
//              absent or names a village)
//   area     = administrative_area_level_2 -> administrative_area_level_1
//   postcode = postal_code, short text

export interface AddressParts {
  address: string;
  city: string;
  area: string;
  postcode: string;
}

// Minimal structural type for `google.maps.places.AddressComponent`.
// `@types/google.maps` is not in the lockfile, so no dependency is added.
export interface PlaceAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

export function parsePlaceToAddressParts(components: PlaceAddressComponent[]): AddressParts {
  const pick = (type: string, short = false): string => {
    const match = components.find((c) => c.types.includes(type));
    if (!match) return "";
    return (short ? match.shortText : match.longText) ?? "";
  };

  const streetNumber = pick("street_number");
  const route = pick("route");

  return {
    address: [streetNumber, route].filter(Boolean).join(" "),
    city: pick("postal_town") || pick("locality") || pick("administrative_area_level_3"),
    area: pick("administrative_area_level_2") || pick("administrative_area_level_1"),
    postcode: pick("postal_code", true),
  };
}
