export const PACKAGE_GROUPS = {
  cupping: "Hijama & cupping",
  massage: "Massage therapy",
} as const;

export type PackageGroup = keyof typeof PACKAGE_GROUPS;

export type BookingPackageId =
  | "supreme-combo"
  | "hijama-package"
  | "fire-package"
  | "massage-30"
  | "massage-60";

export interface BookingPackage {
  id: BookingPackageId;
  name: string;
  group: PackageGroup;
  price: number;
  durationLabel?: string;
  summary: string;
  includes: string[];
  badge?: string;
}

export const BOOKING_PACKAGES: readonly BookingPackage[] = [
  {
    id: "supreme-combo",
    name: "Supreme Combo Package",
    group: "cupping",
    price: 55,
    summary:
      "Our most complete home package, combining massage preparation, IASTM-style work, dry cupping, fire cupping and hijama.",
    badge: "Full reset",
    includes: [
      "Pre-cupping massage",
      "IASTM / Graston-style therapy",
      "Dry cupping",
      "Fire cupping",
      "Wet cupping / hijama",
    ],
  },
  {
    id: "hijama-package",
    name: "Hijama Package",
    group: "cupping",
    price: 45,
    summary:
      "Focused wet cupping at home with pre-cupping massage and dry cupping included.",
    badge: "Classic hijama",
    includes: [
      "Pre-cupping massage",
      "Dry cupping",
      "Wet cupping / hijama",
      "Aftercare guidance",
    ],
  },
  {
    id: "fire-package",
    name: "Fire Package",
    group: "cupping",
    price: 40,
    summary:
      "A warming dry or fire cupping session with essential oils, without wet cupping.",
    badge: "No wet cupping",
    includes: [
      "Pre-cupping massage with essential oils",
      "Dry or fire cupping",
      "Non-wet cupping session",
      "Aftercare guidance",
    ],
  },
  {
    id: "massage-30",
    name: "30-Min Massage Therapy",
    group: "massage",
    durationLabel: "30 mins",
    price: 40,
    summary:
      "A shorter focused session for one main area such as back, neck, shoulders or legs.",
    badge: "Targeted",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage option",
      "IASTM-style option",
      "Essential oil blend",
    ],
  },
  {
    id: "massage-60",
    name: "1-Hour Massage Therapy",
    group: "massage",
    durationLabel: "1 hour",
    price: 60,
    summary:
      "A longer session for multiple areas, deeper work or a calmer full-body reset.",
    badge: "Longer session",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage option",
      "IASTM-style option",
      "Essential oil blend",
    ],
  },
] as const;

export const BOOKING_PACKAGE_IDS = BOOKING_PACKAGES.map((item) => item.id);

export function isBookingPackageId(value: string): value is BookingPackageId {
  return BOOKING_PACKAGE_IDS.includes(value as BookingPackageId);
}

export function getPackageById(id: BookingPackageId) {
  return BOOKING_PACKAGES.find((item) => item.id === id) as
    | BookingPackage
    | undefined;
}

export function getSelectedPackages(ids: BookingPackageId[]) {
  return ids
    .map((id) => getPackageById(id))
    .filter((item): item is BookingPackage => Boolean(item));
}

export function getPackageTotal(ids: BookingPackageId[]) {
  return getSelectedPackages(ids).reduce((total, item) => total + item.price, 0);
}

export function getPackageSelectionError(ids: BookingPackageId[]) {
  if (ids.length === 0) {
    return "Choose at least one package to continue.";
  }

  const selected = getSelectedPackages(ids);
  const cuppingCount = selected.filter((item) => item.group === "cupping").length;
  const massageCount = selected.filter((item) => item.group === "massage").length;

  if (cuppingCount > 1) {
    return "Please choose one hijama or cupping package at a time so your request stays clear.";
  }

  if (massageCount > 1) {
    return "Please choose either the 30-minute or 1-hour massage option, not both.";
  }

  return null;
}
