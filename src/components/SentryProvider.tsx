"use client";
import { useEffect } from "react";

export function SentryProvider() {
  useEffect(() => {
    import("../../sentry.client.config");
  }, []);

  return null;
}