"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SentryProvider() {
  const pathname = usePathname();

  useEffect(() => {
    let isCurrentRoute = true;

    void import("../../sentry.client.config").then((sentry) => {
      // Never act on a route we have already left: starting Replay for a stale
      // pathname could start it on /booking/manage, whose query string is the
      // customer's bearer token.
      if (isCurrentRoute) sentry.syncSessionReplay(pathname);
    });

    return () => {
      isCurrentRoute = false;
    };
  }, [pathname]);

  return null;
}
