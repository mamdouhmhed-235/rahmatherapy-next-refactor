import { formatBusinessDate } from "@/lib/time/london";

export function formatMoney(value: number | string | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value ?? 0));
}

export function formatDate(value: string) {
  return formatBusinessDate(value);
}

export function formatTime(value: string) {
  return value.slice(0, 5);
}

export function formatLabel(value: string | null) {
  return value ? value.replace(/_/g, " ") : "Not set";
}
