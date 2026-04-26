import type { ServiceSummary } from "@/types/content";
import type { SiteImageKey } from "./images";

export const serviceSummaries = [
  {
    key: "sports-massage-barnet",
    name: "Sports Massage",
    route: "/sports-massage-barnet",
    summary: "Melt away stress, relieve pain and restore calm",
    priceLabel: "£60 per hour",
    image: { image: "homeServiceSportsMassage" },
    ctaLabel: "View Treatment",
  },
  {
    key: "physiotherapy",
    name: "Physiotherapy",
    route: "/physiotherapy",
    summary: "Tailor-made recovery and rehab sessions",
    priceLabel: "£35 for 30min consultation",
    image: { image: "homeServicePhysiotherapy" },
    ctaLabel: "View Treatment",
  },
  {
    key: "hijama",
    name: "Hijama (Wet Cupping)",
    route: "/hijama",
    summary: "Detoxify, relieve chronic pain, and restore energetic balance",
    priceLabel: "£45 unlimited cups",
    image: { image: "homeServiceHijama" },
    ctaLabel: "View Treatment",
  },
] as const satisfies readonly ServiceSummary<SiteImageKey>[];
