export const PACKAGE_GROUPS = {
  cupping: "Cupping",
  massage: "Massage",
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
    name: "Supreme Combo",
    group: "cupping",
    price: 55,
    summary:
      "A complete cupping appointment combining preparation, IASTM, dry, fire, and wet cupping.",
    badge: "Most requested",
    includes: [
      "Pre-treatment massage",
      "IASTM / Graston therapy",
      "Dry cupping",
      "Fire cupping",
      "Wet cupping (Hijama)",
    ],
  },
  {
    id: "hijama-package",
    name: "Hijama Treatment",
    group: "cupping",
    price: 45,
    summary: "Focused hijama care with preparation, dry cupping, and wet cupping.",
    includes: ["Pre-treatment massage", "Dry cupping", "Wet cupping (Hijama)"],
  },
  {
    id: "fire-package",
    name: "Fire Cupping",
    group: "cupping",
    price: 40,
    summary: "Fire or dry cupping supported by a short massage with essential oils.",
    includes: [
      "Pre-treatment massage with essential oils",
      "Dry or fire cupping",
    ],
  },
  {
    id: "massage-30",
    name: "30-minute Massage",
    group: "massage",
    durationLabel: "30 mins",
    price: 40,
    summary: "A focused session for relaxation, tension relief, or recovery support.",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage or Graston therapy option",
    ],
  },
  {
    id: "massage-60",
    name: "60-minute Massage",
    group: "massage",
    durationLabel: "1 hour",
    price: 60,
    summary: "A longer session for deeper treatment, recovery work, and unhurried care.",
    badge: "Extended session",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage or Graston therapy option",
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
    return "Select at least one treatment to continue.";
  }

  const selected = getSelectedPackages(ids);
  const cuppingCount = selected.filter((item) => item.group === "cupping").length;
  const massageCount = selected.filter((item) => item.group === "massage").length;

  if (cuppingCount > 1) {
    return "Select one cupping treatment at a time so the request stays clear.";
  }

  if (massageCount > 1) {
    return "Select one massage duration at a time.";
  }

  return null;
}
