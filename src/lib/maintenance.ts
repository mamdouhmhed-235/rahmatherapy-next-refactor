/**
 * Whether the public booking flow is switched OFF for this build.
 *
 * ⛔ THE DEFAULT IS "ON" (i.e. booking blocked), AND THAT IS DELIBERATE.
 * The flag is opt-OUT, not opt-in: a build with no environment variable set
 * blocks booking. A missing or misspelled variable therefore fails SAFE —
 * bookings stay closed — rather than quietly opening the booking form on the
 * live site, which is the one outcome that costs something real.
 *
 * ⛔ HOW LIVE AND LOCAL END UP DIFFERENT WITHOUT ANY DASHBOARD CONFIGURATION.
 * `.env` is gitignored and never pushed, so:
 *
 *   LOCAL   `.env` sets NEXT_PUBLIC_BOOKING_ENABLED=true  ->  booking WORKS
 *   LIVE    Cloudflare builds from the repo, which has no `.env`, so the
 *           variable is simply absent                     ->  booking BLOCKED
 *
 * Nothing has to be configured in Cloudflare for the live site to stay closed.
 * To open bookings for real, set NEXT_PUBLIC_BOOKING_ENABLED=true in the
 * Cloudflare build environment and redeploy.
 *
 * ⚠️ `NEXT_PUBLIC_*` is inlined at BUILD time, not read per request. That is the
 * point: it keeps every public page statically prerendered. Reading a request
 * header instead would have made all 58 prerendered pages dynamic, undoing the
 * performance work in gate 14 to answer a question that never changes within a
 * build.
 *
 * ⚠️ THIS GATES THE INTERFACE, NOT THE DATABASE. It stops the booking dialog
 * from mounting, so nobody can book through the website. It does NOT stop a
 * direct POST to /api/bookings. The database's own switch
 * (`business_settings.booking_status_enabled`) is what refuses those, and the
 * two are independent on purpose: this one is per-build, that one is per-clinic
 * and can be flipped from /admin/settings without a deploy.
 */
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "true";
