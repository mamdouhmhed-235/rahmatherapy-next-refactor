// GENERATED FILE — do not edit by hand.
// Run `node scripts/gen-image-manifest.mjs` (or `pnpm build`) to regenerate.
//
// Every content image present in public/images at build time. Wrappers consult
// this instead of asking the filesystem, because the filesystem does not exist
// on Cloudflare Workers — see scripts/gen-image-manifest.mjs for the full story.
//
// Plain data, no imports: "use client" components render these wrappers, so this
// module must never reach for a node builtin.

export const PUBLIC_IMAGE_PATHS = [
  "/images/about/about-final-cta-v1.jpg",
  "/images/about/about-hero-v3.jpg",
  "/images/about/brand-story-v1.webp",
  "/images/about/female-therapist.jpg",
  "/images/about/minhaj-rahman-v2.jpg",
  "/images/about/nadimur-rahman.png",
  "/images/admin/empty-states/all-caught-up.svg",
  "/images/admin/empty-states/audit-empty.svg",
  "/images/admin/empty-states/closed-dates.svg",
  "/images/admin/empty-states/emails-empty.svg",
  "/images/admin/empty-states/hour-adjustments.svg",
  "/images/admin/empty-states/no-bookings.svg",
  "/images/admin/empty-states/no-clients.svg",
  "/images/admin/empty-states/no-enquiries.svg",
  "/images/admin/empty-states/no-staff-yet.svg",
  "/images/admin/empty-states/reminders-empty.svg",
  "/images/admin/empty-states/staff.svg",
  "/images/areas/area-cta-v2.jpg",
  "/images/areas/bury-park-hero.jpg",
  "/images/areas/dunstable-hero-v2.jpg",
  "/images/areas/houghton-regis-hero.jpg",
  "/images/areas/leagrave-hero.jpg",
  "/images/areas/luton-hero.jpg",
  "/images/areas/package-photos/dry-cupping-fire.jpg",
  "/images/areas/package-photos/dry-cupping-supreme.jpg",
  "/images/areas/package-photos/dry-cupping-variant-b.jpg",
  "/images/areas/package-photos/dry-cupping-variant-c.jpg",
  "/images/areas/package-photos/fire-cupping-setup.jpg",
  "/images/areas/package-photos/massage-session-a.jpg",
  "/images/areas/package-photos/massage-session-b.jpg",
  "/images/areas/package-photos/massage-session-c.jpg",
  "/images/areas/package-photos/wet-cupping-hijama.jpg",
  "/images/areas/package-photos/wet-cupping-variant-b.jpg",
  "/images/areas/package-photos/wet-cupping-variant-c.jpg",
  "/images/areas/stopsley-hero.jpg",
  "/images/brand/rahma/apple-touch-icon.png",
  "/images/brand/rahma/favicon-16.png",
  "/images/brand/rahma/favicon-32.png",
  "/images/brand/rahma/favicon.svg",
  "/images/brand/rahma/logo-mark.svg",
  "/images/brand/rahma/logo-refined.svg",
  "/images/brand/rahma/social-preview.png",
  "/images/faqs-aftercare/before-appointment-v1.jpg",
  "/images/faqs-aftercare/cupping-aftercare-v1.jpg",
  "/images/faqs-aftercare/faqs-hero-v1.jpg",
  "/images/faqs-aftercare/final-cta-v1.jpg",
  "/images/faqs-aftercare/hijama-aftercare-v1.jpg",
  "/images/faqs-aftercare/massage-aftercare-v1.jpg",
  "/images/faqs-aftercare/safety-suitability-v1.jpg",
  "/images/home/home-final-cta.jpg",
  "/images/home/home-session-process.jpg",
  "/images/home/homepage-hero-poster-v3.jpg",
  "/images/home/package-fire.jpg",
  "/images/home/package-hijama-card.jpg",
  "/images/home/package-hijama.webp",
  "/images/home/package-massage-60.jpg",
  "/images/home/package-massage.jpg",
  "/images/home/package-supreme.jpg",
  "/images/home/pain-back-tension.webp",
  "/images/home/pain-gym-recovery.webp",
  "/images/home/pain-muscle-tightness.webp",
  "/images/home/pain-neck-shoulder-tension.webp",
  "/images/home/pain-stress.webp",
  "/images/packages/final-cta.jpg",
  "/images/packages/fire-cupping-package/breakdown.jpg",
  "/images/packages/fire-cupping-package/hero.jpg",
  "/images/packages/hijama-package/breakdown.jpg",
  "/images/packages/hijama-package/hero.jpg",
  "/images/packages/massage-therapy-1-hour/breakdown.jpg",
  "/images/packages/massage-therapy-1-hour/hero.jpg",
  "/images/packages/massage-therapy-30-mins/breakdown.jpg",
  "/images/packages/massage-therapy-30-mins/hero.jpg",
  "/images/packages/safety-band.jpg",
  "/images/packages/supreme-combo-package/breakdown.jpg",
  "/images/packages/supreme-combo-package/hero.jpg",
  "/images/reviews/reviews-final-cta-v1.jpg",
  "/images/reviews/reviews-hero-v1.jpg",
  "/images/services/package-finder-v1.jpg",
  "/images/services/package-fire.jpg",
  "/images/services/package-hijama-card.jpg",
  "/images/services/package-massage-60.jpg",
  "/images/services/package-massage.jpg",
  "/images/services/package-supreme.jpg",
  "/images/services/services-final-cta-v1.jpg",
  "/images/services/services-hero-v1.jpg",
  "/images/services/treatment-methods-v1.jpg",
] as const;

const PUBLIC_IMAGE_SET: ReadonlySet<string> = new Set(PUBLIC_IMAGE_PATHS);

/**
 * Does this `/images/...` path exist in the build?
 *
 * Answers the question the wrappers used to put to `existsSync`, with the same
 * meaning and without a filesystem. A miss is not an error: it renders an
 * `ImagePlaceholder`, which is how a page still being photographed advertises
 * what it is waiting for.
 */
export function publicImageExists(src: string): boolean {
  return PUBLIC_IMAGE_SET.has(src);
}
