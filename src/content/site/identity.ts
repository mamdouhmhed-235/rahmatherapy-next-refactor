import type { SiteIdentity } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const siteIdentity = {
  name: "Zam Therapy",
  legalName: "Zam Therapy",
  tagline: "Physiotherapy, Sports Massage and Hijama in Barnet",
  defaultDescription: "Expert massage, physiotherapy and hijama in Barnet and local areas.",
  location: "Barnet",
  serviceArea: "Barnet and the surrounding area",
  footerCredit: "Website by Cotta Digital",
  logo: {
    image: "zamTherapyMark",
    alt: "Zam Therapy",
  },
} as const satisfies SiteIdentity<SiteImageKey>;
