import type { NavItem } from "@/types/content";
import { bookingLink } from "./contact";

export const primaryNavigation = [
  {
    label: "Home",
    href: "/",
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
