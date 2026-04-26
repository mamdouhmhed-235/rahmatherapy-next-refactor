import type { ActionLink, ContactLink } from "@/types/content";

export const bookingLink = {
  label: "Schedule a visit",
  href: "#book-now",
  variant: "primary",
} as const satisfies ActionLink;

export const contactLinks = {
  phone: {
    label: "Phone",
    value: "+447503201669",
    href: "tel:+447503201669",
  },
  email: {
    label: "Email",
    value: "zaheer@zamtherapy.com",
    href: "mailto:zaheer@zamtherapy.com",
  },
} as const satisfies Record<"phone" | "email", ContactLink>;
