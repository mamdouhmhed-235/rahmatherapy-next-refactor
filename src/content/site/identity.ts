import type { SiteIdentity } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const siteIdentity = {
  name: "Rahma Therapy",
  legalName: "Rahma Therapy",
  tagline: "Mobile hijama, cupping and massage therapy in Luton",
  defaultDescription: "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
  location: "Luton",
  serviceArea: "Luton and surrounding areas",
  footerCredit: "Website by Cotta Digital",
  logo: {
    image: "rahmaLogoRefined",
    alt: "Rahma Therapy",
  },
} as const satisfies SiteIdentity<SiteImageKey>;
