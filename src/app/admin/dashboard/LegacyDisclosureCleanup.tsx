"use client";

// One-time client effect that drops the orphan
// `rahmatherapy-business-overview-expanded-{staffId}` localStorage key left
// behind by the pre-B-5 Business-variant Tier-2 disclosure (now removed).
// Cleanup logic lives in `dashboard-helpers-b5.ts`; this component is just
// the mount-time trigger so page.tsx (a server component) stays clean.

import { useEffect } from "react";
import { cleanupLegacyDisclosureKey } from "./dashboard-helpers-b5";

export function LegacyDisclosureCleanup({ staffId }: { staffId: string }) {
  useEffect(() => {
    cleanupLegacyDisclosureKey(staffId);
  }, [staffId]);
  return null;
}
