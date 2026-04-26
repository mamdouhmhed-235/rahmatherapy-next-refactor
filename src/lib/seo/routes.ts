import type { SiteRouteKey, SiteRoutePath } from "@/types/content";
import { getRouteByKey, getRouteByPath } from "@/content/site/routes";
import { pageSeoByKey } from "@/content/site/seo";

export function getPageSeoByKey(key: SiteRouteKey) {
  return pageSeoByKey[key];
}

export function getPageSeoByPath(path: SiteRoutePath) {
  const route = getRouteByPath(path);
  return route ? pageSeoByKey[route.key] : undefined;
}

export function getStructuredRoute(key: SiteRouteKey) {
  return {
    route: getRouteByKey(key),
    seo: getPageSeoByKey(key),
  };
}
