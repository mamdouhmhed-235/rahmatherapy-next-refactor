import type { FooterContent } from "@/types/content";

export const footerContent = {
  serviceLinks: [
    {
      label: "Physiotherapy",
      href: "/physiotherapy",
    },
    {
      label: "Sports Massage",
      href: "/sports-massage-barnet",
    },
    {
      label: "Hijama",
      href: "/hijama",
    },
  ],
  legalLinks: [
    {
      label: "Privacy policy",
      href: "#",
    },
    {
      label: "Terms of service",
      href: "#",
    },
    {
      label: "Cookies settings",
      href: "#",
    },
  ],
  copyrightLine: "© 2026 Zam Therapy. All rights reserved. Website by Cotta Digital",
} as const satisfies FooterContent;
