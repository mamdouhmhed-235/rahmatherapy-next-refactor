import { format, parseISO } from "date-fns";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateLabel(value: string | null) {
  if (!value) {
    return "Date not selected";
  }

  try {
    return format(parseISO(value), "EEEE d MMMM yyyy");
  } catch {
    return "Date not selected";
  }
}
