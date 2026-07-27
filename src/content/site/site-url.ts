// The one place the site's public origin is defined. Everything absolute derives
// from here — metadataBase, JSON-LD url/item values, anywhere else.
// Deliberately a PURE CONSTANT (D21, 2026-07-26): NEXT_PUBLIC_SITE_URL remains the
// separate env contract for email/cron link generation (getSiteUrl() throws
// without it — by design) and is localhost in dev; canonicals must NOT read it.
export const SITE_URL = "https://rahmatherapy.uk";
export const siteUrl = (path = "/") => new URL(path, SITE_URL).toString();
