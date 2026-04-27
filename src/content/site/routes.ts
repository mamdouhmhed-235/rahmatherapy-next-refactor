import type { RouteDefinition, SiteRouteKey, SiteRoutePath } from "@/types/content";

export const routeDefinitions = {
  home: {
    key: "home",
    path: "/",
    label: "Home",
    navLabel: "Home",
  },
  services: {
    key: "services",
    path: "/services",
    label: "Services",
    navLabel: "Services",
  },
  about: {
    key: "about",
    path: "/about",
    label: "About",
    navLabel: "About",
  },
  "faqs-aftercare": {
    key: "faqs-aftercare",
    path: "/faqs-aftercare",
    label: "FAQs & Aftercare",
    navLabel: "FAQs & Aftercare",
  },
  physiotherapy: {
    key: "physiotherapy",
    path: "/physiotherapy",
    label: "Physiotherapy",
    navLabel: "Physiotherapy",
  },
  "sports-massage-barnet": {
    key: "sports-massage-barnet",
    path: "/sports-massage-barnet",
    label: "Sports Massage",
    navLabel: "Sports Massage",
  },
  hijama: {
    key: "hijama",
    path: "/hijama",
    label: "Hijama",
    navLabel: "Hijama",
  },
} as const satisfies Record<SiteRouteKey, RouteDefinition>;

export const routeOrder = [
  routeDefinitions.home,
  routeDefinitions.services,
  routeDefinitions.about,
  routeDefinitions["faqs-aftercare"],
  routeDefinitions.physiotherapy,
  routeDefinitions["sports-massage-barnet"],
  routeDefinitions.hijama,
] as const;

export function getRouteByKey(key: SiteRouteKey) {
  return routeDefinitions[key];
}

export function getRouteByPath(path: SiteRoutePath) {
  return routeOrder.find((route) => route.path === path);
}
