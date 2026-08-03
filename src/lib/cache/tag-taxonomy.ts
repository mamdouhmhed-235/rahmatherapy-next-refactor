// SERVER + CLIENT — pure constants. No side effects.

/**
 * Resource-level cache tags (C-B-DECISIONS Q9).
 *
 * Each tag corresponds to a resource family. Server actions call
 * `updateTag(TAG_NAME)` to invalidate caches that read from that family.
 * Data fetchers wrap reads in `unstable_cache(fn, key, { tags: [...] })`
 * carrying the tags their function reads from.
 *
 * Coexists with existing output-driven tags ('report-data',
 * 'dashboard-data') — both layers invalidate independently. Resource
 * tags are ADDED ALONGSIDE existing tags; not replacements.
 */
export const TAGS = {
  CLIENTS: "clients",
  BOOKINGS: "bookings",
  STAFF: "staff",
  ENQUIRIES: "enquiries",
  SETTINGS: "settings",
  AUDIT: "audit",
  EMAILS: "emails",
} as const;

export type ResourceTag = (typeof TAGS)[keyof typeof TAGS];

export const ALL_RESOURCE_TAGS: ResourceTag[] = Object.values(TAGS);

/**
 * Audience map — which page surfaces consume which tag.
 * Documentation only; used by Phase B fetchers to determine the tag set.
 */
export const TAG_AUDIENCE: Record<ResourceTag, string[]> = {
  clients: [
    "/admin/clients",
    "/admin/clients/[id]",
    "/admin/clients/new",
    "/admin/bookings/new",
  ],
  bookings: [
    "/admin/bookings",
    "/admin/bookings/[id]",
    "/admin/bookings/new",
    "/admin/calendar",
    "/admin/dashboard",
    "/admin/reports",
    "/admin/clients/[id]",
    "/admin/staff/[id]",
  ],
  staff: [
    "/admin/staff",
    "/admin/staff/[id]",
    "/admin/staff/[id]/availability",
    "/admin/staff/[id]/performance",
    "/admin/bookings/new",
    "/admin/calendar",
    "/admin/dashboard",
  ],
  enquiries: [
    "/admin/enquiries",
    "/admin/dashboard",
    "/admin/clients/[id]",
    "/admin/bookings/[id]",
  ],
  settings: [
    "/admin/settings",
    "/admin/bookings/new",
    "/admin/calendar",
    "(public booking + customer manage page — out of admin tree)",
  ],
  audit: [
    "/admin/audit",
    "/admin/operations",
    "/admin/clients/[id]",
    "/admin/staff/[id]/performance",
  ],
  emails: [
    "/admin/emails",
    "/admin/email-templates/preview/[id]",
  ],
};

/**
 * C-09 Phase A — the two output-driven tags already in live use
 * (`src/app/admin/bookings/actions.ts` and siblings), predating this
 * taxonomy. Not part of `TAGS` / `ResourceTag` / `ALL_RESOURCE_TAGS`
 * above — they tag cached *output shapes* (report/dashboard data), not
 * resource families, and Phase B preserves every existing call site
 * unchanged. Recorded here only so this file is the complete picture of
 * every cache tag string in play, not just the new resource-level layer.
 */
export const EXISTING_OUTPUT_TAGS = ["report-data", "dashboard-data"] as const;
