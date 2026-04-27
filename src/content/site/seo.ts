import type { PageSeo, SiteRouteKey } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const siteSeo = {
  siteName: "Rahma Therapy",
  siteUrl: "https://rahmatherapy.co.uk",
  defaultTitle: "Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy",
  defaultDescription: "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
  defaultOgImage: "rahmaSocialPreview",
} as const satisfies {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: SiteImageKey;
};

export const pageSeoByKey = {
  home: {
    title: "Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy",
    description: "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
    path: "/",
    ogImage: "rahmaSocialPreview",
  },
  services: {
    title: "Services | Mobile Hijama, Cupping & Massage Therapy in Luton",
    description:
      "Explore Rahma Therapy's mobile hijama, cupping, massage, IASTM and therapy packages in Luton. Compare services, prices, therapist options, and book a mobile visit.",
    path: "/services",
    ogImage: "rahmaSocialPreview",
  },
  about: {
    title: "About Rahma Therapy | Mobile Hijama, Cupping & Massage in Luton",
    description:
      "Learn about Rahma Therapy, a trusted mobile hijama, cupping and massage therapy service in Luton.",
    path: "/about",
    ogImage: "rahmaSocialPreview",
  },
  "faqs-aftercare": {
    title: "FAQs & Aftercare | Mobile Hijama, Cupping & Massage in Luton",
    description:
      "Find answers about Rahma Therapy's mobile hijama, cupping, massage, booking process, home visits, and aftercare guidance in Luton.",
    path: "/faqs-aftercare",
    ogImage: "rahmaSocialPreview",
  },
  physiotherapy: {
    title: "Physiotherapy in Luton | Injury Recovery & Pain Relief | Rahma Therapy",
    description:
      "Physiotherapy sessions designed to relieve pain, prevent injuries, and help you move with confidence again.",
    path: "/physiotherapy",
    ogImage: "physiotherapyHeroPrimary",
  },
  "sports-massage-barnet": {
    title: "Sports Massage in Luton | Recover Faster & Relieve Pain | Rahma Therapy",
    description:
      "Sports massage is designed to enhance athletic performance, speed up recovery, and prevent injuries by relieving muscle tension and improving circulation.",
    path: "/sports-massage-barnet",
    ogImage: "sportsMassageHero",
  },
  hijama: {
    title: "Hijama Therapy in Luton | Cupping for Pain & Detox | Rahma Therapy",
    description:
      "Hijama (cupping therapy) is a traditional treatment that supports circulation, relieves chronic pain, and restores balance to body and mind.",
    path: "/hijama",
    ogImage: "hijamaHero",
  },
} as const satisfies Record<SiteRouteKey, PageSeo<SiteImageKey>>;
