import { homePageContent } from "./home";
import { hijamaPageContent } from "./hijama";
import { physiotherapyPageContent } from "./physiotherapy";
import { sportsMassageBarnetPageContent } from "./sportsMassageBarnet";
import type {
  HomePageContent,
  ServicePageContent,
  SiteRouteKey,
} from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export type SitePageContent =
  | HomePageContent<SiteImageKey>
  | ServicePageContent<SiteImageKey>;

export const pageContentByKey = {
  home: homePageContent,
  physiotherapy: physiotherapyPageContent,
  "sports-massage-barnet": sportsMassageBarnetPageContent,
  hijama: hijamaPageContent,
} as const satisfies Record<SiteRouteKey, SitePageContent>;

export function getPageContentByKey(key: SiteRouteKey) {
  return pageContentByKey[key];
}
