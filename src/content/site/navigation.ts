import type { NavItem } from "@/types/content";
import { bookingLink } from "./contact";

export const primaryNavigation = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Planned Home",
    href: "/home-planned",
  },
  {
    label: "Services",
    href: "/services",
  },
  {
    label: "About",
    href: "/about",
  },
  {
    label: "Reviews",
    href: "/reviews",
  },
  {
    label: "FAQs & Aftercare",
    href: "/faqs-aftercare",
  },
] as const satisfies readonly NavItem[];

export const headerCta = bookingLink;
