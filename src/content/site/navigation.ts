import type { NavItem } from "@/types/content";
import { bookingLink } from "./contact";

export const primaryNavigation = [
  {
    label: "Home",
    href: "/",
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
    label: "FAQs & Aftercare",
    href: "/faqs-aftercare",
  },
  {
    label: "Physiotherapy",
    href: "/physiotherapy",
  },
  {
    label: "Sports Massage",
    href: "/sports-massage-barnet",
  },
  {
    label: "Hijama (Cupping)",
    href: "/hijama",
  },
] as const satisfies readonly NavItem[];

export const headerCta = bookingLink;
