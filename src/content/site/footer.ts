import type { FooterContent } from "@/types/content";

export const footerContent: FooterContent = {
  serviceLinks: [
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
    // The /areas hub. Footer only, by Owner decision — the nav stays at its
    // designed five items. Link position is not an SEO factor, and the footer
    // renders on all 20 pages, so the hub still gains a site-wide inbound link
    // and every spoke sits two clicks from every page. Before this, /areas
    // appeared nowhere outside its own cluster: no internal link, so no
    // crawl-discovery path at all, and a page that is never indexed can never
    // be cited by an answer engine either.
    {
      label: "Areas We Cover",
      href: "/areas",
    },
  ],
  // Reachable legal pages are a compliance concern before they are an SEO one:
  // nothing on the site linked to the privacy policy at all.
  legalLinks: [
    {
      label: "Privacy",
      href: "/privacy",
    },
    {
      label: "Cookies",
      href: "/cookies",
    },
  ],
  copyrightLine: "Copyright 2026 Rahma Therapy. All rights reserved. Website by Cotta Digital",
};
