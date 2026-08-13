import { AlertTriangle } from "lucide-react";

/**
 * The "still being built" notice, pinned to the BOTTOM of the viewport.
 *
 * ⛔ It must not go back to the top. `.navbar31_component` is
 * `position: fixed; inset: 0 0 auto` (site-parity.css), so a banner in normal
 * flow above it shares the same space rather than pushing it down. That was the
 * live bug: on /home the transparent header let the notice show through with
 * the logo and Book Now button sitting on top of the text, and on every inner
 * page the opaque header hid the notice completely while still leaving ~52px of
 * dead cream — so the one message asking people to phone was invisible exactly
 * where it mattered.
 *
 * Anchoring to the bottom removes the interaction entirely rather than
 * negotiating with it. It also means nothing about the header — the floating
 * pill, the transparent-over-hero state, the hide-on-scroll — has to change to
 * accommodate a bar that gets deleted the day bookings open.
 *
 * `.has-maintenance-banner` on the footer reserves the height it covers.
 */
export function MaintenanceBanner() {
  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[95] border-t-2 border-rahma-gold bg-[#fff8ec] px-4 py-2.5 text-center shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.45)]"
    >
      <p className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[13px] font-semibold leading-snug text-rahma-charcoal sm:text-sm">
        <AlertTriangle className="size-4 shrink-0 text-rahma-gold" aria-hidden />
        <span>This website is still being built — online booking is not yet available.</span>
        {/* Trimmed away on small screens so the bar stays one or two lines. At
            375px the old copy wrapped to three lines and stood 172px tall; the
            phone number and email are what matter, the connective words are not. */}
        <span className="hidden font-normal text-rahma-muted sm:inline">To get in touch:</span>
        <a
          href="tel:07798897222"
          className="font-bold text-rahma-green underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          07798 897222
        </a>
        <span className="hidden font-normal text-rahma-muted md:inline">(call, text, or WhatsApp)</span>
        <span className="hidden font-normal text-rahma-muted sm:inline">·</span>
        <a
          href="mailto:rahmatherapy@outlook.com"
          className="font-bold text-rahma-green underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          rahmatherapy@outlook.com
        </a>
      </p>
    </div>
  );
}
