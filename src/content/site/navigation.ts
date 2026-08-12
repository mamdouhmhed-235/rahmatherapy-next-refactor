import type { NavItem } from "@/types/content";

export const primaryNavigation = [
  {
    label: "Home",
    href: "/home",
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
