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
