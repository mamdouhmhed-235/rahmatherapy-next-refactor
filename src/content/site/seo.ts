import type { PageSeo, SiteRouteKey } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const siteSeo = {
  siteName: "Zam Therapy",
  defaultTitle: "Physiotherapy, Sports Massage and Hijama in Barnet | Zam Therapy",
  defaultDescription: "Expert massage, physiotherapy and hijama in Barnet and local areas.",
  defaultOgImage: "homeHero",
} as const satisfies {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: SiteImageKey;
};

export const pageSeoByKey = {
  home: {
    title: "Physiotherapy, Sports Massage and Hijama in Barnet | Zam Therapy",
    description: "Expert massage, physiotherapy and hijama in Barnet and local areas.",
    path: "/",
    ogImage: "homeHero",
  },
  physiotherapy: {
    title: "Physiotherapy in Barnet | Injury Recovery & Pain Relief | Zam Therapy",
    description:
      "Physiotherapy sessions designed to relieve pain, prevent injuries, and help you move with confidence again.",
    path: "/physiotherapy",
    ogImage: "physiotherapyHeroPrimary",
  },
  "sports-massage-barnet": {
    title: "Sports Massage in Barnet | Recover Faster & Relieve Pain | Zam Therapy",
    description:
      "Sports massage is designed to enhance athletic performance, speed up recovery, and prevent injuries by relieving muscle tension and improving circulation.",
    path: "/sports-massage-barnet",
    ogImage: "sportsMassageHero",
  },
  hijama: {
    title: "Hijama Therapy in Barnet | Cupping for Pain & Detox | Zam Therapy",
    description:
      "Hijama (cupping therapy) is a traditional treatment that supports circulation, relieves chronic pain, and restores balance to body and mind.",
    path: "/hijama",
    ogImage: "hijamaHero",
  },
} as const satisfies Record<SiteRouteKey, PageSeo<SiteImageKey>>;
