import { aboutPageContent } from "./about";
import { faqsAftercarePageContent } from "./faqsAftercare";
import { homePageContent } from "./home";
import { hijamaPageContent } from "./hijama";
import { physiotherapyPageContent } from "./physiotherapy";
import { servicesPageContent } from "./services";
import { sportsMassageBarnetPageContent } from "./sportsMassageBarnet";
import type {
  AboutPageContent,
  FaqsAftercarePageContent,
  HomePageContent,
  ServicesIndexPageContent,
  ServicePageContent,
  SiteRouteKey,
} from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export type SitePageContent =
  | HomePageContent<SiteImageKey>
  | ServicesIndexPageContent<SiteImageKey>
  | AboutPageContent<SiteImageKey>
  | FaqsAftercarePageContent<SiteImageKey>
  | ServicePageContent<SiteImageKey>;

export const pageContentByKey = {
  home: homePageContent,
  services: servicesPageContent,
  about: aboutPageContent,
  "faqs-aftercare": faqsAftercarePageContent,
  physiotherapy: physiotherapyPageContent,
  "sports-massage-barnet": sportsMassageBarnetPageContent,
  hijama: hijamaPageContent,
} as const satisfies Record<SiteRouteKey, SitePageContent>;

export function getPageContentByKey(key: SiteRouteKey) {
  return pageContentByKey[key];
}
