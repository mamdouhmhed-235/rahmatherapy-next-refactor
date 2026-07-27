import type { ActionLink, ContactLink } from "@/types/content";

export const bookingLink = {
  label: "Book Now",
  href: "?booking=1",
  variant: "primary",
} as const satisfies ActionLink;

export const contactLinks = {
  phone: {
    label: "Phone",
    value: "07798897222",
    href: "tel:+447798897222",
  },
  whatsapp: {
    label: "WhatsApp",
    value: "WhatsApp",
    href: "https://wa.me/447798897222",
  },
  email: {
    label: "Email",
    value: "rahmatherapy@outlook.com",
    href: "mailto:rahmatherapy@outlook.com",
  },
} as const satisfies Record<"phone" | "whatsapp" | "email", ContactLink>;
